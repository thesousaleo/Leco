/* =====================================================================
   45-sheets: janelas do Leco 3 — ajustar saldo, modelos, dívidas, guardar na meta,
   importar extrato, restaurar cópia, busca global e resumo do mês.
   ===================================================================== */

function AdjustSheet({ account, onClose }) {
  const d = useApp();
  const cur = d.balances[account.id] || 0;
  const [real, setReal] = useState(cur);
  const [busy, setBusy] = useState(false);
  const titleId = cleanId(useId());
  const diff = real - cur;
  const submit = async (e) => { e.preventDefault(); setBusy(true); const ok = await d.adjustBalance(account, real); setBusy(false); if (ok) onClose(); };
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} onSubmit={submit}>
      <SheetHead id={titleId} title={`Ajustar saldo · ${account.name}`} sub="Informe o saldo que aparece no app do banco agora." onClose={onClose} />
      <div className="rounded-2xl bg-ink/[0.04] px-4 py-3 text-[13px]"><span className="text-ink/70">Saldo no Leco:</span> <b className="tabular-nums">{fmtBRL(cur)}</b></div>
      <Field label="Saldo real" className="mt-4"><SignedMoney id="adj-real" label="Saldo real" cents={real} onChange={setReal} /></Field>
      <p className={`mt-3 text-[13px] font-semibold ${diff === 0 ? 'text-ink/65' : diff > 0 ? 'text-in' : 'text-out'}`}>
        {diff === 0 ? 'Sem diferença.' : `Diferença de ${diff > 0 ? '+' : '−'}${fmtBRL(Math.abs(diff))}. ${d.v3 ? 'O Leco cria um "Ajuste de saldo" que não entra nos relatórios.' : 'O saldo inicial da conta é corrigido.'}`}
      </p>
      <div className="mt-6 flex gap-2">
        <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <SubmitButton busy={busy} disabled={diff === 0} className="flex-[1.6]"><Icon name="scale" size={17} />Ajustar</SubmitButton>
      </div>
    </Sheet>
  );
}

function TemplateForm({ initial, onClose }) {
  const d = useApp();
  const [name, setName] = useState(initial ? initial.name : '');
  const [kind, setKind] = useState(initial ? initial.kind : 'out');
  const [amount, setAmount] = useState(initial ? initial.amount : 0);
  const [cat, setCat] = useState(initial ? initial.category_id || '' : '');
  const [src, setSrc] = useState(initial ? (initial.card_id ? `card:${initial.card_id}` : initial.account_id ? `acc:${initial.account_id}` : '') : '');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleId = cleanId(useId());
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const ok = await d.saveRow('templates', initial, { name: name.trim().slice(0, 40), kind, amount, description: name.trim().slice(0, 60), category_id: cat || null, account_id: src.startsWith('acc:') ? src.slice(4) : null, card_id: src.startsWith('card:') ? src.slice(5) : null }, initial ? 'Modelo atualizado' : 'Modelo criado');
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} onSubmit={submit}>
      <SheetHead id={titleId} title={initial ? 'Editar modelo' : 'Novo modelo'} sub="Aparece como atalho no topo de Nova transação." onClose={onClose} />
      <Segmented full label="Tipo" value={kind} onChange={(v) => { setKind(v); setCat(''); }} options={[{ value: 'out', label: 'Despesa' }, { value: 'in', label: 'Receita' }]} />
      <Field label="Nome" className="mt-4"><input id="tpl-name" className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Almoço, Uber, Café" /></Field>
      <Field label="Valor (opcional)" className="mt-4"><MoneyInput id="tpl-amount" label="Valor" cents={amount} onChange={setAmount} className="font-bold" /></Field>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Categoria"><select id="tpl-cat" className="field" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Escolher na hora</option>{d.categories.filter((c) => c.kind === kind && !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Conta ou cartão"><select id="tpl-src" className="field" value={src} onChange={(e) => setSrc(e.target.value)}><option value="">Escolher na hora</option>{d.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}{kind === 'out' && d.cards.filter((c) => !c.archived).map((c) => <option key={c.id} value={`card:${c.id}`}>{c.name} (crédito)</option>)}</select></Field>
      </div>
      {confirm ? <ConfirmBlock title={`Excluir o modelo “${initial.name}”?`} confirmLabel="Excluir" onConfirm={async () => { if (await d.removeRow('templates', initial, 'Modelo excluído')) onClose(); }} onCancel={() => setConfirm(false)} /> : (
        <div className="mt-6 flex gap-2">
          {initial && <button type="button" className="icon-btn size-11 shrink-0" aria-label="Excluir modelo" onClick={() => setConfirm(true)}><Icon name="trash" size={17} /></button>}
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          <SubmitButton busy={busy} className="flex-[1.6]"><Icon name="check" size={17} strokeWidth={2.4} />Salvar</SubmitButton>
        </div>
      )}
    </Sheet>
  );
}

