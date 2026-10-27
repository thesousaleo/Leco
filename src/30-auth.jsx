/* =====================================================================
   30-auth: entrar, criar conta, confirmar e-mail, recuperar e redefinir senha.
   ===================================================================== */
function strengthOf(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const passwordProblem = (pw) => {
  if (pw.length < 8) return 'Use pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Misture letras e números.';
  return '';
};
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

function StrengthBar({ pw }) {
  if (!pw) return null;
  const st = strengthOf(pw);
  const label = ['Muito fraca', 'Fraca', 'Média', 'Boa', 'Forte', 'Muito forte'][st];
  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < st ? (st <= 2 ? '#E0714F' : st === 3 ? '#5E8CA6' : '#14806B') : 'color-mix(in srgb, var(--ink) 10%, transparent)' }} />)}</div>
      <span className="text-xs font-bold">{label}</span>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, placeholder, invalid }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} className="field !pr-12" value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder} aria-invalid={!!invalid} />
      <button type="button" className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink/60 hover:text-ink" onClick={() => setShow((s) => !s)} aria-label={show ? 'Esconder senha' : 'Mostrar senha'}>
        <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </div>
  );
}

function AuthShell({ children, footer }) {
  return (
    <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center pb-[max(24px,var(--safe-bottom))] pl-[max(16px,var(--safe-left))] pr-[max(16px,var(--safe-right))] pt-[max(24px,var(--safe-top))]">
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex justify-center"><Logo size="lg" /></div>
        <div className="glass-deep rise p-6 sm:p-8">{children}</div>
        {footer && <div className="mt-5 text-center text-[13px] text-ink/70">{footer}</div>}
      </div>
    </div>
  );
}

function GoogleButton({ onClick, busy, label = 'Continuar com Google' }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="btn btn-ghost w-full !bg-paper !py-3 shadow-[0_6px_18px_-12px_rgba(11,47,41,.5)]">
      {busy ? <Spinner size={16} /> : <Icon name="google" size={18} />}{label}
    </button>
  );
}

function Divider({ children }) {
  return <div className="my-5 flex items-center gap-3 text-xs font-semibold text-ink/55"><span className="h-px flex-1 bg-ink/10" />{children}<span className="h-px flex-1 bg-ink/10" /></div>;
}

function PrivacySheet({ onClose }) {
  const titleId = cleanId(useId());
  return (
    <Sheet variant={window.innerWidth < 640 ? 'sheet' : 'dialog'} onClose={onClose} titleId={titleId} wide>
      <SheetHead id={titleId} title="Termos e privacidade" sub="Resumo do que acontece com os seus dados." onClose={onClose} />
      <div className="space-y-3 text-[13.5px] leading-relaxed text-ink/80">
        <p><b>O que guardamos.</b> Nome, e-mail e os dados financeiros que você registra (contas, cartões, transações, categorias, metas). Não pedimos senha de banco nem acessamos suas contas bancárias.</p>
        <p><b>Onde fica.</b> Num banco de dados protegido (Supabase), com acesso restrito: cada usuário só consegue ler e alterar os próprios dados.</p>
        <p><b>Para que usamos.</b> Só para mostrar o seu controle financeiro. Não vendemos nem compartilhamos dados com terceiros e não exibimos anúncios.</p>
        <p><b>Seus direitos (LGPD).</b> Você pode exportar tudo em Configurações › Seus dados e excluir a conta a qualquer momento; a exclusão apaga todos os dados de forma definitiva.</p>
        <p><b>Responsabilidade.</b> O Leco é uma ferramenta de organização. Os números dependem do que você registra e não substituem orientação financeira profissional.</p>
      </div>
      <button type="button" className="btn btn-primary mt-6 w-full" onClick={onClose}>Entendi</button>
    </Sheet>
  );
}

