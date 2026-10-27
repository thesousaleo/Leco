/* =====================================================================
   60-settings: perfil, segurança, preferências, notificações e dados.
   ===================================================================== */
const SETTINGS_TABS = [
  { id: 'perfil', label: 'Perfil', icon: 'user', desc: 'Nome e e-mail' },
  { id: 'seguranca', label: 'Acesso e segurança', icon: 'lock', desc: 'Senha, login e sessões' },
  { id: 'preferencias', label: 'Aparência', icon: 'palette', desc: 'Tema, cores, texto e privacidade' },
  { id: 'personalizar', label: 'Personalizar', icon: 'layers', desc: 'Início, menu, mês financeiro' },
  { id: 'notificacoes', label: 'Notificações', icon: 'bell', desc: 'Lembretes e alertas' },
  { id: 'regras', label: 'Regras automáticas', icon: 'bolt', desc: 'Categorize sozinho ao lançar' },
  // A aba do WhatsApp só aparece quando o número do assistente estiver no leco.config.json
  ...(String((window.LECO_CONFIG || {}).whatsappNumber || '').replace(/\D/g, '') ? [{ id: 'whatsapp', label: 'WhatsApp', icon: 'chat', desc: 'Registre pelo chat' }] : []),
  { id: 'suporte', label: 'Ajuda e suporte', icon: 'help', desc: 'Dúvidas, contato e versão' },
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
      <PinSettingsPanel />
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
  const pr = d.prefs;
  const THEMES = [
    { v: 'light', l: 'Claro', i: 'sun', bg: '#FFFFFF', fg: '#0B2F29' },
    { v: 'dark', l: 'Escuro', i: 'moon', bg: '#0B2F29', fg: '#E4EFEA' },
    { v: 'black', l: 'Preto', i: 'contrast', bg: '#000000', fg: '#EEF5F2' },
    { v: 'auto', l: 'Automático', i: 'clock', bg: 'linear-gradient(135deg,#FFFFFF 50%,#0B2F29 50%)', fg: '#14806B' },
  ];
  const acc = ACCENTS[pr.accent] || ACCENTS.esmeralda;
  return (
    <div className="space-y-5">
      {!CLEAN && (
        <Panel title="Estilo" sub="Mesmas telas e cores; muda só o acabamento.">
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[{ v: 'glass', l: 'Vidro', s: 'Brilhos, transparências e fundo colorido' }, { v: 'sobrio', l: 'Sóbrio', s: 'Cartões sólidos, letras calmas, tabelas no computador' }].map((o) => {
              const on = (pr.style || 'glass') === o.v;
              return (
                <button key={o.v} type="button" aria-pressed={on} onClick={() => d.setPrefs({ style: o.v })}
                  className={`rounded-2xl border p-2 text-left transition-all ${on ? 'border-vivo shadow-[0_0_0_3px_rgba(20,128,107,.18)]' : 'border-ink/15 hover:border-ink/30'}`}>
                  <span className="relative block h-16 overflow-hidden rounded-xl p-2" style={{ background: o.v === 'glass' ? 'radial-gradient(60px 40px at 85% 10%, rgba(52,195,155,.35), transparent), radial-gradient(60px 40px at 10% 100%, rgba(20,128,107,.25), transparent), #F3F8F6' : '#F6F8F7', boxShadow: 'inset 0 0 0 1px rgba(11,47,41,.12)' }}>
                    <span className="block h-6 rounded-lg" style={{ background: o.v === 'glass' ? `linear-gradient(135deg,${acc.vivo},${acc.leco})` : acc.leco, boxShadow: o.v === 'glass' ? '0 6px 12px -6px rgba(15,92,77,.8), inset 0 1px 0 rgba(255,255,255,.35)' : 'none' }} />
                    <span className="mt-1.5 block h-5 rounded-lg" style={{ background: o.v === 'glass' ? 'rgba(255,255,255,.7)' : '#FFFFFF', boxShadow: o.v === 'glass' ? 'inset 0 1px 0 #fff, 0 6px 12px -8px rgba(11,47,41,.4)' : 'inset 0 0 0 1px rgba(11,47,41,.12)' }} />
                  </span>
                  <span className="mt-2 block px-1 text-[13px] font-bold">{o.l}</span>
                  <span className="block px-1 pb-0.5 text-[11.5px] leading-snug text-ink/60">{o.s}</span>
                </button>
              );
            })}
          </div>
        </Panel>
      )}
      <Panel title="Tema" sub={d.themeMode === 'auto' ? `Automático: escuro das ${pr.autoDarkFrom}h às ${pr.autoDarkTo}h.` : 'O preto economiza bateria em telas AMOLED.'}>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEMES.map((o) => (
            <button key={o.v} type="button" aria-pressed={d.themeMode === o.v} onClick={() => d.setPrefs({ theme: o.v })}
              className={`rounded-2xl border p-2 text-left transition-all ${d.themeMode === o.v ? 'border-vivo shadow-[0_0_0_3px_rgba(20,128,107,.18)]' : 'border-ink/15 hover:border-ink/30'}`}>
              <span className="block h-14 rounded-xl p-2" style={{ background: o.bg, boxShadow: 'inset 0 0 0 1px rgba(11,47,41,.12)' }}>
                <span className="block h-2 w-10 rounded-full" style={{ background: o.fg, opacity: 0.8 }} />
                <span className="mt-1.5 block h-5 rounded-lg" style={{ background: `linear-gradient(135deg,${acc.vivo},${acc.leco})` }} />
              </span>
              <span className="mt-2 flex items-center gap-1.5 px-1 text-[13px] font-bold"><Icon name={o.i} size={15} />{o.l}</span>
            </button>
          ))}
        </div>
        {d.themeMode === 'auto' && (
          <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
            <Field label="Escuro a partir de"><select id="auto-from" className="field" value={pr.autoDarkFrom} onChange={(e) => d.setPrefs({ autoDarkFrom: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}h</option>)}</select></Field>
            <Field label="Claro a partir de"><select id="auto-to" className="field" value={pr.autoDarkTo} onChange={(e) => d.setPrefs({ autoDarkTo: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}h</option>)}</select></Field>
          </div>
        )}
      </Panel>
      {!CLEAN && (<Panel title="Cor de destaque" sub="Muda botões, menu e gráficos. O verde continua sendo a marca do Leco.">
        <div className="mt-4 flex flex-wrap gap-3">
          {Object.entries(ACCENTS).map(([k, a]) => (
            <button key={k} type="button" aria-pressed={pr.accent === k} onClick={() => d.setPrefs({ accent: k })} className="flex flex-col items-center gap-1.5">
              <span className="grid size-12 place-items-center rounded-2xl" style={{ background: `linear-gradient(135deg,${a.vivo},${a.leco})`, boxShadow: pr.accent === k ? `0 0 0 2px var(--paper), 0 0 0 4px ${a.vivo}` : 'none' }}>{pr.accent === k && <Icon name="check" size={18} className="text-white" strokeWidth={2.6} />}</span>
              <span className="text-[11.5px] font-semibold">{a.label}</span>
            </button>
          ))}
        </div>
      </Panel>)}
      <Panel title="Texto e leitura">
        <div className="mt-3">
          <span className="lbl">Tamanho do texto</span>
          <div className="mt-2 max-w-md"><Segmented full size="sm" label="Tamanho do texto" value={String(pr.fontScale)} onChange={(v) => d.setPrefs({ fontScale: Number(v) })} options={[{ value: '0.9', label: 'Menor' }, { value: '1', label: 'Normal' }, { value: '1.1', label: 'Grande' }, { value: '1.2', label: 'Maior' }]} /></div>
        </div>
        <div className="mt-2 divide-y divide-ink/[0.07]">
          <Toggle id="pref-contrast" icon="contrast" label="Alto contraste" desc="Textos sólidos, bordas mais fortes e fundo sem transparência." checked={!!pr.contrast} onChange={(v) => d.setPrefs({ contrast: v })} />
          <Toggle id="pref-calm" icon="sparkle" label="Reduzir animações" desc="Desliga movimentos e transições neste aparelho." checked={d.calm} onChange={d.setCalm} />
          {LITE && <Toggle id="pref-haptics" icon="phone" label="Vibração ao tocar" desc="Uma vibração leve ao salvar, pagar ou excluir." checked={pr.haptics !== false} onChange={(v) => { d.setPrefs({ haptics: v }); if (v) setTimeout(() => haptic('success'), 50); }} />}
        </div>
      </Panel>
      <Panel title="Privacidade">
        <div className="divide-y divide-ink/[0.07]">
          <Toggle id="pref-hide" icon="eyeOff" label="Ocultar valores" desc="Esconde saldos e valores em todo o app. Útil em lugares públicos." checked={!!p.hide_values} onChange={(v) => d.saveProfile({ hide_values: v })} />
        </div>
      </Panel>
      <Panel title="Meta de poupança mensal" sub="Parte da renda que você quer guardar todo mês." action={<span className="badge-gold text-sm">{p.savings_goal}%</span>}>
        <input id="pref-goal" type="range" min="0" max="60" step="5" defaultValue={p.savings_goal} onChange={(e) => d.saveProfile({ savings_goal: Number(e.target.value) }, null, true)} className="mt-4 w-full" aria-label="Meta de poupança em porcentagem" />
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-ink/60"><span>0%</span><span>60%</span></div>
      </Panel>
      {!d.v3 && <p className="rounded-2xl bg-ouro/10 px-4 py-3 text-xs text-ink/75">Enquanto o banco não for atualizado, estas preferências ficam salvas só neste aparelho.</p>}
    </div>
  );
}