function DebtForm({ initial, onClose }) {
  const d = useApp();
  const [direction, setDirection] = useState(initial ? initial.direction : 'owe');
  const [name, setName] = useState(initial ? initial.name : '');
  const [person, setPerson] = useState(initial ? initial.person : '');
  const [total, setTotal] = useState(initial ? initial.total : 0);
  const [paid, setPaid] = useState(initial ? initial.paid : 0);
  const [n, setN] = useState(initial && initial.installments ? String(initial.installments) : '');
  const [inst, setInst] = useState(initial ? initial.installment_amount || 0 : 0);
  const [rate, setRate] = useState(initial ? String(initial.interest || '').replace('.', ',') : '');
  const [dueDay, setDueDay] = useState(initial && initial.due_day ? String(initial.due_day) : '');
  const [acc, setAcc] = useState(initial && initial.account_id ? initial.account_id : (d.accounts.find((a) => !a.archived) || {}).id || '');
  const [notes, setNotes] = useState(initial && initial.notes ? initial.notes : '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const titleId = cleanId(useId());
  useEffect(() => { if (Number(n) > 0 && total > 0 && !inst) setInst(Math.ceil(total / Number(n))); }, [n]);
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Dê um nome, ex.: "Empréstimo do banco".'); return; }
    if (total <= 0) { setErr('Informe o valor total.'); return; }
    setBusy(true);
    const ok = await d.saveRow('debts', initial, {
      direction, name: name.trim().slice(0, 60), person: person.trim().slice(0, 60), total, paid: Math.min(paid, total),
      installments: Number(n) > 0 ? Number(n) : null, installment_amount: inst > 0 ? inst : null, interest: parseFloat(String(rate).replace(',', '.')) || 0,
      due_day: Number(dueDay) || null, account_id: acc || null, notes: notes.trim() || null, closed: paid >= total,
      ...(initial ? {} : { start_date: todayISO() }),
    }, initial ? 'Dívida atualizada' : direction === 'owe' ? 'Dívida cadastrada' : 'Valor a receber cadastrado');
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} onSubmit={submit} wide>
      <SheetHead id={titleId} title={initial ? 'Editar dívida' : 'Nova dívida ou empréstimo'} onClose={onClose} />
      <Segmented full label="Tipo" value={direction} onChange={setDirection} options={[{ value: 'owe', label: 'Eu devo' }, { value: 'owed', label: 'Me devem' }]} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Nome"><input id="debt-name" className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={direction === 'owe' ? 'Ex.: Empréstimo, Financiamento' : 'Ex.: Empréstimo para o João'} /></Field>
        <Field label={direction === 'owe' ? 'Com quem (banco ou pessoa)' : 'Quem deve'}><input id="debt-person" className="field" value={person} maxLength={60} onChange={(e) => setPerson(e.target.value)} placeholder="Opcional" /></Field>
        <Field label="Valor total"><MoneyInput id="debt-total" label="Valor total" cents={total} onChange={setTotal} className="font-bold" /></Field>
        <Field label="Já pago"><MoneyInput id="debt-paid" label="Já pago" cents={paid} onChange={setPaid} /></Field>
        <Field label="Parcelas (opcional)"><input id="debt-n" inputMode="numeric" className="field" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="Ex.: 24" /></Field>
        <Field label="Valor da parcela"><MoneyInput id="debt-inst" label="Valor da parcela" cents={inst} onChange={setInst} /></Field>
        <Field label="Juros ao mês (%)"><input id="debt-rate" inputMode="decimal" className="field" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Ex.: 1,99" /></Field>
        <Field label="Vence todo dia"><select id="debt-due" className="field" value={dueDay} onChange={(e) => setDueDay(e.target.value)}><option value="">Sem dia fixo</option>{Array.from({ length: 31 }, (_, i) => i + 1).map((x) => <option key={x} value={x}>Dia {x}</option>)}</select></Field>
        <Field label={direction === 'owe' ? 'Paga com a conta' : 'Recebe na conta'}><select id="debt-acc" className="field" value={acc} onChange={(e) => setAcc(e.target.value)}>{d.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Observações"><input id="debt-notes" className="field" value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" /></Field>
      </div>
      <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>
      {confirm ? <ConfirmBlock title={`Excluir “${initial.name}”?`} text="Os pagamentos já lançados continuam nas transações." confirmLabel="Excluir" onConfirm={async () => { if (await d.removeRow('debts', initial, 'Dívida excluída')) onClose(); }} onCancel={() => setConfirm(false)} /> : (
        <div className="mt-6 flex gap-2">
          {initial && <button type="button" className="icon-btn size-11 shrink-0" aria-label="Excluir dívida" onClick={() => setConfirm(true)}><Icon name="trash" size={17} /></button>}
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          <SubmitButton busy={busy} className="flex-[1.6]"><Icon name="check" size={17} strokeWidth={2.4} />Salvar</SubmitButton>
        </div>
      )}
    </Sheet>
  );
}

