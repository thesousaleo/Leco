/* =====================================================================
   LECO · Controle Financeiro
   React 18 + Tailwind CSS · Liquid Glass (Esmeralda & Ouro)
   Tema claro (fundo branco) com opção de tema escuro nas Preferências.
   Fonte Manrope · Moeda BRL (R$ 0.000,00) · Datas DD/MM/AAAA
   Dados fictícios de demonstração; as alterações ficam salvas neste navegador.
   ===================================================================== */
const { useState, useMemo, useEffect, useRef, useLayoutEffect, useCallback, useId, useContext, createContext } = React;
/* No APK (Capacitor) o index.html define window.LECO_NATIVE = true: o app abre direto em tela cheia. */
const NATIVE = typeof window !== 'undefined' && !!window.LECO_NATIVE;

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtBRL = (cents) => BRL.format(cents / 100);
const fmtDate = (iso) => iso.split('-').reverse().join('/');
const pad2 = (n) => String(n).padStart(2, '0');
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const monthKey = (iso) => iso.slice(0, 7);
const monthName = (k) => MONTHS[Number(k.slice(5, 7)) - 1];
const monthLabel = (k) => `${monthName(k)} ${k.slice(0, 4)}`;
const shiftMonth = (k, delta) => {
  let y = Number(k.slice(0, 4));
  let m = Number(k.slice(5, 7)) - 1 + delta;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return `${y}-${pad2(m + 1)}`;
};
const nowStamp = () => { const d = new Date(); return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const fmtAxis = (cents) => {
  const r = cents / 100;
  if (Math.abs(r) >= 1000) return `${(r / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return String(Math.round(r));
};
const fmtPctAbs = (v, unit = '%') => `${Math.abs(v).toFixed(1).replace('.', ',')}${unit}`;
const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const reducedMotion = () => {
  try { return document.documentElement.dataset.calm === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
};
const byDateDesc = (a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1);
const cleanId = (id) => id.replace(/[^a-zA-Z0-9_-]/g, '');
const mixHex = (hex, to, t) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const firstName = (n) => (n || '').trim().split(/\s+/)[0] || 'Você';

/* ------------------------------------------------------------------ */
/* Categorias, paletas e dados fictícios                               */
/* ------------------------------------------------------------------ */
const SWATCHES = ['#14806B', '#0F5C4D', '#34C39B', '#6B9E8F', '#E8A317', '#B8865B', '#F08A6B', '#D9644A', '#5E8CA6', '#8C7AB8', '#7A8B3F', '#C46B8F'];
const ICON_CHOICES = ['home', 'utensils', 'car', 'film', 'heart', 'repeat', 'book', 'bag', 'paw', 'plane', 'gift', 'zap', 'coffee', 'game', 'dumbbell', 'tag', 'briefcase', 'trend', 'laptop', 'wallet'];

const DEFAULT_CATS = {
  moradia:       { label: 'Moradia',       icon: 'home',      color: '#14806B', kind: 'out', budget: 330000 },
  alimentacao:   { label: 'Alimentação',   icon: 'utensils',  color: '#E8A317', kind: 'out', budget: 140000 },
  transporte:    { label: 'Transporte',    icon: 'car',       color: '#5E8CA6', kind: 'out', budget: 80000 },
  lazer:         { label: 'Lazer',         icon: 'film',      color: '#F08A6B', kind: 'out', budget: 60000 },
  saude:         { label: 'Saúde',         icon: 'heart',     color: '#6B9E8F', kind: 'out', budget: 80000 },
  assinaturas:   { label: 'Assinaturas',   icon: 'repeat',    color: '#8C7AB8', kind: 'out', budget: 15000 },
  educacao:      { label: 'Educação',      icon: 'book',      color: '#B8865B', kind: 'out', budget: 30000 },
  compras:       { label: 'Compras',       icon: 'bag',       color: '#D9644A', kind: 'out', budget: 50000 },
  pets:          { label: 'Pets',          icon: 'paw',       color: '#7A8B3F', kind: 'out', budget: 25000 },
  'outros-out':  { label: 'Outros gastos', icon: 'tag',       color: '#5E8CA6', kind: 'out', budget: 0, locked: true },
  salario:       { label: 'Salário',       icon: 'briefcase', color: '#14806B', kind: 'in',  budget: 0 },
  investimentos: { label: 'Investimentos', icon: 'trend',     color: '#E8A317', kind: 'in',  budget: 0 },
  freelance:     { label: 'Freelance',     icon: 'laptop',    color: '#6B9E8F', kind: 'in',  budget: 0 },
  'outros-in':   { label: 'Outras receitas', icon: 'gift',    color: '#8C7AB8', kind: 'in',  budget: 0, locked: true },
};
const catKeys = (cats, kind) => Object.keys(cats).filter((k) => cats[k].kind === kind);
const catOf = (cats, key, kind = 'out') => cats[key] || cats[kind === 'in' ? 'outros-in' : 'outros-out'] || { label: 'Sem categoria', icon: 'tag', color: '#6B9E8F', kind };

const PALETTES = {
  light: { in: '#14806B', out: '#E0714F', gold: '#D99510', axis: 'rgba(11,47,41,.58)', grid: 'rgba(11,47,41,.08)', dot: '#FFFFFF', band: 'rgba(11,47,41,.04)', track: 'rgba(11,47,41,.07)' },
  dark:  { in: '#34C39B', out: '#F08A6B', gold: '#E8A317', axis: 'rgba(228,239,234,.62)', grid: 'rgba(228,239,234,.08)', dot: '#0B2F29', band: 'rgba(228,239,234,.05)', track: 'rgba(228,239,234,.07)' },
};

const OPENING_BALANCE = 2148000; // saldo em 30/04/2026, em centavos
let seedId = 0;
const tx = (date, desc, cat, type, value) => ({ id: ++seedId, date, desc, cat, type, amount: Math.round(value * 100) });
const rnd = (n) => { const s = Math.sin(n * 91.345 + 7.13) * 43758.5453; return s - Math.floor(s); };
const vary = (base, n, spread = 0.2) => Math.round(base * (1 - spread / 2 + spread * rnd(n)) * 100) / 100;

function seedMonth(ym, i) {
  const n = (i + 1) * 13;
  const list = [
    tx(`${ym}-03`, 'Assinaturas de streaming', 'assinaturas', 'out', 79.8),
    tx(`${ym}-05`, 'Salário mensal', 'salario', 'in', 8500),
    tx(`${ym}-05`, 'Aluguel', 'moradia', 'out', 2350),
    tx(`${ym}-07`, 'Condomínio', 'moradia', 'out', vary(480, n + 1, 0.04)),
    tx(`${ym}-08`, 'Supermercado', 'alimentacao', 'out', vary(590, n + 2)),
    tx(`${ym}-09`, 'Combustível', 'transporte', 'out', vary(230, n + 3)),
    tx(`${ym}-10`, 'Plano de saúde', 'saude', 'out', 420),
    tx(`${ym}-11`, 'Conta de luz', 'moradia', 'out', vary(185, n + 4)),
    tx(`${ym}-13`, 'Restaurante', 'alimentacao', 'out', vary(150, n + 5, 0.4)),
    tx(`${ym}-15`, 'Academia', 'saude', 'out', 119.9),
    tx(`${ym}-16`, 'Ração e petiscos', 'pets', 'out', vary(140, n + 11, 0.3)),
    tx(`${ym}-17`, 'Supermercado', 'alimentacao', 'out', vary(320, n + 6)),
    tx(`${ym}-19`, 'Transporte por aplicativo', 'transporte', 'out', vary(88, n + 7, 0.5)),
    tx(`${ym}-21`, 'Cinema e passeios', 'lazer', 'out', vary(240, n + 8, 0.6)),
    tx(`${ym}-25`, 'Rendimentos Tesouro Selic', 'investimentos', 'in', vary(245, n + 9, 0.25)),
  ];
  if (i !== 1) list.push(tx(`${ym}-27`, 'Projeto freelance', 'freelance', 'in', vary(1300, n + 10, 0.5)));
  if (i === 2) list.push(tx(`${ym}-22`, 'Roupas de inverno', 'compras', 'out', 389.9));
  return list;
}

const makeSeed = () => {
  seedId = 0;
  return [
    ...seedMonth('2026-05', 0), ...seedMonth('2026-06', 1), ...seedMonth('2026-07', 2), ...seedMonth('2026-08', 3),
    tx('2026-09-03', 'Assinaturas de streaming', 'assinaturas', 'out', 79.8),
    tx('2026-09-05', 'Salário mensal', 'salario', 'in', 8500),
    tx('2026-09-05', 'Aluguel', 'moradia', 'out', 2350),
    tx('2026-09-07', 'Condomínio', 'moradia', 'out', 480),
    tx('2026-09-08', 'Supermercado', 'alimentacao', 'out', 538.7),
    tx('2026-09-09', 'Combustível', 'transporte', 'out', 221.3),
    tx('2026-09-10', 'Conta de luz', 'moradia', 'out', 176.8),
    tx('2026-09-10', 'Plano de saúde', 'saude', 'out', 420),
    tx('2026-09-12', 'Restaurante', 'alimentacao', 'out', 156.4),
    tx('2026-09-13', 'Academia', 'saude', 'out', 119.9),
    tx('2026-09-14', 'Passeio de fim de semana', 'lazer', 'out', 640),
    tx('2026-09-15', 'Tênis de corrida', 'compras', 'out', 399.9),
    tx('2026-09-16', 'Transporte por aplicativo', 'transporte', 'out', 72.5),
    tx('2026-09-17', 'Ração e petiscos', 'pets', 'out', 148.3),
    tx('2026-09-18', 'Supermercado', 'alimentacao', 'out', 311.25),
    tx('2026-09-20', 'Cinema e jantar', 'lazer', 'out', 210),
    tx('2026-09-22', 'Farmácia', 'saude', 'out', 88.6),
    tx('2026-09-25', 'Rendimentos Tesouro Selic', 'investimentos', 'in', 287.1),
    tx('2026-09-27', 'Delivery', 'alimentacao', 'out', 92.8),
    tx('2026-10-01', 'Assinaturas de streaming', 'assinaturas', 'out', 79.8),
    tx('2026-10-05', 'Salário mensal', 'salario', 'in', 8900),
    tx('2026-10-05', 'Aluguel', 'moradia', 'out', 2350),
    tx('2026-10-06', 'Condomínio', 'moradia', 'out', 485),
    tx('2026-10-07', 'Supermercado', 'alimentacao', 'out', 612.4),
    tx('2026-10-08', 'Combustível', 'transporte', 'out', 248.9),
    tx('2026-10-09', 'Revisão do carro', 'transporte', 'out', 540),
    tx('2026-10-10', 'Plano de saúde', 'saude', 'out', 420),
    tx('2026-10-10', 'Conta de luz', 'moradia', 'out', 203.15),
    tx('2026-10-11', 'Freelance de identidade visual', 'freelance', 'in', 1850),
    tx('2026-10-12', 'Restaurante', 'alimentacao', 'out', 129),
    tx('2026-10-13', 'Curso online de Excel', 'educacao', 'out', 197),
    tx('2026-10-14', 'Farmácia', 'saude', 'out', 96.3),
    tx('2026-10-15', 'Academia', 'saude', 'out', 119.9),
    tx('2026-10-16', 'Transporte por aplicativo', 'transporte', 'out', 63.4),
    tx('2026-10-16', 'Ração e petiscos', 'pets', 'out', 156),
    tx('2026-10-17', 'Supermercado', 'alimentacao', 'out', 287.15),
    tx('2026-10-18', 'Cinema e jantar', 'lazer', 'out', 184),
    tx('2026-10-19', 'Presente de aniversário', 'lazer', 'out', 260),
    tx('2026-10-20', 'Rendimentos Tesouro Selic', 'investimentos', 'in', 312.48),
    tx('2026-10-21', 'Delivery', 'alimentacao', 'out', 84.9),
    tx('2026-10-22', 'Transporte por aplicativo', 'transporte', 'out', 41.7),
    tx('2026-10-23', 'Padaria', 'alimentacao', 'out', 32.5),
  ];
};

const DEFAULT_GOALS = [
  { id: 'g1', name: 'Reserva de emergência', icon: 'shield', saved: 2460000, target: 3000000, due: '2026-12-31' },
  { id: 'g2', name: 'Viagem de fim de ano', icon: 'plane', saved: 415000, target: 600000, due: '2026-12-15' },
  { id: 'g3', name: 'Notebook novo', icon: 'laptop', saved: 225000, target: 750000, due: '2027-03-31' },
];
const DEFAULT_PROFILE = { name: 'Leonardo Sousa', email: 'leonardo@exemplo.com', phone: '(11) 98765-4321', city: 'São Paulo, SP', since: '2026-05-01' };
const DEFAULT_PREFS = { theme: 'light', hide: false, calm: false, savingsGoal: 30, weekStart: 'dom', opening: OPENING_BALANCE };
const DEFAULT_NOTIF = { budget: true, bills: true, weekly: false, goals: true, access: true, summaryHour: '08:00' };
const DEFAULT_SECURITY = { twoFA: false, loginAlerts: true, pwStrong: true, pwChanged: '2026-08-14', biometrics: true };
const DEFAULT_SESSIONS = [
  { id: 's1', device: 'Chrome no Windows', icon: 'monitor', place: 'São Paulo, SP', ip: '189.40.•••.12', last: 'Ativa agora', current: true },
  { id: 's2', device: 'App Leco no iPhone 15', icon: 'phone', place: 'São Paulo, SP', ip: '177.82.•••.90', last: '23/10/2026 08:12' },
  { id: 's3', device: 'Safari no MacBook Air', icon: 'monitor', place: 'Campinas, SP', ip: '200.155.•••.4', last: '19/10/2026 21:47' },
];
const DEFAULT_LOG = [
  { id: 'a1', when: '23/10/2026 13:40', device: 'Chrome · Windows', place: 'São Paulo, SP', ip: '189.40.•••.12', method: 'Senha', ok: true },
  { id: 'a2', when: '23/10/2026 08:12', device: 'App Leco · iPhone', place: 'São Paulo, SP', ip: '177.82.•••.90', method: 'Biometria', ok: true },
  { id: 'a3', when: '19/10/2026 21:47', device: 'Safari · macOS', place: 'Campinas, SP', ip: '200.155.•••.4', method: 'Senha', ok: true },
  { id: 'a4', when: '17/10/2026 03:12', device: 'Firefox · Linux', place: 'Curitiba, PR', ip: '45.231.•••.77', method: 'Senha incorreta (3x)', ok: false },
  { id: 'a5', when: '14/10/2026 19:05', device: 'App Leco · iPhone', place: 'São Paulo, SP', ip: '177.82.•••.90', method: 'Biometria', ok: true },
  { id: 'a6', when: '09/10/2026 10:31', device: 'Chrome · Windows', place: 'São Paulo, SP', ip: '189.40.•••.12', method: 'Senha', ok: true },
];

/* ------------------------------------------------------------------ */
/* Cálculos                                                            */
/* ------------------------------------------------------------------ */
function computeFinance(txs, month, cats, opening = OPENING_BALANCE) {
  const keys = txs.length ? txs.map((t) => monthKey(t.date)) : [month];
  const minM = keys.reduce((a, b) => (a < b ? a : b));
  const maxM = keys.reduce((a, b) => (a > b ? a : b));
  const sums = {};
  txs.forEach((t) => { const k = monthKey(t.date); const s = sums[k] || (sums[k] = { in: 0, out: 0 }); s[t.type] += t.amount; });
  const get = (k) => sums[k] || { in: 0, out: 0 };
  const balanceAt = (k) => opening + Object.keys(sums).filter((m) => m <= k).reduce((acc, m) => acc + sums[m].in - sums[m].out, 0);
  // janela de 6 meses: termina no último mês com dados (ou no mês escolhido, se for depois) e sempre inclui o mês escolhido
  let end = month > maxM ? month : maxM;
  if (month < shiftMonth(end, -5)) end = shiftMonth(month, 5);
  const series = Array.from({ length: 6 }, (_, i) => {
    const k = shiftMonth(end, i - 5);
    return { k, short: MONTHS_SHORT[Number(k.slice(5, 7)) - 1], full: monthLabel(k), in: get(k).in, out: get(k).out, bal: balanceAt(k) };
  });
  const mk = (k) => { const s = get(k); return { in: s.in, out: s.out, net: s.in - s.out, bal: balanceAt(k), rate: s.in ? ((s.in - s.out) / s.in) * 100 : 0 }; };
  const prevKey = shiftMonth(month, -1);
  const cur = mk(month);
  const prev = mk(prevKey);
  const pct = (a, b) => (b ? ((a - b) / b) * 100 : null);

  const spentBy = (k) => { const o = {}; txs.forEach((t) => { if (t.type === 'out' && monthKey(t.date) === k) o[t.cat] = (o[t.cat] || 0) + t.amount; }); return o; };
  const now = spentBy(month), before = spentBy(prevKey);
  const catsOut = Object.keys(now).map((k) => { const c = catOf(cats, k); return { key: k, label: c.label, value: now[k], color: c.color }; }).sort((a, b) => b.value - a.value);
  const compare = Array.from(new Set([...Object.keys(now), ...Object.keys(before)]))
    .map((k) => ({ key: k, label: catOf(cats, k).label, now: now[k] || 0, before: before[k] || 0, delta: pct(now[k] || 0, before[k] || 0) }))
    .sort((a, b) => b.now - a.now);
  const budgets = catKeys(cats, 'out').filter((k) => cats[k].budget > 0)
    .map((k) => { const spent = now[k] || 0; return { key: k, label: cats[k].label, budget: cats[k].budget, spent, pct: Math.round((spent / cats[k].budget) * 100) }; })
    .sort((a, b) => b.pct - a.pct);
  const topOut = txs.filter((t) => t.type === 'out' && monthKey(t.date) === month).sort((a, b) => b.amount - a.amount).slice(0, 5);

  return {
    minM, maxM, series, cur, prev, prevKey, cats: catsOut, compare, budgets, topOut,
    deltas: { bal: pct(cur.bal, prev.bal), in: pct(cur.in, prev.in), out: pct(cur.out, prev.out), rate: prev.in && cur.in ? cur.rate - prev.rate : null },
  };
}

/* ------------------------------------------------------------------ */
/* Contexto e hooks                                                    */
/* ------------------------------------------------------------------ */
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);
/* true dentro do simulador de celular: as grelhas usam uma coluna */
const NarrowCtx = createContext(false);
const useNarrow = () => useContext(NarrowCtx);

function useStored(key, initial) {
  const [v, setV] = useState(() => {
    try { const raw = window.localStorage.getItem(key); if (raw) return JSON.parse(raw); } catch (e) { /* sem armazenamento */ }
    return typeof initial === 'function' ? initial() : initial;
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

function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 20000); return () => clearInterval(i); }, []);
  return `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
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
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><path d="M4 4l16 16" /></>,
  up: <path d="M7 17L17 7M8 7h9v9" />,
  down: <path d="M7 7l10 10M17 8v9H8" />,
  inArrow: <path d="M17 7L7 17M16 17H7V8" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20.5 20.5l-4.2-4.2" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
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
  finger: <><path d="M6.5 15c0-4 1.5-8 5.5-8s5.5 4 5.5 8" /><path d="M9.5 18.5c0-3 .5-7 2.5-7s2.5 3 2.5 6" /><path d="M12 15v5" /><path d="M4 11c1-4 4-7 8-7s7 3 8 7" /></>,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" /><path d="M4 3v5h5" /><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" /><path d="M20 21v-5h-5" /></>,
};

function Icon({ name, size = 20, className = '', strokeWidth = 1.8 }) {
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
  const { theme } = useApp();
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
  const cfg = { sm: { mark: 30, text: 'text-[22px]', tag: 'text-[8.5px]' }, md: { mark: 40, text: 'text-[29px]', tag: 'text-[9px]' } }[size];
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
        <div className="blob bottom-[8%] right-[22%] h-[170px] w-[170px] bg-ouro opacity-[.25]" style={{ animationDelay: '-11s' }} />
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
          className={`relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors ${pad} ${o.value === value ? 'text-white' : 'text-ink/70 hover:text-ink'}`}>
          {o.icon && <Icon name={o.icon} size={size === 'sm' ? 14 : 16} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label, desc, id, icon }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-ink/[0.06] text-ink"><Icon name={icon} size={17} /></span>}
        <div className="min-w-0">
          <p id={`${id}-l`} className="text-sm font-semibold">{label}</p>
          {desc && <p className="mt-0.5 text-xs leading-relaxed text-ink/65">{desc}</p>}
        </div>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-l`} onClick={() => onChange(!checked)} className={`switch ${checked ? 'on' : ''}`}>
        <span />
      </button>
    </div>
  );
}

function Delta({ value, goodWhen = 'up', unit = '%' }) {
  if (value == null || !isFinite(value)) return <span className="pill pill-neutral">sem base</span>;
  const up = value >= 0;
  const good = goodWhen === 'up' ? up : !up;
  return (
    <span className={`pill ${good ? 'pill-good' : 'pill-bad'}`}>
      <Icon name={up ? 'up' : 'down'} size={12} strokeWidth={2.4} />
      {up ? '+' : '−'}{fmtPctAbs(value, unit)}
    </span>
  );
}

function Money({ cents, className = '' }) {
  const { hide } = useApp();
  const v = useTween(cents);
  return <span className={`tabular-nums ${className}`}>{hide ? 'R$ ••••••' : fmtBRL(Math.round(v))}</span>;
}
function Percent({ value, className = '' }) {
  const v = useTween(value);
  return <span className={`tabular-nums ${className}`}>{v.toFixed(1).replace('.', ',')}%</span>;
}
function useMoneyText() {
  const { hide } = useApp();
  return (cents) => (hide ? 'R$ ••••' : fmtBRL(cents));
}
function Signed({ t, className = '' }) {
  const m = useMoneyText();
  return <span className={`whitespace-nowrap font-extrabold tabular-nums ${t.type === 'in' ? 'text-in' : 'text-out'} ${className}`}>{t.type === 'in' ? '+' : '−'} {m(t.amount)}</span>;
}

function CatIcon({ cat, kind, size = 40 }) {
  const { cats, theme } = useApp();
  const c = catOf(cats, cat, kind);
  const fg = theme === 'light' ? mixHex(c.color, '#0B2F29', 0.18) : c.color;
  return (
    <span className="grid shrink-0 place-items-center rounded-2xl"
      style={{ width: size, height: size, background: `${c.color}22`, color: fg, boxShadow: `inset 0 0 0 1px ${c.color}38` }}>
      <Icon name={c.icon} size={Math.round(size * 0.47)} />
    </span>
  );
}

function CatPill({ cat, kind }) {
  const { cats } = useApp();
  const c = catOf(cats, cat, kind);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-xs font-semibold text-ink"
      style={{ background: `${c.color}1C`, boxShadow: `inset 0 0 0 1px ${c.color}30` }}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} />
      <span className="truncate">{c.label}</span>
    </span>
  );
}

function MonthSwitch({ month, min, max, onChange, compact = false }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-ink/[0.04] p-1 backdrop-blur-xl">
      <button type="button" className="icon-btn size-8 border-transparent bg-transparent" aria-label="Mês anterior" disabled={month <= min} onClick={() => onChange(shiftMonth(month, -1))}>
        <Icon name="left" size={16} />
      </button>
      <span aria-live="polite" className={`text-center text-[13px] font-bold tabular-nums ${compact ? 'min-w-[116px]' : 'min-w-[138px]'}`}>{monthLabel(month)}</span>
      <button type="button" className="icon-btn size-8 border-transparent bg-transparent" aria-label="Próximo mês" disabled={month >= max} onClick={() => onChange(shiftMonth(month, 1))}>
        <Icon name="right" size={16} />
      </button>
    </div>
  );
}

function Card({ title, sub, action, children, className = '', delay = 0 }) {
  return (
    <section className={`glass rise min-w-0 p-5 sm:p-6 ${className}`} style={{ animationDelay: `${delay}ms` }}>
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
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[34px]">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </header>
  );
}

function NotifButton({ panelWidth = 340 }) {
  const { notifs, unread, markRead } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const tone = { gold: 'bg-ouro/20 text-[#9A6205]', bad: 'bg-coral/20 text-out', ok: 'bg-ink/[0.07] text-ink' };
  return (
    <div ref={ref} className="relative">
      <button type="button" className="icon-btn relative size-11" aria-label="Notificações" aria-expanded={open}
        onClick={() => { setOpen((o) => !o); markRead(); }}>
        <Icon name="bell" size={19} />
        {unread && notifs.length > 0 && <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-ouro ring-2 ring-paper" />}
      </button>
      {open && (
        <div className="glass-deep pop-in absolute right-0 top-[calc(100%+10px)] z-50 p-2 max-sm:fixed max-sm:inset-x-4 max-sm:top-[84px] max-sm:!w-auto" style={{ width: panelWidth }} role="dialog" aria-label="Notificações">
          <div className="flex items-center justify-between px-3 pb-1 pt-2">
            <p className="text-sm font-extrabold tracking-[-0.02em]">Notificações</p>
            <span className="text-[11px] text-ink/60">{notifs.length} recentes</span>
          </div>
          {notifs.length === 0 && <p className="px-3 py-6 text-center text-xs text-ink/65">Tudo em dia. Ative alertas em Configurações › Notificações.</p>}
          <ul className="no-scrollbar max-h-[360px] space-y-1 overflow-y-auto">
            {notifs.map((n) => (
              <li key={n.id} className="flex gap-3 rounded-2xl p-3 hover:bg-ink/[0.04]">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone[n.tone || 'ok']}`}><Icon name={n.icon} size={17} /></span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold">{n.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink/70">{n.body}</p>
                  {n.when && <p className="mt-1 text-[11px] tabular-nums text-ink/60">{n.when}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MoneyInput({ id, cents, onChange, className = '', invalid, label }) {
  return (
    <input id={id} inputMode="numeric" autoComplete="off" aria-label={label} value={BRL.format(cents / 100)} aria-invalid={!!invalid}
      onChange={(e) => onChange(parseInt(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10) || '0', 10))}
      className={`field tabular-nums ${className}`} />
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
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  const min = zero ? 0 : Math.floor(lo / step) * step;
  let max = Math.ceil(hi / step) * step;
  if (max <= min) max = min + step;
  const ticks = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(v);
  return { min, max, ticks };
}

function AreaChart({ series, points, height = 260, selectedKey, zeroBase = true, label }) {
  const { P } = useApp();
  const wrap = useRef(null);
  const W = useWidth(wrap);
  const uid = cleanId(useId());
  const [hover, setHover] = useState(null);
  const m = { t: 14, r: 12, b: 30, l: 50 };
  const inset = 26;
  const iw = Math.max(10, W - m.l - m.r);
  const ih = height - m.t - m.b;
  const all = series.flatMap((s) => s.values);
  const { min, max, ticks } = niceScale(zeroBase ? 0 : Math.min(...all), Math.max(...all, 1), 4, zeroBase);
  const n = points.length;
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

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height }}>
      {W > 0 && (
        <svg width={W} height={height} role="img" aria-label={label} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${uid}${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity=".30" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={m.l} x2={W - m.r} y1={y(tk)} y2={y(tk)} stroke={P.grid} strokeDasharray={tk === min ? '0' : '3 5'} />
              <text x={m.l - 10} y={y(tk)} dy="0.32em" textAnchor="end" fontSize="11" fill={P.axis} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtAxis(tk)}</text>
            </g>
          ))}
          {selIdx >= 0 && <rect x={x(selIdx) - 22} y={m.t} width="44" height={ih} rx="12" fill={P.band} />}
          {series.map((s) => {
            const line = monotonePath(s.values.map((v, i) => [x(i), y(v)]));
            return (
              <g key={`${s.key}-${dataKey}-${W}`}>
                <path d={`${line}L${x(n - 1)},${y(min)}L${x(0)},${y(min)}Z`} fill={`url(#${uid}${s.key})`} className="fade-area" />
                <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" pathLength="1" className="draw" style={{ filter: `drop-shadow(0 4px 10px ${s.color}55)` }} />
              </g>
            );
          })}
          {points.map((p, i) => (
            <text key={p.k} x={x(i)} y={height - 8} textAnchor="middle" fontSize="11.5" fill={i === selIdx ? 'currentColor' : P.axis} fontWeight={i === selIdx ? 800 : 500}>{p.short}</text>
          ))}
          {active != null && <line x1={x(active)} x2={x(active)} y1={m.t} y2={m.t + ih} stroke={P.axis} strokeOpacity=".6" strokeDasharray="2 4" />}
          {series.map((s) => marks.map((i) => (
            <circle key={`${s.key}-${i}`} cx={x(i)} cy={y(s.values[i])} r={i === active ? 5.5 : 4.5} fill={s.color} stroke={P.dot} strokeWidth="2.5" />
          )))}
        </svg>
      )}
      {active != null && W > 0 && (
        <div className="glass-deep pointer-events-none absolute top-0 z-10 w-[180px] rounded-2xl px-3.5 py-3 text-xs" style={{ left: tipX }}>
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

function Spark({ values, color, height = 40 }) {
  const uid = cleanId(useId());
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
          <linearGradient id={`${uid}s`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".32" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${uid}s)`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      </svg>
      <span className="absolute size-2.5 rounded-full ring-2 ring-paper" style={{ right: 0, top: `${(last[1] / H) * 100}%`, background: color, transform: 'translate(50%,-50%)', boxShadow: `0 0 10px ${color}` }} />
    </div>
  );
}

function Donut({ data, size = 200, stroke = 24, active, onActive }) {
  const { P } = useApp();
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = (size - stroke - 8) / 2;
  const C = 2 * Math.PI * r;
  const gap = data.length > 1 ? 3 : 0;
  let acc = 0;
  const segs = data.map((d) => { const len = total ? (d.value / total) * C : 0; const seg = { ...d, len: Math.max(0.01, len - gap), off: acc }; acc += len; return seg; });
  const act = data.find((d) => d.key === active);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Despesas por categoria: ${data.map((d) => `${d.label} ${fmtBRL(d.value)}`).join(', ')}`}>
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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/65">{act ? act.label : total ? 'Total do mês' : 'Sem despesas'}</p>
          <p className="mt-1 text-[19px] font-extrabold tracking-[-0.02em] tabular-nums">{fmtBRL(act ? act.value : total)}</p>
          {act && total > 0 && <p className="mt-0.5 text-xs font-semibold text-ink/70">{fmtPctAbs((act.value / total) * 100)} do total</p>}
        </div>
      </div>
    </div>
  );
}

