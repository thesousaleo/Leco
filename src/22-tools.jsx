/* =====================================================================
   22-tools: regras sem tela — lançamento rápido por texto, importação de extrato
   (OFX/CSV), agenda (.ics), restauração de backup, projeção de saldo,
   alertas inteligentes, assinaturas e conquistas.
   ===================================================================== */

/* ---------- Palavras-chave para sugerir categoria ---------- */
const CAT_HINTS = [
  [/mercad|supermerc|atacad|assai|carrefour|extra|pao de acucar|hortifrut|padaria|acougue|ifood|rappi|restaur|lanchon|pizz|burger|mcdonald|bk |subway|cafe|starbucks|delivery|aliment/, ['alimentacao', 'mercado', 'restaurante']],
  [/uber|99 |99app|99pop|taxi|cabify|posto|shell|ipiranga|petrobras|br mania|combust|gasolin|estacion|pedagio|sem parar|conectcar|metro|onibus|bilhete|transporte/, ['transporte']],
  [/aluguel|condominio|iptu|imobili|moradia/, ['moradia']],
  [/enel|light|cemig|copel|celesc|energia|luz|sabesp|cedae|agua|saneamento|comgas|gas |vivo|claro|tim |oi |internet|telefon|celular|net |sky/, ['contas e servicos', 'contas']],
  [/netflix|spotify|disney|hbo|max |prime video|amazon prime|youtube|deezer|apple\.com|icloud|google one|globoplay|paramount|crunchyroll|assinatura/, ['assinaturas']],
  [/farmac|drogaria|droga raia|drogasil|pague menos|hospital|clinica|medic|laborat|dentist|unimed|amil|hapvida|saude/, ['saude']],
  [/escola|faculdade|universidade|curso|udemy|alura|livraria|educa/, ['educacao']],
  [/cinema|ingresso|show|teatro|steam|playstation|xbox|nintendo|bar |balada|lazer|viagem|hotel|airbnb|booking|decolar|latam|gol |azul /, ['lazer']],
  [/magazine|americanas|mercado livre|mercadolivre|shopee|shein|aliexpress|amazon|renner|riachuelo|c&a|zara|centauro|netshoes|loja|compra/, ['compras']],
  [/salario|salário|folha|pagamento empresa|proventos|vencimentos/, ['salario']],
  [/rendimento|dividendo|juros|resgate|cdb|tesouro/, ['investimentos']],
];

// Sugere categoria: primeiro pelo histórico do usuário (mesma descrição), depois por palavras-chave
function suggestCategory(desc, kind, d) {
  const n = normTxt(desc);
  if (!n) return null;
  const rule = matchRule(desc, kind, d);
  if (rule && rule.category_id) return rule.category_id;
  const list = d.categories.filter((c) => c.kind === kind && !c.archived);
  const key = n.split(' ').slice(0, 2).join(' ');
  const counts = {};
  d.transactions.forEach((t) => { if (t.kind === kind && t.category_id && normTxt(t.description).startsWith(key)) counts[t.category_id] = (counts[t.category_id] || 0) + 1; });
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (best && list.some((c) => c.id === best[0])) return best[0];
  for (const [re, names] of CAT_HINTS) {
    if (re.test(` ${n} `)) {
      const c = list.find((x) => names.some((nm) => normTxt(x.name).includes(nm)));
      if (c) return c.id;
    }
  }
  return null;
}

/* ---------- Valores e datas em texto brasileiro ---------- */
function parseMoneyBR(s) {
  if (s == null) return NaN;
  let t = String(s).trim().replace(/\s/g, '').replace(/R\$|BRL/gi, '');
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (t.startsWith('-')) { neg = true; t = t.slice(1); } else if (t.startsWith('+')) t = t.slice(1);
  if (t.endsWith('-')) { neg = true; t = t.slice(0, -1); }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) || /^\d+,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  else t = t.replace(',', '.');
  const v = parseFloat(t);
  return Number.isFinite(v) ? Math.round((neg ? -v : v) * 100) : NaN;
}
function parseDateBR(s, fallbackYear) {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/);
  if (m) {
    let y = m[3] ? Number(m[3]) : fallbackYear || Number(todayISO().slice(0, 4));
    if (y < 100) y += 2000;
    const iso = `${y}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`;
    return isNaN(Date.parse(iso)) ? null : iso;
  }
  m = t.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/* ---------- Lançamento rápido por texto ---------- */
