// =====================================================================
// LECO · agente do WhatsApp: lógica (independente do servidor, testável)
// Recebe o webhook da Meta, entende a mensagem com o Gemini e grava no Leco.
// Valores em centavos. Datas AAAA-MM-DD no fuso de São Paulo.
// =====================================================================

export type Row = Record<string, any>;

export interface UserData {
  name: string;
  accounts: Row[];
  cards: Row[];
  categories: Row[];
  transactions: Row[];
}

export interface Db {
  seenMessage(id: string, phone: string): Promise<boolean>; // true = já processada
  recentCount(phone: string, sinceISO: string): Promise<number>;
  getLink(phone: string): Promise<string | null>;
  consumeCode(code: string): Promise<string | null>;
  link(phone: string, userId: string): Promise<void>;
  unlink(phone: string): Promise<void>;
  loadUser(userId: string): Promise<UserData>;
  insertTx(rows: Row[]): Promise<Row[]>;
  createBatch(userId: string, ids: string[]): Promise<string>;
  getBatch(id: string | null, userId: string): Promise<Row | null>; // id nulo = último lote desfazível
  undoBatch(batch: Row, userId: string): Promise<number>;
}

export interface Wa {
  sendText(to: string, text: string): Promise<void>;
  sendButtons(to: string, text: string, buttons: { id: string; title: string }[]): Promise<void>;
  media(id: string): Promise<{ mime: string; base64: string }>;
  markRead(messageId: string): Promise<void>;
}

export interface Ai {
  interpret(parts: Row[], system: string): Promise<Intent>;
}

export interface Deps { db: Db; wa: Wa; ai: Ai; now: () => Date; log?: (...a: any[]) => void }

export interface Lanc {
  tipo: 'despesa' | 'receita' | 'transferencia';
  valor: number;
  descricao: string;
  data?: string;
  categoria?: string;
  conta?: string;
  conta_destino?: string;
  cartao?: string;
  parcelas?: number;
  ja_pago?: boolean;
}
export interface Intent {
  intencao: 'registrar' | 'consultar' | 'ajuda' | 'outro';
  lancamentos?: Lanc[];
  consulta?: { tipo?: string; de?: string; ate?: string; categoria?: string };
  pergunta?: string;
  resposta?: string;
}

/* ---------------- datas e dinheiro ---------------- */
const pad2 = (n: number) => String(n).padStart(2, '0');
export const todaySP = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const monthKey = (iso: string) => iso.slice(0, 7);
const shiftMonth = (k: string, delta: number) => {
  let y = Number(k.slice(0, 4));
  let m = Number(k.slice(5, 7)) - 1 + delta;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return `${y}-${pad2(m + 1)}`;
};
const daysIn = (k: string) => new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)), 0).getDate();
const dayIn = (k: string, day: number) => `${k}-${pad2(Math.min(day, daysIn(k)))}`;
const addMonthsISO = (iso: string, n: number) => dayIn(shiftMonth(monthKey(iso), n), Number(iso.slice(8, 10)));
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const monthName = (k: string) => MONTHS[Number(k.slice(5, 7)) - 1];
const fmtDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl = (cents: number) => BRL.format(cents / 100).replace(/ /g, ' ');
const isISO = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const sum = (l: Row[], f: (x: Row) => number) => l.reduce((a, x) => a + f(x), 0);

/* ---------------- regras financeiras (iguais às do app) ---------------- */
export const invoiceOf = (card: Row, dateISO: string) => {
  const k = monthKey(dateISO);
  return Number(dateISO.slice(8, 10)) >= Math.min(card.closing_day, daysIn(k)) ? shiftMonth(k, 1) : k;
};
const invoiceDue = (card: Row, inv: string) => dayIn(card.due_day > card.closing_day ? inv : shiftMonth(inv, 1), card.due_day);
const countsAsIncome = (t: Row) => t.kind === 'in' && t.paid;
const countsAsExpense = (t: Row) => t.kind === 'out' && (t.paid || !!t.card_id);

