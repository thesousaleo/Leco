/* =====================================================================
   70-shell: dados do usuário, ações, navegação (web e celular),
   boas-vindas, notificações e entrada do app.
   ===================================================================== */
const byTx = (a, b) => (a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : a.date < b.date ? 1 : -1);
const stripRow = (r) => { const { id, user_id, created_at, ...rest } = r; return rest; };

async function exportFile(filename, content, mime = 'text/csv') {
  const binary = content instanceof Uint8Array;
  if (NATIVE && Native.Filesystem && Native.Share) {
    let data = content;
    if (binary) { let bin = ''; for (let i = 0; i < content.length; i += 0x8000) bin += String.fromCharCode.apply(null, content.subarray(i, i + 0x8000)); data = btoa(bin); }
    const r = await Native.Filesystem.writeFile({ path: filename, data, directory: Native.Directory.Cache, ...(binary ? {} : { encoding: Native.Encoding.UTF8 }) });
    await Native.Share.share({ title: filename, url: r.uri, dialogTitle: 'Salvar ou enviar o ficheiro' });
    return;
  }
  const blob = new Blob([content], { type: binary ? mime : `${mime};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

function useLecoData(backend, session, toast) {
  const userId = session.user.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [freshIds, setFreshIds] = useState([]);
  const genRan = useRef(false);
  const lastLoad = useRef(0);
  const profileTimer = useRef(null);

  const load = useCallback(async () => {
    try {
      const all = await backend.db.loadAll(userId);
      if (!all.profile) all.profile = await backend.db.saveProfile(userId, { name: (session.user.user_metadata && (session.user.user_metadata.name || session.user.user_metadata.full_name)) || '' });
      if (!all.categories.length) all.categories = await backend.db.insert('categories', DEFAULT_CATEGORIES.map(([name, kind, icon, color]) => ({ name, kind, icon, color })));
      all.transactions.sort(byTx);
      lastLoad.current = Date.now();
      setData(all);
      setError('');
      return all;
    } catch (e) { setError(e.message); return null; }
  }, [userId]);

  const runRecurrings = useCallback(async (snap) => {
    const plan = planRecurrings(snap.recurrings, snap.cards);
    if (!plan.rows.length && !plan.updates.length) return;
    try {
      if (plan.rows.length) await backend.db.insertIgnore('transactions', plan.rows, 'recurring_id,date');
      for (const u of plan.updates) await backend.db.update('recurrings', u.id, u.patch);
      await load();
    } catch (e) { toast(e.message, null, true); }
  }, [load]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (data && !genRan.current) { genRan.current = true; runRecurrings(data); } }, [data]);
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > 5000) load(); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [load]);

  const set = (table, fn) => setData((d) => (d ? { ...d, [table]: fn(d[table]) } : d));
  const markFresh = (ids) => { setFreshIds(ids); setTimeout(() => setFreshIds([]), 2600); };
  const guard = async (fn, okMsg, action) => {
    try { const r = await fn(); if (okMsg) toast(okMsg, action); return r === undefined ? true : r; } catch (e) { toast(e.message, null, true); return false; }
  };

  const actions = {
    reload: load,
    async saveTx(initial, base, installments = 1) {
      return guard(async () => {
        const card = base.card_id ? data.cards.find((c) => c.id === base.card_id) : null;
        if (initial && initial.id) {
          const patch = { ...base };
          if (initial.group_id) { delete patch.card_id; delete patch.account_id; patch.description = `${base.description} (${initial.installment}/${initial.installments})`; }
          else patch.invoice = card ? invoiceOf(card, base.date) : null;
          const row = await backend.db.update('transactions', initial.id, patch);
          set('transactions', (l) => l.map((t) => (t.id === row.id ? row : t)).sort(byTx));
          markFresh([row.id]);
          return true;
        }
        const rows = installments > 1 || card ? buildInstallments(base, card, installments) : [{ ...base, invoice: null }];
        const made = await backend.db.insert('transactions', rows);
        set('transactions', (l) => [...made, ...l].sort(byTx));
        markFresh(made.map((r) => r.id));
        return true;
      }, initial && initial.id ? 'Transação atualizada' : installments > 1 ? `Compra em ${installments}x registrada` : base.kind === 'in' ? 'Receita registrada' : base.kind === 'transfer' ? 'Transferência registrada' : 'Despesa registrada');
    },
    // Transação que se repete (assinatura, aluguel, salário): cria a recorrência e o primeiro lançamento
    async saveTxRepeat(base, frequency, endDate) {
      const ok = await guard(async () => {
        const [rec] = await backend.db.insert('recurrings', [{
          kind: base.kind, amount: base.amount, description: base.description.slice(0, 60), category_id: base.category_id,
          account_id: base.account_id, card_id: base.card_id, frequency, next_date: nextDateOf(base.date, frequency), end_date: endDate || null, active: true,
        }]);
        const card = base.card_id ? data.cards.find((c) => c.id === base.card_id) : null;
        await backend.db.insert('transactions', [{ ...base, recurring_id: rec.id, invoice: card ? invoiceOf(card, base.date) : null, paid: card ? true : base.paid }]);
      }, base.card_id ? 'Assinatura criada: cai em toda fatura' : `${base.kind === 'in' ? 'Receita' : 'Despesa'} recorrente criada`);
      if (ok) { const fresh = await load(); if (fresh) runRecurrings(fresh); }
      return ok;
    },
    async deleteTx(t, scope = 'one') {
      if (scope === 'group' && t.group_id) {
        return guard(async () => { await backend.db.removeWhere('transactions', 'group_id', t.group_id); set('transactions', (l) => l.filter((x) => x.group_id !== t.group_id)); }, 'Compra parcelada excluída');
      }
      return guard(async () => { await backend.db.remove('transactions', t.id); set('transactions', (l) => l.filter((x) => x.id !== t.id)); }, 'Transação excluída', {
        label: 'Desfazer', run: async () => { try { const made = await backend.db.insert('transactions', [stripRow(t)]); set('transactions', (l) => [...made, ...l].sort(byTx)); } catch (e) { toast(e.message, null, true); } },
      });
    },
    async confirmTx(t) {
      return guard(async () => { const row = await backend.db.update('transactions', t.id, { paid: true }); set('transactions', (l) => l.map((x) => (x.id === row.id ? row : x))); markFresh([row.id]); }, t.kind === 'in' ? 'Recebimento confirmado' : 'Pagamento confirmado');
    },
    async payInvoice(card, invoice, accountId, amount, date) {
      return guard(async () => {
        const made = await backend.db.insert('transactions', [{ kind: 'card_payment', amount, date, account_id: accountId, card_id: card.id, invoice, paid: true, description: `Fatura ${card.name} · ${invoiceLabel(invoice)}` }]);
        set('transactions', (l) => [...made, ...l].sort(byTx));
      }, 'Pagamento da fatura registrado');
    },
    async saveAccount(initial, patch) {
      return guard(async () => {
        if (initial) { const row = await backend.db.update('accounts', initial.id, patch); set('accounts', (l) => l.map((a) => (a.id === row.id ? row : a))); }
        else { const made = await backend.db.insert('accounts', [patch]); set('accounts', (l) => [...l, ...made]); }
      }, initial ? (patch.archived != null ? (patch.archived ? 'Conta arquivada' : 'Conta reativada') : 'Conta atualizada') : 'Conta criada');
    },
    async saveCard(initial, patch) {
      return guard(async () => {
        if (initial) { const row = await backend.db.update('cards', initial.id, patch); set('cards', (l) => l.map((a) => (a.id === row.id ? row : a))); }
        else { const made = await backend.db.insert('cards', [patch]); set('cards', (l) => [...l, ...made]); }
      }, initial ? (patch.archived != null ? (patch.archived ? 'Cartão arquivado' : 'Cartão reativado') : 'Cartão atualizado') : 'Cartão adicionado');
    },
    async saveCategory(initial, patch) {
      return guard(async () => {
        if (initial) { const row = await backend.db.update('categories', initial.id, patch); set('categories', (l) => l.map((a) => (a.id === row.id ? row : a))); return row; }
        const made = await backend.db.insert('categories', [patch]); set('categories', (l) => [...l, ...made]); return made[0];
      }, initial ? 'Categoria atualizada' : `Categoria “${patch.name}” criada`);
    },
    async saveRecurring(initial, patch) {
      const ok = await guard(async () => {
        if (initial) { const row = await backend.db.update('recurrings', initial.id, patch); set('recurrings', (l) => l.map((a) => (a.id === row.id ? row : a))); return row; }
        const made = await backend.db.insert('recurrings', [patch]); set('recurrings', (l) => [...l, ...made]); return made[0];
      }, initial ? (Object.keys(patch).length === 1 && 'active' in patch ? (patch.active ? 'Recorrência retomada' : 'Recorrência pausada') : 'Recorrência atualizada') : 'Recorrência criada');
      if (ok) { const fresh = await load(); if (fresh) runRecurrings(fresh); }
      return ok;
    },
    async deleteRecurring(r) {
      return guard(async () => {
        const pending = data.transactions.filter((t) => t.recurring_id === r.id && !t.paid);
        for (const t of pending) await backend.db.remove('transactions', t.id);
        await backend.db.remove('recurrings', r.id);
        set('transactions', (l) => l.filter((t) => !(t.recurring_id === r.id && !t.paid)).map((t) => (t.recurring_id === r.id ? { ...t, recurring_id: null } : t)));
        set('recurrings', (l) => l.filter((x) => x.id !== r.id));
      }, 'Recorrência excluída');
    },
    async saveGoal(initial, patch) {
      return guard(async () => {
        if (initial) { const row = await backend.db.update('goals', initial.id, patch); set('goals', (l) => l.map((a) => (a.id === row.id ? row : a))); }
        else { const made = await backend.db.insert('goals', [patch]); set('goals', (l) => [...l, ...made]); }
      }, initial ? (Object.keys(patch).length === 1 && 'saved' in patch ? 'Valor guardado na meta' : 'Meta atualizada') : 'Meta criada');
    },
    async deleteRow(table, row) {
      const labels = { accounts: 'Conta excluída', cards: 'Cartão excluído', categories: 'Categoria excluída', goals: 'Meta excluída' };
      return guard(async () => {
        await backend.db.remove(table, row.id);
        set(table, (l) => l.filter((x) => x.id !== row.id));
        if (table === 'accounts') set('transactions', (l) => l.filter((t) => t.account_id !== row.id && t.to_account_id !== row.id));
        if (table === 'cards') set('transactions', (l) => l.filter((t) => t.card_id !== row.id));
        if (table === 'categories') set('transactions', (l) => l.map((t) => (t.category_id === row.id ? { ...t, category_id: null } : t)));
      }, labels[table]);
    },
    async saveProfile(patch, okMsg, debounce) {
      setData((d) => (d ? { ...d, profile: { ...d.profile, ...patch } } : d));
      const run = () => guard(async () => { await backend.db.saveProfile(userId, patch); }, okMsg);
      if (debounce) { clearTimeout(profileTimer.current); profileTimer.current = setTimeout(run, 600); return true; }
      return run();
    },
  };
  return { data, error, freshIds, actions };
}

/* ---------- Notificações (sino) ---------- */
function NotifButton({ panelWidth = 340 }) {
  const d = useApp();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useLocal('leco.seenAlerts', []);
  const ref = useRef(null);
  const unread = d.alerts.some((a) => !seen.includes(a.id));
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const tone = { gold: 'bg-ouro/20 text-[#9A6205]', bad: 'bg-coral/20 text-out', ok: 'bg-ink/[0.07] text-ink' };
  return (
    <div ref={ref} className="relative">
      <button type="button" className="icon-btn relative size-11" aria-label={`Avisos${unread ? ' (novos)' : ''}`} aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setSeen(d.alerts.map((a) => a.id)); }}>
        <Icon name="bell" size={19} />
        {unread && <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-ouro ring-2 ring-paper" />}
      </button>
      {open && (
        <div className="glass-deep pop-in absolute right-0 top-[calc(100%+10px)] z-50 p-2 max-sm:fixed max-sm:inset-x-4 max-sm:top-[calc(72px+var(--safe-top))] max-sm:!w-auto" style={{ width: panelWidth }} role="dialog" aria-label="Avisos">
          <div className="flex items-center justify-between px-3 pb-1 pt-2">
            <p className="text-sm font-extrabold tracking-[-0.02em]">Avisos</p>
            <span className="text-[11px] text-ink/60">{d.alerts.length}</span>
          </div>
          {d.alerts.length === 0 && <p className="px-3 py-6 text-center text-xs leading-relaxed text-ink/65">Tudo em dia. Os lembretes de contas, faturas e orçamentos aparecem aqui.</p>}
          <ul className="no-scrollbar max-h-[380px] space-y-1 overflow-y-auto">
            {d.alerts.map((n) => (
              <li key={n.id}>
                <button type="button" className="flex w-full gap-3 rounded-2xl p-3 text-left hover:bg-ink/[0.04]" onClick={() => {
                  setOpen(false);
                  if (n.txId) { const t = d.transactions.find((x) => x.id === n.txId); if (t) d.openModal({ kind: 'tx', initial: t }); }
                  else if (n.cardId) { const c = d.cards.find((x) => x.id === n.cardId); if (c) d.openModal({ kind: 'invoice', card: c }); }
                  else if (n.id.startsWith('b-')) d.go('categorias');
                  else if (n.id.startsWith('g-')) d.go('metas');
                }}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone[n.tone || 'ok']}`}><Icon name={n.icon} size={17} /></span>
                  <span className="min-w-0"><span className="block text-[13px] font-bold">{n.title}</span><span className="mt-0.5 block text-xs leading-relaxed text-ink/70">{n.body}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- Lembretes no celular (notificações locais) ---------- */
function hashId(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 2000000000; }
async function scheduleReminders(d) {
  const LN = Native.LocalNotifications;
  if (!LN || !d.profile) return;
  try {
    const perm = await LN.checkPermissions();
    if (perm.display !== 'granted') return;
    const pending = await LN.getPending();
    if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (!d.profile.notify_bills) return;
    const before = d.profile.bill_days_before || 0;
    const today = todayISO(), limit = addDays(today, 60);
    const at = (iso) => { const day = addDays(iso, -before); const dt = new Date(`${day < today ? today : day}T09:00:00`); if (dt <= new Date()) dt.setTime(Date.now() + 60000); return dt; };
    const list = [];
    d.transactions.filter((t) => !t.paid && t.kind === 'out' && t.date >= today && t.date <= limit).forEach((t) => list.push({ id: hashId(`t${t.id}`), title: `Conta a pagar: ${t.description}`, body: `${fmtBRL(t.amount)} vence ${fmtDate(t.date)}.`, schedule: { at: at(t.date), allowWhileIdle: true } }));
    d.cards.filter((c) => !c.archived).forEach((c) => {
      cardSummary(c, d.transactions).invoices.filter((i) => i.remaining > 0 && i.due >= today && i.due <= limit).forEach((i) => list.push({ id: hashId(`f${c.id}${i.invoice}`), title: `Fatura ${c.name}`, body: `${fmtBRL(i.remaining)} vence ${fmtDate(i.due)}.`, schedule: { at: at(i.due), allowWhileIdle: true } }));
    });
    if (list.length) await LN.schedule({ notifications: list.slice(0, 60) });
  } catch (e) { /* lembretes são opcionais */ }
}

/* ---------- Boas-vindas ---------- */
function Onboarding({ backend, session, profile, onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.name || (session.user.user_metadata && (session.user.user_metadata.name || session.user.user_metadata.full_name)) || '');
  const [accName, setAccName] = useState('Conta corrente');
  const [accKind, setAccKind] = useState('corrente');
  const [bal, setBal] = useState(0);
  const [wantCard, setWantCard] = useState(false);
  const [cardName, setCardName] = useState('');
  const [limit, setLimit] = useState(0);
  const [closing, setClosing] = useState(1);
  const [due, setDue] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const finish = async (withCard) => {
    setErr(''); setBusy(true);
    try {
      const acc = await backend.db.insert('accounts', [{ name: accName.trim() || 'Conta corrente', kind: accKind, initial_balance: bal, color: '#14806B' }]);
      if (withCard) await backend.db.insert('cards', [{ name: cardName.trim() || 'Cartão de crédito', limit_amount: limit, closing_day: closing, due_day: due, pay_account_id: acc[0].id, color: '#0F5C4D' }]);
      await backend.db.saveProfile(session.user.id, { name: name.trim(), onboarded: true });
      onDone();
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  const dots = <div className="mb-5 flex justify-center gap-1.5">{[0, 1, 2].map((i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-ouro' : 'w-1.5 bg-ink/20'}`} />)}</div>;
  return (
    <AuthShell>
      {dots}
      {step === 0 && (
        <form onSubmit={(e) => { e.preventDefault(); if (!name.trim()) { setErr('Digite o seu nome.'); return; } setErr(''); setStep(1); }} noValidate className="space-y-4">
          <div><h1 className="text-[24px] font-extrabold tracking-[-0.02em]">Bem-vindo ao Leco</h1><p className="mt-1 text-[13.5px] leading-relaxed text-ink/70">Em dois passos o seu painel fica pronto. Tudo começa zerado: só aparece o que você registrar.</p></div>
          <Field label="Como quer ser chamado?"><input id="ob-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></Field>
          <ErrorNote>{err}</ErrorNote>
          <button type="submit" className="btn btn-primary w-full !py-3">Continuar<Icon name="right" size={16} /></button>
        </form>
      )}
      {step === 1 && (
        <form onSubmit={(e) => { e.preventDefault(); if (!accName.trim()) { setErr('Dê um nome para a conta.'); return; } setErr(''); setStep(2); }} noValidate className="space-y-4">
          <div><h1 className="text-[22px] font-extrabold tracking-[-0.02em]">Sua primeira conta</h1><p className="mt-1 text-[13.5px] leading-relaxed text-ink/70">Onde está o seu dinheiro hoje? Depois você pode adicionar outras contas.</p></div>
          <Field label="Nome"><input id="ob-acc" className="field" value={accName} onChange={(e) => setAccName(e.target.value)} placeholder="Ex.: Nubank, Itaú, Carteira" /></Field>
          <div><span className="lbl">Tipo</span><div className="mt-2"><ChoiceChips label="Tipo de conta" value={accKind} onChange={setAccKind} options={Object.keys(ACCOUNT_KINDS).filter((k) => k !== 'outro').map((k) => ({ value: k, label: ACCOUNT_KINDS[k].label, icon: ACCOUNT_KINDS[k].icon }))} /></div></div>
          <Field label="Saldo atual" hint="Quanto há nesta conta agora. Pode deixar zero."><SignedMoney id="ob-bal" label="Saldo atual" cents={bal} onChange={setBal} /></Field>
          <ErrorNote>{err}</ErrorNote>
          <div className="flex gap-2"><button type="button" className="btn btn-ghost flex-1" onClick={() => setStep(0)}>Voltar</button><button type="submit" className="btn btn-primary flex-[1.6]">Continuar<Icon name="right" size={16} /></button></div>
        </form>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <div><h1 className="text-[22px] font-extrabold tracking-[-0.02em]">Tem cartão de crédito?</h1><p className="mt-1 text-[13.5px] leading-relaxed text-ink/70">Com o cartão cadastrado, o Leco organiza as faturas, as parcelas e avisa antes do vencimento.</p></div>
          {!wantCard ? (
            <div className="grid gap-2">
              <button type="button" className="btn btn-primary w-full !py-3" onClick={() => setWantCard(true)}><Icon name="card" size={17} />Sim, cadastrar agora</button>
              <button type="button" className="btn btn-ghost w-full !py-3" disabled={busy} onClick={() => finish(false)}>{busy ? <Spinner size={14} /> : null}Agora não, ir para o painel</button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); finish(true); }} noValidate className="space-y-4">
              <Field label="Nome do cartão"><input id="ob-card" className="field" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Ex.: Nubank Roxinho" /></Field>
              <Field label="Limite"><MoneyInput id="ob-limit" label="Limite" cents={limit} onChange={setLimit} className="font-bold" /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Fecha no"><DaySelect id="ob-closing" value={closing} onChange={setClosing} /></Field><Field label="Vence no"><DaySelect id="ob-due" value={due} onChange={setDue} /></Field></div>
              <ErrorNote>{err}</ErrorNote>
              <div className="flex gap-2"><button type="button" className="btn btn-ghost flex-1" onClick={() => setWantCard(false)}>Voltar</button><SubmitButton busy={busy} className="flex-[1.6]">Concluir</SubmitButton></div>
            </form>
          )}
          {!wantCard && <ErrorNote>{err}</ErrorNote>}
          {!wantCard && <button type="button" className="w-full text-center text-[13px] font-bold text-ink/60" onClick={() => setStep(1)}>Voltar</button>}
        </div>
      )}
    </AuthShell>
  );
}

/* ---------- Navegação ---------- */
const PAGES = {
  inicio: { label: 'Visão geral', icon: 'home', C: OverviewPage },
  transacoes: { label: 'Transações', icon: 'list', C: TransactionsPage },
  calendario: { label: 'Calendário', icon: 'calendar', C: CalendarPage },
  contas: { label: 'Contas e cartões', icon: 'card', C: AccountsPage },
  recorrentes: { label: 'Recorrentes', icon: 'repeat', C: RecurringPage },
  relatorios: { label: 'Relatórios', icon: 'chart', C: ReportsPage },
  metas: { label: 'Metas', icon: 'target', C: GoalsPage },
  categorias: { label: 'Categorias', icon: 'grid', C: CategoriesPage },
  config: { label: 'Configurações', icon: 'settings', C: SettingsPage },
};

function WebLayout() {
  const d = useApp();
  const Page = (PAGES[d.page] || PAGES.inicio).C;
  return (
    <div className="relative z-10 mx-auto grid w-full max-w-[1480px] gap-5 pb-8 pl-[max(16px,var(--safe-left))] pr-[max(16px,var(--safe-right))] pt-5 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="glass sticky top-5 flex max-h-[calc(100vh-40px)] flex-col gap-5 self-start overflow-y-auto p-5">
        <div className="px-1 pt-1"><Logo size="md" /></div>
        <button type="button" className="btn btn-primary w-full" onClick={() => d.openModal({ kind: 'tx' })}><Icon name="plus" size={18} strokeWidth={2.4} />Nova transação</button>
        <nav aria-label="Abas principais" className="flex flex-col gap-1">
          {Object.keys(PAGES).map((id) => {
            const p = PAGES[id];
            const on = d.page === id;
            return (
              <button key={id} type="button" onClick={() => d.go(id)} aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] font-semibold transition-all ${on ? 'border border-white/20 bg-gradient-to-br from-vivo to-leco text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_10px_22px_-12px_rgba(20,128,107,.9)]' : 'border border-transparent text-ink/75 hover:bg-ink/[0.05] hover:text-ink'}`}>
                <Icon name={p.icon} size={18} />{p.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2">
          <button type="button" onClick={() => { d.setSettingsSub('perfil'); d.go('config'); }} className="flex w-full items-center gap-3 rounded-2xl border border-ink/[0.08] bg-ink/[0.03] p-3 text-left hover:bg-ink/[0.06]">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-vivo to-leco text-[15px] font-extrabold text-white ring-2 ring-ouro/70">{(d.name || d.session.user.email).charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{d.name || 'Sua conta'}</span><span className="block truncate text-xs text-ink/65">{d.session.user.email}</span></span>
          </button>
          <button type="button" className="btn btn-ghost w-full !py-2 text-[13px]" onClick={d.signOut}><Icon name="logout" size={15} />Sair</button>
        </div>
      </aside>
      <main className="min-w-0">
        {d.page !== 'inicio' && <div className="mb-4 flex justify-end gap-2"><NotifButton /></div>}
        <div key={`${d.page}-${d.settingsSub}`} className="rise"><Page /></div>
        <p className="px-1 pt-6 text-center text-[11px] text-ink/50">Leco · seus dados ficam protegidos e só você tem acesso</p>
      </main>
    </div>
  );
}

const MOBILE_MENU = [
  { id: 'contas', label: 'Contas e cartões', icon: 'card', desc: 'Saldos, faturas e limites' },
  { id: 'recorrentes', label: 'Recorrentes', icon: 'repeat', desc: 'Contas fixas e lembretes' },
  { id: 'metas', label: 'Metas', icon: 'target', desc: 'Objetivos de poupança' },
  { id: 'categorias', label: 'Categorias', icon: 'grid', desc: 'Categorias e orçamentos' },
];

function MobileLayout() {
  const d = useApp();
  const page = d.page;
  const TABS = [{ id: 'inicio', label: 'Início', icon: 'home' }, { id: 'transacoes', label: 'Extrato', icon: 'list' }, { id: 'calendario', label: 'Calendário', icon: 'calendar' }, { id: 'relatorios', label: 'Análises', icon: 'pie' }, { id: 'mais', label: 'Ajustes', icon: 'settings' }];
  const isTab = TABS.some((t) => t.id === page);
  const activeTab = isTab ? TABS.findIndex((t) => t.id === page) : page === 'inicio' ? 0 : TABS.length - 1;
  const tabTitle = { transacoes: 'Extrato', calendario: 'Calendário', relatorios: 'Análises', mais: 'Ajustes' }[page];
  const title = page === 'config' ? (SETTINGS_TABS.find((t) => t.id === d.settingsSub) || {}).label : tabTitle || (PAGES[page] || {}).label;
  const Page = page === 'mais' ? null : (PAGES[page] || PAGES.inicio).C;
  const back = () => d.go(page === 'config' || MOBILE_MENU.some((x) => x.id === page) ? 'mais' : 'inicio');
  const headerAction = { contas: { icon: 'plus', label: 'Nova conta', fn: () => d.openModal({ kind: 'account' }) }, recorrentes: { icon: 'plus', label: 'Nova recorrência', fn: () => d.openModal({ kind: 'recurring' }) }, metas: { icon: 'plus', label: 'Nova meta', fn: () => d.openModal({ kind: 'goal' }) } }[page];
  const series = useMemo(() => monthSeries(d.transactions, d.accounts, monthKey(todayISO())), [d.transactions, d.accounts]);
  const totalBal = sum(d.accounts, (a) => d.balances[a.id] || 0);
  const prevBal = series.length > 1 ? series[series.length - 2].bal : 0;
  const balDelta = prevBal ? ((totalBal - prevBal) / Math.abs(prevBal)) * 100 : null;
  const initial = (d.name || d.session.user.email).charAt(0).toUpperCase();
  useEffect(() => { window.scrollTo(0, 0); }, [page, d.settingsSub]);
  return (
    <NarrowCtx.Provider value={true}>
      <div className="relative z-10 min-h-[100dvh] pb-[calc(170px+var(--safe-bottom))] pl-[max(16px,var(--safe-left))] pr-[max(16px,var(--safe-right))] pt-[calc(14px+var(--safe-top))]">
        <header className="pb-4">
          {page === 'inicio' ? (
            <>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => { d.setSettingsSub('perfil'); d.go('config'); }} aria-label="Abrir perfil" className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-vivo to-leco text-[16px] font-extrabold text-white ring-2 ring-ouro/70">{initial}</button>
                <div className="min-w-0 flex-1"><p className="text-xs text-ink/70">{greeting()},</p><p className="truncate text-[17px] font-extrabold tracking-[-0.02em]">{firstName(d.name) || 'bem-vindo'}</p></div>
                <button type="button" className="icon-btn size-11" onClick={() => d.saveProfile({ hide_values: !d.hide })} aria-label={d.hide ? 'Mostrar valores' : 'Ocultar valores'} aria-pressed={d.hide}><Icon name={d.hide ? 'eyeOff' : 'eye'} size={19} /></button>
                <NotifButton panelWidth={300} />
              </div>
              <button type="button" onClick={() => d.go('contas')} className="glass-hero mt-4 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left">
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink/75">Saldo total</span>
                  <span className="mt-0.5 block text-[24px] font-extrabold leading-tight tracking-[-0.02em]"><Money cents={totalBal} /></span>
                </span>
                <Delta value={balDelta} />
              </button>
            </>
          ) : isTab ? (
            <div className="flex items-center gap-3 pt-1">
              <h1 className="min-w-0 flex-1 truncate text-[24px] font-extrabold tracking-[-0.02em]">{title}</h1>
              {page !== 'mais' && <NotifButton panelWidth={300} />}
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <button type="button" className="icon-btn size-10 shrink-0" aria-label="Voltar" onClick={back}><Icon name="left" size={18} /></button>
              <h1 className="min-w-0 flex-1 truncate text-[20px] font-extrabold tracking-[-0.02em]">{title}</h1>
              {headerAction && <button type="button" className="icon-btn size-10" aria-label={headerAction.label} onClick={headerAction.fn}><Icon name={headerAction.icon} size={18} /></button>}
            </div>
          )}
        </header>
        <main>
          <div key={`${page}-${d.settingsSub}`} className="rise">
            {page === 'mais' ? (
              <div className="space-y-4">
                <button type="button" onClick={() => { d.setSettingsSub('perfil'); d.go('config'); }} className="glass-hero flex w-full items-center gap-3 rounded-3xl p-4 text-left">
                  <span className="grid size-14 shrink-0 place-items-center rounded-full bg-white/15 text-xl font-extrabold ring-2 ring-ouro/80">{initial}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-extrabold">{d.name || 'Sua conta'}</span>
                    <span className="block truncate text-xs text-ink/75">{d.session.user.email}</span>
                  </span>
                  <Icon name="right" size={18} />
                </button>
                <ul className="glass divide-y divide-ink/[0.07] rounded-3xl px-2 py-1">
                  {MOBILE_MENU.map((it) => (
                    <li key={it.id}><button type="button" onClick={() => d.go(it.id)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink/[0.06]"><Icon name={it.icon} size={18} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold">{it.label}</span><span className="block truncate text-xs text-ink/65">{it.desc}</span></span>
                      <Icon name="right" size={16} className="text-ink/45" />
                    </button></li>
                  ))}
                </ul>
                <ul className="glass divide-y divide-ink/[0.07] rounded-3xl px-2 py-1">
                  {SETTINGS_TABS.filter((it) => it.id !== 'perfil').map((it) => (
                    <li key={it.id}><button type="button" onClick={() => { d.setSettingsSub(it.id); d.go('config'); }} className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink/[0.06]"><Icon name={it.icon} size={18} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold">{it.label}</span><span className="block truncate text-xs text-ink/65">{it.desc}</span></span>
                      <Icon name="right" size={16} className="text-ink/45" />
                    </button></li>
                  ))}
                </ul>
                <button type="button" className="btn btn-ghost w-full" onClick={d.signOut}><Icon name="logout" size={16} />Sair da conta</button>
                <p className="text-center text-[11px] text-ink/50">Leco · seus dados ficam protegidos e só você tem acesso</p>
              </div>
            ) : <Page />}
          </div>
        </main>
        <nav aria-label="Navegação principal" className="glass-deep fixed inset-x-3.5 bottom-[calc(14px+var(--safe-bottom))] z-40 grid h-[70px] grid-cols-5 items-center rounded-[28px] px-1">
          <span aria-hidden="true" className="nav-indicator pointer-events-none absolute inset-y-0 left-1 flex w-[calc((100%-8px)/5)] justify-center" style={{ transform: `translate3d(${Math.max(0, activeTab) * 100}%,0,0)`, opacity: activeTab < 0 ? 0 : 1 }}>
            <span className="mt-[10px] h-8 w-12 rounded-full bg-gradient-to-br from-vivo to-leco shadow-[0_6px_14px_-6px_rgba(20,128,107,.9)]" />
          </span>
          {TABS.map((t, i) => {
            const on = i === activeTab;
            return (
              <button key={t.id} type="button" onClick={() => d.go(t.id)} aria-current={page === t.id ? 'page' : undefined}
                className={`relative flex min-w-0 flex-col items-center gap-1 text-[10px] font-semibold transition-colors duration-300 ${on ? 'text-ink' : 'text-ink/60'}`}>
                <span className={`grid h-8 w-12 place-items-center rounded-full transition-colors duration-300 ${on ? 'text-white' : ''}`}><Icon name={t.icon} size={19} /></span>
                {t.label}
              </button>
            );
          })}
        </nav>
        {page !== 'mais' && page !== 'config' && (
          <button type="button" className="fab-corner fixed right-[max(18px,var(--safe-right))] bottom-[calc(98px+var(--safe-bottom))] z-40 size-[58px]" onClick={() => d.openModal({ kind: 'tx' })} aria-label="Nova transação">
            <Icon name="plus" size={26} strokeWidth={2.6} />
          </button>
        )}
      </div>
    </NarrowCtx.Provider>
  );
}

/* ---------- App autenticado ---------- */
function Workspace({ backend, session, toast, toastNode }) {
  const { data, error, freshIds, actions } = useLecoData(backend, session, toast);
  const { w } = useViewport();
  const wide = !NATIVE && w >= 1024;
  const [page, setPage] = useState('inicio');
  const [settingsSub, setSettingsSub] = useState('perfil');
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [modal, setModal] = useState(null);
  const [calm, setCalm] = useLocal('leco.calm', false);
  const theme = data && data.profile && data.profile.theme === 'dark' ? 'dark' : 'light';
  useEffect(() => { document.documentElement.dataset.leco = theme; try { if (window.LecoAndroid) window.LecoAndroid.setDarkBars(theme === 'dark'); } catch (e) { /* sem ponte nativa */ } }, [theme]);
  useEffect(() => { document.documentElement.dataset.calm = calm ? '1' : '0'; }, [calm]);
  useEffect(() => { if (data && NATIVE) { const t = setTimeout(() => scheduleReminders(data), 1500); return () => clearTimeout(t); } return undefined; }, [data]);

  const navRef = useRef({});
  navRef.current = { page, modal };
  const go = useCallback((id) => { setPage(id); setModal(null); window.scrollTo({ top: 0, behavior: 'auto' }); }, []);
  useEffect(() => {
    const capApp = Native.App;
    if (!capApp) return undefined;
    const h = capApp.addListener('backButton', () => {
      const st = navRef.current;
      if (st.modal) setModal(null);
      else if (st.page === 'config' || MOBILE_MENU.some((x) => x.id === st.page)) go('mais');
      else if (st.page !== 'inicio') go('inicio');
      else if (capApp.exitApp) capApp.exitApp();
    });
    return () => { Promise.resolve(h).then((x) => x && x.remove && x.remove()); };
  }, []);

  const ctx = useMemo(() => {
    if (!data) return null;
    const balances = accountBalances(data.accounts, data.transactions);
    const alerts = buildAlerts({ txs: data.transactions, cards: data.cards, cats: data.categories, goals: data.goals, profile: data.profile, month: monthKey(todayISO()) });
    return {
      ...data, ...actions, backend, session, toast, freshIds, balances, alerts,
      name: data.profile.name || '', hide: !!data.profile.hide_values, theme, calm, setCalm,
      page, go, settingsSub, setSettingsSub, month, setMonth,
      modal, openModal: (m) => setModal({ key: Date.now(), ...m }),
      // Fecha com animação de saída: marca como "fechando" e remove depois de 220 ms
      closeModal: () => setModal((cur) => { if (!cur || cur.closing) return cur; const k = cur.key; setTimeout(() => setModal((x) => (x && x.key === k ? null : x)), reducedMotion() ? 0 : 220); return { ...cur, closing: true }; }),
      exportPDF: async (name, make) => { try { const bytes = await make(); await exportFile(name, bytes, 'application/pdf'); toast(NATIVE ? 'PDF pronto para salvar ou enviar' : 'PDF baixado'); } catch (e) { console.error(e); toast('Não foi possível gerar o PDF.', null, true); } },
      exportFile: async (name, content, mime) => { try { await exportFile(name, content, mime); toast(NATIVE ? 'Ficheiro pronto para salvar ou enviar' : 'Download iniciado'); } catch (e) { toast('Não foi possível exportar o ficheiro.', null, true); } },
      signOut: async () => { try { await backend.auth.signOut(); } catch (e) { toast(e.message, null, true); } },
    };
  }, [data, freshIds, page, settingsSub, month, modal, theme, calm]);

  if (error && !data) {
    return (
      <AuthShell>
        <div className="text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-coral/15 text-out"><Icon name="alert" size={30} /></span>
          <h1 className="mt-4 text-[20px] font-extrabold tracking-[-0.02em]">Não foi possível carregar seus dados</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink/75">{error}</p>
          <div className="mt-5 flex justify-center gap-2"><button type="button" className="btn btn-primary" onClick={actions.reload}><Icon name="refresh" size={16} />Tentar de novo</button><button type="button" className="btn btn-ghost" onClick={() => backend.auth.signOut()}>Sair</button></div>
        </div>
      </AuthShell>
    );
  }
  if (!ctx) return <SplashScreen text="Carregando seus dados…" />;
  if (!data.profile.onboarded) return <ThemeCtx.Provider value={theme}><Onboarding backend={backend} session={session} profile={data.profile} onDone={actions.reload} /></ThemeCtx.Provider>;
  return (
    <ThemeCtx.Provider value={theme}>
      <AppCtx.Provider value={ctx}>
        {wide ? <WebLayout /> : <MobileLayout />}
        <ModalHost />
        {toastNode(wide ? 24 : 100)}
      </AppCtx.Provider>
    </ThemeCtx.Provider>
  );
}

/* ---------- Entrada: login ou app ---------- */
function Root() {
  const backend = useMemo(() => createBackend(), []);
  const [session, setSession] = useState(undefined);
  const [screen, setScreen] = useState({ name: 'login' });
  const [recovery, setRecovery] = useState(() => /[?&]redefinir=1/.test(window.location.search));
  const [toastState, setToast] = useState(null);
  const toast = useCallback((msg, action, error) => setToast({ id: Date.now(), msg, action, error }), []);
  useEffect(() => {
    if (!toastState) return undefined;
    const t = setTimeout(() => setToast(null), toastState.action ? 6000 : toastState.error ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toastState]);
  useEffect(() => {
    if (!backend) return undefined;
    let alive = true;
    backend.auth.getSession().then((s) => { if (alive) setSession(s || null); }).catch(() => alive && setSession(null));
    const off = backend.auth.onChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s || null);
      if (event === 'SIGNED_OUT') { setScreen({ name: 'login' }); document.documentElement.dataset.leco = 'light'; try { if (window.LecoAndroid) window.LecoAndroid.setDarkBars(false); } catch (e) { /* sem ponte nativa */ } }
    });
    let linkHandle = null;
    if (Native.App) {
      linkHandle = Native.App.addListener('appUrlOpen', ({ url }) => { backend.auth.handleDeepLink(url).catch((e) => toast(e.message, null, true)); });
    }
    return () => { alive = false; off(); if (linkHandle) Promise.resolve(linkHandle).then((h) => h && h.remove && h.remove()); };
  }, [backend]);
  useEffect(() => {
    if (window.location.search && /code=|redefinir=|error/.test(window.location.search) && session !== undefined) {
      const clean = window.location.pathname + window.location.hash;
      setTimeout(() => window.history.replaceState(null, '', clean), 300);
    }
  }, [session]);

  const toastNode = (bottom) => <Toast toast={toastState} onClose={() => setToast(null)} bottom={bottom} />;
  const go = (name, extra = {}) => setScreen({ name, ...extra });
  let content;
  if (!backend) content = <ConfigMissingScreen />;
  else if (session === undefined) content = <SplashScreen />;
  else if (session && recovery) content = <ResetPasswordScreen backend={backend} onDone={() => { setRecovery(false); toast('Senha alterada. Você já está dentro.'); }} />;
  else if (session) return <><Atmosphere /><Workspace key={session.user.id} backend={backend} session={session} toast={toast} toastNode={toastNode} /></>;
  else if (screen.name === 'signup') content = <SignupScreen backend={backend} go={go} />;
  else if (screen.name === 'check') content = <CheckEmailScreen backend={backend} go={go} email={screen.email} />;
  else if (screen.name === 'forgot') content = <ForgotScreen backend={backend} go={go} />;
  else content = <LoginScreen backend={backend} go={go} notice={screen.notice} />;
  return <ThemeCtx.Provider value="light"><Atmosphere />{content}{toastNode(24)}</ThemeCtx.Provider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
