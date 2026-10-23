/* =====================================================================
   25-pdf: relatórios em PDF (resumo do período e extrato de transações).
   Gerado no próprio aparelho com pdf-lib (fontes padrão Helvetica).
   ===================================================================== */
const PDF_W = 595.28, PDF_H = 841.89, PDF_M = 40;
const PDF_C = {
  ink: [0.043, 0.184, 0.161], soft: [0.29, 0.396, 0.376], line: [0.894, 0.937, 0.918],
  noite: [0.043, 0.184, 0.161], leco: [0.059, 0.361, 0.302], vivo: [0.078, 0.502, 0.42], ouro: [0.91, 0.639, 0.09],
  menta: [0.894, 0.937, 0.918], inc: [0.059, 0.431, 0.357], out: [0.761, 0.306, 0.173], white: [1, 1, 1], zebra: [0.968, 0.98, 0.975],
};
// Caracteres fora do WinAnsi (setas, emojis, sinal de menos tipográfico) não existem na fonte padrão
const PDF_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const pdfText = (s) => String(s == null ? '' : s).replace(/−/g, '-').replace(/→/g, '->').replace(/ | /g, ' ')
  .split('').filter((ch) => ch.charCodeAt(0) < 256 || PDF_EXTRA.includes(ch)).join('');
const pdfMoney = (cents) => pdfText(fmtBRL(cents));

