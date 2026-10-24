/* =====================================================================
   27-demo: modo demonstração e moldura de celular.
   - Demonstração: conta de exemplo com dados fictícios, guardada só neste
     navegador (localStorage). Não toca no Supabase nem na conta real.
   - Moldura (?moldura=1): mostra o app dentro de um celular, com barra de
     status (hora, sinal, Wi-Fi, bateria) e indicador de início. Só no computador.
   ===================================================================== */
const DEMO_FLAG = 'leco.demo';
const DEMO_STORE = 'leco.demo.data.v1';
const EMBED = /[?&]embed=1/.test(window.location.search);
const MOCKUP = !NATIVE && !EMBED && /[?&]moldura=1/.test(window.location.search) && window.innerWidth >= 700;

if (/[?&]demo=1/.test(window.location.search)) { try { localStorage.setItem(DEMO_FLAG, '1'); } catch (e) { /* ok */ } }
const demoOn = () => { try { return localStorage.getItem(DEMO_FLAG) === '1'; } catch (e) { return false; } };
function enterDemo(mockup = false) {
  try { localStorage.setItem(DEMO_FLAG, '1'); } catch (e) { /* ok */ }
  window.location.href = `${window.location.pathname}?demo=1${mockup ? '&moldura=1' : ''}`;
}
function leaveDemo() {
  try { localStorage.removeItem(DEMO_FLAG); } catch (e) { /* ok */ }
  window.location.href = window.location.pathname;
}
function resetDemo() {
  try { localStorage.removeItem(DEMO_STORE); } catch (e) { /* ok */ }
  window.location.reload();
}
// Dentro da moldura, o app respeita a barra de status e o indicador de início do "celular"
if (EMBED) {
  const r = document.documentElement.style;
  r.setProperty('--safe-top', '48px');
  r.setProperty('--safe-bottom', '22px');
}

