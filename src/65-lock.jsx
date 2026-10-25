/* =====================================================================
   75-lock: bloqueio com PIN, aviso de nova versão, dicas de primeira visita.
   O PIN fica só neste aparelho (cifrado com SHA-256), nunca vai para o servidor.
   ===================================================================== */
const PIN_KEY = 'leco.pin';
const pinGet = () => { try { const v = JSON.parse(localStorage.getItem(PIN_KEY) || 'null'); return v && v.hash ? v : null; } catch (e) { return null; } };
const pinSave = (v) => { try { if (v) localStorage.setItem(PIN_KEY, JSON.stringify(v)); else localStorage.removeItem(PIN_KEY); } catch (e) { /* sem armazenamento */ } setSecureScreen(!!v); };
function setSecureScreen(on) { try { if (window.LecoAndroid && window.LecoAndroid.setSecure) window.LecoAndroid.setSecure(!!on); } catch (e) { /* sem ponte */ } }
async function pinHash(pin, salt) {
  const text = `${salt}:${pin}:leco`;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let h = 0; for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    return `x${(h >>> 0).toString(16)}`;
  }
}
const PIN_TIMEOUTS = [[0, 'Sempre ao abrir'], [60, 'Após 1 minuto fora'], [300, 'Após 5 minutos fora'], [900, 'Após 15 minutos fora']];

function PinPad({ value, onDigit, onBack, disabled }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <div className="mx-auto grid w-[264px] grid-cols-3 gap-3">
      {keys.map((k, i) => k === '' ? <span key={i} /> : (
        <button key={i} type="button" disabled={disabled} aria-label={k === 'del' ? 'Apagar' : k}
          onClick={() => { haptic(); if (k === 'del') onBack(); else onDigit(k); }}
          className="grid h-16 place-items-center rounded-full bg-ink/[0.06] text-[24px] font-bold tabular-nums transition-transform active:scale-95 disabled:opacity-40">
          {k === 'del' ? <Icon name="left" size={22} /> : k}
        </button>
      ))}
    </div>
  );
}

function PinDots({ n, shake }) {
  return (
    <div className={`flex justify-center gap-4 ${shake ? 'pin-shake' : ''}`} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => <span key={i} className={`size-4 rounded-full border-2 transition-colors ${i < n ? 'border-vivo bg-vivo' : 'border-ink/30'}`} />)}
    </div>
  );
}

function PinLock({ onUnlock, onForgot, name }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [tries, setTries] = useState(0);
  const [wait, setWait] = useState(0);
  useEffect(() => { if (!wait) return undefined; const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000); return () => clearInterval(t); }, [wait > 0]);
  useEffect(() => {
    if (pin.length < 4) return;
    (async () => {
      const p = pinGet();
      if (!p || (await pinHash(pin, p.salt)) === p.hash) { haptic('success'); onUnlock(); return; }
      haptic('warn'); setShake(true); setTimeout(() => { setShake(false); setPin(''); }, 420);
      const n = tries + 1; setTries(n);
      if (n % 5 === 0) setWait(30);
    })();
  }, [pin]);
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--paper)] px-6 pb-[var(--safe-bottom)] pt-[var(--safe-top)]" role="dialog" aria-modal="true" aria-label="App bloqueado">
      <Logo size="md" />
      <p className="mt-8 text-[17px] font-extrabold tracking-[-0.02em]">{name ? `Olá, ${firstName(name)}` : 'Leco bloqueado'}</p>
      <p className="mt-1 text-[13px] text-ink/65">{wait ? `Muitas tentativas. Aguarde ${wait}s.` : 'Digite seu PIN para continuar'}</p>
      <div className="my-8"><PinDots n={pin.length} shake={shake} /></div>
      <PinPad value={pin} disabled={!!wait} onDigit={(k) => setPin((p) => (p.length < 4 ? p + k : p))} onBack={() => setPin((p) => p.slice(0, -1))} />
      <button type="button" className="mt-8 text-[13px] font-bold text-in" onClick={onForgot}>Esqueci o PIN (sair da conta)</button>
    </div>
  );
}