async function buildPDF({ title, subtitle, author, blocks }) {
  const { PDFDocument, StandardFonts, rgb } = window.LecoPDF;
  const doc = await PDFDocument.create();
  doc.setTitle(pdfText(title)); doc.setAuthor(pdfText(author || 'Leco')); doc.setCreator('Leco'); doc.setProducer('Leco');
  const F = await doc.embedFont(StandardFonts.Helvetica);
  const B = await doc.embedFont(StandardFonts.HelveticaBold);
  const col = (c) => rgb(c[0], c[1], c[2]);
  let page, y;
  const W = PDF_W - PDF_M * 2;
  const width = (t, size, font = F) => font.widthOfTextAtSize(pdfText(t), size);
  const fit = (t, size, max, font = F) => {
    let s = pdfText(t);
    if (width(s, size, font) <= max) return s;
    while (s.length > 1 && width(`${s}…`, size, font) > max) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  };
  const text = (t, x, yy, { size = 10, font = F, color = PDF_C.ink, align = 'left', max } = {}) => {
    const s = max ? fit(t, size, max, font) : pdfText(t);
    const w = width(s, size, font);
    const xx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    page.drawText(s, { x: xx, y: yy, size, font, color: col(color) });
  };
  const newPage = (first) => {
    page = doc.addPage([PDF_W, PDF_H]);
    if (first) {
      page.drawRectangle({ x: 0, y: PDF_H - 118, width: PDF_W, height: 118, color: col(PDF_C.noite) });
      page.drawRectangle({ x: 0, y: PDF_H - 122, width: PDF_W, height: 4, color: col(PDF_C.ouro) });
      // Logo: "L" com a moeda
      const lx = PDF_M, ly = PDF_H - 70;
      page.drawRectangle({ x: lx, y: ly, width: 8, height: 30, color: col(PDF_C.white) });
      page.drawRectangle({ x: lx, y: ly, width: 24, height: 8, color: col(PDF_C.white) });
      page.drawCircle({ x: lx + 19, y: ly + 16, size: 6, color: col(PDF_C.ouro) });
      text('Lec', lx + 34, ly + 8, { size: 24, font: B, color: PDF_C.white });
      text('o', lx + 34 + width('Lec', 24, B), ly + 8, { size: 24, font: B, color: PDF_C.ouro });
      text('CONTROLE FINANCEIRO', lx + 35, ly - 6, { size: 7, font: B, color: [0.75, 0.85, 0.82] });
      text(title, PDF_W - PDF_M, PDF_H - 52, { size: 16, font: B, color: PDF_C.white, align: 'right' });
      if (subtitle) text(subtitle, PDF_W - PDF_M, PDF_H - 70, { size: 10, color: [0.82, 0.9, 0.87], align: 'right' });
      text(`Gerado em ${fmtDate(todayISO())}${author ? ` · ${author}` : ''}`, PDF_W - PDF_M, PDF_H - 86, { size: 8.5, color: [0.7, 0.8, 0.77], align: 'right', max: 300 });
      y = PDF_H - 150;
    } else {
      text('Leco', PDF_M, PDF_H - 30, { size: 10, font: B, color: PDF_C.leco });
      text(title, PDF_W - PDF_M, PDF_H - 30, { size: 9, color: PDF_C.soft, align: 'right' });
      page.drawLine({ start: { x: PDF_M, y: PDF_H - 38 }, end: { x: PDF_W - PDF_M, y: PDF_H - 38 }, thickness: 0.6, color: col(PDF_C.line) });
      y = PDF_H - 60;
    }
  };
  const need = (h) => { if (y - h < 50) newPage(false); };

  newPage(true);
  for (const bl of blocks) {
    if (bl.type === 'kpis') {
      need(70);
      const n = bl.items.length, gap = 10, w = (W - gap * (n - 1)) / n;
      bl.items.forEach((k, i) => {
        const x = PDF_M + i * (w + gap);
        page.drawRectangle({ x, y: y - 56, width: w, height: 56, color: col(PDF_C.menta), borderColor: col(PDF_C.line), borderWidth: 0.6 });
        text(k.label.toUpperCase(), x + 10, y - 18, { size: 7.5, font: B, color: PDF_C.soft, max: w - 20 });
        text(k.value, x + 10, y - 40, { size: n > 3 ? 13 : 15, font: B, color: k.color || PDF_C.ink, max: w - 20 });
      });
      y -= 76;
    } else if (bl.type === 'heading') {
      need(50);
      text(bl.text, PDF_M, y - 4, { size: 12.5, font: B, color: PDF_C.ink });
      if (bl.sub) text(bl.sub, PDF_W - PDF_M, y - 4, { size: 8.5, color: PDF_C.soft, align: 'right' });
      y -= 16;
    } else if (bl.type === 'note') {
      need(20);
      text(bl.text, PDF_M, y - 10, { size: 9, color: PDF_C.soft, max: W });
      y -= 22;
    } else if (bl.type === 'table') {
      const cols = bl.columns;
      const total = cols.reduce((a, c) => a + c.w, 0);
      const ws = cols.map((c) => (c.w / total) * W);
      const rowH = 18;
      const head = () => {
        page.drawRectangle({ x: PDF_M, y: y - rowH, width: W, height: rowH, color: col(PDF_C.leco) });
        let x = PDF_M;
        cols.forEach((c, i) => {
          text(c.label, c.align === 'right' ? x + ws[i] - 6 : x + 6, y - 12.5, { size: 8, font: B, color: PDF_C.white, align: c.align === 'right' ? 'right' : 'left', max: ws[i] - 12 });
          x += ws[i];
        });
        y -= rowH;
      };
      need(rowH * 3);
      head();
      if (!bl.rows.length) { text(bl.empty || 'Nada no período.', PDF_M + 6, y - 13, { size: 9, color: PDF_C.soft }); y -= rowH; }
      bl.rows.forEach((r, ri) => {
        if (y - rowH < 50) { newPage(false); head(); }
        const strong = r.strong;
        if (strong) page.drawRectangle({ x: PDF_M, y: y - rowH, width: W, height: rowH, color: col(PDF_C.menta) });
        else if (ri % 2 === 1) page.drawRectangle({ x: PDF_M, y: y - rowH, width: W, height: rowH, color: col(PDF_C.zebra) });
        let x = PDF_M;
        cols.forEach((c, i) => {
          const cell = r.cells[i];
          const v = cell && typeof cell === 'object' ? cell : { v: cell };
          text(v.v == null ? '' : v.v, c.align === 'right' ? x + ws[i] - 6 : x + 6, y - 12.5, { size: 8.5, font: strong || v.bold ? B : F, color: v.color || PDF_C.ink, align: c.align === 'right' ? 'right' : 'left', max: ws[i] - 12 });
          x += ws[i];
        });
        y -= rowH;
      });
      page.drawLine({ start: { x: PDF_M, y }, end: { x: PDF_W - PDF_M, y }, thickness: 0.6, color: col(PDF_C.line) });
      y -= 22;
    }
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    page = p;
    text(`Leco · controle financeiro pessoal`, PDF_M, 26, { size: 8, color: PDF_C.soft });
    text(`Página ${i + 1} de ${pages.length}`, PDF_W - PDF_M, 26, { size: 8, color: PDF_C.soft, align: 'right' });
  });
  return doc.save();
}

