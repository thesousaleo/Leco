/* =====================================================================
   10-backend: login e banco de dados.
   Produção: Supabase (window.LecoSupabase, incluído pelo build).
   Testes locais (window.LECO_TEST_BACKEND): banco em memória com a mesma interface.
   ===================================================================== */
const TABLES = ['accounts', 'cards', 'categories', 'recurrings', 'transactions', 'goals'];
// Tabelas e colunas do Leco 3 (supabase/v3.sql). Sem a atualização do banco, o app funciona sem elas.
const V3_TABLES = ['templates', 'debts', 'plans'];
const ALL_TABLES = [...TABLES, ...V3_TABLES];
const V3_COLS = {
  profiles: ['prefs'], accounts: ['icon', 'is_reserve'], cards: ['icon'], categories: ['parent_id'], recurrings: ['tags'],
  transactions: ['tags', 'split_id', 'attachment', 'orig_amount', 'orig_currency', 'is_adjustment', 'debt_id', 'goal_id'],
  goals: ['monthly_amount', 'account_id', 'remind_day'],
};
const stripV3 = (table, row) => { const cols = V3_COLS[table]; if (!cols) return row; const r = { ...row }; cols.forEach((c) => delete r[c]); return r; };
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
    async deleteAccount() {
      // apaga as fotos de comprovante antes (o banco não apaga arquivos sozinho)
      try { const uidv = (await client.auth.getUser()).data.user.id; await files.removeFolder(uidv); } catch (e) { /* sem fotos ou sem Storage */ }
      ok(await client.rpc('delete_my_account')); await client.auth.signOut({ scope: 'local' }).catch(() => {});
    },
  };

  const state = { v3: false };
  const clean = (table, rows) => (state.v3 ? rows : Array.isArray(rows) ? rows.map((r) => stripV3(table, r)) : stripV3(table, rows));
  const db = {
    get v3() { return state.v3; },
    async loadAll(userId) {
      const out = {};
      const load = async (t) => {
        const rows = [];
        for (let from = 0; ; from += 1000) {
          const q = client.from(t).select('*').order(t === 'transactions' ? 'date' : 'created_at', { ascending: t !== 'transactions' }).range(from, from + 999);
          const data = ok(await q);
          rows.push(...data);
          if (data.length < 1000) break;
        }
        return rows;
      };
      await Promise.all(TABLES.map(async (t) => { out[t] = await load(t); }));
      const v3 = await Promise.all(V3_TABLES.map(async (t) => { try { out[t] = await load(t); return true; } catch (e) { out[t] = []; return false; } }));
      const prof = ok(await client.from('profiles').select('*').eq('id', userId).maybeSingle());
      out.profile = prof;
      state.v3 = v3.every(Boolean) && (!prof || 'prefs' in prof);
      out.v3 = state.v3;
      return out;
    },
    async insert(table, rows) { return ok(await client.from(table).insert(clean(table, rows)).select()); },
    async insertIgnore(table, rows, onConflict) { return ok(await client.from(table).upsert(clean(table, rows), { onConflict, ignoreDuplicates: true }).select()); },
    async upsert(table, rows, onConflict) { return ok(await client.from(table).upsert(clean(table, rows), { onConflict }).select()); },
    async update(table, id, patch) { return ok(await client.from(table).update(clean(table, patch)).eq('id', id).select().single()); },
    async updateWhere(table, field, value, patch) { return ok(await client.from(table).update(clean(table, patch)).eq(field, value).select()); },
    async updateIn(table, ids, patch) { return ok(await client.from(table).update(clean(table, patch)).in('id', ids).select()); },
    async remove(table, id) { ok(await client.from(table).delete().eq('id', id)); },
    async removeIn(table, ids) { if (ids.length) ok(await client.from(table).delete().in('id', ids)); },
    async removeWhere(table, field, value) { ok(await client.from(table).delete().eq(field, value)); },
    async saveProfile(userId, patch) { return ok(await client.from('profiles').upsert(clean('profiles', { id: userId, ...patch })).select().single()); },
  };
  // Fotos de comprovante (Storage privado: pasta = id do usuário)
  const files = {
    async upload(path, blob) { ok(await client.storage.from('comprovantes').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' })); return path; },
    async url(path) { return ok(await client.storage.from('comprovantes').createSignedUrl(path, 3600)).signedUrl; },
    async remove(paths) { if (paths.length) ok(await client.storage.from('comprovantes').remove(paths)); },
    async removeFolder(folder) {
      const list = ok(await client.storage.from('comprovantes').list(folder, { limit: 1000 }));
      if (list && list.length) await files.remove(list.map((f) => `${folder}/${f.name}`));
    },
  };
  const whatsapp = {
    async status() { return ok(await client.from('whatsapp_links').select('phone, created_at').maybeSingle()); },
    async createCode() { const r = ok(await client.rpc('create_whatsapp_code')); return Array.isArray(r) ? r[0] : r; },
    async unlink() { ok(await client.from('whatsapp_links').delete().not('phone', 'is', null)); },
  };
  // Leitura de comprovante por IA (função ler-comprovante no Supabase; a chave do Gemini fica no servidor)
  const ai = {
    async readReceipt(payload) {
      const { data, error } = await client.functions.invoke('ler-comprovante', { body: payload });
      if (error) {
        let msg = '';
        const res = error.context;
        if (res && res.status === 404) msg = 'A leitura por IA ainda não foi ativada no servidor.';
        else { try { msg = (await res.json()).error; } catch (e) { /* sem corpo */ } }
        throw new Error(msg || translateError(error));
      }
      return data;
    },
  };
  return { kind: 'supabase', auth, db, whatsapp, files, ai };
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
  ALL_TABLES.forEach((t) => { store[t] = []; });
  const blobs = {};
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
    goals: { icon: 'target', saved: 0, due: null, monthly_amount: 0, account_id: null, remind_day: null },
    templates: { amount: 0, description: '', category_id: null, account_id: null, card_id: null, tags: [], uses: 0 },
    debts: { person: '', paid: 0, interest: 0, installments: null, installment_amount: null, due_day: null, start_date: null, account_id: null, notes: null, closed: false },
    plans: { amount: 0 },
  };
  defaults.transactions = { ...defaults.transactions, tags: [], split_id: null, attachment: null, orig_amount: null, orig_currency: null, is_adjustment: false, debt_id: null, goal_id: null };
  defaults.accounts = { ...defaults.accounts, icon: null, is_reserve: false };
  defaults.cards = { ...defaults.cards, icon: null };
  defaults.categories = { ...defaults.categories, parent_id: null };
  defaults.recurrings = { ...defaults.recurrings, tags: [] };
  const makeUser = (email, name) => {
    const id = uid();
    users[email] = { id, email, password: null, name, confirmed: true, created_at: now(), last_sign_in_at: now(), provider: 'email' };
    store.profiles[id] = { id, name, theme: 'light', hide_values: false, savings_goal: 20, notify_bills: true, notify_budget: true, notify_goals: true, bill_days_before: 2, onboarded: false, prefs: {}, created_at: now() };
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
      ALL_TABLES.forEach((t) => { store[t] = store[t].filter((r) => r.user_id !== id); });
      delete store.profiles[id];
      Object.keys(users).forEach((e) => { if (users[e].id === id) delete users[e]; });
      session = null; emit('SIGNED_OUT');
    },
  };
  const db = {
    v3: !window.LECO_TEST_NOV3, // testes: simula o banco antigo (sem supabase/v3.sql)
    async loadAll(userId) {
      await wait();
      const out = {};
      ALL_TABLES.forEach((t) => { out[t] = JSON.parse(JSON.stringify(mine(t))); });
      out.profile = { ...store.profiles[userId] };
      out.v3 = db.v3;
      return out;
    },
    async upsert(table, rows, onConflict) {
      await wait();
      const keys = onConflict.split(',');
      const res = [];
      for (const r of rows) {
        const ex = store[table].find((x) => x.user_id === session.user.id && keys.every((k) => k === 'user_id' || x[k] === r[k]));
        if (ex) { Object.assign(ex, r); res.push({ ...ex }); } else { const [m] = await db.insert(table, [r]); res.push(m); }
      }
      return res;
    },
    async updateIn(table, ids, patch) { await wait(); const rows = store[table].filter((r) => ids.includes(r.id)); rows.forEach((r) => Object.assign(r, patch)); return rows.map((r) => ({ ...r })); },
    async removeIn(table, ids) { await wait(); store[table] = store[table].filter((r) => !ids.includes(r.id)); },
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
  // WhatsApp simulado: o código vira vínculo depois de alguns segundos
  let waLink = null;
  let waTimer = null;
  const whatsapp = {
    async status() { await wait(); return waLink; },
    async createCode() {
      await wait();
      clearTimeout(waTimer);
      waTimer = setTimeout(() => { waLink = { phone: '5511987654321', created_at: now() }; }, 6000);
      return { code: `LECO-${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`, expires_at: new Date(Date.now() + 15 * 60000).toISOString() };
    },
    async unlink() { await wait(); waLink = null; },
  };
  const files = {
    async upload(path, blob) { await wait(); blobs[path] = URL.createObjectURL(blob); return path; },
    async url(path) { return blobs[path] || ''; },
    async remove(paths) { paths.forEach((p) => delete blobs[p]); },
    async removeFolder() {},
  };
  const ai = {
    async readReceipt(payload) {
      await new Promise((r) => setTimeout(r, 700));
      if (window.LECO_TEST_AI_FAIL) throw new Error('A leitura por IA ainda não foi ativada no servidor.');
      return { encontrado: true, tipo: 'despesa', valor: 87.35, data: addDays(payload.today, -1), estabelecimento: 'Supermercado Dia', descricao: 'Supermercado Dia', categoria: 'Alimentação', forma: 'debito', parcelas: 1, itens: ['Arroz 5kg', 'Feijão', 'Café'], confianca: 0.93 };
    },
  };
  return { kind: 'memory', auth, db, whatsapp, files, ai };
}

function createBackend() {
  if (window.LECO_TEST_BACKEND) return createMemoryBackend();
  if (!window.LecoSupabase || !CFG.supabaseUrl || !CFG.supabaseKey) return null;
  return createSupabaseBackend();
}
