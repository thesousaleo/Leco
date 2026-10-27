/* =====================================================================
   57-planning: Planejamento (planejado × realizado, projeção de saldo,
   reserva de emergência, assinaturas, alertas inteligentes), Dívidas,
   Modelos de lançamento e Conquistas.
   ===================================================================== */

function NeedsV3({ what }) {
  return (
    <Card>
      <EmptyState icon="rocket" title="Falta atualizar o banco" text={`${what} precisa da atualização do banco do Leco 3. Rode o arquivo supabase/v3.sql no Supabase (SQL Editor) e abra o app de novo.`} />
    </Card>
  );
}

function PlanRow({ c, plan, spent, onSave }) {
  const m = useMoneyText();
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(plan);
  useEffect(() => setVal(plan), [plan]);
  const pct = plan > 0 ? Math.round((spent / plan) * 100) : 0;
  const state = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <ColorIcon icon={c.icon} color={c.color} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold">{c.name}</p>
          <p className="truncate text-xs tabular-nums text-ink/65">{m(spent)} {plan > 0 ? `de ${m(plan)}` : 'sem planejamento'}{plan > 0 && spent < plan ? ` · restam ${m(plan - spent)}` : plan > 0 && spent > plan ? ` · ${m(spent - plan)} acima` : ''}</p>
        </div>
        {edit ? (
          <form className="flex shrink-0 items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); onSave(val); setEdit(false); }}>
            <MoneyInput label={`Planejado para ${c.name}`} cents={val} onChange={setVal} className="!w-[118px] !rounded-full !py-1.5 text-[13px] font-bold" />
            <button type="submit" className="icon-btn size-9" aria-label="Salvar"><Icon name="check" size={15} /></button>
          </form>
        ) : <button type="button" className="shrink-0 rounded-full border border-ink/10 px-3 py-1.5 text-[12px] font-bold" onClick={() => setEdit(true)}>{plan > 0 ? 'Editar' : 'Planejar'}</button>}
      </div>
      {plan > 0 && <div className="track mt-2"><i className={state} style={{ width: `${Math.min(100, pct)}%` }} /></div>}
    </li>
  );
}