export function balances(accounts: Row[], txs: Row[]) {
  const bal: Record<string, number> = {};
  accounts.forEach((a) => { bal[a.id] = Number(a.initial_balance) || 0; });
  const add = (id: string | null, v: number) => { if (id && bal[id] != null) bal[id] += v; };
  txs.forEach((t) => {
    if (!t.paid) return;
    if (t.kind === 'in') add(t.account_id, t.amount);
    else if (t.kind === 'out' && !t.card_id) add(t.account_id, -t.amount);
    else if (t.kind === 'transfer') { add(t.account_id, -t.amount); add(t.to_account_id, t.amount); }
    else if (t.kind === 'card_payment') add(t.account_id, -t.amount);
  });
  return bal;
}

export function buildInstallments(base: Row, card: Row, n: number) {
  const group = crypto.randomUUID();
  const each = Math.floor(base.amount / n);
  const first = base.amount - each * (n - 1);
  return Array.from({ length: n }, (_, i) => ({
    ...base, amount: i === 0 ? first : each, date: addMonthsISO(base.date, i),
    description: n > 1 ? `${base.description} (${i + 1}/${n})` : base.description,
    installment: n > 1 ? i + 1 : null, installments: n > 1 ? n : null, group_id: n > 1 ? group : null,
    invoice: shiftMonth(invoiceOf(card, base.date), i), paid: true,
  }));
}

/* ---------------- correspondência de nomes ---------------- */
const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export function findByName(list: Row[], name?: string, field = 'name'): Row | null {
  const n = norm(name || '');
  if (!n) return null;
  return list.find((x) => norm(x[field]) === n)
    || list.find((x) => norm(x[field]).includes(n) || n.includes(norm(x[field])))
    || list.find((x) => n.split(' ').some((w) => w.length > 2 && norm(x[field]).split(' ').includes(w)))
    || null;
}

/* ---------------- instruções para a IA ---------------- */
export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    intencao: { type: 'STRING', enum: ['registrar', 'consultar', 'ajuda', 'outro'] },
    lancamentos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          tipo: { type: 'STRING', enum: ['despesa', 'receita', 'transferencia'] },
          valor: { type: 'NUMBER', description: 'Valor em reais, positivo. Ex.: 45.9' },
          descricao: { type: 'STRING', description: 'Curta: estabelecimento ou o que foi. Ex.: Mercado Extra' },
          data: { type: 'STRING', description: 'AAAA-MM-DD' },
          categoria: { type: 'STRING', description: 'Nome exato de uma das categorias do usuário' },
          conta: { type: 'STRING', description: 'Nome exato da conta do usuário, se mencionada' },
          conta_destino: { type: 'STRING', description: 'Só para transferência: conta que recebe' },
          cartao: { type: 'STRING', description: 'Nome exato do cartão de crédito, se a compra foi no crédito' },
          parcelas: { type: 'INTEGER', description: 'Número de parcelas no cartão; 1 se à vista' },
          ja_pago: { type: 'BOOLEAN', description: 'false se for algo a pagar/receber no futuro' },
        },
        required: ['tipo', 'valor', 'descricao', 'data'],
      },
    },
    consulta: {
      type: 'OBJECT',
      properties: {
        tipo: { type: 'STRING', enum: ['saldo', 'gastos', 'receitas', 'resumo', 'vencimentos', 'faturas', 'orcamentos', 'ultimos'] },
        de: { type: 'STRING', description: 'AAAA-MM-DD' },
        ate: { type: 'STRING', description: 'AAAA-MM-DD' },
        categoria: { type: 'STRING' },
      },
    },
    pergunta: { type: 'STRING', description: 'Pergunta curta ao usuário quando falta informação essencial (por exemplo o valor)' },
    resposta: { type: 'STRING', description: 'Resposta curta para ajuda ou conversa' },
  },
  required: ['intencao'],
};