function DebtPaySheet({ debt, onClose }) {
  const d = useApp();
  const left = Math.max(0, debt.total - debt.paid);
  const [amount, setAmount] = useState(Math.min(left, debt.installment_amount || left));
  const [acc, setAcc] = useState(debt.account_id || (d.accounts.find((a) => !a.archived) || {}).id || '');
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const titleId = cleanId(useId());
  const submit = async (e) => { e.preventDefault(); if (amount <= 0 || !acc) return; setBusy(true); const ok = await d.payDebt(debt, amount, acc, date); setBusy(false); if (ok) onClose(); };
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} onSubmit={submit}>
      <SheetHead id={titleId} title={debt.direction === 'owe' ? `Pagar · ${debt.name}` : `Receber · ${debt.name}`} sub={`Falta ${fmtBRL(left)} de ${fmtBRL(debt.total)}`} onClose={onClose} />
      <Field label="Valor"><MoneyInput id="dp-amount" label="Valor" cents={amount} onChange={setAmount} className="!py-3 text-[26px] font-extrabold" /></Field>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={debt.direction === 'owe' ? 'Sai da conta' : 'Entra na conta'}><select id="dp-acc" className="field" value={acc} onChange={(e) => setAcc(e.target.value)}>{d.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <DateField id="dp-date" value={date} onChange={setDate} />
      </div>
      <div className="mt-6 flex gap-2">
        <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <SubmitButton busy={busy} className="flex-[1.6]"><Icon name="check" size={17} strokeWidth={2.4} />Registrar</SubmitButton>
      </div>
    </Sheet>
  );
}

function GoalSaveSheet({ goal, onClose }) {
  const d = useApp();
  const [amount, setAmount] = useState(goal.monthly_amount || 0);
  const [from, setFrom] = useState((d.accounts.find((a) => !a.archived && a.id !== goal.account_id) || {}).id || '');
  const [busy, setBusy] = useState(false);
  const titleId = cleanId(useId());
  const goalAcc = d.accounts.find((a) => a.id === goal.account_id);
  const submit = async (e) => { e.preventDefault(); if (amount <= 0) return; setBusy(true); const ok = await d.contributeGoal(goal, amount, goalAcc ? from : null); setBusy(false); if (ok) onClose(); };
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} onSubmit={submit}>
      <SheetHead id={titleId} title={`Guardar · ${goal.name}`} sub={`${fmtBRL(goal.saved)} de ${fmtBRL(goal.target)}`} onClose={onClose} />
      <Field label="Valor"><MoneyInput id="gs-amount" label="Valor" cents={amount} onChange={setAmount} className="!py-3 text-[26px] font-extrabold" /></Field>
      {goalAcc && (
        <Field label={`Transferir para ${goalAcc.name} a partir de`} className="mt-4">
          <select id="gs-from" className="field" value={from} onChange={(e) => setFrom(e.target.value)}><option value="">Não transferir (só anotar)</option>{d.accounts.filter((a) => !a.archived && a.id !== goalAcc.id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </Field>
      )}
      <div className="mt-6 flex gap-2">
        <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <SubmitButton busy={busy} className="flex-[1.6]"><Icon name="piggy" size={17} />Guardar</SubmitButton>
      </div>
    </Sheet>
  );
}

