/* =====================================================================
   69-clean-pages: telas do visual Clean com cara de sistema financeiro.
   Tabelas no computador, linhas compactas no celular, cartões de resumo
   e ações à direita. Usam as mesmas ações e dados do resto do app.
   ===================================================================== */

/* ---------- Peças comuns ---------- */
function ClSection({ title, sub, action, children, flush = false, id }) {
  return (
    <section id={id} className={`cl-card min-w-0 ${flush ? 'overflow-hidden' : ''}`}>
      {(title || action) && (
        <div className={`flex flex-wrap items-center justify-between gap-3 ${flush ? 'px-5 py-4' : 'px-5 pt-4'}`}>
          <div className="min-w-0">
            {title && <h2 className="text-[15.5px] font-semibold">{title}</h2>}
            {sub && <p className="mt-0.5 text-[13px] text-ink/50">{sub}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

function ClStats({ items }) {
  const narrow = useNarrow();
  return (
    <div className={`grid ${narrow ? 'grid-cols-2 gap-3' : `gap-4 ${items.length >= 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-3'}`}`}>
      {items.filter(Boolean).map((it) => (
        <div key={it.label} className={`cl-card min-w-0 ${narrow ? 'p-3.5' : 'p-5'}`}>
          <p className="truncate text-[13px] text-ink/55">{it.label}</p>
          <p className={`cl-num truncate font-semibold tracking-[-0.02em] ${narrow ? 'mt-1.5 text-[17px]' : 'mt-2 text-[24px]'} ${it.tone || ''}`}>{it.value}</p>
          {it.note && <p className={`mt-1 truncate text-ink/50 ${narrow ? 'text-[11px]' : 'text-[12.5px]'}`}>{it.note}</p>}
        </div>
      ))}
    </div>
  );
}

function ClPage({ actions, children }) {
  return (
    <div className="space-y-5">
      {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      {children}
    </div>
  );
}

const clAmount = (t, m) => `${t.kind === 'in' ? '+' : t.kind === 'out' ? '−' : ''}${m(t.amount)}`;
const clStatus = (t, today = todayISO()) => (t.kind === 'transfer' || t.kind === 'card_payment' ? { l: t.kind === 'transfer' ? 'Transferência' : 'Pagamento', c: 'cl-pill-wait' }
  : t.paid ? { l: t.kind === 'in' ? 'Recebido' : 'Pago', c: 'cl-pill-ok' } : t.date < today ? { l: 'Atrasado', c: 'cl-pill-bad' } : { l: t.kind === 'in' ? 'A receber' : 'A pagar', c: 'cl-pill-wait' });

function ClCatCell({ icon, color, title, sub }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="cl-dot grid size-8 shrink-0 place-items-center rounded-lg" style={{ color, background: `${color || '#888888'}14` }}><Icon name={icon} size={15} /></span>
      <span className="min-w-0"><span className="block truncate font-medium">{title}</span>{sub && <span className="block truncate text-[12px] text-ink/50">{sub}</span>}</span>
    </span>
  );
}

/* ---------- Transações ---------- */
function CleanTransactions() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const pre = d.txPreset || {};
  const today = todayISO();
  const [scope, setScope] = useState(pre.scope || 'month');
  const [type, setType] = useState(pre.type || 'all');
  const [src, setSrc] = useState('all');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState(pre.status || 'all');
  const [tag, setTag] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [limit, setLimit] = useState(50);
  const [showFilters, setShowFilters] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const allTags = useMemo(() => [...new Set(d.transactions.flatMap((t) => t.tags || []))].sort(), [d.transactions]);
  useEffect(() => setLimit(50), [scope, type, src, cat, status, q, d.month, sort, tag]);
  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = d.transactions.filter((t) => {
      if (scope === 'month' && finMonthOf(t.date) !== d.month) return false;
      if (type !== 'all' && t.kind !== type) return false;
      if (src !== 'all') { const [k, id] = src.split(':'); if (k === 'acc' && t.account_id !== id && t.to_account_id !== id) return false; if (k === 'card' && t.card_id !== id) return false; }
      if (cat !== 'all' && t.category_id !== cat && (d.categories.find((c) => c.id === t.category_id) || {}).parent_id !== cat) return false;
      if (tag !== 'all' && !(t.tags || []).includes(tag)) return false;
      if (status === 'paid' && !t.paid) return false;
      if (status === 'pending' && t.paid) return false;
      if (qq) { const meta = txMeta(t, d); if (!`${meta.title} ${meta.sub} ${t.notes || ''} ${(t.tags || []).join(' ')}`.toLowerCase().includes(qq)) return false; }
      return true;
    });
    const by = { recent: (a, b) => (a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : a.date < b.date ? 1 : -1), old: (a, b) => (a.date < b.date ? -1 : 1), high: (a, b) => b.amount - a.amount, low: (a, b) => a.amount - b.amount };
    return list.sort(by[sort]);
  }, [d.transactions, d.categories, scope, d.month, type, src, cat, status, q, sort, tag]);
  const inc = sum(rows.filter(countsAsIncome), (t) => t.amount);
  const exp = sum(rows.filter(countsAsExpense), (t) => t.amount);
  const pending = rows.filter((t) => !t.paid && (t.kind === 'in' || t.kind === 'out'));
  const filtered = type !== 'all' || src !== 'all' || cat !== 'all' || status !== 'all' || tag !== 'all' || q;
  const clear = () => { setType('all'); setSrc('all'); setCat('all'); setStatus('all'); setTag('all'); setQ(''); };
  const exportPdf = async () => {
    setPdfBusy(true);
    const parts = [scope === 'month' ? monthLabel(d.month) : 'Todo o período'];
    if (type !== 'all') parts.push({ in: 'receitas', out: 'despesas', transfer: 'transferências', card_payment: 'pagamentos de fatura' }[type]);
    if (status !== 'all') parts.push(status === 'paid' ? 'só pagas' : 'só pendentes');
    if (q.trim()) parts.push(`busca "${q.trim()}"`);
    await d.exportPDF(`leco-extrato-${scope === 'month' ? d.month : 'completo'}.pdf`, () => transactionsPDF(rows, d, parts.join(' · ')));
    setPdfBusy(false);
  };
  const cats = d.categories.filter((c) => !c.parent_id && (type === 'all' || type === c.kind));
  const selects = (
    <>
      <select aria-label="Conta ou cartão" className="field !w-auto !py-2 text-[13.5px]" value={src} onChange={(e) => setSrc(e.target.value)}>
        <option value="all">Todas as contas</option>
        {d.accounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}
        {d.cards.map((c) => <option key={c.id} value={`card:${c.id}`}>{c.name} (cartão)</option>)}
      </select>
      <select aria-label="Categoria" className="field !w-auto !py-2 text-[13.5px]" value={cat} onChange={(e) => setCat(e.target.value)}>
        <option value="all">Todas as categorias</option>
        {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select aria-label="Situação" className="field !w-auto !py-2 text-[13.5px]" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="all">Pagas e pendentes</option><option value="paid">Só pagas</option><option value="pending">Só pendentes</option>
      </select>
      {allTags.length > 0 && (
        <select aria-label="Etiqueta" className="field !w-auto !py-2 text-[13.5px]" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="all">Todas as etiquetas</option>{allTags.map((x) => <option key={x} value={x}>#{x}</option>)}
        </select>
      )}
      <select aria-label="Ordenar" className="field !w-auto !py-2 text-[13.5px]" value={sort} onChange={(e) => setSort(e.target.value)}>
        <option value="recent">Mais recentes</option><option value="old">Mais antigas</option><option value="high">Maior valor</option><option value="low">Menor valor</option>
      </select>
    </>
  );
  const shown = rows.slice(0, limit);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {scope === 'month' ? <MonthSwitch month={d.month} onChange={d.setMonth} /> : <span className="cl-pill cl-pill-wait !py-1.5">Todo o período</span>}
        <button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => setScope(scope === 'month' ? 'all' : 'month')}>{scope === 'month' ? 'Ver todo o período' : 'Só este mês'}</button>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={exportPdf} disabled={pdfBusy || !rows.length}>{pdfBusy ? <Spinner size={14} /> : <Icon name="download" size={15} />}PDF</button>
        </div>
      </div>
      <ClStats items={[
        { label: 'Entradas', value: m(inc), tone: 'text-in' },
        { label: 'Saídas', value: m(exp) },
        { label: 'Resultado', value: m(inc - exp), tone: inc - exp < 0 ? 'text-out' : '' },
        { label: 'Pendentes', value: String(pending.length), note: pending.length ? m(sum(pending, (t) => t.amount)) : 'nada em aberto' },
      ]} />
      <section className="cl-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <Segmented size="sm" label="Tipo" value={type} onChange={setType} options={[{ value: 'all', label: 'Todas' }, { value: 'in', label: 'Receitas' }, { value: 'out', label: 'Despesas' }, { value: 'transfer', label: narrow ? 'Transf.' : 'Transferências' }]} />
          <div className={`relative ${narrow ? 'w-full' : 'min-w-[220px] flex-1'}`}>
            <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/45" />
            <input id="cl-q" className="field !py-2 !pl-9 text-[13.5px]" placeholder="Buscar descrição, categoria, #etiqueta…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {narrow
            ? <button type="button" className="btn btn-ghost !py-2 text-[13px]" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}><Icon name="filter" size={15} />Filtros{filtered && !q ? ' •' : ''}</button>
            : selects}
          {filtered && <button type="button" className="text-[13px] font-semibold text-ink/55 hover:text-ink" onClick={clear}>Limpar</button>}
        </div>
        {narrow && showFilters && <div className="grid grid-cols-2 gap-2 px-4 pb-3 [&>select]:!w-full">{selects}</div>}
        {rows.length === 0 ? (
          <div className="border-t border-ink/[0.07] p-5"><EmptyState icon="search" title={filtered ? 'Nada encontrado' : 'Nenhuma transação neste período'} text={filtered ? 'Mude os filtros ou limpe a busca.' : 'Use o botão + para registrar uma receita, despesa ou transferência.'} action={filtered ? <button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={clear}><Icon name="x" size={14} />Limpar filtros</button> : null} /></div>
        ) : narrow ? (
          <ul className="divide-y divide-ink/[0.07] border-t border-ink/[0.07] px-2">{shown.map((t) => <TxItem key={t.id} t={t} onOpen={(x) => d.openModal({ kind: 'tx', initial: x })} onConfirm={d.confirmTx} />)}</ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="cl-table w-full min-w-[860px] text-left text-[14px]">
              <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta / cartão</th><th>Situação</th><th className="text-right">Valor</th><th className="w-[88px]"><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {shown.map((t) => {
                  const meta = txMeta(t, d);
                  const c = d.categories.find((x) => x.id === t.category_id);
                  const st = clStatus(t, today);
                  return (
                    <tr key={t.id} className="group">
                      <td className="whitespace-nowrap text-ink/60">{fmtDate(t.date)}</td>
                      <td className="max-w-[280px]"><button type="button" className="block max-w-full truncate text-left font-medium hover:underline" onClick={() => d.openModal({ kind: 'tx', initial: t })}>{meta.title}</button>{(t.tags || []).length > 0 && <span className="block truncate text-[12px] text-ink/45">{t.tags.map((x) => `#${x}`).join(' ')}</span>}</td>
                      <td className="max-w-[170px] truncate whitespace-nowrap text-ink/65">{t.kind === 'transfer' ? 'Transferência' : c ? c.name : 'Sem categoria'}</td>
                      <td className="max-w-[190px] truncate whitespace-nowrap text-ink/65">{payMethod(t, d)}</td>
                      <td><span className={`cl-pill ${st.c}`}>{st.l}</span></td>
                      <td className={`cl-num whitespace-nowrap text-right font-medium ${t.kind === 'in' ? 'text-in' : ''}`}>{clAmount(t, m)}</td>
                      <td className="whitespace-nowrap text-right">
                        <span className="inline-flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          {!t.paid && (t.kind === 'in' || t.kind === 'out') && <button type="button" className="cl-iconbtn" aria-label={t.kind === 'in' ? 'Recebi' : 'Paguei'} onClick={() => d.confirmTx(t)}><Icon name="check" size={14} /></button>}
                          {t.kind !== 'card_payment' && <button type="button" className="cl-iconbtn" aria-label="Editar" onClick={() => d.openModal({ kind: 'tx', initial: t })}><Icon name="edit" size={14} /></button>}
                          {t.kind !== 'card_payment' && <button type="button" className="cl-iconbtn hover:!text-[#DC2626]" aria-label="Excluir" onClick={() => d.openModal({ kind: 'deleteTx', t })}><Icon name="trash" size={14} /></button>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-ink/[0.07] px-5 py-3 text-[13px] text-ink/50">
            <span>Mostrando {Math.min(limit, rows.length)} de {rows.length}</span>
            {rows.length > limit && <button type="button" className="btn btn-ghost !py-1.5 text-[13px]" onClick={() => setLimit((n) => n + 50)}>Carregar mais</button>}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- Contas e cartões ---------- */
function CleanAccounts() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const [archived, setArchived] = useState(false);
  const accs = d.accounts.filter((a) => (archived || !a.archived) && !isBenefit(a));
  const bens = d.accounts.filter((a) => (archived || !a.archived) && isBenefit(a));
  const cards = d.cards.filter((c) => archived || !c.archived);
  const total = sum(cashAccounts(d.accounts), (a) => d.balances[a.id] || 0);
  const benTotal = sum(d.accounts.filter((a) => isBenefit(a) && !a.archived), (a) => d.balances[a.id] || 0);
  const sums = d.cards.filter((c) => !c.archived).map((c) => cardSummary(c, d.transactions));
  const avail = sum(sums, (s) => Math.max(0, s.available));
  const due = sum(d.cards.filter((c) => !c.archived), (c) => { const s = cardSummary(c, d.transactions); return Math.max(0, s.current.remaining) + sum(s.toPay.filter((i) => i.invoice !== s.current.invoice), (i) => i.remaining); });
  const archivedCount = d.accounts.filter((a) => a.archived).length + d.cards.filter((c) => c.archived).length;
  const today = todayISO();
  return (
    <ClPage actions={<>
      {archivedCount > 0 && <button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => setArchived((v) => !v)}>{archived ? 'Ocultar arquivadas' : `Mostrar arquivadas (${archivedCount})`}</button>}
      <button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'card' })}><Icon name="plus" size={15} />Cartão</button>
      <button type="button" className="btn btn-primary !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'account' })}><Icon name="plus" size={15} />Nova conta</button>
    </>}>
      <ClStats items={[
        { label: 'Saldo em contas', value: m(total), note: plural(cashAccounts(d.accounts).filter((a) => !a.archived).length, 'conta', 'contas') },
        d.cards.length ? { label: 'Faturas a pagar', value: m(due), note: plural(d.cards.filter((c) => !c.archived).length, 'cartão', 'cartões') } : null,
        d.cards.length ? { label: 'Limite disponível', value: m(avail), note: 'somando os cartões' } : null,
        (bens.length || d.v4) ? { label: 'Vales (VA/VR)', value: m(benTotal), note: 'fora do saldo total' } : null,
      ]} />

      <ClSection title="Contas" sub="Banco, carteira, poupança e investimentos" flush>
        {accs.length === 0 ? <div className="px-5 pb-5"><EmptyState icon="bank" title="Nenhuma conta" text="Cadastre onde o seu dinheiro fica: conta do banco, carteira, poupança." /></div> : narrow ? (
          <ul className="divide-y divide-ink/[0.07] border-t border-ink/[0.07]">
            {accs.map((a) => (
              <li key={a.id} className={`flex items-center gap-3 px-4 py-3 ${a.archived ? 'opacity-55' : ''}`}>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => d.openModal({ kind: 'account', initial: a })}><ClCatCell icon={a.icon || ACCOUNT_KINDS[a.kind].icon} color={a.color} title={a.name} sub={`${accountKindLabel(a)}${a.is_reserve ? ' · reserva' : ''}`} /></button>
                <span className={`cl-num shrink-0 text-[14px] font-medium ${(d.balances[a.id] || 0) < 0 ? 'text-out' : ''}`}>{m(d.balances[a.id] || 0)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <table className="cl-table w-full text-left text-[14px]">
            <thead><tr><th>Conta</th><th>Tipo</th><th>Uso</th><th className="text-right">Saldo</th><th className="w-[200px]"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {accs.map((a) => {
                const n = d.transactions.filter((t) => (t.account_id === a.id || t.to_account_id === a.id) && finMonthOf(t.date) === d.month).length;
                return (
                  <tr key={a.id} className={`group ${a.archived ? 'opacity-55' : ''}`}>
                    <td><ClCatCell icon={a.icon || ACCOUNT_KINDS[a.kind].icon} color={a.color} title={a.name} sub={a.archived ? 'arquivada' : null} /></td>
                    <td className="text-ink/65">{accountKindLabel(a)}{a.is_reserve ? <span className="cl-pill cl-pill-ok ml-2">Reserva</span> : null}</td>
                    <td className="text-ink/55">{plural(n, 'lançamento', 'lançamentos')} no mês</td>
                    <td className={`cl-num text-right font-medium ${(d.balances[a.id] || 0) < 0 ? 'text-out' : ''}`}>{m(d.balances[a.id] || 0)}</td>
                    <td className="text-right">
                      <span className="inline-flex gap-1.5">
                        {!a.archived && <button type="button" className="btn btn-ghost !px-2.5 !py-1 text-[12.5px]" onClick={() => d.openModal({ kind: 'adjust', account: a })}>Ajustar saldo</button>}
                        <button type="button" className="cl-iconbtn" aria-label={`Editar ${a.name}`} onClick={() => d.openModal({ kind: 'account', initial: a })}><Icon name="edit" size={14} /></button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </ClSection>

      <ClSection title="Cartões de crédito" sub="Fatura atual, limite e vencimentos" flush>
        {cards.length === 0 ? <div className="px-5 pb-5"><EmptyState icon="card" title="Nenhum cartão" text="Cadastre seus cartões para acompanhar faturas, parcelas e o limite disponível." action={<button type="button" className="btn btn-primary" onClick={() => d.openModal({ kind: 'card' })}><Icon name="plus" size={16} />Novo cartão</button>} /></div> : (
          <ul className={narrow ? 'divide-y divide-ink/[0.07] border-t border-ink/[0.07]' : 'grid gap-4 border-t border-ink/[0.07] p-5 md:grid-cols-2 2xl:grid-cols-3'}>
            {cards.map((c) => {
              const s = cardSummary(c, d.transactions);
              const usedPct = c.limit_amount ? Math.min(100, Math.round((s.used / c.limit_amount) * 100)) : 0;
              const st = INVOICE_STATUS[s.current.status];
              const pill = s.current.status === 'paga' ? 'cl-pill-ok' : s.current.status === 'vencida' ? 'cl-pill-bad' : 'cl-pill-wait';
              const late = s.toPay.find((i) => i.status === 'vencida');
              return (
                <li key={c.id} className={`${narrow ? 'px-4 py-4' : 'cl-card p-5'} ${c.archived ? 'opacity-55' : ''}`}>
                  <div className="flex items-center gap-3">
                    <ClCatCell icon={c.icon || 'card'} color={c.color} title={c.name} sub={`Fecha dia ${c.closing_day} · vence dia ${c.due_day}`} />
                    <span className={`cl-pill ${pill} ml-auto`}>{st.label}</span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="min-w-0"><p className="text-[12.5px] text-ink/50">Fatura de {invoiceLabel(s.current.invoice)}</p><p className="cl-num truncate text-[22px] font-semibold">{m(s.current.total)}</p></div>
                    <div className="text-right"><p className="text-[12.5px] text-ink/50">Vence</p><p className="text-[14px] font-medium">{fmtDate(invoiceDue(c, s.current.invoice))}</p></div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[12.5px] text-ink/55"><span>Usado <span className="cl-num">{m(s.used)}</span></span><span>Disponível <span className="cl-num font-medium text-ink">{m(s.available)}</span></span></div>
                    <div className="track mt-1.5"><i className={usedPct >= 90 ? 'over' : usedPct >= 70 ? 'warn' : ''} style={{ width: `${usedPct}%` }} /></div>
                  </div>
                  {late && <p className="mt-3 text-[12.5px] font-medium text-out">Fatura de {invoiceLabel(late.invoice)} vencida: {m(late.remaining)} em aberto</p>}
                  <div className="mt-4 flex gap-2">
                    <button type="button" className="btn btn-ghost flex-1 !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'invoice', card: c })}><Icon name="file" size={14} />Faturas</button>
                    <button type="button" className="cl-iconbtn !size-[38px]" aria-label={`Editar ${c.name}`} onClick={() => d.openModal({ kind: 'card', initial: c })}><Icon name="edit" size={15} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ClSection>

      {(d.v4 || bens.length > 0) && (
        <ClSection id="vales" title="Vale-alimentação e refeição" sub="Saldo dos benefícios. Não entra no saldo total." flush action={<button type="button" className="btn btn-ghost !py-1.5 text-[13px]" onClick={() => d.openModal({ kind: 'account', presetKind: 'beneficio' })}><Icon name="plus" size={14} />Novo vale</button>}>
          {bens.length === 0 ? <div className="px-5 pb-5"><EmptyState icon="utensils" title="Nenhum vale cadastrado" text="Cadastre seu VA, VR ou benefício flexível. O crédito do mês cai sozinho." /></div> : narrow ? (
            <ul className="divide-y divide-ink/[0.07] border-t border-ink/[0.07]">
              {bens.map((a) => { const b = a.benefit || {}; const next = b.credit > 0 && b.day ? nextBenefitDate(b.day, today) : null; return (
                <li key={a.id}><button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => d.openModal({ kind: 'account', initial: a })}>
                  <span className="min-w-0 flex-1"><ClCatCell icon={a.icon || (BENEFIT_TYPES[b.type] || BENEFIT_TYPES.va).icon} color={a.color} title={a.name} sub={next ? `Próximo crédito ${fmtDate(next).slice(0, 5)} · ${m(b.credit)}` : accountKindLabel(a)} /></span>
                  <span className="cl-num shrink-0 text-[14px] font-medium">{m(d.balances[a.id] || 0)}</span>
                </button></li>
              ); })}
            </ul>
          ) : (
            <table className="cl-table w-full text-left text-[14px]">
              <thead><tr><th>Vale</th><th>Tipo</th><th>Próximo crédito</th><th>Dá por dia</th><th className="text-right">Saldo</th><th className="w-[60px]"><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {bens.map((a) => {
                  const b = a.benefit || {};
                  const bal = d.balances[a.id] || 0;
                  const next = b.credit > 0 && b.day ? nextBenefitDate(b.day, today) : null;
                  const days = next ? Math.max(1, diffDays(next, today)) : null;
                  return (
                    <tr key={a.id}>
                      <td><ClCatCell icon={a.icon || (BENEFIT_TYPES[b.type] || BENEFIT_TYPES.va).icon} color={a.color} title={a.name} sub={b.provider && b.provider !== 'Outra' ? b.provider : null} /></td>
                      <td className="text-ink/65">{(BENEFIT_TYPES[b.type] || BENEFIT_TYPES.va).label}</td>
                      <td className="text-ink/65">{next ? <>{fmtDate(next)} · <span className="cl-num">{m(b.credit)}</span></> : '—'}</td>
                      <td className="cl-num text-ink/65">{days ? m(Math.max(0, Math.floor(bal / days))) : '—'}</td>
                      <td className={`cl-num text-right font-medium ${bal < 0 ? 'text-out' : ''}`}>{m(bal)}</td>
                      <td className="text-right"><button type="button" className="cl-iconbtn" aria-label={`Editar ${a.name}`} onClick={() => d.openModal({ kind: 'account', initial: a })}><Icon name="edit" size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ClSection>
      )}
    </ClPage>
  );
}

/* ---------- Recorrentes ---------- */
function CleanRecurring() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const perMonth = (r) => (r.frequency === 'weekly' ? Math.round((r.amount * 52) / 12) : r.frequency === 'yearly' ? Math.round(r.amount / 12) : r.amount);
  const list = d.recurrings.slice().sort((a, b) => (a.active === b.active ? (a.next_date < b.next_date ? -1 : 1) : a.active ? -1 : 1));
  const act = d.recurrings.filter((r) => r.active);
  const outM = sum(act.filter((r) => r.kind === 'out'), perMonth);
  const inM = sum(act.filter((r) => r.kind === 'in'), perMonth);
  const next = act.filter((r) => r.kind === 'out').sort((a, b) => (a.next_date < b.next_date ? -1 : 1))[0];
  const where = (r) => { if (r.card_id) { const c = d.cards.find((x) => x.id === r.card_id); return c ? `${c.name} (cartão)` : 'Cartão'; } const a = d.accounts.find((x) => x.id === r.account_id); return a ? a.name : 'Sem conta'; };
  return (
    <ClPage actions={<button type="button" className="btn btn-primary !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'recurring' })}><Icon name="plus" size={15} />Nova recorrência</button>}>
      <ClStats items={[
        { label: 'Despesas fixas / mês', value: m(outM), note: plural(act.filter((r) => r.kind === 'out').length, 'ativa', 'ativas') },
        { label: 'Receitas fixas / mês', value: m(inM), tone: 'text-in', note: plural(act.filter((r) => r.kind === 'in').length, 'ativa', 'ativas') },
        { label: 'Sobra após fixos', value: m(inM - outM), tone: inM - outM < 0 ? 'text-out' : '', note: inM ? `${fmtPctAbs(((inM - outM) / inM) * 100)} da renda fixa` : 'cadastre suas receitas fixas' },
        { label: 'Próxima conta', value: next ? fmtDate(next.next_date).slice(0, 5) : '—', note: next ? `${next.description} · ${m(next.amount)}` : 'nenhuma' },
      ]} />
      <ClSection title="Recorrências" sub="O Leco lança sozinho nas datas e avisa antes de vencer" flush>
        {list.length === 0 ? <div className="px-5 pb-5"><EmptyState icon="repeat" title="Nenhuma recorrência" text="Cadastre salário, aluguel, assinaturas e contas de consumo." /></div> : narrow ? (
          <ul className="divide-y divide-ink/[0.07] border-t border-ink/[0.07]">
            {list.map((r) => { const cat = d.categories.find((c) => c.id === r.category_id); return (
              <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${r.active ? '' : 'opacity-55'}`}>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => d.openModal({ kind: 'recurring', initial: r })}><ClCatCell icon={cat ? cat.icon : 'repeat'} color={cat ? cat.color : '#6B7280'} title={r.description} sub={`${FREQ[r.frequency]} · ${r.active ? `próx. ${fmtDate(r.next_date).slice(0, 5)}` : 'pausada'}`} /></button>
                <span className={`cl-num shrink-0 text-[14px] font-medium ${r.kind === 'in' ? 'text-in' : ''}`}>{m(r.amount)}</span>
                <button type="button" role="switch" aria-checked={r.active} aria-label={`${r.active ? 'Pausar' : 'Retomar'} ${r.description}`} className={`switch scale-[.85] ${r.active ? 'on' : ''}`} onClick={() => d.saveRecurring(r, { active: !r.active })}><span /></button>
              </li>
            ); })}
          </ul>
        ) : (
          <table className="cl-table w-full text-left text-[14px]">
            <thead><tr><th>Descrição</th><th>Frequência</th><th>Próxima data</th><th>Conta / cartão</th><th className="text-right">Valor</th><th className="text-right">Ativa</th></tr></thead>
            <tbody>
              {list.map((r) => {
                const cat = d.categories.find((c) => c.id === r.category_id);
                return (
                  <tr key={r.id} className={r.active ? '' : 'opacity-55'}>
                    <td><button type="button" className="text-left" onClick={() => d.openModal({ kind: 'recurring', initial: r })}><ClCatCell icon={cat ? cat.icon : 'repeat'} color={cat ? cat.color : '#6B7280'} title={r.description} sub={cat ? cat.name : null} /></button></td>
                    <td className="text-ink/65">{FREQ[r.frequency]}{r.end_date ? <span className="block text-[12px] text-ink/45">até {fmtDate(r.end_date)}</span> : null}</td>
                    <td className="text-ink/65">{r.active ? fmtDate(r.next_date) : 'Pausada'}</td>
                    <td className="text-ink/65">{where(r)}</td>
                    <td className={`cl-num text-right font-medium ${r.kind === 'in' ? 'text-in' : ''}`}>{r.kind === 'in' ? '+' : '−'}{m(r.amount)}</td>
                    <td className="text-right"><button type="button" role="switch" aria-checked={r.active} aria-label={`${r.active ? 'Pausar' : 'Retomar'} ${r.description}`} className={`switch scale-[.85] ${r.active ? 'on' : ''}`} onClick={() => d.saveRecurring(r, { active: !r.active })}><span /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </ClSection>
      <ClSection title="A pagar e a receber" sub="Confirme quando o dinheiro sair ou entrar"><UpcomingList limit={20} /></ClSection>
    </ClPage>
  );
}

/* ---------- Metas ---------- */
function CleanGoalsPage() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const goals = d.goals.slice().sort((a, b) => (a.saved >= a.target) - (b.saved >= b.target));
  const saved = sum(d.goals, (g) => g.saved);
  const target = sum(d.goals, (g) => g.target);
  const monthly = sum(d.goals.filter((g) => g.saved < g.target), (g) => g.monthly_amount || 0);
  return (
    <ClPage actions={<button type="button" className="btn btn-primary !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'goal' })}><Icon name="plus" size={15} />Nova meta</button>}>
      <ClStats items={[
        { label: 'Total guardado', value: m(saved), note: plural(d.goals.length, 'meta', 'metas') },
        { label: 'Objetivo somado', value: m(target), note: target ? `${Math.round((saved / target) * 100)}% concluído` : '—' },
        { label: 'Guardar por mês', value: m(monthly), note: 'nas metas em andamento' },
      ]} />
      {goals.length === 0 ? <ClSection><EmptyState icon="target" title="Nenhuma meta ainda" text="Reserva de emergência, viagem, um carro novo… Defina quanto quer juntar e até quando." /></ClSection> : (
        <div className={`grid gap-4 ${narrow ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
          {goals.map((g) => {
            const p = g.target ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
            const done = g.saved >= g.target;
            const months = g.due ? Math.max(1, Math.ceil(diffDays(g.due, todayISO()) / 30)) : null;
            const need = months && !done ? Math.ceil((g.target - g.saved) / months) : null;
            return (
              <div key={g.id} className="cl-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <ClCatCell icon={g.icon} color="#2563EB" title={g.name} sub={g.due ? `até ${fmtDate(g.due)}` : 'sem prazo'} />
                  <span className={`cl-pill ${done ? 'cl-pill-ok' : 'cl-pill-wait'}`}>{done ? 'Concluída' : `${p}%`}</span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-2">
                  <p className="cl-num text-[22px] font-semibold">{m(g.saved)}</p>
                  <p className="pb-1 text-[12.5px] text-ink/50">de <span className="cl-num">{m(g.target)}</span></p>
                </div>
                <div className="track mt-2"><i style={{ width: `${p}%` }} /></div>
                <p className="mt-2 text-[12.5px] text-ink/55">{done ? 'Meta batida.' : need ? `Guardando ${m(need)} por mês você chega no prazo.` : g.monthly_amount ? `${m(g.monthly_amount)} por mês planejado.` : 'Guarde quando puder.'}</p>
                <div className="mt-4 flex gap-2">
                  {!done && <button type="button" className="btn btn-ghost flex-1 !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'goalSave', goal: g })}><Icon name="plus" size={14} />Guardar valor</button>}
                  <button type="button" className="cl-iconbtn !size-[38px]" aria-label={`Editar ${g.name}`} onClick={() => d.openModal({ kind: 'goal', initial: g })}><Icon name="edit" size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ClPage>
  );
}

/* ---------- Categorias ---------- */
function CleanCategories() {
  const d = useApp();
  const narrow = useNarrow();
  const m = useMoneyText();
  const [kind, setKind] = useState('out');
  const month = d.month;
  const stats = useMemo(() => {
    const o = {};
    d.transactions.forEach((t) => {
      if (!t.category_id) return;
      const s = o[t.category_id] || (o[t.category_id] = { count: 0, month: 0 });
      s.count += 1;
      if (finMonthOf(t.date) === month && (countsAsExpense(t) || countsAsIncome(t))) s.month += t.amount;
    });
    return o;
  }, [d.transactions, month]);
  const list = d.categories.filter((c) => c.kind === kind && !c.parent_id);
  const subsOf = (c) => d.categories.filter((x) => x.parent_id === c.id);
  const monthOf = (c) => (stats[c.id] || { month: 0 }).month + sum(subsOf(c), (x) => (stats[x.id] || { month: 0 }).month);
  const sorted = list.slice().sort((a, b) => monthOf(b) - monthOf(a));
  const total = sum(sorted, monthOf);
  const budgeted = sorted.filter((c) => c.budget > 0);
  return (
    <ClPage actions={<>
      <MonthSwitch month={month} onChange={d.setMonth} />
      <button type="button" className="btn btn-primary !py-2 text-[13px]" onClick={() => d.openModal({ kind: 'category', initialKind: kind })}><Icon name="plus" size={15} />Nova categoria</button>
    </>}>
      <ClStats items={[
        { label: kind === 'out' ? 'Gasto no mês' : 'Recebido no mês', value: m(total), note: monthLabel(month) },
        { label: 'Categorias', value: String(list.length), note: `${d.categories.filter((c) => c.kind === kind && c.parent_id).length} subcategorias` },
        kind === 'out' ? { label: 'Com orçamento', value: String(budgeted.length), note: budgeted.length ? `${budgeted.filter((c) => monthOf(c) > c.budget).length} acima do limite` : 'defina limites mensais' } : null,
      ]} />
      <section className="cl-card overflow-hidden">
        <div className="px-4 py-3"><Segmented size="sm" label="Tipo" value={kind} onChange={setKind} options={[{ value: 'out', label: 'Despesas' }, { value: 'in', label: 'Receitas' }]} /></div>
        {sorted.length === 0 ? <div className="border-t border-ink/[0.07] p-5"><EmptyState icon="grid" title="Nenhuma categoria" text="Crie categorias para organizar seus lançamentos." /></div> : narrow ? (
          <ul className="divide-y divide-ink/[0.07] border-t border-ink/[0.07]">
            {sorted.map((c) => { const v = monthOf(c); const pct = c.budget ? Math.round((v / c.budget) * 100) : null; return (
              <li key={c.id}><button type="button" className="w-full px-4 py-3 text-left" onClick={() => d.openModal({ kind: 'category', initial: c })}>
                <div className="flex items-center gap-3"><span className="min-w-0 flex-1"><ClCatCell icon={c.icon} color={c.color} title={c.name} sub={subsOf(c).length ? plural(subsOf(c).length, 'subcategoria', 'subcategorias') : null} /></span><span className="cl-num text-[14px] font-medium">{m(v)}</span></div>
                {pct != null && <div className="mt-2 pl-11"><div className="flex justify-between text-[12px] text-ink/50"><span>de {m(c.budget)}</span><span>{pct}%</span></div><div className="track mt-1"><i className={pct >= 100 ? 'over' : pct >= 80 ? 'warn' : ''} style={{ width: `${Math.min(100, pct)}%` }} /></div></div>}
              </button></li>
            ); })}
          </ul>
        ) : (
          <table className="cl-table w-full text-left text-[14px]">
            <thead><tr><th>Categoria</th><th>Lançamentos</th><th className="text-right">{kind === 'out' ? 'Gasto no mês' : 'Recebido no mês'}</th><th className="text-right">Participação</th>{kind === 'out' && <th className="w-[260px]">Orçamento</th>}<th className="w-[60px]"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {sorted.map((c) => {
                const v = monthOf(c);
                const pct = c.budget ? Math.round((v / c.budget) * 100) : null;
                const n = (stats[c.id] || { count: 0 }).count + sum(subsOf(c), (x) => (stats[x.id] || { count: 0 }).count);
                return (
                  <tr key={c.id}>
                    <td><ClCatCell icon={c.icon} color={c.color} title={c.name} sub={subsOf(c).length ? subsOf(c).map((x) => x.name).join(', ') : null} /></td>
                    <td className="text-ink/60">{n}</td>
                    <td className="cl-num text-right font-medium">{m(v)}</td>
                    <td className="cl-num text-right text-ink/60">{total ? fmtPctAbs((v / total) * 100) : '—'}</td>
                    {kind === 'out' && <td>{pct == null ? <button type="button" className="text-[13px] font-medium text-ink/50 hover:text-ink" onClick={() => d.openModal({ kind: 'category', initial: c })}>Definir limite</button> : (
                      <div><div className="flex justify-between text-[12px] text-ink/55"><span className="cl-num">{m(c.budget)}</span><span className={pct >= 100 ? 'font-semibold text-out' : ''}>{pct}%</span></div><div className="track mt-1"><i className={pct >= 100 ? 'over' : pct >= 80 ? 'warn' : ''} style={{ width: `${Math.min(100, pct)}%` }} /></div></div>
                    )}</td>}
                    <td className="text-right"><button type="button" className="cl-iconbtn" aria-label={`Editar ${c.name}`} onClick={() => d.openModal({ kind: 'category', initial: c })}><Icon name="edit" size={14} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </ClPage>
  );
}

// Telas que o visual Clean substitui; as demais usam as telas normais com o tema Clean
const CLEAN_PAGES = { inicio: CleanOverview, transacoes: CleanTransactions, contas: CleanAccounts, recorrentes: CleanRecurring, metas: CleanGoalsPage, categorias: CleanCategories };
const cleanPage = (id) => CLEAN_PAGES[id] || (PAGES[id] || PAGES.inicio).C;