function PersonalizeSettings() {
  const d = useApp();
  const pr = d.prefs;
  const move = (i, dir) => { const l = pr.home.slice(); const j = i + dir; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; d.setPrefs({ home: l }); haptic(); };
  const toggle = (id) => d.setPrefs({ home: pr.home.map((b) => (b.id === id ? { ...b, on: !b.on } : b)) });
  const setTab = (i, id) => { const t = pr.tabs.slice(); const k = t.indexOf(id); if (k >= 0) t[k] = t[i]; t[i] = id; d.setPrefs({ tabs: t }); };
  return (
    <div className="space-y-5">
      <Panel title="Mês financeiro" sub="Se você recebe no dia 5, o seu mês pode ir do dia 5 ao dia 4. Resumos, orçamentos e relatórios passam a seguir esse período.">
        <Field label="O mês começa no dia" className="mt-3 max-w-xs">
          <select id="pz-start" className="field" value={pr.monthStart} onChange={(e) => d.setPrefs({ monthStart: Number(e.target.value) })}>{Array.from({ length: 28 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? 'Dia 1 (mês do calendário)' : `Dia ${n}`}</option>)}</select>
        </Field>
        {pr.monthStart > 1 && <p className="mt-2 text-xs text-ink/65">Mês atual: {fmtDate(finRange(finMonthOf(todayISO()))[0])} a {fmtDate(finRange(finMonthOf(todayISO()))[1])}.</p>}
      </Panel>
      <Panel title="Primeiro dia da semana" sub="Usado no calendário.">
        <div className="mt-3 max-w-xs"><Segmented full size="sm" label="Primeiro dia da semana" value={String(pr.weekStart)} onChange={(v) => d.setPrefs({ weekStart: Number(v) })} options={[{ value: '0', label: 'Domingo' }, { value: '1', label: 'Segunda' }]} /></div>
      </Panel>
      <Panel title="Tela inicial (celular)" sub="Escolha os blocos e a ordem.">
        <ul className="mt-3 divide-y divide-ink/[0.07]">
          {pr.home.map((b, i) => {
            const info = HOME_BLOCKS.find((h) => h.id === b.id);
            return (
              <li key={b.id} className="flex items-center gap-2 py-2">
                <button type="button" role="switch" aria-checked={b.on} aria-label={`Mostrar ${info.label}`} onClick={() => toggle(b.id)} className={`switch ${b.on ? 'on' : ''}`}><span /></button>
                <span className={`min-w-0 flex-1 text-[13.5px] font-semibold ${b.on ? '' : 'text-ink/50'}`}>{info.label}</span>
                <button type="button" className="icon-btn size-9" aria-label={`Subir ${info.label}`} disabled={i === 0} onClick={() => move(i, -1)}><Icon name="chevUp" size={16} /></button>
                <button type="button" className="icon-btn size-9" aria-label={`Descer ${info.label}`} disabled={i === pr.home.length - 1} onClick={() => move(i, 1)}><Icon name="chevDown" size={16} /></button>
              </li>
            );
          })}
        </ul>
      </Panel>
      <Panel title="Menu de baixo (celular)" sub="Início e Ajustes ficam fixos. Escolha as 3 abas do meio.">
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Field key={i} label={`Aba ${i + 2}`}>
              <select id={`pz-tab-${i}`} className="field" value={pr.tabs[i]} onChange={(e) => setTab(i, e.target.value)}>{NAV_CHOICES.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select>
            </Field>
          ))}
        </div>
      </Panel>
      <Panel title="Restaurar padrão">
        <button type="button" className="btn btn-ghost mt-3" onClick={() => d.setPrefs({ home: DEFAULT_PREFS.home, tabs: DEFAULT_PREFS.tabs, monthStart: 1, weekStart: 0 })}><Icon name="refresh" size={16} />Voltar ao padrão</button>
      </Panel>
    </div>
  );
}

