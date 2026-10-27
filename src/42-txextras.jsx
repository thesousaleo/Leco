/* =====================================================================
   42-txextras: peças extras do formulário de lançamento (Leco 3):
   etiquetas, divisão em categorias, outra moeda, comprovante, modelos,
   escolha "só esta / próximas / todas" e lançamento rápido por texto.
   ===================================================================== */

function TagInput({ tags, onChange }) {
  const d = useApp();
  const [text, setText] = useState('');
  const all = useMemo(() => {
    const c = {};
    d.transactions.forEach((t) => (t.tags || []).forEach((g) => { c[g] = (c[g] || 0) + 1; }));
    return Object.keys(c).sort((a, b) => c[b] - c[a]);
  }, [d.transactions]);
  const clean = (s) => s.toLowerCase().replace(/^#/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  const add = (raw) => { const t = clean(raw); if (t && !tags.includes(t) && tags.length < 8) onChange([...tags, t]); setText(''); };
  const sugg = all.filter((t) => !tags.includes(t) && (!text || t.startsWith(clean(text)))).slice(0, 6);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-[14px] border border-[var(--field-border)] bg-[var(--field-bg)] px-2.5 py-2">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-vivo/15 px-2.5 py-1 text-[12px] font-bold text-ink">#{t}
            <button type="button" aria-label={`Remover etiqueta ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))} className="text-ink/60"><Icon name="x" size={12} /></button>
          </span>
        ))}
        <input id="tx-tags" className="min-w-[110px] flex-1 bg-transparent py-0.5 text-sm outline-none" value={text} placeholder={tags.length ? '' : 'viagem, trabalho…'}
          onChange={(e) => { const v = e.target.value; if (/[,\s]$/.test(v)) add(v); else setText(v); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) { e.preventDefault(); add(text); } else if (e.key === 'Backspace' && !text && tags.length) onChange(tags.slice(0, -1)); }}
          onBlur={() => text.trim() && add(text)} />
      </div>
      {sugg.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{sugg.map((t) => <button key={t} type="button" className="rounded-full border border-ink/10 px-2.5 py-0.5 text-[11.5px] font-semibold text-ink/70" onClick={() => add(t)}>#{t}</button>)}</div>}
    </div>
  );
}

function SplitEditor({ kind, total, parts, setParts }) {
  const d = useApp();
  const cats = d.categories.filter((c) => c.kind === kind && !c.archived);
  const used = sum(parts, (p) => p.amount || 0);
  const left = total - used;
  return (
    <div className="space-y-2">
      {parts.map((p, i) => (
        <div key={p.key} className="flex items-center gap-2">
          <select aria-label={`Categoria da parte ${i + 1}`} className="field min-w-0 flex-1 !py-2 text-[13px]" value={p.category_id || ''} onChange={(e) => setParts(parts.map((x) => (x.key === p.key ? { ...x, category_id: e.target.value } : x)))}>
            <option value="">Categoria…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <MoneyInput label={`Valor da parte ${i + 1}`} cents={p.amount} onChange={(v) => setParts(parts.map((x) => (x.key === p.key ? { ...x, amount: v } : x)))} className="!w-[130px] !py-2 text-[13px] font-bold" />
          {parts.length > 2 && <button type="button" className="icon-btn size-9 shrink-0" aria-label="Remover parte" onClick={() => setParts(parts.filter((x) => x.key !== p.key))}><Icon name="x" size={14} /></button>}
        </div>
      ))}
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-[12.5px]" onClick={() => setParts([...parts, { key: uid(), category_id: '', amount: Math.max(0, left) }])}><Icon name="plus" size={14} />Parte</button>
        <span className={`text-xs font-bold tabular-nums ${left === 0 ? 'text-in' : 'text-out'}`}>{left === 0 ? 'Tudo distribuído' : left > 0 ? `Faltam ${fmtBRL(left)}` : `Passou ${fmtBRL(-left)}`}</span>
      </div>
    </div>
  );
}

function ForeignAmount({ value, onChange, setAmount }) {
  const cur = CURRENCIES.find((c) => c[0] === value.currency) || CURRENCIES[0];
  const recalc = (v) => { const next = { ...value, ...v }; onChange(next); if (next.orig > 0 && next.rate > 0) setAmount(Math.round(next.orig * next.rate)); };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:grid-cols-3">
      <select aria-label="Moeda" className="field !py-2 text-[13px]" value={value.currency} onChange={(e) => recalc({ currency: e.target.value })}>
        {CURRENCIES.map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}
      </select>
      <input aria-label={`Valor em ${cur[1]}`} inputMode="decimal" className="field !py-2 text-[13px] font-bold" placeholder={`Valor em ${cur[2]}`} value={value.origText}
        onChange={(e) => { const t = e.target.value; const c = parseMoneyBR(t); recalc({ origText: t, orig: Number.isFinite(c) ? Math.abs(c) : 0 }); }} />
      <input aria-label="Cotação em reais" inputMode="decimal" className="field col-span-2 !py-2 text-[13px] sm:col-span-1" placeholder="Cotação (R$ por 1)" value={value.rateText}
        onChange={(e) => { const t = e.target.value; const r = parseFloat(t.replace(/\./g, '').replace(',', '.')); recalc({ rateText: t, rate: Number.isFinite(r) ? r : 0 }); }} />
    </div>
  );
}

function AttachmentField({ path, pending, onPick, onRemove }) {
  const d = useApp();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    let alive = true;
    if (pending) { const u = URL.createObjectURL(pending); setUrl(u); return () => URL.revokeObjectURL(u); }
    if (path) d.backend.files.url(path).then((u) => alive && setUrl(u)).catch(() => {});
    else setUrl('');
    return () => { alive = false; };
  }, [path, pending]);
  const isPdf = (pending && pending.type === 'application/pdf') || (path && path.endsWith('.pdf'));
  const open = async () => {
    if (!url) return;
    if (Native.Browser && !pending) { setBusy(true); try { await Native.Browser.open({ url }); } catch (e) { window.open(url, '_blank'); } setBusy(false); } else window.open(url, '_blank');
  };
  return (
    <div className="flex items-center gap-3">
      {(path || pending) ? (
        <>
          <button type="button" onClick={open} className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink/10 bg-ink/[0.04]" aria-label="Ver comprovante">
            {url && !isPdf ? <img src={url} alt="" className="size-full object-cover" /> : <Icon name={isPdf ? 'file' : 'image'} size={20} />}
          </button>
          <div className="min-w-0 flex-1 text-xs text-ink/70">{pending ? 'Será enviado ao salvar' : 'Comprovante anexado'}<br /><button type="button" className="font-bold text-in" onClick={open} disabled={busy}>Ver</button> · <button type="button" className="font-bold text-out" onClick={onRemove}>Remover</button></div>
        </>
      ) : (
        <button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => ref.current && ref.current.click()}><Icon name="camera" size={16} />Anexar foto ou PDF</button>
      )}
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) { if (f.size > 12 * 1024 * 1024) d.toast('Arquivo muito grande (máx. 12 MB).', null, true); else onPick(f); } e.target.value = ''; }} />
    </div>
  );
}

function TemplateChips({ kind, onPick }) {
  const d = useApp();
  const list = (d.templates || []).filter((t) => kind === 'transfer' || !kind || t.kind === kind).sort((a, b) => b.uses - a.uses).slice(0, 10);
  if (!list.length) return null;
  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
      {list.map((t) => {
        const cat = d.categories.find((c) => c.id === t.category_id);
        return (
          <button key={t.id} type="button" onClick={() => onPick(t)} className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink/10 bg-ink/[0.03] py-1.5 pl-1.5 pr-3 text-[12.5px] font-bold">
            <span className="grid size-6 place-items-center rounded-full" style={{ background: `${cat ? cat.color : '#9AA9A4'}26` }}><Icon name={cat ? cat.icon : 'bolt'} size={13} /></span>
            {t.name}{t.amount > 0 && <span className="font-semibold text-ink/60">{fmtBRL(t.amount)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function ScopeChoice({ what, onPick, onCancel, busy, danger }) {
  return (
    <div className={`mt-6 rounded-2xl border p-4 ${danger ? 'border-coral/40 bg-coral/10' : 'border-vivo/30 bg-vivo/10'}`}>
      <p className="text-sm font-bold">{danger ? 'Excluir' : 'Aplicar a mudança'} em quais lançamentos?</p>
      <p className="mt-1 text-xs text-ink/75">{what}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <button type="button" className="btn btn-ghost !py-2" onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn btn-ghost !py-2" disabled={busy} onClick={() => onPick('one')}>Só esta</button>
        <button type="button" className="btn btn-ghost !py-2" disabled={busy} onClick={() => onPick('next')}>Esta e as próximas</button>
        <button type="button" className={`btn !py-2 ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={() => onPick('all')}>Todas</button>
      </div>
    </div>
  );
}

/* ---------- Lançamento rápido por texto ---------- */
function QuickAddSheet({ onClose }) {
  const d = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const titleId = cleanId(useId());
  const p = useMemo(() => parseQuickText(text, d), [text, d.transactions, d.categories]);
  const cat = p && d.categories.find((c) => c.id === p.category_id);
  const src = p && (p.card_id ? d.cards.find((c) => c.id === p.card_id) : d.accounts.find((a) => a.id === p.account_id));
  const valid = p && p.amount > 0;
  const save = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    const base = { kind: p.kind, amount: p.amount, description: p.description || (cat ? cat.name : p.kind === 'in' ? 'Receita' : 'Despesa'), date: p.date, category_id: p.category_id || (d.categories.find((c) => c.kind === p.kind && /^outr/i.test(c.name)) || {}).id || null, account_id: p.card_id ? null : p.account_id, card_id: p.card_id, paid: p.card_id ? true : p.paid, notes: null };
    const ok = await d.saveTx(null, base, p.card_id || p.installments > 1 ? p.installments : 1, 'one', p.installments > 1 ? { per: p.instPer, start: p.instStart } : {});
    setBusy(false);
    if (ok) { setText(''); onClose(); }
  };
  const examples = ['mercado 45,90 ontem', 'recebi 3500 salário', 'tênis 300 em 3x no cartão', 'uber 23,50', 'conta de luz 180 dia 28'];
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} onSubmit={save}>
      <SheetHead id={titleId} title="Lançamento rápido" sub="Escreva do seu jeito, como numa mensagem." onClose={onClose} />
      <input id="quick-text" autoFocus className="field !py-3 text-[16px] font-semibold" placeholder="ex.: mercado 45,90 ontem" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      {!text && <div className="mt-3 flex flex-wrap gap-1.5">{examples.map((x) => <button key={x} type="button" className="rounded-full border border-ink/10 bg-ink/[0.03] px-3 py-1.5 text-[12.5px] font-semibold text-ink/75" onClick={() => setText(x)}>{x}</button>)}</div>}
      {p && (
        <div className="mt-4 rounded-2xl border border-ink/[0.08] bg-ink/[0.02] p-4">
          <div className="flex items-center gap-3">
            <ColorIcon icon={cat ? cat.icon : p.kind === 'in' ? 'inArrow' : 'tag'} color={cat ? cat.color : '#9AA9A4'} size={42} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-extrabold">{p.description || (cat ? cat.name : 'Sem descrição')}</p>
              <p className="truncate text-xs text-ink/65">{cat ? cat.name : 'Categoria: Outros'} · {src ? src.name : 'Sem conta'} · {fmtDate(p.date)}{p.installments > 1 ? ` · ${p.instStart > 1 ? `parcelas ${p.instStart} a ${p.installments}` : `${p.installments}x`}${p.instPer ? ` de ${fmtBRL(p.amount)}` : ''}` : ''}</p>
            </div>
            <span className={`shrink-0 text-[16px] font-extrabold tabular-nums ${p.kind === 'in' ? 'text-in' : 'text-out'}`}>{p.kind === 'in' ? '+' : '−'}{fmtBRL(p.amount)}</span>
          </div>
          {!valid && <p className="mt-2 text-xs font-semibold text-out">Inclua o valor, por exemplo "45,90".</p>}
        </div>
      )}
      <div className="mt-5 flex gap-2">
        <button type="button" className="btn btn-ghost flex-1" onClick={() => { onClose(); setTimeout(() => d.openModal({ kind: 'tx', initial: valid ? { kind: p.kind, amount: p.amount, description: p.description, date: p.date, category_id: p.category_id, account_id: p.account_id, card_id: p.card_id, paid: p.paid } : undefined }), 240); }}>Abrir completo</button>
        <SubmitButton busy={busy} disabled={!valid} className="flex-[1.6]"><Icon name="check" size={17} strokeWidth={2.4} />Lançar</SubmitButton>
      </div>
    </Sheet>
  );
}

