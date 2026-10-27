/* =====================================================================
   40-forms: janelas de criar e editar (transação, conta, cartão, pagamento
   de fatura, recorrência, categoria, meta) e itens de lista reutilizáveis.
   ===================================================================== */
const sheetVariant = () => (NATIVE || window.innerWidth < 768 ? 'sheet' : 'dialog');

function txMeta(t, d) {
  const cat = d.categories.find((c) => c.id === t.category_id);
  const acc = d.accounts.find((a) => a.id === t.account_id);
  const to = d.accounts.find((a) => a.id === t.to_account_id);
  const card = d.cards.find((c) => c.id === t.card_id);
  if (t.is_adjustment) return { icon: 'scale', color: '#5E8CA6', title: t.description || 'Ajuste de saldo', sub: `${acc ? acc.name : 'Conta'} · ajuste (fora dos relatórios)`, tone: 'text-ink', sign: t.kind === 'in' ? '+' : '−' };
  if (t.kind === 'transfer') return { icon: 'swap', color: '#5E8CA6', title: t.description || 'Transferência', sub: `${acc ? acc.name : '?'} → ${to ? to.name : '?'}`, tone: 'text-ink', sign: '' };
  if (t.kind === 'card_payment') return { icon: 'card', color: card ? card.color : '#0F5C4D', title: t.description || `Pagamento da fatura ${card ? card.name : ''}`, sub: `${acc ? acc.name : 'Conta'} · fatura de ${t.invoice ? invoiceLabel(t.invoice) : ''}`, tone: 'text-ink', sign: '−' };
  const where = card ? `${card.name}${t.invoice ? ` · fatura ${monthShort(t.invoice).toLowerCase()}` : ''}` : acc ? acc.name : 'Sem conta';
  return {
    icon: cat ? cat.icon : t.kind === 'in' ? 'inArrow' : 'tag', color: cat ? cat.color : '#9AA9A4',
    title: t.description || (cat ? cat.name : 'Sem descrição'), sub: `${cat ? cat.name : 'Sem categoria'} · ${where}`,
    tone: t.kind === 'in' ? 'text-in' : 'text-out', sign: t.kind === 'in' ? '+' : '−',
  };
}

function TxItem({ t, onOpen: openTx, onConfirm, showDate = true, dense = false, select }) {
  // select = { on, toggle }: modo de seleção (edição em massa); tocar marca/desmarca
  const onOpen = select ? () => select.toggle(t) : openTx;
  const d = useApp();
  const m = useMoneyText();
  const meta = txMeta(t, d);
  // Gestos (celular): arrastar para a esquerda exclui, para a direita marca como pago
  const inner = useRef(null);
  const g = useRef(null);
  const [dx, setDx] = useState(0);
  const canSwipe = LITE && !!onOpen && !select && t.kind !== 'card_payment';
  const down = (e) => { if (!canSwipe || e.pointerType === 'mouse') return; g.current = { x: e.clientX, y: e.clientY, on: false }; };
  const move = (e) => {
    const s = g.current; if (!s) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!s.on) { if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.4) { s.on = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } } else if (Math.abs(my) > 10) { g.current = null; return; } else return; }
    const lim = !t.paid && onConfirm ? 120 : 0;
    setDx(Math.max(-120, Math.min(lim, mx)));
  };
  const up = () => {
    const s = g.current; g.current = null;
    if (!s || !s.on) return;
    if (dx <= -90) { haptic('heavy'); setDx(0); d.openModal({ kind: 'deleteTx', t }); return; }
    if (dx >= 90 && !t.paid && onConfirm) { haptic('success'); onConfirm(t); }
    setDx(0);
  };
  const tagLine = (t.tags && t.tags.length ? ` · ${t.tags.map((x) => `#${x}`).join(' ')}` : '') + (t.orig_currency ? ` · ${fmtForeign(t.orig_amount, t.orig_currency)}` : '');
  return (
    <li className={`relative overflow-hidden rounded-2xl ${d.freshIds.includes(t.id) ? 'flash' : ''}`}>
      {dx !== 0 && (
        <div className="absolute inset-0 flex items-center justify-between px-4 text-[12.5px] font-bold" aria-hidden="true">
          <span className={`flex items-center gap-1.5 text-in ${dx > 0 ? 'opacity-100' : 'opacity-0'}`}><Icon name="check" size={16} strokeWidth={2.4} />{t.kind === 'in' ? 'Recebi' : 'Paguei'}</span>
          <span className={`flex items-center gap-1.5 text-out ${dx < 0 ? 'opacity-100' : 'opacity-0'}`}>Excluir<Icon name="trash" size={16} /></span>
        </div>
      )}
      <div ref={inner} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className={`group relative flex items-center gap-3 rounded-2xl px-1.5 ${dense ? 'py-2' : 'py-2.5'} transition-colors hover:bg-ink/[0.03] ${dx !== 0 ? 'bg-[var(--paper)]' : ''}`}
        style={{ transform: dx ? `translate3d(${dx}px,0,0)` : undefined, transition: g.current ? 'none' : 'transform .25s cubic-bezier(.2,.8,.2,1)', touchAction: 'pan-y' }}>
        {select && <span role="checkbox" aria-checked={select.on} aria-label={`Selecionar ${meta.title}`} tabIndex={0} onClick={() => select.toggle(t)} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); select.toggle(t); } }} className={`grid size-5 shrink-0 cursor-pointer place-items-center rounded-md border-2 ${select.on ? 'border-vivo bg-vivo text-white' : 'border-ink/25'}`}>{select.on && <Icon name="check" size={12} strokeWidth={3} />}</span>}
        <button type="button" onClick={() => onOpen && onOpen(t)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={select ? `Selecionar ${meta.title}` : `Abrir ${meta.title}`}>
          <ColorIcon icon={meta.icon} color={meta.color} size={dense ? 36 : 40} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[14px] font-semibold">{meta.title}</span>
              {t.attachment && <Icon name="clip" size={13} className="shrink-0 text-ink/50" />}
            </span>
            <span className="block truncate text-xs text-ink/65">{!t.paid && <span className={`mr-1.5 ${t.date < todayISO() ? 'pill pill-bad' : 'badge-gold'} !px-1.5 !py-0 !text-[10px]`}>{t.date < todayISO() ? 'atrasado' : t.kind === 'in' ? 'a receber' : 'a pagar'}</span>}{meta.sub}{showDate ? ` · ${fmtDate(t.date)}` : ''}{tagLine}</span>
          </span>
        </button>
        {!t.paid && onConfirm && !select && (
          <button type="button" className={`btn btn-ghost shrink-0 text-xs ${LITE ? '!size-9 !p-0' : '!px-3 !py-1.5'}`} aria-label={t.kind === 'in' ? 'Recebi' : 'Paguei'} onClick={() => onConfirm(t)}>
            <Icon name="check" size={14} strokeWidth={2.4} />{LITE ? null : t.kind === 'in' ? 'Recebi' : 'Paguei'}
          </button>
        )}
        <span className={`shrink-0 whitespace-nowrap text-[14px] font-extrabold tabular-nums ${meta.tone} ${!t.paid ? 'opacity-60' : ''}`}>{meta.sign}{meta.sign ? ' ' : ''}{m(t.amount)}</span>
        {!LITE && onOpen && !select && t.kind !== 'card_payment' && (
          <span className="row-actions flex shrink-0 items-center gap-1">
            <button type="button" className="icon-btn size-8" aria-label="Editar" onClick={() => onOpen(t)}><Icon name="edit" size={14} /></button>
            <button type="button" className="icon-btn size-8 hover:!bg-coral/15 hover:text-out" aria-label="Excluir" onClick={() => d.openModal({ kind: 'deleteTx', t })}><Icon name="trash" size={14} /></button>
          </span>
        )}
      </div>
    </li>
  );
}

