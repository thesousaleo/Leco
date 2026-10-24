/* =====================================================================
   05-prefs: preferências de aparência e de uso (tema, cor, texto, mês financeiro,
   início, menu), vibração e utilidades compartilhadas.
   ===================================================================== */
const ACCENTS = {
  esmeralda: { label: 'Esmeralda', vivo: '#14806B', leco: '#0F5C4D', noite: '#0B2F29', hi: '#34C39B' },
  oceano: { label: 'Oceano', vivo: '#1A7FA3', leco: '#13607D', noite: '#0B2E3D', hi: '#4CC3E6' },
  ametista: { label: 'Ametista', vivo: '#7556C2', leco: '#56409A', noite: '#251A45', hi: '#A98BF0' },
  coral: { label: 'Coral', vivo: '#D0603F', leco: '#A84A2F', noite: '#3D1B11', hi: '#F29A7C' },
  grafite: { label: 'Grafite', vivo: '#4A5866', leco: '#33404C', noite: '#161C22', hi: '#8FA3B5' },
  rosa: { label: 'Rosa', vivo: '#C2507E', leco: '#9A3A61', noite: '#3A1526', hi: '#EE8DB4' },
};

const HOME_BLOCKS = [
  { id: 'resumo', label: 'Resumo do mês' },
  { id: 'atalhos', label: 'Atalhos' },
  { id: 'semana', label: 'Próximos 7 dias' },
  { id: 'apagar', label: 'A pagar e a receber' },
  { id: 'orcamento', label: 'Orçamento do mês' },
  { id: 'metas', label: 'Metas' },
  { id: 'ultimas', label: 'Últimas transações' },
];
const NAV_CHOICES = [
  { id: 'transacoes', label: 'Extrato', icon: 'list' },
  { id: 'calendario', label: 'Calendário', icon: 'calendar' },
  { id: 'relatorios', label: 'Análises', icon: 'pie' },
  { id: 'planejamento', label: 'Planejar', icon: 'layers' },
  { id: 'contas', label: 'Contas', icon: 'card' },
  { id: 'metas', label: 'Metas', icon: 'target' },
  { id: 'dividas', label: 'Dívidas', icon: 'scale' },
];

const DEFAULT_PREFS = {
  theme: null, // 'light' | 'dark' | 'black' | 'auto' (null = usa o tema do perfil)
  accent: 'esmeralda',
  fontScale: 1,
  contrast: false,
  monthStart: 1,
  weekStart: 0,
  home: HOME_BLOCKS.map((b) => ({ id: b.id, on: !['semana', 'orcamento', 'metas'].includes(b.id) })),
  tabs: ['transacoes', 'calendario', 'relatorios'],
  haptics: true,
  autoDarkFrom: 19,
  autoDarkTo: 6,
};

function mergePrefs(saved) {
  const p = { ...DEFAULT_PREFS, ...(saved || {}) };
  // garante todos os blocos do início, mesmo os criados depois
  const known = (Array.isArray(p.home) ? p.home : []).filter((b) => HOME_BLOCKS.some((h) => h.id === b.id));
  HOME_BLOCKS.forEach((h) => { if (!known.some((b) => b.id === h.id)) known.push({ id: h.id, on: false }); });
  p.home = known;
  p.tabs = (Array.isArray(p.tabs) ? p.tabs : DEFAULT_PREFS.tabs).filter((t) => NAV_CHOICES.some((n) => n.id === t)).slice(0, 3);
  while (p.tabs.length < 3) { const next = NAV_CHOICES.find((n) => !p.tabs.includes(n.id)); p.tabs.push(next.id); }
  if (!ACCENTS[p.accent]) p.accent = 'esmeralda';
  p.monthStart = Math.min(28, Math.max(1, Number(p.monthStart) || 1));
  return p;
}

// Tema efetivo: claro, escuro ou preto (o automático segue o horário)
function resolveTheme(mode, prefs) {
  if (mode === 'auto') {
    const h = new Date().getHours();
    const from = prefs.autoDarkFrom, to = prefs.autoDarkTo;
    const dark = from > to ? h >= from || h < to : h >= from && h < to;
    return dark ? 'dark' : 'light';
  }
  return mode === 'dark' || mode === 'black' ? mode : 'light';
}

