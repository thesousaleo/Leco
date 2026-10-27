/* =====================================================================
   68-clean: visual alternativo "Leco Clean" (site paralelo em /novo/).
   Mesmo motor, mesmos dados e mesmas funções; só muda a aparência:
   fundo neutro, cartões brancos com borda fina, menu lateral com grupos,
   topo com título e busca, cartões de resumo, fluxo de caixa semanal,
   tabela de transações e Quadro de orçamento.
   ===================================================================== */
const SKIN = window.LECO_SKIN || (/[?&]skin=clean/.test(window.location.search) ? 'clean' : 'glass');
const CLEAN = SKIN === 'clean';
if (CLEAN) document.documentElement.dataset.skin = 'clean';

function CleanMark({ size = 32 }) {
  return <span className="cl-mark grid shrink-0 place-items-center rounded-[9px] font-extrabold" style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }} aria-hidden="true">L</span>;
}
function initialsOf(s) {
  const parts = String(s || '?').replace(/@.*/, '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/* ---------- Menu lateral ---------- */
function CleanNavItem({ icon, label, on, onClick, count, dot, sub, collapsed, chevron, open }) {
  return (
    <button type="button" onClick={onClick} aria-current={on ? 'page' : undefined} aria-expanded={chevron ? !!open : undefined} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}
      className={`cl-nav relative flex w-full items-center gap-3 rounded-[10px] text-left transition-colors ${collapsed ? 'justify-center px-0 py-2.5' : sub ? 'py-[7px] pl-[46px] pr-3 text-[14px]' : 'px-3 py-[9px] text-[14.5px]'} ${on ? 'cl-nav-on' : sub ? 'text-ink/55 hover:text-ink' : 'text-ink/70 hover:text-ink'}`}>
      {icon && <Icon name={icon} size={18} strokeWidth={1.8} className="shrink-0" />}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && count > 0 && <span className="cl-count">{count}</span>}
      {dot && <span className={`size-2 shrink-0 rounded-full bg-[#DC2626] ${collapsed ? 'absolute right-2 top-2' : ''}`} aria-label="atenção" />}
      {!collapsed && chevron && <Icon name={open ? 'chevUp' : 'chevDown'} size={15} className="shrink-0 text-ink/40" />}
    </button>
  );
}

