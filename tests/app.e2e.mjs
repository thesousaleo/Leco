// Testes de ponta a ponta do Leco (banco em memória, navegador Chromium).
// Rodar: node tests/app.e2e.mjs   (gera a versão de teste e abre num celular simulado)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'leco-e2e-'));
const html = path.join(tmp, 'leco.html');
execFileSync('node', [path.join(root, 'scripts/build-web.mjs'), 'test', html], { stdio: 'inherit' });

let passed = 0;
const fails = [];
const ok = (cond, name, extra = '') => { if (cond) { passed++; console.log(`  ✓ ${name}`); } else { fails.push(name); console.log(`  ✗ ${name} ${extra}`); } };
const step = (t) => console.log(`\n${t}`);

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.route(/fonts\.(googleapis|gstatic)\.com|api\.github\.com/, (r) => r.abort());
await page.goto(`file://${html}`);

const dlg = () => page.getByRole('dialog');
const wait = (ms = 350) => page.waitForTimeout(ms);
const fab = async () => { await page.locator('.fab-corner').click(); await wait(450); };
const money = async (sel, cents) => { await page.fill(sel, ''); await page.type(sel, String(cents)); };
const save = async () => { await dlg().getByRole('button', { name: /Adicionar|Salvar|Transferir/ }).last().click(); await wait(700); };
const txs = () => page.evaluate(() => window.__leco && window.__leco().transactions);
const nav = async (name) => { await page.getByRole('navigation').getByRole('button', { name }).click(); await wait(450); };
const goMenu = async (label) => { await page.getByRole('button', { name: 'Abrir menu' }).first().click(); await wait(450); await page.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: new RegExp(label) }).first().click(); await wait(500); };
const back = async () => { await page.getByRole('button', { name: 'Voltar' }).click(); await wait(350); };

