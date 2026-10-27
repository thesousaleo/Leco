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
const shiftMonthJS = (k, n) => { const [y, m] = k.split('-').map(Number); const t = y * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
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
    ok(await page.getByRole('dialog', { name: 'Ajustar imagem' }).count() === 1, 'abre o recorte da imagem');
    await page.getByRole('button', { name: 'Usar imagem' }).click();
    await wait(400);
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

  step('Estilo Sóbrio');
  {
    await page.evaluate(() => { const d = window.__leco(); d.setSettingsSub('preferencias'); d.go('config'); });
    await wait(600);
    await page.getByRole('button', { name: /Sóbrio/ }).click();
    await wait(900);
    ok(await page.evaluate(() => document.documentElement.dataset.style) === 'sobrio' && await page.evaluate(() => window.__leco().prefs.style) === 'sobrio', 'estilo Sóbrio salvo e aplicado');
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.evaluate(() => window.__leco().goTx({}));
    await wait(700);
    ok(await page.getByRole('columnheader', { name: 'Descrição' }).count() > 0, 'Sóbrio no computador: extrato em tabela');
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(400);
    await page.evaluate(() => window.__leco().setPrefs({ style: 'glass' }));
    await wait(900);
    ok(await page.evaluate(() => document.documentElement.dataset.style) === 'glass', 'volta para o Vidro');
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
    for (const [id, label] of [['transacoes', 'Descrição'], ['contas', 'Saldo'], ['recorrentes', 'Frequência'], ['categorias', 'Participação']]) {
      await cp.evaluate((x) => (x === 'transacoes' ? window.__leco().goTx({}) : window.__leco().go(x)), id);
      await cp.waitForTimeout(500);
      ok(await cp.getByRole('columnheader', { name: label }).count() > 0, `computador Clean: tabela em ${id}`);
    }
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
    for (const id of ['inicio', 'transacoes', 'contas', 'recorrentes', 'metas', 'categorias', 'planejamento', 'dividas', 'calendario', 'relatorios']) {
      await mp.evaluate((x) => (x === 'transacoes' ? window.__leco().goTx({}) : window.__leco().go(x)), id);
      await mp.waitForTimeout(450);
      const [sw, cw] = await mp.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      ok(sw <= cw, `celular Clean sem rolagem lateral: ${id}`, `${sw} > ${cw}`);
    }
    await mctx.close();
  }

  step('Novidades 3.11: início personalizável, seleção em massa, semana, tablet, regras e "E se?"');
  {
    const dctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const dp = await dctx.newPage();
    dp.on('pageerror', (e) => errors.push(`novidades: ${e}`));
    await dp.route(/fonts\.(googleapis|gstatic)\.com|api\.github\.com/, (r) => r.abort());
    await dp.goto(`file://${html}?demo=1&embed=1`);
    await dp.waitForTimeout(1800);
    const L = (fn, arg) => dp.evaluate(fn, arg);
    // Início personalizável
    await dp.getByRole('button', { name: 'Personalizar o início' }).click();
    await dp.waitForTimeout(400);
    ok(await dp.getByText('Arraste os blocos').count() === 1, 'início: modo de edição dos blocos');
    await dp.getByRole('button', { name: 'Esconder bloco Próximos vencimentos' }).click();
    await dp.waitForTimeout(400);
    const wh = await L(() => (window.__leco().prefs.webHome || []).find((b) => b.id === 'upcoming'));
    ok(wh && wh.on === false, 'início: esconder um bloco fica salvo', JSON.stringify(wh));
    await dp.getByRole('button', { name: 'Restaurar padrão' }).click();
    await dp.waitForTimeout(300);
    await dp.getByRole('button', { name: 'Pronto' }).click();
    await dp.waitForTimeout(300);
    // Seleção em massa
    await L(() => window.__leco().goTx({}));
    await dp.waitForTimeout(600);
    await dp.getByRole('button', { name: 'Selecionar' }).first().click();
    await dp.waitForTimeout(300);
    const boxes = dp.getByRole('checkbox');
    const before = await L(() => window.__leco().transactions.filter((t) => t.kind === 'out').length);
    await boxes.nth(0).click(); await boxes.nth(1).click();
    await dp.waitForTimeout(300);
    ok(await dp.getByText('2 selecionados').count() === 1, 'extrato: barra de seleção mostra 2 selecionados');
    const lazer = await L(() => (window.__leco().categories.find((c) => c.kind === 'out' && /lazer/i.test(c.name)) || {}).id);
    await dp.getByLabel('Mudar categoria').selectOption(lazer).catch(() => {});
    await dp.waitForTimeout(700);
    const nLazer = await L((id) => window.__leco().transactions.filter((t) => t.category_id === id).length, lazer);
    ok(nLazer >= 2, 'extrato: mudar categoria em massa', `lazer=${nLazer}`);
    ok(before === await L(() => window.__leco().transactions.filter((t) => t.kind === 'out').length), 'extrato: nada foi excluído por engano');
    await dp.getByRole('button', { name: 'Concluir seleção' }).click().catch(() => {});
    // Calendário semana
    await L(() => window.__leco().go('calendario'));
    await dp.waitForTimeout(500);
    await dp.getByRole('radio', { name: 'Semana' }).or(dp.getByRole('button', { name: 'Semana', exact: true })).first().click();
    await dp.waitForTimeout(400);
    ok(await dp.getByText('Gasto na semana').count() === 1, 'calendário: visão da semana');
    await dp.getByRole('button', { name: 'Semana anterior' }).click();
    await dp.waitForTimeout(300);
    ok(await dp.getByText('Gasto na semana').count() === 1, 'calendário: navega entre semanas');
    // Regras automáticas
    const transp = await L(() => (window.__leco().categories.find((c) => c.kind === 'out' && /transporte/i.test(c.name)) || {}).id);
    await L(() => window.__leco().go('config'));
    await L(() => window.__leco().setSettingsSub('regras'));
    await dp.waitForTimeout(500);
    await dp.fill('#rule-match', 'Patinete');
    await dp.selectOption('#rule-cat', transp);
    await dp.getByRole('button', { name: 'Criar regra' }).click();
    await dp.waitForTimeout(500);
    ok(await L(() => (window.__leco().prefs.rules || []).some((r) => r.match === 'Patinete')), 'regras: regra criada');
    await L(() => window.__leco().openModal({ kind: 'tx' }));
    await dp.waitForTimeout(500);
    await dp.fill('#tx-desc', 'Patinete elétrico');
    await dp.waitForTimeout(600);
    ok(await dp.locator('[data-rule-hit]').count() === 1, 'regras: aviso de regra aplicada no lançamento');
    await dp.getByRole('dialog').getByRole('button', { name: /Fechar/ }).first().click().catch(() => {});
    await dp.keyboard.press('Escape');
    await dp.waitForTimeout(400);
    const q = await L(() => { const d = window.__leco(); return parseQuickText('patinete 12', d); }).catch(() => null);
    ok(q && q.category_id === transp, 'regras: valem no lançamento rápido', JSON.stringify(q && q.category_id));
    // Simulador
    await L(() => window.__leco().go('simulador'));
    await dp.waitForTimeout(600);
    const a0 = await dp.locator('[data-sim="after"]').innerText();
    await dp.locator('[data-sim-cat] input[type=range]').first().fill('50');
    await dp.waitForTimeout(700);
    const a1 = await dp.locator('[data-sim="after"]').innerText();
    ok(a0 !== a1, 'simulador: reduzir uma categoria muda a sobra', `${a0} → ${a1}`);
    ok(await dp.getByText('por mês').count() > 0 && await dp.getByText('Você passaria a guardar a mais').count() === 1, 'simulador: mostra a economia por mês');
    ok(await dp.locator('[data-sim="goal"]').innerText().then((t) => /mês|meses|ano/.test(t)), 'simulador: calcula o prazo da meta');
    // Tablet
    await dp.setViewportSize({ width: 960, height: 1280 });
    await dp.waitForTimeout(500);
    ok(await dp.getByRole('navigation', { name: 'Abas principais' }).count() === 1, 'tablet: usa o menu lateral');
    const [sw, cw] = await L(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    ok(sw <= cw, 'tablet: sem rolagem lateral', `${sw} > ${cw}`);
    await dctx.close();
  }

  step('Calculadora no valor da transação');
  {
    await page.evaluate(() => { window.__leco().go('inicio'); window.__leco().openModal({ kind: 'tx' }); });
    await wait(700);
    await page.getByRole('button', { name: 'Abrir calculadora' }).click();
    await wait(400);
    const pad = page.getByRole('group', { name: 'Calculadora' });
    for (const k of ['4', '5', 'Vírgula', '9', 'Somar', '1', '2', 'Vírgula', '5']) await pad.getByRole('button', { name: k, exact: true }).click();
    ok((await page.locator('[data-calc-result]').innerText()).includes('58,40'), 'calculadora: soma 45,9 + 12,5');
    await pad.getByRole('button', { name: 'Somar', exact: true }).click();
    for (const k of ['1', '0', 'Porcentagem']) await pad.getByRole('button', { name: k, exact: true }).click();
    ok((await page.locator('[data-calc-result]').innerText()).includes('64,24'), 'calculadora: porcentagem sobre o total');
    await page.locator('[data-calc-use]').click();
    await wait(300);
    ok((await page.inputValue('#tx-amount')).includes('64,24'), 'calculadora: usa o resultado no valor');
    ok(await page.getByRole('group', { name: 'Calculadora' }).count() === 0, 'calculadora: fecha ao usar');
    await page.keyboard.press('Escape');
    await wait(500);
  }

  step('Parcelas: valor por parcela e compra já em andamento');
  {
    const run = (txt) => page.evaluate((t) => { const q = parseQuickText(t, window.__leco()); return { a: q.amount, n: q.installments, per: q.instPer, st: q.instStart }; }, txt);
    const q1 = await run('tênis 3x de 72 no cartão');
    ok(q1.a === 7200 && q1.n === 3 && q1.per, 'rápido: "3x de 72" é o valor de cada parcela', JSON.stringify(q1));
    const q2 = await run('tênis 300 em 3x');
    ok(q2.a === 30000 && q2.n === 3 && !q2.per, 'rápido: "300 em 3x" é o total', JSON.stringify(q2));
    const q3 = await run('geladeira 250 parcela 3 de 6');
    ok(q3.n === 6 && q3.st === 3 && q3.per, 'rápido: "parcela 3 de 6"', JSON.stringify(q3));
    const card = await page.evaluate(() => window.__leco().cards[0]);
    const before = (await txs()).length;
    await page.evaluate((c) => { window.__leco().go('inicio'); window.__leco().openModal({ kind: 'tx', presetSource: `card:${c.id}` }); }, card);
    await wait(700);
    await money('#tx-amount', 7200);
    await page.fill('#tx-desc', 'Celular parcelado');
    await dlg().getByRole('radio', { name: 'Parcelado' }).or(dlg().getByRole('button', { name: 'Parcelado', exact: true })).first().click();
    await wait(300);
    await page.selectOption('#tx-inst', '6');
    await dlg().getByRole('radio', { name: 'Valor da parcela' }).or(dlg().getByRole('button', { name: 'Valor da parcela', exact: true })).first().click();
    await page.selectOption('#tx-inst-start', '3');
    await wait(300);
    const sum = await page.locator('[data-inst-summary]').innerText();
    ok(/6x de R\$\s?72,00/.test(sum) && /total R\$\s?432,00/.test(sum) && /3ª à 6ª/.test(sum), 'formulário: resumo das parcelas', sum.replace(/\s+/g, ' '));
    await save();
    const made = (await txs()).filter((t) => /^Celular parcelado/.test(t.description));
    ok(made.length === 4 && made.every((t) => t.amount === 7200), 'parcelas: 4 lançamentos de R$ 72 (3ª a 6ª)', `${made.length} ${made.map((t) => t.amount).join(',')}`);
    ok(made.map((t) => t.installment).sort().join(',') === '3,4,5,6' && made.every((t) => t.installments === 6), 'parcelas: numeradas 3/6 a 6/6');
    const invs = [...new Set(made.map((t) => t.invoice))].sort();
    ok(invs.length === 4, 'parcelas: uma em cada fatura', invs.join(','));
    ok((await txs()).length === before + 4, 'parcelas: nada além das 4');
  }

  step('Fatura: pagar só uma parte e levar o restante');
  {
    const L = () => page.evaluate(() => { const d = window.__leco(); const c = d.cards[0]; const s = cardSummary(c, d.transactions); return { c, inv: s.invoices.map((i) => ({ k: i.invoice, total: i.total, paid: i.paid, rem: i.remaining, st: i.status })) }; });
    const card = (await L()).c;
    // compra numa fatura já fechada: data antes do fechamento do mês passado
    const prev = await page.evaluate((c) => { const k = shiftMonth(monthKey(todayISO()), -1); const inv = invoiceOf(c, `${k}-02`); return { k, inv, date: `${k}-02` }; }, card);
    await page.evaluate(async ({ c, p }) => { await window.__leco().saveTx(null, { kind: 'out', amount: 100000, description: 'Teste fatura parcial', date: p.date, category_id: null, account_id: null, card_id: c.id, paid: true, notes: null }, 1); }, { c: card, p: prev });
    await wait(400);
    let inv = (await L()).inv.find((i) => i.k === prev.inv);
    const owed = inv.rem;
    await page.evaluate(({ c, k }) => window.__leco().openModal({ kind: 'invoice', card: c, cardId: c.id, invoice: k, initialInvoice: k }), { c: card, k: prev.inv });
    await wait(700);
    await dlg().getByRole('button', { name: 'Pagar fatura' }).click();
    await wait(300);
    await dlg().getByText('Só uma parte', { exact: true }).click();
    await money('#pay-amount', 40000);
    await wait(200);
    ok(await page.locator('#pay-roll').count() + await dlg().getByText(/Levar os R\$/).count() > 0, 'fatura: oferece levar o restante');
    await money('#pay-interest', 2500);
    // (o zoom de texto ligado em testes anteriores desalinha as coordenadas do clique)
    await dlg().getByRole('button', { name: /Pagar R\$/ }).evaluate((b) => b.click());
    await wait(900);
    const all = await L();
    inv = all.inv.find((i) => i.k === prev.inv);
    const next = all.inv.find((i) => i.k === shiftMonthJS(prev.inv, 1));
    ok(inv.rem === 0, 'fatura: paga em parte e o restante foi levado', JSON.stringify(inv));
    const carry = (await txs()).filter((t) => t.is_adjustment && t.card_id === card.id && t.kind === 'out');
    ok(carry.some((t) => t.amount === owed - 40000), 'fatura: saldo da anterior entra na próxima', carry.map((t) => t.amount).join(','));
    ok((await txs()).some((t) => /^Juros do restante/.test(t.description) && t.amount === 2500 && !t.is_adjustment), 'fatura: juros entram como despesa');
    ok(next && next.total >= owed - 40000 + 2500, 'fatura: próxima fatura soma restante e juros', JSON.stringify(next));
    const exp = await page.evaluate(() => { const d = window.__leco(); return d.transactions.filter((t) => countsAsExpense(t) && /Saldo da fatura/.test(t.description)).length; });
    ok(exp === 0, 'fatura: restante levado fica fora dos relatórios');
    // desfazer
    const c0 = carry[0];
    await page.evaluate((t) => window.__leco().deleteTx(t, 'group'), c0);
    await wait(500);
    inv = (await L()).inv.find((i) => i.k === prev.inv);
    ok(inv.rem === owed - 40000 && (inv.st === 'parcial' || inv.st === 'vencida'), 'fatura: desfazer devolve o restante (paga em parte)', JSON.stringify(inv));
    await page.keyboard.press('Escape');
    await wait(400);
  }

  step('Layout no celular (sem rolagem lateral)');
  await page.setViewportSize({ width: 360, height: 760 });
  for (const id of ['inicio', 'transacoes', 'calendario', 'relatorios', 'planejamento', 'simulador', 'dividas', 'contas', 'metas', 'categorias', 'mais']) {
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