// Ex.: "mercado 45,90 ontem", "recebi 3500 salário", "tênis 300 em 3x no roxinho", "uber 25 dia 12"
function parseQuickText(text, d, today = todayISO()) {
  const raw = (text || '').trim();
  if (!raw) return null;
  let s = ` ${raw.toLowerCase()} `;
  const out = { kind: 'out', amount: 0, description: '', date: today, category_id: null, account_id: null, card_id: null, installments: 1, paid: true };
  if (/\b(recebi|ganhei|entrou|caiu|salario|salário|pix recebido|reembolso)\b/.test(s)) out.kind = 'in';
  // parcelas
  const inst = s.match(/\b(?:em\s*)?(\d{1,2})\s*x\b|\bparcelad[oa] em (\d{1,2})/);
  if (inst) { out.installments = Math.min(24, Math.max(1, Number(inst[1] || inst[2]))); s = s.replace(inst[0], ' '); }
  // data
  const rel = [['anteontem', -2], ['ontem', -1], ['hoje', 0], ['amanha', 1], ['amanhã', 1]];
  for (const [w, n] of rel) { if (s.includes(` ${w} `)) { out.date = addDays(today, n); s = s.replace(` ${w} `, ' '); break; } }
  const dm = s.match(/\b(?:dia|em|no dia)\s+(\d{1,2})(?:[/.-](\d{1,2})(?:[/.-](\d{2,4}))?)?\b/) || s.match(/\b(\d{1,2})[/](\d{1,2})(?:[/](\d{2,4}))?\b/);
  if (dm) {
    const day = Number(dm[1]);
    const month = dm[2] ? Number(dm[2]) : Number(today.slice(5, 7));
    let year = dm[3] ? Number(dm[3]) : Number(today.slice(0, 4));
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) { out.date = `${year}-${pad2(month)}-${pad2(Math.min(day, daysIn(`${year}-${pad2(month)}`)))}`; s = s.replace(dm[0], ' '); }
  }
  // valor (o primeiro número com cara de dinheiro)
  const vm = s.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(\s*mil\b|\s*k\b)?/);
  if (vm) {
    let cents = parseMoneyBR(vm[1]);
    if (vm[2]) cents *= 1000;
    out.amount = Math.abs(cents) || 0;
    s = s.replace(vm[0], ' ');
  }
  // cartão ou conta citados
  const sn = normTxt(s);
  const card = d.cards.filter((c) => !c.archived).find((c) => sn.includes(normTxt(c.name)) || normTxt(c.name).split(' ').some((w) => w.length > 3 && sn.split(' ').includes(w)));
  const acc = d.accounts.filter((a) => !a.archived).find((a) => sn.includes(normTxt(a.name)));
  if (card && out.kind === 'out' && (/\b(cartao|cartão|credito|crédito)\b/.test(s) || !acc)) { out.card_id = card.id; s = s.replace(new RegExp(card.name.split(' ')[0], 'i'), ' '); }
  else if (acc) { out.account_id = acc.id; s = s.replace(new RegExp(acc.name.split(' ')[0], 'i'), ' '); }
  if (!out.card_id && !out.account_id) { const rr = matchRule(raw, out.kind, d); if (rr && ruleSourceOk(rr.source, d, out.kind)) { if (rr.source.startsWith('card:')) out.card_id = rr.source.slice(5); else out.account_id = rr.source.slice(4); } }
  if (!out.card_id && /\b(cartao|cartão|credito|crédito)\b/.test(s) && d.cards.length && out.kind === 'out') out.card_id = d.cards.filter((c) => !c.archived)[0].id;
  if (!out.card_id && !out.account_id && d.accounts.length) out.account_id = d.accounts.filter((a) => !a.archived)[0].id;
  // descrição: o que sobrou, sem palavras de ligação
  const desc = s.replace(/\b(gastei|paguei|comprei|recebi|ganhei|entrou|caiu|de|do|da|no|na|em|com|pelo|pela|reais|real|r\$|cartao|cartão|credito|crédito|debito|débito|pix|x)\b/g, ' ').replace(/\s+/g, ' ').trim();
  out.description = desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : '';
  out.category_id = suggestCategory(out.description || raw, out.kind, d);
  if (out.date > today && !out.card_id) out.paid = false;
  return out;
}

