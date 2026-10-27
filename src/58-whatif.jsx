/* =====================================================================
   Regras automáticas ("Uber → Transporte") e simulador "E se?"
   ===================================================================== */

// Regras ficam nas preferências: [{ id, match, kind, category_id, source }]
function rulesOf(d) { return ((d && d.prefs && d.prefs.rules) || []).filter((r) => r && r.match); }

// A regra que vale para uma descrição: a de texto mais longo que aparece nela
function matchRule(desc, kind, d) {
  const n = ` ${normTxt(desc)} `;
  if (!n.trim()) return null;
  const hits = rulesOf(d).filter((r) => {
    const m = normTxt(r.match);
    if (!m || !n.includes(m)) return false;
    if (r.kind && kind && r.kind !== kind) return false;
    return true;
  });
  hits.sort((a, b) => normTxt(b.match).length - normTxt(a.match).length);
  const r = hits[0];
  if (!r) return null;
  const cat = r.category_id && d.categories.find((c) => c.id === r.category_id && !c.archived);
  return { ...r, category_id: cat ? cat.id : null };
}

// Conta ou cartão da regra, se ainda existir
function ruleSourceOk(src, d, kind) {
  if (!src) return false;
  if (src.startsWith('card:')) return kind === 'out' && d.cards.some((c) => c.id === src.slice(5) && !c.archived);
  return d.accounts.some((a) => a.id === src.slice(4) && !a.archived);
}
function ruleSourceLabel(src, d) {
  if (!src) return '';
  if (src.startsWith('card:')) { const c = d.cards.find((x) => x.id === src.slice(5)); return c ? `${c.name} (crédito)` : ''; }
  const a = d.accounts.find((x) => x.id === src.slice(4)); return a ? a.name : '';
}

// Lançamentos já feitos que a regra alcança (e que estão com outra categoria)
function ruleTargets(rule, d) {
  const m = normTxt(rule.match);
  if (!m || !rule.category_id) return [];
  return d.transactions.filter((t) => (t.kind === 'in' || t.kind === 'out') && (!rule.kind || t.kind === rule.kind) && t.category_id !== rule.category_id && ` ${normTxt(t.description)} `.includes(m));
}

// Sugestões: descrições que se repetem sempre na mesma categoria e ainda não têm regra
function ruleSuggestions(d) {
  const groups = {};
  d.transactions.forEach((t) => {
    if ((t.kind !== 'in' && t.kind !== 'out') || !t.category_id) return;
    const w = normTxt(t.description).split(' ').filter((x) => x.length > 2)[0];
    if (!w || /^(pix|compra|pagamento|parcela|transferencia|debito|credito|conta|fatura|boleto|ted|doc)$/.test(w)) return;
    const g = groups[`${t.kind}|${w}`] || (groups[`${t.kind}|${w}`] = { kind: t.kind, word: w, n: 0, cats: {} });
    g.n++; g.cats[t.category_id] = (g.cats[t.category_id] || 0) + 1;
  });
  const have = rulesOf(d).map((r) => normTxt(r.match));
  return Object.values(groups).map((g) => {
    const [cat, n] = Object.entries(g.cats).sort((a, b) => b[1] - a[1])[0];
    return { ...g, category_id: cat, share: n / g.n };
  }).filter((g) => g.n >= 2 && g.share >= 0.8 && !have.some((h) => h.includes(g.word) || g.word.includes(h)) && d.categories.some((c) => c.id === g.category_id && !c.archived))
    .sort((a, b) => b.n - a.n).slice(0, 5);
}

function CategorySelect({ id, value, onChange, kind, d, allowEmpty }) {
  const group = (k) => d.categories.filter((c) => c.kind === k && !c.archived && !c.parent_id);
  const subs = (p) => d.categories.filter((c) => c.parent_id === p.id && !c.archived);
  const opts = (k) => group(k).flatMap((c) => [<option key={c.id} value={c.id}>{c.name}</option>, ...subs(c).map((s) => <option key={s.id} value={s.id}>{`  ${c.name} › ${s.name}`}</option>)]);
  return (
    <select id={id} className="field" value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      {allowEmpty && <option value="">Escolha a categoria</option>}
      {(!kind || kind === 'out') && <optgroup label="Despesas">{opts('out')}</optgroup>}
      {(!kind || kind === 'in') && <optgroup label="Receitas">{opts('in')}</optgroup>}
    </select>
  );
}