function ChoiceChips({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-semibold transition-all ${on ? 'border-vivo/60 bg-vivo/15 text-ink shadow-[0_0_0_3px_rgba(20,128,107,.12)]' : 'border-ink/12 bg-ink/[0.03] text-ink/75 hover:bg-ink/[0.06]'}`}>
            {o.icon && <span style={{ color: o.color }}><Icon name={o.icon} size={15} /></span>}{o.label}
          </button>
        );
      })}
    </div>
  );
}

function DateField({ id, value, onChange, label = 'Data', error }) {
  return (
    <Field label={label} error={error} hint={value ? fmtDate(value) : ''}>
      <input id={id} type="date" className="field" value={value || ''} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} />
    </Field>
  );
}

function DaySelect({ id, value, onChange }) {
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Dia {d}</option>)}
    </select>
  );
}

function SignedMoney({ id, cents, onChange, label }) {
  const neg = cents < 0;
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(-cents)} aria-label={neg ? 'Saldo negativo; tocar para positivo' : 'Saldo positivo; tocar para negativo'}
        className={`grid w-12 shrink-0 place-items-center rounded-[14px] border text-lg font-extrabold ${neg ? 'border-coral/50 bg-coral/10 text-out' : 'border-ink/12 bg-ink/[0.03] text-in'}`}>{neg ? '−' : '+'}</button>
      <MoneyInput id={id} label={label} cents={Math.abs(cents)} onChange={(v) => onChange(neg ? -v : v)} className="font-bold" />
    </div>
  );
}

function ConfirmBlock({ title, text, confirmLabel, onConfirm, onCancel, busy }) {
  return (
    <div className="mt-6 rounded-2xl border border-coral/40 bg-coral/10 p-4">
      <p className="text-sm font-bold">{title}</p>
      {text && <p className="mt-1 text-xs leading-relaxed text-ink/75">{text}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost flex-1 !py-2" onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn btn-danger flex-1 !py-2" disabled={busy} onClick={onConfirm}>{busy ? <Spinner size={14} /> : null}{confirmLabel}</button>
      </div>
    </div>
  );
}

// Opções de exclusão de um lançamento (parcelas, recorrência, compra dividida ou simples)
function DeleteTxChoices({ t, busy, onCancel, onPick, flat = false }) {
  const box = flat ? '' : 'mt-6 rounded-2xl border border-coral/40 bg-coral/10 p-4';
  if (t.recurring_id) {
    return <ScopeChoice danger what={'Lançamento de uma recorrência. "Esta e as próximas" encerra a recorrência; "Todas" também apaga a recorrência.'} busy={busy} onCancel={onCancel} onPick={onPick} />;
  }
  if (t.split_id) {
    return (
      <div className={box}>
        <p className="text-sm font-bold">Excluir compra dividida?</p>
        <p className="mt-1 text-xs text-ink/75">Você pode excluir só esta parte ou a compra inteira.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button type="button" className="btn btn-ghost !py-2" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn btn-ghost !py-2" disabled={busy} onClick={() => onPick('one')}>Só esta parte</button>
          <button type="button" className="btn btn-danger !py-2" disabled={busy} onClick={() => onPick('split')}>Compra inteira</button>
        </div>
      </div>
    );
  }
  if (t.group_id) {
    return (
      <div className={box}>
        <p className="text-sm font-bold">Excluir compra parcelada?</p>
        <p className="mt-1 text-xs text-ink/75">Parcela {t.installment} de {t.installments}.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <button type="button" className="btn btn-ghost !py-2" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn btn-ghost !py-2" disabled={busy} onClick={() => onPick('one')}>Só esta</button>
          <button type="button" className="btn btn-ghost !py-2" disabled={busy} onClick={() => onPick('next')}>Esta e as próximas</button>
          <button type="button" className="btn btn-danger !py-2" disabled={busy} onClick={() => onPick('group')}>Todas</button>
        </div>
      </div>
    );
  }
  if (flat) {
    return (
      <div className="mt-5 flex gap-2">
        <button type="button" className="btn btn-ghost flex-1" onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn btn-danger flex-1" disabled={busy} onClick={() => onPick('one')}>{busy ? <Spinner size={14} /> : <Icon name="trash" size={16} />}Excluir</button>
      </div>
    );
  }
  return <ConfirmBlock title="Excluir esta transação?" text="Os saldos são recalculados na hora." confirmLabel="Excluir" busy={busy} onConfirm={() => onPick('one')} onCancel={onCancel} />;
}

// Exclusão rápida (pela lista): pede confirmação antes de apagar
function DeleteTxSheet({ t, onClose }) {
  const d = useApp();
  const m = useMoneyText();
  const meta = txMeta(t, d);
  const [busy, setBusy] = useState(false);
  const titleId = cleanId(useId());
  const pick = async (scope) => { setBusy(true); const ok = await d.deleteTx(t, scope); setBusy(false); if (ok) onClose(); };
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-coral/15 text-out"><Icon name="trash" size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-[19px] font-extrabold tracking-[-0.02em]">Excluir transação?</h2>
          <p className="mt-0.5 text-[13px] text-ink/70">Os saldos são recalculados na hora.</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-ink/[0.04] px-3 py-2.5">
        <ColorIcon icon={meta.icon} color={meta.color} size={36} />
        <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{meta.title}</span><span className="block truncate text-xs text-ink/65">{meta.sub} · {fmtDate(t.date)}</span></span>
        <span className={`shrink-0 text-[14px] font-extrabold tabular-nums ${meta.tone}`}>{meta.sign}{meta.sign ? ' ' : ''}{m(t.amount)}</span>
      </div>
      <DeleteTxChoices t={t} busy={busy} onCancel={onClose} onPick={pick} flat />
    </Sheet>
  );
}

/* ---------- Transação ---------- */
function TxForm({ initial, defaultKind = 'out', presetSource, presetDate, scanFile, onClose }) {
  const d = useApp();
  const editing = !!(initial && initial.id);
  const accounts = d.accounts.filter((a) => !a.archived || (initial && (a.id === initial.account_id || a.id === initial.to_account_id)));
  const cards = d.cards.filter((c) => !c.archived || (initial && c.id === initial.card_id));
  const [kind, setKind] = useState(initial ? initial.kind : defaultKind);
  const [amount, setAmount] = useState(initial ? initial.amount : 0);
  const [desc, setDesc] = useState(initial ? (initial.installments ? initial.description.replace(/ \(\d+\/\d+\)$/, '') : initial.description) : '');
  const [date, setDate] = useState(initial ? initial.date : presetDate || todayISO());
  const firstCat = (k) => (d.categories.find((c) => c.kind === k && !c.archived) || {}).id || null;
  const [cat, setCat] = useState(initial ? initial.category_id : null);
  const [source, setSource] = useState(() => {
    if (initial && initial.card_id) return `card:${initial.card_id}`;
    if (initial && initial.account_id) return `acc:${initial.account_id}`;
    if (presetSource) return presetSource;
    const first = cashAccounts(accounts)[0] || accounts[0];
    return first ? `acc:${first.id}` : '';
  });
  const catUser = useRef(!!initial);
  const srcUser = useRef(!!initial || !!presetSource);
  const [ruleHit, setRuleHit] = useState(null);
  const pickCat = (id) => { catUser.current = true; setCat(id); };
  const [toAcc, setToAcc] = useState(initial && initial.to_account_id ? initial.to_account_id : (accounts[1] || accounts[0] || {}).id || '');
  const [installments, setInstallments] = useState(1);
  const [repeat, setRepeat] = useState(false);
  const [freq, setFreq] = useState('monthly');
  const [endDate, setEndDate] = useState('');
  const [paid, setPaid] = useState(initial ? initial.paid : true);
  const [paidTouched, setPaidTouched] = useState(editing);
  const [notes, setNotes] = useState(initial && initial.notes ? initial.notes : '');
  const [quickCat, setQuickCat] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  // Leco 3
  const [tags, setTags] = useState(initial && initial.tags ? initial.tags : []);
  const [split, setSplit] = useState(false);
  const [parts, setParts] = useState([{ key: 'a', category_id: '', amount: 0 }, { key: 'b', category_id: '', amount: 0 }]);
  const [foreign, setForeign] = useState(() => (initial && initial.orig_currency ? { on: true, currency: initial.orig_currency, orig: initial.orig_amount, origText: String((initial.orig_amount || 0) / 100).replace('.', ','), rate: initial.orig_amount ? initial.amount / initial.orig_amount : 0, rateText: initial.orig_amount ? (initial.amount / initial.orig_amount).toFixed(4).replace('.', ',') : '' } : { on: false, currency: 'USD', orig: 0, origText: '', rate: 0, rateText: '' }));
  const [attachment, setAttachment] = useState(initial && initial.attachment ? initial.attachment : null);
  const [pendingFile, setPendingFile] = useState(null);
  const [askScope, setAskScope] = useState(false);
  const [more, setMore] = useState(!!(initial && ((initial.tags && initial.tags.length) || initial.attachment || initial.orig_currency || initial.notes)));
  const v3 = d.v3;
  const titleId = cleanId(useId());
  const isCard = source.startsWith('card:');
  const card = isCard ? cards.find((c) => c.id === source.slice(5)) : null;
  useEffect(() => { if (!paidTouched) setPaid(date <= todayISO()); }, [date]);
  useEffect(() => { if (kind === 'in' && isCard) setSource(accounts[0] ? `acc:${accounts[0].id}` : ''); if (kind !== 'out') setInstallments(1); if (kind === 'transfer') setRepeat(false); }, [kind]);
  // Regras automáticas: ao digitar a descrição, escolhe categoria e conta da regra
  useEffect(() => {
    if (editing || kind === 'transfer') return undefined;
    const tm = setTimeout(() => {
      const r = matchRule(desc, kind, d);
      setRuleHit(r && (r.category_id || r.source) ? r : null);
      if (r) {
        if (r.category_id && !catUser.current) setCat(r.category_id);
        if (r.source && !srcUser.current && ruleSourceOk(r.source, d, kind)) setSource(r.source);
      } else if (!catUser.current && desc.trim().length > 2) {
        const sg = suggestCategory(desc, kind, d);
        if (sg) setCat(sg);
      }
    }, 250);
    return () => clearTimeout(tm);
  }, [desc, kind]);
  const canSplit = kind === 'out' && !editing && !repeat;
  const canRepeat = kind !== 'transfer' && !editing && installments === 1;
  // Atalhos: Parcelada e Assinatura
  // À vista / Parcelado / Repete (assinatura, conta fixa ou receita fixa)
  const setPayMode = (m) => {
    if (m === 'once') { setRepeat(false); setInstallments(1); }
    if (m === 'parcel') { setRepeat(false); setSplit(false); setInstallments((n) => (n > 1 ? n : 2)); }
    if (m === 'repeat') { setInstallments(1); setSplit(false); setRepeat(true); setFreq((f) => f || 'monthly'); }
  };
  const srcAcc = source.startsWith('acc:') ? d.accounts.find((a) => a.id === source.slice(4)) : null;
  useEffect(() => {
    if (!isBenefit(srcAcc) || kind !== 'out' || cat) return;
    const food = d.categories.find((c) => c.kind === 'out' && !c.archived && !c.parent_id && normTxt(c.name) === 'alimentacao');
    if (food) setCat(food.id);
  }, [source]);
  const switchKind = (k) => { setKind(k); if (k !== 'out') setInstallments(1); if (k === 'transfer') setRepeat(false); if (cat && (d.categories.find((c) => c.id === cat) || {}).kind !== k) setCat(null); };
  const fallbackCat = (k) => { const n = k === 'in' ? 'outras receitas' : 'outros gastos'; const c = d.categories.find((x) => x.kind === k && x.name.toLowerCase() === n); return c ? c.id : firstCat(k); };
  const catList = d.categories.filter((c) => c.kind === kind && (!c.archived || c.id === cat));
  const catTop = catList.filter((c) => !c.parent_id || !catList.some((p) => p.id === c.parent_id));
  const selCat = catList.find((c) => c.id === cat);
  const selTop = selCat ? (selCat.parent_id && catList.some((p) => p.id === selCat.parent_id) ? selCat.parent_id : selCat.id) : null;
  const subCats = selTop ? catList.filter((c) => c.parent_id === selTop) : [];

  const createQuickCat = async () => {
    const name = (quickCat || '').trim();
    if (!name) return;
    const row = await d.saveCategory(null, { name, kind, icon: 'tag', color: SWATCHES[(catList.length * 5) % SWATCHES.length], budget: 0 });
    if (row) { setCat(row.id); setQuickCat(null); }
  };

  // Leitura do comprovante por IA: preenche o formulário e anexa a imagem
  const [scan, setScan] = useState(null);
  const doScan = async (file) => {
    setScan({ busy: true });
    try {
      const r = await readReceiptFile(d, file);
      if (!r || !r.encontrado) { setScan({ bad: true, text: 'Não reconheci um comprovante nessa imagem. Tente uma foto mais nítida, com o valor total aparecendo.' }); haptic('warn'); return; }
      const k = r.tipo === 'receita' ? 'in' : 'out';
      switchKind(k);
      if (Number(r.valor) > 0) setAmount(Math.round(Number(r.valor) * 100));
      const ds = String(r.descricao || r.estabelecimento || '').trim();
      if (ds) setDesc(ds.slice(0, 60));
      const iso = (x) => /^\d{4}-\d{2}-\d{2}$/.test(x || '') && !isNaN(Date.parse(x));
      if (r.vencimento && iso(r.vencimento)) { setDate(r.vencimento); setPaid(false); setPaidTouched(true); }
      else if (iso(r.data)) setDate(r.data);
      const cats = d.categories.filter((c) => c.kind === k && !c.archived);
      const n = normTxt(r.categoria);
      const c = n && (cats.find((x) => normTxt(x.name) === n) || cats.find((x) => normTxt(x.name).includes(n) || n.includes(normTxt(x.name))));
      if (c) setCat(c.id);
      const activeCards = cards.filter((x) => !x.archived);
      if (k === 'out' && r.forma === 'credito' && activeCards.length) {
        setSource(`card:${activeCards[0].id}`);
        if (Number(r.parcelas) > 1) setInstallments(Math.min(24, Math.round(Number(r.parcelas))));
      } else if (source.startsWith('card:') && accounts[0]) setSource(`acc:${accounts[0].id}`);
      if (Array.isArray(r.itens) && r.itens.length && !notes) setNotes(r.itens.slice(0, 5).join(', ').slice(0, 200));
      if (v3) { setPendingFile(file); setMore(true); }
      const low = typeof r.confianca === 'number' && r.confianca < 0.6;
      setScan({ warn: low, text: low ? 'Lido pela IA, mas com pouca certeza. Confira o valor e a data antes de salvar.' : `Lido pela IA${r.forma && r.forma !== 'outro' ? ` (${({ credito: 'crédito', debito: 'débito', pix: 'Pix', dinheiro: 'dinheiro', boleto: 'boleto', transferencia: 'transferência' })[r.forma] || r.forma})` : ''}. Confira os dados e toque em adicionar.` });
      haptic('success');
    } catch (x) {
      setScan({ bad: true, text: x.message || 'Não foi possível ler o comprovante agora.' });
      haptic('warn');
    }
  };
  useEffect(() => { if (scanFile) doScan(scanFile); }, []);
  const applyTemplate = (t) => {
    switchKind(t.kind); if (t.amount) setAmount(t.amount); setDesc(t.description || t.name); pickCat(t.category_id);
    if (t.card_id && cards.some((c) => c.id === t.card_id)) setSource(`card:${t.card_id}`); else if (t.account_id && accounts.some((a) => a.id === t.account_id)) setSource(`acc:${t.account_id}`);
    if (t.tags && t.tags.length) { setTags(t.tags); setMore(true); }
    d.backend.db.update('templates', t.id, { uses: (t.uses || 0) + 1 }).catch(() => {});
    haptic();
  };
  const saveTemplate = async () => {
    if (kind === 'transfer') return;
    const name = (desc.trim() || (d.categories.find((c) => c.id === cat) || {}).name || '').slice(0, 40);
    if (!name) { d.toast('Escreva uma descrição para o modelo.', null, true); return; }
    await d.saveRow('templates', null, { name, kind, amount, description: desc.trim(), category_id: cat, account_id: source.startsWith('acc:') ? source.slice(4) : null, card_id: isCard ? card.id : null, tags }, `Modelo "${name}" salvo`);
  };
  const duplicate = () => {
    const { id, created_at, group_id, installment, installments: _n, recurring_id, split_id, attachment: _a, ...copy } = initial;
    onClose();
    setTimeout(() => d.openModal({ kind: 'tx', initial: { ...copy, description: initial.installments ? desc : initial.description, date: todayISO(), paid: copy.card_id ? true : copy.paid } }), 240);
  };
  const submit = async (e, scopeArg) => {
    if (e) e.preventDefault();
    if (quickCat != null) { await createQuickCat(); return; }
    const er = {};
    if (amount <= 0) er.amount = 'Informe um valor maior que zero.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) er.date = 'Escolha a data.';
    if (kind === 'transfer') {
      if (!source.startsWith('acc:')) er.source = 'Escolha a conta de origem.';
      if (!toAcc || `acc:${toAcc}` === source) er.to = 'Escolha uma conta de destino diferente.';
    } else if (!source) er.source = 'Escolha de onde sai (ou para onde vai) o dinheiro.';
    if (repeat && endDate && endDate < date) er.end = 'O fim precisa ser depois da primeira data.';
    if (split && !editing && kind !== 'transfer') {
      if (parts.some((p) => !p.category_id || !p.amount)) er.split = 'Escolha a categoria e o valor de cada parte.';
      else if (sum(parts, (p) => p.amount) !== amount) er.split = 'A soma das partes precisa ser igual ao valor total.';
    }
    if (foreign.on && kind !== 'transfer' && !(foreign.orig > 0)) er.foreign = 'Informe o valor na outra moeda.';
    setErrors(er);
    if (Object.keys(er).length) return;
    // Parcelas ou recorrência: perguntar se a mudança vale para as outras também
    if (editing && (initial.group_id || initial.recurring_id) && !scopeArg) { setAskScope(true); return; }
    setBusy(true);
    let attach = attachment;
    if (pendingFile) {
      try { attach = await d.uploadAttachment(pendingFile); } catch (x) { setBusy(false); d.toast(`Não foi possível enviar o comprovante: ${x.message}`, null, true); return; }
    }
    if (initial && initial.attachment && initial.attachment !== attach) d.backend.files.remove([initial.attachment]).catch(() => {});
    const base = {
      kind, amount, description: desc.trim() || (kind === 'transfer' ? 'Transferência' : (d.categories.find((c) => c.id === (cat || fallbackCat(kind))) || {}).name || (kind === 'in' ? 'Receita' : 'Despesa')),
      date, notes: notes.trim() || null,
      category_id: kind === 'transfer' ? null : cat || fallbackCat(kind),
      account_id: source.startsWith('acc:') ? source.slice(4) : null,
      to_account_id: kind === 'transfer' ? toAcc : null,
      card_id: isCard && kind === 'out' ? card.id : null,
      paid: isCard ? true : paid,
    };
    if (v3) {
      base.tags = tags;
      base.attachment = attach || null;
      base.orig_currency = foreign.on && kind !== 'transfer' ? foreign.currency : null;
      base.orig_amount = foreign.on && kind !== 'transfer' ? foreign.orig : null;
    }
    const ok = split && !editing && kind !== 'transfer' ? await d.saveSplit(base, parts)
      : repeat && canRepeat ? await d.saveTxRepeat(base, freq, endDate) : await d.saveTx(initial, base, canSplit ? installments : 1, scopeArg || 'one');
    setBusy(false);
    if (ok) onClose();
  };
  const remove = async (scope) => { setBusy(true); const ok = await d.deleteTx(initial, scope); setBusy(false); if (ok) onClose(); };

  if (!accounts.length) {
    return (
      <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId}>
        <SheetHead id={titleId} title="Nova transação" onClose={onClose} />
        <EmptyState icon="bank" title="Crie uma conta primeiro" text="As transações saem de uma conta (corrente, carteira, poupança) ou de um cartão. Cadastre pelo menos uma conta para começar."
          action={<button type="button" className="btn btn-primary" onClick={() => d.openModal({ kind: 'account' })}><Icon name="plus" size={16} />Criar conta</button>} />
      </Sheet>
    );
  }
  const perInstallment = installments > 1 ? Math.floor(amount / installments) : amount;
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} onSubmit={submit}>
      <SheetHead id={titleId} title={editing ? 'Editar transação' : 'Nova transação'} sub={editing && initial.installments ? `Parcela ${initial.installment} de ${initial.installments}. A edição vale só para esta parcela.` : undefined} onClose={onClose} />
      {!editing && <AutoFill kind={kind} onScan={doScan} onQuick={() => { onClose(); setTimeout(() => d.openModal({ kind: 'quick' }), 240); }} onTemplate={v3 ? applyTemplate : null} />}
      <ScanStatus state={scan} />
      {initial && initial.kind === 'card_payment' ? (
        <p className="rounded-2xl bg-ink/[0.04] p-4 text-[13px] text-ink/75">Pagamentos de fatura não podem ser editados. Exclua e registre de novo, se precisar.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1 rounded-2xl border border-ink/10 bg-ink/[0.03] p-1" role="radiogroup" aria-label="Tipo de transação">
            {[{ v: 'out', l: 'Despesa', i: 'up', tone: 'bg-coral/15 text-out shadow-[inset_0_0_0_1px_rgba(224,113,79,.45)]' }, { v: 'in', l: 'Receita', i: 'inArrow', tone: 'bg-vivo/15 text-in shadow-[inset_0_0_0_1px_rgba(20,128,107,.4)]' }, { v: 'transfer', l: 'Transferência', i: 'swap', tone: 'bg-[#5E8CA6]/15 text-ink shadow-[inset_0_0_0_1px_rgba(94,140,166,.5)]' }].map((o) => (
              <button key={o.v} type="button" role="radio" aria-checked={kind === o.v} aria-label={o.l} disabled={editing && initial.kind !== o.v && (initial.kind === 'transfer' || o.v === 'transfer')} onClick={() => switchKind(o.v)}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition-all disabled:opacity-35 ${kind === o.v ? o.tone : 'text-ink/65 hover:text-ink'}`}>
                <Icon name={o.i} size={15} strokeWidth={2.2} /><span className="truncate">{o.v === 'transfer' ? <><span className="max-[380px]:hidden">Transferência</span><span className="hidden max-[380px]:inline">Transferir</span></> : o.l}</span>
              </button>
            ))}
          </div>
          <Field label="Valor" error={errors.amount} className="mt-5">
            <MoneyInput id="tx-amount" label="Valor" cents={amount} onChange={setAmount} invalid={errors.amount}
              className={`!py-3 text-[30px] font-extrabold tracking-[-0.02em] ${kind === 'in' ? 'text-in' : kind === 'out' ? 'text-out' : ''}`} />
          </Field>
          <Field label="Descrição" className="mt-4">
            <input id="tx-desc" className="field" value={desc} maxLength={60} onChange={(e) => setDesc(e.target.value)} placeholder={kind === 'in' ? 'Ex.: Salário de outubro' : kind === 'out' ? 'Ex.: Supermercado' : 'Ex.: Guardar na poupança'} />
            {ruleHit && !editing && <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-in" data-rule-hit><Icon name="bolt" size={12} />Regra "{ruleHit.match}" aplicada{ruleHit.category_id ? ` · ${(d.categories.find((c) => c.id === ruleHit.category_id) || {}).name || ''}` : ''}{ruleHit.source && ruleSourceLabel(ruleHit.source, d) ? ` · ${ruleSourceLabel(ruleHit.source, d)}` : ''}</p>}
          </Field>

          {kind === 'transfer' ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Sai de" error={errors.source}>
                <select id="tx-from" className="field" value={source} onChange={(e) => setSource(e.target.value)}>
                  {accounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="Vai para" error={errors.to}>
                <select id="tx-to" className="field" value={toAcc} onChange={(e) => setToAcc(e.target.value)}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
            </div>
          ) : (
            <>
              <fieldset className="mt-4">
                <legend className="lbl">Categoria{!cat ? <span className="ml-1 normal-case tracking-normal text-ink/50">(se não escolher: Outros)</span> : null}</legend>
                <div className={`mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 ${split ? 'hidden' : ''}`}>
                  {catTop.map((c) => (
                    <button key={c.id} type="button" aria-pressed={selTop === c.id} onClick={() => pickCat(c.id)}
                      className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-[11.5px] font-semibold transition-all ${selTop === c.id ? 'border-vivo/60 bg-vivo/15 text-ink shadow-[0_0_0_3px_rgba(20,128,107,.12)]' : 'border-ink/10 bg-ink/[0.03] text-ink/75 hover:bg-ink/[0.06]'}`}>
                      <span style={{ color: c.color }}><Icon name={c.icon} size={18} /></span>
                      <span className="w-full truncate text-center">{c.name}</span>
                    </button>
                  ))}
                  {quickCat == null && (
                    <button type="button" onClick={() => setQuickCat('')} className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-ink/25 px-1 py-2.5 text-[11.5px] font-semibold text-ink/75 hover:bg-ink/[0.04]">
                      <Icon name="plus" size={18} />Nova
                    </button>
                  )}
                </div>
                {!split && subCats.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Subcategoria">
                    {[{ id: selTop, name: 'Geral' }, ...subCats].map((c) => (
                      <button key={c.id} type="button" role="radio" aria-checked={cat === c.id} onClick={() => pickCat(c.id)}
                        className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${cat === c.id ? 'border-vivo/60 bg-vivo/15 text-ink' : 'border-ink/10 bg-ink/[0.03] text-ink/70'}`}>{c.name}</button>
                    ))}
                  </div>
                )}
                {split && <div className="mt-2"><SplitEditor kind={kind} total={amount} parts={parts} setParts={setParts} />{errors.split && <p className="mt-1.5 text-xs font-semibold text-out">{errors.split}</p>}</div>}
                {quickCat != null && (
                  <div className="mt-2 flex gap-2">
                    <input id="tx-newcat" autoFocus className="field !rounded-full !py-2 text-sm" placeholder="Nome da nova categoria" value={quickCat} maxLength={30} onChange={(e) => setQuickCat(e.target.value)} />
                    <button type="button" className="btn btn-primary !px-4 !py-2 text-[13px]" onClick={createQuickCat} disabled={!quickCat.trim()}>Criar</button>
                    <button type="button" className="icon-btn size-10 shrink-0" aria-label="Cancelar nova categoria" onClick={() => setQuickCat(null)}><Icon name="x" size={16} /></button>
                  </div>
                )}
                {!editing && installments === 1 && !repeat && (
                  <button type="button" className="mt-2 flex items-center gap-1.5 text-[12.5px] font-bold text-in" onClick={() => { setSplit((v) => !v); if (!split) setParts([{ key: 'a', category_id: cat || '', amount: amount }, { key: 'b', category_id: '', amount: 0 }]); }}>
                    <Icon name="split" size={14} />{split ? 'Voltar para uma categoria' : 'Dividir em várias categorias'}
                  </button>
                )}
              </fieldset>
              <Field label={kind === 'in' ? 'Entra em' : 'Pago com'} error={errors.source} className="mt-4">
                <select id="tx-source" className="field" value={source} onChange={(e) => { srcUser.current = true; setSource(e.target.value); }} disabled={editing && !!initial.group_id}>
                  <optgroup label="Contas">{cashAccounts(accounts).map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}</optgroup>
                  {accounts.some(isBenefit) && <optgroup label="Vale-alimentação / refeição">{accounts.filter(isBenefit).map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name} · {fmtBRL(d.balances[a.id] || 0)}</option>)}</optgroup>}
                  {kind === 'out' && cards.length > 0 && <optgroup label="Cartões de crédito">{cards.map((c) => <option key={c.id} value={`card:${c.id}`}>{c.name} (crédito)</option>)}</optgroup>}
                </select>
              </Field>
              {!editing && (
                <div className="mt-4">
                  <span className="lbl">{kind === 'in' ? 'Frequência' : 'Forma de pagamento'}</span>
                  <div className="mt-2">
                    <Segmented full size="sm" label={kind === 'in' ? 'Frequência' : 'Forma de pagamento'} value={repeat ? 'repeat' : installments > 1 ? 'parcel' : 'once'} onChange={setPayMode}
                      options={kind === 'in' ? [{ value: 'once', label: 'Uma vez' }, { value: 'repeat', label: 'Repete' }] : [{ value: 'once', label: 'À vista' }, { value: 'parcel', label: 'Parcelado' }, { value: 'repeat', label: 'Repete' }]} />
                  </div>
                  {installments > 1 && canSplit && (
                    <Field label="Número de parcelas" className="mt-3" hint={card ? `${installments}x de ${fmtBRL(perInstallment)} · primeira parcela na fatura de ${invoiceLabel(invoiceOf(card, date || todayISO()))}` : `${installments}x de ${fmtBRL(perInstallment)} · 1ª em ${fmtDate(date || todayISO())}, depois todo dia ${Number((date || todayISO()).slice(8, 10))}. As próximas ficam "a pagar".`}>
                      <select id="tx-inst" className="field" value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                        {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n}x</option>)}
                      </select>
                    </Field>
                  )}
                  {repeat && (
                    <div className="mt-3 grid gap-3 rounded-2xl border border-ink/[0.08] bg-ink/[0.02] p-3 sm:grid-cols-2">
                      <p className="text-xs leading-relaxed text-ink/70 sm:col-span-2">{isCard ? 'Cai em toda fatura do cartão, sem precisar lançar de novo (ex.: Netflix, Spotify).' : 'O Leco lança sozinho nas próximas datas como "a pagar" e avisa antes (ex.: aluguel, academia, salário).'}</p>
                      <div className="min-w-0">
                        <span className="lbl">Repete</span>
                        <div className="mt-2"><Segmented full size="sm" label="Frequência" value={freq} onChange={setFreq} options={[{ value: 'weekly', label: 'Semanal' }, { value: 'monthly', label: 'Mensal' }, { value: 'yearly', label: 'Anual' }]} /></div>
                      </div>
                      <Field label="Até (opcional)" error={errors.end} hint={endDate ? fmtDate(endDate) : 'Sem data de fim'}>
                        <input id="tx-end" type="date" className="field" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
                      </Field>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DateField id="tx-date" value={date} onChange={setDate} error={errors.date} />
            {!isCard && kind !== 'transfer' && (
              <div className="min-w-0">
                <span className="lbl">Situação</span>
                <div className="mt-2">
                  <Segmented full size="sm" label="Situação" value={paid ? 'y' : 'n'} onChange={(v) => { setPaid(v === 'y'); setPaidTouched(true); }}
                    options={[{ value: 'y', label: kind === 'in' ? 'Recebido' : 'Pago' }, { value: 'n', label: kind === 'in' ? 'A receber' : 'A pagar' }]} />
                </div>
              </div>
            )}
          </div>
          <button type="button" className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-ink/[0.08] bg-ink/[0.02] px-3.5 py-2.5 text-left" aria-expanded={more} onClick={() => setMore((v) => !v)}>
            <Icon name="layers" size={17} className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold">Mais opções</span>
              <span className="block truncate text-xs text-ink/60">{[tags.length ? `${tags.length} etiqueta${tags.length > 1 ? 's' : ''}` : '', attachment || pendingFile ? 'comprovante' : '', foreign.on ? foreign.currency : '', notes ? 'observação' : ''].filter(Boolean).join(' · ') || 'Etiquetas, comprovante, outra moeda, observação'}</span>
            </span>
            <Icon name={more ? 'chevUp' : 'chevDown'} size={16} className="shrink-0" />
          </button>
          {more && (
            <div className="mt-3 space-y-4">
              {v3 ? (
                <>
                  <div><span className="lbl">Etiquetas</span><div className="mt-2"><TagInput tags={tags} onChange={setTags} /></div></div>
                  <div><span className="lbl">Comprovante</span><div className="mt-2"><AttachmentField path={attachment} pending={pendingFile} onPick={(f) => setPendingFile(f)} onRemove={() => { setPendingFile(null); setAttachment(null); }} /></div></div>
                  {kind !== 'transfer' && (
                    <div>
                      <Toggle id="tx-foreign" icon="plane" label="Outra moeda" desc="Gasto em viagem: informe o valor e a cotação; o Leco guarda em reais." checked={foreign.on} onChange={(v) => setForeign((f) => ({ ...f, on: v }))} />
                      {foreign.on && <ForeignAmount value={foreign} onChange={setForeign} setAmount={setAmount} />}
                      {errors.foreign && <p className="mt-1.5 text-xs font-semibold text-out">{errors.foreign}</p>}
                    </div>
                  )}
                </>
              ) : <p className="rounded-2xl bg-ouro/10 px-3.5 py-2.5 text-xs text-ink/75">Etiquetas, comprovantes e outras moedas ficam disponíveis depois da atualização do banco (Configurações › Seus dados).</p>}
              <Field label="Observações">
                <textarea id="tx-notes" className="field min-h-[64px]" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
              </Field>
            </div>
          )}
        </>
      )}
      {askScope ? (
        <ScopeChoice what={initial.group_id ? `Esta é a parcela ${initial.installment} de ${initial.installments}.` : 'Este lançamento faz parte de uma recorrência. "Esta e as próximas" também muda o valor da recorrência.'} busy={busy}
          onCancel={() => setAskScope(false)} onPick={(sc) => { setAskScope(false); submit(null, sc); }} />
      ) : confirmDel ? (
        <DeleteTxChoices t={initial} busy={busy} onCancel={() => setConfirmDel(false)} onPick={remove} />
      ) : (
        <div className="mt-6 flex gap-2">
          {editing && <button type="button" className="icon-btn size-11 shrink-0" aria-label="Excluir transação" onClick={() => setConfirmDel(true)}><Icon name="trash" size={17} /></button>}
          {editing && initial.kind !== 'card_payment' && <button type="button" className="icon-btn size-11 shrink-0" aria-label="Duplicar transação" onClick={duplicate}><Icon name="copy" size={17} /></button>}
          {!editing && v3 && kind !== 'transfer' && <button type="button" className="icon-btn size-11 shrink-0" aria-label="Salvar como modelo" title="Salvar como modelo" onClick={saveTemplate}><Icon name="star" size={17} /></button>}
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          {!(initial && initial.kind === 'card_payment') && <SubmitButton busy={busy} className="flex-[1.6]"><Icon name="check" size={17} strokeWidth={2.4} />{editing ? 'Salvar' : kind === 'transfer' ? 'Transferir' : window.innerWidth < 380 ? 'Adicionar' : kind === 'in' ? 'Adicionar receita' : 'Adicionar despesa'}</SubmitButton>}
        </div>
      )}
    </Sheet>
  );
}

