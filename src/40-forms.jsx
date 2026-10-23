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
  if (t.kind === 'transfer') return { icon: 'swap', color: '#5E8CA6', title: t.description || 'Transferência', sub: `${acc ? acc.name : '?'} → ${to ? to.name : '?'}`, tone: 'text-ink', sign: '' };
  if (t.kind === 'card_payment') return { icon: 'card', color: card ? card.color : '#0F5C4D', title: t.description || `Pagamento da fatura ${card ? card.name : ''}`, sub: `${acc ? acc.name : 'Conta'} · fatura de ${t.invoice ? invoiceLabel(t.invoice) : ''}`, tone: 'text-ink', sign: '−' };
  const where = card ? `${card.name}${t.invoice ? ` · fatura ${monthShort(t.invoice).toLowerCase()}` : ''}` : acc ? acc.name : 'Sem conta';
  return {
    icon: cat ? cat.icon : t.kind === 'in' ? 'inArrow' : 'tag', color: cat ? cat.color : '#9AA9A4',
    title: t.description || (cat ? cat.name : 'Sem descrição'), sub: `${cat ? cat.name : 'Sem categoria'} · ${where}`,
    tone: t.kind === 'in' ? 'text-in' : 'text-out', sign: t.kind === 'in' ? '+' : '−',
  };
}

