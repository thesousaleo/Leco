/* =====================================================================
   20-domain: regras financeiras (saldos, faturas, parcelas, recorrências,
   orçamentos, relatórios, alertas e exportação). Funções puras.
   Valores sempre em centavos.
   ===================================================================== */
const ACCOUNT_KINDS = {
  corrente: { label: 'Conta corrente', icon: 'bank' },
  poupanca: { label: 'Poupança', icon: 'piggy' },
  carteira: { label: 'Carteira', icon: 'wallet' },
  investimento: { label: 'Investimentos', icon: 'trend' },
  outro: { label: 'Outra', icon: 'tag' },
};
const FREQ = { weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' };
const INVOICE_STATUS = {
  aberta: { label: 'Aberta', cls: 'pill pill-neutral' },
  fechada: { label: 'Fechada', cls: 'badge-gold' },
  vencida: { label: 'Vencida', cls: 'pill pill-bad' },
  paga: { label: 'Paga', cls: 'pill pill-good' },
};

/* ---------- Cartão de crédito ---------- */
// Compras a partir do dia de fechamento entram na fatura seguinte. A fatura é identificada pelo mês em que fecha.
function invoiceOf(card, dateISO) {
  const k = monthKey(dateISO);
  const day = Number(dateISO.slice(8, 10));
  return day >= Math.min(card.closing_day, daysIn(k)) ? shiftMonth(k, 1) : k;
}
const invoiceClosing = (card, inv) => dayIn(inv, card.closing_day);
const invoiceDue = (card, inv) => dayIn(card.due_day > card.closing_day ? inv : shiftMonth(inv, 1), card.due_day);
const invoiceLabel = (inv) => `${monthName(inv)}/${inv.slice(0, 4)}`;

function cardInvoices(card, txs, today = todayISO()) {
  const map = {};
  txs.forEach((t) => {
    if (t.card_id !== card.id || !t.invoice) return;
    const o = map[t.invoice] || (map[t.invoice] = { invoice: t.invoice, total: 0, paid: 0, items: [], payments: [] });
    if (t.kind === 'out') { o.total += t.amount; o.items.push(t); } else if (t.kind === 'card_payment') { o.paid += t.amount; o.payments.push(t); }
  });
  const cur = invoiceOf(card, today);
  if (!map[cur]) map[cur] = { invoice: cur, total: 0, paid: 0, items: [], payments: [] };
  return Object.values(map).map((o) => {
    const closing = invoiceClosing(card, o.invoice);
    const due = invoiceDue(card, o.invoice);
    const remaining = o.total - o.paid;
    let status;
    if (o.total > 0 && remaining <= 0) status = 'paga';
    else if (today < closing) status = 'aberta';
    else if (remaining <= 0) status = 'paga';
    else if (today > due) status = 'vencida';
    else status = 'fechada';
    return { ...o, closing, due, remaining, status };
  }).sort((a, b) => (a.invoice < b.invoice ? 1 : -1));
}

function cardSummary(card, txs, today = todayISO()) {
  const purchases = sum(txs.filter((t) => t.card_id === card.id && t.kind === 'out'), (t) => t.amount);
  const payments = sum(txs.filter((t) => t.card_id === card.id && t.kind === 'card_payment'), (t) => t.amount);
  const used = Math.max(0, purchases - payments);
  const invoices = cardInvoices(card, txs, today);
  const currentKey = invoiceOf(card, today);
  const current = invoices.find((i) => i.invoice === currentKey);
  const toPay = invoices.filter((i) => i.status === 'fechada' || i.status === 'vencida').sort((a, b) => (a.invoice < b.invoice ? -1 : 1));
  return { used, available: card.limit_amount - used, invoices, current, toPay, nextToPay: toPay[0] || null };
}

/* ---------- Contas ---------- */
function accountBalances(accounts, txs, until = null) {
  const bal = {};
  accounts.forEach((a) => { bal[a.id] = a.initial_balance || 0; });
  txs.forEach((t) => {
    if (!t.paid || (until && t.date > until)) return;
    const add = (id, v) => { if (id && bal[id] != null) bal[id] += v; };
    if (t.kind === 'in') add(t.account_id, t.amount);
    else if (t.kind === 'out' && !t.card_id) add(t.account_id, -t.amount);
    else if (t.kind === 'transfer') { add(t.account_id, -t.amount); add(t.to_account_id, t.amount); }
    else if (t.kind === 'card_payment') add(t.account_id, -t.amount);
  });
  return bal;
}

/* ---------- Resumos ---------- */
// Ajustes de saldo mudam o saldo da conta, mas não contam como receita ou despesa nos relatórios
const countsAsIncome = (t) => t.kind === 'in' && t.paid && !t.is_adjustment;
const countsAsExpense = (t) => t.kind === 'out' && (t.paid || !!t.card_id) && !t.is_adjustment;

function periodSummary(txs, from, to, cats) {
  const inRange = txs.filter((t) => t.date >= from && t.date <= to);
  const inc = inRange.filter(countsAsIncome);
  const exp = inRange.filter(countsAsExpense);
  const group = (list) => {
    const o = {};
    list.forEach((t) => { const k = t.category_id || 'none'; o[k] = (o[k] || 0) + t.amount; });
    return Object.keys(o).map((k) => {
      const c = cats.find((x) => x.id === k);
      const parent = c && c.parent_id ? cats.find((x) => x.id === c.parent_id) : null;
      return { key: k, label: c ? (parent ? `${parent.name} › ${c.name}` : c.name) : 'Sem categoria', color: c ? c.color : '#9AA9A4', icon: c ? c.icon : 'tag', value: o[k] };
    }).sort((a, b) => b.value - a.value);
  };
  const income = sum(inc, (t) => t.amount);
  const expense = sum(exp, (t) => t.amount);
  return { income, expense, net: income - expense, rate: income ? ((income - expense) / income) * 100 : 0, byCatOut: group(exp), byCatIn: group(inc), incomeTx: inc, expenseTx: exp };
}

function monthSeries(txs, accounts, endMonth, n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const k = shiftMonth(endMonth, i - (n - 1));
    const [from, to] = finRange(k);
    const inRange = txs.filter((t) => t.date >= from && t.date <= to);
    const bal = accountBalances(accounts, txs, to);
    return {
      k, short: monthShort(k), full: monthLabel(k),
      in: sum(inRange.filter(countsAsIncome), (t) => t.amount),
      out: sum(inRange.filter(countsAsExpense), (t) => t.amount),
      bal: sum(Object.values(bal)),
    };
  });
}