/* ---------- Leitura de comprovante com IA ---------- */
const blobToBase64 = (blob) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = bad; r.readAsDataURL(blob); });
async function readReceiptFile(d, file) {
  const prep = file.type === 'application/pdf' ? file : await shrinkImage(file);
  if (prep.size > 6.5 * 1024 * 1024) throw new Error('Arquivo muito grande. Tente uma foto menor ou um PDF de até 6 MB.');
  const image = await blobToBase64(prep);
  const names = (k) => d.categories.filter((c) => c.kind === k && !c.archived).map((c) => c.name);
  return d.backend.ai.readReceipt({
    image, mime: prep.type || 'image/jpeg', today: todayISO(),
    categories: { out: names('out'), in: names('in') }, cards: d.cards.filter((c) => !c.archived).map((c) => c.name),
  });
}

// Botão de leitura de comprovante: no celular pergunta se é para tirar a foto agora ou escolher um arquivo.
// (o arquivo precisa ser escolhido no toque do próprio botão, por isso os campos ficam escondidos aqui)
const TOUCH_UI = NATIVE || !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
function ScanButton({ onFile, className = '', children, label = 'Ler comprovante com IA' }) {
  const cam = useRef(null);
  const file = useRef(null);
  const [menu, setMenu] = useState(false);
  const pick = (e) => { const f = e.target.files && e.target.files[0]; if (f) onFile(f); e.target.value = ''; };
  const open = () => { haptic(); if (!TOUCH_UI) { if (file.current) file.current.click(); return; } setMenu(true); };
  return (
    <>
      <button type="button" className={className} aria-label={label} onClick={open}>{children}</button>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} data-scan="camera" />
      <input ref={file} type="file" accept="image/*,application/pdf" className="hidden" onChange={pick} data-scan="file" />
      {menu && ReactDOM.createPortal(
        <ScanMenu onClose={() => setMenu(false)}
          onCamera={() => { setMenu(false); if (cam.current) cam.current.click(); }}
          onFile={() => { setMenu(false); if (file.current) file.current.click(); }} />, document.body)}
    </>
  );
}

