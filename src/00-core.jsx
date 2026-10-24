/* =====================================================================
   LECO · Controle Financeiro
   React + Tailwind CSS · Liquid Glass (Esmeralda & Ouro) · Supabase
   Os ficheiros src/*.jsx são juntados em ordem pelo scripts/build-web.mjs.
   00-core: utilidades, ícones, logótipo, componentes de interface e gráficos.
   ===================================================================== */
const { useState, useMemo, useEffect, useRef, useLayoutEffect, useCallback, useId, useContext, createContext } = React;

const CFG = window.LECO_CONFIG || {};
const NATIVE = !!window.LECO_NATIVE;
const Native = window.LecoNative || {};
// Modo leve para celulares: sem desfoque de fundo nem bolhas animadas (pesados no Android), animações só com transform/opacity
const LITE = NATIVE || !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
if (LITE) document.documentElement.dataset.perf = 'lite';

/* ------------------------------------------------------------------ */
/* Formatação e datas                                                  */
/* ------------------------------------------------------------------ */
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtBRL = (cents) => BRL.format((cents || 0) / 100);
const fmtDate = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const pad2 = (n) => String(n).padStart(2, '0');
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const monthKey = (iso) => iso.slice(0, 7);
const monthName = (k) => MONTHS[Number(k.slice(5, 7)) - 1];
const monthShort = (k) => MONTHS_SHORT[Number(k.slice(5, 7)) - 1];
const monthLabel = (k) => `${monthName(k)} ${k.slice(0, 4)}`;
const shiftMonth = (k, delta) => {
  let y = Number(k.slice(0, 4));
  let m = Number(k.slice(5, 7)) - 1 + delta;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return `${y}-${pad2(m + 1)}`;
};
const daysIn = (k) => new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)), 0).getDate();
const dayIn = (k, day) => `${k}-${pad2(Math.min(day, daysIn(k)))}`;
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return isoOf(d); };
const addMonthsISO = (iso, n) => dayIn(shiftMonth(monthKey(iso), n), Number(iso.slice(8, 10)));
const diffDays = (a, b) => Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000);
const fmtAxis = (cents) => {
  const r = cents / 100;
  if (Math.abs(r) >= 1e6) return `${(r / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(r) >= 1000) return `${(r / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return String(Math.round(r));
};
// Rótulos do eixo: se ficarem repetidos (valores muito próximos), mostra mais detalhe
const axisLabels = (ticks) => {
  const a = ticks.map(fmtAxis);
  if (new Set(a).size === a.length) return a;
  return ticks.map((t) => (Math.abs(t) >= 100000 ? `${Math.round(t / 100000).toLocaleString('pt-BR')} mil` : fmtBRL(t).replace(/,00$/, '')));
};
const fmtPctAbs = (v, unit = '%') => `${Math.abs(v).toFixed(1).replace('.', ',')}${unit}`;
const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const firstName = (n) => (n || '').trim().split(/\s+/)[0] || '';
const relDay = (iso, today = todayISO()) => {
  const d = diffDays(iso, today);
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanhã';
  if (d === -1) return 'ontem';
  if (d > 1 && d <= 7) return `em ${d} dias`;
  if (d < -1 && d >= -30) return `há ${-d} dias`;
  return fmtDate(iso);
};
const reducedMotion = () => {
  try { return document.documentElement.dataset.calm === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
};
const cleanId = (id) => id.replace(/[^a-zA-Z0-9_-]/g, '');
const mixHex = (hex, to, t) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};
const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const sum = (list, f = (x) => x) => list.reduce((a, x) => a + f(x), 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const SWATCHES = ['#14806B', '#0F5C4D', '#34C39B', '#6B9E8F', '#E8A317', '#B8865B', '#F08A6B', '#D9644A', '#5E8CA6', '#8C7AB8', '#7A8B3F', '#C46B8F'];
const ICON_CHOICES = ['home', 'utensils', 'car', 'film', 'heart', 'repeat', 'book', 'bag', 'paw', 'plane', 'gift', 'zap', 'coffee', 'game', 'dumbbell', 'tag', 'briefcase', 'trend', 'laptop', 'wallet'];
const PALETTES = {
  light: { in: '#14806B', out: '#E0714F', gold: '#D99510', axis: 'rgba(11,47,41,.58)', grid: 'rgba(11,47,41,.08)', dot: '#FFFFFF', band: 'rgba(11,47,41,.04)', track: 'rgba(11,47,41,.07)' },
  dark: { in: '#34C39B', out: '#F08A6B', gold: '#E8A317', axis: 'rgba(228,239,234,.62)', grid: 'rgba(228,239,234,.08)', dot: '#0B2F29', band: 'rgba(228,239,234,.05)', track: 'rgba(228,239,234,.07)' },
};

/* ------------------------------------------------------------------ */
/* Contextos e hooks                                                   */
/* ------------------------------------------------------------------ */
const ThemeCtx = createContext('light');
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);
const NarrowCtx = createContext(false);
const useNarrow = () => useContext(NarrowCtx);

function useLocal(key, initial) {
  const [v, setV] = useState(() => {
    try { const raw = window.localStorage.getItem(key); if (raw != null) return JSON.parse(raw); } catch (e) { /* sem armazenamento */ }
    return initial;
  });
  useEffect(() => { try { window.localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignora */ } }, [key, v]);
  return [v, setV];
}

function useTween(target, ms = 650) {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (cur.current === target) return undefined;
    if (reducedMotion()) { cur.current = target; setV(target); return undefined; }
    const from = cur.current, t0 = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      cur.current = p < 1 ? from + (target - from) * e : target;
      setV(cur.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function useWidth(ref) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}

function useViewport() {
  const [v, setV] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setV({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return v;
}

/* ------------------------------------------------------------------ */
/* Ícones                                                              */
/* ------------------------------------------------------------------ */
const ICONS = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  list: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9.5 8h5M9.5 12h5" /></>,
  pie: <><path d="M21 12a9 9 0 1 1-9-9" /><path d="M12 3v9h9" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></>,
  grid: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></>,
  settings: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><path d="M4 4l16 16" /></>,
  up: <path d="M7 17L17 7M8 7h9v9" />,
  down: <path d="M7 7l10 10M17 8v9H8" />,
  inArrow: <path d="M17 7L7 17M16 17H7V8" />,
  swap: <><path d="M4 8h14l-4-4" /><path d="M20 16H6l4 4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20.5 20.5l-4.2-4.2" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  scale: <><path d="M12 3v18M7 21h10M5 7h14" /><path d="M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></>,
  clip: <path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.1-8.1a3.3 3.3 0 0 1 4.7 4.7l-8.1 8.1a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4" />,
  hash: <path d="M5 9h15M4 15h15M10 3 8 21M16 3l-2 18" />,
  split: <><path d="M12 21v-7l-6-6M12 14l6-6" /><path d="M3 5V3h2M21 5V3h-2M6 8V3M18 8V3" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a2 2 0 0 0 0 4h3M16 6h3a2 2 0 0 1 0 4h-3M12 13v4M8 21h8M9.5 17h5" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6V14M12 17h.01" /></>,
  filter: <path d="M4 5h16l-6 8v5l-4 2v-7z" />,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-9 9" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  chevUp: <path d="M6 15l6-6 6 6" />,
  chevDown: <path d="M6 9l6 6 6-6" />,
  textSize: <><path d="M4 7V5h10v2M9 5v14M7 19h4" /><path d="M14 12v-1.5h7V12M17.5 10.5V19M16 19h3" /></>,
  contrast: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" /></>,
  whatsapp: <><path d="M20.5 11.6a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.6z" /><path d="M8.8 8.6c.3-.6.6-.6.9-.6h.5c.2 0 .4 0 .6.5l.7 1.6c.1.2.1.4 0 .6l-.5.6c-.1.2-.2.3 0 .6.6 1 1.4 1.8 2.5 2.4.3.2.4.1.6-.1l.6-.7c.2-.2.3-.2.6-.1l1.6.8c.2.1.4.2.4.4 0 .5-.2 1.2-.8 1.5-.7.4-1.6.5-3.4-.3-2.3-1-3.8-3.4-3.9-3.6-.2-.2-.9-1.2-.9-2.3 0-.9.3-1.4.5-1.7z" fill="currentColor" stroke="none" /></>,
  rocket: <><path d="M12 15l-3-3c1-4 4-8 10-9-1 6-5 9-9 10z" /><path d="M9 12l-4 .5L3 15l4 1M12 15l-.5 4L9 21l-1-4M15.5 8.5h.01" /></>,
  chat: <><path d="M20.5 11.6a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.6z" /><path d="M8.5 10.5h7M8.5 13.5h4.5" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  utensils: <><path d="M5 3v7a2 2 0 0 0 4 0V3M7 3v18" /><path d="M17 21V3c-2.5 1.5-3.5 4.5-3.5 8H17" /></>,
  car: <><path d="M5 12l1.6-4.6A2 2 0 0 1 8.5 6h7a2 2 0 0 1 1.9 1.4L19 12" /><path d="M3 12h18v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M6.5 18v2M17.5 18v2M7 15h1M16 15h1" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>,
  trend: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  film: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10 9.5v5l4.5-2.5z" /></>,
  heart: <path d="M12 20.5s-8-4.8-8-10.7A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.8c0 5.9-8 10.7-8 10.7z" />,
  repeat: <><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>,
  laptop: <><rect x="4.5" y="5" width="15" height="10.5" rx="1.5" /><path d="M2.5 19.5h19" /></>,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3.5" /><path d="M4 7.5V17a2 2 0 0 0 2 2h14V8.5H6.5A2.5 2.5 0 0 1 4 7.5z" /><path d="M16 13.8h1.8" /></>,
  bank: <><path d="M3 9.5L12 4l9 5.5" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></>,
  piggy: <><path d="M5 11a7 6 0 0 1 12.5-3.5L20 6v4l1 1v3h-2a7 6 0 0 1-3 3v3h-3v-2h-3v2H7v-3.5A6 6 0 0 1 5 11z" /><circle cx="15.5" cy="10.5" r=".8" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /></>,
  shield: <><path d="M12 3l8 3v5.5c0 4.6-3.2 7.8-8 9.5-4.8-1.7-8-4.9-8-9.5V6z" /><path d="M8.8 12l2.4 2.4 4-4.4" /></>,
  book: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></>,
  bag: <><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  paw: <><path d="M12 13c-2.8 0-5 2.6-5 5 0 1.4 1 2 2.2 2s1.7-.7 2.8-.7 1.6.7 2.8.7 2.2-.6 2.2-2c0-2.4-2.2-5-5-5z" /><circle cx="6" cy="10" r="1.7" /><circle cx="9.5" cy="6" r="1.7" /><circle cx="14.5" cy="6" r="1.7" /><circle cx="18" cy="10" r="1.7" /></>,
  plane: <><path d="M3 13l18-8-6 16-3-6z" /><path d="M12 15l9-10" /></>,
  gift: <><rect x="3" y="8" width="18" height="5" rx="1" /><path d="M5 13v8h14v-8M12 8v13" /><path d="M12 8c-2-3-6-3-6-.5S10 8 12 8zm0 0c2-3 6-3 6-.5S14 8 12 8z" /></>,
  zap: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  coffee: <><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3" /></>,
  game: <><rect x="2.5" y="7" width="19" height="11" rx="5" /><path d="M7.5 11v3M6 12.5h3M15.5 12h.01M18 14h.01" /></>,
  dumbbell: <path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12" />,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M15 8l2 2" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.8 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7.5" r="1" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  alert: <><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17.5h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" /><path d="M4 3v5h5" /><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" /><path d="M20 21v-5h-5" /></>,
  download: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 19h16" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10h14V9M10 13h4" /></>,
  chart: <><path d="M4 20h16" /><path d="M7 16v-5M12 16V6M17 16v-8" /></>,
  google: <><path d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5c-.2 1.2-.9 2.2-1.9 2.8v2.4h3.1c1.8-1.7 2.8-4.1 2.8-6.9z" fill="#4285F4" stroke="none" /><path d="M12 21.5c2.6 0 4.7-.9 6.3-2.3l-3.1-2.4c-.9.6-2 .9-3.2.9-2.5 0-4.6-1.7-5.3-3.9H3.5v2.5A9.5 9.5 0 0 0 12 21.5z" fill="#34A853" stroke="none" /><path d="M6.7 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.7H3.5a9.5 9.5 0 0 0 0 8.6z" fill="#FBBC05" stroke="none" /><path d="M12 6.3c1.4 0 2.6.5 3.6 1.4l2.7-2.7A9.5 9.5 0 0 0 3.5 7.7l3.2 2.5C7.4 8 9.5 6.3 12 6.3z" fill="#EA4335" stroke="none" /></>,
};

function Icon({ name, size = 20, className = '', strokeWidth = 1.8 }) {
  // Emojis escolhidos pelo usuário (categorias, contas) aparecem como texto
  if (name && !ICONS[name] && /\p{Extended_Pictographic}/u.test(name)) {
    return <span className={`inline-grid place-items-center leading-none ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.92) }} aria-hidden="true">{name}</span>;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name] || ICONS.tag}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Logótipo                                                            */
/* ------------------------------------------------------------------ */
function LogoMark({ size = 40, onDark = false }) {
  const theme = useContext(ThemeCtx);
  const id = cleanId(useId());
  const light = theme === 'light' && !onDark;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light ? '#14806B' : '#F7F5EF'} />
          <stop offset="1" stopColor={light ? '#0B2F29' : '#A9DCCB'} />
        </linearGradient>
        <radialGradient id={`${id}c`} cx=".34" cy=".3" r=".85">
          <stop offset="0" stopColor="#FFDB7E" />
          <stop offset=".55" stopColor="#E8A317" />
          <stop offset="1" stopColor="#B57406" />
        </radialGradient>
      </defs>
      <path d="M10 6h9v27h21v9H10z" fill={`url(#${id}l)`} stroke={`url(#${id}l)`} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="31" cy="22.5" r="9.5" fill={`url(#${id}c)`} />
      <circle cx="31" cy="22.5" r="6.3" fill="none" stroke="#9A6205" strokeOpacity=".55" strokeWidth="1.3" />
      <path d="M26.6 18.6a6 6 0 0 1 4-2.3" fill="none" stroke="#FFF3CF" strokeOpacity=".85" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function Logo({ size = 'md', tagline = true }) {
  const cfg = { sm: { mark: 30, text: 'text-[22px]', tag: 'text-[8.5px]' }, md: { mark: 40, text: 'text-[29px]', tag: 'text-[9px]' }, lg: { mark: 56, text: 'text-[40px]', tag: 'text-[10.5px]' } }[size];
  return (
    <div className="flex items-center gap-3" aria-label="Leco, controle financeiro" role="img">
      <LogoMark size={cfg.mark} />
      <div className="leading-none">
        <div className={`font-extrabold tracking-[-0.02em] text-ink ${cfg.text}`}>Lec<span className="text-ouro">o</span></div>
        {tagline && <div className={`mt-1.5 font-medium uppercase tracking-widest text-ink/65 ${cfg.tag}`}>Controle financeiro</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Peças de interface                                                  */
/* ------------------------------------------------------------------ */
function Atmosphere() {
  return (
    <div className="atmos-base pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="atmos-blobs absolute inset-0">
        <div className="blob -left-40 -top-48 h-[560px] w-[560px] bg-vivo opacity-55" />
        <div className="blob blob-slow right-[-14%] top-[26%] h-[660px] w-[660px] bg-leco opacity-70" style={{ animationDelay: '-9s' }} />
        <div className="blob left-[40%] top-[6%] h-[230px] w-[230px] bg-ouro opacity-[.35]" style={{ animationDelay: '-4s' }} />
        <div className="blob blob-slow bottom-[-14%] left-[8%] h-[480px] w-[480px] bg-vivo-hi opacity-40" style={{ animationDelay: '-15s' }} />
      </div>
    </div>
  );
}

function Segmented({ options, value, onChange, size = 'md', label, full = false }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const n = options.length;
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-[13px]';
  return (
    <div role="radiogroup" aria-label={label}
      className={`relative grid rounded-full border border-ink/10 bg-ink/[0.05] p-1 ${full ? 'w-full' : ''}`}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      <span aria-hidden="true"
        className="absolute bottom-1 left-1 top-1 rounded-full border border-white/25 bg-gradient-to-br from-vivo to-leco shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_6px_16px_-6px_rgba(20,128,107,.9)] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ width: `calc((100% - 8px) / ${n})`, transform: `translateX(${idx * 100}%)` }} />
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`relative z-10 flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors ${pad} ${o.value === value ? 'text-white' : 'text-ink/70 hover:text-ink'}`}>
          {o.icon && <Icon name={o.icon} size={size === 'sm' ? 14 : 16} />}
          <span className="truncate">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label, desc, id, icon, disabled }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-ink/[0.06] text-ink"><Icon name={icon} size={17} /></span>}
        <div className="min-w-0">
          <p id={`${id}-l`} className="text-sm font-semibold">{label}</p>
          {desc && <p className="mt-0.5 text-xs leading-relaxed text-ink/65">{desc}</p>}
        </div>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-l`} disabled={disabled} onClick={() => onChange(!checked)} className={`switch ${checked ? 'on' : ''} disabled:opacity-40`}>
        <span />
      </button>
    </div>
  );
}

function Delta({ value, goodWhen = 'up', unit = '%' }) {
  if (value == null || !isFinite(value)) return null;
  const up = value >= 0;
  const good = goodWhen === 'up' ? up : !up;
  return (
    <span className={`pill ${good ? 'pill-good' : 'pill-bad'}`}>
      <Icon name={up ? 'up' : 'down'} size={12} strokeWidth={2.4} />
      {up ? '+' : '−'}{fmtPctAbs(value, unit)}
    </span>
  );
}

function useMoneyText() {
  const app = useApp();
  const hide = app && app.hide;
  return (cents) => (hide ? 'R$ ••••' : fmtBRL(cents));
}
function Money({ cents, className = '' }) {
  const app = useApp();
  const v = useTween(cents);
  return <span className={`tabular-nums ${className}`}>{app && app.hide ? 'R$ ••••••' : fmtBRL(Math.round(v))}</span>;
}
function Percent({ value, className = '' }) {
  const v = useTween(value);
  return <span className={`tabular-nums ${className}`}>{v.toFixed(1).replace('.', ',')}%</span>;
}

function ColorIcon({ icon, color, size = 40, round = false }) {
  const theme = useContext(ThemeCtx);
  const c = color || '#6B9E8F';
  const fg = theme === 'light' ? mixHex(c, '#0B2F29', 0.18) : c;
  return (
    <span className={`grid shrink-0 place-items-center ${round ? 'rounded-full' : 'rounded-2xl'}`}
      style={{ width: size, height: size, background: `${c}22`, color: fg, boxShadow: `inset 0 0 0 1px ${c}38` }}>
      <Icon name={icon} size={Math.round(size * 0.47)} />
    </span>
  );
}

function MonthSwitch({ month, onChange, compact = false, min, max, full = false }) {
  return (
    <div className={`${full ? 'flex w-full justify-between' : 'inline-flex'} items-center gap-1 rounded-full border border-ink/10 bg-ink/[0.04] p-1 backdrop-blur-xl`}>
      <button type="button" className="icon-btn size-8 border-transparent bg-transparent" aria-label="Mês anterior" disabled={min && month <= min} onClick={() => onChange(shiftMonth(month, -1))}>
        <Icon name="left" size={16} />
      </button>
      <span aria-live="polite" className={`text-center text-[13px] font-bold tabular-nums ${full ? 'min-w-0 flex-1' : compact ? 'min-w-[112px]' : 'min-w-[138px]'}`}>{monthLabel(month)}</span>
      <button type="button" className="icon-btn size-8 border-transparent bg-transparent" aria-label="Próximo mês" disabled={max && month >= max} onClick={() => onChange(shiftMonth(month, 1))}>
        <Icon name="right" size={16} />
      </button>
    </div>
  );
}

function Card({ title, sub, action, children, className = '', delay = 0 }) {
  return (
    <section className={`glass spec rise min-w-0 p-5 sm:p-6 ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-extrabold tracking-[-0.02em]">{title}</h2>}
            {sub && <p className="mt-0.5 text-xs text-ink/65">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function PageHeader({ eyebrow, title, children }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 px-1 pt-1">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-medium text-ink/70">{eyebrow}</p>}
        <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[32px]">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </header>
  );
}

function Panel({ title, sub, children, tone, action }) {
  return (
    <div className={`min-w-0 rounded-3xl border p-5 ${tone === 'danger' ? 'border-coral/30 bg-coral/[0.06]' : 'border-ink/[0.08] bg-ink/[0.02]'}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <p className="text-[15px] font-extrabold tracking-[-0.02em]">{title}</p>}
            {sub && <p className="mt-0.5 text-xs leading-relaxed text-ink/65">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// Ilustração vetorial de vidro para telas vazias (ícone flutuando sobre um disco translúcido e uma moeda)
function EmptyArt({ icon }) {
  const id = cleanId(useId());
  return (
    <div className="empty-art relative mx-auto h-[112px] w-[150px]" aria-hidden="true">
      <svg viewBox="0 0 150 112" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id={`ea${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--color-vivo-hi)', stopOpacity: 0.42 }} />
            <stop offset="1" style={{ stopColor: 'var(--color-leco)', stopOpacity: 0.12 }} />
          </linearGradient>
          <linearGradient id={`eb${id}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.18" />
          </linearGradient>
          <radialGradient id={`ec${id}`} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#FFE29A" /><stop offset="0.55" stopColor="#E8A317" /><stop offset="1" stopColor="#B57E0C" />
          </radialGradient>
        </defs>
        <ellipse cx="75" cy="104" rx="42" ry="5" style={{ fill: 'var(--ink)' }} opacity="0.08" />
        <circle cx="75" cy="54" r="44" fill={`url(#ea${id})`} />
        <circle cx="75" cy="54" r="44" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" />
        <g className="float">
          <rect x="47" y="27" width="56" height="54" rx="17" fill={`url(#eb${id})`} fillOpacity="0.55" stroke="#FFFFFF" strokeOpacity="0.75" />
          <path d="M55 33 q10 -4 22 -2" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
        <g className="float-2">
          <circle cx="118" cy="27" r="10" fill={`url(#ec${id})`} />
          <circle cx="118" cy="27" r="6.5" fill="none" stroke="#FFF3CF" strokeOpacity="0.8" />
        </g>
        <circle cx="28" cy="78" r="5" style={{ fill: 'var(--color-vivo)' }} opacity="0.35" />
        <circle cx="126" cy="80" r="3" style={{ fill: 'var(--color-vivo-hi)' }} opacity="0.5" />
        <circle cx="34" cy="26" r="2.5" style={{ fill: 'var(--color-ouro)' }} opacity="0.6" />
      </svg>
      <span className="float absolute inset-x-0 top-0 grid h-[108px] place-items-center text-vivo"><Icon name={icon} size={26} strokeWidth={2.2} /></span>
    </div>
  );
}

function EmptyState({ icon = 'sparkle', title, text, action }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-ink/12 bg-ink/[0.015] px-5 py-8 text-center">
      <EmptyArt icon={icon} />
      <p className="mt-2 text-[15px] font-extrabold tracking-[-0.02em]">{title}</p>
      {text && <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink/65">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function MoneyInput({ id, cents, onChange, className = '', invalid, label }) {
  return (
    <input id={id} inputMode="numeric" autoComplete="off" aria-label={label} value={BRL.format((cents || 0) / 100)} aria-invalid={!!invalid}
      onChange={(e) => onChange(parseInt(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12) || '0', 10))}
      className={`field tabular-nums ${className}`} />
  );
}

function Field({ label, children, hint, error, className = '' }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="lbl">{label}</span>
      <div className="mt-2">{children}</div>
      {(error || hint) && <span className={`mt-1.5 block text-xs ${error ? 'font-semibold text-out' : 'text-ink/65'}`}>{error || hint}</span>}
    </label>
  );
}

function Spinner({ size = 18 }) {
  return <span className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent" style={{ width: size, height: size }} aria-hidden="true" />;
}

function SubmitButton({ busy, children, className = '', ...rest }) {
  return (
    <button type="submit" disabled={busy} className={`btn btn-primary ${className}`} {...rest}>
      {busy ? <Spinner size={16} /> : null}{children}
    </button>
  );
}

function ErrorNote({ children }) {
  if (!children) return null;
  return <p role="alert" className="flex items-start gap-2 rounded-2xl bg-coral/10 px-3.5 py-2.5 text-[13px] font-semibold text-out"><Icon name="alert" size={16} className="mt-0.5 shrink-0" />{children}</p>;
}

/* ------------------------------------------------------------------ */
/* Folha / diálogo e aviso                                             */
/* ------------------------------------------------------------------ */
function Sheet({ variant, onClose, titleId, onSubmit, children, wide = false }) {
  const sheet = variant === 'sheet';
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const Tag = onSubmit ? 'form' : 'div';
  const panel = useRef(null);
  const drag = useRef(null);
  const dragStart = (e) => { if (!sheet) return; drag.current = { y: e.clientY, dy: 0 }; e.currentTarget.setPointerCapture(e.pointerId); if (panel.current) panel.current.style.transition = 'none'; };
  const dragMove = (e) => { if (!drag.current || !panel.current) return; drag.current.dy = Math.max(0, e.clientY - drag.current.y); panel.current.style.transform = `translate3d(0,${drag.current.dy}px,0)`; };
  const dragEnd = () => {
    if (!drag.current || !panel.current) return;
    const { dy } = drag.current; drag.current = null;
    if (dy > 110) { const el = panel.current; el.style.animation = 'none'; el.style.transition = 'transform .22s cubic-bezier(.4,0,1,1)'; el.style.transform = 'translate3d(0,100%,0)'; onClose(); return; }
    panel.current.style.transition = 'transform .3s cubic-bezier(.32,.72,0,1)'; panel.current.style.transform = '';
  };
  return (
    <div className={`fixed overlay-in inset-0 z-[70] flex backdrop-blur-md ${sheet ? 'items-end' : 'items-center justify-center p-4'}`}
      style={{ background: 'var(--scrim)' }} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Tag ref={panel} onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby={titleId} noValidate
        className={`glass-deep no-scrollbar w-full overflow-y-auto ${sheet ? 'sheet-in max-h-[92%] rounded-b-none rounded-t-[32px] p-5 pb-[calc(28px+var(--safe-bottom))]' : `dialog-in max-h-[calc(100dvh-32px)] p-6 sm:p-7 ${wide ? 'max-w-[600px]' : 'max-w-[500px]'}`}`}>
        {sheet && <div className="-mx-5 -mt-5 mb-2 flex cursor-grab touch-none justify-center pb-3 pt-3" onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd} aria-hidden="true"><span className="h-1.5 w-10 rounded-full bg-ink/20" /></div>}
        {children}
      </Tag>
    </div>
  );
}

function SheetHead({ id, title, sub, onClose }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="text-[22px] font-extrabold tracking-[-0.02em]">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-ink/70">{sub}</p>}
      </div>
      <button type="button" className="icon-btn size-10 shrink-0" onClick={onClose} aria-label="Fechar"><Icon name="x" size={18} /></button>
    </div>
  );
}

// Aviso de vidro: no topo no celular, no canto inferior direito no computador
function Toast({ toast, onClose, place = 'top' }) {
  if (!toast) return null;
  const top = place === 'top';
  const ms = toast.action || toast.error ? 6000 : 3500;
  const style = top
    ? { transform: 'translateX(-50%)', top: 'calc(10px + var(--safe-top))', left: '50%' }
    : { right: 24, bottom: 24 };
  return (
    <div key={toast.id} role={toast.error ? 'alert' : 'status'} aria-live={toast.error ? 'assertive' : 'polite'} style={style}
      className={`glass-deep ${top ? 'toast-top max-w-[calc(100%-24px)]' : 'toast-corner max-w-[420px]'} fixed z-[90] flex w-max items-center gap-3 overflow-hidden rounded-full py-2.5 pl-3 pr-2.5 text-[13px] font-semibold`}>
      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-white ${toast.error ? 'bg-coral shadow-[0_0_16px_-2px_rgba(240,138,107,.7)]' : 'bg-vivo shadow-[0_0_16px_-2px_rgba(52,195,155,.7)]'}`}><Icon name={toast.error ? 'alert' : 'check'} size={15} strokeWidth={2.6} /></span>
      <span className="min-w-0 flex-1">{toast.msg}</span>
      {toast.action ? (
        <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => { toast.action.run(); onClose(); }}>{toast.action.label}</button>
      ) : (
        <button type="button" className="icon-btn size-7 border-transparent" aria-label="Fechar aviso" onClick={onClose}><Icon name="x" size={14} /></button>
      )}
      <span className="toast-bar" style={{ animationDuration: `${ms}ms` }} aria-hidden="true" />
    </div>
  );
}

/* ---------- Dica flutuante ----------
   Mostra o rótulo de ícones e atalhos ao passar o mouse (ou foco pelo teclado).
   Vale para qualquer elemento com data-tip ou botão de ícone com aria-label. */
function TooltipLayer() {
  const [tip, setTip] = useState(null);
  useEffect(() => {
    if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    let timer = null;
    const find = (el) => el && el.closest && el.closest('[data-tip], .icon-btn[aria-label], [data-tip-auto][aria-label]');
    const show = (el) => {
      const text = el.getAttribute('data-tip') || el.getAttribute('aria-label');
      if (!text || el.disabled) return;
      const r = el.getBoundingClientRect();
      const below = r.top < 56;
      setTip({ text, x: Math.min(Math.max(r.left + r.width / 2, 70), window.innerWidth - 70), y: below ? r.bottom + 8 : r.top - 8, below });
    };
    const over = (e) => { const el = find(e.target); clearTimeout(timer); if (!el) { setTip(null); return; } timer = setTimeout(() => show(el), 380); };
    const focus = (e) => { const el = find(e.target); if (el && el.matches(':focus-visible')) show(el); };
    const hide = () => { clearTimeout(timer); setTip(null); };
    document.addEventListener('pointerover', over);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', over); document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide); document.removeEventListener('pointerdown', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);
  if (!tip) return null;
  return (
    <div className="pointer-events-none fixed z-[120]" style={{ left: tip.x, top: tip.y, transform: `translate(-50%, ${tip.below ? '0' : '-100%'})` }}>
      <div role="tooltip" className="tip-bubble">{tip.text}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gráficos                                                            */
/* ------------------------------------------------------------------ */
function monotonePath(pts) {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  if (n === 2) return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`;
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

function niceScale(lo, hi, count, zero) {
  const span = hi - lo || Math.abs(hi) || 100;
  const raw = span / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  const min = zero ? Math.min(0, Math.floor(lo / step) * step) : Math.floor(lo / step) * step;
  let max = Math.ceil(hi / step) * step;
  if (max <= min) max = min + step;
  const ticks = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(v);
  return { min, max, ticks };
}

function AreaChart({ series, points, height = 260, selectedKey, zeroBase = true, label }) {
  const theme = useContext(ThemeCtx);
  const P = PALETTES[theme];
  const wrap = useRef(null);
  const W = useWidth(wrap);
  const gid = cleanId(useId());
  const [hover, setHover] = useState(null);
  const all = series.flatMap((s) => s.values);
  const { min, max, ticks } = niceScale(zeroBase ? Math.min(0, ...all) : Math.min(...all), Math.max(...all, 1), 4, zeroBase);
  const tickLbl = axisLabels(ticks);
  const m = { t: 14, r: 12, b: 30, l: Math.max(38, Math.max(...tickLbl.map((t) => t.length)) * 6.3 + 16) };
  const n = points.length;
  const inset = n > 8 ? 10 : 26;
  const iw = Math.max(10, W - m.l - m.r);
  const ih = height - m.t - m.b;
  const labelW = Math.max(...points.map((p) => String(p.short || '').length), 1) * 6.6 + 8;
  const labelStep = Math.max(1, Math.ceil(labelW / Math.max(1, (iw - 2 * inset) / Math.max(1, n - 1))));
  const x = (i) => m.l + inset + (n === 1 ? (iw - 2 * inset) / 2 : (i * (iw - 2 * inset)) / (n - 1));
  const y = (v) => m.t + ih - ((v - min) / (max - min)) * ih;
  const selIdx = points.findIndex((p) => p.k === selectedKey);
  const dataKey = series.map((s) => s.values.join(',')).join('|');
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) { const d = Math.abs(x(i) - px); if (d < bd) { bd = d; best = i; } }
    setHover(best);
  };
  const active = hover;
  const tipX = active != null ? Math.min(Math.max(x(active) - 90, 4), Math.max(4, W - 184)) : 0;
  const marks = [selIdx, active].filter((i, j, arr) => i != null && i >= 0 && arr.indexOf(i) === j);
  const base = y(Math.max(min, 0));
  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height }}>
      {W > 0 && (
        <svg width={W} height={height} role="img" aria-label={label} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${gid}${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity=".30" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((tk, ti) => (
            <g key={tk}>
              <line x1={m.l} x2={W - m.r} y1={y(tk)} y2={y(tk)} stroke={P.grid} strokeDasharray={tk === 0 ? '0' : '3 5'} />
              <text x={m.l - 10} y={y(tk)} dy="0.32em" textAnchor="end" fontSize="11" fill={P.axis} style={{ fontVariantNumeric: 'tabular-nums' }}>{tickLbl[ti]}</text>
            </g>
          ))}
          {selIdx >= 0 && <rect x={x(selIdx) - 22} y={m.t} width="44" height={ih} rx="12" fill={P.band} />}
          {series.map((s) => {
            const line = monotonePath(s.values.map((v, i) => [x(i), y(v)]));
            return (
              <g key={`${s.key}-${dataKey}-${W}`}>
                <path d={`${line}L${x(n - 1)},${base}L${x(0)},${base}Z`} fill={`url(#${gid}${s.key})`} className="fade-area" />
                <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" pathLength="1" className="draw" style={{ filter: `drop-shadow(0 4px 10px ${s.color}55)` }} />
              </g>
            );
          })}
          {points.map((p, i) => ((i % labelStep === 0 && (i === n - 1 || n - 1 - i >= labelStep || labelStep === 1)) || i === selIdx) && (
            <text key={p.k} x={x(i)} y={height - 8} textAnchor="middle" fontSize="11.5" fill={i === selIdx ? 'currentColor' : P.axis} fontWeight={i === selIdx ? 800 : 500}>{p.short}</text>
          ))}
          {active != null && <line x1={x(active)} x2={x(active)} y1={m.t} y2={m.t + ih} stroke={P.axis} strokeOpacity=".6" strokeDasharray="2 4" />}
          {series.map((s) => marks.map((i) => (
            <circle key={`${s.key}-${i}`} cx={x(i)} cy={y(s.values[i])} r={i === active ? 5.5 : 4.5} fill={s.color} stroke={P.dot} strokeWidth="2.5" />
          )))}
        </svg>
      )}
      {active != null && W > 0 && (
        <div className="glass-deep chart-tip pointer-events-none absolute top-0 z-10 w-[180px] rounded-2xl px-3.5 py-3 text-xs" style={{ left: tipX }}>
          <p className="mb-1.5 font-bold">{points[active].full}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-3 py-0.5">
              <span className="flex items-center gap-1.5 text-ink/75"><span className="size-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
              <span className="font-bold tabular-nums">{fmtBRL(s.values[active])}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function BarChart({ points, height = 240, label }) {
  const theme = useContext(ThemeCtx);
  const P = PALETTES[theme];
  const wrap = useRef(null);
  const W = useWidth(wrap);
  const [hover, setHover] = useState(null);
  const { min, max, ticks } = niceScale(0, Math.max(1, ...points.flatMap((p) => [p.in, p.out])), 4, true);
  const tickLbl = axisLabels(ticks);
  const m = { t: 12, r: 8, b: 30, l: Math.max(38, Math.max(...tickLbl.map((t) => t.length)) * 6.3 + 16) };
  const iw = Math.max(10, W - m.l - m.r);
  const ih = height - m.t - m.b;
  const y = (v) => m.t + ih - ((v - min) / (max - min)) * ih;
  const n = points.length;
  const slot = iw / Math.max(1, n);
  const bw = Math.max(4, Math.min(18, slot / 3));
  const tipX = hover != null ? Math.min(Math.max(m.l + slot * hover + slot / 2 - 90, 4), Math.max(4, W - 184)) : 0;
  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height }}>
      {W > 0 && (
        <svg width={W} height={height} role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
          {ticks.map((tk, ti) => (
            <g key={tk}>
              <line x1={m.l} x2={W - m.r} y1={y(tk)} y2={y(tk)} stroke={P.grid} strokeDasharray={tk === 0 ? '0' : '3 5'} />
              <text x={m.l - 10} y={y(tk)} dy="0.32em" textAnchor="end" fontSize="11" fill={P.axis}>{tickLbl[ti]}</text>
            </g>
          ))}
          {points.map((p, i) => {
            const cx = m.l + slot * i + slot / 2;
            return (
              <g key={p.k} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
                <rect x={m.l + slot * i} y={m.t} width={slot} height={ih} fill={hover === i ? P.band : 'transparent'} />
                <rect x={cx - bw - 2} y={y(p.in)} width={bw} height={Math.max(0, y(0) - y(p.in))} rx="4" fill={P.in} />
                <rect x={cx + 2} y={y(p.out)} width={bw} height={Math.max(0, y(0) - y(p.out))} rx="4" fill={P.out} />
                {i % Math.max(1, Math.ceil(30 / Math.max(1, slot))) === 0 && <text x={cx} y={height - 8} textAnchor="middle" fontSize="11" fill={P.axis}>{p.short}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && W > 0 && (
        <div className="glass-deep chart-tip pointer-events-none absolute top-0 z-10 w-[180px] rounded-2xl px-3.5 py-3 text-xs" style={{ left: tipX }}>
          <p className="mb-1.5 font-bold">{points[hover].full}</p>
          <p className="flex justify-between gap-3"><span className="text-ink/75">Receitas</span><b className="tabular-nums">{fmtBRL(points[hover].in)}</b></p>
          <p className="flex justify-between gap-3"><span className="text-ink/75">Despesas</span><b className="tabular-nums">{fmtBRL(points[hover].out)}</b></p>
          <p className="mt-1 flex justify-between gap-3 border-t border-ink/10 pt-1"><span className="text-ink/75">Resultado</span><b className="tabular-nums">{fmtBRL(points[hover].in - points[hover].out)}</b></p>
        </div>
      )}
    </div>
  );
}

function Spark({ values, color, height = 40 }) {
  const gid = cleanId(useId());
  const W = 100, H = height;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * W, H - 5 - ((v - lo) / span) * (H - 12)]);
  const line = monotonePath(pts);
  const last = pts[pts.length - 1];
  return (
    <div className="relative w-full" style={{ height }} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-full w-full overflow-visible">
        <defs>
          <linearGradient id={`${gid}s`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".32" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${gid}s)`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      </svg>
      <span className="absolute size-2.5 rounded-full ring-2 ring-paper" style={{ right: 0, top: `${(last[1] / H) * 100}%`, background: color, transform: 'translate(50%,-50%)', boxShadow: `0 0 10px ${color}` }} />
    </div>
  );
}

function Donut({ data, size = 200, stroke = 24, active, onActive, emptyLabel = 'Sem despesas' }) {
  const theme = useContext(ThemeCtx);
  const P = PALETTES[theme];
  const total = sum(data, (d) => d.value);
  const r = (size - stroke - 8) / 2;
  const C = 2 * Math.PI * r;
  const gap = data.length > 1 ? 3 : 0;
  let acc = 0;
  const segs = data.map((d) => { const len = total ? (d.value / total) * C : 0; const seg = { ...d, len: Math.max(0.01, len - gap), off: acc }; acc += len; return seg; });
  const act = data.find((d) => d.key === active);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={data.map((d) => `${d.label} ${fmtBRL(d.value)}`).join(', ') || emptyLabel}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={P.track} strokeWidth={stroke} />
        {segs.map((s) => (
          <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} className="seg"
            strokeWidth={active === s.key ? stroke + 8 : stroke} strokeDasharray={`${s.len} ${C - s.len}`} strokeDashoffset={-s.off}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} opacity={active && active !== s.key ? 0.3 : 1}
            onPointerEnter={() => onActive && onActive(s.key)} onPointerLeave={() => onActive && onActive(null)} style={{ cursor: 'pointer' }} />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div className="px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/65">{act ? act.label : total ? 'Total' : emptyLabel}</p>
          <p className="mt-1 text-[19px] font-extrabold tracking-[-0.02em] tabular-nums">{fmtBRL(act ? act.value : total)}</p>
          {act && total > 0 && <p className="mt-0.5 text-xs font-semibold text-ink/70">{fmtPctAbs((act.value / total) * 100)} do total</p>}
        </div>
      </div>
    </div>
  );
}

function CategoryBreakdown({ items, donutSize = 196, compact = false, emptyText = 'Nenhuma despesa neste período.' }) {
  const [active, setActive] = useState(null);
  const total = sum(items, (c) => c.value);
  const m = useMoneyText();
  return (
    <div className={`flex flex-col items-center gap-6 ${compact ? '' : 'sm:flex-row xl:flex-col 2xl:flex-row'}`}>
      <Donut data={items} size={donutSize} active={active} onActive={setActive} />
      <ul className="w-full min-w-0 space-y-0.5">
        {items.length === 0 && <li className="py-6 text-center text-sm text-ink/65">{emptyText}</li>}
        {items.map((c) => (
          <li key={c.key}>
            <button type="button" onPointerEnter={() => setActive(c.key)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(c.key)} onBlur={() => setActive(null)}
              className={`w-full rounded-xl px-2.5 py-2 text-left transition-colors ${active === c.key ? 'bg-ink/[0.05]' : ''}`}>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="truncate">{c.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-ink/70"><span className="font-bold text-ink">{m(c.value)}</span> · {fmtPctAbs((c.value / total) * 100)}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink/[0.07]">
                <i className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${(c.value / items[0].value) * 100}%`, background: c.color }} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
