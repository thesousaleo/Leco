/* =====================================================================
   50-pages: telas do app (visão geral, transações, contas e cartões,
   recorrentes, relatórios, metas, categorias, configurações).
   ===================================================================== */
function KpiCard({ label, icon, children, foot, spark, sparkColor, hero, delay = 0, extra }) {
  return (
    <article className={`${hero ? 'glass-hero' : 'glass'} rise flex min-w-0 flex-col gap-4 p-5 sm:p-6`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${hero ? 'bg-ouro/25 text-ouro' : 'bg-ink/[0.06] text-ink'}`}><Icon name={icon} size={18} /></span>
          <h3 className="truncate text-[13px] font-semibold text-ink/80">{label}</h3>
        </div>
        {extra}
      </div>
      <div className="whitespace-nowrap text-[26px] font-extrabold leading-none tracking-[-0.02em] sm:text-[28px]">{children}</div>
      <div className="flex items-end justify-between gap-4">
        <span className="min-w-0 text-xs text-ink/70">{foot}</span>
        {spark && <div className="w-24 shrink-0"><Spark values={spark} color={sparkColor} height={32} /></div>}
      </div>
    </article>
  );
}

function FlowChart({ series, month, height = 260 }) {
  const theme = useContext(ThemeCtx);
  const P = PALETTES[theme];
  const [view, setView] = useState('flow');
  const s = series;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-ink/75">
          {view === 'flow' ? (
            <>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: P.in }} />Receitas</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: P.out }} />Despesas</span>
            </>
          ) : <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: P.gold }} />Saldo das contas no fim do mês</span>}
        </div>
        <Segmented size="sm" label="Tipo de gráfico" value={view} onChange={setView} options={[{ value: 'flow', label: 'Receitas × Despesas' }, { value: 'bal', label: 'Saldo' }]} />
      </div>
      {view === 'flow' ? (
        <AreaChart height={height} points={s} selectedKey={month} label={`Receitas e despesas de ${s[0].full} a ${s[s.length - 1].full}`}
          series={[{ key: 'in', label: 'Receitas', color: P.in, values: s.map((p) => p.in) }, { key: 'out', label: 'Despesas', color: P.out, values: s.map((p) => p.out) }]} />
      ) : (
        <AreaChart height={height} points={s} selectedKey={month} zeroBase={false} label={`Saldo de ${s[0].full} a ${s[s.length - 1].full}`}
          series={[{ key: 'bal', label: 'Saldo', color: P.gold, values: s.map((p) => p.bal) }]} />
      )}
    </div>
  );
}

function BudgetList({ budgets, limit, onManage }) {
  const m = useMoneyText();
  const list = limit ? budgets.slice(0, limit) : budgets;
  return (
    <div>
      {list.length === 0 && <p className="py-3 text-sm leading-relaxed text-ink/65">Nenhuma categoria tem orçamento ainda. Defina limites mensais em Categorias e o Leco avisa quando chegar perto.</p>}
      <ul className="space-y-4">
        {list.map((b) => {
          const state = b.pct >= 100 ? 'over' : b.pct >= 80 ? 'warn' : '';
          return (
            <li key={b.key}>
              <div className="flex items-center gap-3">
                <ColorIcon icon={b.icon} color={b.color} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13.5px] font-bold">{b.label}</p>
                    <span className={state === 'over' ? 'pill pill-bad' : state === 'warn' ? 'badge-gold' : 'pill pill-good'}>{b.pct}%</span>
                  </div>
                  <p className="truncate text-xs tabular-nums text-ink/65">{m(b.spent)} de {m(b.budget)}{b.pct >= 100 ? ` · ${m(b.spent - b.budget)} acima` : ` · restam ${m(b.budget - b.spent)}`}</p>
                </div>
              </div>
              <div className="track mt-2"><i className={state} style={{ width: `${Math.min(100, b.pct)}%` }} /></div>
            </li>
          );
        })}
      </ul>
      {onManage && <button type="button" className="btn btn-ghost mt-5 w-full !py-2 text-[13px]" onClick={onManage}><Icon name="grid" size={15} />{list.length ? 'Ajustar orçamentos' : 'Definir orçamentos'}</button>}
    </div>
  );
}

function UpcomingList({ limit = 6, compact }) {
  const d = useApp();
  const m = useMoneyText();
  const today = todayISO();
  const horizon = addDays(today, 30);
  const pending = d.transactions.filter((t) => !t.paid && t.date <= horizon).sort((a, b) => (a.date < b.date ? -1 : 1));
  const invoices = d.cards.filter((c) => !c.archived).flatMap((c) => {
    const s = cardSummary(c, d.transactions, today);
    const list = [...s.toPay];
    if (s.current && s.current.total > 0 && !list.some((i) => i.invoice === s.current.invoice)) list.push(s.current);
    return list.filter((i) => i.remaining > 0 && i.due <= horizon).map((i) => ({ card: c, inv: i }));
  });
  const items = [
    ...pending.map((t) => ({ date: t.date, el: <TxItem key={t.id} t={t} dense onOpen={(x) => d.openModal({ kind: 'tx', initial: x })} onConfirm={d.confirmTx} /> })),
    ...invoices.map(({ card, inv }) => ({
      date: inv.due,
      el: (
        <li key={`${card.id}-${inv.invoice}`} className="flex items-center gap-3 rounded-2xl px-1.5 py-2">
          <ColorIcon icon="card" color={card.color} size={36} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate text-[14px] font-semibold">Fatura {card.name}<span className={`${INVOICE_STATUS[inv.status].cls} !px-2 !py-0 !text-[10.5px]`}>{INVOICE_STATUS[inv.status].label.toLowerCase()}</span></p>
            <p className="truncate text-xs text-ink/65">vence {relDay(inv.due, today)} · {fmtDate(inv.due)}</p>
          </div>
          <button type="button" className="btn btn-ghost shrink-0 !px-3 !py-1.5 text-xs" onClick={() => d.openModal({ kind: 'invoice', card, invoice: inv.invoice })}>{inv.status === 'aberta' ? 'Ver' : 'Pagar'}</button>
          <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-out">{m(inv.remaining)}</span>
        </li>
      ),
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!items.length) return <p className="py-4 text-sm leading-relaxed text-ink/65">Nada vencendo nos próximos 30 dias. Cadastre contas fixas em Recorrentes para receber lembretes.</p>;
  return <ul className={`divide-y divide-ink/[0.07] ${compact ? '' : ''}`}>{items.slice(0, limit).map((x) => x.el)}</ul>;
}

function AccountsMini({ onAll }) {
  const d = useApp();
  const m = useMoneyText();
  const accs = d.accounts.filter((a) => !a.archived);
  return (
    <div>
      <ul className="divide-y divide-ink/[0.07]">
        {accs.map((a) => (
          <li key={a.id}>
            <button type="button" className="flex w-full items-center gap-3 rounded-2xl px-1.5 py-2.5 text-left hover:bg-ink/[0.03]" onClick={() => d.openModal({ kind: 'account', initial: a })}>
              <ColorIcon icon={ACCOUNT_KINDS[a.kind].icon} color={a.color} size={36} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{a.name}</span><span className="block text-xs text-ink/65">{ACCOUNT_KINDS[a.kind].label}</span></span>
              <span className={`text-[14px] font-extrabold tabular-nums ${d.balances[a.id] < 0 ? 'text-out' : ''}`}>{m(d.balances[a.id])}</span>
            </button>
          </li>
        ))}
        {d.cards.filter((c) => !c.archived).map((c) => {
          const s = cardSummary(c, d.transactions);
          return (
            <li key={c.id}>
              <button type="button" className="flex w-full items-center gap-3 rounded-2xl px-1.5 py-2.5 text-left hover:bg-ink/[0.03]" onClick={() => d.openModal({ kind: 'invoice', card: c })}>
                <ColorIcon icon="card" color={c.color} size={36} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{c.name}</span><span className="block text-xs text-ink/65">Fatura atual · vence {fmtDate(s.current.due)}</span></span>
                <span className="text-[14px] font-extrabold tabular-nums text-out">{m(s.current.total)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {onAll && <button type="button" className="btn btn-ghost mt-4 w-full !py-2 text-[13px]" onClick={onAll}>Gerenciar contas e cartões</button>}
    </div>
  );
}

/* ---------- Visão geral ---------- */
function OverviewPage() {
  const d = useApp();
  const narrow = useNarrow();
  const month = d.month;
  const from = `${month}-01`, to = dayIn(month, 31);
  const sm = periodSummary(d.transactions, from, to, d.categories);
  const prevK = shiftMonth(month, -1);
  const prev = periodSummary(d.transactions, `${prevK}-01`, dayIn(prevK, 31), d.categories);
  const pct = (a, b) => (b ? ((a - b) / b) * 100 : null);
  const series = useMemo(() => monthSeries(d.transactions, d.accounts, month), [d.transactions, d.accounts, month]);
  const totalBal = sum(d.accounts, (a) => d.balances[a.id] || 0);
  const cardsDue = sum(d.cards.filter((c) => !c.archived), (c) => { const s = cardSummary(c, d.transactions); return Math.max(0, s.current.remaining) + sum(s.toPay.filter((i) => i.invoice !== s.current.invoice), (i) => i.remaining); });
  const recent = d.transactions.filter((t) => t.date <= to && t.paid).slice(0, 6);
  const budgets = budgetsFor(d.categories, d.transactions, month);
  return (
    <div className="space-y-5">
      {!narrow && (
        <PageHeader eyebrow={`${greeting()}${d.name ? `, ${firstName(d.name)}` : ''}`} title={`Resumo de ${monthLabel(month)}`}>
          <MonthSwitch month={month} onChange={d.setMonth} />
          <NotifButton />
          <button type="button" className="btn btn-primary" onClick={() => d.openModal({ kind: 'tx' })}><Icon name="plus" size={18} strokeWidth={2.4} />Nova transação</button>
        </PageHeader>
      )}
      {narrow && <div className="flex justify-center"><MonthSwitch compact month={month} onChange={d.setMonth} /></div>}
      <div className="grid gap-4 md:grid-cols-2 min-[1500px]:grid-cols-4">
        <KpiCard hero label="Saldo em contas" icon="wallet" foot={plural(d.accounts.filter((a) => !a.archived).length, 'conta', 'contas')} spark={series.map((p) => p.bal)} sparkColor="#E8A317">
          <Money cents={totalBal} />
        </KpiCard>
        <KpiCard label="Receitas do mês" icon="inArrow" delay={60} extra={<Delta value={pct(sm.income, prev.income)} />} foot={`${monthName(prevK)}: ${fmtBRL(prev.income)}`}>
          <Money cents={sm.income} className="text-in" />
        </KpiCard>
        <KpiCard label="Despesas do mês" icon="up" delay={120} extra={<Delta value={pct(sm.expense, prev.expense)} goodWhen="down" />} foot={`${monthName(prevK)}: ${fmtBRL(prev.expense)}`}>
          <Money cents={sm.expense} className="text-out" />
        </KpiCard>
        <KpiCard label={d.cards.length ? 'Faturas a pagar' : 'Resultado do mês'} icon={d.cards.length ? 'card' : 'sparkle'} delay={180}
          foot={d.cards.length ? plural(d.cards.filter((c) => !c.archived).length, 'cartão', 'cartões') : `${fmtPctAbs(sm.rate)} poupado · meta ${d.profile.savings_goal}%`}>
          {d.cards.length ? <Money cents={cardsDue} /> : <Money cents={sm.net} className={sm.net < 0 ? 'text-out' : ''} />}
        </KpiCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Próximos vencimentos" sub="Contas a pagar, a receber e faturas nos próximos 30 dias" delay={100}><UpcomingList /></Card>
        <Card title="Contas e cartões" delay={140}><AccountsMini onAll={() => d.go('contas')} /></Card>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Fluxo de caixa" sub="Últimos 6 meses" delay={160}><FlowChart series={series} month={month} height={narrow ? 210 : 260} /></Card>
        <Card title="Despesas por categoria" sub={`${monthLabel(month)} · ${fmtBRL(sm.expense)}`} delay={200}><CategoryBreakdown items={sm.byCatOut} compact={narrow} donutSize={narrow ? 180 : 196} /></Card>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Últimas transações" delay={220} action={<button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => d.go('transacoes')}>Ver todas<Icon name="right" size={15} /></button>}>
          {recent.length ? <ul className="divide-y divide-ink/[0.07]">{recent.map((t) => <TxItem key={t.id} t={t} onOpen={(x) => d.openModal({ kind: 'tx', initial: x })} />)}</ul>
            : <EmptyState icon="list" title="Nenhuma transação ainda" text="Registre a primeira receita ou despesa e o painel começa a mostrar os seus números." action={<button type="button" className="btn btn-primary" onClick={() => d.openModal({ kind: 'tx' })}><Icon name="plus" size={16} />Nova transação</button>} />}
        </Card>
        <Card title="Orçamentos do mês" delay={260}><BudgetList budgets={budgets} limit={5} onManage={() => d.go('categorias')} /></Card>
      </div>
    </div>
  );
}

/* ---------- Transações ---------- */
function TransactionsPage() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const [scope, setScope] = useState('month');
  const [type, setType] = useState('all');
  const [src, setSrc] = useState('all');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [limit, setLimit] = useState(30);
  useEffect(() => setLimit(30), [scope, type, src, cat, status, q, d.month, sort]);
  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = d.transactions.filter((t) => {
      if (scope === 'month' && monthKey(t.date) !== d.month) return false;
      if (type !== 'all' && t.kind !== type) return false;
      if (src !== 'all') { const [k, id] = src.split(':'); if (k === 'acc' && t.account_id !== id && t.to_account_id !== id) return false; if (k === 'card' && t.card_id !== id) return false; }
      if (cat !== 'all' && t.category_id !== cat) return false;
      if (status === 'paid' && !t.paid) return false;
      if (status === 'pending' && t.paid) return false;
      if (qq) { const meta = txMeta(t, d); if (!`${meta.title} ${meta.sub} ${t.notes || ''}`.toLowerCase().includes(qq)) return false; }
      return true;
    });
    const by = { recent: (a, b) => (a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : a.date < b.date ? 1 : -1), old: (a, b) => (a.date < b.date ? -1 : 1), high: (a, b) => b.amount - a.amount, low: (a, b) => a.amount - b.amount };
    return list.sort(by[sort]);
  }, [d.transactions, d.categories, d.accounts, d.cards, scope, d.month, type, src, cat, status, q, sort]);
  const inc = sum(rows.filter(countsAsIncome), (t) => t.amount);
  const exp = sum(rows.filter(countsAsExpense), (t) => t.amount);
  const groups = [];
  if (sort === 'recent' || sort === 'old') rows.slice(0, limit).forEach((t) => { const g = groups[groups.length - 1]; if (g && g.date === t.date) g.items.push(t); else groups.push({ date: t.date, items: [t] }); });
  const filtered = type !== 'all' || src !== 'all' || cat !== 'all' || status !== 'all' || q;
  return (
    <div className="space-y-5">
      {!narrow && (
        <PageHeader eyebrow="Transações" title="Movimentações">
          <button type="button" className="btn btn-ghost" onClick={() => d.openModal({ kind: 'tx', defaultKind: 'in' })}><Icon name="inArrow" size={17} />Receita</button>
          <button type="button" className="btn btn-primary" onClick={() => d.openModal({ kind: 'tx', defaultKind: 'out' })}><Icon name="plus" size={18} strokeWidth={2.4} />Despesa</button>
        </PageHeader>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented size="sm" label="Período" value={scope} onChange={setScope} options={[{ value: 'month', label: 'Mês' }, { value: 'all', label: 'Tudo' }]} />
          {scope === 'month' && <MonthSwitch compact month={d.month} onChange={d.setMonth} />}
        </div>
        <div className={`mt-3 grid gap-2 ${narrow ? 'grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-5'}`}>
          <select id="f-type" aria-label="Tipo" className="field !rounded-full !py-2 text-[13px]" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">Todos os tipos</option><option value="out">Despesas</option><option value="in">Receitas</option><option value="transfer">Transferências</option><option value="card_payment">Pagamentos de fatura</option>
          </select>
          <select id="f-src" aria-label="Conta ou cartão" className="field !rounded-full !py-2 text-[13px]" value={src} onChange={(e) => setSrc(e.target.value)}>
            <option value="all">Todas as contas</option>
            {d.accounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}
            {d.cards.map((c) => <option key={c.id} value={`card:${c.id}`}>{c.name} (cartão)</option>)}
          </select>
          <select id="f-cat" aria-label="Categoria" className="field !rounded-full !py-2 text-[13px]" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">Todas as categorias</option>
            {d.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select id="f-status" aria-label="Situação" className="field !rounded-full !py-2 text-[13px]" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Pagas e pendentes</option><option value="paid">Só pagas</option><option value="pending">Só pendentes</option>
          </select>
          <select id="f-sort" aria-label="Ordenar" className="field !rounded-full !py-2 text-[13px]" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Mais recentes</option><option value="old">Mais antigas</option><option value="high">Maior valor</option><option value="low">Menor valor</option>
          </select>
          <label className={`relative ${narrow ? 'col-span-2' : 'sm:col-span-2 lg:col-span-5'}`}>
            <span className="sr-only">Buscar</span>
            <Icon name="search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/60" />
            <input id="f-q" className="field !rounded-full !py-2 !pl-10 text-[13px]" placeholder="Buscar por descrição, categoria, conta ou observação" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-ink/[0.04] px-3 py-2.5"><p className="text-[10.5px] font-semibold uppercase tracking-wider text-ink/65">Itens</p><p className="text-base font-extrabold tabular-nums">{rows.length}</p></div>
          <div className="rounded-2xl bg-ink/[0.04] px-3 py-2.5"><p className="text-[10.5px] font-semibold uppercase tracking-wider text-ink/65">Entradas</p><p className="truncate text-base font-extrabold tabular-nums text-in">{m(inc)}</p></div>
          <div className="rounded-2xl bg-ink/[0.04] px-3 py-2.5"><p className="text-[10.5px] font-semibold uppercase tracking-wider text-ink/65">Saídas</p><p className="truncate text-base font-extrabold tabular-nums text-out">{m(exp)}</p></div>
        </div>
        <div className="mt-4">
          {rows.length === 0 ? (
            <EmptyState icon="search" title={filtered ? 'Nada encontrado' : 'Nenhuma transação neste período'} text={filtered ? 'Mude os filtros ou limpe a busca.' : 'Use o botão + para registrar uma receita, despesa ou transferência.'}
              action={filtered ? <button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => { setType('all'); setSrc('all'); setCat('all'); setStatus('all'); setQ(''); }}>Limpar filtros</button> : null} />
          ) : groups.length ? groups.map((g) => (
            <div key={g.date} className="mb-2">
              <p className="sticky top-0 z-[1] px-1.5 py-1.5 text-[11px] font-bold uppercase tracking-wider tabular-nums text-ink/60">{fmtDate(g.date)} · {relDay(g.date)}</p>
              <ul className="divide-y divide-ink/[0.07]">{g.items.map((t) => <TxItem key={t.id} t={t} showDate={false} onOpen={(x) => d.openModal({ kind: 'tx', initial: x })} onConfirm={d.confirmTx} />)}</ul>
            </div>
          )) : <ul className="divide-y divide-ink/[0.07]">{rows.slice(0, limit).map((t) => <TxItem key={t.id} t={t} onOpen={(x) => d.openModal({ kind: 'tx', initial: x })} onConfirm={d.confirmTx} />)}</ul>}
          {rows.length > limit && <div className="mt-3 flex justify-center"><button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => setLimit((l) => l + 30)}>Mostrar mais ({rows.length - limit})</button></div>}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Contas e cartões ---------- */
function AccountsPage() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const [showArchived, setShowArchived] = useState(false);
  const accs = d.accounts.filter((a) => showArchived || !a.archived);
  const cards = d.cards.filter((c) => showArchived || !c.archived);
  const total = sum(d.accounts, (a) => d.balances[a.id] || 0);
  const archivedCount = d.accounts.filter((a) => a.archived).length + d.cards.filter((c) => c.archived).length;
  return (
    <div className="space-y-5">
      {!narrow && <PageHeader eyebrow="Contas e cartões" title={`Saldo total ${d.hide ? 'R$ ••••' : fmtBRL(total)}`}>
        <button type="button" className="btn btn-ghost" onClick={() => d.openModal({ kind: 'tx', defaultKind: 'transfer' })}><Icon name="swap" size={17} />Transferir</button>
      </PageHeader>}
      <Card title="Contas" sub="Banco, carteira, poupança e investimentos" action={<button type="button" className="btn btn-primary !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'account' })}><Icon name="plus" size={16} />Nova conta</button>}>
        {accs.length === 0 ? <EmptyState icon="bank" title="Nenhuma conta" text="Cadastre onde o seu dinheiro fica: conta do banco, carteira, poupança." /> : (
          <ul className={`grid gap-3 ${narrow ? '' : 'md:grid-cols-2 2xl:grid-cols-3'}`}>
            {accs.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => d.openModal({ kind: 'account', initial: a })} className={`glass w-full rounded-3xl p-4 text-left transition-transform hover:-translate-y-0.5 ${a.archived ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3">
                    <ColorIcon icon={ACCOUNT_KINDS[a.kind].icon} color={a.color} size={42} />
                    <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-extrabold">{a.name}</p><p className="text-xs text-ink/65">{ACCOUNT_KINDS[a.kind].label}{a.archived ? ' · arquivada' : ''}</p></div>
                    <Icon name="edit" size={16} className="text-ink/45" />
                  </div>
                  <p className={`mt-4 text-[24px] font-extrabold tracking-[-0.02em] tabular-nums ${d.balances[a.id] < 0 ? 'text-out' : ''}`}>{m(d.balances[a.id])}</p>
                  <p className="text-xs text-ink/60">saldo atual</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Cartões de crédito" sub="Limite, fatura atual e vencimentos" action={<button type="button" className="btn btn-primary !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'card' })}><Icon name="plus" size={16} />Novo cartão</button>}>
        {cards.length === 0 ? <EmptyState icon="card" title="Nenhum cartão" text="Cadastre seus cartões para acompanhar faturas, parcelas e o limite disponível." /> : (
          <ul className={`grid gap-3 ${narrow ? '' : 'md:grid-cols-2 2xl:grid-cols-3'}`}>
            {cards.map((c) => {
              const s = cardSummary(c, d.transactions);
              const usedPct = c.limit_amount ? Math.min(100, Math.round((s.used / c.limit_amount) * 100)) : 0;
              const st = INVOICE_STATUS[s.current.status];
              return (
                <li key={c.id} className={`overflow-hidden rounded-3xl ${c.archived ? 'opacity-60' : ''}`}>
                  <div className="glass-hero rounded-b-none p-4" style={{ background: `linear-gradient(140deg, ${c.color}, ${mixHex(c.color, '#0B2F29', 0.55)})` }}>
                    <div className="flex items-center justify-between">
                      <p className="truncate text-[15px] font-extrabold">{c.name}</p>
                      <button type="button" className="icon-btn size-8 !border-white/25 !bg-white/10 !text-white" aria-label={`Editar ${c.name}`} onClick={() => d.openModal({ kind: 'card', initial: c })}><Icon name="edit" size={14} /></button>
                    </div>
                    <p className="mt-3 text-xs text-ink/75">Fatura de {invoiceLabel(s.current.invoice)} <span className={`${st.cls} !ml-1 !py-0 !text-[10px]`}>{st.label}</span></p>
                    <p className="text-[24px] font-extrabold tracking-[-0.02em] tabular-nums">{m(s.current.total)}</p>
                    <p className="text-xs text-ink/75">fecha {fmtDate(s.current.closing)} · vence {fmtDate(s.current.due)}</p>
                  </div>
                  <div className="glass rounded-t-none p-4">
                    <div className="flex justify-between text-xs tabular-nums text-ink/70"><span>Usado {m(s.used)}</span><span>Disponível <b className={s.available < 0 ? 'text-out' : 'text-ink'}>{m(s.available)}</b></span></div>
                    <div className="track mt-1.5"><i className={usedPct >= 90 ? 'over' : usedPct >= 70 ? 'warn' : ''} style={{ width: `${usedPct}%` }} /></div>
                    {s.nextToPay && <p className="mt-3 rounded-xl bg-coral/10 px-3 py-2 text-xs font-semibold text-out">Fatura de {invoiceLabel(s.nextToPay.invoice)} para pagar: {m(s.nextToPay.remaining)} até {fmtDate(s.nextToPay.due)}</p>}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'invoice', card: c })}><Icon name="file" size={15} />Faturas</button>
                      <button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'tx', defaultKind: 'out', presetSource: `card:${c.id}` })}><Icon name="plus" size={15} />Compra</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {archivedCount > 0 && <div className="flex justify-center"><button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => setShowArchived((v) => !v)}><Icon name="archive" size={15} />{showArchived ? 'Esconder arquivados' : `Mostrar arquivados (${archivedCount})`}</button></div>}
    </div>
  );
}