function TxItem({ t, onOpen, onConfirm, showDate = true, dense = false }) {
  const d = useApp();
  const m = useMoneyText();
  const meta = txMeta(t, d);
  return (
    <li className={`group flex items-center gap-3 rounded-2xl px-1.5 ${dense ? 'py-2' : 'py-2.5'} transition-colors hover:bg-ink/[0.03] ${d.freshIds.includes(t.id) ? 'flash' : ''}`}>
      <button type="button" onClick={() => onOpen && onOpen(t)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Abrir ${meta.title}`}>
        <ColorIcon icon={meta.icon} color={meta.color} size={dense ? 36 : 40} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold">{meta.title}</span>
            {!t.paid && <span className={`shrink-0 ${t.date < todayISO() ? 'pill pill-bad' : 'badge-gold'} !px-2 !py-0 !text-[10.5px]`}>{t.kind === 'in' ? 'a receber' : 'a pagar'}</span>}
          </span>
          <span className="block truncate text-xs text-ink/65">{meta.sub}{showDate ? ` · ${fmtDate(t.date)}` : ''}</span>
        </span>
      </button>
      {!t.paid && onConfirm && (
        <button type="button" className="btn btn-ghost shrink-0 !px-3 !py-1.5 text-xs" onClick={() => onConfirm(t)}>
          <Icon name="check" size={14} strokeWidth={2.4} />{t.kind === 'in' ? 'Recebi' : 'Paguei'}
        </button>
      )}
      <span className={`shrink-0 whitespace-nowrap text-[14px] font-extrabold tabular-nums ${meta.tone} ${!t.paid ? 'opacity-60' : ''}`}>{meta.sign}{meta.sign ? ' ' : ''}{m(t.amount)}</span>
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

/* ---------- Transação ---------- */
function TxForm({ initial, defaultKind = 'out', presetSource, onClose }) {
  const d = useApp();
  const editing = !!(initial && initial.id);
  const accounts = d.accounts.filter((a) => !a.archived || (initial && (a.id === initial.account_id || a.id === initial.to_account_id)));
  const cards = d.cards.filter((c) => !c.archived || (initial && c.id === initial.card_id));
  const [kind, setKind] = useState(initial ? initial.kind : defaultKind);
  const [amount, setAmount] = useState(initial ? initial.amount : 0);
  const [desc, setDesc] = useState(initial ? (initial.installments ? initial.description.replace(/ \(\d+\/\d+\)$/, '') : initial.description) : '');
  const [date, setDate] = useState(initial ? initial.date : todayISO());
  const firstCat = (k) => (d.categories.find((c) => c.kind === k && !c.archived) || {}).id || null;
  const [cat, setCat] = useState(initial ? initial.category_id : null);
  const [source, setSource] = useState(() => {
    if (initial && initial.card_id) return `card:${initial.card_id}`;
    if (initial && initial.account_id) return `acc:${initial.account_id}`;
    if (presetSource) return presetSource;
    return accounts[0] ? `acc:${accounts[0].id}` : '';
  });
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
  const titleId = cleanId(useId());
  const isCard = source.startsWith('card:');
  const card = isCard ? cards.find((c) => c.id === source.slice(5)) : null;
  useEffect(() => { if (!paidTouched) setPaid(date <= todayISO()); }, [date]);
  useEffect(() => { if (kind === 'in' && isCard) setSource(accounts[0] ? `acc:${accounts[0].id}` : ''); if (kind !== 'out') setInstallments(1); if (kind === 'transfer') setRepeat(false); }, [kind]);
  const canSplit = kind === 'out' && !editing && !repeat;
  const canRepeat = kind !== 'transfer' && !editing && installments === 1;
  // Atalhos: Parcelada e Assinatura
  const shortcutSplit = () => { switchKind('out'); setRepeat(false); setInstallments((n) => (n > 1 ? 1 : 2)); };
  const shortcutSub = () => {
    switchKind('out'); setInstallments(1);
    const turnOn = !repeat;
    setRepeat(turnOn);
    if (turnOn) { setFreq('monthly'); const sub = d.categories.find((c) => c.kind === 'out' && !c.archived && /assinatura/i.test(c.name)); if (sub) setCat(sub.id); }
  };
  const switchKind = (k) => { setKind(k); if (cat && (d.categories.find((c) => c.id === cat) || {}).kind !== k) setCat(null); };
  const fallbackCat = (k) => { const n = k === 'in' ? 'outras receitas' : 'outros gastos'; const c = d.categories.find((x) => x.kind === k && x.name.toLowerCase() === n); return c ? c.id : firstCat(k); };
  const catList = d.categories.filter((c) => c.kind === kind && (!c.archived || c.id === cat));

  const createQuickCat = async () => {
    const name = (quickCat || '').trim();
    if (!name) return;
    const row = await d.saveCategory(null, { name, kind, icon: 'tag', color: SWATCHES[(catList.length * 5) % SWATCHES.length], budget: 0 });
    if (row) { setCat(row.id); setQuickCat(null); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (quickCat != null) { await createQuickCat(); return; }
    const er = {};
    if (amount <= 0) er.amount = 'Informe um valor maior que zero.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) er.date = 'Escolha a data.';
    if (kind === 'transfer') {
      if (!source.startsWith('acc:')) er.source = 'Escolha a conta de origem.';
      if (!toAcc || `acc:${toAcc}` === source) er.to = 'Escolha uma conta de destino diferente.';
    } else if (!source) er.source = 'Escolha de onde sai (ou para onde vai) o dinheiro.';
    if (repeat && endDate && endDate < date) er.end = 'O fim precisa ser depois da primeira data.';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const base = {
      kind, amount, description: desc.trim() || (kind === 'transfer' ? 'Transferência' : (d.categories.find((c) => c.id === (cat || fallbackCat(kind))) || {}).name || (kind === 'in' ? 'Receita' : 'Despesa')),
      date, notes: notes.trim() || null,
      category_id: kind === 'transfer' ? null : cat || fallbackCat(kind),
      account_id: source.startsWith('acc:') ? source.slice(4) : null,
      to_account_id: kind === 'transfer' ? toAcc : null,
      card_id: isCard && kind === 'out' ? card.id : null,
      paid: isCard ? true : paid,
    };
    const ok = repeat && canRepeat ? await d.saveTxRepeat(base, freq, endDate) : await d.saveTx(initial, base, canSplit ? installments : 1);
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
      {initial && initial.kind === 'card_payment' ? (
        <p className="rounded-2xl bg-ink/[0.04] p-4 text-[13px] text-ink/75">Pagamentos de fatura não podem ser editados. Exclua e registre de novo, se precisar.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de transação">
            {[{ v: 'out', l: 'Despesa', i: 'up', tone: 'border-coral/60 bg-coral/15 text-out' }, { v: 'in', l: 'Receita', i: 'inArrow', tone: 'border-vivo/50 bg-vivo/15 text-in' }, { v: 'transfer', l: 'Transferir', i: 'swap', tone: 'border-[#5E8CA6]/60 bg-[#5E8CA6]/15 text-ink' }].map((o) => (
              <button key={o.v} type="button" role="radio" aria-checked={kind === o.v} disabled={editing && initial.kind !== o.v && (initial.kind === 'transfer' || o.v === 'transfer')} onClick={() => switchKind(o.v)}
                className={`flex items-center justify-center gap-1.5 rounded-2xl border py-3 text-[13px] font-bold transition-all disabled:opacity-35 ${kind === o.v ? o.tone : 'border-ink/10 bg-ink/[0.03] text-ink/70 hover:text-ink'}`}>
                <Icon name={o.i} size={15} strokeWidth={2.2} />{o.l}
              </button>
            ))}
          </div>
          {!editing && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[{ on: installments > 1, l: 'Parcelada', i: 'card', fn: shortcutSplit }, { on: repeat && kind === 'out', l: 'Assinatura', i: 'repeat', fn: shortcutSub }].map((o) => (
                <button key={o.l} type="button" aria-pressed={o.on} onClick={o.fn}
                  className={`flex items-center justify-center gap-1.5 rounded-2xl border py-2.5 text-[12.5px] font-bold transition-all ${o.on ? 'border-ouro bg-ouro/25 text-ink shadow-[0_0_0_3px_rgba(232,163,23,.18)]' : 'border-ink/10 bg-ink/[0.03] text-ink/70 hover:text-ink'}`}>
                  <Icon name={o.i} size={15} strokeWidth={2.2} />{o.l}
                </button>
              ))}
            </div>
          )}
          <Field label="Valor" error={errors.amount} className="mt-5">
            <MoneyInput id="tx-amount" label="Valor" cents={amount} onChange={setAmount} invalid={errors.amount}
              className={`!py-3 text-[30px] font-extrabold tracking-[-0.02em] ${kind === 'in' ? 'text-in' : kind === 'out' ? 'text-out' : ''}`} />
          </Field>
          <Field label="Descrição" className="mt-4">
            <input id="tx-desc" className="field" value={desc} maxLength={60} onChange={(e) => setDesc(e.target.value)} placeholder={kind === 'in' ? 'Ex.: Salário de outubro' : kind === 'out' ? 'Ex.: Supermercado' : 'Ex.: Guardar na poupança'} />
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
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {catList.map((c) => (
                    <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}
                      className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-[11.5px] font-semibold transition-all ${cat === c.id ? 'border-vivo/60 bg-vivo/15 text-ink shadow-[0_0_0_3px_rgba(20,128,107,.12)]' : 'border-ink/10 bg-ink/[0.03] text-ink/75 hover:bg-ink/[0.06]'}`}>
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
                {quickCat != null && (
                  <div className="mt-2 flex gap-2">
                    <input id="tx-newcat" autoFocus className="field !rounded-full !py-2 text-sm" placeholder="Nome da nova categoria" value={quickCat} maxLength={30} onChange={(e) => setQuickCat(e.target.value)} />
                    <button type="button" className="btn btn-primary !px-4 !py-2 text-[13px]" onClick={createQuickCat} disabled={!quickCat.trim()}>Criar</button>
                    <button type="button" className="icon-btn size-10 shrink-0" aria-label="Cancelar nova categoria" onClick={() => setQuickCat(null)}><Icon name="x" size={16} /></button>
                  </div>
                )}
              </fieldset>
              <Field label={kind === 'in' ? 'Entra em' : 'Pago com'} error={errors.source} className="mt-4">
                <select id="tx-source" className="field" value={source} onChange={(e) => setSource(e.target.value)} disabled={editing && !!initial.group_id}>
                  <optgroup label="Contas">{accounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}</optgroup>
                  {kind === 'out' && cards.length > 0 && <optgroup label="Cartões de crédito">{cards.map((c) => <option key={c.id} value={`card:${c.id}`}>{c.name} (crédito)</option>)}</optgroup>}
                </select>
              </Field>
              {canSplit && (
                <Field label="Parcelas" className="mt-4" hint={card ? `${installments > 1 ? `${installments}x de ${fmtBRL(perInstallment)} · ` : ''}primeira parcela na fatura de ${invoiceLabel(invoiceOf(card, date || todayISO()))}` : installments > 1 ? `${installments}x de ${fmtBRL(perInstallment)} · 1ª em ${fmtDate(date || todayISO())}, depois todo dia ${Number((date || todayISO()).slice(8, 10))}. As próximas ficam "a pagar".` : 'Boleto, carnê ou Pix parcelado: cria as parcelas nos próximos meses.'}>
                  <select id="tx-inst" className="field" value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>)}
                  </select>
                </Field>
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
          {canRepeat && (
            <div className="mt-4 rounded-2xl border border-ink/[0.08] bg-ink/[0.02] px-3.5">
              <Toggle id="tx-repeat" icon="repeat" label={kind === 'in' ? 'Repetir (receita fixa)' : 'Repetir (assinatura ou conta fixa)'}
                desc={repeat ? (isCard ? 'Cai em toda fatura do cartão, sem precisar lançar de novo.' : 'O Leco lança sozinho nas próximas datas como "a pagar" e avisa antes.') : 'Netflix, academia, aluguel, salário…'}
                checked={repeat} onChange={setRepeat} />
              {repeat && (
                <div className="grid gap-3 pb-3.5 sm:grid-cols-2">
                  <div className="min-w-0">
                    <span className="lbl">Frequência</span>
                    <div className="mt-2"><Segmented full size="sm" label="Frequência" value={freq} onChange={setFreq} options={[{ value: 'weekly', label: 'Semanal' }, { value: 'monthly', label: 'Mensal' }, { value: 'yearly', label: 'Anual' }]} /></div>
                  </div>
                  <Field label="Até (opcional)" error={errors.end} hint={endDate ? fmtDate(endDate) : 'Sem data de fim'}>
                    <input id="tx-end" type="date" className="field" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
          )}
          <Field label="Observações" className="mt-4">
            <textarea id="tx-notes" className="field min-h-[64px]" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </Field>
        </>
      )}
      {confirmDel ? (
        initial.group_id ? (
          <div className="mt-6 rounded-2xl border border-coral/40 bg-coral/10 p-4">
            <p className="text-sm font-bold">Excluir compra parcelada?</p>
            <p className="mt-1 text-xs text-ink/75">Você pode excluir só esta parcela ou todas as {initial.installments} parcelas.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button type="button" className="btn btn-ghost !py-2" onClick={() => setConfirmDel(false)}>Cancelar</button>
              <button type="button" className="btn btn-ghost !py-2" disabled={busy} onClick={() => remove('one')}>Só esta</button>
              <button type="button" className="btn btn-danger !py-2" disabled={busy} onClick={() => remove('group')}>Todas</button>
            </div>
          </div>
        ) : <ConfirmBlock title="Excluir esta transação?" text="Os saldos são recalculados na hora." confirmLabel="Excluir" busy={busy} onConfirm={() => remove('one')} onCancel={() => setConfirmDel(false)} />
      ) : (
        <div className="mt-6 flex gap-2">
          {editing && <button type="button" className="icon-btn size-11 shrink-0" aria-label="Excluir transação" onClick={() => setConfirmDel(true)}><Icon name="trash" size={17} /></button>}
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          {!(initial && initial.kind === 'card_payment') && <SubmitButton busy={busy} className="flex-[1.6]"><Icon name="check" size={17} strokeWidth={2.4} />{editing ? 'Salvar' : kind === 'in' ? 'Adicionar receita' : kind === 'out' ? 'Adicionar despesa' : 'Transferir'}</SubmitButton>}
        </div>
      )}
    </Sheet>
  );
}

