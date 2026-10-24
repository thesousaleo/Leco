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
    <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
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
    const ok = await d.saveTx(null, base, p.card_id || p.installments > 1 ? p.installments : 1);
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
              <p className="truncate text-xs text-ink/65">{cat ? cat.name : 'Categoria: Outros'} · {src ? src.name : 'Sem conta'} · {fmtDate(p.date)}{p.installments > 1 ? ` · ${p.installments}x` : ''}</p>
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

// Botão que abre a câmera/galeria (o arquivo precisa ser escolhido no toque do próprio botão)
function ScanButton({ onFile, className = '', children, label = 'Ler comprovante com IA' }) {
  const ref = useRef(null);
  return (
    <>
      <button type="button" className={className} aria-label={label} onClick={() => { haptic(); if (ref.current) ref.current.click(); }}>{children}</button>
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) onFile(f); e.target.value = ''; }} />
    </>
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
    <div className={`mb-3 flex items-start gap-3 rounded-2xl px-4 py-3 ${state.bad ? 'bg-coral/10' : state.warn ? 'bg-ouro/15' : 'bg-vivo/10'}`} role="status">
      <Icon name={state.bad ? 'alert' : 'sparkle'} size={18} className={`mt-0.5 shrink-0 ${state.bad ? 'text-out' : 'text-in'}`} />
      <p className="min-w-0 text-[13px] leading-relaxed">{state.text}</p>
    </div>
  );
}