function ScanMenu({ onCamera, onFile, onClose }) {
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  const Opt = ({ icon, title, sub, fn, primary }) => (
    <button type="button" onClick={fn} className={`tap flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left ${primary ? 'bg-vivo/12 border border-vivo/30' : 'border border-ink/10 bg-ink/[0.03]'}`}>
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${primary ? 'bg-gradient-to-br from-vivo to-leco text-white' : 'bg-ink/[0.06] text-ink'}`}><Icon name={icon} size={20} /></span>
      <span className="min-w-0"><span className="block text-[14.5px] font-bold">{title}</span><span className="block text-xs text-ink/65">{sub}</span></span>
    </button>
  );
  return (
    <div className="overlay-in fixed inset-0 z-[95] flex items-end justify-center" style={{ background: 'var(--scrim)' }} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Ler comprovante" className="glass-deep sheet-in w-full max-w-[520px] rounded-b-none rounded-t-[28px] p-4 pb-[calc(20px+var(--safe-bottom))]">
        <div className="mb-2 flex justify-center"><span className="h-1.5 w-10 rounded-full bg-ink/20" /></div>
        <p className="px-1 text-[17px] font-extrabold tracking-[-0.02em]">Ler comprovante</p>
        <p className="mb-3 px-1 text-xs text-ink/65">A IA lê valor, data e loja e preenche o lançamento para você conferir.</p>
        <div className="space-y-2">
          <Opt primary icon="camera" title="Tirar foto agora" sub="Abre a câmera. Enquadre o cupom inteiro." fn={onCamera} />
          <Opt icon="image" title="Escolher da galeria ou PDF" sub="Print de Pix, foto salva ou arquivo." fn={onFile} />
        </div>
        <button type="button" className="btn btn-ghost mt-3 w-full" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

// Faixa "Preencher automaticamente": comprovante (foto/arquivo), texto livre e modelos, num lugar só e recolhida
function AutoFill({ kind, onScan, onQuick, onTemplate }) {
  const d = useApp();
  const [open, setOpen] = useState(false);
  const hasTemplates = !!onTemplate && (d.templates || []).some((t) => kind === 'transfer' || t.kind === kind);
  return (
    <div className="-mt-1 mb-4 rounded-2xl border border-ink/[0.08] bg-ink/[0.02]">
      <button type="button" className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-vivo/12 text-in"><Icon name="sparkle" size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold">Preencher automaticamente</span>
          <span className="block truncate text-xs text-ink/60">{hasTemplates ? 'Foto, mensagem ou modelo' : 'Foto do comprovante ou mensagem'}</span>
        </span>
        <Icon name={open ? 'chevUp' : 'chevDown'} size={16} className="shrink-0 text-ink/60" />
      </button>
      {open && (
        <div className="rise px-3 pb-3">
          <div className="grid grid-cols-2 gap-2">
            <ScanButton onFile={onScan} className="tap flex items-center gap-2 rounded-xl border border-vivo/35 bg-vivo/10 px-3 py-2.5 text-left text-[13px] font-bold"><Icon name="camera" size={17} className="shrink-0 text-in" /><span className="min-w-0">Comprovante<span className="block text-[11px] font-semibold text-ink/60">Foto ou PDF · IA</span></span></ScanButton>
            <button type="button" onClick={onQuick} className="tap flex items-center gap-2 rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2.5 text-left text-[13px] font-bold"><Icon name="bolt" size={17} className="shrink-0 text-in" /><span className="min-w-0">Escrever<span className="block text-[11px] font-semibold text-ink/60">"mercado 45 ontem"</span></span></button>
          </div>
          {hasTemplates && (
            <div className="mt-3">
              <span className="lbl">Modelos</span>
              <div className="mt-2"><TemplateChips kind={kind} onPick={(t) => { onTemplate(t); setOpen(false); }} /></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScanStatus({ state }) {
  if (!state) return null;
  if (state.busy) return (
    <div className="mb-3 flex items-center gap-3 rounded-2xl border border-vivo/30 bg-vivo/10 px-4 py-3" role="status">
      <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-vivo/15 text-in"><Icon name="sparkle" size={18} /><span className="scan-pulse absolute inset-0 rounded-xl" /></span>
      <div className="min-w-0"><p className="text-[13.5px] font-bold">Lendo o comprovante…</p><p className="text-xs text-ink/65">A IA está identificando valor, data e loja.</p></div>
    </div>
  );
  return (
    <div className={`mb-3 flex items-start gap-3 rounded-2xl px-4 py-3 ${state.bad ? 'bg-coral/10' : state.warn ? 'bg-attn' : 'bg-vivo/10'}`} role="status">
      <Icon name={state.bad ? 'alert' : 'sparkle'} size={18} className={`mt-0.5 shrink-0 ${state.bad ? 'text-out' : 'text-in'}`} />
      <p className="min-w-0 text-[13px] leading-relaxed">{state.text}</p>
    </div>
  );
}

// Barra da edição em massa: categoria, marcar como pago, excluir
function BulkBar({ rows, onClear, onAll, allCount = 0 }) {
  const d = useApp();
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const ids = rows.map((t) => t.id);
  const kinds = [...new Set(rows.map((t) => t.kind).filter((k) => k === 'in' || k === 'out'))];
  const cats = kinds.length === 1 ? d.categories.filter((c) => c.kind === kinds[0] && !c.archived) : [];
  const unpaid = rows.filter((t) => !t.paid && (t.kind === 'in' || t.kind === 'out'));
  const run = async (fn) => { setBusy(true); const ok = await fn(); setBusy(false); if (ok) onClear(); };
  return ReactDOM.createPortal(
    <div className="toast-top fixed left-1/2 top-[calc(10px+var(--safe-top))] z-[85] w-[min(720px,calc(100%-20px))]">
      <div role="toolbar" aria-label="Ações em massa" className="glass-deep flex flex-wrap items-center gap-2 rounded-2xl p-2.5 pl-4 text-[13px]">
        <span className="font-bold">{rows.length ? plural(rows.length, 'selecionado', 'selecionados') : 'Toque nos lançamentos para selecionar'}</span>
        {onAll && allCount > rows.length && <button type="button" className="text-[12.5px] font-bold text-in hover:underline" onClick={onAll}>Selecionar todos ({allCount})</button>}
        {!rows.length ? <span className="ml-auto"><button type="button" className="icon-btn size-8" aria-label="Cancelar seleção" onClick={onClear}><Icon name="x" size={14} /></button></span> : confirmDel ? (
          <>
            <span className="text-ink/70">Excluir de vez?</span>
            <span className="ml-auto flex gap-2">
              <button type="button" className="btn btn-ghost !py-1.5 text-[12.5px]" onClick={() => setConfirmDel(false)}>Cancelar</button>
              <button type="button" className="btn btn-danger !py-1.5 text-[12.5px]" disabled={busy} onClick={() => run(() => d.bulkDeleteTx(ids))}>{busy ? <Spinner size={13} /> : <Icon name="trash" size={14} />}Excluir {rows.length}</button>
            </span>
          </>
        ) : (
          <>
            <span className="ml-auto flex flex-wrap items-center gap-2">
              {cats.length > 0 ? (
                <select aria-label="Mudar categoria" className="field !w-auto !py-1.5 text-[12.5px]" value="" disabled={busy} onChange={(e) => { const v = e.target.value; if (v) run(() => d.bulkTx(ids, { category_id: v }, 'Categoria alterada')); }}>
                  <option value="">Mudar categoria…</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : kinds.length > 1 ? <span className="text-[12px] text-ink/55">Receitas e despesas juntas: categoria só para um tipo</span> : null}
              {unpaid.length > 0 && <button type="button" className="btn btn-ghost !py-1.5 text-[12.5px]" disabled={busy} onClick={() => run(() => d.bulkTx(unpaid.map((t) => t.id), { paid: true }, `${plural(unpaid.length, 'lançamento confirmado', 'lançamentos confirmados')}`))}><Icon name="check" size={14} />Marcar como pago</button>}
              <button type="button" className="btn btn-ghost !py-1.5 text-[12.5px] hover:!text-out" onClick={() => setConfirmDel(true)}><Icon name="trash" size={14} />Excluir</button>
              <button type="button" className="icon-btn size-8" aria-label="Cancelar seleção" onClick={onClear}><Icon name="x" size={14} /></button>
            </span>
          </>
        )}
      </div>
    </div>, document.body);
}


/* ---------- Calculadora do valor (somar notas sem sair do app) ---------- */
// Avalia a conta sem eval: números com vírgula, + − × ÷ e % (10% de algo, como no celular)
function calcEval(expr) {
  const src = String(expr).replace(/\s/g, '').replace(/,/g, '.').replace(/[−–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  const toks = [];
  for (let i = 0; i < src.length;) {
    const c = src[i];
    if (/[0-9.]/.test(c)) { let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++; const n = Number(src.slice(i, j)); if (!isFinite(n)) return null; toks.push(n); i = j; }
    else if ('+-*/%'.includes(c)) { toks.push(c); i++; } else return null;
  }
  while (toks.length && typeof toks[toks.length - 1] === 'string' && toks[toks.length - 1] !== '%') toks.pop(); // ignora operador no fim
  if (!toks.length) return 0;
  let p = 0;
  const num = () => {
    let sign = 1;
    while (toks[p] === '-' || toks[p] === '+') { if (toks[p] === '-') sign = -sign; p++; }
    const n = toks[p++];
    if (typeof n !== 'number') throw new Error('x');
    return sign * n;
  };
  const term = () => {
    let v = num(), pct = false;
    if (toks[p] === '%') { p++; pct = true; v /= 100; }
    while (toks[p] === '*' || toks[p] === '/') {
      const op = toks[p++]; let r = num();
      if (toks[p] === '%') { p++; r /= 100; }
      if (op === '/' && r === 0) throw new Error('div');
      v = op === '*' ? v * r : v / r; pct = false;
    }
    return { v, pct };
  };
  try {
    let { v } = term();
    while (toks[p] === '+' || toks[p] === '-') {
      const op = toks[p++]; const t = term();
      const r = t.pct ? v * t.v : t.v; // 100 + 10% = 110
      v = op === '+' ? v + r : v - r;
    }
    if (p < toks.length) return null;
    return Math.round(v * 100) / 100;
  } catch (e) { return e.message === 'div' ? NaN : null; }
}
const calcFmt = (n) => (n == null || isNaN(n) ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }));

function CalcPad({ cents, onUse, onClose }) {
  const [expr, setExpr] = useState(() => (cents > 0 ? String(cents / 100).replace('.', ',') : ''));
  const [done, setDone] = useState(false); // depois do "=" um número novo começa outra conta
  const ref = useRef(null);
  const exprRef = useRef(null);
  const val = calcEval(expr);
  const ok = val != null && !isNaN(val) && val > 0 && val < 1e10;
  useEffect(() => { if (ref.current) ref.current.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (exprRef.current) exprRef.current.scrollLeft = exprRef.current.scrollWidth; }, [expr]);
  const isOp = (c) => '+−×÷'.includes(c);
  const press = (k) => {
    haptic();
    const r = ((e) => {
      const last = e.slice(-1);
      const lastNum = e.split(/[+−×÷]/).pop();
      if (k === 'C') { setDone(false); return ''; }
      if (k === '⌫') { setDone(false); return e.slice(0, -1); }
      if (k === '=') { const v = calcEval(e); if (v == null || isNaN(v)) return e; setDone(true); return calcFmt(v).replace(/\./g, ''); }
      if (isOp(k)) { setDone(false); if (!e) return k === '−' ? '−' : ''; if (isOp(last)) return e.slice(0, -1) + k; if (last === ',') return e.slice(0, -1) + k; return e + k; }
      if (k === '%') { if (!e || isOp(last) || last === '%') return e; return e + '%'; }
      if (done) { setDone(false); e = ''; }
      if (k === ',') { if (lastNum.includes(',')) return e; return e + (lastNum === '' || last === '%' ? '0,' : ','); }
      if (last === '%') return e;
      const dec = lastNum.split(',')[1];
      if (dec != null && dec.length >= 2) return e; // centavos: no máximo 2 casas
      if (lastNum.replace(',', '').length >= 10) return e;
      if (lastNum === '0' && k !== '00') return e.slice(0, -1) + k;
      if (k === '00' && (lastNum === '' || lastNum === '0')) return e + (lastNum === '' ? '0' : '');
      return e + k;
    })(expr);
    if (r !== expr) setExpr(r);
  };
  const use = () => { if (!ok) return; haptic('success'); onUse(Math.round(val * 100)); };
  const onKey = (e) => {
    const map = { '+': '+', '-': '−', '*': '×', x: '×', X: '×', '/': '÷', ',': ',', '.': ',', '%': '%', Backspace: '⌫', Delete: 'C', '=': '=' };
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
    else if (map[e.key]) { e.preventDefault(); press(map[e.key]); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (ok) use(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
  };
  const keys = [['C', '⌫', '%', '÷'], ['7', '8', '9', '×'], ['4', '5', '6', '−'], ['1', '2', '3', '+'], ['00', '0', ',', '=']];
  const label = { 'C': 'Limpar', '⌫': 'Apagar', '%': 'Porcentagem', '÷': 'Dividir', '×': 'Multiplicar', '−': 'Subtrair', '+': 'Somar', '=': 'Igual', ',': 'Vírgula' };
  const tone = (k) => (k === '=' ? 'calc-eq' : isOp(k) || k === '%' ? 'calc-op' : k === 'C' || k === '⌫' ? 'calc-fn' : 'calc-num');
  return (
    <div ref={ref} tabIndex={-1} onKeyDown={onKey} className="calc-pad mt-3 rounded-[22px] p-3 outline-none" role="group" aria-label="Calculadora">
      <div className="px-2 pb-2.5 pt-1 text-right">
        <div ref={exprRef} className="no-scrollbar overflow-x-auto whitespace-nowrap text-[15px] font-semibold tabular-nums text-ink/60" aria-label="Conta">{expr ? expr.replace(/(.)([+−×÷])/g, '$1 $2 ') : '0'}</div>
        <div className={`mt-0.5 text-[26px] font-extrabold leading-tight tracking-[-0.02em] tabular-nums ${val != null && val < 0 ? 'text-out' : ''}`} aria-live="polite" data-calc-result>
          {val != null && isNaN(val) ? 'Não dá para dividir por zero' : `= ${fmtBRL(Math.round((val || 0) * 100))}`}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {keys.flat().map((k) => (
          <button key={k} type="button" className={`calc-key ${tone(k)}`} aria-label={label[k] || k} onClick={() => press(k)}>{k}</button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-1.5">
        <button type="button" className="btn btn-ghost !py-2.5 text-[13px]" onClick={onClose}>Fechar</button>
        <button type="button" className="btn btn-primary !py-2.5 text-[14px]" disabled={!ok} onClick={use} data-calc-use>
          <Icon name="check" size={16} strokeWidth={2.4} />{ok ? `Usar ${fmtBRL(Math.round(val * 100))}` : val != null && val < 0 ? 'O total precisa ser positivo' : 'Usar o valor'}
        </button>
      </div>
    </div>
  );
}