function PlanningPage() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const theme = useContext(ThemeCtx);
  const P = PALETTES[theme];
  const today = todayISO();
  const [month, setMonth] = useState(finMonthOf(today));
  const [from, to] = finRange(month);
  const sm = periodSummary(d.transactions, from, to, d.categories);
  const plans = (d.plans || []).filter((p) => p.month === month);
  const planOf = (c) => { const p = plans.find((x) => x.category_id === c.id); return p ? p.amount : c.kind === 'out' ? c.budget || 0 : 0; };
  const spentOf = (c) => {
    const ids = [c.id, ...d.categories.filter((x) => x.parent_id === c.id).map((x) => x.id)];
    return sum((c.kind === 'out' ? sm.expenseTx : sm.incomeTx).filter((t) => ids.includes(t.category_id)), (t) => t.amount);
  };
  const outCats = d.categories.filter((c) => c.kind === 'out' && !c.archived && !c.parent_id);
  const inCats = d.categories.filter((c) => c.kind === 'in' && !c.archived && !c.parent_id);
  const planOut = sum(outCats, planOf);
  const planIn = sum(inCats, planOf) || sum(d.recurrings.filter((r) => r.active && r.kind === 'in' && r.frequency === 'monthly'), (r) => r.amount);
  const isCur = month === finMonthOf(today);
  const daysLeft = isCur ? Math.max(1, diffDays(to, today) + 1) : 0;
  const plannedSpent = sum(outCats.filter((c) => planOf(c) > 0), spentOf);
  const leftToSpend = planOut - plannedSpent;
  const perDay = isCur && leftToSpend > 0 ? Math.floor(leftToSpend / daysLeft) : 0;
  const proj = useMemo(() => projectBalance(d, 90), [d.transactions, d.recurrings, d.cards, d.debts, d.accounts]);
  const weekly = proj.points.filter((_, i) => i % 7 === 0 || i === proj.points.length - 1);
  const reserve = sum(d.accounts.filter((a) => a.is_reserve && !a.archived), (a) => d.balances[a.id] || 0);
  const avg = avgMonthlyExpense(d);
  const months = avg ? reserve / avg : 0;
  const subs = subscriptionsOf(d);
  const insights = useMemo(() => smartInsights(d), [d.transactions, d.recurrings]);
  const [hidden, setHidden] = useLocal('leco.hiddenInsights', []);
  const save = (c, v) => d.savePlan(month, c.id, v);
  if (!d.v3) return <div className="space-y-5">{!narrow && <PageHeader eyebrow="Planejamento" title="Planeje o mês" />}<NeedsV3 what="O planejamento" /></div>;

  return (
    <div className="space-y-5">
      {!narrow && <PageHeader eyebrow="Planejamento" title={`Planeje ${monthLabel(month).toLowerCase()}`}><button type="button" className="btn btn-ghost" onClick={() => d.go('simulador')}><Icon name="sparkle" size={16} />Simular "E se…?"</button><MonthSwitch month={month} onChange={setMonth} /></PageHeader>}
      {narrow && <MonthSwitch full month={month} onChange={setMonth} />}
      {narrow && <button type="button" className="btn btn-ghost w-full" onClick={() => d.go('simulador')}><Icon name="sparkle" size={16} />Simular "E se…?"</button>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="Planejado × realizado" sub={finLabel(month)} action={<button type="button" className="btn btn-ghost !py-2 text-[12.5px]" onClick={() => d.copyPlans(shiftMonth(month, -1), month)}><Icon name="copy" size={14} />Copiar mês anterior</button>}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-vivo/10 px-3 py-2.5"><p className="text-[10.5px] font-bold uppercase tracking-wider text-in">Receita prevista</p><p className="truncate text-[15px] font-extrabold tabular-nums text-in">{m(planIn)}</p><p className="text-[11px] text-ink/60">recebido {m(sm.income)}</p></div>
            <div className="rounded-2xl bg-coral/10 px-3 py-2.5"><p className="text-[10.5px] font-bold uppercase tracking-wider text-out">Gastos planejados</p><p className="truncate text-[15px] font-extrabold tabular-nums text-out">{m(planOut)}</p><p className="text-[11px] text-ink/60">gasto {m(plannedSpent)}</p></div>
            <div className="col-span-2 rounded-2xl bg-ink/[0.05] px-3 py-2.5 sm:col-span-1">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink/70">{isCur ? 'Pode gastar por dia' : 'Sobra planejada'}</p>
              <p className={`truncate text-[15px] font-extrabold tabular-nums ${leftToSpend < 0 ? 'text-out' : ''}`}>{isCur ? (leftToSpend > 0 ? m(perDay) : 'Limite atingido') : m(planIn - planOut)}</p>
              <p className="text-[11px] text-ink/60">{isCur ? `${plural(daysLeft, 'dia', 'dias')} até o fim do mês` : `${m(planIn)} − ${m(planOut)}`}</p>
            </div>
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-ink/55">Despesas</p>
          <ul className="divide-y divide-ink/[0.07]">{outCats.map((c) => <PlanRow key={c.id} c={c} plan={planOf(c)} spent={spentOf(c)} onSave={(v) => save(c, v)} />)}</ul>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-ink/55">Receitas</p>
          <ul className="divide-y divide-ink/[0.07]">{inCats.map((c) => <PlanRow key={c.id} c={c} plan={planOf(c)} spent={spentOf(c)} onSave={(v) => save(c, v)} />)}</ul>
        </Card>
        <div className="space-y-5">
          <Card title="Projeção de saldo" sub="Próximos 90 dias, contando o que vence, recorrências, faturas e dívidas">
            <AreaChart height={narrow ? 190 : 220} zeroBase={false} label="Projeção do saldo nos próximos 90 dias"
              points={weekly.map((p, i) => ({ k: p.date, short: i % (narrow ? 3 : 2) === 0 ? fmtDate(p.date).slice(0, 5) : '', full: fmtDate(p.date) }))}
              series={[{ key: 'bal', label: 'Saldo previsto', color: P.in, values: weekly.map((p) => p.value) }]} />
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
              <div className="rounded-2xl bg-ink/[0.04] px-3 py-2"><p className="text-ink/65">Em 90 dias</p><p className={`font-extrabold tabular-nums ${proj.end < 0 ? 'text-out' : ''}`}>{m(proj.end)}</p></div>
              <div className={`rounded-2xl px-3 py-2 ${proj.min.value < 0 ? 'bg-coral/10' : 'bg-ink/[0.04]'}`}><p className="text-ink/65">Ponto mais baixo</p><p className={`font-extrabold tabular-nums ${proj.min.value < 0 ? 'text-out' : ''}`}>{m(proj.min.value)} · {fmtDate(proj.min.date).slice(0, 5)}</p></div>
            </div>
            {proj.min.value < 0 && <p className="mt-2 text-xs font-semibold text-out">Atenção: no ritmo atual o saldo fica negativo em {fmtDate(proj.min.date)}.</p>}
          </Card>
          <Card title="Reserva de emergência" sub="Ideal: de 3 a 6 meses dos seus gastos">
            {d.accounts.some((a) => a.is_reserve) ? (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div><p className="text-[26px] font-extrabold tracking-[-0.02em] tabular-nums">{m(reserve)}</p><p className="text-xs text-ink/65">{avg ? `cobre ${months.toFixed(1).replace('.', ',')} ${months >= 0.95 && months < 1.05 ? 'mês' : 'meses'} de gastos (média ${m(avg)}/mês)` : 'Registre alguns meses de gastos para calcular.'}</p></div>
                  <span className={months >= 6 ? 'pill pill-good' : months >= 3 ? 'badge-gold' : 'pill pill-bad'}>{months >= 6 ? 'Completa' : months >= 3 ? 'Boa' : 'Em construção'}</span>
                </div>
                <div className="track mt-3"><i style={{ width: `${Math.min(100, (months / 6) * 100)}%` }} /></div>
                {avg > 0 && months < 6 && <p className="mt-2 text-xs text-ink/65">Faltam {m(Math.max(0, avg * 6 - reserve))} para 6 meses.</p>}
              </>
            ) : <p className="text-sm leading-relaxed text-ink/70">Marque a conta onde fica sua reserva como "Reserva de emergência" (Contas › editar conta).</p>}
          </Card>
          <Card title="Assinaturas e gastos fixos" sub={`${m(subs.monthly)} por mês · ${m(subs.yearly)} por ano`}>
            {subs.list.length === 0 ? <p className="text-sm text-ink/65">Nenhuma recorrência de despesa cadastrada.</p> : (
              <ul className="divide-y divide-ink/[0.07]">
                {subs.list.slice(0, 8).map(({ r, monthly }) => {
                  const c = d.categories.find((x) => x.id === r.category_id);
                  return (
                    <li key={r.id} className={`flex items-center gap-3 py-2.5 ${r.active ? '' : 'opacity-50'}`}>
                      <ColorIcon icon={c ? c.icon : 'repeat'} color={c ? c.color : '#8C7AB8'} size={34} />
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => d.openModal({ kind: 'recurring', initial: r })}><p className="truncate text-[13.5px] font-bold">{r.description}</p><p className="text-xs text-ink/60">{FREQ[r.frequency]}{r.active ? '' : ' · pausada'}</p></button>
                      <span className="text-right"><span className="block text-[13px] font-extrabold tabular-nums">{m(monthly)}/mês</span><span className="block text-[11px] tabular-nums text-ink/55">{m(monthly * 12)}/ano</span></span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
      {insights.filter((x) => !hidden.includes(x.id)).length > 0 && (
        <Card title="Alertas inteligentes" sub="O Leco observa seus lançamentos e avisa o que merece atenção">
          <ul className="grid gap-2 md:grid-cols-2">
            {insights.filter((x) => !hidden.includes(x.id)).map((x) => (
              <li key={x.id} className={`flex items-start gap-3 rounded-2xl px-3.5 py-3 ${x.tone === 'bad' ? 'bg-coral/10' : x.tone === 'gold' ? 'bg-attn' : 'bg-ink/[0.04]'}`}>
                <Icon name={x.icon} size={18} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1"><p className="text-[13.5px] font-bold">{x.title}</p><p className="mt-0.5 text-xs leading-relaxed text-ink/75">{x.body}</p>
                  {x.txId && <button type="button" className="mt-1 text-xs font-bold text-in" onClick={() => { const t = d.transactions.find((y) => y.id === x.txId); if (t) d.openModal({ kind: 'tx', initial: t }); }}>Ver lançamento</button>}
                  {x.recId && <button type="button" className="mt-1 text-xs font-bold text-in" onClick={() => { const r = d.recurrings.find((y) => y.id === x.recId); if (r) d.openModal({ kind: 'recurring', initial: r }); }}>Rever assinatura</button>}
                </div>
                <button type="button" aria-label="Dispensar" className="shrink-0 text-ink/50" onClick={() => setHidden([...hidden, x.id])}><Icon name="x" size={15} /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ---------- Dívidas e empréstimos ---------- */
function DebtsPage() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const [show, setShow] = useState('open');
  if (!d.v3) return <div className="space-y-5">{!narrow && <PageHeader eyebrow="Dívidas" title="Dívidas e empréstimos" />}<NeedsV3 what="O controle de dívidas" /></div>;
  const list = (d.debts || []).filter((x) => (show === 'open' ? !x.closed : x.closed));
  const owe = sum((d.debts || []).filter((x) => !x.closed && x.direction === 'owe'), (x) => x.total - x.paid);
  const owed = sum((d.debts || []).filter((x) => !x.closed && x.direction === 'owed'), (x) => x.total - x.paid);
  const today = todayISO();
  return (
    <div className="space-y-5">
      {!narrow && <PageHeader eyebrow="Dívidas" title="Dívidas e empréstimos"><button type="button" className="btn btn-primary" onClick={() => d.openModal({ kind: 'debt' })}><Icon name="plus" size={18} strokeWidth={2.4} />Nova</button></PageHeader>}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-3xl p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-out">Eu devo</p><p className="mt-1 truncate text-[22px] font-extrabold tabular-nums text-out">{m(owe)}</p></div>
        <div className="glass rounded-3xl p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-in">Me devem</p><p className="mt-1 truncate text-[22px] font-extrabold tabular-nums text-in">{m(owed)}</p></div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="w-[230px]"><Segmented size="sm" full label="Mostrar" value={show} onChange={setShow} options={[{ value: 'open', label: 'Em aberto' }, { value: 'closed', label: 'Quitadas' }]} /></div>
        {narrow && <button type="button" className="btn btn-primary !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'debt' })}><Icon name="plus" size={15} />Nova</button>}
      </div>
      {list.length === 0 ? <Card><EmptyState icon="scale" title={show === 'open' ? 'Nenhuma dívida em aberto' : 'Nenhuma dívida quitada ainda'} text="Cadastre empréstimos, financiamentos, parcelamentos com pessoas ou dinheiro que você emprestou." /></Card> : (
        <ul className={`grid gap-4 ${narrow ? 'grid-cols-1' : 'md:grid-cols-2 2xl:grid-cols-3'}`}>
          {list.map((x) => {
            const left = Math.max(0, x.total - x.paid);
            const pct = Math.min(100, Math.round((x.paid / x.total) * 100));
            const instLeft = x.installment_amount ? Math.ceil(left / x.installment_amount) : null;
            const due = x.due_day ? (() => { const k = monthKey(today); const dt = dayIn(k, x.due_day); return dt >= today ? dt : dayIn(shiftMonth(k, 1), x.due_day); })() : null;
            return (
              <li key={x.id} className="glass rise rounded-3xl p-5">
                <div className="flex items-center gap-3">
                  <ColorIcon icon="scale" color={x.direction === 'owe' ? '#D9644A' : '#14806B'} size={42} />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => d.openModal({ kind: 'debt', initial: x })}>
                    <p className="truncate text-[15px] font-extrabold">{x.name}</p>
                    <p className="truncate text-xs text-ink/65">{x.direction === 'owe' ? 'Eu devo' : 'Me devem'}{x.person ? ` · ${x.person}` : ''}{x.interest ? ` · ${String(x.interest).replace('.', ',')}% a.m.` : ''}</p>
                  </button>
                  <span className={x.closed ? 'pill pill-good' : 'badge-gold'}>{pct}%</span>
                </div>
                <div className="track mt-4"><i style={{ width: `${pct}%` }} /></div>
                <p className="mt-2 flex justify-between text-xs tabular-nums text-ink/70"><span><b className="text-ink">{m(x.paid)}</b> {x.direction === 'owe' ? 'pagos' : 'recebidos'}</span><span>falta {m(left)}</span></p>
                {!x.closed && (instLeft || due) && <p className="mt-1 text-xs text-ink/65">{instLeft ? `${plural(instLeft, 'parcela', 'parcelas')} de ${m(x.installment_amount)}` : ''}{instLeft && due ? ' · ' : ''}{due ? `próxima em ${fmtDate(due)}` : ''}</p>}
                {!x.closed && <div className="mt-4 flex justify-end"><button type="button" className="btn btn-ghost !px-3.5 !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'debtPay', debt: x })}><Icon name="check" size={15} />{x.direction === 'owe' ? 'Registrar pagamento' : 'Registrar recebimento'}</button></div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- Modelos de lançamento ---------- */
function TemplatesPage() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  if (!d.v3) return <NeedsV3 what="Os modelos de lançamento" />;
  const list = (d.templates || []).slice().sort((a, b) => b.uses - a.uses);
  return (
    <div className="space-y-5">
      {!narrow && <PageHeader eyebrow="Modelos" title="Modelos de lançamento"><button type="button" className="btn btn-primary" onClick={() => d.openModal({ kind: 'template' })}><Icon name="plus" size={18} />Novo modelo</button></PageHeader>}
      <Card sub="Gastos frequentes viram atalhos de um toque no topo de Nova transação. Você também pode salvar um modelo pela estrela ★ ao lançar.">
        {narrow && <button type="button" className="btn btn-primary mb-3 w-full" onClick={() => d.openModal({ kind: 'template' })}><Icon name="plus" size={16} />Novo modelo</button>}
        {list.length === 0 ? <EmptyState icon="star" title="Nenhum modelo" text="Ex.: Almoço R$ 35, Uber, Café, Mercado da semana." /> : (
          <ul className="divide-y divide-ink/[0.07]">
            {list.map((t) => {
              const c = d.categories.find((x) => x.id === t.category_id);
              return (
                <li key={t.id}><button type="button" className="flex w-full items-center gap-3 py-3 text-left" onClick={() => d.openModal({ kind: 'template', initial: t })}>
                  <ColorIcon icon={c ? c.icon : 'star'} color={c ? c.color : '#5E8CA6'} size={38} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-bold">{t.name}</span><span className="block truncate text-xs text-ink/60">{c ? c.name : 'Sem categoria'} · usado {plural(t.uses || 0, 'vez', 'vezes')}</span></span>
                  {t.amount > 0 && <span className={`text-[13.5px] font-extrabold tabular-nums ${t.kind === 'in' ? 'text-in' : 'text-out'}`}>{m(t.amount)}</span>}
                </button></li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------- Conquistas ---------- */
function AchievementsPage() {
  const d = useApp();
  const narrow = useNarrow();
  const got = useMemo(() => achievementsOf(d), [d.transactions, d.goals, d.debts, d.plans, d.accounts]);
  const n = ACHIEVEMENTS.filter((a) => got[a.id]).length;
  return (
    <div className="space-y-5">
      {!narrow && <PageHeader eyebrow="Conquistas" title={`${n} de ${ACHIEVEMENTS.length} conquistas`} />}
      <div className="glass-hero rounded-3xl p-5">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-ink/75">Seu progresso</p>
        <p className="mt-1 text-[28px] font-extrabold tracking-[-0.02em]">{n} de {ACHIEVEMENTS.length}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#9BEBD0]" style={{ width: `${(n / ACHIEVEMENTS.length) * 100}%` }} /></div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ACHIEVEMENTS.map((a) => (
          <li key={a.id} className={`glass flex items-center gap-3 rounded-3xl p-4 ${got[a.id] ? '' : 'opacity-50 grayscale'}`}>
            <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${got[a.id] ? 'bg-gradient-to-br from-vivo to-leco text-white' : 'bg-ink/[0.06] text-ink/60'}`}><Icon name={a.icon} size={22} /></span>
            <span className="min-w-0"><span className="block text-[14px] font-extrabold">{a.title}</span><span className="block text-xs text-ink/65">{a.desc}</span></span>
            {got[a.id] && <Icon name="check" size={18} className="ml-auto shrink-0 text-in" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Avisa quando uma conquista nova é desbloqueada
function useAchievementToasts(d) {
  const [seen, setSeen] = useLocal('leco.achSeen', null);
  useEffect(() => {
    if (!d) return;
    const got = achievementsOf(d);
    const ids = Object.keys(got);
    if (seen === null) { setSeen(ids); return; }
    const fresh = ids.filter((id) => !seen.includes(id));
    if (fresh.length) {
      const a = ACHIEVEMENTS.find((x) => x.id === fresh[0]);
      if (a) { d.toast(`🏆 Conquista: ${a.title}`); haptic('success'); }
      setSeen([...seen, ...fresh]);
    }
  }, [d && d.transactions.length, d && d.goals, d && d.debts]);
}