/* ---------- Extrato do banco: OFX e CSV ---------- */
function parseOFX(text) {
  const rows = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (b, t) => { const m = b.match(new RegExp(`<${t}>([^<\\r\\n]*)`, 'i')); return m ? m[1].trim() : ''; };
  blocks.forEach((b) => {
    const amount = parseMoneyBR(tag(b, 'TRNAMT').replace(',', '.'));
    const date = parseDateBR(tag(b, 'DTPOSTED'));
    const desc = tag(b, 'MEMO') || tag(b, 'NAME') || tag(b, 'PAYEE');
    if (date && Number.isFinite(amount) && amount !== 0) rows.push({ date, amount, description: desc.replace(/\s+/g, ' '), fitid: tag(b, 'FITID') });
  });
  return { rows, signed: true };
}

function splitCSVLine(line, sep) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === sep && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function parseCSVStatement(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], signed: true };
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : (lines[0].match(/\t/g) || []).length > 1 ? '\t' : ',';
  // acha a linha de cabeçalho (com "data" e "valor")
  let hi = lines.findIndex((l) => /data|date/i.test(l) && /valor|amount|quantia|montante/i.test(l));
  const head = hi >= 0 ? splitCSVLine(lines[hi], sep).map((h) => normTxt(h)) : [];
  const find = (...names) => head.findIndex((h) => names.some((n) => h === n || h.startsWith(n) || h.includes(n)));
  let iDate = find('data', 'date', 'dt');
  let iDesc = find('descricao', 'historico', 'title', 'titulo', 'estabelecimento', 'lancamento', 'description', 'memo', 'detalhe');
  let iVal = find('valor', 'amount', 'quantia', 'montante');
  let iCredit = find('credito', 'entrada');
  let iDebit = find('debito', 'saida');
  if (hi < 0) { hi = -1; iDate = 0; iDesc = 1; iVal = 2; }
  // Fatura do cartão (ex.: Nubank "date,title,amount"): valores positivos são gastos
  const isCardStyle = head.includes('title') || head.includes('category') && head.includes('amount');
  const rows = [];
  lines.slice(hi + 1).forEach((l) => {
    const c = splitCSVLine(l, sep);
    const date = parseDateBR(c[iDate]);
    if (!date) return;
    let amount;
    if (iVal >= 0 && c[iVal] !== undefined && c[iVal] !== '') amount = parseMoneyBR(c[iVal]);
    else if (iCredit >= 0 || iDebit >= 0) { const cr = parseMoneyBR(c[iCredit]); const db = parseMoneyBR(c[iDebit]); amount = (Number.isFinite(cr) ? Math.abs(cr) : 0) - (Number.isFinite(db) ? Math.abs(db) : 0); }
    if (!Number.isFinite(amount) || amount === 0) return;
    const description = (iDesc >= 0 ? c[iDesc] : c.filter((x, i) => i !== iDate && i !== iVal).join(' ')) || '';
    rows.push({ date, amount: isCardStyle ? -amount : amount, description: description.replace(/\s+/g, ' ').trim() });
  });
  return { rows, signed: true, cardStyle: isCardStyle };
}

function parseStatement(text, filename = '') {
  if (/<OFX>|<STMTTRN>/i.test(text) || /\.ofx$/i.test(filename)) return parseOFX(text);
  return parseCSVStatement(text);
}

// Prepara as linhas para importar: tipo, categoria sugerida e possíveis duplicadas
function prepareImport(rows, target, d) {
  const isCard = target.startsWith('card:');
  const id = target.slice(isCard ? 5 : 4);
  return rows.map((r, i) => {
    const kind = r.amount < 0 ? 'out' : 'in';
    const amount = Math.abs(r.amount);
    const dup = d.transactions.find((t) => (isCard ? t.card_id === id : t.account_id === id) && t.amount === amount && Math.abs(diffDays(t.date, r.date)) <= 2
      && (normTxt(t.description).slice(0, 8) === normTxt(r.description).slice(0, 8) || t.kind === kind));
    const payment = isCard && kind === 'in';
    return {
      key: `${i}-${r.date}-${r.amount}`, date: r.date, amount, kind: payment ? 'skip' : kind, description: r.description.slice(0, 60) || (kind === 'in' ? 'Entrada' : 'Saída'),
      category_id: suggestCategory(r.description, kind, d), dup: !!dup, on: !dup && !payment, payment,
    };
  });
}