/* ---------- Dados fictícios ---------- */
function seedDemo(store, userId) {
  const now = new Date().toISOString();
  const today = todayISO();
  const m0 = monthKey(today);
  const months = [shiftMonth(m0, -2), shiftMonth(m0, -1), m0];
  const add = (table, row) => { const r = { id: uid(), user_id: userId, created_at: now, ...row }; store[table].push(r); return r; };
  const cat = (name) => (store.categories.find((c) => c.user_id === userId && c.name === name) || {}).id || null;
  store.categories.forEach((c) => {
    if (c.user_id !== userId) return;
    if (c.name === 'Alimentação') c.budget = 120000;
    if (c.name === 'Lazer') c.budget = 35000;
    if (c.name === 'Transporte') c.budget = 25000;
  });
  const nu = add('accounts', { name: 'Conta corrente', kind: 'corrente', initial_balance: 245000, color: '#8C7AB8', icon: null, archived: false, is_reserve: false });
  const wallet = add('accounts', { name: 'Carteira', kind: 'carteira', initial_balance: 18000, color: '#E8A317', icon: null, archived: false, is_reserve: false });
  const reserve = add('accounts', { name: 'Reserva', kind: 'poupanca', initial_balance: 800000, color: '#14806B', icon: null, archived: false, is_reserve: true });
  const card = add('cards', { name: 'Cartão Visa', limit_amount: 600000, closing_day: 3, due_day: 10, color: '#0F5C4D', pay_account_id: nu.id, archived: false, icon: null });

  const base = { description: '', category_id: null, account_id: null, to_account_id: null, card_id: null, invoice: null, installment: null, installments: null, group_id: null, recurring_id: null, paid: true, notes: null, tags: [], split_id: null, attachment: null, orig_amount: null, orig_currency: null, is_adjustment: false, debt_id: null, goal_id: null };
  const tx = (row) => {
    if (row.date > today && row.paid !== false) return null; // gastos do dia a dia só até hoje
    const r = { ...base, ...row };
    if (r.card_id) r.invoice = invoiceOf(card, r.date);
    return add('transactions', r);
  };
  const recs = [
    { kind: 'in', amount: 650000, description: 'Salário', day: 5, category_id: cat('Salário'), account_id: nu.id },
    { kind: 'out', amount: 180000, description: 'Aluguel', day: 10, category_id: cat('Moradia'), account_id: nu.id },
    { kind: 'out', amount: 9990, description: 'Internet', day: 20, category_id: cat('Contas e serviços'), account_id: nu.id },
    { kind: 'out', amount: 5590, description: 'Streaming', day: 12, category_id: cat('Assinaturas'), card_id: card.id },
  ].map((r) => ({ ...r, rec: add('recurrings', { kind: r.kind, amount: r.amount, description: r.description, frequency: 'monthly', next_date: dayIn(shiftMonth(m0, 1), r.day), end_date: null, active: true, category_id: r.category_id, account_id: r.account_id || null, card_id: r.card_id || null, tags: [] }) }));

  const daily = [
    ['Mercado', 'Alimentação', [32450, 29870, 34190], 3, true], ['Padaria', 'Alimentação', [2890, 3450, 2760], 8, false],
    ['Mercado', 'Alimentação', [18790, 21340, 19980], 11, true], ['Restaurante', 'Alimentação', [8900, 11250, 7640], 16, true],
    ['Mercado', 'Alimentação', [41230, 38760, 36540], 18, true], ['Feira', 'Alimentação', [6500, 5800, 7200], 24, false],
    ['Uber', 'Transporte', [2350, 1980, 2790], 7, true], ['Combustível', 'Transporte', [18000, 16500, 19000], 14, true], ['Uber', 'Transporte', [3180, 2640, 2210], 22, true],
    ['Farmácia', 'Saúde', [6420, 3890, 5170], 9, false], ['Cinema', 'Lazer', [7200, 0, 9600], 23, true], ['Livraria', 'Educação', [0, 8990, 0], 19, true],
    ['Roupas', 'Compras', [0, 23990, 0], 27, true],
  ];
  months.forEach((k, mi) => {
    recs.forEach((r) => {
      const date = dayIn(k, r.day);
      const pending = date > today && !r.card_id;
      if (date > dayIn(m0, 31)) return;
      if (date > today && r.card_id) return;
      tx({ kind: r.kind, amount: r.amount, description: r.description, date, category_id: r.category_id, account_id: r.account_id || null, card_id: r.card_id || null, recurring_id: r.rec.id, paid: !pending });
    });
    const luz = dayIn(k, 15);
    if (luz <= today) tx({ kind: 'out', amount: [17840, 19230, 18990][mi], description: 'Conta de luz', date: luz, category_id: cat('Contas e serviços'), account_id: nu.id });
    else tx({ kind: 'out', amount: 18990, description: 'Conta de luz', date: luz, category_id: cat('Contas e serviços'), account_id: nu.id, paid: false });
    daily.forEach(([desc, c, amounts, day, onCard]) => {
      const amount = amounts[mi];
      if (!amount) return;
      tx({ kind: 'out', amount, description: desc, date: dayIn(k, day), category_id: cat(c), card_id: onCard ? card.id : null, account_id: onCard ? null : (desc === 'Feira' || desc === 'Padaria' ? wallet.id : nu.id), tags: desc === 'Restaurante' ? ['lazer'] : [] });
    });
    tx({ kind: 'transfer', amount: 50000, description: 'Guardar na reserva', date: dayIn(k, 6), account_id: nu.id, to_account_id: reserve.id });
    if (mi === 1) tx({ kind: 'in', amount: 120000, description: 'Projeto de design', date: dayIn(k, 25), category_id: cat('Freelance'), account_id: nu.id });
  });
  // Faturas vencidas já pagas
  const inv = {};
  store.transactions.forEach((t) => { if (t.user_id === userId && t.card_id === card.id && t.kind === 'out') inv[t.invoice] = (inv[t.invoice] || 0) + t.amount; });
  Object.entries(inv).forEach(([invoice, total]) => {
    const due = invoiceDue(card, invoice);
    if (due < today) add('transactions', { ...base, kind: 'card_payment', amount: total, date: due, account_id: nu.id, card_id: card.id, invoice, description: `Fatura ${card.name} · ${invoiceLabel(invoice)}` });
  });
  add('goals', { name: 'Reserva de emergência', target: 2000000, saved: 800000, due: dayIn(shiftMonth(m0, 10), 28), icon: 'shield', monthly_amount: 50000, account_id: reserve.id, remind_day: 6 });
  add('goals', { name: 'Viagem de férias', target: 600000, saved: 185000, due: dayIn(shiftMonth(m0, 6), 15), icon: 'plane', monthly_amount: 0, account_id: null, remind_day: null });
  add('templates', { name: 'Café', kind: 'out', amount: 850, description: 'Café', category_id: cat('Alimentação'), account_id: wallet.id, card_id: null, tags: [], uses: 3 });
  add('debts', { name: 'Notebook parcelado', direction: 'owe', person: 'Loja', total: 360000, paid: 120000, interest: 0, installments: 12, installment_amount: 30000, due_day: 15, start_date: dayIn(shiftMonth(m0, -4), 15), account_id: nu.id, notes: null, closed: false });
}

/* ---------- Selo do modo demonstração ---------- */
function DemoBadge({ wide }) {
  if (EMBED) return null;
  if (!wide) {
    return (
      <div className="glass-deep fixed left-3 bottom-[calc(104px+var(--safe-bottom))] z-[60] flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1 text-[11.5px] font-bold">
        <span className="size-2 rounded-full bg-ouro shadow-[0_0_10px_rgba(232,163,23,.8)]" aria-hidden="true" />
        <span>Demonstração</span>
        <button type="button" className="btn btn-ghost !px-2.5 !py-1 text-[11px]" onClick={() => leaveDemo()}>Sair</button>
      </div>
    );
  }
  return (
    <div className="glass-deep fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1.5 rounded-full py-1.5 pl-3 pr-1.5 text-[12px] font-bold">
      <span className="size-2 rounded-full bg-ouro shadow-[0_0_10px_rgba(232,163,23,.8)]" aria-hidden="true" />
      <span className="whitespace-nowrap">Demonstração · dados fictícios</span>
      <button type="button" className="btn btn-ghost !px-2.5 !py-1 text-[11.5px]" onClick={() => enterDemo(true)}><Icon name="phone" size={13} />Ver no celular</button>
      <button type="button" className="btn btn-ghost !px-2.5 !py-1 text-[11.5px]" onClick={() => resetDemo()} data-tip="Volta aos dados de exemplo">Recomeçar</button>
      <button type="button" className="btn btn-primary !px-2.5 !py-1 text-[11.5px]" onClick={() => leaveDemo()}>Sair</button>
    </div>
  );
}