function LoginScreen({ backend, go, notice }) {
  const [email, setEmail] = useLocal('leco.lastEmail', '');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [gBusy, setGBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!emailOk(email)) { setErr('Digite um e-mail válido.'); return; }
    if (!pw) { setErr('Digite a sua senha.'); return; }
    setErr(''); setBusy(true);
    try { await backend.auth.signIn({ email: email.trim(), password: pw }); } catch (x) { setErr(x.message); setBusy(false); }
  };
  const google = async () => { setErr(''); setGBusy(true); try { await backend.auth.signInGoogle(); } catch (x) { setErr(x.message); } setGBusy(false); };
  return (
    <AuthShell footer={<>Ainda não tem conta? <button type="button" className="font-bold text-in underline-offset-2 hover:underline" onClick={() => go('signup')}>Criar conta grátis</button></>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em]">Entrar</h1>
          <p className="mt-1 text-[13.5px] text-ink/70">Acesse o seu controle financeiro.</p>
        </div>
        {notice && <p className="rounded-2xl bg-vivo/10 px-3.5 py-2.5 text-[13px] font-semibold text-in">{notice}</p>}
        <Field label="E-mail"><input id="login-email" type="email" inputMode="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" /></Field>
        <Field label="Senha"><PasswordInput id="login-pw" value={pw} onChange={setPw} autoComplete="current-password" /></Field>
        <div className="flex justify-end -mt-1"><button type="button" className="text-[13px] font-bold text-in hover:underline" onClick={() => go('forgot')}>Esqueci minha senha</button></div>
        <ErrorNote>{err}</ErrorNote>
        <SubmitButton busy={busy} className="w-full !py-3">Entrar</SubmitButton>
      </form>
      <Divider>ou</Divider>
      <GoogleButton onClick={google} busy={gBusy} />
      <button type="button" className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-bold text-in hover:bg-vivo/[0.07]" onClick={() => enterDemo(false)}>
        <Icon name="sparkle" size={15} />Explorar com dados de exemplo
      </button>
    </AuthShell>
  );
}

function SignupScreen({ backend, go }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gBusy, setGBusy] = useState(false);
  const [err, setErr] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Digite o seu nome.'); return; }
    if (!emailOk(email)) { setErr('Digite um e-mail válido.'); return; }
    const p = passwordProblem(pw); if (p) { setErr(`Senha fraca. ${p}`); return; }
    if (pw !== pw2) { setErr('As senhas não são iguais.'); return; }
    if (!agree) { setErr('Para criar a conta, aceite os termos e a política de privacidade.'); return; }
    setErr(''); setBusy(true);
    try {
      const r = await backend.auth.signUp({ name: name.trim(), email: email.trim(), password: pw });
      try { window.localStorage.setItem('leco.lastEmail', JSON.stringify(email.trim())); } catch (x) { /* ignora */ }
      if (r.needsConfirm) go('check', { email: email.trim() });
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  const google = async () => { setErr(''); setGBusy(true); try { await backend.auth.signInGoogle(); } catch (x) { setErr(x.message); } setGBusy(false); };
  return (
    <AuthShell footer={<>Já tem conta? <button type="button" className="font-bold text-in hover:underline" onClick={() => go('login')}>Entrar</button></>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em]">Criar conta</h1>
          <p className="mt-1 text-[13.5px] text-ink/70">Grátis. Seus dados ficam protegidos e só você tem acesso.</p>
        </div>
        <GoogleButton onClick={google} busy={gBusy} label="Criar com Google" />
        <Divider>ou com e-mail</Divider>
        <Field label="Nome"><input id="su-name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como quer ser chamado" /></Field>
        <Field label="E-mail"><input id="su-email" type="email" inputMode="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" /></Field>
        <Field label="Senha" hint="Pelo menos 8 caracteres, com letras e números.">
          <PasswordInput id="su-pw" value={pw} onChange={setPw} autoComplete="new-password" />
          <StrengthBar pw={pw} />
        </Field>
        <Field label="Confirmar senha"><PasswordInput id="su-pw2" value={pw2} onChange={setPw2} autoComplete="new-password" invalid={pw2 && pw !== pw2} /></Field>
        <label className="flex items-start gap-3 text-[13px] leading-relaxed text-ink/80">
          <input id="su-agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#14806B]" />
          <span>Li e aceito os <button type="button" className="font-bold text-in underline" onClick={() => setPrivacy(true)}>termos de uso e a política de privacidade</button>.</span>
        </label>
        <ErrorNote>{err}</ErrorNote>
        <SubmitButton busy={busy} className="w-full !py-3">Criar minha conta</SubmitButton>
      </form>
      {privacy && <PrivacySheet onClose={() => setPrivacy(false)} />}
    </AuthShell>
  );
}