function CategoryBreakdown({ cats, donutSize = 196, compact = false }) {
  const [active, setActive] = useState(null);
  const total = cats.reduce((a, c) => a + c.value, 0);
  return (
    <div className={`flex flex-col items-center gap-6 ${compact ? '' : 'sm:flex-row xl:flex-col 2xl:flex-row'}`}>
      <Donut data={cats} size={donutSize} active={active} onActive={setActive} />
      <ul className="w-full min-w-0 space-y-0.5">
        {cats.length === 0 && <li className="py-6 text-center text-sm text-ink/65">Nenhuma despesa registrada neste mês.</li>}
        {cats.map((c) => (
          <li key={c.key}>
            <button type="button" onPointerEnter={() => setActive(c.key)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(c.key)} onBlur={() => setActive(null)}
              className={`w-full rounded-xl px-2.5 py-2 text-left transition-colors ${active === c.key ? 'bg-ink/[0.05]' : ''}`}>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="truncate">{c.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-ink/70"><span className="font-bold text-ink">{fmtBRL(c.value)}</span> · {fmtPctAbs((c.value / total) * 100)}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink/[0.07]">
                <i className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${(c.value / cats[0].value) * 100}%`, background: c.color }} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowChart({ fin, month, height = 260 }) {
  const { P } = useApp();
  const [view, setView] = useState('flow');
  const s = fin.series;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-ink/75">
          {view === 'flow' ? (
            <>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: P.in }} />Receitas</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: P.out }} />Despesas</span>
            </>
          ) : <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: P.gold }} />Saldo no fim do mês</span>}
        </div>
        <Segmented size="sm" label="Tipo de gráfico" value={view} onChange={setView} options={[{ value: 'flow', label: 'Receitas × Despesas' }, { value: 'bal', label: 'Patrimônio' }]} />
      </div>
      {view === 'flow' ? (
        <AreaChart height={height} points={s} selectedKey={month} label={`Receitas e despesas de ${s[0].full} a ${s[s.length - 1].full}`}
          series={[{ key: 'in', label: 'Receitas', color: P.in, values: s.map((p) => p.in) }, { key: 'out', label: 'Despesas', color: P.out, values: s.map((p) => p.out) }]} />
      ) : (
        <AreaChart height={height} points={s} selectedKey={month} zeroBase={false} label={`Evolução do patrimônio de ${s[0].full} a ${s[s.length - 1].full}`}
          series={[{ key: 'bal', label: 'Patrimônio', color: P.gold, values: s.map((p) => p.bal) }]} />
      )}
    </div>
  );
}

function BudgetList({ budgets, limit, onManage }) {
  const m = useMoneyText();
  const list = limit ? budgets.slice(0, limit) : budgets;
  return (
    <div>
      {list.length === 0 && <p className="py-4 text-sm text-ink/65">Nenhuma categoria com orçamento. Defina limites em Categorias.</p>}
      <ul className="space-y-4">
        {list.map((b) => {
          const state = b.pct >= 100 ? 'over' : b.pct >= 80 ? 'warn' : '';
          return (
            <li key={b.key}>
              <div className="flex items-center gap-3">
                <CatIcon cat={b.key} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13.5px] font-bold">{b.label}</p>
                    <span className={state === 'over' ? 'pill pill-bad' : state === 'warn' ? 'badge-gold' : 'pill pill-good'}>{b.pct}%</span>
                  </div>
                  <p className="truncate text-xs tabular-nums text-ink/65">{m(b.spent)} de {m(b.budget)}{b.pct >= 100 ? ` · ${m(b.spent - b.budget)} acima` : ` · restam ${m(b.budget - b.spent)}`}</p>
                </div>
              </div>
              <div className="track mt-2"><i className={state} style={{ width: `${Math.min(100, b.pct)}%` }} /></div>
            </li>
          );
        })}
      </ul>
      {onManage && <button type="button" className="btn btn-ghost mt-5 w-full !py-2 text-[13px]" onClick={onManage}><Icon name="grid" size={15} />Ajustar orçamentos</button>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Metas                                                               */
/* ------------------------------------------------------------------ */
function GoalCard({ g, onContribute, onRemove }) {
  const m = useMoneyText();
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState(0);
  const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
  return (
    <li className="glass rise rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink/[0.06] text-ink"><Icon name={g.icon} size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold tracking-[-0.02em]">{g.name}</p>
          <p className="text-xs text-ink/65">até {fmtDate(g.due)}</p>
        </div>
        <span className="badge-gold">{pct}%</span>
      </div>
      <div className="track mt-4"><i style={{ width: `${pct}%` }} /></div>
      <p className="mt-2 flex justify-between text-xs tabular-nums text-ink/70">
        <span><b className="font-bold text-ink">{m(g.saved)}</b> guardados</span>
        <span>meta {m(g.target)}</span>
      </p>
      {adding ? (
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (val > 0) { onContribute(g.id, val); setVal(0); setAdding(false); } }}>
          <MoneyInput id={`goal-add-${g.id}`} label={`Valor para ${g.name}`} cents={val} onChange={setVal} className="!rounded-full !py-2 text-sm font-bold" />
          <button type="submit" className="btn btn-primary !px-4 !py-2 text-[13px]" disabled={val <= 0}>Guardar</button>
          <button type="button" className="icon-btn size-10 shrink-0" aria-label="Cancelar" onClick={() => setAdding(false)}><Icon name="x" size={16} /></button>
        </form>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-ink/65">{g.saved >= g.target ? 'Meta concluída' : `Faltam ${m(g.target - g.saved)}`}</span>
          <div className="flex gap-2">
            <button type="button" className="icon-btn size-9" aria-label={`Remover meta ${g.name}`} onClick={() => onRemove(g.id)}><Icon name="trash" size={15} /></button>
            <button type="button" className="btn btn-ghost !px-3.5 !py-2 text-[13px]" onClick={() => setAdding(true)}><Icon name="plus" size={15} />Guardar valor</button>
          </div>
        </div>
      )}
    </li>
  );
}

function GoalsManager({ cols = 'md:grid-cols-2 2xl:grid-cols-3' }) {
  const { goals, setGoals, toast } = useApp();
  const [name, setName] = useState('');
  const [target, setTarget] = useState(0);
  const [due, setDue] = useState('2027-06-30');
  const [err, setErr] = useState('');
  const contribute = (id, v) => { setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, saved: g.saved + v } : g))); toast(`${fmtBRL(v)} guardados na meta`); };
  const remove = (id) => { const g = goals.find((x) => x.id === id); setGoals((gs) => gs.filter((x) => x.id !== id)); toast(`Meta “${g.name}” removida`, { label: 'Desfazer', run: () => setGoals((gs) => [...gs, g]) }); };
  const create = (e) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Dê um nome para a meta.');
    if (target <= 0) return setErr('Informe o valor que você quer juntar.');
    setGoals((gs) => [...gs, { id: `g${Date.now()}`, name: name.trim(), icon: 'target', saved: 0, target, due }]);
    setName(''); setTarget(0); setErr('');
    toast('Meta criada');
    return undefined;
  };
  return (
    <ul className={`grid gap-4 ${cols}`}>
      {goals.map((g) => <GoalCard key={g.id} g={g} onContribute={contribute} onRemove={remove} />)}
      <li className="glass-milk rounded-3xl p-5">
        <form onSubmit={create} className="space-y-3" noValidate>
          <p className="flex items-center gap-2 text-[15px] font-extrabold tracking-[-0.02em]"><Icon name="plus" size={18} />Nova meta</p>
          <label className="block"><span className="lbl">Nome</span><input id="goal-name" className="field mt-1.5" placeholder="Ex.: Entrada do apartamento" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block min-w-0"><span className="lbl">Valor da meta</span><MoneyInput id="goal-target" label="Valor da meta" cents={target} onChange={setTarget} className="mt-1.5 font-bold" /></label>
            <label className="block min-w-0"><span className="lbl">Prazo</span><input id="goal-due" type="date" className="field mt-1.5" value={due} onChange={(e) => setDue(e.target.value)} /></label>
          </div>
          {err && <p className="text-xs font-semibold text-out">{err}</p>}
          <button type="submit" className="btn btn-primary w-full">Criar meta</button>
        </form>
      </li>
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Folha / diálogo                                                     */
/* ------------------------------------------------------------------ */
function Sheet({ variant, onClose, titleId, onSubmit, children, wide = false }) {
  const sheet = variant === 'sheet';
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className={`${sheet ? 'absolute' : 'fixed'} overlay-in inset-0 z-[70] flex backdrop-blur-md ${sheet ? 'items-end' : 'items-center justify-center p-4'}`}
      style={{ background: 'var(--scrim)' }} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby={titleId} noValidate
        className={`glass-deep no-scrollbar w-full overflow-y-auto ${sheet ? 'sheet-in max-h-[92%] rounded-b-none rounded-t-[32px] p-5 pb-7' : `dialog-in max-h-[calc(100dvh-32px)] p-6 sm:p-7 ${wide ? 'max-w-[560px]' : 'max-w-[480px]'}`}`}>
        {sheet && <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink/20" aria-hidden="true" />}
        {children}
      </form>
    </div>
  );
}

function SheetHead({ id, title, sub, onClose }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 id={id} className="text-[22px] font-extrabold tracking-[-0.02em]">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-ink/70">{sub}</p>}
      </div>
      <button type="button" className="icon-btn size-10 shrink-0" onClick={onClose} aria-label="Fechar"><Icon name="x" size={18} /></button>
    </div>
  );
}

function NewTxModal({ variant, initialType, onClose, onSubmit }) {
  const { cats, addCategory } = useApp();
  const [type, setType] = useState(initialType);
  const [cents, setCents] = useState(0);
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState(catKeys(cats, initialType)[0]);
  const [date, setDate] = useState(todayISO());
  const [errors, setErrors] = useState({});
  const [quick, setQuick] = useState(null);
  const titleId = cleanId(useId());
  useEffect(() => { if (variant !== 'sheet') { const el = document.getElementById('tx-amount'); if (el) el.focus({ preventScroll: true }); } }, []);
  const switchType = (t) => { setType(t); if (!cats[cat] || cats[cat].kind !== t) setCat(catKeys(cats, t)[0]); };
  const createQuick = () => {
    const label = (quick || '').trim();
    if (!label) return;
    const key = addCategory({ label, icon: 'tag', color: SWATCHES[(catKeys(cats, type).length * 5) % SWATCHES.length], kind: type, budget: 0 });
    setCat(key);
    setQuick(null);
  };
  const submit = (e) => {
    e.preventDefault();
    if (quick != null) { createQuick(); return; }
    const er = {};
    if (cents <= 0) er.amount = 'Informe um valor maior que R$ 0,00.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) er.date = 'Escolha a data da transação.';
    setErrors(er);
    if (Object.keys(er).length) return;
    onSubmit({ type, amount: cents, desc: desc.trim() || catOf(cats, cat, type).label, cat, date });
  };
  return (
    <Sheet variant={variant} onClose={onClose} titleId={titleId} onSubmit={submit}>
      <SheetHead id={titleId} title="Nova transação" sub="O painel atualiza assim que você salvar." onClose={onClose} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de transação">
        {[{ v: 'out', l: 'Despesa', i: 'up' }, { v: 'in', l: 'Receita', i: 'inArrow' }].map((o) => {
          const on = type === o.v;
          const tone = o.v === 'out' ? 'border-coral/60 bg-coral/15 text-out' : 'border-vivo/50 bg-vivo/15 text-in';
          return (
            <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => switchType(o.v)}
              className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-bold transition-all ${on ? tone : 'border-ink/10 bg-ink/[0.03] text-ink/70 hover:text-ink'}`}>
              <Icon name={o.i} size={16} strokeWidth={2.2} />{o.l}
            </button>
          );
        })}
      </div>
      <label className="mt-5 block">
        <span className="lbl">Valor</span>
        <MoneyInput id="tx-amount" label="Valor" cents={cents} onChange={setCents} invalid={errors.amount}
          className={`mt-2 !py-3 text-[30px] font-extrabold tracking-[-0.02em] ${type === 'in' ? 'text-in' : 'text-out'}`} />
        {errors.amount && <span className="mt-1.5 block text-xs font-semibold text-out">{errors.amount}</span>}
      </label>
      <label className="mt-4 block">
        <span className="lbl">Descrição</span>
        <input id="tx-desc" className="field mt-2" value={desc} maxLength={60} onChange={(e) => setDesc(e.target.value)} placeholder={type === 'in' ? 'Ex.: Freelance de site' : 'Ex.: Supermercado do mês'} />
      </label>
      <fieldset className="mt-4">
        <legend className="lbl">Categoria</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {catKeys(cats, type).map((k) => {
            const c = cats[k];
            const on = cat === k;
            return (
              <button key={k} type="button" aria-pressed={on} onClick={() => setCat(k)}
                className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-[11.5px] font-semibold transition-all ${on ? 'border-vivo/60 bg-vivo/15 text-ink shadow-[0_0_0_3px_rgba(20,128,107,.12)]' : 'border-ink/10 bg-ink/[0.03] text-ink/75 hover:bg-ink/[0.06]'}`}>
                <span style={{ color: c.color }}><Icon name={c.icon} size={18} /></span>
                <span className="w-full truncate text-center">{c.label}</span>
              </button>
            );
          })}
          {quick == null && (
            <button type="button" onClick={() => setQuick('')} className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-ink/25 px-1 py-2.5 text-[11.5px] font-semibold text-ink/75 hover:bg-ink/[0.04]">
              <Icon name="plus" size={18} />Nova categoria
            </button>
          )}
        </div>
        {quick != null && (
          <div className="mt-2 flex gap-2">
            <input id="tx-newcat" autoFocus className="field !rounded-full !py-2 text-sm" placeholder="Nome da nova categoria" value={quick} maxLength={24} onChange={(e) => setQuick(e.target.value)} />
            <button type="button" className="btn btn-primary !px-4 !py-2 text-[13px]" onClick={createQuick} disabled={!quick.trim()}>Criar</button>
            <button type="button" className="icon-btn size-10 shrink-0" aria-label="Cancelar nova categoria" onClick={() => setQuick(null)}><Icon name="x" size={16} /></button>
          </div>
        )}
      </fieldset>
      <label className="mt-4 block">
        <span className="lbl">Data</span>
        <input id="tx-date" type="date" className="field mt-2" value={date} aria-invalid={!!errors.date} onChange={(e) => setDate(e.target.value)} />
        <span className={`mt-1.5 block text-xs ${errors.date ? 'font-semibold text-out' : 'text-ink/65'}`}>{errors.date || `Será registrada em ${fmtDate(date)}`}</span>
      </label>
      <div className="mt-6 flex gap-2">
        <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn btn-primary flex-[1.6]"><Icon name="check" size={17} strokeWidth={2.4} />{type === 'in' ? 'Adicionar receita' : 'Adicionar despesa'}</button>
      </div>
    </Sheet>
  );
}

function CategoryEditor({ variant, catKey, initialKind = 'out', onClose }) {
  const { cats, txs, saveCategory, deleteCategory } = useApp();
  const existing = catKey ? cats[catKey] : null;
  const [label, setLabel] = useState(existing ? existing.label : '');
  const [kind, setKind] = useState(existing ? existing.kind : initialKind);
  const [icon, setIcon] = useState(existing ? existing.icon : 'tag');
  const [color, setColor] = useState(existing ? existing.color : SWATCHES[4]);
  const [budget, setBudget] = useState(existing ? existing.budget || 0 : 0);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const titleId = cleanId(useId());
  const used = catKey ? txs.filter((t) => t.cat === catKey).length : 0;
  const submit = (e) => {
    e.preventDefault();
    const name = label.trim();
    if (!name) { setErr('Dê um nome para a categoria.'); return; }
    const dup = Object.keys(cats).some((k) => k !== catKey && cats[k].label.toLowerCase() === name.toLowerCase() && cats[k].kind === kind);
    if (dup) { setErr('Já existe uma categoria com esse nome.'); return; }
    saveCategory(catKey, { label: name, kind, icon, color, budget: kind === 'out' ? budget : 0 });
    onClose();
  };
  return (
    <Sheet variant={variant} onClose={onClose} titleId={titleId} onSubmit={submit} wide>
      <SheetHead id={titleId} title={existing ? 'Editar categoria' : 'Nova categoria'} sub={existing ? `${used} transações usam esta categoria.` : 'Ela aparece na hora no registro de transações.'} onClose={onClose} />
      <div className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-ink/[0.03] p-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${color}22`, color, boxShadow: `inset 0 0 0 1px ${color}40` }}><Icon name={icon} size={22} /></span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold">{label.trim() || 'Nome da categoria'}</p>
          <p className="text-xs text-ink/65">{kind === 'out' ? 'Despesa' : 'Receita'}{kind === 'out' && budget > 0 ? ` · orçamento ${fmtBRL(budget)}/mês` : ''}</p>
        </div>
      </div>
      <label className="mt-4 block">
        <span className="lbl">Nome</span>
        <input id="cat-name" className="field mt-2" value={label} maxLength={24} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Mercado do bairro" aria-invalid={!!err} />
      </label>
      <div className="mt-4">
        <span className="lbl">Tipo</span>
        <div className="mt-2">
          <Segmented full label="Tipo da categoria" value={kind} onChange={(v) => { if (!used) setKind(v); }} options={[{ value: 'out', label: 'Despesa' }, { value: 'in', label: 'Receita' }]} />
          {used > 0 && <p className="mt-1.5 text-xs text-ink/60">O tipo não muda enquanto houver transações nesta categoria.</p>}
        </div>
      </div>
      <fieldset className="mt-4">
        <legend className="lbl">Ícone</legend>
        <div className="mt-2 grid grid-cols-10 gap-1.5 max-sm:grid-cols-5">
          {ICON_CHOICES.map((ic) => (
            <button key={ic} type="button" aria-pressed={icon === ic} aria-label={`Ícone ${ic}`} onClick={() => setIcon(ic)}
              className={`grid aspect-square place-items-center rounded-xl border transition-all ${icon === ic ? 'border-vivo/70 bg-vivo/15 text-ink' : 'border-ink/10 text-ink/70 hover:bg-ink/[0.05]'}`}>
              <Icon name={ic} size={17} />
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-4">
        <legend className="lbl">Cor</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SWATCHES.map((c) => (
            <button key={c} type="button" aria-pressed={color === c} aria-label={`Cor ${c}`} onClick={() => setColor(c)}
              className={`size-8 rounded-full transition-transform ${color === c ? 'scale-110' : 'hover:scale-105'}`}
              style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--paper), 0 0 0 4px ${c}` : 'none' }} />
          ))}
        </div>
      </fieldset>
      {kind === 'out' && (
        <label className="mt-4 block">
          <span className="lbl">Orçamento mensal</span>
          <MoneyInput id="cat-budget" label="Orçamento mensal" cents={budget} onChange={setBudget} className="mt-2 font-bold" />
          <span className="mt-1.5 block text-xs text-ink/65">Deixe em R$ 0,00 para não ter limite. O alerta aparece ao chegar em 80%.</span>
        </label>
      )}
      {err && <p className="mt-3 text-xs font-semibold text-out">{err}</p>}
      {confirm ? (
        <div className="mt-6 rounded-2xl border border-coral/40 bg-coral/10 p-4">
          <p className="text-sm font-bold">Excluir “{existing.label}”?</p>
          <p className="mt-1 text-xs text-ink/70">{used ? `${used} transações passam para “${kind === 'in' ? 'Outras receitas' : 'Outros gastos'}”.` : 'Nenhuma transação usa esta categoria.'}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-ghost flex-1 !py-2" onClick={() => setConfirm(false)}>Manter</button>
            <button type="button" className="btn btn-danger flex-1 !py-2" onClick={() => { deleteCategory(catKey); onClose(); }}>Excluir</button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex gap-2">
          {existing && !existing.locked && <button type="button" className="icon-btn size-11 shrink-0" aria-label="Excluir categoria" onClick={() => setConfirm(true)}><Icon name="trash" size={17} /></button>}
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary flex-[1.6]"><Icon name="check" size={17} strokeWidth={2.4} />{existing ? 'Salvar' : 'Criar categoria'}</button>
        </div>
      )}
    </Sheet>
  );
}

function Toast({ toast, onClose, inPhone }) {
  if (!toast) return null;
  return (
    <div key={toast.id} role="status" style={{ transform: 'translateX(-50%)' }}
      className={`glass-deep toast-in z-[80] flex items-center gap-3 rounded-full py-2.5 pl-4 pr-2.5 text-[13px] font-semibold ${inPhone ? 'absolute bottom-[104px] left-1/2 w-[calc(100%-40px)]' : 'fixed bottom-[calc(24px+env(safe-area-inset-bottom,0px))] left-1/2 max-w-[calc(100%-32px)]'}`}>
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-vivo text-white"><Icon name="check" size={14} strokeWidth={2.6} /></span>
      <span className="min-w-0 flex-1">{toast.msg}</span>
      {toast.action ? (
        <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => { toast.action.run(); onClose(); }}>{toast.action.label}</button>
      ) : (
        <button type="button" className="icon-btn size-7 border-transparent" aria-label="Fechar aviso" onClick={onClose}><Icon name="x" size={14} /></button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Listas de transações                                                */
/* ------------------------------------------------------------------ */
function TxRow({ t, fresh, onDelete }) {
  const { cats } = useApp();
  const c = catOf(cats, t.cat, t.type);
  return (
    <li className={`group grid grid-cols-[minmax(0,1fr)_auto_32px] items-center gap-x-3 rounded-2xl border-t border-ink/[0.06] px-2 py-3 transition-colors hover:bg-ink/[0.03] md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_92px_minmax(0,1.1fr)_32px] ${fresh ? 'flash' : ''}`}>
      <div className="flex min-w-0 items-center gap-3">
        <CatIcon cat={t.cat} kind={t.type} size={38} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{t.desc}</p>
          <p className="truncate text-xs text-ink/65 md:hidden">{c.label} · {fmtDate(t.date)}</p>
        </div>
      </div>
      <div className="hidden min-w-0 md:block"><CatPill cat={t.cat} kind={t.type} /></div>
      <div className="hidden text-[13px] tabular-nums text-ink/75 md:block">{fmtDate(t.date)}</div>
      <div className="text-right text-[14px]"><Signed t={t} /></div>
      {onDelete ? (
        <button type="button" aria-label={`Remover ${t.desc} de ${fmtDate(t.date)}`} onClick={() => onDelete(t)}
          className="icon-btn size-8 border-transparent bg-transparent text-ink/60 hover:text-out md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100">
          <Icon name="trash" size={15} />
        </button>
      ) : <span />}
    </li>
  );
}

function TxHeader() {
  return (
    <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_92px_minmax(0,1.1fr)_32px] gap-x-3 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink/60 md:grid">
      <span>Descrição</span><span>Categoria</span><span>Data</span><span className="text-right">Valor</span><span />
    </div>
  );
}

function TxExplorer({ month, setMonth, fin }) {
  const { txs, cats, freshId, deleteTx } = useApp();
  const m = useMoneyText();
  const [scope, setScope] = useState('month');
  const [type, setType] = useState('all');
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [limit, setLimit] = useState(12);
  useEffect(() => setLimit(12), [scope, type, cat, q, month, sort]);
  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = txs
      .filter((t) => scope === 'all' || monthKey(t.date) === month)
      .filter((t) => type === 'all' || t.type === type)
      .filter((t) => cat === 'all' || t.cat === cat)
      .filter((t) => !qq || `${t.desc} ${catOf(cats, t.cat, t.type).label}`.toLowerCase().includes(qq));
    const sorters = { recent: byDateDesc, old: (a, b) => -byDateDesc(a, b), high: (a, b) => b.amount - a.amount, low: (a, b) => a.amount - b.amount };
    return list.sort(sorters[sort]);
  }, [txs, cats, scope, month, type, cat, q, sort]);
  const sumIn = rows.filter((t) => t.type === 'in').reduce((a, t) => a + t.amount, 0);
  const sumOut = rows.filter((t) => t.type === 'out').reduce((a, t) => a + t.amount, 0);
  const catOptions = Object.keys(cats).filter((k) => type === 'all' || cats[k].kind === type);
  const changeType = (v) => { setType(v); if (cat !== 'all' && v !== 'all' && cats[cat] && cats[cat].kind !== v) setCat('all'); };
  const filtered = type !== 'all' || cat !== 'all' || q;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented size="sm" label="Período" value={scope} onChange={setScope} options={[{ value: 'month', label: 'Mês' }, { value: 'all', label: 'Todo o período' }]} />
        {scope === 'month' && <MonthSwitch compact month={month} min={fin.minM} max={fin.maxM} onChange={setMonth} />}
        <Segmented size="sm" label="Filtrar por tipo" value={type} onChange={changeType} options={[{ value: 'all', label: 'Todas' }, { value: 'in', label: 'Receitas' }, { value: 'out', label: 'Despesas' }]} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select id="filter-cat" aria-label="Filtrar por categoria" className="field !w-auto !rounded-full !py-2 text-[13px]" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">Todas as categorias</option>
          {catOptions.map((k) => <option key={k} value={k}>{cats[k].label}</option>)}
        </select>
        <select id="filter-sort" aria-label="Ordenar" className="field !w-auto !rounded-full !py-2 text-[13px]" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Mais recentes</option>
          <option value="old">Mais antigas</option>
          <option value="high">Maior valor</option>
          <option value="low">Menor valor</option>
        </select>
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Buscar movimentação</span>
          <Icon name="search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/60" />
          <input id="filter-q" className="field !rounded-full !py-2 !pl-10 text-[13px]" placeholder="Buscar por descrição ou categoria" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-ink/[0.04] px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-ink/65">Movimentações</p><p className="text-lg font-extrabold tabular-nums">{rows.length}</p></div>
        <div className="rounded-2xl bg-ink/[0.04] px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-ink/65">Entradas</p><p className="text-lg font-extrabold tabular-nums text-in">{m(sumIn)}</p></div>
        <div className="rounded-2xl bg-ink/[0.04] px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-ink/65">Saídas</p><p className="text-lg font-extrabold tabular-nums text-out">{m(sumOut)}</p></div>
      </div>
      <div className="mt-5"><TxHeader /></div>
      <ul aria-label="Movimentações">{rows.slice(0, limit).map((t) => <TxRow key={t.id} t={t} fresh={t.id === freshId} onDelete={deleteTx} />)}</ul>
      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-ink/15 px-4 py-10 text-center">
          <p className="text-sm font-semibold">Nenhuma movimentação encontrada.</p>
          <p className="mt-1 text-xs text-ink/65">{filtered ? 'Ajuste os filtros ou limpe a busca.' : 'Use “Nova transação” para registrar a primeira.'}</p>
          {filtered && <button type="button" className="btn btn-ghost mt-4 !py-2 text-xs" onClick={() => { setType('all'); setCat('all'); setQ(''); }}>Limpar filtros</button>}
        </div>
      )}
      {rows.length > limit && (
        <div className="mt-4 flex justify-center">
          <button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => setLimit((l) => l + 12)}>Mostrar mais {Math.min(12, rows.length - limit)} de {rows.length - limit}</button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Categorias                                                          */
/* ------------------------------------------------------------------ */
function CategoriesManager({ month, compact = false }) {
  const { cats, txs, openCatEditor } = useApp();
  const m = useMoneyText();
  const [kind, setKind] = useState('out');
  const stats = useMemo(() => {
    const o = {};
    txs.forEach((t) => {
      const s = o[t.cat] || (o[t.cat] = { count: 0, month: 0 });
      s.count += 1;
      if (monthKey(t.date) === month) s.month += t.amount;
    });
    return o;
  }, [txs, month]);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented size="sm" label="Tipo de categoria" value={kind} onChange={setKind} options={[{ value: 'out', label: `Despesas (${catKeys(cats, 'out').length})` }, { value: 'in', label: `Receitas (${catKeys(cats, 'in').length})` }]} />
        <button type="button" className="btn btn-primary !py-2.5 text-[13px]" onClick={() => openCatEditor(null, kind)}><Icon name="plus" size={16} strokeWidth={2.4} />Nova categoria</button>
      </div>
      <ul className={`mt-5 grid gap-3 ${compact ? '' : 'md:grid-cols-2 2xl:grid-cols-3'}`}>
        {catKeys(cats, kind).map((k) => {
          const c = cats[k];
          const s = stats[k] || { count: 0, month: 0 };
          const pct = c.budget ? Math.round((s.month / c.budget) * 100) : null;
          const state = pct == null ? '' : pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
          return (
            <li key={k} className="glass rounded-3xl p-4">
              <div className="flex items-center gap-3">
                <CatIcon cat={k} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-[14.5px] font-extrabold">{c.label}{c.custom && <span className="rounded-full bg-ouro/20 px-1.5 py-0.5 text-[10px] font-bold text-[#8A5A00]">nova</span>}</p>
                  <p className="truncate text-xs text-ink/65">{s.count} transações · {m(s.month)} em {monthName(month).toLowerCase()}</p>
                </div>
                <button type="button" className="icon-btn size-9 shrink-0" aria-label={`Editar ${c.label}`} onClick={() => openCatEditor(k)}><Icon name="edit" size={15} /></button>
              </div>
              {c.kind === 'out' && (pct == null ? (
                <button type="button" onClick={() => openCatEditor(k)} className="mt-3 w-full rounded-xl border border-dashed border-ink/15 py-2 text-xs font-semibold text-ink/65 hover:bg-ink/[0.03]">Definir orçamento mensal</button>
              ) : (
                <div className="mt-3">
                  <div className="flex justify-between text-xs tabular-nums text-ink/70"><span>Orçamento {m(c.budget)}</span><b className={state === 'over' ? 'text-out' : 'text-ink'}>{pct}%</b></div>
                  <div className="track mt-1.5"><i className={state} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                </div>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Configurações                                                       */
/* ------------------------------------------------------------------ */
const SETTINGS_TABS = [
  { id: 'perfil', label: 'Perfil', icon: 'user', desc: 'Nome, contato e cidade' },
  { id: 'acesso', label: 'Acesso e segurança', icon: 'lock', desc: 'Senha, 2 etapas, sessões e histórico' },
  { id: 'preferencias', label: 'Preferências', icon: 'palette', desc: 'Tema, privacidade e meta de poupança' },
  { id: 'notificacoes', label: 'Notificações', icon: 'bell', desc: 'Alertas de orçamento, contas e acessos' },
];

function Panel({ title, sub, children, tone }) {
  return (
    <div className={`min-w-0 rounded-3xl border p-5 ${tone === 'danger' ? 'border-coral/30 bg-coral/[0.06]' : 'border-ink/[0.08] bg-ink/[0.02]'}`}>
      {title && <p className="text-[15px] font-extrabold tracking-[-0.02em]">{title}</p>}
      {sub && <p className="mt-0.5 text-xs text-ink/65">{sub}</p>}
      {children}
    </div>
  );
}

function SettingsProfile() {
  const { profile, setProfile, toast } = useApp();
  const narrow = useNarrow();
  const [d, setD] = useState(profile);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setD((p) => ({ ...p, [k]: e.target.value }));
  const phoneMask = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 11);
    const f = v.length > 6 ? `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}` : v.length > 2 ? `(${v.slice(0, 2)}) ${v.slice(2)}` : v;
    setD((p) => ({ ...p, phone: f }));
  };
  const dirty = JSON.stringify(d) !== JSON.stringify(profile);
  const save = (e) => {
    e.preventDefault();
    if (!d.name.trim()) { setErr('Informe seu nome.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(d.email)) { setErr('Informe um e-mail válido.'); return; }
    setErr('');
    setProfile({ ...d, name: d.name.trim() });
    toast('Perfil atualizado');
  };
  return (
    <form onSubmit={save} noValidate className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-vivo to-leco text-2xl font-extrabold text-white ring-[3px] ring-ouro/70">{(d.name || '?').trim().charAt(0).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="text-lg font-extrabold tracking-[-0.02em]">{d.name || 'Seu nome'}</p>
          <p className="text-xs text-ink/65">Membro desde {fmtDate(profile.since)} · Conta pessoal</p>
        </div>
      </div>
      <div className={`grid gap-4 ${narrow ? '' : 'sm:grid-cols-2'}`}>
        <label className="block"><span className="lbl">Nome completo</span><input id="pf-name" className="field mt-2" value={d.name} onChange={set('name')} autoComplete="name" /></label>
        <label className="block"><span className="lbl">E-mail</span><input id="pf-email" type="email" className="field mt-2" value={d.email} onChange={set('email')} autoComplete="email" /></label>
        <label className="block"><span className="lbl">Celular</span><input id="pf-phone" inputMode="tel" className="field mt-2" value={d.phone} onChange={phoneMask} placeholder="(11) 90000-0000" /></label>
        <label className="block"><span className="lbl">Cidade</span><input id="pf-city" className="field mt-2" value={d.city} onChange={set('city')} /></label>
      </div>
      {err && <p className="text-xs font-semibold text-out">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={!dirty}><Icon name="check" size={16} strokeWidth={2.4} />Salvar perfil</button>
        {dirty && <button type="button" className="btn btn-ghost" onClick={() => { setD(profile); setErr(''); }}>Descartar</button>}
      </div>
    </form>
  );
}

function strengthOf(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function SettingsAccess() {
  const { profile, security, setSecurity, sessions, setSessions, accessLog, setAccessLog, toast } = useApp();
  const [pw, setPw] = useState({ cur: '', next: '', conf: '' });
  const [pwErr, setPwErr] = useState('');
  const [showLog, setShowLog] = useState(5);
  const narrow = useNarrow();
  const st = strengthOf(pw.next);
  const stLabel = ['Muito fraca', 'Fraca', 'Média', 'Boa', 'Forte', 'Muito forte'][st];
  const checks = [
    { ok: true, label: 'E-mail verificado' },
    { ok: security.pwStrong, label: 'Senha forte' },
    { ok: security.twoFA, label: 'Verificação em duas etapas' },
    { ok: security.loginAlerts, label: 'Alertas de novo acesso' },
  ];
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const changePw = (e) => {
    e.preventDefault();
    if (!pw.cur) { setPwErr('Digite a senha atual.'); return; }
    if (pw.next.length < 8) { setPwErr('A nova senha precisa de pelo menos 8 caracteres.'); return; }
    if (pw.next !== pw.conf) { setPwErr('A confirmação não confere com a nova senha.'); return; }
    if (pw.next === pw.cur) { setPwErr('Escolha uma senha diferente da atual.'); return; }
    setPwErr('');
    setSecurity((s) => ({ ...s, pwStrong: st >= 4, pwChanged: todayISO() }));
    setAccessLog((l) => [{ id: `a${Date.now()}`, when: nowStamp(), device: 'Chrome · Windows', place: profile.city, ip: '189.40.•••.12', method: 'Senha alterada', ok: true }, ...l]);
    setPw({ cur: '', next: '', conf: '' });
    toast('Senha alterada');
  };
  return (
    <div className="space-y-5">
      <div className={`grid gap-5 ${narrow ? '' : '2xl:grid-cols-2'}`}>
        <Panel title="Proteção da conta">
          <div className="mt-3 flex items-center gap-3">
            <div className="track flex-1"><i className={score < 100 ? 'warn' : ''} style={{ width: `${score}%` }} /></div>
            <span className={score === 100 ? 'pill pill-good' : 'badge-gold'}>{score}%</span>
          </div>
          <ul className="mt-4 space-y-2">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2.5 text-[13px]">
                <span className={`grid size-5 place-items-center rounded-full ${c.ok ? 'bg-vivo text-white' : 'bg-ouro/25 text-[#8A5A00]'}`}><Icon name={c.ok ? 'check' : 'alert'} size={12} strokeWidth={2.6} /></span>
                <span className={c.ok ? '' : 'font-semibold'}>{c.label}</span>
                {!c.ok && <span className="text-xs text-ink/60">· recomendado</span>}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Dados de acesso">
          <dl className="mt-2 divide-y divide-ink/[0.07] text-[13px]">
            {[
              ['E-mail de login', profile.email, 'mail'],
              ['Senha', `•••••••• · alterada em ${fmtDate(security.pwChanged)}`, 'key'],
              ['Duas etapas', security.twoFA ? 'Ativa · app autenticador' : 'Desativada', 'shield'],
              ['Último acesso', accessLog[0] ? `${accessLog[0].when} · ${accessLog[0].place}` : '—', 'clock'],
              ['Sessões abertas', `${sessions.length} ${sessions.length === 1 ? 'dispositivo' : 'dispositivos'}`, 'monitor'],
            ].map(([k, v, ic]) => (
              <div key={k} className={narrow ? 'py-2.5' : 'flex items-center gap-3 py-2.5'}>
                {!narrow && <Icon name={ic} size={16} className="shrink-0 text-ink/60" />}
                <dt className={narrow ? 'text-xs text-ink/65' : 'w-[104px] shrink-0 text-ink/65'}>{k}</dt>
                <dd className={narrow ? 'break-words font-semibold' : 'min-w-0 truncate font-semibold'}>{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel title="Segurança">
        <div className="divide-y divide-ink/[0.07]">
          <Toggle id="sec-2fa" icon="shield" label="Verificação em duas etapas" desc="Pede um código do app autenticador a cada novo login." checked={security.twoFA} onChange={(v) => { setSecurity((s) => ({ ...s, twoFA: v })); toast(v ? 'Duas etapas ativada' : 'Duas etapas desativada'); }} />
          <Toggle id="sec-alerts" icon="bell" label="Alertas de novo acesso" desc="Avisa por e-mail quando alguém entrar de um aparelho novo." checked={security.loginAlerts} onChange={(v) => setSecurity((s) => ({ ...s, loginAlerts: v }))} />
          <Toggle id="sec-bio" icon="finger" label="Entrar com biometria no celular" desc="Usa Face ID ou impressão digital no app." checked={security.biometrics} onChange={(v) => setSecurity((s) => ({ ...s, biometrics: v }))} />
        </div>
      </Panel>

      <form onSubmit={changePw} noValidate>
        <Panel title="Alterar senha" sub="Use 12 ou mais caracteres, com letras maiúsculas, números e símbolos.">
          <div className={`mt-4 grid gap-3 ${narrow ? '' : 'sm:grid-cols-3'}`}>
            <label className="block"><span className="lbl">Senha atual</span><input id="pw-cur" type="password" autoComplete="current-password" className="field mt-2" value={pw.cur} onChange={(e) => setPw((p) => ({ ...p, cur: e.target.value }))} /></label>
            <label className="block"><span className="lbl">Nova senha</span><input id="pw-new" type="password" autoComplete="new-password" className="field mt-2" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} /></label>
            <label className="block"><span className="lbl">Confirmar</span><input id="pw-conf" type="password" autoComplete="new-password" className="field mt-2" value={pw.conf} onChange={(e) => setPw((p) => ({ ...p, conf: e.target.value }))} /></label>
          </div>
          {pw.next && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex flex-1 gap-1">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < st ? (st <= 2 ? '#E0714F' : st === 3 ? '#E8A317' : '#14806B') : 'color-mix(in srgb, var(--ink) 10%, transparent)' }} />)}</div>
              <span className="text-xs font-bold">{stLabel}</span>
            </div>
          )}
          {pwErr && <p className="mt-3 text-xs font-semibold text-out">{pwErr}</p>}
          <button type="submit" className="btn btn-primary mt-4"><Icon name="key" size={16} />Atualizar senha</button>
        </Panel>
      </form>

      <Panel title="Sessões ativas" sub="Aparelhos conectados à sua conta agora.">
        {sessions.length > 1 && (
          <button type="button" className="btn btn-ghost mt-3 !py-2 text-[13px]" onClick={() => { setSessions((s) => s.filter((x) => x.current)); toast('Outras sessões encerradas'); }}>
            <Icon name="logout" size={15} />Encerrar as outras sessões
          </button>
        )}
        <ul className="mt-2 divide-y divide-ink/[0.07]">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink/[0.06]"><Icon name={s.icon} size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold">{s.device}{s.current && <span className="pill pill-good !py-0.5 text-[10.5px]">este aparelho</span>}</p>
                <p className="truncate text-xs text-ink/65">{s.place} · IP {s.ip} · {s.last}</p>
              </div>
              {!s.current && <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => { setSessions((x) => x.filter((y) => y.id !== s.id)); toast('Sessão encerrada'); }}>Encerrar</button>}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Histórico de acessos" sub="Últimas entradas na conta, com local aproximado.">
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-ink/60">
                <th className="py-2 pr-3 font-semibold">Data e hora</th><th className="py-2 pr-3 font-semibold">Dispositivo</th><th className="py-2 pr-3 font-semibold">Local</th><th className="py-2 pr-3 font-semibold">Método</th><th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {accessLog.slice(0, showLog).map((a) => (
                <tr key={a.id} className="border-t border-ink/[0.07]">
                  <td className="py-2.5 pr-3 tabular-nums">{a.when}</td>
                  <td className="py-2.5 pr-3 font-semibold">{a.device}</td>
                  <td className="py-2.5 pr-3 text-ink/75">{a.place}<span className="block text-[11px] text-ink/60">IP {a.ip}</span></td>
                  <td className="py-2.5 pr-3 text-ink/75">{a.method}</td>
                  <td className="py-2.5"><span className={`pill ${a.ok ? 'pill-good' : 'pill-bad'}`}>{a.ok ? 'Permitido' : 'Bloqueado'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {accessLog.length > showLog && <button type="button" className="btn btn-ghost mt-3 !py-2 text-[13px]" onClick={() => setShowLog((n) => n + 5)}>Ver mais acessos</button>}
      </Panel>
    </div>
  );
}

function SettingsPrefs() {
  const { prefs, setPrefs, resetAll, clearAll } = useApp();
  const narrow = useNarrow();
  const [confirm, setConfirm] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const set = (k, v) => setPrefs((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-5">
      <Panel title="Aparência" sub="O tema claro usa fundo branco; o escuro usa o Verde Noite da marca.">
        <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
          {[{ v: 'light', l: 'Claro', i: 'sun', bg: '#FFFFFF', fg: '#0B2F29' }, { v: 'dark', l: 'Escuro', i: 'moon', bg: '#0B2F29', fg: '#E4EFEA' }].map((o) => (
            <button key={o.v} type="button" aria-pressed={prefs.theme === o.v} onClick={() => set('theme', o.v)}
              className={`rounded-2xl border p-2 text-left transition-all ${prefs.theme === o.v ? 'border-vivo shadow-[0_0_0_3px_rgba(20,128,107,.18)]' : 'border-ink/15 hover:border-ink/30'}`}>
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
          <Toggle id="pref-hide" icon="eyeOff" label="Ocultar valores" desc="Esconde saldos e valores em todo o app. Útil em lugares públicos." checked={prefs.hide} onChange={(v) => set('hide', v)} />
          <Toggle id="pref-calm" icon="sparkle" label="Reduzir animações" desc="Desliga os movimentos do fundo e das transições." checked={prefs.calm} onChange={(v) => set('calm', v)} />
        </div>
      </Panel>
      <Panel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-extrabold tracking-[-0.02em]">Meta de poupança mensal</p>
            <p className="mt-0.5 text-xs text-ink/65">Parte da renda que você quer guardar todo mês.</p>
          </div>
          <span className="badge-gold text-sm">{prefs.savingsGoal}%</span>
        </div>
        <input id="pref-goal" type="range" min="5" max="60" step="5" value={prefs.savingsGoal} onChange={(e) => set('savingsGoal', Number(e.target.value))} className="mt-4 w-full" aria-label="Meta de poupança em porcentagem" />
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-ink/60"><span>5%</span><span>60%</span></div>
      </Panel>
      <Panel title="Saldo inicial" sub="Quanto havia na conta antes da primeira transação registrada. Entra no cálculo do saldo total.">
        <div className="mt-3 max-w-xs">
          <MoneyInput id="pref-opening" label="Saldo inicial" cents={prefs.opening == null ? OPENING_BALANCE : prefs.opening} onChange={(v) => set('opening', v)} className="font-bold" />
        </div>
      </Panel>
      <Panel title="Regionais">
        <div className={`mt-3 grid gap-3 ${narrow ? '' : 'sm:grid-cols-3'}`}>
          <div><span className="lbl">Moeda</span><p className="field mt-2 font-semibold">Real (R$)</p></div>
          <div><span className="lbl">Formato de data</span><p className="field mt-2 font-semibold">DD/MM/AAAA</p></div>
          <label className="block"><span className="lbl">Semana começa</span>
            <select id="pref-week" className="field mt-2" value={prefs.weekStart} onChange={(e) => set('weekStart', e.target.value)}>
              <option value="dom">Domingo</option><option value="seg">Segunda-feira</option>
            </select>
          </label>
        </div>
      </Panel>
      <Panel title="Seus dados" tone="danger" sub="Tudo fica salvo neste aparelho. Para usar o Leco de verdade, apague os exemplos e comece do zero (as categorias continuam).">
        {confirmClear ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-danger !py-2 text-[13px]" onClick={() => { clearAll(); setConfirmClear(false); }}>Sim, apagar transações e metas</button>
            <button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => setConfirmClear(false)}>Cancelar</button>
          </div>
        ) : <button type="button" className="btn btn-ghost mt-3 !py-2 text-[13px]" onClick={() => setConfirmClear(true)}><Icon name="trash" size={15} />Começar do zero</button>}
      </Panel>
      <Panel title="Dados de exemplo" tone="danger" sub="Restaurar volta tudo aos dados fictícios iniciais.">
        {confirm ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-danger !py-2 text-[13px]" onClick={() => { resetAll(); setConfirm(false); }}>Sim, restaurar tudo</button>
            <button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => setConfirm(false)}>Cancelar</button>
          </div>
        ) : <button type="button" className="btn btn-ghost mt-3 !py-2 text-[13px]" onClick={() => setConfirm(true)}><Icon name="refresh" size={15} />Restaurar dados de exemplo</button>}
      </Panel>
    </div>
  );
}

function SettingsNotifs() {
  const { notifPrefs, setNotifPrefs } = useApp();
  const set = (k) => (v) => setNotifPrefs((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-5">
      <Panel title="Alertas no app">
        <div className="divide-y divide-ink/[0.07]">
          <Toggle id="nt-budget" icon="alert" label="Orçamento perto do limite" desc="Avisa quando uma categoria passa de 80% do orçamento do mês." checked={notifPrefs.budget} onChange={set('budget')} />
          <Toggle id="nt-goals" icon="target" label="Progresso das metas" desc="Avisa quando uma meta passa de 75%." checked={notifPrefs.goals} onChange={set('goals')} />
          <Toggle id="nt-bills" icon="calendar" label="Contas a vencer" desc="Lembra aluguel, condomínio e assinaturas 3 dias antes." checked={notifPrefs.bills} onChange={set('bills')} />
          <Toggle id="nt-access" icon="lock" label="Acessos suspeitos" desc="Mostra tentativas de login bloqueadas." checked={notifPrefs.access} onChange={set('access')} />
        </div>
      </Panel>
      <Panel title="Por e-mail">
        <div className="divide-y divide-ink/[0.07]">
          <Toggle id="nt-weekly" icon="mail" label="Resumo semanal" desc="Receitas, despesas e metas da semana no seu e-mail." checked={notifPrefs.weekly} onChange={set('weekly')} />
        </div>
        <label className="mt-2 block max-w-xs">
          <span className="lbl">Horário do resumo</span>
          <select id="nt-hour" className="field mt-2" value={notifPrefs.summaryHour} disabled={!notifPrefs.weekly} onChange={(e) => setNotifPrefs((p) => ({ ...p, summaryHour: e.target.value }))}>
            {['07:00', '08:00', '12:00', '18:00', '21:00'].map((h) => <option key={h} value={h}>{h} de domingo</option>)}
          </select>
        </label>
      </Panel>
    </div>
  );
}

const SETTINGS_VIEWS = { perfil: SettingsProfile, acesso: SettingsAccess, preferencias: SettingsPrefs, notificacoes: SettingsNotifs };

/* ------------------------------------------------------------------ */
/* MODO WEB · abas                                                     */
/* ------------------------------------------------------------------ */
const WEB_TABS = [
  { id: 'inicio', label: 'Visão geral', icon: 'home' },
  { id: 'transacoes', label: 'Transações', icon: 'list' },
  { id: 'analises', label: 'Análises', icon: 'pie' },
  { id: 'metas', label: 'Metas', icon: 'target' },
  { id: 'categorias', label: 'Categorias', icon: 'grid' },
  { id: 'config', label: 'Configurações', icon: 'settings' },
];

function KpiCard({ label, icon, children, delta, vsLabel, spark, sparkColor, hero, delay = 0 }) {
  return (
    <article className={`${hero ? 'glass-hero' : 'glass'} rise flex min-w-0 flex-col gap-4 p-5 sm:p-6`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${hero ? 'bg-ouro/25 text-ouro' : 'bg-ink/[0.06] text-ink'}`}><Icon name={icon} size={18} /></span>
          <h3 className="truncate text-[13px] font-semibold text-ink/80">{label}</h3>
        </div>
        {delta}
      </div>
      <div className="whitespace-nowrap text-[28px] font-extrabold leading-none tracking-[-0.02em]">{children}</div>
      <div className="flex items-end justify-between gap-4">
        <span className="text-xs text-ink/70">{vsLabel}</span>
        {spark && <div className="w-28 shrink-0"><Spark values={spark} color={sparkColor} height={34} /></div>}
      </div>
    </article>
  );
}

function OverviewPage({ fin, month, setMonth, go }) {
  const { profile, prefs, txs, freshId, openTx, P } = useApp();
  const { cur, prev, deltas, series } = fin;
  const prevName = monthName(fin.prevKey).toLowerCase();
  const recent = useMemo(() => txs.filter((t) => monthKey(t.date) === month).sort(byDateDesc).slice(0, 6), [txs, month]);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow={`${greeting()}, ${firstName(profile.name)}`} title={`Resumo de ${monthLabel(month)}`}>
        <MonthSwitch month={month} min={fin.minM} max={fin.maxM} onChange={setMonth} />
        <NotifButton />
        <button type="button" className="btn btn-primary" onClick={() => openTx('out')}><Icon name="plus" size={18} strokeWidth={2.4} />Nova transação</button>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2 min-[1500px]:grid-cols-4">
        <KpiCard hero label="Saldo total" icon="wallet" delta={<Delta value={deltas.bal} />} vsLabel={`vs. fim de ${prevName}`} spark={series.map((p) => p.bal)} sparkColor="#E8A317">
          <Money cents={cur.bal} />
        </KpiCard>
        <KpiCard label="Receitas do mês" icon="inArrow" delay={60} delta={<Delta value={deltas.in} />} vsLabel={`vs. ${prevName} (${fmtBRL(prev.in)})`} spark={series.map((p) => p.in)} sparkColor={P.in}>
          <Money cents={cur.in} />
        </KpiCard>
        <KpiCard label="Despesas do mês" icon="up" delay={120} delta={<Delta value={deltas.out} goodWhen="down" />} vsLabel={`vs. ${prevName} (${fmtBRL(prev.out)})`} spark={series.map((p) => p.out)} sparkColor={P.out}>
          <Money cents={cur.out} />
        </KpiCard>
        <KpiCard label="Resultado do mês" icon="sparkle" delay={180} delta={<Delta value={deltas.rate} unit=" p.p." />} vsLabel={`${fmtPctAbs(cur.rate)} poupado · meta ${prefs.savingsGoal}%`}>
          <Money cents={cur.net} className={cur.net >= 0 ? '' : 'text-out'} />
        </KpiCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <Card title="Fluxo de caixa" sub="Últimos 6 meses · passe o cursor para ver cada mês" delay={120}>
          <FlowChart fin={fin} month={month} height={270} />
        </Card>
        <Card title="Despesas por categoria" sub={`${monthLabel(month)} · ${fmtBRL(cur.out)} no total`} delay={180}>
          <CategoryBreakdown cats={fin.cats} />
        </Card>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <Card title="Últimas movimentações" sub={monthLabel(month)} delay={220}
          action={<button type="button" className="btn btn-ghost !py-2 text-[13px]" onClick={() => go('transacoes')}>Ver todas<Icon name="right" size={15} /></button>}>
          <TxHeader />
          <ul>{recent.map((t) => <TxRow key={t.id} t={t} fresh={t.id === freshId} />)}</ul>
          {recent.length === 0 && <p className="py-8 text-center text-sm text-ink/65">Nada registrado neste mês ainda.</p>}
        </Card>
        <Card title="Orçamentos do mês" sub="Categorias mais perto do limite" delay={260}>
          <BudgetList budgets={fin.budgets} limit={5} onManage={() => go('categorias')} />
        </Card>
      </div>
    </div>
  );
}

function AnalysisPage({ fin, month, setMonth }) {
  const m = useMoneyText();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Análises" title={`Para onde foi o dinheiro em ${monthName(month).toLowerCase()}`}>
        <MonthSwitch month={month} min={fin.minM} max={fin.maxM} onChange={setMonth} />
      </PageHeader>
      <Card title="Evolução em 6 meses" sub="Receitas, despesas e patrimônio">
        <FlowChart fin={fin} month={month} height={300} />
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Despesas por categoria" sub={`${monthLabel(month)} · ${fmtBRL(fin.cur.out)}`} delay={60}>
          <CategoryBreakdown cats={fin.cats} />
        </Card>
        <Card title="Comparativo com o mês anterior" sub={`${monthName(month)} × ${monthName(fin.prevKey)}`} delay={120}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[13px]">
              <thead><tr className="text-[11px] uppercase tracking-wider text-ink/60"><th className="py-2 pr-3 font-semibold">Categoria</th><th className="py-2 pr-3 text-right font-semibold">{MONTHS_SHORT[Number(month.slice(5, 7)) - 1]}</th><th className="py-2 pr-3 text-right font-semibold">{MONTHS_SHORT[Number(fin.prevKey.slice(5, 7)) - 1]}</th><th className="py-2 text-right font-semibold">Variação</th></tr></thead>
              <tbody>
                {fin.compare.map((r) => (
                  <tr key={r.key} className="border-t border-ink/[0.07]">
                    <td className="py-2.5 pr-3"><span className="flex items-center gap-2 font-semibold"><CatIcon cat={r.key} size={28} />{r.label}</span></td>
                    <td className="py-2.5 pr-3 text-right font-bold tabular-nums">{m(r.now)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-ink/70">{m(r.before)}</td>
                    <td className="py-2.5 text-right"><Delta value={r.delta} goodWhen="down" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card title="Maiores despesas" sub={monthLabel(month)} delay={160}>
          <ol className="space-y-1">
            {fin.topOut.map((t, i) => (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl px-1 py-2">
                <span className="w-5 text-center text-sm font-extrabold tabular-nums text-ink/60">{i + 1}</span>
                <CatIcon cat={t.cat} size={36} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t.desc}</p><p className="text-xs text-ink/65">{fmtDate(t.date)}</p></div>
                <Signed t={t} className="text-[13.5px]" />
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Orçamentos" sub="Gasto do mês contra o limite de cada categoria" delay={200}>
          <BudgetList budgets={fin.budgets} />
        </Card>
      </div>
    </div>
  );
}

function SettingsPage({ sub, setSub }) {
  const View = SETTINGS_VIEWS[sub];
  const current = SETTINGS_TABS.find((t) => t.id === sub);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Configurações" title={current.label} />
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Seções de configuração" className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col lg:self-start lg:overflow-visible">
          {SETTINGS_TABS.map((t) => {
            const on = sub === t.id;
            return (
              <button key={t.id} type="button" onClick={() => setSub(t.id)} aria-current={on ? 'page' : undefined}
                className={`flex shrink-0 items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${on ? 'glass border-vivo/30' : 'border-transparent hover:bg-ink/[0.04]'}`}>
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${on ? 'bg-gradient-to-br from-vivo to-leco text-white' : 'bg-ink/[0.06] text-ink'}`}><Icon name={t.icon} size={17} /></span>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-sm font-bold">{t.label}</span>
                  <span className="hidden text-xs text-ink/65 lg:block">{t.desc}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <div key={sub} className="glass rise min-w-0 p-5 sm:p-6"><View /></div>
      </div>
    </div>
  );
}

function WebApp({ fin, month, setMonth }) {
  const { profile, prefs, page, setPage, settingsSub, setSettingsSub, openTx } = useApp();
  const go = (id) => { setPage(id); window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); };
  const navList = (horizontal) => (
    <nav aria-label="Abas principais" className={horizontal ? 'no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1' : 'flex flex-col gap-1'}>
      {WEB_TABS.map((n) => {
        const on = page === n.id;
        return (
          <button key={n.id} type="button" onClick={() => go(n.id)} aria-current={on ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-2xl text-[14px] font-semibold transition-all ${horizontal ? 'px-3.5 py-2' : 'px-3.5 py-3'} ${on ? 'border border-white/20 bg-gradient-to-br from-vivo to-leco text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_10px_22px_-12px_rgba(20,128,107,.9)]' : 'border border-transparent text-ink/75 hover:bg-ink/[0.05] hover:text-ink'}`}>
            <Icon name={n.icon} size={18} />
            {n.label}
          </button>
        );
      })}
    </nav>
  );
  let content;
  if (page === 'transacoes') {
    content = (
      <div className="space-y-5">
        <PageHeader eyebrow="Transações" title="Todas as movimentações">
          <NotifButton />
          <button type="button" className="btn btn-ghost" onClick={() => openTx('in')}><Icon name="inArrow" size={17} />Receita</button>
          <button type="button" className="btn btn-primary" onClick={() => openTx('out')}><Icon name="plus" size={18} strokeWidth={2.4} />Despesa</button>
        </PageHeader>
        <Card><TxExplorer month={month} setMonth={setMonth} fin={fin} /></Card>
      </div>
    );
  } else if (page === 'analises') {
    content = <AnalysisPage fin={fin} month={month} setMonth={setMonth} />;
  } else if (page === 'metas') {
    content = (
      <div className="space-y-5">
        <PageHeader eyebrow="Metas" title="Seus objetivos de poupança" />
        <GoalsManager />
      </div>
    );
  } else if (page === 'categorias') {
    content = (
      <div className="space-y-5">
        <PageHeader eyebrow="Categorias" title="Organize seus gastos e receitas">
          <MonthSwitch month={month} min={fin.minM} max={fin.maxM} onChange={setMonth} />
        </PageHeader>
        <Card><CategoriesManager month={month} /></Card>
      </div>
    );
  } else if (page === 'config') {
    content = <SettingsPage sub={settingsSub} setSub={setSettingsSub} />;
  } else {
    content = <OverviewPage fin={fin} month={month} setMonth={setMonth} go={go} />;
  }
  return (
    <div className="mx-auto grid w-full max-w-[1480px] gap-5 lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="glass sticky top-[84px] hidden max-h-[calc(100vh-104px)] flex-col gap-6 self-start overflow-y-auto p-5 lg:flex">
        <div className="px-1 pt-1"><Logo size="md" /></div>
        {navList(false)}
        <div className="mt-auto space-y-3">
          <div className="glass-milk rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink/75">Poupança de {monthName(month).toLowerCase()}</p>
              <span className="badge-gold !px-2 !py-0.5 !text-[10px]">meta {prefs.savingsGoal}%</span>
            </div>
            <p className="mt-2 text-[26px] font-extrabold leading-none tracking-[-0.02em]"><Percent value={fin.cur.rate} /></p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink/70">{fin.cur.rate >= prefs.savingsGoal ? 'Meta do mês batida.' : `Faltam ${fmtPctAbs(prefs.savingsGoal - fin.cur.rate, ' p.p.')} para a meta.`}</p>
          </div>
          <button type="button" onClick={() => { setSettingsSub('perfil'); go('config'); }} className="flex w-full items-center gap-3 rounded-2xl border border-ink/[0.08] bg-ink/[0.03] p-3 text-left hover:bg-ink/[0.06]">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-vivo to-leco text-[15px] font-extrabold text-white ring-2 ring-ouro/70">{profile.name.charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{profile.name}</span>
              <span className="block truncate text-xs text-ink/65">{profile.email}</span>
            </span>
            <Icon name="right" size={16} className="text-ink/50" />
          </button>
        </div>
      </aside>
      <main className="min-w-0 space-y-5">
        <div className="glass flex flex-col gap-4 p-4 lg:hidden">
          <Logo size="sm" />
          {navList(true)}
        </div>
        <div key={page} className="rise">{content}</div>
        <p className="px-1 pb-2 text-center text-[11px] text-ink/60">Leco · dados fictícios de demonstração, salvos só neste navegador</p>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MODO APP MÓVEL                                                      */
/* ------------------------------------------------------------------ */
function PhoneStage({ children }) {
  const { w, h } = useViewport();
  if (w <= 520) {
    return (
      <div className="phone phone-bare mx-auto" style={{ height: Math.max(600, h - 92) }}>
        <div className="phone-screen">{children(true)}</div>
      </div>
    );
  }
  const s = Math.min(1, Math.max(0.6, (h - 104) / 844));
  return (
    <div className="mx-auto" style={{ width: 390 * s, height: 844 * s }}>
      <div className="phone" style={{ transform: `scale(${s})`, transformOrigin: 'top left' }}>
        <div className="phone-screen">{children(false)}</div>
      </div>
    </div>
  );
}

function StatusBar() {
  const time = useClock();
  return (
    <div className="absolute inset-x-0 top-0 z-40 flex h-[52px] items-center justify-between px-8 pt-1 text-[14px] font-bold text-ink" aria-hidden="true">
      <span className="tabular-nums">{time}</span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 4.2a10.5 10.5 0 0 1 14 0M3.5 7a6.6 6.6 0 0 1 9 0" /><circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" /></svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x=".7" y=".7" width="21.6" height="10.6" rx="3" stroke="currentColor" strokeOpacity=".5" /><rect x="2.4" y="2.4" width="15" height="7.2" rx="1.6" fill="currentColor" /><path d="M24 4v4" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </span>
    </div>
  );
}

function Carousel({ children, count }) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const drag = useRef(null);
  const step = 284 + 12;
  const onScroll = () => { const el = ref.current; if (el) setIdx(Math.min(count - 1, Math.round(el.scrollLeft / step))); };
  const goTo = (i) => { const el = ref.current; if (el) el.scrollTo({ left: i * step, behavior: reducedMotion() ? 'auto' : 'smooth' }); };
  const down = (e) => {
    if (e.pointerType !== 'mouse') return;
    drag.current = { x: e.clientX, left: ref.current.scrollLeft };
    ref.current.classList.add('dragging');
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drag.current) return;
    const r = ref.current.getBoundingClientRect();
    const scale = r.width / ref.current.clientWidth || 1;
    ref.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x) / scale;
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    ref.current.classList.remove('dragging');
    goTo(Math.round(ref.current.scrollLeft / step));
  };
  return (
    <div>
      <div ref={ref} onScroll={onScroll} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className="snap-row no-scrollbar -mb-9 flex cursor-grab gap-3 overflow-x-auto px-5 pb-10 pt-1" aria-label="Cartões de resumo">
        {children}
        <span className="w-2 shrink-0" aria-hidden="true" />
      </div>
      <div className="mt-3 flex justify-center gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <button key={i} type="button" aria-label={`Ver cartão ${i + 1} de ${count}`} onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-6 bg-ouro' : 'w-1.5 bg-ink/25'}`} />
        ))}
      </div>
    </div>
  );
}

