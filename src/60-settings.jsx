/* =====================================================================
   60-settings: perfil, segurança, preferências, notificações e dados.
   ===================================================================== */
const SETTINGS_TABS = [
  { id: 'perfil', label: 'Perfil', icon: 'user', desc: 'Nome e e-mail' },
  { id: 'seguranca', label: 'Acesso e segurança', icon: 'lock', desc: 'Senha, login e sessões' },
  { id: 'preferencias', label: 'Preferências', icon: 'palette', desc: 'Tema, privacidade, poupança' },
  { id: 'notificacoes', label: 'Notificações', icon: 'bell', desc: 'Lembretes e alertas' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'chat', desc: 'Registre pelo chat' },
  { id: 'dados', label: 'Seus dados', icon: 'file', desc: 'Exportar e excluir conta' },
];

function ProfileSettings() {
  const d = useApp();
  const user = d.session.user;
  const [name, setName] = useState(d.name);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [err, setErr] = useState('');
  const provider = (user.app_metadata && user.app_metadata.provider) || 'email';
  const saveName = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Digite o seu nome.'); return; }
    setErr(''); setBusy(true);
    try { await d.backend.auth.updateName(name.trim()); } catch (x) { /* o perfil abaixo é o que vale */ }
    await d.saveProfile({ name: name.trim() }, 'Nome atualizado');
    setBusy(false);
  };
  const changeEmail = async (e) => {
    e.preventDefault();
    if (!emailOk(email)) { setEmailMsg(''); setErr('Digite um e-mail válido.'); return; }
    setErr(''); setEmailBusy(true);
    try { await d.backend.auth.updateEmail(email.trim()); setEmailMsg(`Enviamos um link de confirmação para ${email.trim()} e para o e-mail atual. A troca vale depois de confirmar.`); setEmail(''); } catch (x) { setErr(x.message); }
    setEmailBusy(false);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-vivo to-leco text-2xl font-extrabold text-white ring-[3px] ring-ouro/70">{(d.name || user.email || '?').trim().charAt(0).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold tracking-[-0.02em]">{d.name || 'Sem nome'}</p>
          <p className="truncate text-xs text-ink/65">{user.email} · conta criada em {fmtDate(user.created_at)}</p>
        </div>
      </div>
      <form onSubmit={saveName} noValidate>
        <Panel title="Nome">
          <div className="mt-3 flex flex-wrap gap-2">
            <input id="pf-name" className="field min-w-0 flex-1" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <SubmitButton busy={busy} disabled={busy || name.trim() === d.name}>Salvar</SubmitButton>
          </div>
        </Panel>
      </form>
      <form onSubmit={changeEmail} noValidate>
        <Panel title="E-mail" sub={provider === 'google' ? 'Você entra com Google. O e-mail é o da sua conta Google.' : `Atual: ${user.email}`}>
          {provider !== 'google' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input id="pf-email" type="email" inputMode="email" className="field min-w-0 flex-1" placeholder="Novo e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
              <SubmitButton busy={emailBusy}>Trocar e-mail</SubmitButton>
            </div>
          )}
          {emailMsg && <p className="mt-3 rounded-2xl bg-vivo/10 px-3.5 py-2.5 text-[13px] font-semibold text-in">{emailMsg}</p>}
        </Panel>
      </form>
      <ErrorNote>{err}</ErrorNote>
    </div>
  );
}