function CleanSidebar({ collapsed, setCollapsed, drawer = false, onClose }) {
  const d = useApp();
  const today = todayISO();
  const pre = d.txPreset || {};
  const onTx = d.page === 'transacoes';
  const [from, to] = finRange(d.month);
  const monthCount = d.transactions.filter((t) => t.date >= from && t.date <= to).length;
  const pendingCount = d.transactions.filter((t) => !t.paid && !t.card_id && (t.kind === 'out' || t.kind === 'in') && t.date <= addDays(today, 7)).length;
  const urgent = d.alerts.some((a) => a.tone === 'bad');
  const hasBen = d.v4 || d.accounts.some(isBenefit);
  const [groups, setGroups] = useLocal('leco.clean.groups', { tx: true, plan: true });
  const toggle = (k) => setGroups({ ...groups, [k]: !groups[k] });
  const planPages = ['planejamento', 'recorrentes', 'metas', 'dividas', 'categorias', 'modelos'];
  const go = (id) => d.go(id);
  const dark = d.fullTheme !== 'light';
  const sec = (label) => (collapsed || !label ? <div className="mx-3 my-3 border-t border-ink/[0.07]" /> : <p className="cl-sec">{label}</p>);
  return (
    <aside className={`cl-side flex flex-col ${drawer ? 'h-full w-full pt-[var(--safe-top)] pb-[var(--safe-bottom)]' : `sticky top-0 h-dvh ${collapsed ? 'w-[76px]' : 'w-[268px]'}`}`}>
      <div className={`flex h-[68px] shrink-0 items-center gap-3 border-b border-ink/[0.07] ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <CleanMark />
        {!collapsed && <span className="flex-1 text-[19px] font-bold tracking-[-0.02em]">Leco</span>}
        {!collapsed && !drawer && <button type="button" className="cl-iconbtn" aria-label="Recolher menu" onClick={() => setCollapsed(true)}><Icon name="left" size={16} /></button>}
        {drawer && <button type="button" className="cl-iconbtn" aria-label="Fechar menu" onClick={onClose}><Icon name="x" size={16} /></button>}
      </div>
      {collapsed && <div className="flex justify-center pt-3"><button type="button" className="cl-iconbtn" aria-label="Abrir menu" onClick={() => setCollapsed(false)}><Icon name="right" size={16} /></button></div>}
      <nav aria-label="Menu principal" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <CleanNavItem collapsed={collapsed} icon="home" label="Início" on={d.page === 'inicio'} onClick={() => go('inicio')} />
        <CleanNavItem collapsed={collapsed} icon="card" label="Contas e cartões" dot={urgent} on={d.page === 'contas'} onClick={() => go('contas')} />
        <CleanNavItem collapsed={collapsed} icon="list" label="Transações" count={monthCount} on={onTx && !pre.type && !pre.status} chevron open={groups.tx} onClick={() => { if (collapsed) d.goTx({}); else if (onTx && !pre.type && !pre.status) toggle('tx'); else { d.goTx({}); if (!groups.tx) toggle('tx'); } }} />
        {!collapsed && groups.tx && (
          <div className="cl-tree">
            <CleanNavItem sub label="Receitas" on={onTx && pre.type === 'in'} onClick={() => d.goTx({ type: 'in' })} />
            <CleanNavItem sub label="Despesas" on={onTx && pre.type === 'out'} onClick={() => d.goTx({ type: 'out' })} />
            <CleanNavItem sub label="Pendentes" count={pendingCount} on={onTx && pre.status === 'pending'} onClick={() => d.goTx({ status: 'pending', scope: 'all' })} />
          </div>
        )}
        <CleanNavItem collapsed={collapsed} icon="calendar" label="Calendário" on={d.page === 'calendario'} onClick={() => go('calendario')} />
        <CleanNavItem collapsed={collapsed} icon="pie" label="Análises" on={d.page === 'relatorios'} onClick={() => go('relatorios')} />
        {sec(null)}
        <CleanNavItem collapsed={collapsed} icon="layers" label="Planejamento" chevron open={groups.plan} on={collapsed && planPages.includes(d.page)} onClick={() => (collapsed ? go('planejamento') : toggle('plan'))} />
        {!collapsed && groups.plan && (
          <div className="cl-tree">
            <CleanNavItem sub label="Orçamentos" on={d.page === 'planejamento'} onClick={() => go('planejamento')} />
            <CleanNavItem sub label="Recorrentes" on={d.page === 'recorrentes'} onClick={() => go('recorrentes')} />
            <CleanNavItem sub label="Metas" on={d.page === 'metas'} onClick={() => go('metas')} />
            <CleanNavItem sub label="Dívidas" on={d.page === 'dividas'} onClick={() => go('dividas')} />
            {hasBen && <CleanNavItem sub label="Vales (VA/VR)" onClick={() => { go('contas'); setTimeout(() => { const el = document.getElementById('vales'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 350); }} />}
            <CleanNavItem sub label="Categorias" on={d.page === 'categorias'} onClick={() => go('categorias')} />
          </div>
        )}
        {sec(null)}
        <CleanNavItem collapsed={collapsed} icon="help" label="Ajuda e suporte" on={d.page === 'config' && d.settingsSub === 'suporte'} onClick={() => { d.setSettingsSub('suporte'); go('config'); }} />
      </nav>
      <div className="shrink-0 space-y-0.5 border-t border-ink/[0.07] px-3 py-3">
        {collapsed ? (
          <CleanNavItem collapsed icon={dark ? 'sun' : 'moon'} label={dark ? 'Modo claro' : 'Modo escuro'} onClick={() => d.setPrefs({ theme: dark ? 'light' : 'dark' })} />
        ) : (
          <div className="flex items-center gap-3 px-3 py-[9px] text-[14.5px] text-ink/70">
            <Icon name="moon" size={18} strokeWidth={1.8} /><span id="cl-dark-l" className="flex-1">Modo escuro</span>
            <button type="button" role="switch" aria-checked={dark} aria-labelledby="cl-dark-l" className={`switch scale-[.85] ${dark ? 'on' : ''}`} onClick={() => d.setPrefs({ theme: dark ? 'light' : 'dark' })}><span /></button>
          </div>
        )}
        <CleanNavItem collapsed={collapsed} icon="settings" label="Configurações" on={(d.page === 'config' && d.settingsSub !== 'suporte') || d.page === 'mais'} onClick={() => { if (drawer) go('mais'); else { d.setSettingsSub('preferencias'); go('config'); } }} />
      </div>
      <button type="button" onClick={() => { d.setSettingsSub('perfil'); go('config'); }} className={`flex shrink-0 items-center gap-3 border-t border-ink/[0.07] text-left hover:bg-ink/[0.03] ${collapsed ? 'justify-center px-2 py-4' : 'px-5 py-4'}`} aria-label="Seu perfil">
        <span className="cl-avatar grid size-10 shrink-0 place-items-center rounded-xl text-[13px] font-bold">{initialsOf(d.name || d.session.user.email)}</span>
        {!collapsed && <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-semibold">{d.name || 'Sua conta'}</span><span className="block truncate text-[12.5px] text-ink/50">{d.session.user.email}</span></span>}
      </button>
    </aside>
  );
}

/* ---------- Layout (computador) ---------- */
const CLEAN_TITLES = {
  inicio: ['Início', 'Acompanhe suas finanças e seus hábitos de gasto.'], relatorios: ['Análises', 'Para onde vai o seu dinheiro.'], calendario: ['Calendário', 'Tudo o que vence, dia a dia.'],
  transacoes: ['Transações', 'Todos os lançamentos, com filtros e PDF.'], recorrentes: ['Recorrentes', 'Contas fixas, assinaturas e salário.'], contas: ['Contas e cartões', 'Saldos, faturas, limites e vales.'],
  dividas: ['Dívidas', 'O que você deve e o que te devem.'], metas: ['Metas', 'Objetivos de economia.'], planejamento: ['Orçamentos', 'Planejado × realizado no mês.'],
  categorias: ['Categorias', 'Categorias, subcategorias e limites.'], modelos: ['Modelos', 'Atalhos para gastos frequentes.'], conquistas: ['Conquistas', 'Seu progresso no Leco.'], config: ['Configurações', 'Conta, aparência, notificações e dados.'],
};
function CleanWebLayout() {
  const d = useApp();
  const [collapsed, setCollapsed] = useLocal('leco.clean.collapsed', false);
  const Page = d.page === 'inicio' ? CleanOverview : (PAGES[d.page] || PAGES.inicio).C;
  const pre = d.txPreset || {};
  const [title, sub] = CLEAN_TITLES[d.page] || ['Leco', ''];
  const crumb = d.page === 'transacoes' ? (pre.type === 'in' ? 'Receitas' : pre.type === 'out' ? 'Despesas' : pre.status === 'pending' ? 'Pendentes' : null) : d.page === 'config' ? (SETTINGS_TABS.find((t) => t.id === d.settingsSub) || {}).label : null;
  useEffect(() => {
    const k = (e) => { if (e.key === '/' && !/input|textarea|select/i.test((e.target && e.target.tagName) || '') && !document.querySelector('[role=dialog]')) { e.preventDefault(); d.openModal({ kind: 'search' }); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div className="cl-shell flex min-h-dvh">
      <CleanSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="min-w-0 flex-1">
        <header className="cl-top sticky top-0 z-30 flex h-[68px] items-center gap-3 px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <h1 className="shrink-0 text-[16px] font-semibold">{title}{crumb ? <span className="font-normal text-ink/45"> › {crumb}</span> : null}</h1>
            <span className="hidden h-4 w-px bg-ink/15 lg:block" />
            <p className="hidden truncate text-[14px] text-ink/50 lg:block">{sub}</p>
          </div>
          <button type="button" className="cl-search hidden w-[300px] items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[14px] text-ink/45 xl:flex" onClick={() => d.openModal({ kind: 'search' })}><Icon name="search" size={16} />Buscar…<kbd className="ml-auto rounded-md border border-ink/10 px-1.5 text-[11px]">/</kbd></button>
          <button type="button" className="icon-btn size-10 xl:hidden" aria-label="Buscar" onClick={() => d.openModal({ kind: 'search' })}><Icon name="search" size={18} /></button>
          <button type="button" className="icon-btn size-10" onClick={() => d.saveProfile({ hide_values: !d.hide })} aria-label={d.hide ? 'Mostrar valores' : 'Ocultar valores'} aria-pressed={d.hide}><Icon name={d.hide ? 'eyeOff' : 'eye'} size={18} /></button>
          <NotifButton />
          <button type="button" className="btn btn-primary !py-2.5" onClick={() => d.openModal({ kind: 'tx' })}><Icon name="plus" size={17} strokeWidth={2.4} />Nova transação</button>
        </header>
        <main className="mx-auto w-full max-w-[1320px] px-8 pb-10 pt-7">
          <UpdateBanner />
          <PageTip id={d.page} />
          <div key={`${d.page}-${d.settingsSub}-${pre.key || ''}`} className="rise"><Page /></div>
          <p className="pt-8 text-center text-[11px] text-ink/40">Leco {APP_VERSION} · visual Clean · mesmos dados do Leco</p>
        </main>
      </div>
    </div>
  );
}

/* ---------- Início ---------- */
function CleanKpi({ label, icon, value, delta, goodWhen, note, tone, narrow }) {
  return (
    <div className={`cl-card min-w-0 ${narrow ? 'p-3.5' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[14px] text-ink/60">{label}</p>
        {!narrow && <span className="cl-iconbox"><Icon name={icon} size={16} /></span>}
      </div>
      <p className={`cl-num truncate font-semibold tracking-[-0.02em] ${narrow ? 'mt-2 text-[17px]' : 'mt-4 text-[27px]'} ${tone || ''}`}>{value}</p>
      <p className={`mt-1.5 flex items-center gap-1.5 text-ink/55 ${narrow ? 'text-[11px]' : 'text-[13px]'}`}>
        {delta != null && isFinite(delta) && <span className={`font-semibold ${(goodWhen === 'down' ? delta <= 0 : delta >= 0) ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{delta >= 0 ? '▲' : '▼'} {delta >= 0 ? '+' : '−'}{fmtPctAbs(delta)}</span>}
        {!narrow && <span className="truncate">{note}</span>}
      </p>
    </div>
  );
}

// Totais semanais de receitas e despesas (fluxo de caixa)
function weeklyFlow(txs, from, to) {
  const start = addDays(from, -((weekdayOf(from) + 6) % 7));
  const weeks = [];
  for (let d0 = start; d0 <= to; d0 = addDays(d0, 7)) weeks.push({ k: d0, in: 0, out: 0 });
  txs.forEach((t) => {
    if (t.date < start || t.date > to) return;
    const i = Math.floor(diffDays(t.date, start) / 7);
    if (!weeks[i]) return;
    if (countsAsIncome(t)) weeks[i].in += t.amount;
    else if (countsAsExpense(t)) weeks[i].out += t.amount;
  });
  return weeks;
}

const CLEAN_RANGES = [{ value: '3m', label: 'Últimos 3 meses', months: 3 }, { value: '6m', label: 'Últimos 6 meses', months: 6 }, { value: 'year', label: 'Este ano' }, { value: '12m', label: 'Últimos 12 meses', months: 12 }];

function CleanOverview() {
  const d = useApp();
  const m = useMoneyText();
  const today = todayISO();
  const [range, setRange] = useLocal('leco.clean.range', '3m');
  const R = CLEAN_RANGES.find((r) => r.value === range) || CLEAN_RANGES[1];
  const from = R.value === 'year' ? `${today.slice(0, 4)}-01-01` : finRange(shiftMonth(finMonthOf(today), -(R.months - 1)))[0];
  const to = today;
  const span = diffDays(to, from) + 1;
  const prevTo = addDays(from, -1), prevFrom = addDays(from, -span);
  const cur = periodSummary(d.transactions, from, to, d.categories);
  const prev = periodSummary(d.transactions, prevFrom, prevTo, d.categories);
  const pct = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
  const totalBal = sum(cashAccounts(d.accounts), (a) => d.balances[a.id] || 0);
  const startBal = (() => { const b = accountBalances(d.accounts, d.transactions, addDays(from, -1)); return sum(cashAccounts(d.accounts), (a) => b[a.id] || 0); })();
  const weeks = useMemo(() => weeklyFlow(d.transactions, from, to), [d.transactions, from, to]);
  const theme = useContext(ThemeCtx);
  const [tab, setTab] = useLocal('leco.clean.tab', 'recent');
  const TABS = [{ id: 'recent', l: 'Transações recentes' }, { id: 'board', l: 'Quadro de orçamento' }, { id: 'summary', l: 'Resumo' }, { id: 'goals', l: 'Metas' }];
  const fromLbl = fmtDate(from);
  const narrow = useNarrow();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="cl-select flex items-center gap-2 rounded-[10px] px-3 py-2 text-[14px]">
          <Icon name="calendar" size={16} className="text-ink/50" />
          {!narrow && <span className="text-ink/60">{fromLbl} – {fmtDate(to)}</span>}
          <select aria-label="Período" className="bg-transparent font-semibold outline-none" value={range} onChange={(e) => setRange(e.target.value)}>
            {CLEAN_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-ghost !py-2 text-[13.5px]" onClick={() => d.exportPDF(`leco-resumo-${from}-a-${to}.pdf`, () => { const months = []; for (let k = finMonthOf(from); k <= finMonthOf(to) && months.length < 36; k = shiftMonth(k, 1)) { const s = periodSummary(d.transactions, ...finRange(k), d.categories); months.push({ k, short: monthShort(k), full: monthLabel(k), in: s.income, out: s.expense }); } return summaryPDF({ d, from, to, sm: cur, months, byAccount: [], budgets: budgetsFor(d.categories, d.transactions, finMonthOf(to), d.plans) }); })}><Icon name="download" size={16} />{narrow ? 'PDF' : 'Baixar PDF'}</button>
      </div>

      <div className={`grid ${narrow ? 'grid-cols-2 gap-3' : 'gap-4 sm:grid-cols-2 xl:grid-cols-4'}`}>
        <CleanKpi narrow={narrow} label="Saldo total" icon="wallet" value={m(totalBal)} delta={startBal ? pct(totalBal, startBal) : null} note={`desde ${fromLbl.slice(0, 5)}`} />
        <CleanKpi narrow={narrow} label="Receitas" icon="inArrow" value={m(cur.income)} delta={pct(cur.income, prev.income)} note="vs. período anterior" />
        <CleanKpi narrow={narrow} label="Despesas" icon="up" value={m(cur.expense)} delta={pct(cur.expense, prev.expense)} goodWhen="down" note="vs. período anterior" />
        <CleanKpi narrow={narrow} label="Fluxo líquido" icon="trend" value={m(cur.net)} tone={cur.net < 0 ? 'text-out' : ''} delta={prev.net ? pct(cur.net, prev.net) : null} note={`${fmtPctAbs(cur.rate)} da renda guardada`} />
      </div>

      <section className="cl-card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-[16px] font-semibold">Fluxo de caixa</h2>
          <span className="h-4 w-px bg-ink/15" />
          <span className="text-[14px] text-ink/50">Totais por semana</span>
          <span className="ml-auto flex items-center gap-4 text-[13px] text-ink/65">
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-[var(--cl-in)]" />Receitas</span>
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-[var(--cl-out)]" />Despesas</span>
          </span>
        </div>
        {weeks.some((w) => w.in || w.out) ? (
          <AreaChart height={narrow ? 210 : 300} label="Fluxo de caixa semanal" points={weeks.map((w) => ({ k: w.k, short: `${fmtDate(w.k).slice(0, 5)}`, full: `Semana de ${fmtDate(w.k)} a ${fmtDate(addDays(w.k, 6))}` }))}
            series={[{ key: 'in', label: 'Receitas', color: theme === 'light' ? '#2563EB' : '#60A5FA', values: weeks.map((w) => w.in) }, { key: 'out', label: 'Despesas', color: theme === 'light' ? '#F97316' : '#FB923C', values: weeks.map((w) => w.out) }]} />
        ) : <EmptyState icon="chart" title="Sem movimentações no período" text="Registre receitas e despesas para ver o fluxo semana a semana." />}
      </section>

      <div>
        <div role="tablist" aria-label="Detalhes" className="cl-tabs flex gap-7 overflow-x-auto">
          {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`cl-tab shrink-0 pb-3 text-[15px] font-medium ${tab === t.id ? 'cl-tab-on text-ink' : 'text-ink/45 hover:text-ink/70'}`}>{t.l}</button>)}
        </div>
        <div className="pt-5">
          {tab === 'recent' && <RecentTable />}
          {tab === 'board' && <BudgetBoard month={d.month} />}
          {tab === 'summary' && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Card title="Próximos vencimentos" sub="Próximos 30 dias"><UpcomingList /></Card>
              <Card title="Despesas por categoria" sub={`${monthLabel(d.month)}`}><CategoryBreakdown items={periodSummary(d.transactions, ...finRange(d.month), d.categories).byCatOut} donutSize={196} /></Card>
            </div>
          )}
          {tab === 'goals' && <CleanGoals />}
        </div>
      </div>
    </div>
  );
}

const payMethod = (t, d) => {
  if (t.card_id) { const c = d.cards.find((x) => x.id === t.card_id); return `Cartão de crédito${c ? ` · ${c.name}` : ''}`; }
  const a = d.accounts.find((x) => x.id === t.account_id);
  if (!a) return '—';
  if (t.kind === 'transfer') { const b = d.accounts.find((x) => x.id === t.to_account_id); return `Transferência${b ? ` → ${b.name}` : ''}`; }
  return a.name;
};

function RecentTable() {
  const d = useApp();
  const m = useMoneyText();
  const narrow = useNarrow();
  const rows = d.transactions.filter((t) => t.date <= todayISO() && t.kind !== 'card_payment').slice(0, 8);
  const catName = (t) => { const c = d.categories.find((x) => x.id === t.category_id); return t.kind === 'transfer' ? 'Transferência' : c ? c.name : 'Sem categoria'; };
  return (
    <section className="cl-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-[16px] font-semibold">Transações recentes</h2>
        <button type="button" className="btn btn-ghost !py-1.5 text-[13px]" onClick={() => d.goTx({})}>Ver todas<Icon name="right" size={14} /></button>
      </div>
      {rows.length === 0 ? <div className="px-5 pb-5"><EmptyState icon="list" title="Nenhuma transação ainda" text="Use o botão + para registrar." /></div> : narrow ? (
        <ul className="divide-y divide-ink/[0.07] border-t border-ink/[0.07]">
          {rows.map((t) => (
            <li key={t.id}><button type="button" onClick={() => d.openModal({ kind: 'tx', initial: t })} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-medium">{txMeta(t, d).title}</span><span className="block truncate text-[12px] text-ink/50">{fmtDate(t.date).slice(0, 5)} · {catName(t)} · {payMethod(t, d)}</span></span>
              <span className={`cl-num shrink-0 text-[14px] font-medium ${t.kind === 'in' ? 'text-[#16A34A]' : ''}`}>{t.kind === 'in' ? '+' : t.kind === 'transfer' ? '' : '−'}{m(t.amount)}</span>
            </button></li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="cl-table w-full min-w-[720px] text-left text-[14px]">
            <thead><tr><th>Data</th><th>Transação</th><th>Categoria</th><th>Forma de pagamento</th><th className="text-right">Valor</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} tabIndex={0} onClick={() => d.openModal({ kind: 'tx', initial: t })} onKeyDown={(e) => { if (e.key === 'Enter') d.openModal({ kind: 'tx', initial: t }); }} className="cursor-pointer">
                  <td className="whitespace-nowrap text-ink/60">{fmtDate(t.date)}</td>
                  <td className="font-medium">{txMeta(t, d).title}{!t.paid && <span className="cl-pill cl-pill-wait ml-2">{t.kind === 'in' ? 'a receber' : 'a pagar'}</span>}</td>
                  <td className="text-ink/60">{catName(t)}</td>
                  <td className="text-ink/60">{payMethod(t, d)}</td>
                  <td className={`cl-num whitespace-nowrap text-right font-medium ${t.kind === 'in' ? 'text-[#16A34A]' : ''}`}>{t.kind === 'in' ? '+' : t.kind === 'transfer' ? '' : '−'}{m(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Quadro de orçamento: colunas como num quadro de tarefas
function BudgetBoard({ month }) {
  const d = useApp();
  const m = useMoneyText();
  const today = todayISO();
  const [from, to] = finRange(month);
  const inMonth = d.transactions.filter((t) => t.date >= from && t.date <= to && t.kind !== 'transfer' && t.kind !== 'card_payment' && !t.is_adjustment);
  const isFixed = (t) => !!(t.recurring_id || t.group_id || !t.paid);
  const byPending = (a, b) => (a.paid === b.paid ? (a.date < b.date ? -1 : 1) : a.paid ? 1 : -1);
  const cols = [
    { id: 'fixed', title: 'Contas fixas', icon: 'card', list: inMonth.filter((t) => t.kind === 'out' && isFixed(t)).sort(byPending) },
    { id: 'daily', title: 'Gastos do dia a dia', icon: 'bag', list: inMonth.filter((t) => t.kind === 'out' && !isFixed(t)).sort((a, b) => (a.date < b.date ? 1 : -1)) },
    { id: 'in', title: 'Entradas', icon: 'inArrow', list: inMonth.filter((t) => t.kind === 'in').sort(byPending) },
  ];
  const status = (t) => (t.paid ? { l: t.kind === 'in' ? 'Recebido' : 'Pago', c: 'cl-pill-ok' } : t.date < today ? { l: 'Atrasado', c: 'cl-pill-bad' } : { l: t.kind === 'in' ? 'A receber' : 'A pagar', c: 'cl-pill-wait' });
  const code = (t) => `LCO-${String(t.id).replace(/[^0-9a-z]/gi, '').slice(-4).toUpperCase()}`;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><p className="text-[14px] text-ink/55">{monthLabel(month)}</p><MonthSwitch month={month} onChange={d.setMonth} /></div>
      <div className="grid gap-5 lg:grid-cols-3">
        {cols.map((c) => (
          <section key={c.id} aria-label={c.title} className="min-w-0">
            <div className="mb-3 flex items-center gap-2.5 px-1">
              <Icon name={c.icon} size={18} className="text-ink/60" />
              <h3 className="text-[15.5px] font-semibold">{c.title}</h3>
              <span className="cl-count">{c.list.length}</span>
              <span className="cl-num ml-auto text-[13px] font-medium text-ink/50">{m(sum(c.list, (t) => t.amount))}</span>
            </div>
            <div className="space-y-3">
              {c.list.length === 0 && <p className="cl-card px-4 py-6 text-center text-[13px] text-ink/45">Nada aqui neste mês.</p>}
              {c.list.slice(0, 8).map((t) => {
                const meta = txMeta(t, d);
                const st = status(t);
                return (
                  <div key={t.id} role="button" tabIndex={0} onClick={() => d.openModal({ kind: 'tx', initial: t })} onKeyDown={(e) => { if (e.key === 'Enter') d.openModal({ kind: 'tx', initial: t }); }} className="cl-card tap block cursor-pointer p-4 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] tracking-wide text-ink/40">{code(t)}</span>
                      <span className={`cl-pill ${st.c}`}>{st.l}</span>
                    </div>
                    <p className="mt-2 truncate text-[16px] font-semibold">{meta.title}</p>
                    <p className="truncate text-[12.5px] text-ink/45">↳ {meta.sub}</p>
                    <p className={`cl-num mt-2 text-[22px] font-semibold tracking-[-0.02em] ${t.kind === 'in' ? 'text-[#16A34A]' : ''}`}>{t.kind === 'in' ? '+' : '−'}{m(t.amount)}</p>
                    <div className="mt-2 flex items-center justify-between text-[12.5px] text-ink/50">
                      <span className="flex items-center gap-1.5"><Icon name="calendar" size={13} />{t.paid ? 'Em' : 'Vence'} {fmtDate(t.date).slice(0, 5)}</span>
                      {!t.paid && <button type="button" className="font-semibold text-ink hover:underline" onClick={(e) => { e.stopPropagation(); d.confirmTx(t); }}>{t.kind === 'in' ? 'Recebi' : 'Paguei'}</button>}
                    </div>
                  </div>
                );
              })}
              {c.list.length > 8 && <button type="button" className="w-full rounded-xl py-2 text-[13px] font-semibold text-ink/50 hover:text-ink" onClick={() => d.goTx({ type: c.id === 'in' ? 'in' : 'out' })}>Ver mais {c.list.length - 8}</button>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CleanGoals() {
  const d = useApp();
  const m = useMoneyText();
  if (!d.goals.length) return <Card><EmptyState icon="target" title="Nenhuma meta ainda" text="Defina quanto quer juntar e acompanhe aqui." action={<button type="button" className="btn btn-primary" onClick={() => d.openModal({ kind: 'goal' })}><Icon name="plus" size={16} />Nova meta</button>} /></Card>;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {d.goals.map((g) => {
        const p = g.target ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
        return (
          <button key={g.id} type="button" className="cl-card tap p-5 text-left" onClick={() => d.openModal({ kind: 'goal', initial: g })}>
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[15px] font-semibold"><Icon name={g.icon} size={17} />{g.name}</span><span className="cl-pill cl-pill-wait">{p}%</span></div>
            <p className="cl-num mt-3 text-[22px] font-semibold">{m(g.saved)}</p>
            <p className="text-[12.5px] text-ink/50">de {m(g.target)}{g.due ? ` · até ${fmtDate(g.due)}` : ''}</p>
            <div className="track mt-3"><i style={{ width: `${p}%` }} /></div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Layout (celular) ---------- */
function CleanMobileLayout() {
  const d = useApp();
  const page = d.page;
  const pre = d.txPreset || {};
  const [drawer, setDrawerState] = useState(false);
  const setDrawer = (v) => { setDrawerState(v); window.__lecoDrawer = v ? () => setDrawerState(false) : null; };
  useEffect(() => { setDrawer(false); }, [page, pre.key]);
  useEffect(() => () => { window.__lecoDrawer = null; }, []);
  const pull = usePullRefresh(useCallback(async () => { await d.reload(); d.toast('Atualizado'); }, []));
  const Page = page === 'inicio' ? CleanOverview : page === 'mais' ? CleanSettingsList : (PAGES[page] || PAGES.inicio).C;
  const [title] = page === 'mais' ? ['Configurações'] : page === 'config' ? [(SETTINGS_TABS.find((t) => t.id === d.settingsSub) || {}).label] : CLEAN_TITLES[page] || ['Leco'];
  const crumb = page === 'transacoes' ? (pre.type === 'in' ? 'Receitas' : pre.type === 'out' ? 'Despesas' : pre.status === 'pending' ? 'Pendentes' : null) : null;
  const TABS = [{ id: 'inicio', label: 'Início', icon: 'home' }, { id: 'transacoes', label: 'Transações', icon: 'list' }, { id: 'calendario', label: 'Calendário', icon: 'calendar' }, { id: 'relatorios', label: 'Análises', icon: 'pie' }];
  const back = page === 'config' ? () => d.go('mais') : null;
  return (
    <NarrowCtx.Provider value={true}>
      <div className="cl-shell min-h-dvh">
        {pull > 0 && (
          <div className="pointer-events-none fixed inset-x-0 z-50 flex justify-center" style={{ top: `calc(${pull + 30}px + var(--safe-top))` }} aria-hidden="true">
            <span className="cl-card grid size-10 place-items-center rounded-full" style={{ transform: `rotate(${pull * 4}deg)`, opacity: Math.min(1, pull / 60) }}><Icon name="refresh" size={18} /></span>
          </div>
        )}
        <header className="cl-top sticky top-0 z-30 flex items-center gap-2 px-4 pb-2.5 pt-[calc(10px+var(--safe-top))]">
          {back
            ? <button type="button" className="icon-btn size-10" aria-label="Voltar" onClick={back}><Icon name="left" size={18} /></button>
            : <button type="button" className="icon-btn size-10" aria-label="Abrir menu" onClick={() => { haptic(); setDrawer(true); }}><Icon name="menu" size={18} /></button>}
          <h1 className="min-w-0 flex-1 truncate pl-1 text-[17px] font-semibold">{title}{crumb ? <span className="font-normal text-ink/45"> › {crumb}</span> : null}</h1>
          <button type="button" className="icon-btn size-10" onClick={() => d.saveProfile({ hide_values: !d.hide })} aria-label={d.hide ? 'Mostrar valores' : 'Ocultar valores'} aria-pressed={d.hide}><Icon name={d.hide ? 'eyeOff' : 'eye'} size={18} /></button>
          <button type="button" className="icon-btn size-10" aria-label="Buscar" onClick={() => d.openModal({ kind: 'search' })}><Icon name="search" size={18} /></button>
          <NotifButton panelWidth={300} />
        </header>
        <main className="px-4 pb-[calc(150px+var(--safe-bottom))] pt-4" style={pull ? { transform: `translateY(${pull}px)` } : undefined}>
          {(page === 'inicio' || page === 'mais') && <UpdateBanner />}
          {page !== 'mais' && page !== 'config' && <PageTip id={page} />}
          <div key={`${page}-${d.settingsSub}-${pre.key || ''}`} className="rise"><Page /></div>
        </main>
        <nav aria-label="Navegação principal" className="cl-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 px-2 pb-[calc(6px+var(--safe-bottom))] pt-1.5">
          {TABS.map((t) => {
            const on = page === t.id;
            return (
              <button key={t.id} type="button" aria-current={on ? 'page' : undefined} onClick={() => { if (!on) haptic(); if (t.id === 'transacoes') d.goTx({}); else d.go(t.id); }}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-xl py-1.5 text-[10.5px] font-medium ${on ? 'cl-nav-on' : 'text-ink/55'}`}>
                <Icon name={t.icon} size={20} strokeWidth={1.8} /><span className="max-w-full truncate">{t.label}</span>
              </button>
            );
          })}
          <button type="button" onClick={() => { haptic(); setDrawer(true); }} className="flex min-w-0 flex-col items-center gap-1 rounded-xl py-1.5 text-[10.5px] font-medium text-ink/55" aria-label="Mais opções">
            <Icon name="menu" size={20} strokeWidth={1.8} /><span>Mais</span>
          </button>
        </nav>
        {page !== 'mais' && page !== 'config' && (
          <button type="button" className="fab-corner fixed right-[max(16px,var(--safe-right))] bottom-[calc(84px+var(--safe-bottom))] z-40 size-[54px]" onClick={() => { haptic(); d.openModal({ kind: 'tx' }); }} aria-label="Nova transação">
            <Icon name="plus" size={24} strokeWidth={2.6} />
          </button>
        )}
        <div className={`fixed inset-0 z-[60] ${drawer ? '' : 'pointer-events-none'}`} aria-hidden={!drawer}>
          <div className={`absolute inset-0 transition-opacity duration-200 ${drawer ? 'opacity-100' : 'opacity-0'}`} style={{ background: 'var(--scrim)' }} onClick={() => setDrawer(false)} />
          <div role="dialog" aria-modal="true" aria-label="Menu" className={`drawer absolute inset-y-0 left-0 w-[86%] max-w-[320px] shadow-2xl ${drawer ? 'drawer-open' : ''}`}>
            <CleanSidebar drawer onClose={() => setDrawer(false)} />
          </div>
        </div>
      </div>
    </NarrowCtx.Provider>
  );
}