const FAQ = [
  ['Como lanço uma compra parcelada?', 'Toque no +, depois em "Parcelada". No cartão, cada parcela cai na fatura do mês certo; numa conta (boleto, carnê), as próximas ficam "a pagar".'],
  ['Como cadastro uma assinatura?', 'Toque no + e em "Assinatura", ou ligue "Repetir" em qualquer lançamento. O Leco lança sozinho todo mês e mostra no calendário.'],
  ['O saldo do Leco está diferente do banco', 'Em Contas e cartões, toque em "Ajustar saldo" e informe o valor real. O ajuste não entra nos relatórios.'],
  ['Como importo o extrato do banco?', 'Ajustes › Importar extrato. Baixe o extrato no app do banco em OFX ou CSV. O Leco sugere as categorias e marca o que já existe.'],
  ['Como mando as contas para o Google Agenda?', 'No Calendário, toque em "Exportar para o Google Agenda" e abra o arquivo com o Google Agenda (ou importe em calendar.google.com).'],
  ['Esqueci o PIN', 'Na tela do PIN, toque em "Esqueci o PIN". Você sai da conta e entra de novo com e-mail e senha (ou Google). Nada é perdido.'],
  ['Troquei de celular. Perco meus dados?', 'Não. Tudo fica na nuvem: é só entrar com a mesma conta. Para ter uma cópia extra, use Seus dados › Cópia completa.'],
  ['Como atualizo o app?', 'Quando houver versão nova, aparece um aviso no Início com o botão Baixar. O APK novo instala por cima, sem perder nada.'],
];
function SupportSettings() {
  const d = useApp();
  const [open, setOpen] = useState(null);
  const wa = String(CFG.supportWhatsapp || '').replace(/\D/g, '');
  const info = useUpdateCheck();
  const [checking, setChecking] = useState(false);
  const msg = encodeURIComponent(`Olá! Preciso de ajuda com o Leco (versão ${APP_VERSION}${APP_BUILD ? ` build ${APP_BUILD}` : ''}, ${NATIVE ? 'Android' : 'site'}).`);
  const openWa = () => { const url = `https://wa.me/${wa}?text=${msg}`; if (Native.Browser) Native.Browser.open({ url }).catch(() => window.open(url, '_blank')); else window.open(url, '_blank', 'noopener'); };
  return (
    <div className="space-y-5">
      <Panel title="Falar com o suporte" sub={wa ? 'Atendimento pelo WhatsApp. Conte o que aconteceu; se puder, mande um print.' : 'O contato do suporte será disponibilizado em breve.'}>
        {wa && <button type="button" className="btn btn-primary mt-3" onClick={openWa}><Icon name="whatsapp" size={17} />Chamar no WhatsApp</button>}
      </Panel>
      <Panel title="Perguntas frequentes">
        <ul className="mt-2 divide-y divide-ink/[0.07]">
          {FAQ.map(([q, a], i) => (
            <li key={q}>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 py-3 text-left text-[13.5px] font-bold">{q}<Icon name={open === i ? 'chevUp' : 'chevDown'} size={16} className="shrink-0 text-ink/55" /></button>
              {open === i && <p className="pb-3 text-[13px] leading-relaxed text-ink/75">{a}</p>}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Sobre o app">
        <dl className="mt-2 divide-y divide-ink/[0.07] text-[13px]">
          <div className="flex justify-between gap-3 py-2"><dt className="text-ink/65">Versão</dt><dd className="font-semibold">{APP_VERSION || '—'}{APP_BUILD ? ` (build ${APP_BUILD})` : ''}</dd></div>
          <div className="flex justify-between gap-3 py-2"><dt className="text-ink/65">Plataforma</dt><dd className="font-semibold">{NATIVE ? 'Android (APK)' : 'Site'}</dd></div>
          <div className="flex justify-between gap-3 py-2"><dt className="text-ink/65">Banco de dados</dt><dd className="font-semibold">{d.v3 ? 'Atualizado (Leco 3)' : 'Precisa de atualização'}</dd></div>
        </dl>
        {NATIVE && info && <button type="button" className="btn btn-primary mt-3" onClick={() => openUpdate(info)}><Icon name="rocket" size={16} />Baixar versão {info.version}</button>}
        {NATIVE && !info && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-ghost !py-2 text-[13px]" disabled={checking} onClick={async () => { setChecking(true); const v = await checkUpdate(true); setChecking(false); if (!v) d.toast('Você já está na versão mais recente'); }}>{checking ? <Spinner size={14} /> : <Icon name="refresh" size={15} />}Procurar atualização</button>
          </div>
        )}
        <p className="mt-3 text-xs text-ink/60"><a className="font-bold text-in" href={`${CFG.siteUrl || ''}privacidade.html`} target="_blank" rel="noopener">Política de privacidade</a></p>
      </Panel>
    </div>
  );
}

function NotifSettings() {
  const d = useApp();
  const p = d.profile;
  const N = notifPrefs(d.prefs);
  const setN = (patch) => d.setPrefs({ notif: { ...N, ...patch } });
  const [perm, setPerm] = useState(null);
  const LN = Native.LocalNotifications;
  useEffect(() => { if (LN) LN.checkPermissions().then((r) => setPerm(r.display)).catch(() => {}); }, []);
  const ask = async () => { try { const r = await LN.requestPermissions(); setPerm(r.display); if (r.display === 'granted') d.toast('Notificações ativadas'); } catch (e) { d.toast('Não foi possível ativar as notificações.', null, true); } };
  const test = async () => { try { if (await testNotification()) d.toast('Teste enviado: a notificação chega em 3 segundos'); else d.toast('Permita as notificações primeiro.', null, true); } catch (e) { d.toast('Não foi possível enviar o teste.', null, true); } };
  const bills = p.notify_bills !== false;
  const timeField = (id, value, onChange, disabled) => (
    <input id={id} type="time" className="field !w-[130px] tabular-nums" value={value} disabled={disabled} onChange={(e) => { if (e.target.value) onChange(e.target.value); }} />
  );
  return (
    <div className="space-y-5">
      {LN ? (
        <Panel title="Notificações do celular" sub={perm === 'granted' ? 'Ativadas. Os lembretes chegam mesmo com o app fechado.' : 'Permita que o Leco mostre lembretes no celular.'}>
          <div className="mt-3 flex flex-wrap gap-2">
            {perm !== 'granted' && <button type="button" className="btn btn-primary" onClick={ask}><Icon name="bell" size={16} />Permitir notificações</button>}
            {perm === 'granted' && <button type="button" className="btn btn-ghost" onClick={test}><Icon name="bell" size={16} />Enviar notificação de teste</button>}
          </div>
        </Panel>
      ) : (
        <p className="rounded-2xl bg-attn px-4 py-3 text-xs leading-relaxed text-ink/80">As notificações chegam pelo app do Leco no celular (Android). Estas escolhas valem para todos os seus aparelhos.</p>
      )}

      <Panel title="Horário dos lembretes" sub="Os avisos de contas, faturas, recebimentos e metas chegam neste horário.">
        <div className="mt-3 flex items-center gap-3">{timeField('nt-time', N.time, (v) => setN({ time: v }))}<span className="text-xs text-ink/60">Ex.: 08:00 para ver antes de sair de casa.</span></div>
      </Panel>

      <Panel title="Contas e faturas">
        <div className="divide-y divide-ink/[0.07]">
          <Toggle id="nt-bills" icon="calendar" label="Contas a pagar" desc="Boletos, aluguel, contas fixas e tudo que estiver como “a pagar”." checked={bills} onChange={(v) => d.saveProfile({ notify_bills: v })} />
          <Toggle id="nt-cards" icon="card" label="Faturas do cartão" desc="Vencimento das faturas com valor em aberto." checked={N.cards} disabled={!bills} onChange={(v) => setN({ cards: v })} />
          <Toggle id="nt-dueday" icon="bell" label="Avisar no dia do vencimento" desc="Além do aviso com antecedência, lembra de novo no próprio dia." checked={N.dueDay} disabled={!bills} onChange={(v) => setN({ dueDay: v })} />
          <Toggle id="nt-overdue" icon="alert" label="Contas atrasadas" desc="Um resumo por dia, no horário escolhido, enquanto houver conta vencida sem pagar." checked={N.overdue} disabled={!bills} onChange={(v) => setN({ overdue: v })} />
        </div>
        <Field label="Primeiro aviso" className="mt-2 max-w-xs">
          <select id="nt-days" className="field" value={p.bill_days_before} disabled={!bills} onChange={(e) => d.saveProfile({ bill_days_before: Number(e.target.value) })}>
            {[0, 1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n === 0 ? 'Só no dia do vencimento' : `${n} ${n === 1 ? 'dia' : 'dias'} antes`}</option>)}
          </select>
        </Field>
      </Panel>

      <Panel title="Dinheiro entrando">
        <div className="divide-y divide-ink/[0.07]">
          <Toggle id="nt-receive" icon="inArrow" label="Recebimentos" desc="Salário, Pix ou valores marcados como “a receber”, no dia em que devem cair." checked={N.receive} onChange={(v) => setN({ receive: v })} />
        </div>
      </Panel>

      <Panel title="Metas e orçamento">
        <div className="divide-y divide-ink/[0.07]">
          <Toggle id="nt-goalsave" icon="piggy" label="Lembrete de guardar nas metas" desc="No dia escolhido em cada meta, lembra do valor mensal." checked={N.goalSave} onChange={(v) => setN({ goalSave: v })} />
          <Toggle id="nt-budget" icon="alert" label="Orçamento perto do limite" desc="Quando uma categoria passa de 80% do orçamento do mês (uma vez por mês)." checked={p.notify_budget} onChange={(v) => d.saveProfile({ notify_budget: v })} />
          <Toggle id="nt-goals" icon="target" label="Meta quase lá" desc="Quando uma meta passa de 75%." checked={p.notify_goals} onChange={(v) => d.saveProfile({ notify_goals: v })} />
        </div>
      </Panel>

      <Panel title="Hábito diário">
        <div className="divide-y divide-ink/[0.07]">
          <Toggle id="nt-daily" icon="clock" label="Lembrete para registrar os gastos" desc="Um toque por dia para não esquecer de lançar o que gastou." checked={N.daily} onChange={(v) => setN({ daily: v })} />
        </div>
        {N.daily && <div className="mt-2 flex items-center gap-3"><span className="lbl">Horário</span>{timeField('nt-daily-time', N.dailyTime, (v) => setN({ dailyTime: v }))}</div>}
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
    const json = JSON.stringify({ app: 'Leco', exportado_em: new Date().toISOString(), perfil: pick(d.profile), contas: d.accounts.map(pick), cartoes: d.cards.map(pick), categorias: d.categories.map(pick), recorrencias: d.recurrings.map(pick), transacoes: d.transactions.map(pick), metas: d.goals.map(pick), dividas: (d.debts || []).map(pick), modelos: (d.templates || []).map(pick), planejamento: (d.plans || []).map(pick), versao: 3 }, null, 2);
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
          <button type="button" className="btn btn-ghost" onClick={() => d.exportFile('leco-agenda.ics', buildICS(d), 'text/calendar')}><Icon name="calendar" size={16} />Agenda (.ics)</button>
        </div>
      </Panel>
      <Panel title="Importar e restaurar" sub="Traga o extrato do banco ou volte uma cópia completa do Leco.">
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => d.openModal({ kind: 'import' })}><Icon name="upload" size={16} />Importar extrato</button>
          <button type="button" className="btn btn-ghost" onClick={() => d.openModal({ kind: 'restore' })}><Icon name="refresh" size={16} />Restaurar cópia</button>
        </div>
      </Panel>
      {!d.v3 && (
        <Panel title="Atualização do banco pendente" sub="Para usar etiquetas, comprovantes, modelos, dívidas, planejamento e preferências na nuvem, o administrador precisa rodar o arquivo supabase/v3.sql no Supabase.">
          <p className="mt-2 text-xs text-ink/60">Supabase › SQL Editor › New query › colar o conteúdo › Run. Depois, feche e abra o app.</p>
        </Panel>
      )}
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

const SETTINGS_VIEWS = { perfil: ProfileSettings, seguranca: SecuritySettings, preferencias: PrefsSettings, personalizar: PersonalizeSettings, notificacoes: NotifSettings, regras: RulesSettings, whatsapp: WhatsAppSettings, suporte: SupportSettings, dados: DataSettings };

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