/* ---------- Ícone ou emoji ---------- */
const EMOJI_CHOICES = ['🏦', '💳', '💰', '🐷', '👛', '📈', '🏠', '🛒', '🍔', '☕', '🚗', '⛽', '🚌', '✈️', '💊', '🎓', '🎮', '🎬', '🐶', '👶', '🎁', '💡', '📱', '👕', '💼', '🏋️', '🍺', '🧾'];
// Reduz a imagem escolhida para um ícone pequeno (quadrado, ~96 px) guardado junto da conta
async function imageToIcon(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const S = 96;
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, S, S);
    const side = Math.min(img.width, img.height);
    g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
    let out = c.toDataURL('image/webp', 0.88);
    if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', 0.88);
    return out;
  } finally { URL.revokeObjectURL(url); }
}

// Recorte da imagem do ícone: arrastar para posicionar e ajustar o zoom
function IconCropper({ file, onDone, onCancel, onError }) {
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const V = 240; // tamanho da área de recorte na tela
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => onError();
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onCancel(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  const base = img ? V / Math.min(img.width, img.height) : 1;
  const sc = base * zoom;
  const w = img ? img.width * sc : V, h = img ? img.height * sc : V;
  const clamp = (p) => ({ x: Math.min(0, Math.max(V - w, p.x)), y: Math.min(0, Math.max(V - h, p.y)) });
  useEffect(() => { if (img) setPos((p) => clamp(p.x === 0 && p.y === 0 && zoom === 1 ? { x: (V - w) / 2, y: (V - h) / 2 } : p)); }, [img, zoom]);
  const down = (e) => { drag.current = { x: e.clientX, y: e.clientY, p: pos }; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { if (!drag.current) return; const s = drag.current; setPos(clamp({ x: s.p.x + (e.clientX - s.x), y: s.p.y + (e.clientY - s.y) })); };
  const up = () => { drag.current = null; };
  const done = () => {
    if (!img) return;
    const S = 96, k = S / V;
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, S, S);
    g.drawImage(img, pos.x * k, pos.y * k, w * k, h * k);
    let out = c.toDataURL('image/webp', 0.9);
    if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', 0.9);
    onDone(out);
  };
  return (
    <div className="overlay-in fixed inset-0 z-[95] grid place-items-center p-4" style={{ background: 'var(--scrim)' }}>
      <div role="dialog" aria-modal="true" aria-label="Ajustar imagem" className="glass-deep dialog-in w-full max-w-[340px] p-5">
        <p className="text-[17px] font-extrabold tracking-[-0.02em]">Ajustar imagem</p>
        <p className="mt-0.5 text-xs text-ink/65">Arraste para posicionar e use o zoom para enquadrar.</p>
        <div className="relative mx-auto mt-4 overflow-hidden rounded-[28px] bg-white" style={{ width: V, height: V, touchAction: 'none' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {img ? <img src={img.src} alt="" draggable="false" className="pointer-events-none absolute max-w-none select-none" style={{ left: pos.x, top: pos.y, width: w, height: h }} /> : <span className="grid size-full place-items-center"><Spinner size={18} /></span>}
          <span className="pointer-events-none absolute inset-0 rounded-[28px]" style={{ boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.9), inset 0 0 0 3px rgba(11,47,41,.25)' }} />
        </div>
        <label className="mt-4 flex items-center gap-3 text-xs font-semibold text-ink/70">
          <Icon name="minus" size={14} />
          <input type="range" min="1" max="4" step="0.01" value={zoom} aria-label="Zoom" className="flex-1" onChange={(e) => { const z = Number(e.target.value); setPos((p) => { const nw = img ? img.width * base * z : V, nh = img ? img.height * base * z : V; const cx = (V / 2 - p.x) / w, cy = (V / 2 - p.y) / h; return { x: Math.min(0, Math.max(V - nw, V / 2 - cx * nw)), y: Math.min(0, Math.max(V - nh, V / 2 - cy * nh)) }; }); setZoom(z); }} />
          <Icon name="plus" size={14} />
        </label>
        <div className="mt-5 flex gap-2">
          <button type="button" className="btn btn-ghost flex-1" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn btn-primary flex-[1.4]" onClick={done} disabled={!img}><Icon name="check" size={16} strokeWidth={2.4} />Usar imagem</button>
        </div>
      </div>
    </div>
  );
}

function IconPicker({ value, onChange, choices = ICON_CHOICES, label = 'Ícone', allowImage = false }) {
  const [custom, setCustom] = useState('');
  const [imgErr, setImgErr] = useState('');
  const file = useRef(null);
  const isImg = isImgIcon(value);
  const pickImage = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { setImgErr('Escolha uma imagem (JPG, PNG ou WEBP).'); return; }
    setImgErr(''); setCropFile(f);
  };
  const [cropFile, setCropFile] = useState(null);
  return (
    <fieldset>
      <legend className="lbl">{label}</legend>
      {allowImage && (
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-ink/[0.08] bg-ink/[0.02] p-2.5">
          <span className={`grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl ${isImg ? 'bg-white ring-2 ring-vivo' : 'border border-dashed border-ink/25 text-ink/50'}`}>
            {isImg ? <img src={value} alt="Imagem escolhida" className="size-full object-cover" /> : <Icon name="image" size={18} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold">{isImg ? 'Usando sua imagem' : 'Usar uma imagem sua'}</span>
            <span className="block text-[11.5px] text-ink/60">Foto ou imagem salva no aparelho. Fica só na sua conta.</span>
          </span>
          <button type="button" className="btn btn-ghost shrink-0 !px-3 !py-1.5 text-xs" onClick={() => file.current && file.current.click()}>{isImg ? 'Trocar' : 'Escolher'}</button>
          {isImg && <button type="button" className="icon-btn size-8 shrink-0" aria-label="Remover imagem" onClick={() => onChange(null)}><Icon name="x" size={14} /></button>}
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={pickImage} data-icon-file="1" />
        </div>
      )}
      {imgErr && <p className="mt-1.5 text-xs font-semibold text-out">{imgErr}</p>}
      {cropFile && ReactDOM.createPortal(<IconCropper file={cropFile} onCancel={() => setCropFile(null)} onDone={(url) => { setCropFile(null); onChange(url); }} onError={() => { setCropFile(null); setImgErr('Não consegui abrir essa imagem. Tente outra.'); }} />, document.body)}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[...choices, ...EMOJI_CHOICES].map((ic) => (
          <button key={ic} type="button" aria-pressed={value === ic} aria-label={`Ícone ${ic}`} onClick={() => onChange(ic)}
            className={`grid size-9 place-items-center rounded-xl border transition-colors ${value === ic ? 'border-vivo bg-vivo/15' : 'border-ink/10 bg-ink/[0.03]'}`}><Icon name={ic} size={17} /></button>
        ))}
        <input aria-label="Outro emoji" className="field !w-[92px] !rounded-xl !px-2 !py-1.5 text-center text-[13px]" placeholder="emoji…" value={custom} maxLength={4}
          onChange={(e) => { setCustom(e.target.value); if (/\p{Extended_Pictographic}/u.test(e.target.value)) onChange(e.target.value.trim()); }} />
      </div>
    </fieldset>
  );
}

/* ---------- Bancos (só nomes; o ícone é do próprio Leco, conforme o tipo) ---------- */
const BANK_TYPES = {
  digital: { label: 'Banco digital', icon: 'phone', kind: 'corrente' },
  tradicional: { label: 'Banco', icon: 'bank', kind: 'corrente' },
  carteira: { label: 'Carteira digital', icon: 'wallet', kind: 'corrente' },
  cooperativa: { label: 'Cooperativa', icon: 'home', kind: 'corrente' },
  corretora: { label: 'Corretora', icon: 'trend', kind: 'investimento' },
  global: { label: 'Conta internacional', icon: 'plane', kind: 'corrente' },
};
const BANKS = [
  ['Nubank', 'digital'], ['Itaú', 'tradicional'], ['Bradesco', 'tradicional'], ['Banco do Brasil', 'tradicional'], ['Caixa', 'tradicional'],
  ['Santander', 'tradicional'], ['Inter', 'digital'], ['C6 Bank', 'digital'], ['Mercado Pago', 'carteira'], ['PicPay', 'carteira'],
  ['PagBank', 'carteira'], ['Neon', 'digital'], ['Next', 'digital'], ['BTG Pactual', 'tradicional'], ['Banco Pan', 'digital'],
  ['Original', 'digital'], ['Will Bank', 'digital'], ['Agibank', 'digital'], ['Iti', 'carteira'], ['Safra', 'tradicional'],
  ['Banrisul', 'tradicional'], ['BRB', 'tradicional'], ['Banco do Nordeste', 'tradicional'], ['Banestes', 'tradicional'], ['Mercantil', 'tradicional'],
  ['Sicoob', 'cooperativa'], ['Sicredi', 'cooperativa'], ['Cresol', 'cooperativa'], ['Unicred', 'cooperativa'],
  ['XP Investimentos', 'corretora'], ['Rico', 'corretora'], ['Clear', 'corretora'], ['NuInvest', 'corretora'], ['Toro', 'corretora'], ['Ágora', 'corretora'], ['Modal', 'corretora'],
  ['Nomad', 'global'], ['Wise', 'global'], ['Avenue', 'global'],
  ['InfinitePay', 'carteira'], ['Stone', 'carteira'], ['RecargaPay', 'carteira'],
].map(([name, type]) => ({ name, type }));
const POPULAR_BANKS = ['Nubank', 'Itaú', 'Bradesco', 'Banco do Brasil', 'Caixa', 'Santander', 'Inter', 'C6 Bank', 'Mercado Pago', 'PicPay'];

function BankPicker({ value, onPick }) {
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const nq = normTxt(q.trim());
  const list = nq ? BANKS.filter((b) => normTxt(b.name).includes(nq)) : all ? BANKS : BANKS.filter((b) => POPULAR_BANKS.includes(b.name));
  return (
    <div>
      <span className="lbl">Banco ou instituição <span className="normal-case tracking-normal text-ink/50">(opcional)</span></span>
      <div className="relative mt-2">
        <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50" />
        <input id="acc-bank" className="field !rounded-full !py-2 !pl-9 text-[13px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar banco (ex.: Inter, Sicredi, XP)" autoComplete="off" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" role="listbox" aria-label="Bancos">
        {list.map((b) => {
          const on = value === b.name;
          return (
            <button key={b.name} type="button" role="option" aria-selected={on} onClick={() => onPick(on ? null : b)}
              className={`flex items-center gap-1.5 rounded-full border py-1.5 pl-2 pr-3 text-[12.5px] font-bold transition-colors ${on ? 'border-vivo/60 bg-vivo/15 text-ink' : 'border-ink/10 bg-ink/[0.03] text-ink/80 hover:bg-ink/[0.06]'}`}>
              <Icon name={BANK_TYPES[b.type].icon} size={14} />{b.name}
            </button>
          );
        })}
        {!nq && !all && <button type="button" className="rounded-full px-3 py-1.5 text-[12.5px] font-bold text-in" onClick={() => setAll(true)}>Ver todos ({BANKS.length})</button>}
        {nq && !list.length && <p className="px-1 text-xs text-ink/60">Não encontrei "{q}". Escreva o nome no campo Nome abaixo.</p>}
      </div>
    </div>
  );
}

/* ---------- Conta ---------- */
function AccountForm({ initial, presetKind, onClose }) {
  const d = useApp();
  const editing = !!initial;
  const [name, setName] = useState(initial ? initial.name : '');
  const [kind, setKind] = useState(initial ? initial.kind : presetKind || 'corrente');
  const ben0 = (initial && initial.benefit) || {};
  const [bType, setBType] = useState(ben0.type || 'va');
  const [provider, setProvider] = useState(ben0.provider || '');
  const [credit, setCredit] = useState(ben0.credit || 0);
  const [creditDay, setCreditDay] = useState(ben0.day || 1);
  const isBen = kind === 'beneficio';
  // nome automático do vale (ex.: "VR Alelo") enquanto a pessoa não escreve outro
  const autoName = (t, p) => `${BENEFIT_TYPES[t].short}${p && p !== 'Outra' ? ` ${p.replace(/ \(.*\)$/, '')}` : ''}`;
  const isAutoName = (n) => !n.trim() || Object.keys(BENEFIT_TYPES).some((t) => [''].concat(BENEFIT_PROVIDERS).some((p) => autoName(t, p) === n.trim()));
  const setBen = (t, p) => { setBType(t); setProvider(p); if (isAutoName(name)) setName(autoName(t, p)); if (!isImgIcon(icon)) setIcon(BENEFIT_TYPES[t].icon); };
  useEffect(() => { if (!initial && presetKind === 'beneficio') setBen('va', ''); }, []);
  const [balance, setBalance] = useState(initial ? initial.initial_balance : 0);
  const [color, setColor] = useState(initial ? initial.color : SWATCHES[0]);
  const [icon, setIcon] = useState(initial && initial.icon ? initial.icon : null);
  const [bank, setBank] = useState(() => { const b = initial && BANKS.find((x) => x.name === initial.name); return b ? b.name : null; });
  const pickBank = (b) => {
    if (!b) { setBank(null); return; }
    // o nome só é trocado se estiver vazio ou ainda for o de outro banco da lista
    if (!name.trim() || BANKS.some((x) => x.name === name.trim())) setName(b.name);
    setBank(b.name);
    if (!editing) setKind(BANK_TYPES[b.type].kind);
    if (!isImgIcon(icon)) setIcon(BANK_TYPES[b.type].icon);
  };
  const [reserve, setReserve] = useState(!!(initial && initial.is_reserve));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const titleId = cleanId(useId());
  const used = editing ? d.transactions.filter((t) => t.account_id === initial.id || t.to_account_id === initial.id).length : 0;
  const current = editing ? d.balances[initial.id] : null;
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Dê um nome para a conta.'); return; }
    setBusy(true);
    const benefit = isBen ? { ...((initial && initial.benefit) || {}), type: bType, provider: provider || null, credit, day: creditDay } : null;
    const row = await d.saveAccount(initial, { name: name.trim(), kind, initial_balance: balance, color, ...(d.v3 ? { icon, is_reserve: isBen ? false : reserve } : {}), ...(d.v4 ? { benefit } : {}) });
    if (row && isBen && d.v4) await d.syncBenefitCredit(row && row.id ? row : { ...initial, name: name.trim() }, benefit);
    setBusy(false);
    if (row) onClose();
  };
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} onSubmit={submit}>
      <SheetHead id={titleId} title={editing ? (isBen ? 'Editar vale' : 'Editar conta') : isBen ? 'Novo vale' : 'Nova conta'} sub={editing ? `Saldo atual: ${fmtBRL(current)} · ${used} transações` : isBen ? 'Vale-alimentação, vale-refeição ou benefício flexível.' : 'Banco, carteira, poupança ou investimento.'} onClose={onClose} />
      {isBen ? (
        <div>
          <span className="lbl">Tipo de benefício</span>
          <div className="mt-2"><Segmented full size="sm" label="Tipo de benefício" value={bType} onChange={(t) => setBen(t, provider)} options={Object.keys(BENEFIT_TYPES).map((t) => ({ value: t, label: t === 'flex' ? 'Flexível' : t === 'va' ? 'Alimentação' : 'Refeição' }))} /></div>
          <p className="mt-1.5 text-xs text-ink/60">{BENEFIT_TYPES[bType].hint}</p>
          <span className="lbl mt-4 block">Operadora</span>
          <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Operadora">
            {BENEFIT_PROVIDERS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={provider === p} onClick={() => setBen(bType, provider === p ? '' : p)}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${provider === p ? 'border-vivo/60 bg-vivo/15 text-ink' : 'border-ink/10 bg-ink/[0.03] text-ink/80 hover:bg-ink/[0.06]'}`}>{p}</button>
            ))}
          </div>
        </div>
      ) : <BankPicker value={bank} onPick={pickBank} />}
      <Field label="Nome" className="mt-4"><input id="acc-name" className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank, Itaú, Carteira" /></Field>
      <div className="mt-4"><span className="lbl">Tipo</span><div className="mt-2"><ChoiceChips label="Tipo de conta" value={kind} onChange={(k) => { setKind(k); if (k === 'beneficio') setBen(bType, provider); }} options={Object.keys(ACCOUNT_KINDS).filter((k) => k !== 'beneficio' || d.v4 || kind === 'beneficio').map((k) => ({ value: k, label: k === 'beneficio' ? 'Vale (VA/VR)' : ACCOUNT_KINDS[k].label, icon: ACCOUNT_KINDS[k].icon }))} /></div></div>
      <Field label={editing ? 'Saldo inicial' : 'Saldo atual'} className="mt-4" hint={editing ? 'Valor que havia na conta antes das transações registradas no Leco.' : 'Quanto há nesta conta hoje.'}>
        <SignedMoney id="acc-balance" label="Saldo" cents={balance} onChange={setBalance} />
      </Field>
      {isBen && (
        <div className="mt-4 rounded-2xl border border-ink/[0.08] bg-ink/[0.02] p-3">
          <p className="text-[13px] font-bold">Crédito mensal</p>
          <p className="text-xs text-ink/60">O valor cai sozinho nesta conta todo mês, no dia escolhido. Deixe em branco se o valor muda.</p>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <MoneyInput id="acc-credit" label="Valor do crédito" cents={credit} onChange={setCredit} className="font-bold" />
            <div className="w-[120px]"><DaySelect id="acc-credit-day" value={creditDay} onChange={setCreditDay} /></div>
          </div>
          {credit > 0 && <p className="mt-2 text-xs text-in">Próximo crédito: {fmtBRL(credit)} em {fmtDate(nextBenefitDate(creditDay))}.</p>}
        </div>
      )}
      <fieldset className="mt-4"><legend className="lbl">Cor</legend>
        <div className="mt-2 flex flex-wrap gap-2">{SWATCHES.map((c) => <button key={c} type="button" aria-pressed={color === c} aria-label={`Cor ${c}`} onClick={() => setColor(c)} className="size-8 rounded-full transition-transform hover:scale-105" style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--paper), 0 0 0 4px ${c}` : 'none' }} />)}</div>
      </fieldset>
      {d.v3 && <div className="mt-4"><IconPicker allowImage value={icon || ACCOUNT_KINDS[kind].icon} onChange={setIcon} choices={['bank', 'phone', 'wallet', 'piggy', 'trend', 'card', 'briefcase', 'home', 'plane', 'shield']} /></div>}
      {d.v3 && !isBen && <div className="mt-2"><Toggle id="acc-reserve" icon="shield" label="Reserva de emergência" desc="O saldo desta conta conta como reserva no Planejamento." checked={reserve} onChange={setReserve} /></div>}
      <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>
      {confirm ? (
        <div className="mt-6 rounded-2xl border border-coral/40 bg-coral/10 p-4">
          <p className="text-sm font-bold">O que fazer com “{initial.name}”?</p>
          <p className="mt-1 text-xs leading-relaxed text-ink/75">{used ? `Arquivar esconde a conta e mantém as ${used} transações nos relatórios. Excluir apaga a conta e as ${used} transações dela.` : 'Nenhuma transação usa esta conta.'}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button type="button" className="btn btn-ghost !py-2" onClick={() => setConfirm(false)}>Cancelar</button>
            {used > 0 && <button type="button" className="btn btn-ghost !py-2" onClick={async () => { if (await d.saveAccount(initial, { archived: !initial.archived })) onClose(); }}>{initial.archived ? 'Reativar' : 'Arquivar'}</button>}
            <button type="button" className="btn btn-danger !py-2" onClick={async () => { if (await d.deleteRow('accounts', initial)) onClose(); }}>Excluir</button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex gap-2">
          {editing && <button type="button" className="icon-btn size-11 shrink-0" aria-label="Arquivar ou excluir conta" onClick={() => setConfirm(true)}><Icon name="trash" size={17} /></button>}
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          <SubmitButton busy={busy} className="flex-[1.6]"><Icon name="check" size={17} strokeWidth={2.4} />{editing ? 'Salvar' : 'Criar conta'}</SubmitButton>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- Cartão ---------- */
function CardForm({ initial, onClose }) {
  const d = useApp();
  const editing = !!initial;
  const [name, setName] = useState(initial ? initial.name : '');
  const [limit, setLimit] = useState(initial ? initial.limit_amount : 0);
  const [closing, setClosing] = useState(initial ? initial.closing_day : 1);
  const [due, setDue] = useState(initial ? initial.due_day : 10);
  const [payAcc, setPayAcc] = useState(initial ? initial.pay_account_id || '' : (d.accounts[0] || {}).id || '');
  const [color, setColor] = useState(initial ? initial.color : SWATCHES[1]);
  const [icon, setIcon] = useState(initial && initial.icon ? initial.icon : null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const titleId = cleanId(useId());
  const used = editing ? d.transactions.filter((t) => t.card_id === initial.id).length : 0;
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Dê um nome para o cartão.'); return; }
    setBusy(true);
    const ok = await d.saveCard(initial, { name: name.trim(), limit_amount: limit, closing_day: closing, due_day: due, pay_account_id: payAcc || null, color, ...(d.v3 ? { icon } : {}) });
    setBusy(false);
    if (ok) onClose();
  };
  const preview = { closing_day: closing, due_day: due };
  const inv = invoiceOf(preview, todayISO());
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} onSubmit={submit}>
      <SheetHead id={titleId} title={editing ? 'Editar cartão' : 'Novo cartão de crédito'} onClose={onClose} />
      <Field label="Nome"><input id="card-name" className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank Roxinho" /></Field>
      <Field label="Limite" className="mt-4"><MoneyInput id="card-limit" label="Limite" cents={limit} onChange={setLimit} className="font-bold" /></Field>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Fecha no"><DaySelect id="card-closing" value={closing} onChange={setClosing} /></Field>
        <Field label="Vence no"><DaySelect id="card-due" value={due} onChange={setDue} /></Field>
      </div>
      <p className="mt-2 text-xs text-ink/65">Compras feitas hoje entram na fatura de {invoiceLabel(inv)}, que vence em {fmtDate(invoiceDue(preview, inv))}. <b className="text-ink">Melhor dia para comprar: dia {closing}</b> (a compra só é paga na fatura seguinte).</p>
      <Field label="Conta que paga a fatura" className="mt-4">
        <select id="card-pay" className="field" value={payAcc} onChange={(e) => setPayAcc(e.target.value)}>
          <option value="">Escolher na hora de pagar</option>
          {d.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <fieldset className="mt-4"><legend className="lbl">Cor</legend>
        <div className="mt-2 flex flex-wrap gap-2">{SWATCHES.map((c) => <button key={c} type="button" aria-pressed={color === c} aria-label={`Cor ${c}`} onClick={() => setColor(c)} className="size-8 rounded-full transition-transform hover:scale-105" style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--paper), 0 0 0 4px ${c}` : 'none' }} />)}</div>
      </fieldset>
      {d.v3 && <div className="mt-4"><IconPicker allowImage value={icon || 'card'} onChange={setIcon} choices={['card', 'bank', 'phone', 'wallet', 'star', 'plane', 'bag']} /></div>}
      <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>
      {confirm ? (
        <div className="mt-6 rounded-2xl border border-coral/40 bg-coral/10 p-4">
          <p className="text-sm font-bold">O que fazer com “{initial.name}”?</p>
          <p className="mt-1 text-xs leading-relaxed text-ink/75">{used ? `Arquivar esconde o cartão e mantém as ${used} compras nos relatórios. Excluir apaga o cartão, as compras e os pagamentos.` : 'Nenhuma compra usa este cartão.'}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button type="button" className="btn btn-ghost !py-2" onClick={() => setConfirm(false)}>Cancelar</button>
            {used > 0 && <button type="button" className="btn btn-ghost !py-2" onClick={async () => { if (await d.saveCard(initial, { archived: !initial.archived })) onClose(); }}>{initial.archived ? 'Reativar' : 'Arquivar'}</button>}
            <button type="button" className="btn btn-danger !py-2" onClick={async () => { if (await d.deleteRow('cards', initial)) onClose(); }}>Excluir</button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex gap-2">
          {editing && <button type="button" className="icon-btn size-11 shrink-0" aria-label="Arquivar ou excluir cartão" onClick={() => setConfirm(true)}><Icon name="trash" size={17} /></button>}
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          <SubmitButton busy={busy} className="flex-[1.6]"><Icon name="check" size={17} strokeWidth={2.4} />{editing ? 'Salvar' : 'Adicionar cartão'}</SubmitButton>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- Fatura: detalhes e pagamento ---------- */
function InvoiceSheet({ card, initialInvoice, onClose }) {
  const d = useApp();
  const m = useMoneyText();
  const s = cardSummary(card, d.transactions);
  const [inv, setInv] = useState(initialInvoice || (s.nextToPay ? s.nextToPay.invoice : s.current.invoice));
  const cur = s.invoices.find((i) => i.invoice === inv) || s.current;
  const [payAcc, setPayAcc] = useState(card.pay_account_id || (d.accounts.find((a) => !a.archived) || {}).id || '');
  const [amount, setAmount] = useState(Math.max(0, cur.remaining));
  const [date, setDate] = useState(todayISO());
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const titleId = cleanId(useId());
  useEffect(() => { setAmount(Math.max(0, cur.remaining)); setPaying(false); }, [inv]);
  const pay = async () => {
    if (!payAcc) { setErr('Escolha a conta que vai pagar.'); return; }
    if (amount <= 0) { setErr('Informe o valor do pagamento.'); return; }
    setErr(''); setBusy(true);
    const ok = await d.payInvoice(card, cur.invoice, payAcc, amount, date);
    setBusy(false);
    if (ok) setPaying(false);
  };
  const st = INVOICE_STATUS[cur.status];
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} wide>
      <SheetHead id={titleId} title={`Faturas · ${card.name}`} sub={`Limite ${m(card.limit_amount)} · disponível ${m(s.available)}`} onClose={onClose} />
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {s.invoices.slice().reverse().map((i) => (
          <button key={i.invoice} type="button" onClick={() => setInv(i.invoice)} aria-pressed={i.invoice === inv}
            className={`shrink-0 rounded-2xl border px-3 py-2 text-left text-xs transition-all ${i.invoice === inv ? 'border-vivo/60 bg-vivo/12' : 'border-ink/10 hover:bg-ink/[0.04]'}`}>
            <span className="block font-bold">{monthShort(i.invoice)}/{i.invoice.slice(2, 4)}</span>
            <span className="block tabular-nums text-ink/70">{m(i.total)}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-3xl border border-ink/[0.08] bg-ink/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-ink/65">Fatura de {invoiceLabel(cur.invoice)}</p>
            <p className="text-[26px] font-extrabold tracking-[-0.02em] tabular-nums">{m(cur.total)}</p>
          </div>
          <span className={st.cls}>{st.label}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div><p className="text-ink/60">Fecha</p><p className="font-bold tabular-nums">{fmtDate(cur.closing)}</p></div>
          <div><p className="text-ink/60">Vence</p><p className="font-bold tabular-nums">{fmtDate(cur.due)}</p></div>
          <div><p className="text-ink/60">Falta pagar</p><p className="font-bold tabular-nums">{m(Math.max(0, cur.remaining))}</p></div>
        </div>
        {cur.remaining > 0 && !paying && <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => setPaying(true)}><Icon name="check" size={16} />Pagar fatura</button>}
        {paying && (
          <div className="mt-4 space-y-3 border-t border-ink/10 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Valor"><MoneyInput id="pay-amount" label="Valor do pagamento" cents={amount} onChange={setAmount} className="font-bold" /></Field>
              <DateField id="pay-date" value={date} onChange={setDate} />
            </div>
            <Field label="Pagar com">
              <select id="pay-acc" className="field" value={payAcc} onChange={(e) => setPayAcc(e.target.value)}>
                {d.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name} · {fmtBRL(d.balances[a.id])}</option>)}
              </select>
            </Field>
            <ErrorNote>{err}</ErrorNote>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost flex-1" onClick={() => setPaying(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary flex-[1.6]" onClick={pay} disabled={busy}>{busy ? <Spinner size={14} /> : <Icon name="check" size={16} />}Confirmar pagamento</button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-5 text-[13px] font-extrabold">Compras ({cur.items.length})</p>
      {cur.items.length === 0 ? <p className="py-6 text-center text-sm text-ink/60">Nenhuma compra nesta fatura.</p> : (
        <ul className="mt-1 divide-y divide-ink/[0.07]">{cur.items.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((t) => <TxItem key={t.id} t={t} dense onOpen={(x) => d.openModal({ kind: 'tx', initial: x })} />)}</ul>
      )}
      {cur.payments.length > 0 && (
        <>
          <p className="mt-4 text-[13px] font-extrabold">Pagamentos</p>
          <ul className="mt-1 divide-y divide-ink/[0.07]">{cur.payments.map((t) => <TxItem key={t.id} t={t} dense onOpen={(x) => d.openModal({ kind: 'tx', initial: x })} />)}</ul>
        </>
      )}
    </Sheet>
  );
}

/* ---------- Recorrência ---------- */
function RecurringForm({ initial, onClose }) {
  const d = useApp();
  const editing = !!initial;
  const accounts = d.accounts.filter((a) => !a.archived);
  const cards = d.cards.filter((c) => !c.archived);
  const [kind, setKind] = useState(initial ? initial.kind : 'out');
  const [desc, setDesc] = useState(initial ? initial.description : '');
  const [amount, setAmount] = useState(initial ? initial.amount : 0);
  const firstCat = (k) => (d.categories.find((c) => c.kind === k && !c.archived) || {}).id || null;
  const [cat, setCat] = useState(initial ? initial.category_id : firstCat('out'));
  const [source, setSource] = useState(initial ? (initial.card_id ? `card:${initial.card_id}` : initial.account_id ? `acc:${initial.account_id}` : '') : accounts[0] ? `acc:${accounts[0].id}` : '');
  const [freq, setFreq] = useState(initial ? initial.frequency : 'monthly');
  const [next, setNext] = useState(initial ? initial.next_date : todayISO());
  const [hasEnd, setHasEnd] = useState(!!(initial && initial.end_date));
  const [end, setEnd] = useState(initial && initial.end_date ? initial.end_date : addMonthsISO(todayISO(), 12));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const titleId = cleanId(useId());
  const switchKind = (k) => { setKind(k); setCat(firstCat(k)); if (k === 'in' && source.startsWith('card:')) setSource(accounts[0] ? `acc:${accounts[0].id}` : ''); };
  const submit = async (e) => {
    e.preventDefault();
    if (!desc.trim()) { setErr('Dê um nome, por exemplo “Aluguel” ou “Salário”.'); return; }
    if (amount <= 0) { setErr('Informe o valor.'); return; }
    if (!source) { setErr('Escolha a conta ou o cartão.'); return; }
    if (hasEnd && end < next) { setErr('A data final precisa ser depois da próxima data.'); return; }
    setBusy(true);
    const ok = await d.saveRecurring(initial, {
      kind, description: desc.trim(), amount, category_id: cat, frequency: freq, next_date: next, end_date: hasEnd ? end : null, active: initial ? initial.active : true,
      account_id: source.startsWith('acc:') ? source.slice(4) : null, card_id: source.startsWith('card:') ? source.slice(5) : null,
    });
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} onSubmit={submit}>
      <SheetHead id={titleId} title={editing ? 'Editar recorrência' : 'Nova recorrência'} sub="Lançamentos que se repetem: salário, aluguel, assinaturas, contas de consumo." onClose={onClose} />
      <Segmented full label="Tipo" value={kind} onChange={switchKind} options={[{ value: 'out', label: 'Despesa fixa' }, { value: 'in', label: 'Receita fixa' }]} />
      <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <Field label="Nome"><input id="rec-desc" className="field" value={desc} maxLength={60} onChange={(e) => setDesc(e.target.value)} placeholder={kind === 'in' ? 'Ex.: Salário' : 'Ex.: Aluguel'} /></Field>
        <Field label="Valor"><MoneyInput id="rec-amount" label="Valor" cents={amount} onChange={setAmount} className="font-bold" /></Field>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Categoria">
          <select id="rec-cat" className="field" value={cat || ''} onChange={(e) => setCat(e.target.value || null)}>
            {d.categories.filter((c) => c.kind === kind && !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label={kind === 'in' ? 'Entra em' : 'Pago com'}>
          <select id="rec-source" className="field" value={source} onChange={(e) => setSource(e.target.value)}>
            <optgroup label="Contas">{accounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}</optgroup>
            {kind === 'out' && cards.length > 0 && <optgroup label="Cartões de crédito">{cards.map((c) => <option key={c.id} value={`card:${c.id}`}>{c.name} (crédito)</option>)}</optgroup>}
          </select>
        </Field>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Repete"><select id="rec-freq" className="field" value={freq} onChange={(e) => setFreq(e.target.value)}>{Object.keys(FREQ).map((f) => <option key={f} value={f}>{FREQ[f]}</option>)}</select></Field>
        <DateField id="rec-next" label={editing ? 'Próximo lançamento' : 'Primeiro lançamento'} value={next} onChange={setNext} />
      </div>
      <Toggle id="rec-hasend" label="Tem data para acabar" desc="Por exemplo, um financiamento ou curso com prazo." checked={hasEnd} onChange={setHasEnd} />
      {hasEnd && <DateField id="rec-end" label="Último lançamento até" value={end} onChange={setEnd} />}
      <p className="mt-3 text-xs leading-relaxed text-ink/65">{source.startsWith('card:') ? 'No cartão, o lançamento entra direto na fatura.' : 'Os lançamentos aparecem como “a pagar” ou “a receber” e você confirma quando acontecerem. O Leco avisa antes do vencimento.'}</p>
      <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>
      {confirm ? (
        <ConfirmBlock title={`Excluir “${initial.description}”?`} text="Os lançamentos já confirmados continuam. Os pendentes desta recorrência são apagados." confirmLabel="Excluir" onConfirm={async () => { if (await d.deleteRecurring(initial)) onClose(); }} onCancel={() => setConfirm(false)} />
      ) : (
        <div className="mt-6 flex gap-2">
          {editing && <button type="button" className="icon-btn size-11 shrink-0" aria-label="Excluir recorrência" onClick={() => setConfirm(true)}><Icon name="trash" size={17} /></button>}
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          <SubmitButton busy={busy} className="flex-[1.6]"><Icon name="check" size={17} strokeWidth={2.4} />{editing ? 'Salvar' : 'Criar recorrência'}</SubmitButton>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- Categoria ---------- */
function CategoryForm({ initial, initialKind = 'out', onClose }) {
  const d = useApp();
  const editing = !!initial;
  const [name, setName] = useState(initial ? initial.name : '');
  const [kind, setKind] = useState(initial ? initial.kind : initialKind);
  const [icon, setIcon] = useState(initial ? initial.icon : 'tag');
  const [color, setColor] = useState(initial ? initial.color : SWATCHES[4]);
  const [budget, setBudget] = useState(initial ? initial.budget || 0 : 0);
  const [parent, setParent] = useState(initial && initial.parent_id ? initial.parent_id : '');
  const parents = d.categories.filter((c) => c.kind === kind && !c.parent_id && !c.archived && (!initial || c.id !== initial.id));
  const hasChildren = editing && d.categories.some((c) => c.parent_id === initial.id);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const titleId = cleanId(useId());
  const used = editing ? d.transactions.filter((t) => t.category_id === initial.id).length : 0;
  const submit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) { setErr('Dê um nome para a categoria.'); return; }
    if (d.categories.some((c) => c.id !== (initial && initial.id) && c.kind === kind && c.name.toLowerCase() === n.toLowerCase())) { setErr('Já existe uma categoria com esse nome.'); return; }
    setBusy(true);
    const row = await d.saveCategory(initial, { name: n, kind, icon, color, budget: kind === 'out' ? budget : 0, ...(d.v3 ? { parent_id: parent || null } : {}) });
    setBusy(false);
    if (row) onClose();
  };
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} onSubmit={submit} wide>
      <SheetHead id={titleId} title={editing ? 'Editar categoria' : 'Nova categoria'} sub={editing ? `${used} transações usam esta categoria.` : undefined} onClose={onClose} />
      <div className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-ink/[0.03] p-3">
        <ColorIcon icon={icon} color={color} size={48} />
        <div className="min-w-0"><p className="truncate text-[15px] font-extrabold">{name.trim() || 'Nome da categoria'}</p><p className="text-xs text-ink/65">{kind === 'out' ? 'Despesa' : 'Receita'}{kind === 'out' && budget > 0 ? ` · orçamento ${fmtBRL(budget)}/mês` : ''}</p></div>
      </div>
      <Field label="Nome" className="mt-4"><input id="cat-name" className="field" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Mercado do bairro" /></Field>
      <div className="mt-4"><span className="lbl">Tipo</span><div className="mt-2"><Segmented full label="Tipo da categoria" value={kind} onChange={(v) => { if (!used) setKind(v); }} options={[{ value: 'out', label: 'Despesa' }, { value: 'in', label: 'Receita' }]} /></div>
        {used > 0 && <p className="mt-1.5 text-xs text-ink/60">O tipo não muda enquanto houver transações nesta categoria.</p>}</div>
      {d.v3 && !hasChildren && (
        <Field label="Subcategoria de" className="mt-4" hint={parent ? 'Os gastos daqui também contam no orçamento da categoria principal.' : 'Opcional. Ex.: "Delivery" dentro de "Alimentação".'}>
          <select id="cat-parent" className="field" value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">Nenhuma (categoria principal)</option>
            {parents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}
      <div className="mt-4"><IconPicker value={icon} onChange={setIcon} /></div>
      <fieldset className="mt-4"><legend className="lbl">Cor</legend>
        <div className="mt-2 flex flex-wrap gap-2">{SWATCHES.map((c) => <button key={c} type="button" aria-pressed={color === c} aria-label={`Cor ${c}`} onClick={() => setColor(c)} className="size-8 rounded-full transition-transform hover:scale-105" style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--paper), 0 0 0 4px ${c}` : 'none' }} />)}</div>
      </fieldset>
      {kind === 'out' && <Field label="Orçamento mensal" className="mt-4" hint="Deixe em R$ 0,00 para não ter limite. O alerta aparece ao chegar em 80%."><MoneyInput id="cat-budget" label="Orçamento mensal" cents={budget} onChange={setBudget} className="font-bold" /></Field>}
      <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>
      {confirm ? (
        <ConfirmBlock title={`Excluir “${initial.name}”?`} text={used ? `As ${used} transações ficam sem categoria.` : 'Nenhuma transação usa esta categoria.'} confirmLabel="Excluir" onConfirm={async () => { if (await d.deleteRow('categories', initial)) onClose(); }} onCancel={() => setConfirm(false)} />
      ) : (
        <div className="mt-6 flex gap-2">
          {editing && <button type="button" className="icon-btn size-11 shrink-0" aria-label="Excluir categoria" onClick={() => setConfirm(true)}><Icon name="trash" size={17} /></button>}
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          <SubmitButton busy={busy} className="flex-[1.6]"><Icon name="check" size={17} strokeWidth={2.4} />{editing ? 'Salvar' : 'Criar categoria'}</SubmitButton>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- Meta ---------- */
function GoalForm({ initial, onClose }) {
  const d = useApp();
  const editing = !!initial;
  const [name, setName] = useState(initial ? initial.name : '');
  const [target, setTarget] = useState(initial ? initial.target : 0);
  const [saved, setSaved] = useState(initial ? initial.saved : 0);
  const [due, setDue] = useState(initial && initial.due ? initial.due : addMonthsISO(todayISO(), 12));
  const [icon, setIcon] = useState(initial ? initial.icon : 'target');
  const [monthly, setMonthly] = useState(initial ? initial.monthly_amount || 0 : 0);
  const [remind, setRemind] = useState(initial && initial.remind_day ? initial.remind_day : '');
  const [goalAcc, setGoalAcc] = useState(initial && initial.account_id ? initial.account_id : '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const titleId = cleanId(useId());
  const months = due ? Math.max(1, (Number(due.slice(0, 4)) - Number(todayISO().slice(0, 4))) * 12 + Number(due.slice(5, 7)) - Number(todayISO().slice(5, 7))) : 0;
  const suggested = months && target > saved ? Math.ceil((target - saved) / months) : 0;
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Dê um nome para a meta.'); return; }
    if (target <= 0) { setErr('Informe quanto você quer juntar.'); return; }
    setBusy(true);
    const ok = await d.saveGoal(initial, { name: name.trim(), target, saved, due: due || null, icon, ...(d.v3 ? { monthly_amount: monthly, remind_day: remind ? Number(remind) : null, account_id: goalAcc || null } : {}) });
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} onSubmit={submit}>
      <SheetHead id={titleId} title={editing ? 'Editar meta' : 'Nova meta'} onClose={onClose} />
      <Field label="Nome"><input id="goal-name" className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Reserva de emergência" /></Field>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Quero juntar"><MoneyInput id="goal-target" label="Valor da meta" cents={target} onChange={setTarget} className="font-bold" /></Field>
        <Field label="Já tenho"><MoneyInput id="goal-saved" label="Valor guardado" cents={saved} onChange={setSaved} /></Field>
      </div>
      <DateField id="goal-due" label="Prazo" value={due} onChange={setDue} />
      <div className="mt-4"><span className="lbl">Ícone</span><div className="mt-2 flex flex-wrap gap-1.5">{['target', 'shield', 'plane', 'home', 'car', 'laptop', 'book', 'gift', 'heart', 'piggy'].map((ic) => (
        <button key={ic} type="button" aria-pressed={icon === ic} aria-label={`Ícone ${ic}`} onClick={() => setIcon(ic)} className={`grid size-10 place-items-center rounded-xl border ${icon === ic ? 'border-vivo/70 bg-vivo/15' : 'border-ink/10 text-ink/70'}`}><Icon name={ic} size={18} /></button>
      ))}</div></div>
      {d.v3 && (
        <div className="mt-4 rounded-2xl border border-ink/[0.08] bg-ink/[0.02] p-3.5">
          <p className="text-[13px] font-bold">Guardar todo mês (automático)</p>
          <p className="mt-0.5 text-xs text-ink/65">{suggested ? `Para chegar no prazo: ${fmtBRL(suggested)} por mês.` : 'Defina um valor mensal e o dia do lembrete.'}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Valor por mês"><MoneyInput id="goal-monthly" label="Valor por mês" cents={monthly} onChange={setMonthly} className="font-bold" /></Field>
            <Field label="Lembrar no dia"><select id="goal-remind" className="field" value={remind} onChange={(e) => setRemind(e.target.value)}><option value="">Sem lembrete</option>{Array.from({ length: 28 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Dia {n}</option>)}</select></Field>
          </div>
          {suggested > 0 && monthly !== suggested && <button type="button" className="mt-2 text-xs font-bold text-in" onClick={() => setMonthly(suggested)}>Usar {fmtBRL(suggested)}</button>}
          <Field label="Conta da meta (opcional)" className="mt-3" hint="Ao guardar, o Leco transfere o valor para esta conta.">
            <select id="goal-acc" className="field" value={goalAcc} onChange={(e) => setGoalAcc(e.target.value)}><option value="">Sem conta própria</option>{d.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          </Field>
        </div>
      )}
      <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>
      {confirm ? (
        <ConfirmBlock title={`Excluir a meta “${initial.name}”?`} confirmLabel="Excluir" onConfirm={async () => { if (await d.deleteRow('goals', initial)) onClose(); }} onCancel={() => setConfirm(false)} />
      ) : (
        <div className="mt-6 flex gap-2">
          {editing && <button type="button" className="icon-btn size-11 shrink-0" aria-label="Excluir meta" onClick={() => setConfirm(true)}><Icon name="trash" size={17} /></button>}
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          <SubmitButton busy={busy} className="flex-[1.6]"><Icon name="check" size={17} strokeWidth={2.4} />{editing ? 'Salvar' : 'Criar meta'}</SubmitButton>
        </div>
      )}
    </Sheet>
  );
}

function ModalHost() {
  const d = useApp();
  const m = d.modal;
  if (!m) return null;
  return <div data-closing={m.closing ? 'true' : undefined} className={m.closing ? 'pointer-events-none' : ''}><ModalBody m={m} close={d.closeModal} /></div>;
}

function ModalBody({ m, close }) {
  switch (m.kind) {
    case 'quick': return <QuickAddSheet key={m.key} onClose={close} />;
    case 'tx': return <TxForm key={m.key} initial={m.initial} defaultKind={m.defaultKind} presetSource={m.presetSource} presetDate={m.presetDate} scanFile={m.scanFile} onClose={close} />;
    case 'account': return <AccountForm key={m.key} initial={m.initial} presetKind={m.presetKind} onClose={close} />;
    case 'card': return <CardForm key={m.key} initial={m.initial} onClose={close} />;
    case 'invoice': return <InvoiceSheet key={m.key} card={m.card} initialInvoice={m.invoice} onClose={close} />;
    case 'recurring': return <RecurringForm key={m.key} initial={m.initial} onClose={close} />;
    case 'category': return <CategoryForm key={m.key} initial={m.initial} initialKind={m.initialKind} onClose={close} />;
    case 'goal': return <GoalForm key={m.key} initial={m.initial} onClose={close} />;
    case 'adjust': return <AdjustSheet key={m.key} account={m.account} onClose={close} />;
    case 'template': return <TemplateForm key={m.key} initial={m.initial} onClose={close} />;
    case 'debt': return <DebtForm key={m.key} initial={m.initial} onClose={close} />;
    case 'debtPay': return <DebtPaySheet key={m.key} debt={m.debt} onClose={close} />;
    case 'goalSave': return <GoalSaveSheet key={m.key} goal={m.goal} onClose={close} />;
    case 'import': return <ImportSheet key={m.key} onClose={close} />;
    case 'restore': return <RestoreSheet key={m.key} onClose={close} />;
    case 'search': return <SearchSheet key={m.key} onClose={close} />;
    case 'monthSummary': return <MonthSummarySheet key={m.key} month={m.month} onClose={close} />;
    case 'pin': return <PinSetupSheet key={m.key} onClose={close} />;
    case 'deleteTx': return <DeleteTxSheet key={m.key} t={m.t} onClose={close} />;
    case 'catTx': return <CatTxSheet key={m.key} catKey={m.catKey} label={m.label} color={m.color} from={m.from} to={m.to} txKind={m.txKind} onClose={close} />;
    default: return null;
  }
}