/* ---------- Agenda (.ics) para Google Agenda, Outlook, Apple ---------- */
function buildICS(d, months = 12) {
  const today = todayISO();
  const until = addDays(today, months * 31);
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const ymd = (iso) => iso.replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ev = [];
  const add = (uidv, date, title, desc, rrule) => {
    ev.push(['BEGIN:VEVENT', `UID:${uidv}@leco`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${ymd(addDays(date, 1))}`,
      `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`, ...(rrule ? [`RRULE:${rrule}`] : []), 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT'].join('\r\n'));
  };
  d.transactions.filter((t) => !t.paid && t.date >= addDays(today, -30) && t.date <= until).forEach((t) => {
    add(`t-${t.id}`, t.date, `${t.kind === 'in' ? 'Receber' : 'Pagar'}: ${t.description} (${fmtBRL(t.amount)})`, 'Lançamento do Leco');
  });
  d.cards.filter((c) => !c.archived).forEach((c) => {
    cardInvoices(c, d.transactions, today).filter((i) => i.remaining > 0 && i.due >= today && i.due <= until)
      .forEach((i) => add(`f-${c.id}-${i.invoice}`, i.due, `Fatura ${c.name} (${fmtBRL(i.remaining)})`, `Fatura de ${invoiceLabel(i.invoice)}`));
  });
  d.recurrings.filter((r) => r.active).forEach((r) => {
    const freq = r.frequency === 'weekly' ? 'WEEKLY' : r.frequency === 'yearly' ? 'YEARLY' : 'MONTHLY';
    add(`r-${r.id}`, r.next_date, `${r.kind === 'in' ? 'Receber' : 'Pagar'}: ${r.description} (${fmtBRL(r.amount)})`, 'Recorrência do Leco', `FREQ=${freq}${r.end_date ? `;UNTIL=${ymd(r.end_date)}` : ''}`);
  });
  (d.debts || []).filter((x) => !x.closed && x.due_day).forEach((x) => {
    const k = monthKey(today);
    const first = dayIn(dayIn(k, x.due_day) >= today ? k : shiftMonth(k, 1), x.due_day);
    const left = x.installment_amount ? Math.ceil((x.total - x.paid) / x.installment_amount) : null;
    add(`d-${x.id}`, first, `${x.direction === 'owe' ? 'Pagar' : 'Receber'} dívida: ${x.name}${x.installment_amount ? ` (${fmtBRL(x.installment_amount)})` : ''}`, x.person ? `Com ${x.person}` : 'Dívida no Leco', `FREQ=MONTHLY${left ? `;COUNT=${left}` : ''}`);
  });
  d.goals.filter((g) => g.remind_day && g.monthly_amount > 0 && g.saved < g.target).forEach((g) => {
    const k = monthKey(today);
    add(`g-${g.id}`, dayIn(dayIn(k, g.remind_day) >= today ? k : shiftMonth(k, 1), g.remind_day), `Guardar para ${g.name} (${fmtBRL(g.monthly_amount)})`, 'Meta do Leco', 'FREQ=MONTHLY');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Leco//Controle financeiro//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Leco · contas a pagar', 'X-WR-TIMEZONE:America/Sao_Paulo', ...ev, 'END:VCALENDAR'].join('\r\n');
}

/* ---------- Restaurar cópia (backup JSON) ---------- */
// Recria tudo com IDs novos, mantendo as ligações (categoria, conta, cartão, recorrência…)
async function restoreBackup(json, mode, d) {
  const b = typeof json === 'string' ? JSON.parse(json) : json;
  if (!b || b.app !== 'Leco') throw new Error('Este arquivo não é uma cópia do Leco.');
  const db = d.backend.db;
  const map = {};
  const nid = (old) => { if (!old) return null; if (!map[old]) map[old] = uid(); return map[old]; };
  const strip = (r) => { const { user_id, created_at, ...rest } = r; return rest; };
  if (mode === 'replace') {
    const ids = (l) => (l || []).map((x) => x.id);
    await db.removeIn('transactions', ids(d.transactions));
    for (const t of ['plans', 'templates', 'debts', 'recurrings', 'goals', 'cards', 'accounts']) { if (d[t] && (d.v3 || !V3_TABLES.includes(t))) await db.removeIn(t, ids(d[t])); }
    const cats = d.categories.slice().sort((a, b) => (a.parent_id ? -1 : 0) - (b.parent_id ? -1 : 0));
    await db.removeIn('categories', ids(cats));
  }
  const chunk = async (table, rows) => { for (let i = 0; i < rows.length; i += 400) await db.insert(table, rows.slice(i, i + 400)); };
  const counts = {};
  const put = async (table, list, fix) => {
    const rows = (list || []).map((r) => fix({ ...strip(r), id: nid(r.id) }));
    if (rows.length) await chunk(table, rows);
    counts[table] = rows.length;
  };
  await put('accounts', b.contas, (r) => r);
  await put('cards', b.cartoes, (r) => ({ ...r, pay_account_id: r.pay_account_id ? nid(r.pay_account_id) : null }));
  const cats = (b.categorias || []).slice().sort((a, x) => (a.parent_id ? 1 : 0) - (x.parent_id ? 1 : 0));
  await put('categories', cats, (r) => ({ ...r, parent_id: r.parent_id ? nid(r.parent_id) : null }));
  await put('recurrings', b.recorrencias, (r) => ({ ...r, category_id: nid(r.category_id), account_id: nid(r.account_id), card_id: nid(r.card_id) }));
  await put('goals', b.metas, (r) => ({ ...r, account_id: r.account_id ? nid(r.account_id) : null }));
  if (d.v3) {
    await put('debts', b.dividas, (r) => ({ ...r, account_id: nid(r.account_id) }));
    await put('templates', b.modelos, (r) => ({ ...r, category_id: nid(r.category_id), account_id: nid(r.account_id), card_id: nid(r.card_id) }));
    await put('plans', b.planejamento, (r) => ({ ...r, category_id: nid(r.category_id) }));
  }
  await put('transactions', b.transacoes, (r) => ({
    ...r, category_id: nid(r.category_id), account_id: nid(r.account_id), to_account_id: nid(r.to_account_id), card_id: nid(r.card_id),
    recurring_id: r.recurring_id ? nid(r.recurring_id) : null, group_id: r.group_id ? nid(r.group_id) : null, split_id: r.split_id ? nid(r.split_id) : null,
    debt_id: r.debt_id ? nid(r.debt_id) : null, goal_id: r.goal_id ? nid(r.goal_id) : null, attachment: null,
  }));
  if (b.perfil && mode === 'replace') {
    const { id, name, created_at, onboarded, ...pp } = b.perfil;
    await d.saveProfile(pp);
  }
  return counts;
}

/* ---------- Projeção de saldo (próximos dias) ---------- */
function projectBalance(d, days = 90, today = todayISO()) {
  const end = addDays(today, days);
  const start = sum(cashAccounts(d.accounts).filter((a) => !a.archived), (a) => d.balances[a.id] || 0);
  const ben = new Set(d.accounts.filter(isBenefit).map((a) => a.id));
  const delta = {};
  const add = (date, v) => { const k = date < today ? today : date; if (k <= end) delta[k] = (delta[k] || 0) + v; };
  d.transactions.forEach((t) => {
    if (t.paid || t.card_id || ben.has(t.account_id)) return;
    if (t.kind === 'in') add(t.date, t.amount); else if (t.kind === 'out') add(t.date, -t.amount);
  });
  d.recurrings.filter((r) => r.active && !r.card_id && !ben.has(r.account_id)).forEach((r) => {
    let dt = r.next_date, g = 0;
    while (dt <= end && (!r.end_date || dt <= r.end_date) && g < 200) { add(dt, r.kind === 'in' ? r.amount : -r.amount); dt = nextDateOf(dt, r.frequency); g++; }
  });
  d.cards.filter((c) => !c.archived).forEach((c) => {
    cardInvoices(c, d.transactions, today).forEach((i) => { if (i.remaining > 0 && i.due <= end) add(i.due, -i.remaining); });
    // assinaturas no cartão ainda não lançadas entram nas faturas futuras
    d.recurrings.filter((r) => r.active && r.card_id === c.id).forEach((r) => {
      let dt = r.next_date, g = 0;
      while (dt <= end && (!r.end_date || dt <= r.end_date) && g < 200) { const inv = invoiceOf(c, dt); const due = invoiceDue(c, inv); if (due <= end) add(due, -r.amount); dt = nextDateOf(dt, r.frequency); g++; }
    });
  });
  (d.debts || []).filter((x) => !x.closed && x.due_day && x.installment_amount).forEach((x) => {
    let left = Math.max(0, x.total - x.paid);
    let k = monthKey(today);
    for (let i = 0; i < 6 && left > 0; i++, k = shiftMonth(k, 1)) {
      const dt = dayIn(k, x.due_day);
      if (dt < today) continue;
      const v = Math.min(left, x.installment_amount);
      add(dt, x.direction === 'owe' ? -v : v);
      left -= v;
    }
  });
  const points = [];
  let bal = start, min = { date: today, value: start };
  for (let i = 0; i <= days; i++) {
    const dt = addDays(today, i);
    bal += delta[dt] || 0;
    points.push({ date: dt, value: bal });
    if (bal < min.value) min = { date: dt, value: bal };
  }
  return { start, points, min, end: bal };
}

/* ---------- Assinaturas e gastos fixos ---------- */
function subscriptionsOf(d) {
  const perMonth = (r) => (r.frequency === 'weekly' ? Math.round((r.amount * 52) / 12) : r.frequency === 'yearly' ? Math.round(r.amount / 12) : r.amount);
  const list = d.recurrings.filter((r) => r.kind === 'out').map((r) => ({ r, monthly: perMonth(r), yearly: perMonth(r) * 12 }));
  return { list: list.sort((a, b) => b.monthly - a.monthly), monthly: sum(list.filter((x) => x.r.active), (x) => x.monthly), yearly: sum(list.filter((x) => x.r.active), (x) => x.yearly) };
}

/* ---------- Alertas inteligentes ---------- */
function smartInsights(d, today = todayISO()) {
  const out = [];
  const k = finMonthOf(today);
  const [from] = finRange(k);
  const passed = Math.max(1, diffDays(today, from) + 1);
  const len = diffDays(finRange(k)[1], from) + 1;
  const cur = periodSummary(d.transactions, from, today, d.categories);
  // categoria gastando bem acima da média dos 3 meses anteriores (no mesmo ritmo do mês)
  // média só dos meses anteriores que têm gastos registrados (precisa de pelo menos 2)
  const avg = {};
  const hist = [1, 2, 3].map((i) => periodSummary(d.transactions, ...finRange(shiftMonth(k, -i)), d.categories)).filter((s) => s.expense > 0);
  if (hist.length >= 2) hist.forEach((s) => s.byCatOut.forEach((c) => { avg[c.key] = (avg[c.key] || 0) + c.value / hist.length; }));
  cur.byCatOut.forEach((c) => {
    const a = avg[c.key];
    if (!a || a < 5000) return;
    const projected = (c.value / passed) * len;
    if (projected > a * 1.3 && c.value > a * 0.5) out.push({ id: `cat-${c.key}-${k}`, tone: 'gold', icon: 'trend', title: `${c.label} acima do normal`, body: `No ritmo atual, ${c.label.toLowerCase()} deve fechar o mês em ${fmtBRL(Math.round(projected))}, ${Math.round((projected / a - 1) * 100)}% acima da sua média (${fmtBRL(Math.round(a))}).` });
  });
  // possível cobrança duplicada
  const recent = d.transactions.filter((t) => t.kind === 'out' && t.date >= addDays(today, -15));
  const seen = {};
  recent.forEach((t) => {
    const key = `${t.date}|${t.amount}|${normTxt(t.description)}|${t.card_id || t.account_id}`;
    if (seen[key] && !t.group_id && !t.split_id) out.push({ id: `dup-${t.id}`, tone: 'bad', icon: 'copy', title: 'Possível cobrança duplicada', body: `${t.description}: ${fmtBRL(t.amount)} aparece duas vezes em ${fmtDate(t.date)}.`, txId: t.id });
    seen[key] = true;
  });
  // gasto que se repete todo mês e ainda não é recorrência
  const prevK = shiftMonth(k, -1), prev2 = shiftMonth(k, -2);
  const byDesc = {};
  d.transactions.filter((t) => t.kind === 'out' && !t.recurring_id && !t.group_id && t.description).forEach((t) => {
    const m = finMonthOf(t.date);
    if (m !== prevK && m !== prev2) return;
    const key = `${normTxt(t.description)}|${t.amount}`;
    (byDesc[key] = byDesc[key] || new Set()).add(m);
  });
  Object.entries(byDesc).forEach(([key, set]) => {
    if (set.size < 2) return;
    const [desc, amt] = key.split('|');
    if (d.recurrings.some((r) => normTxt(r.description) === desc)) return;
    out.push({ id: `rec-${key}`, tone: 'ok', icon: 'repeat', title: 'Parece um gasto fixo', body: `"${desc}" de ${fmtBRL(Number(amt))} apareceu nos últimos 2 meses. Cadastre como recorrente para ser lembrado.` });
  });
  // assinaturas ativas há mais de 6 meses
  d.recurrings.filter((r) => r.active && r.kind === 'out' && r.created_at && diffDays(today, r.created_at.slice(0, 10)) > 180)
    .slice(0, 3).forEach((r) => out.push({ id: `uso-${r.id}-${k}`, tone: 'ok', icon: 'help', title: `Ainda usa ${r.description}?`, body: `Assinatura ativa há mais de 6 meses: ${fmtBRL(r.amount)} por ${r.frequency === 'yearly' ? 'ano' : r.frequency === 'weekly' ? 'semana' : 'mês'}.`, recId: r.id }));
  return out.slice(0, 8);
}

/* ---------- Conquistas ---------- */
const ACHIEVEMENTS = [
  { id: 'first', icon: 'sparkle', title: 'Primeiro passo', desc: 'Registrou o primeiro lançamento.' },
  { id: 'ten', icon: 'list', title: 'Pegando o ritmo', desc: '10 lançamentos registrados.' },
  { id: 'hundred', icon: 'layers', title: 'Organizado de verdade', desc: '100 lançamentos registrados.' },
  { id: 'streak7', icon: 'bolt', title: '7 dias seguidos', desc: 'Registrou algo em 7 dias seguidos.' },
  { id: 'blue', icon: 'trend', title: 'Mês no azul', desc: 'Fechou um mês recebendo mais do que gastou.' },
  { id: 'saver', icon: 'piggy', title: 'Poupador', desc: 'Bateu a meta de poupança num mês.' },
  { id: 'budget', icon: 'target', title: 'Dentro do orçamento', desc: 'Fechou um mês sem estourar nenhum orçamento.' },
  { id: 'goal', icon: 'trophy', title: 'Meta batida', desc: 'Completou uma meta.' },
  { id: 'reserve', icon: 'shield', title: 'Reserva de 3 meses', desc: 'Guardou o equivalente a 3 meses de gastos.' },
  { id: 'nodebt', icon: 'scale', title: 'Dívida quitada', desc: 'Terminou de pagar uma dívida.' },
  { id: 'planner', icon: 'calendar', title: 'Planejador', desc: 'Fez o planejamento de um mês.' },
];
function achievementsOf(d, today = todayISO()) {
  const got = {};
  const user = d.transactions.filter((t) => !t.recurring_id && !t.is_adjustment);
  if (user.length >= 1) got.first = true;
  if (user.length >= 10) got.ten = true;
  if (user.length >= 100) got.hundred = true;
  const days = new Set(d.transactions.map((t) => (t.created_at || '').slice(0, 10)).filter(Boolean));
  for (let i = 0; i < 400 && !got.streak7; i++) {
    let ok = true;
    for (let j = 0; j < 7; j++) if (!days.has(addDays(today, -(i + j)))) { ok = false; break; }
    if (ok) got.streak7 = true;
    if (!days.has(addDays(today, -i)) && i > 60) break;
  }
  const k = finMonthOf(today);
  for (let i = 1; i <= 12; i++) {
    const m = shiftMonth(k, -i);
    const s = periodSummary(d.transactions, ...finRange(m), d.categories);
    if (s.income > 0 && s.net > 0) got.blue = true;
    if (s.income > 0 && s.rate >= d.profile.savings_goal) got.saver = true;
    const b = budgetsFor(d.categories, d.transactions, m, d.plans);
    if (b.length && s.expense > 0 && b.every((x) => x.pct < 100)) got.budget = true;
  }
  if (d.goals.some((g) => g.saved >= g.target)) got.goal = true;
  const res = sum(d.accounts.filter((a) => a.is_reserve), (a) => d.balances[a.id] || 0);
  const avg = avgMonthlyExpense(d);
  if (avg > 0 && res >= avg * 3) got.reserve = true;
  if ((d.debts || []).some((x) => x.paid >= x.total)) got.nodebt = true;
  if ((d.plans || []).length) got.planner = true;
  return got;
}
function avgMonthlyExpense(d, months = 3) {
  const k = finMonthOf(todayISO());
  let total = 0, n = 0;
  for (let i = 1; i <= months; i++) { const s = periodSummary(d.transactions, ...finRange(shiftMonth(k, -i)), d.categories); if (s.expense > 0) { total += s.expense; n++; } }
  return n ? Math.round(total / n) : 0;
}