const PDF_KIND = { in: 'Receita', out: 'Despesa', transfer: 'Transferência', card_payment: 'Pag. fatura' };

function txPdfRows(list, d) {
  const name = (arr, id) => { const x = arr.find((a) => a.id === id); return x ? x.name : ''; };
  return list.map((t) => {
    const where = t.kind === 'transfer' ? `${name(d.accounts, t.account_id)} -> ${name(d.accounts, t.to_account_id)}`
      : t.card_id && t.kind === 'out' ? `${name(d.cards, t.card_id)}${t.invoice ? ` (fat. ${monthShort(t.invoice).toLowerCase()})` : ''}` : name(d.accounts, t.account_id);
    const sign = t.kind === 'in' ? '+' : t.kind === 'transfer' ? '' : '-';
    return {
      cells: [
        fmtDate(t.date), t.description || PDF_KIND[t.kind], t.kind === 'transfer' || t.kind === 'card_payment' ? PDF_KIND[t.kind] : name(d.categories, t.category_id) || 'Sem categoria',
        where, t.paid ? 'Pago' : t.kind === 'in' ? 'A receber' : 'A pagar',
        { v: `${sign}${pdfMoney(t.amount)}`, bold: true, color: t.kind === 'in' ? PDF_C.inc : t.kind === 'out' ? PDF_C.out : PDF_C.ink },
      ],
    };
  });
}
const TX_PDF_COLS = [{ label: 'Data', w: 62 }, { label: 'Descrição', w: 150 }, { label: 'Categoria', w: 92 }, { label: 'Conta / cartão', w: 100 }, { label: 'Situação', w: 58 }, { label: 'Valor', w: 80, align: 'right' }];

async function transactionsPDF(list, d, label) {
  const inc = sum(list.filter(countsAsIncome), (t) => t.amount);
  const exp = sum(list.filter(countsAsExpense), (t) => t.amount);
  const sorted = list.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return buildPDF({
    title: 'Extrato de transações', subtitle: label, author: d.name || d.session.user.email,
    blocks: [
      { type: 'kpis', items: [{ label: 'Lançamentos', value: String(list.length) }, { label: 'Entradas', value: pdfMoney(inc), color: PDF_C.inc }, { label: 'Saídas', value: pdfMoney(exp), color: PDF_C.out }, { label: 'Resultado', value: pdfMoney(inc - exp), color: inc - exp < 0 ? PDF_C.out : PDF_C.ink }] },
      { type: 'table', columns: TX_PDF_COLS, rows: txPdfRows(sorted, d), empty: 'Nenhuma transação com esses filtros.' },
    ],
  });
}