function SecuritySettings() {
  const d = useApp();
  const user = d.session.user;
  const provider = (user.app_metadata && user.app_metadata.provider) || 'email';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [othersBusy, setOthersBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const p = passwordProblem(pw); if (p) { setErr(`Senha fraca. ${p}`); return; }
    if (pw !== pw2) { setErr('As senhas não são iguais.'); return; }
    setErr(''); setBusy(true);
    try { await d.backend.auth.updatePassword(pw); setPw(''); setPw2(''); d.toast('Senha alterada'); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const signOutOthers = async () => {
    setOthersBusy(true);
    try { await d.backend.auth.signOut('others'); d.toast('Sessões em outros aparelhos encerradas'); } catch (x) { d.toast(x.message, null, true); }
    setOthersBusy(false);
  };
  const rows = [
    ['E-mail de login', user.email, 'mail'],
    ['Forma de entrar', provider === 'google' ? 'Conta Google' : 'E-mail e senha', provider === 'google' ? 'google' : 'key'],
    ['E-mail confirmado', user.email_confirmed_at ? `Sim, em ${fmtDate(user.email_confirmed_at)}` : 'Ainda não', 'check'],
    ['Último acesso', user.last_sign_in_at ? `${fmtDate(user.last_sign_in_at)} às ${new Date(user.last_sign_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '—', 'clock'],
    ['Conta criada em', fmtDate(user.created_at), 'calendar'],
  ];
  return (
    <div className="space-y-5">
      <Panel title="Dados de acesso">
        <dl className="mt-2 divide-y divide-ink/[0.07] text-[13px]">
          {rows.map(([k, v, ic]) => (
            <div key={k} className="flex items-center gap-3 py-2.5">
              <Icon name={ic} size={16} className="shrink-0 text-ink/60" />
              <dt className="w-[120px] shrink-0 text-ink/65">{k}</dt>
              <dd className="min-w-0 break-words font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <form onSubmit={submit} noValidate>
        <Panel title={provider === 'google' ? 'Criar uma senha' : 'Alterar senha'} sub={provider === 'google' ? 'Opcional: com uma senha você também pode entrar usando o e-mail.' : 'Use pelo menos 8 caracteres, com letras e números.'}>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Nova senha"><PasswordInput id="sec-pw" value={pw} onChange={setPw} autoComplete="new-password" /><StrengthBar pw={pw} /></Field>
            <Field label="Confirmar"><PasswordInput id="sec-pw2" value={pw2} onChange={setPw2} autoComplete="new-password" invalid={pw2 && pw !== pw2} /></Field>
          </div>
          <div className="mt-3"><ErrorNote>{err}</ErrorNote></div>
          <SubmitButton busy={busy} className="mt-3"><Icon name="key" size={16} />Salvar senha</SubmitButton>
        </Panel>
      </form>
      <Panel title="Sessões" sub="Se você entrou num aparelho que não usa mais, encerre o acesso dele aqui.">
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={signOutOthers} disabled={othersBusy}>{othersBusy ? <Spinner size={14} /> : <Icon name="logout" size={16} />}Sair dos outros aparelhos</button>
          <button type="button" className="btn btn-ghost" onClick={d.signOut}><Icon name="logout" size={16} />Sair deste aparelho</button>
        </div>
      </Panel>
    </div>
  );
}

function PrefsSettings() {
  const d = useApp();
  const p = d.profile;
  return (
    <div className="space-y-5">
      <Panel title="Aparência" sub="O tema claro usa fundo branco; o escuro usa o Verde Noite da marca.">
        <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
          {[{ v: 'light', l: 'Claro', i: 'sun', bg: '#FFFFFF', fg: '#0B2F29' }, { v: 'dark', l: 'Escuro', i: 'moon', bg: '#0B2F29', fg: '#E4EFEA' }].map((o) => (
            <button key={o.v} type="button" aria-pressed={p.theme === o.v} onClick={() => d.saveProfile({ theme: o.v })}
              className={`rounded-2xl border p-2 text-left transition-all ${p.theme === o.v ? 'border-vivo shadow-[0_0_0_3px_rgba(20,128,107,.18)]' : 'border-ink/15 hover:border-ink/30'}`}>
              <span className="block h-16 rounded-xl p-2" style={{ background: o.bg, boxShadow: 'inset 0 0 0 1px rgba(11,47,41,.1)' }}>
                <span className="block h-2 w-10 rounded-full" style={{ background: o.fg, opacity: 0.8 }} />
                <span className="mt-1.5 block h-6 rounded-lg" style={{ background: 'linear-gradient(135deg,#14806B,#0F5C4D)' }} />
              </span>
              <span className="mt-2 flex items-center gap-1.5 px-1 text-[13px] font-bold"><Icon name={o.i} size={15} />{o.l}</span>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="Privacidade e conforto">
        <div className="divide-y divide-ink/[0.07]">
          <Toggle id="pref-hide" icon="eyeOff" label="Ocultar valores" desc="Esconde saldos e valores em todo o app. Útil em lugares públicos." checked={!!p.hide_values} onChange={(v) => d.saveProfile({ hide_values: v })} />
          <Toggle id="pref-calm" icon="sparkle" label="Reduzir animações" desc="Desliga os movimentos do fundo e das transições neste aparelho." checked={d.calm} onChange={d.setCalm} />
        </div>
      </Panel>
      <Panel title="Meta de poupança mensal" sub="Parte da renda que você quer guardar todo mês." action={<span className="badge-gold text-sm">{p.savings_goal}%</span>}>
        <input id="pref-goal" type="range" min="0" max="60" step="5" defaultValue={p.savings_goal} onChange={(e) => d.saveProfile({ savings_goal: Number(e.target.value) }, null, true)} className="mt-4 w-full" aria-label="Meta de poupança em porcentagem" />
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-ink/60"><span>0%</span><span>60%</span></div>
      </Panel>
    </div>
  );
}

function NotifSettings() {
  const d = useApp();
  const p = d.profile;
  const [perm, setPerm] = useState(null);
  const LN = Native.LocalNotifications;
  useEffect(() => { if (LN) LN.checkPermissions().then((r) => setPerm(r.display)).catch(() => {}); }, []);
  const ask = async () => { try { const r = await LN.requestPermissions(); setPerm(r.display); if (r.display === 'granted') d.toast('Notificações ativadas'); } catch (e) { d.toast('Não foi possível ativar as notificações.', null, true); } };
  return (
    <div className="space-y-5">
      {LN && (
        <Panel title="Notificações do celular" sub={perm === 'granted' ? 'Ativadas. O Leco avisa no celular antes dos vencimentos, mesmo com o app fechado.' : 'Permita que o Leco mostre lembretes no celular.'}>
          {perm !== 'granted' && <button type="button" className="btn btn-primary mt-3" onClick={ask}><Icon name="bell" size={16} />Permitir notificações</button>}
        </Panel>
      )}
      <Panel title="O que avisar">
        <div className="divide-y divide-ink/[0.07]">
          <Toggle id="nt-bills" icon="calendar" label="Contas a pagar e faturas" desc="Lembretes de vencimento das contas pendentes e das faturas dos cartões." checked={p.notify_bills} onChange={(v) => d.saveProfile({ notify_bills: v })} />
          <Toggle id="nt-budget" icon="alert" label="Orçamento perto do limite" desc="Quando uma categoria passa de 80% do orçamento do mês." checked={p.notify_budget} onChange={(v) => d.saveProfile({ notify_budget: v })} />
          <Toggle id="nt-goals" icon="target" label="Progresso das metas" desc="Quando uma meta passa de 75%." checked={p.notify_goals} onChange={(v) => d.saveProfile({ notify_goals: v })} />
        </div>
        <Field label="Avisar contas com antecedência de" className="mt-2 max-w-xs">
          <select id="nt-days" className="field" value={p.bill_days_before} disabled={!p.notify_bills} onChange={(e) => d.saveProfile({ bill_days_before: Number(e.target.value) })}>
            {[0, 1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n === 0 ? 'No dia do vencimento' : `${n} ${n === 1 ? 'dia' : 'dias'} antes`}</option>)}
          </select>
        </Field>
      </Panel>
    </div>
  );
}

function DataSettings() {
  const d = useApp();
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const exportAll = () => d.exportFile(`leco-todas-as-transacoes-${todayISO()}.csv`, transactionsCSV(d.transactions, d));
  const backup = () => {
    const pick = (o) => { const { user_id, ...rest } = o; return rest; };
    const json = JSON.stringify({ app: 'Leco', exportado_em: new Date().toISOString(), perfil: pick(d.profile), contas: d.accounts.map(pick), cartoes: d.cards.map(pick), categorias: d.categories.map(pick), recorrencias: d.recurrings.map(pick), transacoes: d.transactions.map(pick), metas: d.goals.map(pick) }, null, 2);
    d.exportFile(`leco-backup-${todayISO()}.json`, json, 'application/json');
  };
  const del = async () => {
    setErr(''); setBusy(true);
    try { await d.backend.auth.deleteAccount(); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="space-y-5">
      <Panel title="Exportar" sub={`${d.transactions.length} transações, ${d.accounts.length} contas, ${d.cards.length} cartões e ${d.goals.length} metas.`}>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={exportAll}><Icon name="download" size={16} />Transações para Excel (CSV)</button>
          <button type="button" className="btn btn-ghost" onClick={backup}><Icon name="file" size={16} />Cópia completa (JSON)</button>
        </div>
      </Panel>
      <Panel tone="danger" title="Excluir minha conta" sub="Apaga a conta e todos os dados (transações, contas, cartões, metas) de forma definitiva. Não dá para desfazer.">
        {confirm ? (
          <div className="mt-3 space-y-3">
            <Field label='Digite EXCLUIR para confirmar'><input id="del-typed" className="field" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></Field>
            <ErrorNote>{err}</ErrorNote>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => { setConfirm(false); setTyped(''); }}>Cancelar</button>
              <button type="button" className="btn btn-danger" disabled={typed.trim().toUpperCase() !== 'EXCLUIR' || busy} onClick={del}>{busy ? <Spinner size={14} /> : <Icon name="trash" size={16} />}Excluir tudo para sempre</button>
            </div>
          </div>
        ) : <button type="button" className="btn btn-ghost mt-3" onClick={() => setConfirm(true)}><Icon name="trash" size={16} />Quero excluir minha conta</button>}
      </Panel>
    </div>
  );
}


const fmtPhone = (p) => {
  const m = String(p || '').match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : `+${p}`;
};
function openExternal(url) {
  if (Native.Browser) Native.Browser.open({ url }).catch(() => window.open(url, '_blank'));
  else window.open(url, '_blank', 'noopener');
}
const WA_EXAMPLES = [
  ['💸', 'gastei 45,90 no mercado'],
  ['💳', 'tênis 300 em 3x no cartão'],
  ['💰', 'recebi 3500 de salário'],
  ['🎙️', 'mande um áudio contando o gasto'],
  ['🧾', 'mande a foto da nota ou do Pix'],
  ['📊', 'quanto gastei este mês?'],
];

function WhatsAppSettings() {
  const d = useApp();
  const api = d.backend.whatsapp;
  const number = String(CFG.whatsappNumber || '').replace(/\D/g, '');
  const [link, setLink] = useState(undefined);
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [left, setLeft] = useState(0);
  const refresh = useCallback(async () => { try { setLink(await api.status()); } catch (e) { setErr(e.message); setLink(null); } }, [api]);
  useEffect(() => { refresh(); }, [refresh]);
  // Enquanto o código está na tela, confere se o vínculo já aconteceu
  useEffect(() => {
    if (!code || link) return undefined;
    const tick = () => {
      const s = Math.max(0, Math.round((new Date(code.expires_at) - Date.now()) / 1000));
      setLeft(s);
      if (!s) setCode(null);
    };
    tick();
    const t1 = setInterval(tick, 1000);
    const t2 = setInterval(async () => { const l = await api.status().catch(() => null); if (l) { setLink(l); setCode(null); d.toast('WhatsApp vinculado'); } }, 4000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [code, link]);
  const gen = async () => { setErr(''); setBusy(true); try { setCode(await api.createCode()); } catch (e) { setErr(e.message); } setBusy(false); };
  const unlink = async () => { setErr(''); setBusy(true); try { await api.unlink(); setLink(null); d.toast('WhatsApp desvinculado'); } catch (e) { setErr(e.message); } setBusy(false); };
  const chatUrl = (text) => `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4 rounded-3xl bg-gradient-to-br from-leco to-noite p-5 text-white">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15"><Icon name="chat" size={24} /></span>
        <div className="min-w-0">
          <p className="text-[17px] font-extrabold tracking-[-0.02em]">Assistente do Leco no WhatsApp</p>
          <p className="mt-1 text-[13px] leading-relaxed text-white/80">Mande uma mensagem, um áudio ou a foto da nota e o assistente registra no Leco para você. Também responde quanto você gastou, seu saldo e o que vence.</p>
        </div>
      </div>

      {link === undefined ? (
        <div className="flex justify-center py-6 text-vivo"><Spinner /></div>
      ) : link ? (
        <Panel title="Vinculado" sub={`Este número está ligado à sua conta desde ${fmtDate(String(link.created_at).slice(0, 10))}.`}>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-in/10 px-3.5 py-2 text-sm font-bold text-in"><Icon name="check" size={16} />{fmtPhone(link.phone)}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {number && <button type="button" className="btn btn-primary" onClick={() => openExternal(chatUrl(''))}><Icon name="chat" size={16} />Abrir conversa</button>}
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={unlink}>{busy ? <Spinner size={14} /> : <Icon name="x" size={16} />}Desvincular</button>
          </div>
        </Panel>
      ) : (
        <Panel title="Vincular seu WhatsApp" sub="Gere um código e envie para o assistente pelo WhatsApp. O código vale 15 minutos.">
          {code ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-vivo/25 bg-menta/60 px-4 py-4 text-center">
                <p className="lbl">Seu código</p>
                <p className="mt-1 select-all text-[28px] font-extrabold tracking-[0.06em] tabular-nums text-noite" aria-live="polite">{code.code}</p>
                <p className="mt-1 text-xs text-ink/65">Expira em {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {number && <button type="button" className="btn btn-primary" onClick={() => openExternal(chatUrl(code.code))}><Icon name="chat" size={16} />Enviar pelo WhatsApp</button>}
                <button type="button" className="btn btn-ghost" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(code.code).then(() => d.toast('Código copiado')).catch(() => {}); }}><Icon name="file" size={16} />Copiar código</button>
              </div>
              <p className="flex items-center gap-2 text-xs text-ink/65"><Spinner size={12} />Aguardando a mensagem no WhatsApp…</p>
              {!number && <p className="text-xs text-ink/65">Envie o código para o número do assistente do Leco.</p>}
            </div>
          ) : (
            <button type="button" className="btn btn-primary mt-4" disabled={busy} onClick={gen}>{busy ? <Spinner size={14} /> : <Icon name="key" size={16} />}Gerar código</button>
          )}
        </Panel>
      )}
      <ErrorNote>{err}</ErrorNote>

      <Panel title="O que dá para mandar" sub="Escreva do seu jeito. O assistente entende a categoria, a conta, o cartão e as parcelas.">
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {WA_EXAMPLES.map(([e, t]) => (
            <li key={t} className="flex items-center gap-2.5 rounded-2xl bg-ink/[0.04] px-3.5 py-2.5 text-[13px] font-semibold"><span aria-hidden="true">{e}</span>{t}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-ink/65">Errou? Toque em <b>Desfazer</b> na resposta ou escreva <b>desfazer</b>. As mensagens são interpretadas por IA (Google Gemini) apenas para registrar os lançamentos.</p>
      </Panel>
    </div>
  );
}

const SETTINGS_VIEWS = { perfil: ProfileSettings, seguranca: SecuritySettings, preferencias: PrefsSettings, notificacoes: NotifSettings, whatsapp: WhatsAppSettings, dados: DataSettings };

function SettingsPage() {
  const d = useApp();
  const narrow = useNarrow();
  const sub = d.settingsSub;
  const View = SETTINGS_VIEWS[sub] || ProfileSettings;
  const current = SETTINGS_TABS.find((t) => t.id === sub) || SETTINGS_TABS[0];
  if (narrow) return <div className="glass rise p-4"><View /></div>;
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Configurações" title={current.label} />
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Seções de configuração" className="flex flex-col gap-2 self-start">
          {SETTINGS_TABS.map((t) => {
            const on = sub === t.id;
            return (
              <button key={t.id} type="button" onClick={() => d.setSettingsSub(t.id)} aria-current={on ? 'page' : undefined}
                className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${on ? 'glass border-vivo/30' : 'border-transparent hover:bg-ink/[0.04]'}`}>
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${on ? 'bg-gradient-to-br from-vivo to-leco text-white' : 'bg-ink/[0.06] text-ink'}`}><Icon name={t.icon} size={17} /></span>
                <span className="min-w-0"><span className="block text-sm font-bold">{t.label}</span><span className="block text-xs text-ink/65">{t.desc}</span></span>
              </button>
            );
          })}
        </nav>
        <div key={sub} className="glass rise min-w-0 p-5 sm:p-6"><View /></div>
      </div>
    </div>
  );
}