function CheckEmailScreen({ backend, go, email }) {
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const resend = async () => { setErr(''); try { await backend.auth.resendConfirm(email); setSent(true); } catch (x) { setErr(x.message); } };
  return (
    <AuthShell footer={<button type="button" className="font-bold text-in hover:underline" onClick={() => go('login', { notice: 'Depois de confirmar o e-mail, entre com a sua senha.' })}>Já confirmei, quero entrar</button>}>
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-vivo/12 text-in"><Icon name="mail" size={30} /></span>
        <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.02em]">Confirme o seu e-mail</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink/75">Enviamos um link de confirmação para <b className="text-ink">{email}</b>. Abra o e-mail e toque no link para ativar a conta.</p>
        <p className="mt-2 text-xs text-ink/60">Não chegou? Veja a pasta de spam ou promoções.</p>
        <div className="mt-5"><ErrorNote>{err}</ErrorNote></div>
        <button type="button" className="btn btn-ghost mt-3" onClick={resend} disabled={sent}>{sent ? 'Novo link enviado' : 'Reenviar link'}</button>
      </div>
    </AuthShell>
  );
}

function ForgotScreen({ backend, go }) {
  const [email, setEmail] = useLocal('leco.lastEmail', '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!emailOk(email)) { setErr('Digite um e-mail válido.'); return; }
    setErr(''); setBusy(true);
    try { await backend.auth.resetPassword(email.trim()); setSent(true); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <AuthShell footer={<button type="button" className="font-bold text-in hover:underline" onClick={() => go('login')}>Voltar para entrar</button>}>
      {sent ? (
        <div className="text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-vivo/12 text-in"><Icon name="mail" size={30} /></span>
          <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.02em]">Verifique o seu e-mail</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink/75">Se existir uma conta com <b className="text-ink">{email}</b>, você vai receber um link para criar uma nova senha. O link abre o Leco no navegador.</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <h1 className="text-[24px] font-extrabold tracking-[-0.02em]">Recuperar senha</h1>
            <p className="mt-1 text-[13.5px] text-ink/70">Digite o e-mail da conta. Enviaremos um link para criar uma senha nova.</p>
          </div>
          <Field label="E-mail"><input id="fg-email" type="email" inputMode="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <ErrorNote>{err}</ErrorNote>
          <SubmitButton busy={busy} className="w-full !py-3">Enviar link</SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}

function ResetPasswordScreen({ backend, onDone }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const p = passwordProblem(pw); if (p) { setErr(`Senha fraca. ${p}`); return; }
    if (pw !== pw2) { setErr('As senhas não são iguais.'); return; }
    setErr(''); setBusy(true);
    try { await backend.auth.updatePassword(pw); onDone(); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <AuthShell>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em]">Criar nova senha</h1>
          <p className="mt-1 text-[13.5px] text-ink/70">Escolha uma senha que você não usa em outros sites.</p>
        </div>
        <Field label="Nova senha"><PasswordInput id="rp-pw" value={pw} onChange={setPw} autoComplete="new-password" /><StrengthBar pw={pw} /></Field>
        <Field label="Confirmar nova senha"><PasswordInput id="rp-pw2" value={pw2} onChange={setPw2} autoComplete="new-password" invalid={pw2 && pw !== pw2} /></Field>
        <ErrorNote>{err}</ErrorNote>
        <SubmitButton busy={busy} className="w-full !py-3">Salvar nova senha</SubmitButton>
      </form>
    </AuthShell>
  );
}

function ConfigMissingScreen() {
  return (
    <AuthShell>
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-attn text-attn"><Icon name="alert" size={30} /></span>
        <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.02em]">Servidor não configurado</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink/75">Falta o endereço e a chave pública do Supabase no ficheiro <code className="rounded bg-ink/[0.06] px-1">leco.config.json</code>. Depois de preencher, gere o app de novo.</p>
      </div>
    </AuthShell>
  );
}

// Abertura: o "L" aparece e a moeda cai girando até o lugar
// A moeda é uma camada HTML separada: anima só transform/opacity, que o navegador
// roda fora da thread principal, então não engasga enquanto o app carrega.
function SplashMark({ size = 76 }) {
  const c = (n) => `${(n / 48) * 100}%`;
  return (
    <div className="relative" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 48 48" className="splash-l absolute inset-0 overflow-visible">
        <defs><linearGradient id="spl-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#14806B" /><stop offset="1" stopColor="#0B2F29" /></linearGradient></defs>
        <path d="M10 6h9v27h21v9H10z" fill="url(#spl-l)" stroke="url(#spl-l)" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <div className="splash-coin-drop absolute" style={{ left: c(21.5), top: c(13), width: c(19), height: c(19) }}>
        <div className="splash-coin-spin size-full">
          <svg viewBox="0 0 20 20" className="block size-full">
            <defs><radialGradient id="spl-c" cx=".34" cy=".3" r=".85"><stop offset="0" stopColor="#FFDB7E" /><stop offset=".55" stopColor="#E8A317" /><stop offset="1" stopColor="#B57406" /></radialGradient></defs>
            <circle cx="10" cy="10" r="9.5" fill="url(#spl-c)" />
            <circle cx="10" cy="10" r="6.3" fill="none" stroke="#9A6205" strokeOpacity=".55" strokeWidth="1.3" />
            <path d="M5.6 6.1a6 6 0 0 1 4-2.3" fill="none" stroke="#FFF3CF" strokeOpacity=".85" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
function SplashScreen({ text = 'Carregando…', leaving }) {
  return (
    <div className={`relative z-10 grid min-h-[100dvh] place-items-center transition-[opacity,transform] duration-200 ease-out ${leaving ? 'scale-[.97] opacity-0' : ''}`}>
      <div className="flex flex-col items-center gap-5">
        <SplashMark />
        <p className="splash-word text-[34px] font-extrabold tracking-[-0.03em]">Leco</p>
        <span className="splash-text flex items-center gap-2 text-sm font-semibold text-ink/60"><Spinner size={14} />{text}</span>
      </div>
    </div>
  );
}

// Carregando os dados: blocos no formato da tela, piscando de leve
function Skel({ className = '' }) { return <span className={`skel block ${className}`} aria-hidden="true" />; }
function LoadingSkeleton({ wide }) {
  return (
    <div className="relative z-10 min-h-[100dvh]" role="status" aria-label="Carregando seus dados">
      {wide ? (
        <div className="mx-auto grid max-w-[1480px] gap-5 p-5 grid-cols-[232px_minmax(0,1fr)] lg:grid-cols-[248px_minmax(0,1fr)]">
          <div className="glass space-y-3 p-5"><Skel className="h-10 w-32" /><Skel className="h-11 w-full rounded-full" />{Array.from({ length: 9 }, (_, i) => <Skel key={i} className="h-9 w-full" />)}</div>
          <div className="space-y-5">
            <div className="flex items-end justify-between pt-10"><div className="space-y-2"><Skel className="h-4 w-40" /><Skel className="h-8 w-72" /></div><Skel className="h-11 w-56 rounded-full" /></div>
            <div className="grid gap-4 md:grid-cols-2 min-[1500px]:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="glass space-y-4 p-6"><Skel className="h-4 w-32" /><Skel className="h-8 w-44" /><Skel className="h-3 w-24" /></div>)}</div>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"><div className="glass space-y-3 p-6"><Skel className="h-5 w-48" />{Array.from({ length: 5 }, (_, i) => <Skel key={i} className="h-12 w-full" />)}</div><div className="glass space-y-3 p-6"><Skel className="h-5 w-36" />{Array.from({ length: 5 }, (_, i) => <Skel key={i} className="h-12 w-full" />)}</div></div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 px-4 pt-[calc(14px+var(--safe-top))]">
          <div className="flex items-center gap-3"><Skel className="size-11 rounded-full" /><div className="flex-1 space-y-1.5"><Skel className="h-3 w-16" /><Skel className="h-5 w-28" /></div><Skel className="size-11 rounded-full" /><Skel className="size-11 rounded-full" /></div>
          <Skel className="h-[74px] w-full rounded-2xl" />
          <div className="glass space-y-3 p-4"><Skel className="h-4 w-32" />{Array.from({ length: 3 }, (_, i) => <Skel key={i} className="h-9 w-full" />)}</div>
          <div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }, (_, i) => <Skel key={i} className="h-14 w-full rounded-2xl" />)}</div>
          <div className="glass space-y-3 p-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="flex items-center gap-3"><Skel className="size-10 rounded-2xl" /><div className="flex-1 space-y-1.5"><Skel className="h-3.5 w-2/3" /><Skel className="h-3 w-1/2" /></div><Skel className="h-4 w-16" /></div>)}</div>
        </div>
      )}
    </div>
  );
}