export function systemPrompt(u: UserData, today: string) {
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${today}T12:00:00Z`));
  const accs = u.accounts.map((a) => a.name).join('; ') || '(nenhuma)';
  const cards = u.cards.map((c) => c.name).join('; ') || '(nenhum)';
  const out = u.categories.filter((c) => c.kind === 'out').map((c) => c.name).join('; ');
  const inc = u.categories.filter((c) => c.kind === 'in').map((c) => c.name).join('; ');
  return `Você é o assistente do Leco, um app brasileiro de controle financeiro pessoal, conversando pelo WhatsApp.
Sua tarefa é transformar a mensagem do usuário (texto, áudio ou foto de nota/comprovante) em dados estruturados no formato JSON pedido.

Hoje é ${weekday}, ${fmtDate(today)} (${today}), fuso de São Paulo.
Contas do usuário: ${accs}
Cartões de crédito: ${cards}
Categorias de despesa: ${out}
Categorias de receita: ${inc}

Regras:
- "registrar": quando o usuário informa gastos, compras, pagamentos, receitas, salários, Pix recebidos ou transferências. Pode haver vários lançamentos numa mensagem.
- valor sempre em reais como número (ex.: "45,90" → 45.9; "3 mil" → 3000; "R$ 1.234,56" → 1234.56). Nunca invente valor: se não houver valor, use intencao "registrar" sem lançamentos e preencha "pergunta".
- data: converta "hoje", "ontem", "anteontem", "sexta passada", "dia 5" para AAAA-MM-DD. Sem data, use hoje.
- categoria: escolha a categoria da lista que melhor combina (mercado/padaria/restaurante/ifood → alimentação; uber/99/gasolina → transporte; luz/água/internet/celular → contas e serviços; aluguel/condomínio → moradia; farmácia/consulta → saúde; netflix/spotify → assinaturas). Use exatamente o nome da lista.
- cartao: preencha só se a compra foi no crédito ("no cartão", "no crédito", "no Nubank crédito", nome de um cartão da lista). Débito, Pix e dinheiro saem de uma conta.
- parcelas: "em 3x", "parcelado em 10 vezes" → número. À vista = 1.
- ja_pago: false apenas para contas futuras ("vou pagar", "vence dia 10", "boleto para dia 15"). Caso contrário true.
- transferência: entre contas do próprio usuário ("passei 500 do Nubank para a poupança").
- Foto de cupom fiscal ou nota: um lançamento de despesa com o TOTAL pago, descrição = nome do estabelecimento, data da nota.
- Comprovante de Pix/transferência: se o usuário pagou, é despesa (descrição = quem recebeu); se recebeu, é receita (descrição = quem pagou).
- Áudio: entenda a fala e aplique as mesmas regras.
- "consultar": perguntas sobre saldo, quanto gastou ou recebeu num período ou categoria, resumo do mês, contas a vencer, faturas, orçamentos, últimos lançamentos. Preencha consulta.tipo e o período (de/ate) quando houver ("este mês", "mês passado", "semana passada", "em setembro").
- "ajuda": cumprimentos ou perguntas sobre como usar. "outro": assuntos fora de finanças pessoais; responda em "resposta" de forma breve e educada, lembrando o que você faz.
- Responda sempre em português do Brasil.`;
}

/* ---------------- textos ---------------- */
const HELP = (name: string) => `Oi${name ? `, ${name}` : ''}! Eu registro as suas finanças no Leco. Exemplos:

💸 *gastei 45,90 no mercado*
💳 *tênis 300 em 3x no cartão Nubank*
💰 *recebi 3500 de salário*
🔁 *passei 200 do Nubank para a poupança*
🎙️ Mande um *áudio* contando o gasto
🧾 Mande a *foto* da nota ou do comprovante de Pix

Também respondo perguntas:
📊 *quanto gastei este mês?*
🏦 *qual meu saldo?*
📅 *o que vence esta semana?*

Errou? Toque em *Desfazer* ou escreva *desfazer*.`;

const NOT_LINKED = `Olá! Eu sou o assistente do *Leco* 💚

Para registrar as suas finanças por aqui, vincule este número à sua conta:
1. Abra o Leco (app ou site)
2. Vá em *Configurações › WhatsApp*
3. Toque em *Gerar código* e envie o código aqui (ex.: LECO-123456)`;

/* ---------------- processamento ---------------- */
export async function handleWebhook(body: any, deps: Deps) {
  const entries = body?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const msg of value.messages || []) {
        try { await handleMessage(msg, value, deps); } catch (e) { deps.log?.('erro ao processar', e); }
      }
    }
  }
}

function msgText(msg: Row): string {
  if (msg.type === 'text') return msg.text?.body || '';
  if (msg.type === 'image' || msg.type === 'document') return msg[msg.type]?.caption || '';
  if (msg.type === 'interactive') return msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
  if (msg.type === 'button') return msg.button?.text || '';
  return '';
}

export async function handleMessage(msg: Row, value: Row, deps: Deps) {
  const { db, wa } = deps;
  const phone = String(msg.from || '').replace(/\D/g, '');
  if (!phone || !msg.id) return;
  if (await db.seenMessage(msg.id, phone)) return;
  const now = deps.now();
  const recent = await db.recentCount(phone, new Date(now.getTime() - 10 * 60000).toISOString());
  if (recent > 30) { if (recent === 31) await wa.sendText(phone, 'Recebi muitas mensagens seguidas. Aguarde alguns minutos e tente de novo.'); return; }
  wa.markRead(msg.id).catch(() => {});

  const text = msgText(msg).trim();
  const userId = await db.getLink(phone);

  if (!userId) {
    const m = text.toUpperCase().match(/LECO-?\s?(\d{6})/);
    if (m) {
      const owner = await db.consumeCode(`LECO-${m[1]}`);
      if (!owner) { await wa.sendText(phone, 'Código inválido ou expirado. Gere um novo em *Configurações › WhatsApp* no Leco (ele vale 15 minutos).'); return; }
      await db.link(phone, owner);
      const u = await db.loadUser(owner);
      await wa.sendText(phone, `✅ Pronto${u.name ? `, ${u.name.split(' ')[0]}` : ''}! Este WhatsApp está ligado à sua conta do Leco.\n\n${HELP('').replace(/^Oi! /, '')}`);
      return;
    }
    await wa.sendText(phone, NOT_LINKED);
    return;
  }

  // Botão "Desfazer" ou comando
  const btnId: string = msg.interactive?.button_reply?.id || msg.button?.payload || '';
  if (btnId.startsWith('undo:') || /^desfaz(er)?\b/i.test(text)) {
    const batch = await db.getBatch(btnId.startsWith('undo:') ? btnId.slice(5) : null, userId);
    if (!batch || batch.undone) { await wa.sendText(phone, 'Não encontrei nada recente para desfazer.'); return; }
    const n = await db.undoBatch(batch, userId);
    await wa.sendText(phone, n ? `↩️ Desfeito: ${n === 1 ? '1 lançamento removido' : `${n} lançamentos removidos`} do Leco.` : 'Esses lançamentos já tinham sido removidos.');
    return;
  }
  if (/^desvincular\b/i.test(text)) {
    await db.unlink(phone);
    await wa.sendText(phone, 'Este número foi desvinculado do Leco. Para usar de novo, gere um código no app.');
    return;
  }

  const u = await db.loadUser(userId);
  const first = u.name ? u.name.split(' ')[0] : '';
  if (/^(oi|ol[aá]|bom dia|boa tarde|boa noite|ajuda|menu|help|come[cç]ar)\W*$/i.test(text)) { await wa.sendText(phone, HELP(first)); return; }
  if (!u.accounts.length) { await wa.sendText(phone, 'Você ainda não tem nenhuma conta no Leco. Abra o app, crie a primeira conta (ex.: Nubank, Carteira) e volte aqui.'); return; }

  // Monta a entrada para a IA (texto + mídia)
  const parts: Row[] = [];
  const mediaType = ['audio', 'image', 'document'].includes(msg.type) ? msg.type : null;
  if (mediaType) {
    const mediaId = msg[mediaType]?.id;
    const mime = (msg[mediaType]?.mime_type || '').split(';')[0];
    if (mediaType === 'document' && !/pdf|image\//.test(mime)) { await wa.sendText(phone, 'Consigo ler fotos, PDFs de comprovante e áudios. Esse tipo de ficheiro eu não leio.'); return; }
    const file = await wa.media(mediaId);
    parts.push({ inline_data: { mime_type: (file.mime || mime).split(';')[0], data: file.base64 } });
    parts.push({ text: mediaType === 'audio' ? 'O usuário mandou este áudio.' : `O usuário mandou esta ${mediaType === 'image' ? 'foto' : 'ficheiro'}${text ? ` com a legenda: "${text}"` : ''}.` });
  } else if (text) {
    parts.push({ text });
  } else {
    await wa.sendText(phone, 'Por enquanto entendo texto, áudio e fotos de notas ou comprovantes. 🙂');
    return;
  }

  const today = todaySP(now);
  let intent: Intent;
  try { intent = await deps.ai.interpret(parts, systemPrompt(u, today)); } catch (e) {
    deps.log?.('erro IA', e);
    await wa.sendText(phone, 'Não consegui entender agora (o serviço de IA não respondeu). Tente de novo em instantes.');
    return;
  }

  if (intent.intencao === 'registrar') {
    const lancs = (intent.lancamentos || []).filter((l) => Number(l.valor) > 0);
    if (!lancs.length) { await wa.sendText(phone, intent.pergunta || 'Qual foi o valor? Ex.: *gastei 45,90 no mercado*'); return; }
    await register(phone, userId, u, lancs, today, deps);
    return;
  }
  if (intent.intencao === 'consultar') { await wa.sendText(phone, answerQuery(intent.consulta || {}, u, today)); return; }
  if (intent.intencao === 'ajuda') { await wa.sendText(phone, HELP(first)); return; }
  await wa.sendText(phone, intent.resposta || intent.pergunta || 'Sou o assistente do Leco: registro gastos e receitas e respondo perguntas sobre as suas finanças. Escreva *ajuda* para ver exemplos.');
}

async function register(phone: string, userId: string, u: UserData, lancs: Lanc[], today: string, deps: Deps) {
  const rows: Row[] = [];
  const lines: string[] = [];
  const defaultAcc = u.accounts[0];
  const catFor = (kind: 'in' | 'out', name?: string) => {
    const list = u.categories.filter((c) => c.kind === kind);
    return findByName(list, name)
      || list.find((c) => norm(c.name) === (kind === 'in' ? 'outras receitas' : 'outros gastos'))
      || list[0] || null;
  };
  for (const l of lancs.slice(0, 10)) {
    const amount = Math.round(Number(l.valor) * 100);
    if (!(amount > 0 && amount < 1e11)) continue;
    const date = isISO(l.data) ? l.data! : today;
    const desc = (l.descricao || '').trim().slice(0, 60);
    if (l.tipo === 'transferencia') {
      const from = findByName(u.accounts, l.conta) || defaultAcc;
      const to = findByName(u.accounts, l.conta_destino);
      if (!to || to.id === from.id) { await deps.wa.sendText(phone, `Para qual conta foi a transferência? Suas contas: ${u.accounts.map((a) => a.name).join(', ')}.`); return; }
      rows.push({ user_id: userId, kind: 'transfer', amount, description: desc || 'Transferência', date, account_id: from.id, to_account_id: to.id, paid: true });
      lines.push(`🔁 *${brl(amount)}* de ${from.name} para ${to.name} · ${fmtDate(date)}`);
      continue;
    }
    const kind = l.tipo === 'receita' ? 'in' : 'out';
    const cat = catFor(kind, l.categoria);
    const card = kind === 'out' ? findByName(u.cards, l.cartao) : null;
    const acc = findByName(u.accounts, l.conta) || defaultAcc;
    const base: Row = { user_id: userId, kind, amount, description: desc || (cat ? cat.name : kind === 'in' ? 'Receita' : 'Despesa'), date, category_id: cat ? cat.id : null, notes: 'Registrado pelo WhatsApp' };
    if (card) {
      const n = Math.max(1, Math.min(24, Math.round(Number(l.parcelas) || 1)));
      const inst = buildInstallments({ ...base, account_id: null, card_id: card.id }, card, n);
      rows.push(...inst);
      const inv = inst[0].invoice;
      lines.push(`💳 *${base.description}* · ${n > 1 ? `${n}x de ${brl(inst[1].amount)} (total ${brl(amount)})` : brl(amount)}\n${cat ? cat.name : ''} · ${card.name} · fatura de ${monthName(inv)}`);
    } else {
      const paid = l.ja_pago === false ? false : date <= today;
      rows.push({ ...base, account_id: acc.id, card_id: null, invoice: null, paid });
      const icon = kind === 'in' ? '💰' : '💸';
      lines.push(`${icon} *${base.description}* · ${kind === 'in' ? '+' : '−'}${brl(amount)}\n${cat ? cat.name : ''} · ${acc.name} · ${fmtDate(date)}${paid ? '' : kind === 'in' ? ' · a receber' : ' · a pagar'}`);
    }
  }
  if (!rows.length) { await deps.wa.sendText(phone, 'Não encontrei um valor válido. Ex.: *gastei 45,90 no mercado*'); return; }
  // Todas as linhas com as mesmas colunas (exigência do insert em lote)
  const COLS = ['user_id', 'kind', 'amount', 'description', 'date', 'category_id', 'account_id', 'to_account_id', 'card_id', 'invoice', 'installment', 'installments', 'group_id', 'paid', 'notes'];
  const full = rows.map((r) => Object.fromEntries(COLS.map((c) => [c, r[c] ?? (c === 'paid' ? true : c === 'notes' ? 'Registrado pelo WhatsApp' : null)])));
  const made = await deps.db.insertTx(full);
  const batch = await deps.db.createBatch(userId, made.map((r) => r.id));
  const title = lines.length === 1 ? 'Registrado no Leco ✅' : `${lines.length} lançamentos registrados no Leco ✅`;
  await deps.wa.sendButtons(phone, `${title}\n\n${lines.join('\n\n')}`, [{ id: `undo:${batch}`, title: 'Desfazer' }]);
}

/* ---------------- consultas (calculadas aqui, não pela IA) ---------------- */
export function answerQuery(q: Row, u: UserData, today: string): string {
  const k = monthKey(today);
  const from = isISO(q.de) ? q.de : `${k}-01`;
  const to = isISO(q.ate) ? q.ate : dayIn(k, 31);
  const period = from === `${k}-01` && to === dayIn(k, 31) ? `em ${monthName(k)}` : `de ${fmtDate(from)} a ${fmtDate(to)}`;
  const txs = u.transactions;
  const catName = (id: string) => (u.categories.find((c) => c.id === id) || {}).name || 'Sem categoria';
  const inRange = txs.filter((t) => t.date >= from && t.date <= to);
  const tipo = q.tipo || 'resumo';

  if (tipo === 'saldo') {
    const bal = balances(u.accounts, txs);
    const lines = u.accounts.map((a) => `• ${a.name}: *${brl(bal[a.id])}*`);
    const total = sum(u.accounts, (a) => bal[a.id]);
    const cards = u.cards.map((c) => {
      const debt = sum(txs.filter((t) => t.card_id === c.id && t.kind === 'out'), (t) => t.amount) - sum(txs.filter((t) => t.card_id === c.id && t.kind === 'card_payment'), (t) => t.amount);
      return `• ${c.name}: ${brl(Math.max(0, debt))} usado de ${brl(c.limit_amount)}`;
    });
    return `🏦 *Saldo em contas: ${brl(total)}*\n${lines.join('\n')}${cards.length ? `\n\n💳 Cartões\n${cards.join('\n')}` : ''}`;
  }

  if (tipo === 'gastos' || tipo === 'receitas') {
    const isOut = tipo === 'gastos';
    let list = inRange.filter(isOut ? countsAsExpense : countsAsIncome);
    let label = '';
    if (q.categoria) {
      const cat = findByName(u.categories.filter((c) => c.kind === (isOut ? 'out' : 'in')), q.categoria);
      if (cat) { list = list.filter((t) => t.category_id === cat.id); label = ` com ${cat.name}`; }
    }
    const total = sum(list, (t) => t.amount);
    if (!list.length) return `${isOut ? '💸' : '💰'} Nenhuma ${isOut ? 'despesa' : 'receita'}${label} ${period}.`;
    const by: Record<string, number> = {};
    list.forEach((t) => { const c = catName(t.category_id); by[c] = (by[c] || 0) + t.amount; });
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, v]) => `• ${c}: ${brl(v)}`);
    return `${isOut ? '💸 Você gastou' : '💰 Você recebeu'} *${brl(total)}*${label} ${period} (${list.length} ${list.length === 1 ? 'lançamento' : 'lançamentos'}).${label ? '' : `\n\n${top.join('\n')}`}`;
  }

  if (tipo === 'vencimentos') {
    const limit = isISO(q.ate) ? q.ate : addDays(today, 7);
    const pend = txs.filter((t) => !t.paid && t.date <= limit).sort((a, b) => (a.date < b.date ? -1 : 1));
    const inv = u.cards.flatMap((c) => {
      const map: Record<string, { total: number; paid: number }> = {};
      txs.filter((t) => t.card_id === c.id && t.invoice).forEach((t) => { const o = map[t.invoice] || (map[t.invoice] = { total: 0, paid: 0 }); if (t.kind === 'out') o.total += t.amount; else if (t.kind === 'card_payment') o.paid += t.amount; });
      return Object.entries(map).map(([i, o]) => ({ c, due: invoiceDue(c, i), rem: o.total - o.paid })).filter((x) => x.rem > 0 && x.due <= limit && x.due >= addDays(today, -30));
    });
    if (!pend.length && !inv.length) return `📅 Nada vencendo até ${fmtDate(limit)}. 🎉`;
    const lines = [
      ...pend.map((t) => `• ${fmtDate(t.date)} · ${t.description} · ${t.kind === 'in' ? '+' : ''}${brl(t.amount)}${t.date < today ? ' ⚠️ atrasada' : ''}`),
      ...inv.map((x) => `• ${fmtDate(x.due)} · Fatura ${x.c.name} · ${brl(x.rem)}${x.due < today ? ' ⚠️ vencida' : ''}`),
    ];
    return `📅 *Vencimentos até ${fmtDate(limit)}*\n${lines.join('\n')}`;
  }

  if (tipo === 'faturas') {
    if (!u.cards.length) return '💳 Você não tem cartões cadastrados no Leco.';
    return `💳 *Faturas atuais*\n${u.cards.map((c) => {
      const inv = invoiceOf(c, today);
      const total = sum(txs.filter((t) => t.card_id === c.id && t.invoice === inv && t.kind === 'out'), (t) => t.amount);
      return `• ${c.name}: *${brl(total)}* · fecha ${fmtDate(dayIn(inv, c.closing_day))} · vence ${fmtDate(invoiceDue(c, inv))}`;
    }).join('\n')}`;
  }

  if (tipo === 'orcamentos') {
    const spent: Record<string, number> = {};
    txs.filter((t) => countsAsExpense(t) && monthKey(t.date) === k && t.category_id).forEach((t) => { spent[t.category_id] = (spent[t.category_id] || 0) + t.amount; });
    const list = u.categories.filter((c) => c.kind === 'out' && c.budget > 0);
    if (!list.length) return '🎯 Nenhuma categoria tem orçamento. Defina limites em *Categorias* no app.';
    return `🎯 *Orçamentos de ${monthName(k)}*\n${list.map((c) => { const s = spent[c.id] || 0; const p = Math.round((s / c.budget) * 100); return `• ${c.name}: ${brl(s)} de ${brl(c.budget)} (${p}%)${p >= 100 ? ' 🔴' : p >= 80 ? ' 🟡' : ''}`; }).join('\n')}`;
  }

  if (tipo === 'ultimos') {
    const last = txs.filter((t) => t.kind === 'in' || t.kind === 'out').slice(0, 6);
    if (!last.length) return 'Nenhum lançamento ainda.';
    return `🧾 *Últimos lançamentos*\n${last.map((t) => `• ${fmtDate(t.date)} · ${t.description} · ${t.kind === 'in' ? '+' : '−'}${brl(t.amount)}`).join('\n')}`;
  }

  // resumo
  const inc = sum(inRange.filter(countsAsIncome), (t) => t.amount);
  const exp = sum(inRange.filter(countsAsExpense), (t) => t.amount);
  const by: Record<string, number> = {};
  inRange.filter(countsAsExpense).forEach((t) => { const c = catName(t.category_id); by[c] = (by[c] || 0) + t.amount; });
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `• ${c}: ${brl(v)}`);
  const rate = inc ? Math.round(((inc - exp) / inc) * 100) : 0;
  return `📊 *Resumo ${period}*\n💰 Receitas: ${brl(inc)}\n💸 Despesas: ${brl(exp)}\n${inc - exp >= 0 ? '✅' : '⚠️'} Resultado: *${brl(inc - exp)}*${inc ? ` (${rate}% poupado)` : ''}${top.length ? `\n\nMaiores gastos:\n${top.join('\n')}` : ''}`;
}

/* ---------------- assinatura da Meta ---------------- */
export async function validSignature(raw: string, header: string | null, secret: string) {
  if (!header || !header.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const hex = Array.from(sig).map((b) => b.toString(16).padStart(2, '0')).join('');
  const got = header.slice(7);
  if (got.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