function PhoneTxItem({ t, fresh }) {
  const { cats } = useApp();
  return (
    <li className={`flex items-center gap-3 rounded-2xl px-1 py-2.5 ${fresh ? 'flash' : ''}`}>
      <CatIcon cat={t.cat} kind={t.type} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{t.desc}</p>
        <p className="truncate text-xs text-ink/65">{catOf(cats, t.cat, t.type).label} · {fmtDate(t.date)}</p>
      </div>
      <Signed t={t} className="text-[13.5px]" />
    </li>
  );
}

const PHONE_MENU = [
  { id: 'perfil', label: 'Perfil', icon: 'user', desc: 'Nome, contato e cidade' },
  { id: 'acesso', label: 'Acesso e segurança', icon: 'lock', desc: 'Senha, sessões e histórico' },
  { id: 'categorias', label: 'Categorias', icon: 'grid', desc: 'Crie categorias e orçamentos' },
  { id: 'metas', label: 'Metas', icon: 'target', desc: 'Objetivos de poupança' },
  { id: 'preferencias', label: 'Preferências', icon: 'palette', desc: 'Tema, privacidade, poupança' },
  { id: 'notificacoes', label: 'Notificações', icon: 'bell', desc: 'Alertas e resumos' },
];

function PhoneApp({ bare, fin, month, setMonth, overlay }) {
  const { txs, profile, prefs, setPrefs, freshId, goals, openTx, P, modalOpen, closeModal } = useApp();
  const [tab, setTab] = useState('home');
  const [sub, setSub] = useState(null);
  const navState = useRef({});
  navState.current = { tab, sub, modalOpen, closeModal };
  useEffect(() => {
    /* Botão voltar do Android (plugin @capacitor/app): fecha janela → volta seção → volta ao Início → sai */
    const capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!capApp || !capApp.addListener) return undefined;
    const handle = capApp.addListener('backButton', () => {
      const st = navState.current;
      if (st.modalOpen) st.closeModal();
      else if (st.sub) setSub(null);
      else if (st.tab !== 'home') setTab('home');
      else if (capApp.exitApp) capApp.exitApp();
    });
    return () => { Promise.resolve(handle).then((h) => h && h.remove && h.remove()); };
  }, []);
  const [filter, setFilter] = useState('all');
  const scroller = useRef(null);
  const { cur, deltas, series } = fin;
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 0; }, [tab, sub]);
  const recentOut = useMemo(() => txs.filter((t) => t.type === 'out').sort(byDateDesc).slice(0, 5), [txs]);
  const groups = useMemo(() => {
    const g = [];
    txs.filter((t) => monthKey(t.date) === month && (filter === 'all' || t.type === filter)).sort(byDateDesc)
      .forEach((t) => { const last = g[g.length - 1]; if (last && last.date === t.date) last.items.push(t); else g.push({ date: t.date, items: [t] }); });
    return g;
  }, [txs, month, filter]);
  const goal = goals[0];
  const goalPct = goal ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;
  const mName = monthName(month).toLowerCase();
  const m = useMoneyText();
  const openTab = (t) => { setTab(t); setSub(null); };
  const openSub = (s) => { setTab('ajustes'); setSub(s); };
  const subItem = PHONE_MENU.find((x) => x.id === sub);
  const SubView = sub ? SETTINGS_VIEWS[sub] : null;

  return (
    <>
      <div className="phone-bg pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="atmos-blobs absolute inset-0">
          <div className="blob -left-24 -top-16 h-[300px] w-[300px] bg-vivo opacity-60" />
          <div className="blob blob-slow -right-28 top-[38%] h-[320px] w-[320px] bg-leco opacity-80" style={{ animationDelay: '-8s' }} />
          <div className="blob right-6 top-24 h-[120px] w-[120px] bg-ouro opacity-40" style={{ animationDelay: '-3s' }} />
          <div className="blob -bottom-20 left-10 h-[220px] w-[220px] bg-vivo-hi opacity-50" style={{ animationDelay: '-14s' }} />
        </div>
      </div>
      {!bare && <div className="island" aria-hidden="true" />}
      {!bare && <StatusBar />}

      <div ref={scroller} className={`no-scrollbar absolute inset-0 overflow-y-auto pb-[124px] ${bare ? 'pt-5' : 'pt-[58px]'}`}>
        {tab !== 'ajustes' && (
          <header className="px-5 pb-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => openSub('perfil')} aria-label="Abrir perfil"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-vivo to-leco text-[16px] font-extrabold text-white ring-2 ring-ouro/70">
                {profile.name.charAt(0).toUpperCase()}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink/70">{greeting()},</p>
                <p className="truncate text-[17px] font-extrabold tracking-[-0.02em]">{firstName(profile.name)}</p>
              </div>
              <button type="button" className="icon-btn size-11" onClick={() => setPrefs((p) => ({ ...p, hide: !p.hide }))} aria-label={prefs.hide ? 'Mostrar valores' : 'Ocultar valores'} aria-pressed={prefs.hide}>
                <Icon name={prefs.hide ? 'eyeOff' : 'eye'} size={19} />
              </button>
              <NotifButton panelWidth={300} />
            </div>
            <div className="glass-hero mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/75">Saldo total</p>
                <p className="mt-0.5 text-[24px] font-extrabold leading-tight tracking-[-0.02em]"><Money cents={cur.bal} /></p>
              </div>
              <Delta value={deltas.bal} />
            </div>
          </header>
        )}

        {tab === 'home' && (
          <div className="rise space-y-6">
            <Carousel count={4}>
              <article className="glass-hero flex h-[172px] w-[284px] shrink-0 flex-col justify-between p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-ink/85">Patrimônio · 6 meses</p>
                  <LogoMark size={26} onDark />
                </div>
                <div className="h-[56px]"><Spark values={series.map((p) => p.bal)} color="#E8A317" height={56} /></div>
                <p className="flex items-baseline justify-between text-xs text-ink/75">
                  <span>{series[0].short} → {series[series.length - 1].short}</span>
                  <b className="text-[15px] font-extrabold text-ink"><Money cents={series[series.length - 1].bal - series[0].bal} /></b>
                </p>
              </article>
              <article className="glass flex h-[172px] w-[284px] shrink-0 flex-col justify-between p-5">
                <div className="flex items-center justify-between"><p className="text-[13px] font-semibold text-ink/80">Receitas de {mName}</p><Delta value={deltas.in} /></div>
                <p className="text-[28px] font-extrabold tracking-[-0.02em] text-in"><Money cents={cur.in} /></p>
                <div className="h-[34px]"><Spark values={series.map((p) => p.in)} color={P.in} height={34} /></div>
              </article>
              <article className="glass flex h-[172px] w-[284px] shrink-0 flex-col justify-between p-5">
                <div className="flex items-center justify-between"><p className="text-[13px] font-semibold text-ink/80">Despesas de {mName}</p><Delta value={deltas.out} goodWhen="down" /></div>
                <p className="text-[28px] font-extrabold tracking-[-0.02em] text-out"><Money cents={cur.out} /></p>
                <div className="h-[34px]"><Spark values={series.map((p) => p.out)} color={P.out} height={34} /></div>
              </article>
              <article className="glass-milk flex h-[172px] w-[284px] shrink-0 flex-col justify-between rounded-3xl p-5">
                <div className="flex items-center justify-between"><p className="text-[13px] font-semibold text-ink/80">Meta em destaque</p>{goal && <span className="badge-gold">{goalPct}%</span>}</div>
                <div>
                  <p className="text-[18px] font-extrabold tracking-[-0.02em]">{goal ? goal.name : 'Crie sua primeira meta'}</p>
                  {goal && <p className="mt-0.5 text-xs text-ink/70">{m(goal.saved)} de {m(goal.target)}</p>}
                </div>
                <div className="track"><i style={{ width: `${goalPct}%` }} /></div>
              </article>
            </Carousel>
            <div className="px-5">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { l: 'Receita', i: 'inArrow', fn: () => openTx('in'), tone: 'text-in' },
                  { l: 'Despesa', i: 'up', fn: () => openTx('out'), tone: 'text-out' },
                  { l: 'Categorias', i: 'grid', fn: () => openSub('categorias'), tone: 'text-ink' },
                  { l: 'Metas', i: 'target', fn: () => openSub('metas'), tone: 'text-[#B57406]' },
                ].map((a) => (
                  <button key={a.l} type="button" onClick={a.fn} className="group flex flex-col items-center gap-2">
                    <span className={`glass grid size-14 place-items-center rounded-2xl transition-transform group-hover:-translate-y-0.5 group-active:scale-95 ${a.tone}`}><Icon name={a.i} size={21} strokeWidth={2} /></span>
                    <span className="text-[11.5px] font-semibold text-ink/80">{a.l}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[17px] font-extrabold tracking-[-0.02em]">Orçamentos</h2>
                <button type="button" className="text-xs font-bold text-in" onClick={() => openTab('analises')}>Ver análise</button>
              </div>
              <div className="glass rounded-3xl p-4"><BudgetList budgets={fin.budgets} limit={3} /></div>
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between px-5">
                <h2 className="text-[17px] font-extrabold tracking-[-0.02em]">Despesas recentes</h2>
                <button type="button" className="text-xs font-bold text-in" onClick={() => openTab('extrato')}>Ver extrato</button>
              </div>
              <div className="glass mx-5 rounded-3xl px-3 py-1">
                <ul className="divide-y divide-ink/[0.07]">{recentOut.map((t) => <PhoneTxItem key={t.id} t={t} fresh={t.id === freshId} />)}</ul>
              </div>
            </div>
          </div>
        )}

        {tab === 'extrato' && (
          <div className="rise space-y-4 px-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Extrato</h2>
              <MonthSwitch compact month={month} min={fin.minM} max={fin.maxM} onChange={setMonth} />
            </div>
            <Segmented size="sm" full label="Filtrar extrato" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Tudo' }, { value: 'in', label: 'Receitas' }, { value: 'out', label: 'Despesas' }]} />
            {groups.length === 0 && <p className="glass rounded-3xl p-6 text-center text-sm text-ink/70">Nada registrado aqui. Toque em + para adicionar.</p>}
            {groups.map((g) => (
              <div key={g.date}>
                <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider tabular-nums text-ink/60">{fmtDate(g.date)}</p>
                <div className="glass rounded-3xl px-3 py-0.5"><ul className="divide-y divide-ink/[0.07]">{g.items.map((t) => <PhoneTxItem key={t.id} t={t} fresh={t.id === freshId} />)}</ul></div>
              </div>
            ))}
          </div>
        )}

        {tab === 'analises' && (
          <div className="rise space-y-4 px-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Análises</h2>
              <MonthSwitch compact month={month} min={fin.minM} max={fin.maxM} onChange={setMonth} />
            </div>
            <section className="glass rounded-3xl p-4">
              <h3 className="mb-4 text-[15px] font-extrabold tracking-[-0.02em]">Despesas por categoria</h3>
              <CategoryBreakdown cats={fin.cats} donutSize={190} compact />
            </section>
            <section className="glass rounded-3xl p-4">
              <h3 className="mb-3 text-[15px] font-extrabold tracking-[-0.02em]">Evolução</h3>
              <FlowChart fin={fin} month={month} height={200} />
            </section>
            <section className="glass rounded-3xl p-4">
              <h3 className="mb-4 text-[15px] font-extrabold tracking-[-0.02em]">Orçamentos</h3>
              <BudgetList budgets={fin.budgets} />
            </section>
          </div>
        )}

        {tab === 'ajustes' && !sub && (
          <div className="rise space-y-4 px-5 pt-1">
            <h2 className="text-[24px] font-extrabold tracking-[-0.02em]">Ajustes</h2>
            <button type="button" onClick={() => setSub('perfil')} className="glass-hero flex w-full items-center gap-3 rounded-3xl p-4 text-left">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-white/15 text-xl font-extrabold ring-2 ring-ouro/80">{profile.name.charAt(0).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-extrabold">{profile.name}</span>
                <span className="block truncate text-xs text-ink/75">{profile.email}</span>
              </span>
              <Icon name="right" size={18} />
            </button>
            <ul className="glass divide-y divide-ink/[0.07] rounded-3xl px-2 py-1">
              {PHONE_MENU.map((it) => (
                <li key={it.id}>
                  <button type="button" onClick={() => setSub(it.id)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink/[0.06]"><Icon name={it.icon} size={18} /></span>
                    <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold">{it.label}</span><span className="block truncate text-xs text-ink/65">{it.desc}</span></span>
                    <Icon name="right" size={16} className="text-ink/45" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-center text-[11px] text-ink/60">Leco · dados fictícios de demonstração</p>
          </div>
        )}

        {tab === 'ajustes' && sub && (
          <div key={sub} className="rise space-y-4 px-5 pt-1">
            <div className="flex items-center gap-2">
              <button type="button" className="icon-btn size-10 shrink-0" aria-label="Voltar para Ajustes" onClick={() => setSub(null)}><Icon name="left" size={18} /></button>
              <h2 className="truncate text-[20px] font-extrabold tracking-[-0.02em]">{subItem.label}</h2>
            </div>
            {sub === 'categorias' ? <CategoriesManager month={month} compact />
              : sub === 'metas' ? <GoalsManager cols="" />
              : <div className="glass rounded-3xl p-4"><SubView /></div>}
          </div>
        )}
      </div>

      <nav aria-label="Navegação do app" className={`glass-deep absolute inset-x-3.5 z-40 grid h-[70px] grid-cols-5 items-center rounded-[28px] px-1 ${bare ? 'bottom-3.5' : 'bottom-5'}`}>
        {[{ id: 'home', label: 'Início', icon: 'home' }, { id: 'extrato', label: 'Extrato', icon: 'list' }, null, { id: 'analises', label: 'Análises', icon: 'pie' }, { id: 'ajustes', label: 'Ajustes', icon: 'settings' }].map((t, i) => t ? (
          <button key={t.id} type="button" onClick={() => openTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 text-[10.5px] font-semibold transition-colors ${tab === t.id ? 'text-ink' : 'text-ink/60 hover:text-ink/85'}`}>
            <span className={`grid h-8 w-12 place-items-center rounded-full transition-all ${tab === t.id ? 'bg-gradient-to-br from-vivo to-leco text-white shadow-[0_6px_14px_-6px_rgba(20,128,107,.9)]' : ''}`}><Icon name={t.icon} size={19} /></span>
            {t.label}
          </button>
        ) : (
          <div key={`fab-${i}`} className="flex justify-center">
            <button type="button" className="fab -mt-9 size-[60px]" onClick={() => openTx('out')} aria-label="Nova transação"><Icon name="plus" size={26} strokeWidth={2.6} /></button>
          </div>
        ))}
      </nav>
      {overlay}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* APP                                                                 */
/* ------------------------------------------------------------------ */
function TopBar({ mode, setMode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top,0px))] z-[60] flex justify-center pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))]">
      <div className="glass-deep pointer-events-auto flex items-center gap-3 rounded-full py-1.5 pl-3 pr-1.5">
        <LogoMark size={26} />
        <span className="hidden text-xs font-semibold text-ink/70 sm:block">Visualização</span>
        <Segmented label="Modo de visualização" value={mode} onChange={setMode} options={[{ value: 'web', label: 'Web', icon: 'monitor' }, { value: 'app', label: 'App móvel', icon: 'phone' }]} />
      </div>
    </div>
  );
}

const STORE = 'leco.v2.';

function App() {
  const [mode, setMode] = useState('web');
  const [txs, setTxs] = useStored(`${STORE}txs`, makeSeed);
  const [cats, setCats] = useStored(`${STORE}cats`, DEFAULT_CATS);
  const [goals, setGoals] = useStored(`${STORE}goals`, DEFAULT_GOALS);
  const [profile, setProfile] = useStored(`${STORE}profile`, DEFAULT_PROFILE);
  const [prefs, setPrefs] = useStored(`${STORE}prefs`, DEFAULT_PREFS);
  const [notifPrefs, setNotifPrefs] = useStored(`${STORE}notif`, DEFAULT_NOTIF);
  const [security, setSecurity] = useStored(`${STORE}security`, DEFAULT_SECURITY);
  const [sessions, setSessions] = useStored(`${STORE}sessions`, DEFAULT_SESSIONS);
  const [accessLog, setAccessLog] = useStored(`${STORE}log`, DEFAULT_LOG);
  const [month, setMonth] = useState(() => (txs.length ? computeFinance(txs, '2026-10', cats).maxM : monthKey(todayISO())));
  const [page, setPage] = useState('inicio');
  const [settingsSub, setSettingsSub] = useState('perfil');
  const [modal, setModal] = useState(null);
  const [toastState, setToast] = useState(null);
  const [freshId, setFreshId] = useState(null);
  const [unread, setUnread] = useState(true);
  const theme = prefs.theme === 'dark' ? 'dark' : 'light';
  const opening = prefs.opening == null ? OPENING_BALANCE : prefs.opening;
  const fin = useMemo(() => computeFinance(txs, month, cats, opening), [txs, month, cats, opening]);

  useEffect(() => {
    const r = document.documentElement;
    r.dataset.leco = theme;
    r.dataset.calm = prefs.calm ? '1' : '0';
  }, [theme, prefs.calm]);
  useEffect(() => {
    if (!toastState) return undefined;
    const t = setTimeout(() => setToast(null), toastState.action ? 6000 : 3800);
    return () => clearTimeout(t);
  }, [toastState]);
  useEffect(() => {
    if (freshId == null) return undefined;
    const t = setTimeout(() => setFreshId(null), 2600);
    return () => clearTimeout(t);
  }, [freshId]);

  const toast = useCallback((msg, action) => setToast({ id: Date.now(), msg, action }), []);
  const openTx = useCallback((type) => setModal({ kind: 'tx', type, key: Date.now() }), []);
  const openCatEditor = useCallback((key, kind = 'out') => setModal({ kind: 'cat', catKey: key, catKind: kind, key: Date.now() }), []);

  const addTx = (data) => {
    const id = txs.reduce((a, t) => Math.max(a, t.id), 0) + 1;
    setTxs((p) => [{ id, ...data }, ...p]);
    setMonth(monthKey(data.date));
    setModal(null);
    setFreshId(id);
    toast(`${data.type === 'in' ? 'Receita' : 'Despesa'} de ${fmtBRL(data.amount)} adicionada`);
  };
  const deleteTx = (t) => {
    setTxs((p) => p.filter((x) => x.id !== t.id));
    toast(`“${t.desc}” removida`, { label: 'Desfazer', run: () => setTxs((p) => [...p, t]) });
  };
  const addCategory = (c) => {
    let key = slug(c.label) || 'categoria';
    while (cats[key]) key += '-2';
    setCats((p) => ({ ...p, [key]: { ...c, custom: true } }));
    toast(`Categoria “${c.label}” criada`);
    return key;
  };
  const saveCategory = (key, data) => {
    if (key) { setCats((p) => ({ ...p, [key]: { ...p[key], ...data } })); toast(`Categoria “${data.label}” atualizada`); }
    else addCategory(data);
  };
  const deleteCategory = (key) => {
    const c = cats[key];
    const fallback = c.kind === 'in' ? 'outros-in' : 'outros-out';
    setTxs((p) => p.map((t) => (t.cat === key ? { ...t, cat: fallback } : t)));
    setCats((p) => { const n = { ...p }; delete n[key]; return n; });
    toast(`Categoria “${c.label}” excluída`);
  };
  const resetAll = () => {
    setTxs(makeSeed()); setCats(DEFAULT_CATS); setGoals(DEFAULT_GOALS); setProfile(DEFAULT_PROFILE);
    setPrefs(DEFAULT_PREFS); setNotifPrefs(DEFAULT_NOTIF); setSecurity(DEFAULT_SECURITY); setSessions(DEFAULT_SESSIONS); setAccessLog(DEFAULT_LOG);
    setMonth('2026-10');
    toast('Dados de exemplo restaurados');
  };
  const clearAll = () => {
    setTxs([]); setGoals([]); setPrefs((p) => ({ ...p, opening: 0 }));
    setMonth(monthKey(todayISO()));
    toast('Dados de exemplo apagados. Comece registrando suas transações.');
  };
  const switchMode = (mm) => { setMode(mm); setModal(null); window.scrollTo({ top: 0 }); };

  const notifs = useMemo(() => {
    const list = [];
    if (notifPrefs.budget) fin.budgets.filter((b) => b.pct >= 80).forEach((b) => list.push({
      id: `b-${b.key}`, icon: 'alert', tone: b.pct >= 100 ? 'bad' : 'gold',
      title: b.pct >= 100 ? `Orçamento de ${b.label} estourado` : `${b.label} em ${b.pct}% do orçamento`,
      body: `${fmtBRL(b.spent)} de ${fmtBRL(b.budget)} em ${monthLabel(month)}.`,
    }));
    if (notifPrefs.goals) goals.filter((g) => g.saved / g.target >= 0.75 && g.saved < g.target).forEach((g) => list.push({
      id: `g-${g.id}`, icon: 'target', tone: 'gold', title: 'Meta quase lá', body: `${g.name} chegou a ${Math.round((g.saved / g.target) * 100)}% (${fmtBRL(g.saved)} de ${fmtBRL(g.target)}).`,
    }));
    if (notifPrefs.access) accessLog.filter((a) => !a.ok).slice(0, 1).forEach((a) => list.push({
      id: `a-${a.id}`, icon: 'lock', tone: 'bad', title: 'Tentativa de acesso bloqueada', body: `${a.device} em ${a.place}. Se não foi você, troque a senha em Acesso e segurança.`, when: a.when,
    }));
    if (notifPrefs.bills) list.push({ id: 'bill', icon: 'calendar', title: 'Aluguel vence em breve', body: 'O aluguel de novembro vence em 05/11/2026.', when: '23/10/2026' });
    return list;
  }, [fin, goals, accessLog, notifPrefs, month]);

  const ctx = {
    theme, P: PALETTES[theme], hide: prefs.hide,
    txs, cats, goals, setGoals, profile, setProfile, prefs, setPrefs, notifPrefs, setNotifPrefs,
    security, setSecurity, sessions, setSessions, accessLog, setAccessLog,
    page, setPage, settingsSub, setSettingsSub, freshId,
    notifs, unread, markRead: () => setUnread(false),
    toast, openTx, openCatEditor, deleteTx, addCategory, saveCategory, deleteCategory, resetAll, clearAll,
    modalOpen: !!modal, closeModal: () => setModal(null),
  };
  const variant = NATIVE || mode === 'app' ? 'sheet' : 'dialog';
  const modalNode = modal && (modal.kind === 'tx'
    ? <NewTxModal key={modal.key} variant={variant} initialType={modal.type} onClose={() => setModal(null)} onSubmit={addTx} />
    : <CategoryEditor key={modal.key} variant={variant} catKey={modal.catKey} initialKind={modal.catKind} onClose={() => setModal(null)} />);

  if (NATIVE) {
    return (
      <AppCtx.Provider value={ctx}>
        <NarrowCtx.Provider value={true}>
          <div className="phone-screen fixed inset-0 text-ink" style={{ borderRadius: 0 }}>
            <PhoneApp bare fin={fin} month={month} setMonth={setMonth} overlay={<>{modalNode}<Toast toast={toastState} onClose={() => setToast(null)} inPhone /></>} />
          </div>
        </NarrowCtx.Provider>
      </AppCtx.Provider>
    );
  }
  return (
    <AppCtx.Provider value={ctx}>
      <div className="relative min-h-screen text-ink">
        <Atmosphere />
        <TopBar mode={mode} setMode={switchMode} />
        <div className="relative z-10 pb-8 pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))] pt-[84px]">
          <div key={mode} className="rise">
            {mode === 'web' ? (
              <WebApp fin={fin} month={month} setMonth={setMonth} />
            ) : (
              <PhoneStage>
                {(bare) => <NarrowCtx.Provider value={true}><PhoneApp bare={bare} fin={fin} month={month} setMonth={setMonth} overlay={<>{modalNode}<Toast toast={toastState} onClose={() => setToast(null)} inPhone /></>} /></NarrowCtx.Provider>}
              </PhoneStage>
            )}
          </div>
        </div>
        {mode === 'web' && modalNode}
        {mode === 'web' && <Toast toast={toastState} onClose={() => setToast(null)} />}
      </div>
    </AppCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