/* ---------- Conta ---------- */
function AccountForm({ initial, onClose }) {
  const d = useApp();
  const editing = !!initial;
  const [name, setName] = useState(initial ? initial.name : '');
  const [kind, setKind] = useState(initial ? initial.kind : 'corrente');
  const [balance, setBalance] = useState(initial ? initial.initial_balance : 0);
  const [color, setColor] = useState(initial ? initial.color : SWATCHES[0]);
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
    const ok = await d.saveAccount(initial, { name: name.trim(), kind, initial_balance: balance, color });
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} onSubmit={submit}>
      <SheetHead id={titleId} title={editing ? 'Editar conta' : 'Nova conta'} sub={editing ? `Saldo atual: ${fmtBRL(current)} · ${used} transações` : 'Banco, carteira, poupança ou investimento.'} onClose={onClose} />
      <Field label="Nome"><input id="acc-name" className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank, Itaú, Carteira" /></Field>
      <div className="mt-4"><span className="lbl">Tipo</span><div className="mt-2"><ChoiceChips label="Tipo de conta" value={kind} onChange={setKind} options={Object.keys(ACCOUNT_KINDS).map((k) => ({ value: k, label: ACCOUNT_KINDS[k].label, icon: ACCOUNT_KINDS[k].icon }))} /></div></div>
      <Field label={editing ? 'Saldo inicial' : 'Saldo atual'} className="mt-4" hint={editing ? 'Valor que havia na conta antes das transações registradas no Leco.' : 'Quanto há nesta conta hoje.'}>
        <SignedMoney id="acc-balance" label="Saldo" cents={balance} onChange={setBalance} />
      </Field>
      <fieldset className="mt-4"><legend className="lbl">Cor</legend>
        <div className="mt-2 flex flex-wrap gap-2">{SWATCHES.map((c) => <button key={c} type="button" aria-pressed={color === c} aria-label={`Cor ${c}`} onClick={() => setColor(c)} className="size-8 rounded-full transition-transform hover:scale-105" style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--paper), 0 0 0 4px ${c}` : 'none' }} />)}</div>
      </fieldset>
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
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const titleId = cleanId(useId());
  const used = editing ? d.transactions.filter((t) => t.card_id === initial.id).length : 0;
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Dê um nome para o cartão.'); return; }
    setBusy(true);
    const ok = await d.saveCard(initial, { name: name.trim(), limit_amount: limit, closing_day: closing, due_day: due, pay_account_id: payAcc || null, color });
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
      <p className="mt-2 text-xs text-ink/65">Compras feitas hoje entram na fatura de {invoiceLabel(inv)}, que vence em {fmtDate(invoiceDue(preview, inv))}.</p>
      <Field label="Conta que paga a fatura" className="mt-4">
        <select id="card-pay" className="field" value={payAcc} onChange={(e) => setPayAcc(e.target.value)}>
          <option value="">Escolher na hora de pagar</option>
          {d.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <fieldset className="mt-4"><legend className="lbl">Cor</legend>
        <div className="mt-2 flex flex-wrap gap-2">{SWATCHES.map((c) => <button key={c} type="button" aria-pressed={color === c} aria-label={`Cor ${c}`} onClick={() => setColor(c)} className="size-8 rounded-full transition-transform hover:scale-105" style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--paper), 0 0 0 4px ${c}` : 'none' }} />)}</div>
      </fieldset>
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
    const row = await d.saveCategory(initial, { name: n, kind, icon, color, budget: kind === 'out' ? budget : 0 });
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
      <fieldset className="mt-4"><legend className="lbl">Ícone</legend>
        <div className="mt-2 grid grid-cols-10 gap-1.5 max-sm:grid-cols-5">
          {ICON_CHOICES.map((ic) => (
            <button key={ic} type="button" aria-pressed={icon === ic} aria-label={`Ícone ${ic}`} onClick={() => setIcon(ic)}
              className={`grid aspect-square place-items-center rounded-xl border transition-all ${icon === ic ? 'border-vivo/70 bg-vivo/15 text-ink' : 'border-ink/10 text-ink/70 hover:bg-ink/[0.05]'}`}><Icon name={ic} size={17} /></button>
          ))}
        </div>
      </fieldset>
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
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const titleId = cleanId(useId());
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Dê um nome para a meta.'); return; }
    if (target <= 0) { setErr('Informe quanto você quer juntar.'); return; }
    setBusy(true);
    const ok = await d.saveGoal(initial, { name: name.trim(), target, saved, due: due || null, icon });
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
  const close = d.closeModal;
  switch (m.kind) {
    case 'tx': return <TxForm key={m.key} initial={m.initial} defaultKind={m.defaultKind} presetSource={m.presetSource} onClose={close} />;
    case 'account': return <AccountForm key={m.key} initial={m.initial} onClose={close} />;
    case 'card': return <CardForm key={m.key} initial={m.initial} onClose={close} />;
    case 'invoice': return <InvoiceSheet key={m.key} card={m.card} initialInvoice={m.invoice} onClose={close} />;
    case 'recurring': return <RecurringForm key={m.key} initial={m.initial} onClose={close} />;
    case 'category': return <CategoryForm key={m.key} initial={m.initial} initialKind={m.initialKind} onClose={close} />;
    case 'goal': return <GoalForm key={m.key} initial={m.initial} onClose={close} />;
    default: return null;
  }
}