/* ---------- Importar extrato do banco ---------- */
function ImportSheet({ onClose }) {
  const d = useApp();
  const [target, setTarget] = useState(() => { const a = d.accounts.find((x) => !x.archived); return a ? `acc:${a.id}` : ''; });
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const titleId = cleanId(useId());
  const ref = useRef(null);
  const read = async (f) => {
    setErr('');
    try {
      const buf = await f.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buf);
      if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
      const parsed = parseStatement(text, f.name);
      if (!parsed.rows.length) { setErr('Não encontrei lançamentos neste arquivo. Use o extrato em OFX ou CSV exportado pelo banco.'); return; }
      setFileName(f.name);
      setRows(prepareImport(parsed.rows, target, d));
    } catch (x) { setErr('Não foi possível ler o arquivo.'); }
  };
  useEffect(() => { if (rows) setRows((r) => prepareImport(r.map((x) => ({ date: x.date, amount: x.kind === 'in' || x.payment ? x.amount : -x.amount, description: x.description })), target, d)); }, [target]);
  const sel = rows ? rows.filter((r) => r.on && r.kind !== 'skip') : [];
  const doImport = async () => { if (!sel.length) return; setBusy(true); const ok = await d.importRows(sel, target); setBusy(false); if (ok) onClose(); };
  const upd = (key, patch) => setRows((l) => l.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} wide>
      <SheetHead id={titleId} title="Importar extrato" sub="Arquivo OFX ou CSV baixado do app ou site do banco." onClose={onClose} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Lançar em">
          <select id="imp-target" className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
            <optgroup label="Contas">{d.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}</optgroup>
            {d.cards.length > 0 && <optgroup label="Cartões (fatura)">{d.cards.filter((c) => !c.archived).map((c) => <option key={c.id} value={`card:${c.id}`}>{c.name}</option>)}</optgroup>}
          </select>
        </Field>
        <div className="flex items-end"><button type="button" className="btn btn-primary w-full" onClick={() => ref.current && ref.current.click()}><Icon name="upload" size={16} />{fileName ? 'Escolher outro arquivo' : 'Escolher arquivo'}</button></div>
      </div>
      <input ref={ref} type="file" accept=".ofx,.csv,.txt,text/csv,application/x-ofx" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) read(f); e.target.value = ''; }} />
      {!rows && <p className="mt-3 text-xs leading-relaxed text-ink/65">Como baixar: no app do banco, procure "Extrato" › "Exportar" ou "Compartilhar" e escolha <b>OFX</b> (melhor) ou <b>CSV</b>. A fatura do cartão em CSV (ex.: Nubank) também funciona. Nada é enviado para outro lugar: o arquivo é lido no seu aparelho.</p>}
      <div className="mt-3"><ErrorNote>{err}</ErrorNote></div>
      {rows && (
        <>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-ink/70">{fileName} · {rows.length} linhas · <b className="text-ink">{sel.length} selecionadas</b>{rows.some((r) => r.dup) ? ` · ${rows.filter((r) => r.dup).length} parecem já existir` : ''}</span>
            <span className="flex gap-3"><button type="button" className="font-bold text-in" onClick={() => setRows((l) => l.map((r) => ({ ...r, on: r.kind !== 'skip' })))}>Marcar todas</button><button type="button" className="font-bold text-ink/60" onClick={() => setRows((l) => l.map((r) => ({ ...r, on: false })))}>Nenhuma</button></span>
          </div>
          <ul className="mt-2 max-h-[46vh] divide-y divide-ink/[0.07] overflow-y-auto rounded-2xl border border-ink/[0.08] px-2">
            {rows.map((r) => (
              <li key={r.key} className={`flex items-center gap-2.5 py-2 ${r.on ? '' : 'opacity-55'}`}>
                <input type="checkbox" aria-label={`Importar ${r.description}`} checked={r.on} disabled={r.kind === 'skip'} onChange={(e) => upd(r.key, { on: e.target.checked })} className="size-5 shrink-0 accent-[var(--color-vivo)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{r.description}{r.dup && <span className="ml-1.5 pill pill-neutral !px-1.5 !py-0 !text-[10px]">já existe?</span>}{r.payment && <span className="ml-1.5 pill pill-neutral !px-1.5 !py-0 !text-[10px]">pagamento da fatura</span>}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[11px] tabular-nums text-ink/60">{fmtDate(r.date)}</span>
                    {r.kind !== 'skip' && (
                      <select aria-label="Categoria" className="min-w-0 max-w-[170px] truncate rounded-lg border border-ink/10 bg-transparent px-1.5 py-0.5 text-[11.5px]" value={r.category_id || ''} onChange={(e) => upd(r.key, { category_id: e.target.value || null })}>
                        <option value="">Sem categoria</option>
                        {d.categories.filter((c) => c.kind === r.kind && !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 text-[13px] font-extrabold tabular-nums ${r.kind === 'in' ? 'text-in' : 'text-out'}`}>{r.kind === 'in' ? '+' : '−'}{fmtBRL(r.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-6 flex gap-2">
        <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary flex-[1.6]" disabled={!sel.length || busy} onClick={doImport}>{busy ? <Spinner size={14} /> : <Icon name="download" size={16} />}Importar {sel.length || ''}</button>
      </div>
    </Sheet>
  );
}

/* ---------- Restaurar cópia (backup) ---------- */
function RestoreSheet({ onClose }) {
  const d = useApp();
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('merge');
  const [typed, setTyped] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const titleId = cleanId(useId());
  const ref = useRef(null);
  const read = async (f) => {
    setErr(''); setData(null);
    try { const j = JSON.parse(await f.text()); if (j.app !== 'Leco') throw new Error(); setFile(f); setData(j); } catch (x) { setErr('Este arquivo não é uma cópia do Leco (arquivo .json gerado em "Cópia completa").'); }
  };
  const go = async () => {
    setBusy(true); setErr('');
    try { const c = await d.restore(data, mode); setDone(c); haptic('success'); } catch (x) { setErr(x.message || 'Não foi possível restaurar.'); }
    setBusy(false);
  };
  const n = (k) => (data && data[k] ? data[k].length : 0);
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId}>
      <SheetHead id={titleId} title="Restaurar cópia" sub="Use o arquivo .json gerado em Seus dados › Cópia completa." onClose={onClose} />
      {done ? (
        <div className="rounded-2xl bg-vivo/10 p-4 text-[13.5px]">
          <p className="font-bold text-in">Cópia restaurada!</p>
          <p className="mt-1 text-ink/75">{done.transactions || 0} transações, {done.accounts || 0} contas, {done.cards || 0} cartões, {done.categories || 0} categorias, {done.goals || 0} metas.</p>
          <button type="button" className="btn btn-primary mt-4 w-full" onClick={onClose}>Pronto</button>
        </div>
      ) : (
        <>
          <button type="button" className="btn btn-ghost w-full" onClick={() => ref.current && ref.current.click()}><Icon name="upload" size={16} />{file ? file.name : 'Escolher arquivo .json'}</button>
          <input ref={ref} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) read(f); e.target.value = ''; }} />
          {data && (
            <>
              <p className="mt-3 rounded-2xl bg-ink/[0.04] px-4 py-3 text-[13px] text-ink/80">Cópia de {data.exportado_em ? fmtDate(data.exportado_em.slice(0, 10)) : 'data desconhecida'}: <b>{n('transacoes')} transações</b>, {n('contas')} contas, {n('cartoes')} cartões, {n('categorias')} categorias, {n('metas')} metas.</p>
              <div className="mt-4"><Segmented full label="Como restaurar" value={mode} onChange={setMode} options={[{ value: 'merge', label: 'Juntar com o atual' }, { value: 'replace', label: 'Substituir tudo' }]} /></div>
              <p className="mt-2 text-xs text-ink/65">{mode === 'merge' ? 'Os dados da cópia são adicionados aos que já estão no app.' : 'Apaga todos os dados atuais e deixa o app igual à cópia.'}</p>
              {mode === 'replace' && <Field label="Digite SUBSTITUIR para confirmar" className="mt-3"><input id="rs-typed" className="field" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></Field>}
            </>
          )}
          <div className="mt-3"><ErrorNote>{err}</ErrorNote></div>
          <div className="mt-5 flex gap-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
            <button type="button" className={`btn flex-[1.6] ${mode === 'replace' ? 'btn-danger' : 'btn-primary'}`} disabled={!data || busy || (mode === 'replace' && typed.trim().toUpperCase() !== 'SUBSTITUIR')} onClick={go}>{busy ? <Spinner size={14} /> : <Icon name="refresh" size={16} />}Restaurar</button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/* ---------- Busca global ---------- */
const SEARCH_PAGES = [
  ['inicio', 'Início', 'home'], ['transacoes', 'Extrato / Transações', 'list'], ['calendario', 'Calendário', 'calendar'], ['relatorios', 'Análises e relatórios', 'pie'],
  ['planejamento', 'Planejamento', 'target'], ['dividas', 'Dívidas e empréstimos', 'scale'], ['contas', 'Contas e cartões', 'card'], ['recorrentes', 'Recorrentes e assinaturas', 'repeat'],
  ['metas', 'Metas', 'piggy'], ['categorias', 'Categorias', 'grid'], ['modelos', 'Modelos de lançamento', 'star'], ['conquistas', 'Conquistas', 'trophy'],
];
function SearchSheet({ onClose }) {
  const d = useApp();
  const m = useMoneyText();
  const [q, setQ] = useState('');
  const titleId = cleanId(useId());
  const n = normTxt(q);
  const money = parseMoneyBR(q);
  const res = useMemo(() => {
    if (!n) return null;
    const hit = (s) => normTxt(s).includes(n);
    const tx = d.transactions.filter((t) => { const meta = txMeta(t, d); return hit(meta.title) || hit(meta.sub) || hit(t.notes) || (t.tags || []).some((g) => hit(g)) || (Number.isFinite(money) && Math.abs(money) === t.amount); }).slice(0, 30);
    return {
      pages: [...SEARCH_PAGES.filter(([, l]) => hit(l)).map(([id, l, ic]) => ({ id, l, ic, fn: () => d.go(id) })), ...SETTINGS_TABS.filter((s) => hit(s.label) || hit(s.desc)).map((s) => ({ id: s.id, l: `Configurações › ${s.label}`, ic: s.icon, fn: () => { d.setSettingsSub(s.id); d.go('config'); } }))],
      cats: d.categories.filter((c) => hit(c.name)).slice(0, 6),
      accs: [...d.accounts.filter((a) => hit(a.name)), ...d.cards.filter((c) => hit(c.name))].slice(0, 6),
      goals: d.goals.filter((g) => hit(g.name)).slice(0, 4),
      recs: d.recurrings.filter((r) => hit(r.description)).slice(0, 5),
      debts: (d.debts || []).filter((x) => hit(x.name) || hit(x.person)).slice(0, 4),
      tx,
    };
  }, [n, d.transactions]);
  const open = (fn) => { onClose(); setTimeout(fn, 230); };
  const count = res ? res.pages.length + res.cats.length + res.accs.length + res.goals.length + res.recs.length + res.debts.length + res.tx.length : 0;
  const Row = ({ ic, color, title, sub, right, fn }) => (
    <li><button type="button" onClick={() => open(fn)} className="flex w-full items-center gap-3 rounded-2xl px-1.5 py-2 text-left hover:bg-ink/[0.04]">
      <ColorIcon icon={ic} color={color || '#6B9E8F'} size={34} />
      <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold">{title}</span>{sub && <span className="block truncate text-xs text-ink/60">{sub}</span>}</span>
      {right}
    </button></li>
  );
  const Sec = ({ title, children }) => <div className="mt-3"><p className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-ink/55">{title}</p><ul className="mt-1">{children}</ul></div>;
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId} wide>
      <h2 id={titleId} className="sr-only">Buscar</h2>
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/55" />
        <input id="search-q" autoFocus className="field !rounded-full !py-3 !pl-11 text-[15px]" placeholder="Buscar lançamentos, contas, categorias, telas…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </div>
      {!res && <p className="mt-4 px-1 text-xs text-ink/60">Dica: busque por descrição, categoria, #etiqueta, conta, valor (ex.: 45,90) ou nome de uma tela.</p>}
      {res && count === 0 && <div className="mt-4"><EmptyState icon="search" title="Nada encontrado" text={`Nenhum resultado para "${q}".`} action={<button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => setQ('')}><Icon name="x" size={14} />Limpar busca</button>} /></div>}
      {res && (
        <div className="max-h-[60vh] overflow-y-auto">
          {res.pages.length > 0 && <Sec title="Telas">{res.pages.map((p) => <Row key={p.id + p.l} ic={p.ic} title={p.l} fn={p.fn} />)}</Sec>}
          {res.accs.length > 0 && <Sec title="Contas e cartões">{res.accs.map((a) => <Row key={a.id} ic={a.icon || (a.kind ? ACCOUNT_KINDS[a.kind].icon : 'card')} color={a.color} title={a.name} sub={a.kind ? `Saldo ${m(d.balances[a.id] || 0)}` : 'Cartão de crédito'} fn={() => d.go('contas')} />)}</Sec>}
          {res.cats.length > 0 && <Sec title="Categorias">{res.cats.map((c) => <Row key={c.id} ic={c.icon} color={c.color} title={c.name} sub={c.kind === 'in' ? 'Receita' : 'Despesa'} fn={() => d.openModal({ kind: 'category', initial: c })} />)}</Sec>}
          {res.recs.length > 0 && <Sec title="Recorrentes">{res.recs.map((r) => <Row key={r.id} ic="repeat" title={r.description} sub={`${FREQ[r.frequency]} · próximo ${fmtDate(r.next_date)}`} right={<span className="text-[13px] font-bold tabular-nums">{m(r.amount)}</span>} fn={() => d.openModal({ kind: 'recurring', initial: r })} />)}</Sec>}
          {res.goals.length > 0 && <Sec title="Metas">{res.goals.map((g) => <Row key={g.id} ic={g.icon} color="#14806B" title={g.name} sub={`${m(g.saved)} de ${m(g.target)}`} fn={() => d.go('metas')} />)}</Sec>}
          {res.debts.length > 0 && <Sec title="Dívidas">{res.debts.map((x) => <Row key={x.id} ic="scale" title={x.name} sub={x.person} fn={() => d.go('dividas')} />)}</Sec>}
          {res.tx.length > 0 && <Sec title={`Lançamentos (${res.tx.length}${res.tx.length === 30 ? '+' : ''})`}>{res.tx.map((t) => { const meta = txMeta(t, d); return <Row key={t.id} ic={meta.icon} color={meta.color} title={meta.title} sub={`${meta.sub} · ${fmtDate(t.date)}`} right={<span className={`text-[13px] font-extrabold tabular-nums ${meta.tone}`}>{meta.sign}{m(t.amount)}</span>} fn={() => d.openModal({ kind: 'tx', initial: t })} />; })}</Sec>}
        </div>
      )}
    </Sheet>
  );
}

/* ---------- Resumo automático do mês que terminou ---------- */
function MonthSummarySheet({ month, onClose }) {
  const d = useApp();
  const titleId = cleanId(useId());
  const s = periodSummary(d.transactions, ...finRange(month), d.categories);
  const p = periodSummary(d.transactions, ...finRange(shiftMonth(month, -1)), d.categories);
  const diff = p.expense ? Math.round(((s.expense - p.expense) / p.expense) * 100) : null;
  const top = s.byCatOut.slice(0, 3);
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId}>
      <SheetHead id={titleId} title={`Seu resumo de ${monthName(month).toLowerCase()}`} sub="O mês fechou. Veja como foi." onClose={onClose} />
      <div className="glass-hero rounded-3xl p-5">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-ink/75">{s.net >= 0 ? 'Sobrou' : 'Faltou'}</p>
        <p className="mt-1 text-[30px] font-extrabold tracking-[-0.02em]">{fmtBRL(Math.abs(s.net))}</p>
        <p className="mt-1 text-[13px] text-ink/80">{s.income ? `${fmtPctAbs(s.rate)} da renda ${s.net >= 0 ? 'guardada' : 'acima'} · meta ${d.profile.savings_goal}%` : 'Sem receitas registradas no mês.'}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-vivo/10 px-3 py-2.5"><p className="text-[10.5px] font-bold uppercase tracking-wider text-in">Receitas</p><p className="text-[16px] font-extrabold tabular-nums text-in">{fmtBRL(s.income)}</p></div>
        <div className="rounded-2xl bg-coral/10 px-3 py-2.5"><p className="text-[10.5px] font-bold uppercase tracking-wider text-out">Despesas</p><p className="text-[16px] font-extrabold tabular-nums text-out">{fmtBRL(s.expense)}</p></div>
      </div>
      {diff != null && <p className="mt-3 text-[13px] text-ink/80">Você gastou <b className={diff > 0 ? 'text-out' : 'text-in'}>{Math.abs(diff)}% {diff > 0 ? 'a mais' : 'a menos'}</b> que em {monthName(shiftMonth(month, -1)).toLowerCase()}.</p>}
      {top.length > 0 && <div className="mt-3"><p className="lbl">Onde mais gastou</p><ul className="mt-2 space-y-1.5">{top.map((c) => <li key={c.key} className="flex items-center gap-2.5 text-[13px]"><ColorIcon icon={c.icon} color={c.color} size={30} /><span className="flex-1 font-semibold">{c.label}</span><b className="tabular-nums">{fmtBRL(c.value)}</b></li>)}</ul></div>}
      <div className="mt-6 flex gap-2">
        <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Fechar</button>
        <button type="button" className="btn btn-primary flex-[1.6]" onClick={() => { onClose(); setTimeout(() => d.go('relatorios'), 230); }}><Icon name="pie" size={16} />Ver análises</button>
      </div>
    </Sheet>
  );
}

// Lançamentos de uma categoria num período (aberto ao tocar no gráfico)
function CatTxSheet({ catKey, label, color, from, to, txKind = 'out', onClose }) {
  const d = useApp();
  const m = useMoneyText();
  const titleId = cleanId(useId());
  const ids = new Set([catKey, ...d.categories.filter((c) => c.parent_id === catKey).map((c) => c.id)]);
  const list = d.transactions.filter((t) => t.date >= from && t.date <= to && (txKind === 'in' ? countsAsIncome(t) : countsAsExpense(t)) && (catKey === 'none' ? !t.category_id : ids.has(t.category_id)));
  const total = sum(list, (t) => t.amount);
  const top = list.slice().sort((a, b) => b.amount - a.amount)[0];
  const days = Math.max(1, diffDays(to < todayISO() ? to : todayISO(), from) + 1);
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId}>
      <SheetHead id={titleId} title={label} sub={`${fmtDate(from)} a ${fmtDate(to)}`} onClose={onClose} />
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-ink/[0.04] px-3 py-2.5"><p className="text-[10.5px] font-semibold uppercase tracking-wider text-ink/60">Total</p><p className="truncate text-[15px] font-extrabold tabular-nums" style={{ color }}>{m(total)}</p></div>
        <div className="rounded-2xl bg-ink/[0.04] px-3 py-2.5"><p className="text-[10.5px] font-semibold uppercase tracking-wider text-ink/60">Lançamentos</p><p className="text-[15px] font-extrabold tabular-nums">{list.length}</p></div>
        <div className="rounded-2xl bg-ink/[0.04] px-3 py-2.5"><p className="text-[10.5px] font-semibold uppercase tracking-wider text-ink/60">Por dia</p><p className="truncate text-[15px] font-extrabold tabular-nums">{m(Math.round(total / days))}</p></div>
      </div>
      {top && <p className="mt-3 text-xs text-ink/65">Maior: <b className="text-ink">{txMeta(top, d).title}</b> · {m(top.amount)} em {fmtDate(top.date)}</p>}
      <ul className="mt-3 max-h-[52vh] divide-y divide-ink/[0.07] overflow-y-auto">
        {list.map((t) => <TxItem key={t.id} t={t} dense onOpen={(x) => { onClose(); setTimeout(() => d.openModal({ kind: 'tx', initial: x }), 240); }} />)}
        {!list.length && <li className="py-6 text-center text-sm text-ink/60">Nenhum lançamento.</li>}
      </ul>
    </Sheet>
  );
}