function applyAppearance(prefs, theme) {
  const root = document.documentElement;
  root.dataset.leco = theme === 'black' ? 'dark' : theme;
  root.dataset.black = theme === 'black' ? '1' : '0';
  root.dataset.contrast = prefs.contrast ? '1' : '0';
  const a = ACCENTS[prefs.accent] || ACCENTS.esmeralda;
  const st = root.style;
  if (prefs.accent && prefs.accent !== 'esmeralda') {
    st.setProperty('--color-vivo', a.vivo); st.setProperty('--color-leco', a.leco); st.setProperty('--color-noite', a.noite); st.setProperty('--color-vivo-hi', a.hi);
    st.setProperty('--accent-rgb', hexRgb(a.vivo));
  } else {
    ['--color-vivo', '--color-leco', '--color-noite', '--color-vivo-hi', '--accent-rgb'].forEach((k) => st.removeProperty(k));
  }
  document.body.style.zoom = prefs.fontScale && prefs.fontScale !== 1 ? String(prefs.fontScale) : '';
  try { if (window.LecoAndroid) window.LecoAndroid.setDarkBars(theme !== 'light'); } catch (e) { /* sem ponte nativa */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'black' ? '#000000' : theme === 'dark' ? '#0B2F29' : '#FFFFFF');
}
const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`; };

/* ---------- Mês financeiro (pode começar em outro dia, ex.: dia do salário) ---------- */
const FIN = { start: 1, weekStart: 0 };
const finStartOf = (k) => dayIn(k, FIN.start);
// Intervalo do "mês" k: do dia de início até a véspera do início do mês seguinte
const finRange = (k) => (FIN.start === 1 ? [`${k}-01`, dayIn(k, 31)] : [finStartOf(k), addDays(finStartOf(shiftMonth(k, 1)), -1)]);
const finMonthOf = (iso) => (FIN.start === 1 || Number(iso.slice(8, 10)) >= Math.min(FIN.start, daysIn(iso.slice(0, 7))) ? monthKey(iso) : shiftMonth(monthKey(iso), -1));
const finLabel = (k) => (FIN.start === 1 ? monthLabel(k) : `${monthLabel(k)} (${fmtDate(finRange(k)[0]).slice(0, 5)} a ${fmtDate(finRange(k)[1]).slice(0, 5)})`);

/* ---------- Vibração leve ---------- */
const HAPTIC = { on: true };
function haptic(kind = 'light') {
  if (!HAPTIC.on) return;
  try {
    if (Native.Haptics) {
      if (kind === 'success') Native.Haptics.notification({ type: 'SUCCESS' });
      else if (kind === 'warn') Native.Haptics.notification({ type: 'WARNING' });
      else Native.Haptics.impact({ style: kind === 'heavy' ? 'MEDIUM' : 'LIGHT' });
    } else if (navigator.vibrate && LITE) navigator.vibrate(kind === 'success' ? [12, 40, 12] : 10);
  } catch (e) { /* sem vibração */ }
}

/* ---------- Ícone ou emoji ---------- */
const isEmoji = (s) => !!s && !ICONS[s] && /\p{Extended_Pictographic}/u.test(s);

/* ---------- Texto normalizado para buscas ---------- */
const normTxt = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- Moedas para lançamentos em viagem ---------- */
const CURRENCIES = [
  ['USD', 'Dólar americano', 'US$'], ['EUR', 'Euro', '€'], ['GBP', 'Libra', '£'], ['ARS', 'Peso argentino', 'AR$'],
  ['CLP', 'Peso chileno', 'CL$'], ['UYU', 'Peso uruguaio', 'UY$'], ['PYG', 'Guarani', '₲'], ['MXN', 'Peso mexicano', 'MX$'],
  ['CAD', 'Dólar canadense', 'C$'], ['JPY', 'Iene', '¥'], ['CHF', 'Franco suíço', 'CHF'], ['AUD', 'Dólar australiano', 'A$'],
];
const fmtForeign = (cents, cur) => { try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: cur }).format(cents / 100); } catch (e) { return `${cur} ${(cents / 100).toFixed(2)}`; } };