function RulesSettings() {
  const d = useApp();
  const rules = rulesOf(d);
  const [match, setMatch] = useState('');
  const [cat, setCat] = useState(null);
  const [src, setSrc] = useState('');
  const [busy, setBusy] = useState(false);
  const catObj = d.categories.find((c) => c.id === cat);
  const kind = catObj ? catObj.kind : null;
  const save = (list) => d.setPrefs({ rules: list });
  const add = (r) => {
    const m = String(r.match || '').trim();
    if (!m) { d.toast('Escreva a palavra que aparece na descrição.', null, true); return false; }
    if (!r.category_id) { d.toast('Escolha a categoria.', null, true); return false; }
    const k = (d.categories.find((c) => c.id === r.category_id) || {}).kind || null;
    const rest = rules.filter((x) => normTxt(x.match) !== normTxt(m) || (x.kind && k && x.kind !== k));
    save([{ id: uid(), match: m.slice(0, 40), kind: k, category_id: r.category_id, source: r.source && ruleSourceOk(r.source, d, k) ? r.source : null }, ...rest]);
    d.toast(`Regra criada: "${m}" → ${(d.categories.find((c) => c.id === r.category_id) || {}).name || ''}`);
    return true;
  };
  const submit = (e) => { e.preventDefault(); if (add({ match, category_id: cat, source: src })) { setMatch(''); setSrc(''); } };
  const remove = (r) => { save(rules.filter((x) => x.id !== r.id)); d.toast('Regra excluída'); };
  const apply = async (r, targets) => {
    setBusy(true);
    try { await d.bulkTx(targets.map((t) => t.id), { category_id: r.category_id }, `${plural(targets.length, 'lançamento atualizado', 'lançamentos atualizados')}`); }
    finally { setBusy(false); }
  };
  const sugg = ruleSuggestions(d);
  const activeAcc = d.accounts.filter((a) => !a.archived);
  const activeCards = d.cards.filter((c) => !c.archived);
  return (
    <div className="space-y-5">
      <p className="rounded-2xl bg-vivo/10 px-4 py-3 text-[13px] leading-relaxed text-ink/80">
        Ensine o Leco a preencher sozinho. Quando a descrição tiver a palavra da regra, a categoria (e, se quiser, a conta ou o cartão) é escolhida automaticamente, ao lançar, no lançamento rápido, na leitura de comprovante e ao importar extrato.
      </p>

      <Panel title="Nova regra" sub='Ex.: quando tiver "Uber", usar Transporte. Quando tiver "iFood", usar Alimentação no cartão.'>
        <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Quando a descrição tiver"><input id="rule-match" className="field" value={match} maxLength={40} onChange={(e) => setMatch(e.target.value)} placeholder="Ex.: Uber" /></Field>
          <Field label="Usar a categoria"><CategorySelect id="rule-cat" value={cat} onChange={setCat} d={d} allowEmpty /></Field>
          <Field label="Pagar com (opcional)" className="sm:col-span-2">
            <select id="rule-src" className="field" value={src} onChange={(e) => setSrc(e.target.value)}>
              <option value="">Não mudar a conta</option>
              {activeAcc.length > 0 && <optgroup label="Contas">{activeAcc.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}</optgroup>}
              {kind !== 'in' && activeCards.length > 0 && <optgroup label="Cartões de crédito">{activeCards.map((c) => <option key={c.id} value={`card:${c.id}`}>{c.name}</option>)}</optgroup>}
            </select>
          </Field>
          <div className="sm:col-span-2"><button type="submit" className="btn btn-primary"><Icon name="plus" size={16} />Criar regra</button></div>
        </form>
      </Panel>

      <Panel title={rules.length ? `Suas regras (${rules.length})` : 'Suas regras'} sub={rules.length ? 'A regra com a palavra mais específica vence. Você sempre pode trocar na hora de lançar.' : 'Nenhuma regra ainda.'}>
        {rules.length > 0 && (
          <ul className="mt-3 divide-y divide-ink/[0.07]">
            {rules.map((r) => {
              const c = d.categories.find((x) => x.id === r.category_id);
              const targets = c ? ruleTargets(r, d) : [];
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3" data-rule={r.match}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `${c ? c.color : '#9AA9A4'}22` }}><Icon name={c ? c.icon : 'tag'} size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold">"{r.match}" <span className="text-ink/45">→</span> {c ? c.name : 'categoria excluída'}</p>
                    <p className="text-xs text-ink/60">{r.kind === 'in' ? 'Receitas' : 'Despesas'}{r.source && ruleSourceLabel(r.source, d) ? ` · ${ruleSourceLabel(r.source, d)}` : ''}</p>
                  </div>
                  {targets.length > 0 && <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-[12.5px]" disabled={busy} onClick={() => apply(r, targets)}><Icon name="refresh" size={14} />Aplicar a {plural(targets.length, 'lançamento', 'lançamentos')}</button>}
                  <button type="button" className="icon-btn size-9" aria-label={`Excluir a regra ${r.match}`} onClick={() => remove(r)}><Icon name="trash" size={16} /></button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {sugg.length > 0 && (
        <Panel title="Sugestões" sub="Encontrei estes padrões nos seus lançamentos. Um toque cria a regra.">
          <div className="mt-3 flex flex-wrap gap-2">
            {sugg.map((g) => {
              const c = d.categories.find((x) => x.id === g.category_id);
              const label = g.word.charAt(0).toUpperCase() + g.word.slice(1);
              return (
                <button key={`${g.kind}${g.word}`} type="button" onClick={() => add({ match: label, category_id: g.category_id })} className="flex items-center gap-2 rounded-full border border-ink/10 bg-ink/[0.03] py-1.5 pl-1.5 pr-3 text-[12.5px] font-bold hover:bg-ink/[0.06]">
                  <span className="grid size-6 place-items-center rounded-full" style={{ background: `${c.color}26` }}><Icon name={c.icon} size={13} /></span>
                  "{label}" → {c.name}<span className="font-semibold text-ink/50">{g.n}×</span>
                </button>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ---------- Simulador "E se?" ---------- */
function SimRange({ value, onChange, label }) {
  return <input type="range" min="0" max="100" step="5" value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-vivo" />;
}

function SimulatorPage() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const today = todayISO();
  const k = finMonthOf(today);
  // Base: média dos últimos 3 meses fechados
  const base = useMemo(() => {
    let inc = 0, exp = 0, n = 0;
    const cats = {};
    for (let i = 1; i <= 3; i++) {
      const s = periodSummary(d.transactions, ...finRange(shiftMonth(k, -i)), d.categories);
      if (!s.income && !s.expense) continue;
      n++; inc += s.income; exp += s.expense;
      s.expenseTx.forEach((t) => {
        const c = d.categories.find((x) => x.id === t.category_id);
        const top = c && c.parent_id ? d.categories.find((x) => x.id === c.parent_id) || c : c;
        const key = top ? top.id : 'none';
        cats[key] = (cats[key] || 0) + t.amount;
      });
    }
    if (!n) { // sem histórico: usa o mês atual
      const s = periodSummary(d.transactions, ...finRange(k), d.categories);
      n = 1; inc = s.income; exp = s.expense;
      s.expenseTx.forEach((t) => { const c = d.categories.find((x) => x.id === t.category_id); const top = c && c.parent_id ? d.categories.find((x) => x.id === c.parent_id) || c : c; const key = top ? top.id : 'none'; cats[key] = (cats[key] || 0) + t.amount; });
    }
    const recIn = sum(d.recurrings.filter((r) => r.active && r.kind === 'in' && r.frequency === 'monthly'), (r) => r.amount);
    const income = Math.max(Math.round(inc / n), recIn);
    const byCat = Object.entries(cats).map(([id, v]) => { const c = d.categories.find((x) => x.id === id); return { id, name: c ? c.name : 'Sem categoria', color: c ? c.color : '#9AA9A4', icon: c ? c.icon : 'tag', avg: Math.round(v / n) }; }).filter((x) => x.avg > 0).sort((a, b) => b.avg - a.avg);
    return { income, expense: Math.round(exp / n), byCat, months: n };
  }, [d.transactions, d.recurrings, d.categories, k]);
  const subs = useMemo(() => subscriptionsOf(d).list.filter((x) => x.r.active), [d.recurrings]);

  const [cut, setCut] = useState({}); // recorrências canceladas
  const [red, setRed] = useState({}); // % de redução por categoria
  const [extra, setExtra] = useState(0); // renda extra por mês
  const [newCost, setNewCost] = useState(0); // novo gasto fixo
  const [newName, setNewName] = useState('');
  const [showAll, setShowAll] = useState(false);

  const saveSubs = sum(subs.filter((x) => cut[x.r.id]), (x) => x.monthly);
  // Ao cancelar uma recorrência, a redução da categoria vale só para o que sobra nela (sem contar duas vezes)
  const topOf = (id) => { const c = d.categories.find((x) => x.id === id); return c && c.parent_id ? c.parent_id : id; };
  const cutIn = (catId) => sum(subs.filter((x) => cut[x.r.id] && topOf(x.r.category_id) === catId), (x) => x.monthly);
  const restOf = (c) => Math.max(0, c.avg - cutIn(c.id));
  const saveCats = sum(base.byCat, (c) => Math.round((restOf(c) * (red[c.id] || 0)) / 100));
  const before = base.income - base.expense;
  const after = before + saveSubs + saveCats + extra - newCost;
  const delta = after - before;
  const rate = (v, inc) => (inc > 0 ? Math.round((v / inc) * 100) : 0);
  const changed = saveSubs || saveCats || extra || newCost;
  const reset = () => { setCut({}); setRed({}); setExtra(0); setNewCost(0); setNewName(''); };

  // Meta
  const goals = (d.goals || []).filter((g) => !g.archived && (g.target || 0) > (g.saved || 0));
  const [goalId, setGoalId] = useState('');
  const [target, setTarget] = useState(1000000);
  const [saved, setSaved] = useState(0);
  const [mode, setMode] = useState('mensal');
  const [monthly, setMonthly] = useState(50000);
  const [deadline, setDeadline] = useState(shiftMonth(k, 12));
  const pickGoal = (id) => { setGoalId(id); const g = goals.find((x) => x.id === id); if (g) { setTarget(g.target || 0); setSaved(g.saved || 0); if (g.due) { setDeadline(String(g.due).slice(0, 7)); setMode('prazo'); } else if (g.monthly_amount) { setMonthly(g.monthly_amount); setMode('mensal'); } } };
  const missing = Math.max(0, target - saved);
  const monthsTo = monthly > 0 ? Math.ceil(missing / monthly) : 0;
  const monthsLeft = Math.max(1, (Number(deadline.slice(0, 4)) - Number(k.slice(0, 4))) * 12 + Number(deadline.slice(5, 7)) - Number(k.slice(5, 7)));
  const needed = Math.ceil(missing / monthsLeft);
  const withSim = after > 0 ? Math.ceil(missing / after) : 0;
  const whenLabel = (n) => monthLabel(shiftMonth(k, n)).toLowerCase();
  const duration = (n) => (n < 12 ? plural(n, 'mês', 'meses') : `${plural(Math.floor(n / 12), 'ano', 'anos')}${n % 12 ? ` e ${plural(n % 12, 'mês', 'meses')}` : ''}`);

  const cats = showAll ? base.byCat : base.byCat.slice(0, 6);
  const maxBar = Math.max(1, base.income, base.income + extra);
  const bar = (v, color) => <span className="block h-2.5 overflow-hidden rounded-full bg-ink/[0.06]"><i className="block h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, (v / maxBar) * 100))}%`, background: color }} /></span>;

  const result = (
    <section className="glass spec rise min-w-0 p-5 sm:p-6" aria-live="polite" data-sim="result">
      <h2 className="text-lg font-extrabold tracking-[-0.02em]">Resultado</h2>
      <p className="mt-0.5 text-xs text-ink/65">Com base na média de {plural(base.months, 'mês', 'meses')} ({m(base.income)} de renda e {m(base.expense)} de gastos por mês).</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-ink/[0.04] p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-ink/55">Sobra hoje</p><p className={`mt-1 text-[20px] font-extrabold tabular-nums ${before < 0 ? 'text-out' : ''}`}>{m(before)}</p><p className="text-xs text-ink/60">{rate(before, base.income)}% da renda</p></div>
        <div className="rounded-2xl bg-vivo/10 p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-in">E se…</p><p className={`mt-1 text-[20px] font-extrabold tabular-nums ${after < 0 ? 'text-out' : 'text-in'}`} data-sim="after">{m(after)}</p><p className="text-xs text-ink/60">{rate(after, base.income + extra)}% da renda</p></div>
      </div>
      <div className="mt-4 space-y-2 text-[12.5px]">
        <div><div className="mb-1 flex justify-between"><span className="text-ink/65">Gastos hoje</span><b className="tabular-nums">{m(base.expense)}</b></div>{bar(base.expense, '#E0714F')}</div>
        <div><div className="mb-1 flex justify-between"><span className="text-ink/65">Gastos simulados</span><b className="tabular-nums">{m(base.expense - saveSubs - saveCats + newCost)}</b></div>{bar(base.expense - saveSubs - saveCats + newCost, '#14806B')}</div>
      </div>
      {changed ? (
        <div className={`mt-4 rounded-2xl p-4 ${delta >= 0 ? 'bg-vivo/10' : 'bg-coral/10'}`}>
          <p className="text-[13px] font-bold">{delta >= 0 ? 'Você passaria a guardar a mais' : 'Você passaria a ter a menos'}</p>
          <p className={`mt-1 text-[24px] font-extrabold tabular-nums ${delta >= 0 ? 'text-in' : 'text-out'}`}>{m(Math.abs(delta))}<span className="text-[13px] font-semibold text-ink/60"> por mês</span></p>
          <p className="text-[13px] text-ink/70">{m(Math.abs(delta) * 12)} em 12 meses{after > 0 ? ` · ${m(after * 12)} guardados no ano` : ''}</p>
          {after < 0 && <p className="mt-2 text-xs font-semibold text-out">Atenção: assim os gastos passariam da renda.</p>}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-ink/[0.04] p-4 text-[13px] text-ink/70">Marque assinaturas para cancelar, reduza categorias ou adicione um gasto novo para ver o efeito aqui.</p>
      )}
      {changed ? <button type="button" className="btn btn-ghost mt-3 w-full !py-2 text-[13px]" onClick={reset}><Icon name="refresh" size={14} />Limpar simulação</button> : null}
    </section>
  );

  return (
    <div className="space-y-5">
      {!narrow && <PageHeader eyebrow="Planejamento" title="E se…?" />}
      <p className="rounded-2xl bg-attn px-4 py-3 text-[13px] leading-relaxed text-ink/80">Teste mudanças sem alterar nada nos seus dados: cancelar uma assinatura, gastar menos em uma categoria, assumir um gasto novo ou planejar quanto guardar para uma meta.</p>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card title="Cancelar assinaturas e contas fixas" sub={subs.length ? 'Marque o que você cortaria.' : 'Você ainda não tem despesas recorrentes.'}>
            {subs.length > 0 && (
              <ul className="space-y-1.5">
                {subs.map(({ r, monthly: mv }) => {
                  const c = d.categories.find((x) => x.id === r.category_id);
                  const on = !!cut[r.id];
                  return (
                    <li key={r.id}>
                      <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${on ? 'border-vivo/40 bg-vivo/10' : 'border-ink/[0.08] hover:bg-ink/[0.03]'}`}>
                        <input type="checkbox" className="size-4 accent-vivo" checked={on} onChange={() => setCut({ ...cut, [r.id]: !on })} />
                        <span className="grid size-8 shrink-0 place-items-center rounded-xl" style={{ background: `${c ? c.color : '#9AA9A4'}22` }}><Icon name={c ? c.icon : 'repeat'} size={15} /></span>
                        <span className="min-w-0 flex-1"><span className={`block truncate text-[13.5px] font-bold ${on ? 'line-through decoration-ink/40' : ''}`}>{r.description}</span><span className="block text-xs text-ink/55">{({ monthly: 'Mensal', weekly: 'Semanal', yearly: 'Anual' })[r.frequency] || 'Recorrente'}</span></span>
                        <span className="shrink-0 text-[13px] font-bold tabular-nums">{m(mv)}<span className="font-medium text-ink/50">/mês</span></span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Gastar menos em uma categoria" sub="Arraste para reduzir o gasto médio de cada categoria.">
            {base.byCat.length ? (
              <div className="space-y-4">
                {cats.map((c) => {
                  const p = red[c.id] || 0;
                  return (
                    <div key={c.id} data-sim-cat={c.name}>
                      <div className="mb-1.5 flex items-center gap-2.5">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: `${c.color}22` }}><Icon name={c.icon} size={14} /></span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{c.name}</span>
                        <span className="text-xs text-ink/60 tabular-nums">{m(c.avg)}/mês</span>
                        <span className={`w-[92px] text-right text-[12.5px] font-bold tabular-nums ${p ? 'text-in' : 'text-ink/40'}`}>{p ? `−${p}% · ${m(Math.round((restOf(c) * p) / 100))}` : '0%'}</span>
                      </div>
                      <SimRange value={p} label={`Reduzir ${c.name} em porcentagem`} onChange={(v) => setRed({ ...red, [c.id]: v })} />
                    </div>
                  );
                })}
                {base.byCat.length > 6 && <button type="button" className="text-xs font-bold text-in" onClick={() => setShowAll(!showAll)}>{showAll ? 'Mostrar menos' : `Ver todas (${base.byCat.length})`}</button>}
              </div>
            ) : <p className="text-[13px] text-ink/65">Ainda não há gastos suficientes para simular.</p>}
          </Card>

          <Card title="Um gasto novo ou uma renda extra" sub="Ex.: um financiamento, a academia, um freela.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Novo gasto fixo por mês"><MoneyInput id="sim-new" cents={newCost} onChange={setNewCost} label="Novo gasto fixo por mês" /></Field>
              <Field label="O que é (opcional)"><input className="field" value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} placeholder="Ex.: Parcela do carro" /></Field>
              <Field label="Renda extra por mês" className="sm:col-span-2"><MoneyInput id="sim-extra" cents={extra} onChange={setExtra} label="Renda extra por mês" /></Field>
            </div>
            {newCost > 0 && <p className="mt-3 text-[13px] text-ink/75">{newName ? `"${newName}"` : 'Esse gasto'} usaria <b>{rate(newCost, base.income + extra)}%</b> da sua renda. {before - newCost + extra >= 0 ? `Ainda sobrariam ${m(before - newCost + extra)} por mês.` : `Faltariam ${m(Math.abs(before - newCost + extra))} por mês.`}</p>}
          </Card>
        </div>

        <div className="space-y-5">
          {!narrow ? <div className="sticky top-5 space-y-5">{result}</div> : result}
        </div>
      </div>

      <Card title="Quanto tempo até a meta?" sub="Descubra em quantos meses você chega lá, ou quanto guardar por mês para chegar no prazo.">
        <div className="grid gap-3 sm:grid-cols-3">
          {goals.length > 0 && (
            <Field label="Usar uma meta" className="sm:col-span-3">
              <select className="field" value={goalId} onChange={(e) => pickGoal(e.target.value)}>
                <option value="">Valores livres</option>
                {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Quanto quer juntar"><MoneyInput id="sim-target" cents={target} onChange={setTarget} label="Quanto quer juntar" /></Field>
          <Field label="Já tem guardado"><MoneyInput id="sim-saved" cents={saved} onChange={setSaved} label="Já tem guardado" /></Field>
          <Field label="Calcular">
            <Segmented full value={mode} onChange={setMode} label="O que calcular" options={[{ value: 'mensal', label: 'Por mês' }, { value: 'prazo', label: 'Prazo' }]} />
          </Field>
          {mode === 'mensal'
            ? <Field label="Guardando por mês" className="sm:col-span-3"><MoneyInput id="sim-monthly" cents={monthly} onChange={setMonthly} label="Guardando por mês" /></Field>
            : <Field label="Quero chegar até" className="sm:col-span-3"><input type="month" className="field" min={shiftMonth(k, 1)} value={deadline} onChange={(e) => e.target.value && setDeadline(e.target.value)} /></Field>}
        </div>
        <div className="mt-4 rounded-2xl bg-vivo/10 p-4" data-sim="goal">
          {missing <= 0 ? <p className="text-[14px] font-bold text-in">Você já tem o valor da meta. 🎉</p>
            : mode === 'mensal' ? (
              monthly > 0
                ? <><p className="text-[13px] text-ink/70">Guardando {m(monthly)} por mês, você chega lá em</p><p className="mt-1 text-[24px] font-extrabold text-in">{duration(monthsTo)}</p><p className="text-[13px] text-ink/70">por volta de {whenLabel(monthsTo)}.</p></>
                : <p className="text-[13px] text-ink/70">Informe quanto pode guardar por mês.</p>
            ) : (
              <><p className="text-[13px] text-ink/70">Para chegar até {monthLabel(deadline).toLowerCase()} ({duration(monthsLeft)}), guarde</p><p className="mt-1 text-[24px] font-extrabold tabular-nums text-in">{m(needed)}<span className="text-[13px] font-semibold text-ink/60"> por mês</span></p>
                {base.income > 0 && <p className="text-[13px] text-ink/70">Isso é {rate(needed, base.income)}% da sua renda{before > 0 ? (needed <= before ? ', e cabe na sua sobra atual.' : `. Hoje sobram ${m(before)}: faltariam ${m(needed - before)} por mês.`) : '.'}</p>}</>
            )}
          {missing > 0 && changed && after > 0 ? <p className="mt-3 border-t border-ink/10 pt-3 text-[13px] text-ink/75">Guardando toda a sobra simulada ({m(after)}/mês), você chegaria em <b>{duration(withSim)}</b>.</p> : null}
        </div>
      </Card>
    </div>
  );
}