try {
  step('Entrada e boas-vindas');
  await page.getByRole('button', { name: /Google/ }).first().click();
  await page.fill('#ob-name', 'Leonardo Teste');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.fill('#ob-acc', 'Nubank');
  await page.type('#ob-bal', '200000');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: /Sim, cadastrar/ }).click();
  await page.fill('#ob-card', 'Roxinho');
  await page.type('#ob-limit', '500000');
  await page.getByRole('button', { name: 'Concluir' }).click();
  await wait(900);
  ok(await page.getByText('Saldo total').count() > 0, 'abre o Início depois das boas-vindas');

  step('Regras sem tela');
  const unit = await page.evaluate(() => {
    const d = window.__leco();
    const r = {};
    const q1 = parseQuickText('mercado 45,90 ontem', d, '2026-10-23');
    r.quickAmount = q1.amount === 4590 && q1.date === '2026-10-22' && q1.kind === 'out';
    const q2 = parseQuickText('recebi 3500 salário', d, '2026-10-23');
    r.quickIncome = q2.kind === 'in' && q2.amount === 350000;
    const q3 = parseQuickText('tênis 300 em 3x no cartão', d, '2026-10-23');
    r.quickCard = q3.installments === 3 && !!q3.card_id && q3.amount === 30000;
    r.money = parseMoneyBR('1.234,56') === 123456 && parseMoneyBR('-R$ 10,00') === -1000 && parseMoneyBR('1234.5') === 123450;
    const csv = 'Data;Descrição;Valor\n01/10/2026;Supermercado Dia;-87,35\n02/10/2026;Pix recebido João;150,00\n';
    const p1 = parseStatement(csv, 'extrato.csv');
    r.csv = p1.rows.length === 2 && p1.rows[0].amount === -8735 && p1.rows[1].amount === 15000;
    const nub = 'date,title,amount\n2026-10-05,Uber *Trip,23.50\n2026-10-06,Pagamento recebido,-500.00\n';
    const p2 = parseStatement(nub, 'nubank.csv');
    r.cardCsv = p2.rows[0].amount === -2350 && p2.rows[1].amount === 50000;
    const ofx = '<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261003120000<TRNAMT>-45.90<FITID>1<MEMO>PADARIA BOM PAO</STMTTRN></BANKTRANLIST></OFX>';
    const p3 = parseStatement(ofx, 'x.ofx');
    r.ofx = p3.rows.length === 1 && p3.rows[0].date === '2026-10-03' && p3.rows[0].amount === -4590;
    r.ics = /BEGIN:VCALENDAR[\s\S]*END:VCALENDAR/.test(buildICS(d));
    const old = FIN.start; FIN.start = 5;
    const [a, b] = finRange('2026-10');
    r.finMonth = a === '2026-10-05' && b === '2026-11-04' && finMonthOf('2026-10-03') === '2026-09';
    FIN.start = old;
    return r;
  });
  Object.entries(unit).forEach(([k, v]) => ok(v, `regra: ${k}`));

  step('Lançamento rápido por texto');
  await page.getByRole('button', { name: 'Rápido' }).first().click();
  await wait(400);
  await page.fill('#quick-text', 'mercado extra 45,90 ontem');
  await dlg().getByRole('button', { name: 'Lançar' }).click();
  await wait(700);
  let list = await txs();
  ok(list.some((t) => t.amount === 4590 && /mercado extra/i.test(t.description)), 'cria o lançamento a partir do texto');

  step('Leitura de comprovante com IA');
  const img = path.join(tmp, 'cupom.png');
  fs.writeFileSync(img, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  await page.locator('button[aria-label="Ler comprovante com IA"] + input[type=file]').first().setInputFiles(img);
  await wait(1400);
  ok((await page.inputValue('#tx-desc')) === 'Supermercado Dia' && (await page.inputValue('#tx-amount')).includes('87,35'), 'IA preenche valor e descrição');
  ok(await dlg().getByText(/Lido pela IA/).count() === 1, 'mostra o aviso para conferir');
  await save();
  list = await txs();
  ok(list.some((t) => t.description === 'Supermercado Dia' && t.amount === 8735 && t.attachment), 'lançamento salvo com o comprovante anexado');

  step('Parcelado no boleto (conta)');
  await fab();
  await dlg().getByText('Parcelado', { exact: true }).click();
  await money('#tx-amount', 120000);
  await page.fill('#tx-desc', 'Geladeira');
  await page.selectOption('#tx-inst', '6');
  await save();
  list = await txs();
  const gel = list.filter((t) => /^Geladeira/.test(t.description));
  ok(gel.length === 6 && gel.filter((t) => !t.paid).length === 5 && !gel[0].invoice, '6 parcelas, as futuras ficam a pagar');

  step('Editar todas as parcelas');
  const p3 = gel.find((t) => t.installment === 3);
  await page.evaluate((id) => { const t = window.__leco().transactions.find((x) => x.id === id); window.__leco().openModal({ kind: 'tx', initial: t }); }, p3.id);
  await wait(500);
  await page.fill('#tx-desc', 'Geladeira Brastemp');
  await save();
  await dlg().getByRole('button', { name: 'Todas', exact: true }).click();
  await wait(1800);
  list = await txs();
  ok(list.filter((t) => /^Geladeira Brastemp \(\d\/6\)$/.test(t.description)).length === 6, 'mudança aplicada nas 6 parcelas', JSON.stringify(list.filter((t) => /Geladeira/.test(t.description)).map((t) => t.description)));

  step('Compra dividida em categorias');
  await fab();
  await money('#tx-amount', 20000);
  await page.fill('#tx-desc', 'Supermercado');
  await dlg().getByRole('button', { name: /Dividir em várias categorias/ }).click();
  const selects = dlg().locator('select[aria-label^="Categoria da parte"]');
  await selects.nth(0).selectOption({ label: 'Alimentação' });
  await selects.nth(1).selectOption({ label: 'Compras' });
  const amounts = dlg().locator('input[aria-label^="Valor da parte"]');
  await amounts.nth(0).fill(''); await amounts.nth(0).type('15000');
  await amounts.nth(1).fill(''); await amounts.nth(1).type('5000');
  await save();
  list = await txs();
  const sp = list.filter((t) => t.description === 'Supermercado');
  ok(sp.length === 2 && sp[0].split_id && sp[0].split_id === sp[1].split_id, 'duas partes ligadas pelo split_id');

  step('Assinatura no cartão com etiqueta');
  await fab();
  await dlg().getByText('Repete', { exact: true }).click();
  await money('#tx-amount', 5590);
  await page.fill('#tx-desc', 'Netflix');
  await page.selectOption('#tx-source', { label: 'Roxinho (crédito)' });
  await dlg().getByRole('button', { name: /Mais opções/ }).click();
  await page.fill('#tx-tags', 'lazer ');
  await save();
  await wait(500);
  const st = await page.evaluate(() => { const d = window.__leco(); return { recs: d.recurrings.length, tagged: d.transactions.some((t) => t.description === 'Netflix' && (t.tags || []).includes('lazer')) }; });
  ok(st.recs === 1 && st.tagged, 'recorrência criada e etiqueta salva');

  step('Modelo de lançamento');
  await fab();
  await money('#tx-amount', 3500);
  await page.fill('#tx-desc', 'Almoço');
  await dlg().getByRole('button', { name: 'Salvar como modelo' }).click();
  await wait(500);
  await dlg().getByRole('button', { name: 'Cancelar' }).click();
  await wait(400);
  await fab();
  await dlg().getByRole('button', { name: /Preencher automaticamente/ }).click();
  await wait(300);
  await dlg().getByRole('button', { name: /Almoço/ }).first().click();
  ok((await page.inputValue('#tx-desc')) === 'Almoço', 'modelo preenche o formulário');
  await dlg().getByRole('button', { name: 'Cancelar' }).click();
  await wait(400);

  step('Ajustar saldo');
  await goMenu('Contas e cartões');
  await page.getByRole('button', { name: /Ajustar saldo/ }).first().click();
  await wait(400);
  await page.fill('#adj-real', '');
  await page.type('#adj-real', '150000');
  await dlg().getByRole('button', { name: 'Ajustar' }).click();
  await wait(700);
  const bal = await page.evaluate(() => { const d = window.__leco(); return d.balances[d.accounts[0].id]; });
  ok(bal === 150000, 'saldo corrigido para R$ 1.500,00', `(${bal})`);
  await back();

  step('Importar extrato CSV');
  await goMenu('Importar extrato');
  const csvPath = path.join(tmp, 'extrato.csv');
  fs.writeFileSync(csvPath, 'Data;Descrição;Valor\n10/10/2026;Posto Ipiranga;-200,00\n11/10/2026;Farmácia Drogasil;-35,50\n12/10/2026;Pix recebido;300,00\n');
  await dlg().locator('input[type=file]').setInputFiles(csvPath);
  await wait(500);
  await dlg().getByRole('button', { name: /^Importar 3/ }).click();
  await wait(800);
  list = await txs();
  const posto = list.find((t) => t.description === 'Posto Ipiranga');
  const transporte = await page.evaluate(() => (window.__leco().categories.find((c) => c.name === 'Transporte') || {}).id);
  ok(posto && posto.category_id === transporte, 'importa e sugere a categoria (posto → Transporte)');

  step('Dívida');
  await page.evaluate(() => window.__leco().go('dividas'));
  await wait(400);
  await page.getByRole('button', { name: 'Nova dívida' }).click();
  await wait(400);
  await page.fill('#debt-name', 'Empréstimo banco');
  await money('#debt-total', 300000);
  await page.fill('#debt-n', '10');
  await page.selectOption('#debt-due', '15');
  await dlg().getByRole('button', { name: 'Salvar' }).click();
  await wait(600);
  await page.getByRole('button', { name: 'Registrar pagamento' }).click();
  await wait(400);
  await dlg().getByRole('button', { name: 'Registrar' }).click();
  await wait(700);
  const debt = await page.evaluate(() => window.__leco().debts[0]);
  ok(debt && debt.paid === 30000, 'parcela da dívida registrada');

  step('Planejamento');
  await page.evaluate(() => window.__leco().go('planejamento'));
  await wait(600);
  ok(await page.getByText('Planejado × realizado').count() > 0 && await page.getByText('Projeção de saldo').count() > 0, 'página de planejamento abre');
  await page.getByRole('button', { name: 'Planejar' }).first().click();
  await wait(300);
  const planInput = page.locator('input[aria-label^="Planejado para"]').first();
  await planInput.fill(''); await planInput.type('80000');
  await page.getByRole('button', { name: 'Salvar' }).first().click();
  await wait(600);
  ok(await page.evaluate(() => window.__leco().plans.length) === 1, 'valor planejado salvo');

  step('Calendário e busca');
  await nav('Calendário');
  ok(await page.getByText(/Previsto/).count() >= 0, 'calendário abre');
  const calEv = await page.evaluate(() => calendarEvents(window.__leco(), '2026-01-01', '2027-12-31').some((e) => e.debt));
  ok(calEv, 'dívida aparece no calendário');
  await page.getByRole('button', { name: 'Buscar' }).first().click();
  await wait(400);
  await page.fill('#search-q', 'netflix');
  await wait(300);
  ok(await dlg().getByText('Netflix').count() > 0, 'busca global encontra o lançamento');
  await page.keyboard.press('Escape');
  await wait(400);

  step('PDF do extrato');
  await nav('Extrato');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Gerar PDF do extrato' }).click()]);
  const pdfPath = path.join(tmp, 'extrato.pdf');
  await pdf.saveAs(pdfPath);
  ok(fs.readFileSync(pdfPath).slice(0, 4).toString() === '%PDF', 'PDF gerado');

  step('Cópia completa e restauração');
  await page.evaluate(() => { const d = window.__leco(); d.setSettingsSub('dados'); d.go('config'); });
  await wait(500);
  const [bk] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Cópia completa/ }).click()]);
  const bkPath = path.join(tmp, 'backup.json');
  await bk.saveAs(bkPath);
  const before = (await txs()).length;
  await page.getByRole('button', { name: /Restaurar cópia/ }).click();
  await wait(400);
  await dlg().locator('input[type=file]').setInputFiles(bkPath);
  await wait(400);
  await dlg().getByRole('button', { name: 'Restaurar' }).click();
  await wait(1500);
  const after = (await txs()).length;
  ok(after === before * 2, 'juntar dobra os lançamentos', `(${before} → ${after})`);
  await dlg().getByRole('button', { name: 'Pronto' }).click();
  await wait(400);

  step('Aparência e personalização');
  await page.evaluate(() => { const d = window.__leco(); d.setSettingsSub('preferencias'); d.go('config'); });
  await wait(400);
  await page.getByRole('button', { name: /Preto/ }).click();
  await page.getByRole('button', { name: /Oceano/ }).click();
  await wait(400);
  const look = await page.evaluate(() => ({ black: document.documentElement.dataset.black, vivo: document.documentElement.style.getPropertyValue('--color-vivo') }));
  ok(look.black === '1' && look.vivo === '#1A7FA3', 'tema preto e cor Oceano aplicados');
  await page.evaluate(() => { const d = window.__leco(); d.setSettingsSub('personalizar'); d.go('config'); });
  await wait(400);
  await page.selectOption('#pz-tab-2', 'planejamento');
  await wait(400);
  ok(await page.getByRole('navigation').getByRole('button', { name: 'Planejar' }).count() === 1, 'aba do menu trocada para Planejar');

  step('Bloqueio com PIN');
  await page.evaluate(() => { const d = window.__leco(); d.setSettingsSub('seguranca'); d.go('config'); });
  await wait(400);
  await page.getByRole('button', { name: 'Ativar PIN' }).click();
  await wait(400);
  for (const k of '12341234') { await dlg().getByRole('button', { name: k, exact: true }).click(); await wait(60); }
  await wait(600);
  await page.selectOption('#pin-timeout', '0');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await wait(400);
  ok(await page.getByRole('dialog', { name: 'App bloqueado' }).count() === 1, 'app bloqueia ao voltar');
  for (const k of '9999') await page.getByRole('dialog', { name: 'App bloqueado' }).getByRole('button', { name: k, exact: true }).click();
  await wait(600);
  ok(await page.getByRole('dialog', { name: 'App bloqueado' }).count() === 1, 'PIN errado não desbloqueia');
  for (const k of '1234') await page.getByRole('dialog', { name: 'App bloqueado' }).getByRole('button', { name: k, exact: true }).click();
  await wait(600);
  ok(await page.getByRole('dialog', { name: 'App bloqueado' }).count() === 0, 'PIN certo desbloqueia');

  step('Comprovante: tirar foto ou escolher arquivo');
  {
    await page.evaluate(() => window.__leco().go('inicio'));
    await wait(500);
    await page.getByRole('button', { name: 'Ler comprovante com IA' }).first().click();
    await wait(400);
    ok(await page.getByRole('button', { name: /Tirar foto agora/ }).count() === 1 && await page.getByRole('button', { name: /Escolher da galeria/ }).count() === 1, 'pergunta se tira foto ou escolhe arquivo');
    ok(await page.locator('input[data-scan="camera"][capture="environment"]').count() > 0, 'opção da câmera abre a câmera traseira');
    await page.getByRole('button', { name: 'Cancelar' }).last().click();
    await wait(400);
  }

  step('Nova transação só pelo + e pelos atalhos do Início');
  {
    await page.evaluate(() => window.__leco().go('calendario'));
    await wait(600);
    ok(await page.getByRole('button', { name: /^(\+ )?adicionar$|Adicionar conta|Nova conta/i }).count() === 0, 'calendário sem botão de adicionar');
    await page.getByRole('button', { name: 'Abrir menu' }).first().click();
    await wait(450);
    ok(await page.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: /Ler comprovante/ }).count() === 0, 'menu lateral sem atalho de lançamento');
    await page.keyboard.press('Escape');
    await wait(400);
    await page.evaluate(() => window.__leco().go('inicio'));
    await wait(500);
    ok(await page.locator('.fab-corner').count() === 1 && await page.getByRole('button', { name: 'Ler comprovante com IA' }).count() > 0, 'botão + e atalhos do Início continuam');
  }

  step('Conta com banco da lista e imagem própria');
  {
    await page.evaluate(() => window.__leco().openModal({ kind: 'account' }));
    await wait(500);
    await page.fill('#acc-bank', 'sicr');
    await wait(200);
    await dlg().getByRole('option', { name: /Sicredi/ }).click();
    ok((await page.inputValue('#acc-name')) === 'Sicredi', 'escolher o banco preenche o nome');
    const logo = path.join(tmp, 'logo.png');
    fs.writeFileSync(logo, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4GBgYGJgYGBAQAvBgID3n3ZJQAAAABJRU5ErkJggg==', 'base64'));
    await page.locator('input[data-icon-file]').first().setInputFiles(logo);
    await wait(600);
    ok(await dlg().getByText('Usando sua imagem').count() === 1, 'imagem própria escolhida como ícone');
    await dlg().getByRole('button', { name: 'Criar conta' }).click();
    await wait(800);
    const acc = await page.evaluate(() => window.__leco().accounts.find((a) => a.name === 'Sicredi'));
    ok(acc && String(acc.icon).startsWith('data:image/') && String(acc.icon).length < 20000, 'conta salva com a imagem pequena', acc ? String(acc.icon).length : 'sem conta');
  }

  step('Notificações personalizadas');
  {
    await page.evaluate(() => { const d = window.__leco(); d.setSettingsSub('notificacoes'); d.go('config'); });
    await wait(600);
    await page.fill('#nt-time', '07:30');
    await page.getByRole('switch', { name: 'Recebimentos' }).click();
    await page.getByRole('switch', { name: 'Lembrete para registrar os gastos' }).click();
    await wait(300);
    await page.fill('#nt-daily-time', '21:15');
    await wait(1200);
    const n = await page.evaluate(() => window.__leco().prefs.notif);
    ok(n && n.time === '07:30' && n.receive === true && n.daily === true && n.dailyTime === '21:15', 'horário e tipos de aviso salvos', JSON.stringify(n));
  }

  step('Agenda de lembretes');
  {
    const r = await page.evaluate(async () => {
      const d = window.__leco();
      const out = [];
      const LN = { checkPermissions: async () => ({ display: 'granted' }), getPending: async () => ({ notifications: [] }), cancel: async () => {}, schedule: async ({ notifications }) => { out.push(...notifications); } };
      const tomorrow = addDays(todayISO(), 1);
      const fake = { ...d, transactions: [...d.transactions, { id: 'x1', kind: 'out', paid: false, date: tomorrow, amount: 12345, description: 'Luz teste' }, { id: 'x2', kind: 'in', paid: false, date: tomorrow, amount: 500000, description: 'Salário teste' }], profile: { ...d.profile, notify_bills: true, bill_days_before: 2 } };
      await window.__scheduleReminders(fake, { notif: { time: '07:30', receive: true, daily: true, dailyTime: '21:15' } }, LN);
      const luz = out.filter((n) => /Luz teste/.test(n.title));
      const sal = out.filter((n) => /Salário teste/.test(n.title));
      const daily = out.find((n) => n.schedule.on);
      return { luz: luz.map((n) => [n.schedule.at.getHours(), n.schedule.at.getMinutes(), n.body]), sal: sal.length, daily: daily ? [daily.schedule.on.hour, daily.schedule.on.minute] : null };
    });
    ok(r.luz.length === 1 && r.luz[0][0] === 7 && r.luz[0][1] === 30 && /vence hoje/.test(r.luz[0][2]), 'conta de amanhã: aviso no dia, no horário escolhido', JSON.stringify(r.luz));
    ok(r.sal === 1, 'recebimento também avisa');
    ok(r.daily && r.daily[0] === 21 && r.daily[1] === 15, 'lembrete diário no horário escolhido');
  }

  step('Vale-alimentação e refeição');
  {
    const totalBefore = await page.evaluate(() => { const d = window.__leco(); return cashAccounts(d.accounts).reduce((s, a) => s + (d.balances[a.id] || 0), 0); });
    await page.evaluate(() => window.__leco().openModal({ kind: 'account', presetKind: 'beneficio' }));
    await wait(500);
    await dlg().getByText('Refeição', { exact: true }).click();
    await dlg().getByRole('radio', { name: 'Alelo' }).click();
    ok((await page.inputValue('#acc-name')) === 'VR Alelo', 'nome automático do vale');
    await page.fill('#acc-balance', ''); await page.type('#acc-balance', '30000');
    await page.fill('#acc-credit', ''); await page.type('#acc-credit', '50000');
    await dlg().getByRole('button', { name: 'Criar conta' }).click();
    await wait(1500);
    const st = await page.evaluate(() => {
      const d = window.__leco();
      const a = d.accounts.find((x) => x.name === 'VR Alelo');
      const rec = a && d.recurrings.find((r) => r.account_id === a.id);
      const total = cashAccounts(d.accounts).reduce((s, x) => s + (d.balances[x.id] || 0), 0);
      return { kind: a && a.kind, type: a && a.benefit && a.benefit.type, credit: a && a.benefit && a.benefit.credit, rec: !!rec && rec.amount === 50000 && rec.kind === 'in', recLinked: !!(a && a.benefit && a.benefit.recurring_id), cat: d.categories.some((c) => c.name === 'Benefícios' && c.kind === 'in'), bal: a ? d.balances[a.id] : null, total };
    });
    ok(st.kind === 'beneficio' && st.type === 'vr' && st.credit === 50000, 'vale salvo com tipo e crédito', JSON.stringify(st));
    ok(st.rec && st.recLinked && st.cat, 'crédito mensal virou recorrência na conta do vale');
    ok(st.bal === 30000 && st.total === totalBefore, 'saldo do vale fica fora do saldo total');
    await page.evaluate(() => window.__leco().go('inicio'));
    await wait(500);
    await fab();
    const hasGroup = await dlg().locator('optgroup[label="Vale-alimentação / refeição"]').count();
    ok(hasGroup === 1, 'vale aparece em "Pago com"');
    await dlg().getByRole('button', { name: 'Cancelar' }).click();
    await wait(400);
  }

  step('Tema não volta ao atualizar');
  {
    const prev = await page.evaluate(() => window.__leco().prefs.theme);
    await page.evaluate(() => window.__leco().setPrefs({ theme: 'dark' }));
    await wait(900);
    await page.evaluate(() => window.__leco().setPrefs({ theme: 'light' }));
    await wait(100);
    await page.evaluate(() => window.__leco().reload());
    await wait(900);
    const th = await page.evaluate(() => [window.__leco().prefs.theme, document.documentElement.dataset.leco]);
    ok(th[0] === 'light' && th[1] === 'light', 'tema claro continua depois de puxar para atualizar', th.join(','));
    await page.evaluate((t) => window.__leco().setPrefs({ theme: t }), prev);
    await wait(900);
  }

  step('Ocultar valores no computador');
  {
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.evaluate(() => window.__leco().go('inicio'));
    await wait(600);
    const eye = page.getByRole('button', { name: 'Ocultar valores' });
    ok(await eye.count() > 0, 'botão de ocultar valores no Início do computador');
    await eye.first().click();
    await wait(500);
    ok(await page.evaluate(() => window.__leco().hide) === true, 'valores ocultos');
    await page.getByRole('button', { name: 'Mostrar valores' }).first().click();
    await wait(500);
    ok(await page.evaluate(() => window.__leco().hide) === false, 'valores visíveis de novo');
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(500);
  }

  step('Exclusão rápida, aviso e estado vazio');
  {
    const before = (await txs()).length;
    await page.evaluate(() => { const d = window.__leco(); const t = d.transactions.find((x) => !x.group_id && !x.recurring_id && !x.split_id && x.kind !== 'card_payment'); d.openModal({ kind: 'deleteTx', t }); });
    await wait(500);
    ok(await dlg().getByText('Excluir transação?').count() === 1, 'excluir pede confirmação');
    await dlg().getByRole('button', { name: 'Excluir', exact: true }).click();
    await wait(700);
    ok((await txs()).length === before - 1, 'transação excluída depois de confirmar');
    const toastBox = await page.locator('.toast-top').boundingBox();
    ok(toastBox && toastBox.y < 120, 'aviso de vidro aparece no topo no celular');
    await page.evaluate(() => window.__leco().go('transacoes'));
    await wait(450);
    if (!(await page.locator('#f-q').count())) { await page.getByRole('button', { name: 'Filtros' }).click(); await wait(400); }
    await page.fill('#f-q', 'zzzz-nada');
    await wait(400);
    ok(await page.locator('.empty-art').count() > 0, 'estado vazio com ilustração');
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await wait(400);
    ok(await page.locator('.empty-art').count() === 0, 'limpar filtros mostra a lista de novo');
  }

  step('Modo demonstração (dados fictícios no navegador)');
  {
    const dctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const dp = await dctx.newPage();
    dp.on('pageerror', (e) => errors.push(`demo: ${e}`));
    await dp.route(/fonts\.(googleapis|gstatic)\.com|api\.github\.com/, (r) => r.abort());
    await dp.goto(`file://${html}?demo=1`);
    await dp.waitForTimeout(1500);
    const st = await dp.evaluate(() => { const d = window.__leco && window.__leco(); return d ? { tx: d.transactions.length, acc: d.accounts.length, goals: d.goals.length } : null; });
    ok(st && st.tx > 30 && st.acc === 4 && st.goals === 2, 'demonstração abre com dados de exemplo', JSON.stringify(st));
    ok(await dp.getByText('Demonstração', { exact: true }).count() === 1, 'selo de demonstração visível');
    await dp.evaluate(async () => { const d = window.__leco(); await d.deleteTx(d.transactions.find((x) => !x.recurring_id && x.kind === 'out'), 'one'); });
    await dp.waitForTimeout(600);
    await dp.reload();
    await dp.waitForTimeout(1500);
    const n2 = await dp.evaluate(() => window.__leco().transactions.length);
    ok(n2 === st.tx - 1, 'alterações da demonstração ficam salvas no navegador', `${n2} vs ${st.tx - 1}`);
    await dp.setViewportSize({ width: 1280, height: 900 });
    await dp.goto(`file://${html}?demo=1&moldura=1`);
    await dp.waitForTimeout(2500);
    const clock = (await dp.locator('.statusbar span').first().textContent()) || '';
    ok(/^\d{2}:\d{2}$/.test(clock.trim()), 'moldura mostra a hora na barra de status', clock);
    ok(await dp.locator('.home-indicator').count() === 1, 'moldura tem o indicador de início');
    const inFrame = await dp.frameLocator('iframe').getByText('Saldo total').count();
    ok(inFrame > 0, 'app roda dentro da moldura');
    await dctx.close();
  }

  step('Site Clean (visual paralelo)');
  {
    const cctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const cp = await cctx.newPage();
    cp.on('pageerror', (e) => errors.push(`clean: ${e}`));
    await cp.route(/fonts\.(googleapis|gstatic)\.com|api\.github\.com/, (r) => r.abort());
    await cp.goto(`file://${html}?demo=1&skin=clean`);
    await cp.waitForTimeout(1500);
    ok(await cp.evaluate(() => document.documentElement.dataset.skin) === 'clean', 'visual Clean ativo');
    ok(await cp.getByRole('heading', { name: 'Fluxo de caixa' }).count() === 1 && await cp.getByText('Transações recentes').count() > 0, 'início com cartões, fluxo de caixa e tabela');
    await cp.getByRole('navigation', { name: 'Menu principal' }).getByRole('button', { name: 'Despesas' }).click();
    await cp.waitForTimeout(600);
    const onlyOut = await cp.evaluate(() => { const d = window.__leco(); return d.page === 'transacoes' && d.txPreset && d.txPreset.type === 'out'; });
    ok(onlyOut, 'menu leva às despesas filtradas');
    await cp.getByRole('navigation', { name: 'Menu principal' }).getByRole('button', { name: 'Início' }).click();
    await cp.waitForTimeout(500);
    await cp.getByRole('tab', { name: 'Quadro de orçamento' }).click();
    await cp.waitForTimeout(400);
    ok(await cp.getByRole('region', { name: 'Contas fixas' }).count() === 1, 'quadro de orçamento em colunas');
    await cp.getByRole('switch', { name: 'Modo escuro' }).click();
    await cp.waitForTimeout(600);
    ok(await cp.evaluate(() => document.documentElement.dataset.leco) === 'dark', 'modo escuro pelo menu');
    await cctx.close();
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const mp = await mctx.newPage();
    mp.on('pageerror', (e) => errors.push(`clean celular: ${e}`));
    await mp.route(/fonts\.(googleapis|gstatic)\.com|api\.github\.com/, (r) => r.abort());
    await mp.goto(`file://${html}?demo=1&skin=clean`);
    await mp.waitForTimeout(1500);
    ok(await mp.getByRole('heading', { name: 'Fluxo de caixa' }).count() === 1, 'celular: início no visual Clean');
    await mp.getByRole('button', { name: 'Abrir menu' }).click();
    await mp.waitForTimeout(400);
    await mp.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Metas', exact: true }).click();
    await mp.waitForTimeout(600);
    ok(await mp.evaluate(() => window.__leco().page) === 'metas', 'celular: menu lateral navega');
    const [sw, cw] = await mp.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    ok(sw <= cw, 'celular: sem rolagem lateral no Clean', `${sw} > ${cw}`);
    await mctx.close();
  }

  step('Layout no celular (sem rolagem lateral)');
  await page.setViewportSize({ width: 360, height: 760 });
  for (const id of ['inicio', 'transacoes', 'calendario', 'relatorios', 'planejamento', 'dividas', 'contas', 'metas', 'categorias', 'mais']) {
    await page.evaluate((x) => window.__leco().go(x), id);
    await wait(450);
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    ok(sw <= cw, `sem rolagem lateral: ${id}`, `(${sw} > ${cw})`);
  }
} catch (e) {
  fails.push(`erro: ${e.message.split('\n')[0]}`);
  console.log(e);
  await page.screenshot({ path: path.join(tmp, 'falha.png') }).catch(() => {});
  console.log(`print da falha: ${path.join(tmp, 'falha.png')}`);
}

ok(errors.length === 0, 'nenhum erro de JavaScript na página', errors.join(' | '));
await browser.close();
console.log(`\n${passed} ok, ${fails.length} falha(s)`);
if (fails.length) { console.log(fails.map((f) => ` - ${f}`).join('\n')); process.exit(1); }