/* ---------- Recorrentes ---------- */
function RecurringPage() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const list = d.recurrings.slice().sort((a, b) => (a.active === b.active ? (a.next_date < b.next_date ? -1 : 1) : a.active ? -1 : 1));
  const monthlyOut = sum(d.recurrings.filter((r) => r.active && r.kind === 'out'), (r) => (r.frequency === 'weekly' ? Math.round(r.amount * 52 / 12) : r.frequency === 'yearly' ? Math.round(r.amount / 12) : r.amount));
  const monthlyIn = sum(d.recurrings.filter((r) => r.active && r.kind === 'in'), (r) => (r.frequency === 'weekly' ? Math.round(r.amount * 52 / 12) : r.frequency === 'yearly' ? Math.round(r.amount / 12) : r.amount));
  const where = (r) => { if (r.card_id) { const c = d.cards.find((x) => x.id === r.card_id); return c ? c.name : 'Cartão'; } const a = d.accounts.find((x) => x.id === r.account_id); return a ? a.name : 'Sem conta'; };
  return (
    <div className="space-y-5">
      {!narrow && <PageHeader eyebrow="Recorrentes" title="Contas fixas e lembretes">
        <button type="button" className="btn btn-primary" onClick={() => d.openModal({ kind: 'recurring' })}><Icon name="plus" size={18} strokeWidth={2.4} />Nova recorrência</button>
      </PageHeader>}
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="Despesas fixas por mês" icon="repeat" foot={plural(d.recurrings.filter((r) => r.active && r.kind === 'out').length, 'ativa', 'ativas')}><Money cents={monthlyOut} className="text-out" /></KpiCard>
        <KpiCard label="Receitas fixas por mês" icon="inArrow" foot={plural(d.recurrings.filter((r) => r.active && r.kind === 'in').length, 'ativa', 'ativas')} delay={60}><Money cents={monthlyIn} className="text-in" /></KpiCard>
      </div>
      <Card title="A pagar e a receber" sub="Confirme quando o dinheiro sair ou entrar"><UpcomingList limit={20} /></Card>
      <Card title="Recorrências" action={narrow ? <button type="button" className="btn btn-primary !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'recurring' })}><Icon name="plus" size={16} />Nova</button> : null}>
        {list.length === 0 ? <EmptyState icon="repeat" title="Nenhuma recorrência" text="Cadastre salário, aluguel, assinaturas e contas de consumo. O Leco lança todo mês e avisa antes de vencer." /> : (
          <ul className="divide-y divide-ink/[0.07]">
            {list.map((r) => {
              const cat = d.categories.find((c) => c.id === r.category_id);
              return (
                <li key={r.id} className={`flex items-center gap-3 py-3 ${r.active ? '' : 'opacity-55'}`}>
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => d.openModal({ kind: 'recurring', initial: r })}>
                    <ColorIcon icon={cat ? cat.icon : 'repeat'} color={cat ? cat.color : '#6B9E8F'} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{r.description}</span>
                      <span className="block truncate text-xs text-ink/65">{FREQ[r.frequency]} · {where(r)} · {r.active ? `próximo ${fmtDate(r.next_date)}` : 'pausada'}{r.end_date ? ` · até ${fmtDate(r.end_date)}` : ''}</span>
                    </span>
                  </button>
                  <span className={`shrink-0 text-[14px] font-extrabold tabular-nums ${r.kind === 'in' ? 'text-in' : 'text-out'}`}>{m(r.amount)}</span>
                  <button type="button" role="switch" aria-checked={r.active} aria-label={`${r.active ? 'Pausar' : 'Retomar'} ${r.description}`} className={`switch ${r.active ? 'on' : ''}`} onClick={() => d.saveRecurring(r, { active: !r.active })}><span /></button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------- Relatórios ---------- */
const PERIODS = [
  { value: 'this', label: 'Este mês' }, { value: 'last', label: 'Mês passado' }, { value: '3m', label: 'Últimos 3 meses' },
  { value: '6m', label: 'Últimos 6 meses' }, { value: 'year', label: 'Este ano' }, { value: '12m', label: 'Últimos 12 meses' }, { value: 'custom', label: 'Personalizado' },
];
function periodRange(p, custom) {
  const t = todayISO(), k = monthKey(t);
  if (p === 'this') return [`${k}-01`, dayIn(k, 31)];
  if (p === 'last') { const l = shiftMonth(k, -1); return [`${l}-01`, dayIn(l, 31)]; }
  if (p === '3m') return [`${shiftMonth(k, -2)}-01`, dayIn(k, 31)];
  if (p === '6m') return [`${shiftMonth(k, -5)}-01`, dayIn(k, 31)];
  if (p === '12m') return [`${shiftMonth(k, -11)}-01`, dayIn(k, 31)];
  if (p === 'year') return [`${k.slice(0, 4)}-01-01`, `${k.slice(0, 4)}-12-31`];
  return [custom.from, custom.to];
}

function ReportsPage() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const [period, setPeriod] = useState('this');
  const [custom, setCustom] = useState({ from: `${monthKey(todayISO())}-01`, to: todayISO() });
  const [catTab, setCatTab] = useState('out');
  const [from, to] = periodRange(period, custom);
  const valid = from && to && from <= to;
  const sm = useMemo(() => (valid ? periodSummary(d.transactions, from, to, d.categories) : null), [d.transactions, d.categories, from, to, valid]);
  const months = useMemo(() => {
    if (!valid) return [];
    const list = []; let k = monthKey(from);
    while (k <= monthKey(to) && list.length < 36) { const s = periodSummary(d.transactions, `${k}-01`, dayIn(k, 31), d.categories); list.push({ k, short: monthShort(k), full: monthLabel(k), in: s.income, out: s.expense }); k = shiftMonth(k, 1); }
    return list;
  }, [d.transactions, from, to, valid]);
  const byAccount = useMemo(() => {
    if (!valid) return [];
    const rows = [...d.accounts.map((a) => ({ key: a.id, name: a.name, icon: ACCOUNT_KINDS[a.kind].icon, color: a.color, in: 0, out: 0 })), ...d.cards.map((c) => ({ key: c.id, name: `${c.name} (cartão)`, icon: 'card', color: c.color, in: 0, out: 0 }))];
    d.transactions.forEach((t) => {
      if (t.date < from || t.date > to) return;
      if (countsAsIncome(t)) { const r = rows.find((x) => x.key === t.account_id); if (r) r.in += t.amount; }
      if (countsAsExpense(t)) { const r = rows.find((x) => x.key === (t.card_id || t.account_id)); if (r) r.out += t.amount; }
    });
    return rows.filter((r) => r.in || r.out).sort((a, b) => b.out + b.in - a.out - a.in);
  }, [d.transactions, d.accounts, d.cards, from, to, valid]);
  const exportTx = () => {
    const list = d.transactions.filter((t) => t.date >= from && t.date <= to);
    d.exportFile(`leco-transacoes-${from}-a-${to}.csv`, transactionsCSV(list, d));
  };
  const exportSummary = () => {
    const rows = [
      ...sm.byCatOut.map((c) => ['Despesa', c.label, centsCSV(c.value), fmtPctAbs((c.value / (sm.expense || 1)) * 100)]),
      ...sm.byCatIn.map((c) => ['Receita', c.label, centsCSV(c.value), fmtPctAbs((c.value / (sm.income || 1)) * 100)]),
      [], ['Total de receitas', '', centsCSV(sm.income), ''], ['Total de despesas', '', centsCSV(sm.expense), ''], ['Resultado', '', centsCSV(sm.net), ''],
    ];
    d.exportFile(`leco-resumo-${from}-a-${to}.csv`, toCSV(['Tipo', 'Categoria', 'Valor (R$)', 'Participação'], rows));
  };
  const top = sm ? sm.expenseTx.slice().sort((a, b) => b.amount - a.amount).slice(0, 10) : [];
  return (
    <div className="space-y-5">
      {!narrow && <PageHeader eyebrow="Relatórios" title={valid ? `${fmtDate(from)} a ${fmtDate(to)}` : 'Escolha o período'}>
        <button type="button" className="btn btn-ghost" onClick={exportSummary} disabled={!valid}><Icon name="download" size={17} />Resumo</button>
        <button type="button" className="btn btn-primary" onClick={exportTx} disabled={!valid}><Icon name="download" size={17} />Exportar para Excel</button>
      </PageHeader>}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Período" className="min-w-[180px] flex-1 sm:flex-none">
            <select id="rp-period" className="field" value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
          </Field>
          {period === 'custom' && (<>
            <Field label="De" className="min-w-[150px] flex-1 sm:flex-none"><input id="rp-from" type="date" className="field" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} /></Field>
            <Field label="Até" className="min-w-[150px] flex-1 sm:flex-none"><input id="rp-to" type="date" className="field" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} /></Field>
          </>)}
          {narrow && <div className="grid w-full grid-cols-2 gap-2">
            <button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={exportSummary} disabled={!valid}><Icon name="download" size={15} />Resumo</button>
            <button type="button" className="btn btn-primary !py-2 text-[13px]" onClick={exportTx} disabled={!valid}><Icon name="download" size={15} />Transações</button>
          </div>}
        </div>
        {!valid && <p className="mt-3 text-sm font-semibold text-out">A data inicial precisa ser antes da final.</p>}
      </Card>
      {sm && (
        <>
          <div className="grid gap-4 grid-cols-2 min-[1500px]:grid-cols-4">
            <KpiCard label="Receitas" icon="inArrow" foot={plural(sm.incomeTx.length, 'lançamento', 'lançamentos')}><Money cents={sm.income} className="text-in" /></KpiCard>
            <KpiCard label="Despesas" icon="up" delay={40} foot={plural(sm.expenseTx.length, 'lançamento', 'lançamentos')}><Money cents={sm.expense} className="text-out" /></KpiCard>
            <KpiCard label="Resultado" icon="sparkle" delay={80} foot={sm.net >= 0 ? 'sobrou no período' : 'gastou mais do que recebeu'}><Money cents={sm.net} className={sm.net < 0 ? 'text-out' : ''} /></KpiCard>
            <KpiCard label="Taxa de poupança" icon="piggy" delay={120} foot={`meta ${d.profile.savings_goal}%`}><Percent value={sm.rate} className={sm.rate < d.profile.savings_goal ? 'text-out' : 'text-in'} /></KpiCard>
          </div>
          {months.length > 1 && <Card title="Mês a mês" sub="Receitas e despesas"><BarChart points={months} height={narrow ? 200 : 260} label="Receitas e despesas por mês" /></Card>}
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Por categoria" action={<Segmented size="sm" label="Tipo" value={catTab} onChange={setCatTab} options={[{ value: 'out', label: 'Despesas' }, { value: 'in', label: 'Receitas' }]} />}>
              <CategoryBreakdown items={catTab === 'out' ? sm.byCatOut : sm.byCatIn} compact={narrow} donutSize={narrow ? 180 : 196} emptyText={catTab === 'out' ? 'Nenhuma despesa no período.' : 'Nenhuma receita no período.'} />
            </Card>
            <Card title="Por conta e cartão">
              {byAccount.length === 0 ? <p className="py-6 text-center text-sm text-ink/65">Sem movimentação no período.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[300px] text-left text-[13px]">
                    <thead><tr className="text-[11px] uppercase tracking-wider text-ink/60"><th className="py-2 pr-3 font-semibold">Conta</th><th className="py-2 pr-3 text-right font-semibold">Entradas</th><th className="py-2 text-right font-semibold">Saídas</th></tr></thead>
                    <tbody>{byAccount.map((r) => (
                      <tr key={r.key} className="border-t border-ink/[0.07]">
                        <td className="py-2.5 pr-3"><span className="flex items-center gap-2 font-semibold"><ColorIcon icon={r.icon} color={r.color} size={28} /><span className="truncate">{r.name}</span></span></td>
                        <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-in">{m(r.in)}</td>
                        <td className="py-2.5 text-right font-bold tabular-nums text-out">{m(r.out)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
          <Card title="Maiores despesas" sub="Top 10 do período">
            {top.length ? <ol className="divide-y divide-ink/[0.07]">{top.map((t) => <TxItem key={t.id} t={t} dense onOpen={(x) => d.openModal({ kind: 'tx', initial: x })} />)}</ol> : <p className="py-6 text-center text-sm text-ink/65">Nenhuma despesa no período.</p>}
          </Card>
        </>
      )}
    </div>
  );
}

/* ---------- Metas ---------- */
function GoalCard({ g }) {
  const d = useApp();
  const m = useMoneyText();
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState(0);
  const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
  const monthsLeft = g.due ? Math.max(1, (Number(g.due.slice(0, 4)) - Number(todayISO().slice(0, 4))) * 12 + Number(g.due.slice(5, 7)) - Number(todayISO().slice(5, 7))) : null;
  const perMonth = monthsLeft && g.saved < g.target ? Math.ceil((g.target - g.saved) / monthsLeft) : 0;
  return (
    <li className="glass rise rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink/[0.06] text-ink"><Icon name={g.icon} size={20} /></span>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => d.openModal({ kind: 'goal', initial: g })}>
          <p className="truncate text-[15px] font-extrabold tracking-[-0.02em]">{g.name}</p>
          <p className="text-xs text-ink/65">{g.due ? `até ${fmtDate(g.due)}` : 'sem prazo'}</p>
        </button>
        <span className="badge-gold">{pct}%</span>
      </div>
      <div className="track mt-4"><i style={{ width: `${pct}%` }} /></div>
      <p className="mt-2 flex justify-between text-xs tabular-nums text-ink/70"><span><b className="font-bold text-ink">{m(g.saved)}</b> guardados</span><span>meta {m(g.target)}</span></p>
      {perMonth > 0 && <p className="mt-2 text-xs text-ink/65">Guardando {m(perMonth)} por mês você chega lá no prazo.</p>}
      {adding ? (
        <form className="mt-4 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (val > 0 && await d.saveGoal(g, { saved: g.saved + val })) { setVal(0); setAdding(false); } }}>
          <MoneyInput id={`goal-add-${g.id}`} label={`Valor para ${g.name}`} cents={val} onChange={setVal} className="!rounded-full !py-2 text-sm font-bold" />
          <button type="submit" className="btn btn-primary !px-4 !py-2 text-[13px]" disabled={val <= 0}>Guardar</button>
          <button type="button" className="icon-btn size-10 shrink-0" aria-label="Cancelar" onClick={() => setAdding(false)}><Icon name="x" size={16} /></button>
        </form>
      ) : (
        <div className="mt-4 flex justify-end"><button type="button" className="btn btn-ghost !px-3.5 !py-2 text-[13px]" onClick={() => setAdding(true)}><Icon name="plus" size={15} />Guardar valor</button></div>
      )}
    </li>
  );
}

function GoalsPage() {
  const d = useApp();
  const narrow = useNarrow();
  return (
    <div className="space-y-5">
      {!narrow && <PageHeader eyebrow="Metas" title="Seus objetivos">
        <button type="button" className="btn btn-primary" onClick={() => d.openModal({ kind: 'goal' })}><Icon name="plus" size={18} strokeWidth={2.4} />Nova meta</button>
      </PageHeader>}
      {d.goals.length === 0 ? (
        <Card><EmptyState icon="target" title="Nenhuma meta ainda" text="Reserva de emergência, viagem, um carro novo… Defina quanto quer juntar e até quando, e acompanhe o progresso."
          action={<button type="button" className="btn btn-primary" onClick={() => d.openModal({ kind: 'goal' })}><Icon name="plus" size={16} />Criar meta</button>} /></Card>
      ) : (
        <>
          {narrow && <button type="button" className="btn btn-primary w-full" onClick={() => d.openModal({ kind: 'goal' })}><Icon name="plus" size={16} />Nova meta</button>}
          <ul className={`grid gap-4 ${narrow ? '' : 'md:grid-cols-2 2xl:grid-cols-3'}`}>{d.goals.map((g) => <GoalCard key={g.id} g={g} />)}</ul>
        </>
      )}
    </div>
  );
}

/* ---------- Categorias ---------- */
function CategoriesPage() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const [kind, setKind] = useState('out');
  const month = d.month;
  const stats = useMemo(() => {
    const o = {};
    d.transactions.forEach((t) => {
      if (!t.category_id) return;
      const s = o[t.category_id] || (o[t.category_id] = { count: 0, month: 0 });
      s.count += 1;
      if (monthKey(t.date) === month && (countsAsExpense(t) || countsAsIncome(t))) s.month += t.amount;
    });
    return o;
  }, [d.transactions, month]);
  const list = d.categories.filter((c) => c.kind === kind);
  return (
    <div className="space-y-5">
      {!narrow && <PageHeader eyebrow="Categorias" title="Categorias e orçamentos"><MonthSwitch month={month} onChange={d.setMonth} /></PageHeader>}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented size="sm" label="Tipo" value={kind} onChange={setKind} options={[{ value: 'out', label: `Despesas (${d.categories.filter((c) => c.kind === 'out').length})` }, { value: 'in', label: `Receitas (${d.categories.filter((c) => c.kind === 'in').length})` }]} />
          <button type="button" className="btn btn-primary !py-2.5 text-[13px]" onClick={() => d.openModal({ kind: 'category', initialKind: kind })}><Icon name="plus" size={16} strokeWidth={2.4} />Nova categoria</button>
        </div>
        <ul className={`mt-5 grid gap-3 ${narrow ? '' : 'md:grid-cols-2 2xl:grid-cols-3'}`}>
          {list.map((c) => {
            const s = stats[c.id] || { count: 0, month: 0 };
            const pct = c.budget ? Math.round((s.month / c.budget) * 100) : null;
            const state = pct == null ? '' : pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
            return (
              <li key={c.id} className="glass rounded-3xl p-4">
                <div className="flex items-center gap-3">
                  <ColorIcon icon={c.icon} color={c.color} size={42} />
                  <div className="min-w-0 flex-1"><p className="truncate text-[14.5px] font-extrabold">{c.name}</p><p className="truncate text-xs text-ink/65">{plural(s.count, 'transação', 'transações')} · {m(s.month)} em {monthName(month).toLowerCase()}</p></div>
                  <button type="button" className="icon-btn size-9 shrink-0" aria-label={`Editar ${c.name}`} onClick={() => d.openModal({ kind: 'category', initial: c })}><Icon name="edit" size={15} /></button>
                </div>
                {c.kind === 'out' && (pct == null ? (
                  <button type="button" onClick={() => d.openModal({ kind: 'category', initial: c })} className="mt-3 w-full rounded-xl border border-dashed border-ink/15 py-2 text-xs font-semibold text-ink/65 hover:bg-ink/[0.03]">Definir orçamento mensal</button>
                ) : (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs tabular-nums text-ink/70"><span>Orçamento {m(c.budget)}</span><b className={state === 'over' ? 'text-out' : 'text-ink'}>{pct}%</b></div>
                    <div className="track mt-1.5"><i className={state} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