// Orçamento do mês: o planejado do mês (Planejamento) ou o limite fixo da categoria.
// Gastos das subcategorias também contam no orçamento da categoria principal.
function budgetsFor(cats, txs, month, plans = []) {
  const [from, to] = finRange(month);
  const spent = {};
  txs.forEach((t) => {
    if (!countsAsExpense(t) || t.date < from || t.date > to || !t.category_id) return;
    spent[t.category_id] = (spent[t.category_id] || 0) + t.amount;
    const c = cats.find((x) => x.id === t.category_id);
    if (c && c.parent_id) spent[c.parent_id] = (spent[c.parent_id] || 0) + t.amount;
  });
  const planOf = (c) => { const p = plans.find((x) => x.month === month && x.category_id === c.id); return p ? p.amount : c.budget; };
  return cats.filter((c) => c.kind === 'out' && !c.archived && planOf(c) > 0)
    .map((c) => { const b = planOf(c); return { key: c.id, label: c.name, icon: c.icon, color: c.color, budget: b, spent: spent[c.id] || 0, pct: Math.round(((spent[c.id] || 0) / b) * 100) }; })
    .sort((a, b) => b.pct - a.pct);
}

/* ---------- Parcelas ---------- */
// Cartão: cada parcela cai numa fatura. Conta (boleto, carnê, Pix parcelado): parcelas mensais;
// as que já venceram seguem a situação escolhida e as futuras ficam "a pagar".
function buildInstallments(base, card, n, today = todayISO()) {
  const group = uid();
  const each = Math.floor(base.amount / n);
  const first = base.amount - each * (n - 1);
  return Array.from({ length: n }, (_, i) => {
    const date = addMonthsISO(base.date, i);
    return {
      ...base, amount: i === 0 ? first : each, date,
      description: n > 1 ? `${base.description} (${i + 1}/${n})` : base.description,
      installment: n > 1 ? i + 1 : null, installments: n > 1 ? n : null, group_id: n > 1 ? group : null,
      invoice: card ? shiftMonth(invoiceOf(card, base.date), i) : null,
      paid: card ? true : i === 0 ? base.paid : date <= today ? base.paid : false,
    };
  });
}

