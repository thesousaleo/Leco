/* =====================================================================
   10-backend: login e banco de dados.
   Produção: Supabase (window.LecoSupabase, incluído pelo build).
   Testes locais (window.LECO_TEST_BACKEND): banco em memória com a mesma interface.
   ===================================================================== */
const TABLES = ['accounts', 'cards', 'categories', 'recurrings', 'transactions', 'goals'];
const NATIVE_REDIRECT = 'br.com.leco.app://auth';

function translateError(err) {
  const raw = (err && (err.message || err.error_description || err.msg || String(err))) || '';
  const msg = raw.toLowerCase();
  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar. Procure a mensagem do Leco na sua caixa de entrada (e no spam).';
  if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('already exists')) return 'Já existe uma conta com este e-mail. Entre ou recupere a senha.';
  if (msg.includes('password should be at least') || msg.includes('weak password')) return 'Senha fraca. Use pelo menos 8 caracteres, com letras e números.';
  if (msg.includes('same password') || msg.includes('should be different')) return 'A nova senha precisa ser diferente da atual.';
  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('security purposes')) return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
  if (msg.includes('unable to validate email') || msg.includes('invalid email') || msg.includes('email address') && msg.includes('invalid')) return 'Este e-mail não parece válido. Confira e tente de novo.';
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  if (msg.includes('jwt') || msg.includes('not authenticated') || msg.includes('session')) return 'Sua sessão expirou. Entre de novo.';
  if (msg.includes('provider is not enabled')) return 'O login com Google ainda não foi ativado no servidor.';
  return raw ? `Não foi possível concluir: ${raw}` : 'Algo deu errado. Tente de novo.';
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */
function createSupabaseBackend() {
  const client = window.LecoSupabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: !NATIVE },
  });
  const ok = (res) => { if (res.error) throw new Error(translateError(res.error)); return res.data; };
  const siteUrl = CFG.siteUrl || window.location.origin + window.location.pathname;

  const auth = {
    async getSession() { return ok(await client.auth.getSession()).session; },
    onChange(cb) { const { data } = client.auth.onAuthStateChange((event, session) => cb(event, session)); return () => data.subscription.unsubscribe(); },
    async signUp({ name, email, password }) {
      const data = ok(await client.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: siteUrl } }));
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('Já existe uma conta com este e-mail. Entre ou recupere a senha.');
      return { needsConfirm: !data.session };
    },
    async resendConfirm(email) { ok(await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: siteUrl } })); },
    async signIn({ email, password }) { ok(await client.auth.signInWithPassword({ email, password })); },
    async signInGoogle() {
      if (NATIVE) {
        const data = ok(await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true } }));
        if (Native.Browser) await Native.Browser.open({ url: data.url, presentationStyle: 'popover' });
        else window.location.href = data.url;
      } else {
        ok(await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: siteUrl } }));
      }
    },
    async handleDeepLink(url) {
      if (!url || !url.startsWith(NATIVE_REDIRECT)) return false;
      const u = new URL(url.replace(NATIVE_REDIRECT, 'https://leco.local/auth'));
      const code = u.searchParams.get('code');
      const errDesc = u.searchParams.get('error_description');
      if (Native.Browser) { try { await Native.Browser.close(); } catch (e) { /* já fechado */ } }
      if (errDesc) throw new Error(translateError({ message: errDesc }));
      if (code) ok(await client.auth.exchangeCodeForSession(code));
      return true;
    },
    async resetPassword(email) { ok(await client.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}${siteUrl.includes('?') ? '&' : '?'}redefinir=1` })); },
    async updatePassword(password) { ok(await client.auth.updateUser({ password })); },
    async updateEmail(email) { ok(await client.auth.updateUser({ email }, { emailRedirectTo: siteUrl })); },
    async updateName(name) { ok(await client.auth.updateUser({ data: { name } })); },
    async signOut(scope = 'local') { ok(await client.auth.signOut({ scope })); },
    async deleteAccount() { ok(await client.rpc('delete_my_account')); await client.auth.signOut({ scope: 'local' }).catch(() => {}); },
  };

  const db = {
    async loadAll(userId) {
      const out = {};
      await Promise.all(TABLES.map(async (t) => {
        const rows = [];
        for (let from = 0; ; from += 1000) {
          const q = client.from(t).select('*').order(t === 'transactions' ? 'date' : 'created_at', { ascending: t !== 'transactions' }).range(from, from + 999);
          const data = ok(await q);
          rows.push(...data);
          if (data.length < 1000) break;
        }
        out[t] = rows;
      }));
      const prof = ok(await client.from('profiles').select('*').eq('id', userId).maybeSingle());
      out.profile = prof;
      return out;
    },
    async insert(table, rows) { return ok(await client.from(table).insert(rows).select()); },
    async insertIgnore(table, rows, onConflict) { return ok(await client.from(table).upsert(rows, { onConflict, ignoreDuplicates: true }).select()); },
    async update(table, id, patch) { return ok(await client.from(table).update(patch).eq('id', id).select().single()); },
    async updateWhere(table, field, value, patch) { return ok(await client.from(table).update(patch).eq(field, value).select()); },
    async remove(table, id) { ok(await client.from(table).delete().eq('id', id)); },
    async removeWhere(table, field, value) { ok(await client.from(table).delete().eq(field, value)); },
    async saveProfile(userId, patch) { return ok(await client.from('profiles').upsert({ id: userId, ...patch }).select().single()); },
  };
  return { kind: 'supabase', auth, db };
}

/* ------------------------------------------------------------------ */
/* Banco em memória (só para testes locais)                            */
/* ------------------------------------------------------------------ */
const DEFAULT_CATEGORIES = [
  ['Moradia', 'out', 'home', '#14806B'], ['Alimentação', 'out', 'utensils', '#E8A317'], ['Transporte', 'out', 'car', '#5E8CA6'],
  ['Saúde', 'out', 'heart', '#6B9E8F'], ['Lazer', 'out', 'film', '#F08A6B'], ['Educação', 'out', 'book', '#B8865B'],
  ['Compras', 'out', 'bag', '#D9644A'], ['Assinaturas', 'out', 'repeat', '#8C7AB8'], ['Contas e serviços', 'out', 'zap', '#7A8B3F'],
  ['Outros gastos', 'out', 'tag', '#5E8CA6'], ['Salário', 'in', 'briefcase', '#14806B'], ['Investimentos', 'in', 'trend', '#E8A317'],
  ['Freelance', 'in', 'laptop', '#6B9E8F'], ['Outras receitas', 'in', 'gift', '#8C7AB8'],
];

function createMemoryBackend() {
  const users = {};
  const store = { profiles: {} };
  TABLES.forEach((t) => { store[t] = []; });
  let session = null;
  const listeners = new Set();
  const emit = (ev) => listeners.forEach((cb) => cb(ev, session));
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 120));
  const now = () => new Date().toISOString();
  const defaults = {
    accounts: { kind: 'corrente', initial_balance: 0, color: '#14806B', archived: false },
    cards: { limit_amount: 0, closing_day: 1, due_day: 10, color: '#0F5C4D', pay_account_id: null, archived: false },
    categories: { icon: 'tag', color: '#14806B', budget: 0, archived: false },
    recurrings: { frequency: 'monthly', end_date: null, active: true, category_id: null, account_id: null, card_id: null },
    transactions: { description: '', category_id: null, account_id: null, to_account_id: null, card_id: null, invoice: null, installment: null, installments: null, group_id: null, recurring_id: null, paid: true, notes: null },
    goals: { icon: 'target', saved: 0, due: null },
  };
  const makeUser = (email, name) => {
    const id = uid();
    users[email] = { id, email, password: null, name, confirmed: true, created_at: now(), last_sign_in_at: now(), provider: 'email' };
    store.profiles[id] = { id, name, theme: 'light', hide_values: false, savings_goal: 20, notify_bills: true, notify_budget: true, notify_goals: true, bill_days_before: 2, onboarded: false, created_at: now() };
    DEFAULT_CATEGORIES.forEach(([n, k, i, c]) => store.categories.push({ id: uid(), user_id: id, name: n, kind: k, icon: i, color: c, budget: 0, archived: false, created_at: now() }));
    return users[email];
  };
  const toSession = (u) => ({ user: { id: u.id, email: u.email, user_metadata: { name: u.name }, email_confirmed_at: u.confirmed ? now() : null, last_sign_in_at: u.last_sign_in_at, created_at: u.created_at, app_metadata: { provider: u.provider } } });
  const mine = (t) => store[t].filter((r) => session && r.user_id === session.user.id);
  const auth = {
    async getSession() { return wait(session); },
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    async signUp({ name, email, password }) {
      await wait();
      if (users[email]) throw new Error('Já existe uma conta com este e-mail. Entre ou recupere a senha.');
      const u = makeUser(email, name); u.password = password;
      if (email.includes('confirmar')) { u.confirmed = false; return { needsConfirm: true }; }
      session = toSession(u); emit('SIGNED_IN');
      return { needsConfirm: false };
    },
    async resendConfirm() { await wait(); },
    async signIn({ email, password }) {
      await wait();
      const u = users[email];
      if (!u || u.password !== password) throw new Error('E-mail ou senha incorretos.');
      if (!u.confirmed) throw new Error(translateError({ message: 'Email not confirmed' }));
      u.last_sign_in_at = now(); session = toSession(u); emit('SIGNED_IN');
    },
    async signInGoogle() {
      await wait();
      const email = 'google.teste@gmail.com';
      const u = users[email] || makeUser(email, 'Usuário Google');
      u.provider = 'google'; session = toSession(u); emit('SIGNED_IN');
    },
    async handleDeepLink() { return false; },
    async resetPassword() { await wait(); },
    async updatePassword(password) { await wait(); const u = Object.values(users).find((x) => x.id === session.user.id); u.password = password; },
    async updateEmail() { await wait(); },
    async updateName(name) { await wait(); session.user.user_metadata.name = name; },
    async signOut() { await wait(); session = null; emit('SIGNED_OUT'); },
    async deleteAccount() {
      await wait();
      const id = session.user.id;
      TABLES.forEach((t) => { store[t] = store[t].filter((r) => r.user_id !== id); });
      delete store.profiles[id];
      Object.keys(users).forEach((e) => { if (users[e].id === id) delete users[e]; });
      session = null; emit('SIGNED_OUT');
    },
  };
  const db = {
    async loadAll(userId) {
      await wait();
      const out = {};
      TABLES.forEach((t) => { out[t] = JSON.parse(JSON.stringify(mine(t))); });
      out.profile = { ...store.profiles[userId] };
      return out;
    },
    async insert(table, rows) {
      await wait();
      const made = rows.map((r) => ({ id: uid(), user_id: session.user.id, created_at: now(), ...defaults[table], ...r }));
      store[table].push(...made);
      return JSON.parse(JSON.stringify(made));
    },
    async insertIgnore(table, rows, onConflict) {
      const keys = onConflict.split(',');
      const fresh = rows.filter((r) => !store[table].some((x) => keys.every((k) => x[k] != null && x[k] === r[k])));
      return fresh.length ? db.insert(table, fresh) : [];
    },
    async update(table, id, patch) {
      await wait();
      const row = store[table].find((r) => r.id === id);
      Object.assign(row, patch);
      return { ...row };
    },
    async updateWhere(table, field, value, patch) {
      await wait();
      const rows = store[table].filter((r) => r[field] === value && r.user_id === session.user.id);
      rows.forEach((r) => Object.assign(r, patch));
      return rows.map((r) => ({ ...r }));
    },
    async remove(table, id) {
      await wait();
      store[table] = store[table].filter((r) => r.id !== id);
      if (table === 'categories') store.transactions.forEach((t) => { if (t.category_id === id) t.category_id = null; });
      if (table === 'accounts') store.transactions = store.transactions.filter((t) => t.account_id !== id && t.to_account_id !== id);
      if (table === 'cards') store.transactions = store.transactions.filter((t) => t.card_id !== id);
    },
    async removeWhere(table, field, value) { await wait(); store[table] = store[table].filter((r) => !(r[field] === value && r.user_id === session.user.id)); },
    async saveProfile(userId, patch) { await wait(); store.profiles[userId] = { ...store.profiles[userId], ...patch }; return { ...store.profiles[userId] }; },
  };
  return { kind: 'memory', auth, db };
}

function createBackend() {
  if (window.LECO_TEST_BACKEND) return createMemoryBackend();
  if (!window.LecoSupabase || !CFG.supabaseUrl || !CFG.supabaseKey) return null;
  return createSupabaseBackend();
}