// Lista de configurações (celular)
function CleanSettingsList() {
  const d = useApp();
  return (
    <div className="space-y-4">
      <button type="button" onClick={() => { d.setSettingsSub('perfil'); d.go('config'); }} className="cl-card flex w-full items-center gap-3 p-4 text-left">
        <span className="cl-avatar grid size-12 shrink-0 place-items-center rounded-xl text-[15px] font-bold">{initialsOf(d.name || d.session.user.email)}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[15.5px] font-semibold">{d.name || 'Sua conta'}</span><span className="block truncate text-[12.5px] text-ink/50">{d.session.user.email}</span></span>
        <Icon name="right" size={16} className="text-ink/40" />
      </button>
      <ul className="cl-card divide-y divide-ink/[0.07] px-1">
        {SETTINGS_TABS.filter((it) => it.id !== 'perfil').map((it) => (
          <li key={it.id}><button type="button" onClick={() => { d.setSettingsSub(it.id); d.go('config'); }} className="flex w-full items-center gap-3 px-3 py-3.5 text-left">
            <span className="cl-iconbox"><Icon name={it.icon} size={16} /></span>
            <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-medium">{it.label}</span><span className="block truncate text-[12px] text-ink/50">{it.desc}</span></span>
            <Icon name="right" size={16} className="text-ink/40" />
          </button></li>
        ))}
      </ul>
      <button type="button" className="btn btn-ghost w-full" onClick={d.signOut}><Icon name="logout" size={16} />Sair da conta</button>
      <p className="text-center text-[11px] text-ink/40">Leco {APP_VERSION} · visual Clean · mesmos dados do Leco</p>
    </div>
  );
}