/* ---------- Recorrências ---------- */
const nextDateOf = (iso, freq) => (freq === 'weekly' ? addDays(iso, 7) : freq === 'yearly' ? addMonthsISO(iso, 12) : addMonthsISO(iso, 1));

// Gera os lançamentos até o fim do mês (ou 7 dias à frente). Contas a pagar ficam pendentes até você confirmar.
function planRecurrings(recurrings, cards, today = todayISO()) {
  const eom = dayIn(monthKey(today), 31);
  const ahead = addDays(today, 7);
  const horizon = eom > ahead ? eom : ahead;
  const rows = [], updates = [];
  recurrings.filter((r) => r.active).forEach((r) => {
    const card = r.card_id ? cards.find((c) => c.id === r.card_id) : null;
    let d = r.next_date, guard = 0;
    while (d <= horizon && (!r.end_date || d <= r.end_date) && guard < 120) {
      rows.push({
        kind: r.kind, amount: r.amount, description: r.description, date: d, category_id: r.category_id,
        account_id: card ? null : r.account_id, card_id: card ? card.id : null, invoice: card ? invoiceOf(card, d) : null,
        recurring_id: r.id, paid: !!card,
      });
      d = nextDateOf(d, r.frequency);
      guard += 1;
    }
    if (d !== r.next_date) updates.push({ id: r.id, patch: { next_date: d, active: !(r.end_date && d > r.end_date) } });
  });
  return { rows, updates };
}

