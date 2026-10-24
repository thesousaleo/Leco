/* =====================================================================
   55-calendar: calendário financeiro. Tudo o que tem data aparece aqui:
   contas a pagar e a receber, pagamentos feitos, compras no cartão,
   vencimento e fechamento de faturas, previsões das recorrências e prazos das metas.
   ===================================================================== */
const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WEEKDAYS_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const weekdayOf = (iso) => new Date(`${iso}T12:00:00`).getDay();
const dayTitle = (iso) => `${WEEKDAYS_LONG[weekdayOf(iso)].replace(/^./, (c) => c.toUpperCase())}, ${Number(iso.slice(8, 10))} de ${monthName(iso.slice(0, 7)).toLowerCase()}`;

const CAL_FILTERS = [
  { value: 'all', label: 'Tudo' },
  { value: 'pay', label: 'A pagar' },
  { value: 'receive', label: 'A receber' },
  { value: 'invoice', label: 'Faturas' },
  { value: 'done', label: 'Pagos' },
];

// Monta todos os eventos de um intervalo de datas
function calendarEvents(d, from, to, today = todayISO()) {
  const ev = [];
  const name = (arr, id) => (arr.find((x) => x.id === id) || {}).name || '';
  d.transactions.forEach((t) => {
    if (t.date < from || t.date > to) return;
    const meta = txMeta(t, d);
    let group;
    if (!t.paid) group = t.kind === 'in' ? 'receive' : 'pay';
    else group = 'done';
    ev.push({
      id: `t-${t.id}`, date: t.date, group, tx: t, title: meta.title, sub: meta.sub, icon: meta.icon, color: meta.color,
      amount: t.amount, sign: t.kind === 'in' ? '+' : t.kind === 'transfer' ? '' : '−',
      tone: t.kind === 'in' ? 'text-in' : t.kind === 'transfer' ? 'text-ink' : 'text-out',
      late: !t.paid && t.date < today, card: !!t.card_id && t.kind === 'out',
    });
  });
  d.cards.filter((c) => !c.archived).forEach((c) => {
    cardInvoices(c, d.transactions, today).forEach((inv) => {
      if (inv.total <= 0) return;
      if (inv.due >= from && inv.due <= to) {
        const open = inv.remaining > 0;
        ev.push({
          id: `f-${c.id}-${inv.invoice}`, date: inv.due, group: open ? 'invoice' : 'done', invoice: inv, cardObj: c,
          title: `Fatura ${c.name}`, sub: `${invoiceLabel(inv.invoice)} · ${INVOICE_STATUS[inv.status].label.toLowerCase()}`, icon: 'card', color: c.color,
          amount: open ? inv.remaining : inv.total, sign: '−', tone: open ? 'text-out' : 'text-ink', late: open && inv.due < today,
        });
      }
      const closing = invoiceClosing(c, inv.invoice);
      if (closing >= from && closing <= to) {
        ev.push({ id: `c-${c.id}-${inv.invoice}`, date: closing, group: 'info', cardObj: c, invoice: inv, title: `Fecha a fatura ${c.name}`, sub: `Compras a partir de hoje vão para a próxima fatura`, icon: 'card', color: c.color, amount: inv.total, sign: '', tone: 'text-ink/70' });
      }
    });
  });
  // Previsões das recorrências que ainda não foram lançadas
  d.recurrings.filter((r) => r.active).forEach((r) => {
    let dt = r.next_date, guard = 0;
    while (dt <= to && (!r.end_date || dt <= r.end_date) && guard < 400) {
      if (dt >= from) {
        ev.push({
          id: `r-${r.id}-${dt}`, date: dt, group: r.kind === 'in' ? 'receive' : 'pay', forecast: true, rec: r,
          title: r.description, sub: `Previsto · ${FREQ[r.frequency] ? FREQ[r.frequency].toLowerCase() : 'recorrente'} · ${r.card_id ? name(d.cards, r.card_id) : name(d.accounts, r.account_id)}`,
          icon: 'repeat', color: (d.categories.find((c) => c.id === r.category_id) || {}).color || '#8C7AB8',
          amount: r.amount, sign: r.kind === 'in' ? '+' : '−', tone: r.kind === 'in' ? 'text-in' : 'text-out',
        });
      }
      dt = nextDateOf(dt, r.frequency);
      guard += 1;
    }
  });
  // Parcelas de dívidas (todo mês no dia de vencimento, até quitar)
  (d.debts || []).filter((x) => !x.closed && x.due_day && x.paid < x.total).forEach((x) => {
    let left = x.total - x.paid;
    let k = monthKey(today);
    for (let i = 0; i < 24 && left > 0; i++, k = shiftMonth(k, 1)) {
      const dt = dayIn(k, x.due_day);
      if (dt < today && k === monthKey(today)) continue;
      const v = x.installment_amount ? Math.min(left, x.installment_amount) : left;
      if (dt >= from && dt <= to) ev.push({ id: `d-${x.id}-${dt}`, date: dt, group: x.direction === 'owe' ? 'pay' : 'receive', forecast: true, debt: x, title: x.direction === 'owe' ? `Parcela: ${x.name}` : `Receber: ${x.name}`, sub: `Dívida${x.person ? ` · ${x.person}` : ''}`, icon: 'scale', color: x.direction === 'owe' ? '#D9644A' : '#14806B', amount: v, sign: x.direction === 'owe' ? '−' : '+', tone: x.direction === 'owe' ? 'text-out' : 'text-in' });
      left -= v;
      if (dt > to) break;
    }
  });
  // Lembrete mensal de guardar na meta
  d.goals.filter((g) => g.remind_day && g.monthly_amount > 0 && g.saved < g.target).forEach((g) => {
    for (let k = monthKey(from); k <= monthKey(to); k = shiftMonth(k, 1)) {
      const dt = dayIn(k, g.remind_day);
      if (dt >= from && dt <= to && dt >= today) ev.push({ id: `gr-${g.id}-${dt}`, date: dt, group: 'info', goal: g, title: `Guardar para ${g.name}`, sub: 'Meta automática', icon: 'piggy', color: '#E8A317', amount: g.monthly_amount, sign: '', tone: 'text-ink/70' });
    }
  });
  d.goals.forEach((g) => {
    if (g.due && g.due >= from && g.due <= to) {
      ev.push({ id: `g-${g.id}`, date: g.due, group: 'info', goal: g, title: `Prazo da meta: ${g.name}`, sub: `${fmtBRL(g.saved)} de ${fmtBRL(g.target)}`, icon: 'target', color: '#E8A317', amount: g.target, sign: '', tone: 'text-ink/70' });
    }
  });
  const order = { pay: 0, invoice: 1, receive: 2, info: 3, done: 4 };
  return ev.sort((a, b) => (a.date === b.date ? order[a.group] - order[b.group] : a.date < b.date ? -1 : 1));
}