function PinSetupSheet({ onClose }) {
  const d = useApp();
  const titleId = cleanId(useId());
  const [step, setStep] = useState(0);
  const [first, setFirst] = useState('');
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (pin.length < 4) return;
    if (step === 0) { setFirst(pin); setPin(''); setStep(1); return; }
    if (pin !== first) { setShake(true); haptic('warn'); setTimeout(() => { setShake(false); setPin(''); setStep(0); setFirst(''); }, 450); return; }
    (async () => {
      const salt = uid();
      const prev = pinGet();
      pinSave({ salt, hash: await pinHash(pin, salt), timeout: prev ? prev.timeout : 60 });
      d.toast('PIN ativado'); haptic('success'); onClose();
    })();
  }, [pin]);
  return (
    <Sheet variant={sheetVariant()} onClose={onClose} titleId={titleId}>
      <SheetHead id={titleId} title={step === 0 ? 'Crie um PIN de 4 dígitos' : 'Repita o PIN'} sub={shake ? 'Os PINs não são iguais. Tente de novo.' : 'O PIN fica só neste aparelho.'} onClose={onClose} />
      <div className="my-6"><PinDots n={pin.length} shake={shake} /></div>
      <PinPad value={pin} onDigit={(k) => setPin((p) => (p.length < 4 ? p + k : p))} onBack={() => setPin((p) => p.slice(0, -1))} />
    </Sheet>
  );
}