async function summaryPDF({ d, from, to, sm, months, byAccount, budgets }) {
  const pctOf = (v, t) => `${fmtPctAbs(t ? (v / t) * 100 : 0)}`;
  const catRows = (items, total) => items.map((c) => ({ cells: [c.label, pdfMoney(c.value), pctOf(c.value, total)] }));
  const top = sm.expenseTx.slice().sort((a, b) => b.amount - a.amount).slice(0, 10);
  const blocks = [
    { type: 'kpis', items: [
      { label: 'Receitas', value: pdfMoney(sm.income), color: PDF_C.inc }, { label: 'Despesas', value: pdfMoney(sm.expense), color: PDF_C.out },
      { label: 'Resultado', value: pdfMoney(sm.net), color: sm.net < 0 ? PDF_C.out : PDF_C.ink }, { label: 'Taxa de poupança', value: `${fmtPctAbs(sm.rate)}` },
    ] },
    { type: 'heading', text: 'Despesas por categoria', sub: `Total ${pdfMoney(sm.expense)}` },
    { type: 'table', columns: [{ label: 'Categoria', w: 300 }, { label: 'Valor', w: 120, align: 'right' }, { label: 'Participação', w: 95, align: 'right' }], rows: [...catRows(sm.byCatOut, sm.expense), ...(sm.byCatOut.length ? [{ strong: true, cells: ['Total', pdfMoney(sm.expense), '100%'] }] : [])], empty: 'Nenhuma despesa no período.' },
    { type: 'heading', text: 'Receitas por categoria', sub: `Total ${pdfMoney(sm.income)}` },
    { type: 'table', columns: [{ label: 'Categoria', w: 300 }, { label: 'Valor', w: 120, align: 'right' }, { label: 'Participação', w: 95, align: 'right' }], rows: [...catRows(sm.byCatIn, sm.income), ...(sm.byCatIn.length ? [{ strong: true, cells: ['Total', pdfMoney(sm.income), '100%'] }] : [])], empty: 'Nenhuma receita no período.' },
  ];
  if (months.length > 1) {
    blocks.push({ type: 'heading', text: 'Mês a mês' });
    blocks.push({ type: 'table', columns: [{ label: 'Mês', w: 180 }, { label: 'Receitas', w: 110, align: 'right' }, { label: 'Despesas', w: 110, align: 'right' }, { label: 'Resultado', w: 110, align: 'right' }],
      rows: months.map((x) => ({ cells: [x.full, { v: pdfMoney(x.in), color: PDF_C.inc }, { v: pdfMoney(x.out), color: PDF_C.out }, { v: pdfMoney(x.in - x.out), bold: true, color: x.in - x.out < 0 ? PDF_C.out : PDF_C.ink }] })) });
  }
  blocks.push({ type: 'heading', text: 'Por conta e cartão' });
  blocks.push({ type: 'table', columns: [{ label: 'Conta / cartão', w: 280 }, { label: 'Entradas', w: 115, align: 'right' }, { label: 'Saídas', w: 115, align: 'right' }],
    rows: byAccount.map((r) => ({ cells: [r.name, { v: pdfMoney(r.in), color: PDF_C.inc }, { v: pdfMoney(r.out), color: PDF_C.out }] })), empty: 'Sem movimentação no período.' });
  if (budgets && budgets.length) {
    blocks.push({ type: 'heading', text: `Orçamentos de ${monthLabel(monthKey(to)).toLowerCase()}` });
    blocks.push({ type: 'table', columns: [{ label: 'Categoria', w: 200 }, { label: 'Gasto', w: 105, align: 'right' }, { label: 'Orçamento', w: 105, align: 'right' }, { label: 'Uso', w: 70, align: 'right' }],
      rows: budgets.map((b) => ({ cells: [b.label, pdfMoney(b.spent), pdfMoney(b.budget), { v: `${b.pct}%`, bold: true, color: b.pct >= 100 ? PDF_C.out : b.pct >= 80 ? [0.6, 0.4, 0.02] : PDF_C.inc }] })) });
  }
  blocks.push({ type: 'heading', text: 'Maiores despesas', sub: 'Top 10 do período' });
  blocks.push({ type: 'table', columns: TX_PDF_COLS, rows: txPdfRows(top, d), empty: 'Nenhuma despesa no período.' });
  return buildPDF({ title: 'Relatório financeiro', subtitle: `${fmtDate(from)} a ${fmtDate(to)}`, author: d.name || d.session.user.email, blocks });
}