const passFilter = (e, f) => f === 'all' || (f === 'pay' ? e.group === 'pay' || e.group === 'invoice' : f === 'invoice' ? !!e.cardObj : f === 'done' ? e.group === 'done' : e.group === f);

function CalendarEvent({ e }) {
  const d = useApp();
  const m = useMoneyText();
  const open = () => {
    if (e.tx) d.openModal({ kind: 'tx', initial: e.tx });
    else if (e.rec) d.openModal({ kind: 'recurring', initial: e.rec });
    else if (e.debt) d.openModal({ kind: 'debtPay', debt: e.debt });
    else if (e.goal) d.openModal(e.id.startsWith('gr-') && d.v3 ? { kind: 'goalSave', goal: e.goal } : { kind: 'goal', initial: e.goal });
    else if (e.cardObj) d.openModal({ kind: 'invoice', card: e.cardObj, invoice: e.invoice.invoice });
  };
  const action = e.tx && !e.tx.paid ? { label: e.tx.kind === 'in' ? 'Recebi' : 'Paguei', fn: () => d.confirmTx(e.tx) }
    : e.group === 'invoice' ? { label: 'Pagar', fn: () => d.openModal({ kind: 'invoice', card: e.cardObj, invoice: e.invoice.invoice }) } : null;
  return (
    <li className={`flex items-center gap-3 rounded-2xl px-1.5 py-2.5 ${e.tx && d.freshIds.includes(e.tx.id) ? 'flash' : ''}`}>
      <button type="button" onClick={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={e.forecast ? 'rounded-2xl border border-dashed border-ink/25 p-[1px]' : ''}><ColorIcon icon={e.icon} color={e.color} size={38} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={`truncate text-[14px] font-semibold ${e.group === 'done' ? 'text-ink/75' : ''}`}>{e.title}</span>
            {e.late && <span className="pill pill-bad shrink-0 !px-1.5 !py-0 !text-[10px]">atrasado</span>}
            {e.group === 'done' && <Icon name="check" size={14} className="shrink-0 text-in" />}
          </span>
          <span className="block truncate text-xs text-ink/65">{e.sub}</span>
        </span>
      </button>
      {action && <button type="button" className="btn btn-ghost shrink-0 !px-3 !py-1.5 text-xs" onClick={action.fn}>{action.label}</button>}
      {e.group !== 'info' && <span className={`shrink-0 text-[13.5px] font-extrabold tabular-nums ${e.tone}`}>{e.sign}{m(e.amount)}</span>}
    </li>
  );
}

function CalendarPage() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const today = todayISO();
  const [month, setMonth] = useState(monthKey(today));
  const [sel, setSel] = useState(today);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('mes');
  const [dir, setDir] = useState(0);
  const first = `${month}-01`;
  const last = dayIn(month, 31);
  // grade de 6 semanas começando no domingo
  const gridStart = addDays(first, -((weekdayOf(first) - FIN.weekStart + 7) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weeks = cells[35] > last ? 5 : 6;
  const events = useMemo(() => calendarEvents(d, cells[0], cells[weeks * 7 - 1], today), [d.transactions, d.cards, d.recurrings, d.goals, d.categories, d.accounts, d.debts, month, FIN.weekStart]);
  const shown = events.filter((e) => passFilter(e, filter));
  const byDay = useMemo(() => { const o = {}; shown.forEach((e) => { (o[e.date] = o[e.date] || []).push(e); }); return o; }, [shown]);
  const monthEv = events.filter((e) => e.date >= first && e.date <= last);
  const totals = {
    pay: sum(monthEv.filter((e) => e.group === 'pay' || e.group === 'invoice'), (e) => e.amount),
    receive: sum(monthEv.filter((e) => e.group === 'receive'), (e) => e.amount),
    late: monthEv.filter((e) => e.late).length,
  };
  const go = (delta) => {
    const k = shiftMonth(month, delta);
    setDir(delta);
    setMonth(k);
    setSel(k === monthKey(today) ? today : `${k}-01`);
  };
  const goToday = () => { setDir(monthKey(today) < month ? -1 : 1); setMonth(monthKey(today)); setSel(today); };
  // deslizar para trocar de mês
  const swipe = useRef(null);
  const onDown = (e) => { swipe.current = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    if (!swipe.current) return;
    const dx = e.clientX - swipe.current.x, dy = e.clientY - swipe.current.y;
    swipe.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };
  const selEvents = byDay[sel] || [];
  const agenda = shown.filter((e) => e.date >= first && e.date <= last);
  const agendaDays = [];
  agenda.forEach((e) => { const g = agendaDays[agendaDays.length - 1]; if (g && g.date === e.date) g.items.push(e); else agendaDays.push({ date: e.date, items: [e] }); });
  const addOn = (date) => d.openModal({ kind: 'tx', presetDate: date, defaultKind: 'out' });
  // Exporta para Google Agenda / Outlook / Apple: abra o arquivo .ics no celular ou importe em calendar.google.com
  const exportIcs = () => d.exportFile('leco-agenda.ics', buildICS(d), 'text/calendar');

  const dots = (list) => {
    const has = (g) => list.some((e) => e.group === g);
    const out = [];
    if (list.some((e) => e.late)) out.push('bg-[#C24E2C]');
    else if (has('pay')) out.push('bg-out');
    if (has('invoice')) out.push('bg-ouro');
    if (has('receive')) out.push('bg-in');
    if (has('done') && out.length < 3) out.push('bg-ink/30');
    if (has('info') && out.length < 3) out.push('bg-[#5E8CA6]');
    return out.slice(0, 3);
  };

  const grid = (
    <div onPointerDown={onDown} onPointerUp={onUp} className="touch-pan-y select-none">
      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-bold uppercase text-ink/55">{[...WEEKDAYS_SHORT.slice(FIN.weekStart), ...WEEKDAYS_SHORT.slice(0, FIN.weekStart)].map((w, i) => <span key={i}>{w}</span>)}</div>
      <div key={month} className={`grid grid-cols-7 gap-1 ${dir > 0 ? 'cal-next' : dir < 0 ? 'cal-prev' : ''}`}>
        {cells.slice(0, weeks * 7).map((iso) => {
          const inMonth = iso.slice(0, 7) === month;
          const list = byDay[iso] || [];
          const isSel = iso === sel, isToday = iso === today;
          const due = sum(list.filter((e) => e.group === 'pay' || e.group === 'invoice'), (e) => e.amount);
          return (
            <button key={iso} type="button" onClick={() => { setSel(iso); if (!inMonth) go(iso < first ? -1 : 1); }} aria-pressed={isSel}
              aria-label={`${dayTitle(iso)}${list.length ? `, ${plural(list.length, 'item', 'itens')}` : ''}`}
              className={`relative flex flex-col items-center rounded-2xl ${narrow ? 'h-[52px] pt-1.5' : 'h-[92px] items-stretch px-2 pt-2'} transition-colors ${isSel ? 'bg-gradient-to-br from-vivo to-leco text-white shadow-[0_8px_18px_-10px_rgba(20,128,107,.9)]' : inMonth ? 'hover:bg-ink/[0.05]' : 'opacity-35'}`}>
              <span className={`grid size-7 place-items-center rounded-full text-[13px] font-bold tabular-nums ${!narrow ? 'self-start' : ''} ${isToday && !isSel ? 'ring-2 ring-ouro text-ink' : ''}`}>{Number(iso.slice(8, 10))}</span>
              {narrow ? (
                <span className="mt-1 flex h-1.5 gap-[3px]">{dots(list).map((c, i) => <i key={i} className={`size-1.5 rounded-full ${isSel ? 'bg-white' : c}`} />)}</span>
              ) : (
                <span className="mt-1 min-w-0 space-y-0.5 text-left">
                  {list.slice(0, 2).map((e) => <span key={e.id} className={`block truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${isSel ? 'bg-white/15' : e.group === 'pay' ? 'bg-coral/15 text-out' : e.group === 'invoice' ? 'bg-ouro/20 text-[#8A5A00]' : e.group === 'receive' ? 'bg-vivo/15 text-in' : 'bg-ink/[0.05] text-ink/70'}`}>{e.title}</span>)}
                  {list.length > 2 && <span className={`block px-1.5 text-[10px] font-bold ${isSel ? 'text-white/80' : 'text-ink/55'}`}>+{list.length - 2}</span>}
                  {!list.length && due === 0 ? null : null}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const dayPanel = (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-extrabold tracking-[-0.02em]">{dayTitle(sel)}</p>
          <p className="text-xs text-ink/65">{sel === today ? 'Hoje' : relDay(sel, today)}{selEvents.length ? ` · ${plural(selEvents.length, 'item', 'itens')}` : ''}</p>
        </div>
        <button type="button" className="btn btn-primary shrink-0 !px-3.5 !py-2 text-[13px]" onClick={() => addOn(sel)}><Icon name="plus" size={15} strokeWidth={2.4} />Adicionar</button>
      </div>
      {selEvents.length ? <ul className="divide-y divide-ink/[0.07]">{selEvents.map((e) => <CalendarEvent key={e.id} e={e} />)}</ul>
        : <p className="py-5 text-center text-sm text-ink/65">Nada {filter === 'all' ? '' : 'com esse filtro '}neste dia.</p>}
    </div>
  );

  const header = (
    <div className="flex items-center gap-2">
      <button type="button" className="icon-btn size-10 shrink-0" aria-label="Mês anterior" onClick={() => go(-1)}><Icon name="left" size={18} /></button>
      <p className="min-w-0 flex-1 text-center text-[16px] font-extrabold tracking-[-0.02em]" aria-live="polite">{monthLabel(month)}</p>
      <button type="button" className="icon-btn size-10 shrink-0" aria-label="Próximo mês" onClick={() => go(1)}><Icon name="right" size={18} /></button>
    </div>
  );

  const summary = (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-2xl bg-coral/10 px-3 py-2.5"><p className="text-[10.5px] font-bold uppercase tracking-wider text-out">A pagar no mês</p><p className="truncate text-[16px] font-extrabold tabular-nums text-out">{m(totals.pay)}</p></div>
      <div className="rounded-2xl bg-vivo/10 px-3 py-2.5"><p className="text-[10.5px] font-bold uppercase tracking-wider text-in">A receber no mês</p><p className="truncate text-[16px] font-extrabold tabular-nums text-in">{m(totals.receive)}</p></div>
    </div>
  );

  const legend = (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-ink/65">
      <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-out" />A pagar</span>
      <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-ouro" />Fatura</span>
      <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-in" />A receber</span>
      <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-ink/30" />Pago</span>
      <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-[#5E8CA6]" />Aviso</span>
    </div>
  );

  const controls = (
    <div className="space-y-3">
      <Segmented size="sm" full label="Visualização" value={view} onChange={setView} options={[{ value: 'mes', label: 'Mês' }, { value: 'agenda', label: 'Agenda' }]} />
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {CAL_FILTERS.map((f) => (
          <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${filter === f.value ? 'border-vivo/50 bg-vivo/15 text-ink' : 'border-ink/10 bg-ink/[0.03] text-ink/70'}`}>{f.label}</button>
        ))}
      </div>
    </div>
  );

  const agendaList = agendaDays.length ? (
    <div className="space-y-3">
      {agendaDays.map((g) => (
        <div key={g.date}>
          <div className="mb-1 flex items-center justify-between px-1.5">
            <p className={`text-[11px] font-bold uppercase tracking-wider tabular-nums ${g.date === today ? 'text-in' : g.date < today ? 'text-ink/45' : 'text-ink/60'}`}>{dayTitle(g.date)}{g.date === today ? ' · hoje' : ''}</p>
            <button type="button" className="text-[11px] font-bold text-in" onClick={() => addOn(g.date)}>+ adicionar</button>
          </div>
          <ul className="divide-y divide-ink/[0.07]">{g.items.map((e) => <CalendarEvent key={e.id} e={e} />)}</ul>
        </div>
      ))}
    </div>
  ) : <EmptyState icon="calendar" title="Nada neste mês" text="Contas a pagar, faturas, recebimentos e recorrências aparecem aqui automaticamente." action={<button type="button" className="btn btn-primary" onClick={() => addOn(month === monthKey(today) ? today : first)}><Icon name="plus" size={16} />Adicionar conta</button>} />;

  if (narrow) {
    return (
      <div className="space-y-4">
        {controls}
        <div className="glass rounded-3xl p-3">
          {header}
          {totals.late > 0 && <p className="mt-2 rounded-xl bg-coral/10 px-3 py-1.5 text-center text-xs font-bold text-out">{plural(totals.late, 'conta atrasada', 'contas atrasadas')} neste mês</p>}
          {view === 'mes' && <div className="mt-2">{grid}</div>}
          <div className="mt-3 flex items-center justify-between gap-2">
            {view === 'mes' ? legend : <span />}
            {month !== monthKey(today) && <button type="button" className="shrink-0 text-xs font-bold text-in" onClick={goToday}>Hoje</button>}
          </div>
        </div>
        {summary}
        <div className="glass rise rounded-3xl px-3 py-3" key={`${view}-${sel}-${filter}`}>{view === 'mes' ? dayPanel : agendaList}</div>
        <button type="button" className="btn btn-ghost w-full !py-2.5 text-[13px]" onClick={exportIcs}><Icon name="download" size={15} />Exportar para o Google Agenda</button>
        <p className="-mt-2 px-2 text-center text-[11px] leading-relaxed text-ink/55">Abra o arquivo baixado com o Google Agenda, ou importe em calendar.google.com › Configurações › Importar.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Calendário" title={monthLabel(month)}>
        <button type="button" className="btn btn-ghost" onClick={exportIcs}><Icon name="download" size={17} />Google Agenda</button>
        <button type="button" className="btn btn-ghost" onClick={goToday}><Icon name="calendar" size={17} />Hoje</button>
        <button type="button" className="btn btn-primary" onClick={() => addOn(sel)}><Icon name="plus" size={18} strokeWidth={2.4} />Nova conta</button>
      </PageHeader>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="w-[260px]">{header}</div>
            <div className="flex items-center gap-3">
              <div className="w-[200px]"><Segmented size="sm" full label="Visualização" value={view} onChange={setView} options={[{ value: 'mes', label: 'Mês' }, { value: 'agenda', label: 'Agenda' }]} /></div>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {CAL_FILTERS.map((f) => (
              <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${filter === f.value ? 'border-vivo/50 bg-vivo/15 text-ink' : 'border-ink/10 bg-ink/[0.03] text-ink/70 hover:text-ink'}`}>{f.label}</button>
            ))}
          </div>
          {view === 'mes' ? <>{grid}<div className="mt-3">{legend}</div></> : agendaList}
        </Card>
        <div className="space-y-5">
          <Card>{summary}{totals.late > 0 && <p className="mt-3 rounded-xl bg-coral/10 px-3 py-2 text-center text-xs font-bold text-out">{plural(totals.late, 'conta atrasada', 'contas atrasadas')} neste mês</p>}</Card>
          <Card>{dayPanel}</Card>
        </div>
      </div>
    </div>
  );
}