/* ---------- Moldura de celular ---------- */
function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return t;
}
function useBattery() {
  const [b, setB] = useState({ level: 0.82, charging: false });
  useEffect(() => {
    let bat = null; let alive = true;
    const upd = () => alive && bat && setB({ level: bat.level, charging: bat.charging });
    if (navigator.getBattery) navigator.getBattery().then((x) => { bat = x; upd(); x.addEventListener('levelchange', upd); x.addEventListener('chargingchange', upd); }).catch(() => {});
    return () => { alive = false; if (bat) { bat.removeEventListener('levelchange', upd); bat.removeEventListener('chargingchange', upd); } };
  }, []);
  return b;
}
function StatusIcons({ battery, online }) {
  const lvl = Math.max(0.05, Math.min(1, battery.level));
  return (
    <span className="flex items-center gap-[6px]" aria-hidden="true">
      <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
        {[0, 1, 2, 3].map((i) => <rect key={i} x={i * 4.6} y={9 - i * 3} width="3.2" height={3 + i * 3} rx="1" opacity={online || i < 1 ? 1 : 0.3} />)}
      </svg>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" opacity={online ? 1 : 0.35}>
        <path d="M1.5 4.2a9.5 9.5 0 0 1 13 0" /><path d="M4 7a6 6 0 0 1 8 0" /><circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none" />
      </svg>
      <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
        <rect x="0.6" y="0.6" width="22.8" height="11.8" rx="3.6" stroke="currentColor" strokeOpacity=".4" strokeWidth="1.2" />
        <rect x="2.4" y="2.4" width={19.2 * lvl} height="8.2" rx="2.2" fill={lvl <= 0.2 && !battery.charging ? '#F08A6B' : 'currentColor'} />
        <path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="currentColor" fillOpacity=".45" />
        {battery.charging && <path d="M12.6 2.6 9.4 7h2.6l-1 3.4L14.6 6H12z" fill="#34C39B" />}
      </svg>
    </span>
  );
}
function PhoneMockup() {
  const now = useClock();
  const battery = useBattery();
  const [online, setOnline] = useState(navigator.onLine !== false);
  const [dark, setDark] = useState(false);
  const frame = useRef(null);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    // acompanha o tema do app dentro do celular para a cor da barra de status
    const i = setInterval(() => { try { const el = frame.current && frame.current.contentDocument && frame.current.contentDocument.documentElement; if (el) setDark(el.dataset.leco === 'dark'); } catch (e) { /* ok */ } }, 600);
    document.title = 'Leco · no celular';
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(i); };
  }, []);
  const src = `${window.location.pathname}?${window.location.search.replace(/^\?/, '').split('&').filter((p) => p && !/^moldura=/.test(p)).concat('embed=1').join('&')}`;
  const hhmm = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const fg = dark ? '#F2F8F5' : '#0B2F29';
  const demo = demoOn();
  return (
    <ThemeCtx.Provider value="light">
      <Atmosphere />
      <main className="relative z-10 flex min-h-dvh flex-wrap items-center justify-center gap-10 p-8">
        <div className="max-w-[300px]">
          <Logo />
          <h1 className="mt-5 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">O Leco no seu celular</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink/70">Esta é a mesma versão do app instalado (APK), com a tela de um smartphone. {demo ? 'Os dados são fictícios e ficam só neste navegador.' : ''}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => { window.location.href = src.replace(/(&|\?)embed=1/, ''); }}><Icon name="monitor" size={16} />Tela cheia</button>
            {demo && <button type="button" className="btn btn-ghost" onClick={resetDemo}><Icon name="refresh" size={16} />Recomeçar</button>}
            {demo && <button type="button" className="btn btn-primary" onClick={leaveDemo}>Sair da demonstração</button>}
          </div>
        </div>
        <div className="phone shrink-0">
          <div className="phone-screen">
            <iframe ref={frame} title="Leco no celular" src={src} className="absolute inset-0 size-full border-0" />
            <div className="statusbar" style={{ color: fg }}>
              <span className="tabular-nums" aria-label={`Hora ${hhmm}`}>{hhmm}</span>
              <StatusIcons battery={battery} online={online} />
            </div>
            <div className="island" />
            <div className="home-indicator" style={{ background: fg, opacity: 0.85 }} />
          </div>
        </div>
      </main>
    </ThemeCtx.Provider>
  );
}