// Controla quando o app fica bloqueado: ao abrir e ao voltar depois do tempo escolhido
function usePinLock() {
  const [locked, setLocked] = useState(() => !!pinGet());
  const hiddenAt = useRef(0);
  useEffect(() => {
    setSecureScreen(!!pinGet());
    const on = () => {
      const p = pinGet();
      if (!p) return;
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && (Date.now() - hiddenAt.current) / 1000 >= (p.timeout || 0)) setLocked(true);
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return [locked, setLocked];
}

function PinSettingsPanel() {
  const d = useApp();
  const [p, setP] = useState(pinGet());
  useEffect(() => { setP(pinGet()); }, [d.modal]);
  const setTimeoutVal = (v) => { const cur = pinGet(); if (cur) { pinSave({ ...cur, timeout: Number(v) }); setP(pinGet()); } };
  return (
    <Panel title="Bloqueio com PIN" sub={p ? 'Ativado neste aparelho. O app pede o PIN ao abrir.' : 'Proteja o app com um código de 4 dígitos. Vale só para este aparelho.'}>
      {p ? (
        <div className="mt-3 space-y-3">
          <Field label="Pedir o PIN" className="max-w-xs">
            <select id="pin-timeout" className="field" value={p.timeout || 0} onChange={(e) => setTimeoutVal(e.target.value)}>{PIN_TIMEOUTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => d.openModal({ kind: 'pin' })}><Icon name="key" size={16} />Trocar PIN</button>
            <button type="button" className="btn btn-ghost" onClick={() => { pinSave(null); setP(null); d.toast('PIN desativado'); }}><Icon name="x" size={16} />Desativar</button>
          </div>
          {NATIVE && <p className="text-xs text-ink/60">Com o PIN ativo, o conteúdo do app também fica oculto na tela de apps recentes.</p>}
        </div>
      ) : <button type="button" className="btn btn-primary mt-3" onClick={() => d.openModal({ kind: 'pin' })}><Icon name="lock" size={16} />Ativar PIN</button>}
    </Panel>
  );
}

/* ---------- Nova versão disponível (APK) ---------- */
const APP_BUILD = Number(window.LECO_BUILD || 0);
const APP_VERSION = window.LECO_VERSION || '';
// Procura versão nova no GitHub: ao abrir, ao voltar para o app (no máx. a cada 10 min) e quando o usuário pede
const UPDATE = { listeners: new Set(), info: null, at: 0, busy: false };
async function checkUpdate(force = false) {
  if (!NATIVE || !CFG.repo || UPDATE.busy) return UPDATE.info;
  if (!force && Date.now() - UPDATE.at < 10 * 60 * 1000) return UPDATE.info;
  UPDATE.busy = true;
  try {
    const r = await fetch(`https://api.github.com/repos/${CFG.repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (r.ok) {
      const rel = await r.json();
      const m = String(rel.tag_name || '').match(/^v?([\d.]+)-build(\d+)$/);
      const apk = (rel.assets || []).find((a) => /\.apk$/i.test(a.name));
      const v = m && apk ? { version: m[1], build: Number(m[2]), url: apk.browser_download_url, page: rel.html_url } : null;
      UPDATE.info = v && v.build > APP_BUILD ? v : null;
      UPDATE.at = Date.now();
      UPDATE.listeners.forEach((fn) => fn(UPDATE.info));
    }
  } catch (e) { /* sem internet: tenta de novo depois */ }
  UPDATE.busy = false;
  return UPDATE.info;
}
function useUpdateCheck() {
  const [info, setInfo] = useState(UPDATE.info);
  useEffect(() => {
    UPDATE.listeners.add(setInfo);
    checkUpdate();
    const on = () => { if (document.visibilityState === 'visible') checkUpdate(); };
    document.addEventListener('visibilitychange', on);
    return () => { UPDATE.listeners.delete(setInfo); document.removeEventListener('visibilitychange', on); };
  }, []);
  return info;
}
function openUpdate(info) {
  if (Native.Browser) Native.Browser.open({ url: info.url }).catch(() => window.open(info.url, '_blank'));
  else window.open(info.url, '_blank');
}
function UpdateBanner() {
  const info = useUpdateCheck();
  const [hidden, setHidden] = useLocal('leco.updateHidden', '');
  if (!info || hidden === info.version + info.build) return null;
  return (
    <div className="glass-hero rise mb-4 flex items-center gap-3 rounded-2xl px-4 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15"><Icon name="rocket" size={20} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold">Nova versão disponível</p>
        <p className="truncate text-xs text-ink/80">Leco {info.version} · instala por cima, sem perder nada</p>
      </div>
      <button type="button" className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-extrabold text-[var(--color-noite)]" onClick={() => openUpdate(info)}>Baixar</button>
      <button type="button" aria-label="Agora não" className="shrink-0 text-ink/70" onClick={() => setHidden(info.version + info.build)}><Icon name="x" size={16} /></button>
    </div>
  );
}

/* ---------- Dica na primeira visita de cada tela ---------- */
const PAGE_TIPS = {
  inicio: 'Este é o seu resumo. Toque no + para lançar, ou em "Rápido" para escrever como numa mensagem. Personalize os blocos em Configurações › Personalizar.',
  transacoes: 'No celular, arraste um lançamento para a esquerda para excluir ou para a direita para marcar como pago. Use Filtros e Gerar PDF no topo.',
  calendario: 'Tudo o que tem data aparece aqui: contas, faturas, recorrências e metas. Toque num dia para ver o que vence. Deslize para trocar de mês. Para lançar, use o botão +.',
  relatorios: 'Escolha o período e veja para onde foi o dinheiro. Gere um PDF ou planilha para guardar ou enviar.',
  planejamento: 'Defina quanto quer gastar em cada categoria no mês e acompanhe planejado × realizado, a projeção do saldo e sua reserva.',
  dividas: 'Cadastre empréstimos, financiamentos ou dinheiro emprestado. Registre os pagamentos e acompanhe quanto falta.',
  contas: 'Toque numa conta para editar. Use "Ajustar saldo" quando o valor do Leco estiver diferente do banco.',
};
function PageTip({ id }) {
  const [seen, setSeen] = useLocal('leco.tips', []);
  const text = PAGE_TIPS[id];
  if (!text || seen.includes(id)) return null;
  return (
    <div className="rise mb-4 flex items-start gap-3 rounded-2xl border border-ouro/40 bg-ouro/10 px-4 py-3" role="note">
      <Icon name="sparkle" size={18} className="mt-0.5 shrink-0 text-in" />
      <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink/85">{text}</p>
      <button type="button" className="shrink-0 text-xs font-bold text-in" onClick={() => setSeen([...seen, id])}>Entendi</button>
    </div>
  );
}