/* ---------- Alertas ---------- */
function buildAlerts({ txs, cards, cats, goals, profile, month, plans = [], debts = [], today = todayISO() }) {
  const list = [];
  const p = profile || {};
  if (p.notify_bills !== false) {
    const limit = addDays(today, p.bill_days_before == null ? 2 : p.bill_days_before);
    txs.filter((t) => !t.paid && t.date <= limit).sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((t) => {
      const late = t.date < today;
      list.push({
        id: `t-${t.id}`, icon: t.kind === 'in' ? 'inArrow' : 'calendar', tone: late ? 'bad' : 'gold', txId: t.id,
        title: t.kind === 'in' ? `Receita prevista: ${t.description}` : late ? `Conta atrasada: ${t.description}` : `Conta a pagar: ${t.description}`,
        body: `${fmtBRL(t.amount)} · ${t.kind === 'in' ? 'esperada' : 'vence'} ${relDay(t.date, today)} (${fmtDate(t.date)}).`,
      });
    });
    cards.filter((c) => !c.archived).forEach((c) => {
      const s = cardSummary(c, txs, today);
      s.toPay.forEach((inv) => {
        const d = diffDays(inv.due, today);
        if (d <= 5) list.push({ id: `f-${c.id}-${inv.invoice}`, icon: 'card', tone: d < 0 ? 'bad' : 'gold', cardId: c.id, title: `Fatura ${c.name} ${d < 0 ? 'vencida' : 'para pagar'}`, body: `${fmtBRL(inv.remaining)} · vence ${relDay(inv.due, today)} (${fmtDate(inv.due)}).` });
      });
    });
  }
  if (p.notify_budget !== false) {
    budgetsFor(cats, txs, month, plans).filter((b) => b.pct >= 80).forEach((b) => list.push({
      id: `b-${b.key}`, icon: 'alert', tone: b.pct >= 100 ? 'bad' : 'gold',
      title: b.pct >= 100 ? `Orçamento de ${b.label} estourado` : `${b.label} em ${b.pct}% do orçamento`,
      body: `${fmtBRL(b.spent)} de ${fmtBRL(b.budget)} em ${monthLabel(month)}.`,
    }));
  }
  if (p.notify_goals !== false) {
    goals.filter((g) => g.saved / g.target >= 0.75 && g.saved < g.target).forEach((g) => list.push({
      id: `g-${g.id}`, icon: 'target', tone: 'gold', title: 'Meta quase lá', body: `${g.name} chegou a ${Math.round((g.saved / g.target) * 100)}% (${fmtBRL(g.saved)} de ${fmtBRL(g.target)}).`,
    }));
    // lembrete mensal de guardar dinheiro na meta
    goals.filter((g) => g.remind_day && g.monthly_amount > 0 && g.saved < g.target).forEach((g) => {
      const due = dayIn(monthKey(today), g.remind_day);
      const dd = diffDays(due, today);
      if (dd >= 0 && dd <= 2) list.push({ id: `gr-${g.id}-${monthKey(today)}`, icon: 'piggy', tone: 'ok', goalId: g.id, title: `Guardar para ${g.name}`, body: `Lembrete do mês: ${fmtBRL(g.monthly_amount)} ${relDay(due, today)}.` });
    });
  }
  if (p.notify_bills !== false) {
    // fechamento da fatura: avisa 2 dias antes
    cards.filter((c) => !c.archived).forEach((c) => {
      const inv = invoiceOf(c, today);
      const closing = invoiceClosing(c, inv);
      const dd = diffDays(closing, today);
      if (dd >= 0 && dd <= 2) list.push({ id: `fc-${c.id}-${inv}`, icon: 'card', tone: 'ok', cardId: c.id, title: `Fatura ${c.name} fecha ${relDay(closing, today)}`, body: `Compras a partir de ${fmtDate(closing)} vão para a fatura seguinte (vencimento ${fmtDate(invoiceDue(c, shiftMonth(inv, 1)))}).` });
    });
    // parcelas de dívidas
    debts.filter((x) => !x.closed && x.due_day && x.paid < x.total).forEach((x) => {
      const due = dayIn(monthKey(today), x.due_day);
      const dd = diffDays(due, today);
      const lim = p.bill_days_before == null ? 2 : p.bill_days_before;
      if (dd >= 0 && dd <= lim) list.push({ id: `d-${x.id}-${monthKey(today)}`, icon: 'scale', tone: 'gold', debtId: x.id, title: x.direction === 'owe' ? `Parcela da dívida: ${x.name}` : `Receber de ${x.person || x.name}`, body: `${x.installment_amount ? fmtBRL(x.installment_amount) : 'Valor a combinar'} · vence ${relDay(due, today)} (${fmtDate(due)}).` });
    });
  }
  return list;
}

/* ---------- Exportação (CSV para Excel em português) ---------- */
function toCSV(header, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${[header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')}`;
}
const centsCSV = (c) => (c / 100).toFixed(2).replace('.', ',');
const KIND_LABEL = { in: 'Receita', out: 'Despesa', transfer: 'Transferência', card_payment: 'Pagamento de fatura' };

function transactionsCSV(list, ctx) {
  const name = (arr, id) => { const x = arr.find((a) => a.id === id); return x ? x.name : ''; };
  const rows = list.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map((t) => [
    fmtDate(t.date), KIND_LABEL[t.kind], t.description, name(ctx.categories, t.category_id),
    name(ctx.accounts, t.account_id), name(ctx.accounts, t.to_account_id), name(ctx.cards, t.card_id),
    t.invoice ? invoiceLabel(t.invoice) : '', t.installments ? `${t.installment}/${t.installments}` : '',
    t.paid ? 'Sim' : 'Não', (t.kind === 'in' ? '' : '-') + centsCSV(t.amount), t.notes || '',
  ]);
  return toCSV(['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Conta de destino', 'Cartão', 'Fatura', 'Parcela', 'Pago', 'Valor (R$)', 'Observações'], rows);
}
