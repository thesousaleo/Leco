// =====================================================================
// LECO · agente do WhatsApp (Supabase Edge Function)
// Endereço do webhook: https://<projeto>.supabase.co/functions/v1/whatsapp
// Segredos (Supabase › Edge Functions › Secrets):
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN,
//   WHATSAPP_APP_SECRET, GEMINI_API_KEY, (opcional) GEMINI_MODEL
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem automaticamente.
// =====================================================================
import { handleWebhook, validSignature, SCHEMA, type Db, type Wa, type Ai, type Row, type Intent } from './core.ts';

const env = (k: string) => Deno.env.get(k) || '';
const GRAPH = 'https://graph.facebook.com/v23.0';
const SB = env('SUPABASE_URL');
const SR = env('SUPABASE_SERVICE_ROLE_KEY');

/* ---------------- banco (PostgREST com a chave de serviço) ---------------- */
async function rest(path: string, init: RequestInit = {}, prefer = 'return=representation') {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json', Prefer: prefer, ...(init.headers || {}) },
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`db ${res.status} ${path.split('?')[0]}: ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
}
const q = encodeURIComponent;

const db: Db = {
  async seenMessage(id, phone) {
    const r = await rest('whatsapp_messages?on_conflict=id', { method: 'POST', body: JSON.stringify({ id, phone }) }, 'return=representation,resolution=ignore-duplicates');
    return !r || r.length === 0;
  },
  async recentCount(phone, since) {
    const res = await fetch(`${SB}/rest/v1/whatsapp_messages?select=id&phone=eq.${q(phone)}&created_at=gte.${q(since)}`, { method: 'HEAD', headers: { apikey: SR, Authorization: `Bearer ${SR}`, Prefer: 'count=exact' } });
    return Number((res.headers.get('content-range') || '*/0').split('/')[1]) || 0;
  },
  async getLink(phone) {
    const r = await rest(`whatsapp_links?select=user_id&phone=eq.${q(phone)}`);
    return r[0]?.user_id || null;
  },
  async consumeCode(code) {
    const r = await rest(`whatsapp_codes?code=eq.${q(code)}&expires_at=gt.${q(new Date().toISOString())}`, { method: 'DELETE' });
    return r[0]?.user_id || null;
  },
  async link(phone, userId) {
    await rest(`whatsapp_links?or=(phone.eq.${q(phone)},user_id.eq.${q(userId)})`, { method: 'DELETE' }, 'return=minimal');
    await rest('whatsapp_links', { method: 'POST', body: JSON.stringify({ phone, user_id: userId }) }, 'return=minimal');
  },
  async unlink(phone) { await rest(`whatsapp_links?phone=eq.${q(phone)}`, { method: 'DELETE' }, 'return=minimal'); },
  async loadUser(userId) {
    const u = `user_id=eq.${q(userId)}`;
    const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
    const [prof, accounts, cards, categories, transactions] = await Promise.all([
      rest(`profiles?select=name&id=eq.${q(userId)}`),
      rest(`accounts?select=*&${u}&archived=is.false&order=created_at`),
      rest(`cards?select=*&${u}&archived=is.false&order=created_at`),
      rest(`categories?select=*&${u}&archived=is.false&order=name`),
      rest(`transactions?select=*&${u}&or=(date.gte.${since},paid.is.false,card_id.not.is.null)&order=date.desc,created_at.desc&limit=5000`),
    ]);
    // saldos precisam de todo o histórico pago das contas
    const old = await rest(`transactions?select=kind,amount,account_id,to_account_id,card_id,paid,date&${u}&date=lt.${since}&paid=is.true&card_id=is.null&limit=50000`);
    return { name: prof[0]?.name || '', accounts, cards, categories, transactions: [...transactions, ...old] };
  },
  async insertTx(rows) { return await rest('transactions', { method: 'POST', body: JSON.stringify(rows) }); },
  async createBatch(userId, ids) {
    const r = await rest('whatsapp_batches', { method: 'POST', body: JSON.stringify({ user_id: userId, tx_ids: ids }) });
    return r[0].id;
  },
  async getBatch(id, userId) {
    const since = new Date(Date.now() - 2 * 864e5).toISOString();
    const r = id
      ? await rest(`whatsapp_batches?select=*&id=eq.${q(id)}&user_id=eq.${q(userId)}`)
      : await rest(`whatsapp_batches?select=*&user_id=eq.${q(userId)}&undone=is.false&created_at=gte.${q(since)}&order=created_at.desc&limit=1`);
    return r[0] || null;
  },
  async undoBatch(batch, userId) {
    const ids = (batch.tx_ids || []).join(',');
    const r = ids ? await rest(`transactions?user_id=eq.${q(userId)}&id=in.(${ids})`, { method: 'DELETE' }) : [];
    await rest(`whatsapp_batches?id=eq.${q(batch.id)}`, { method: 'PATCH', body: JSON.stringify({ undone: true }) }, 'return=minimal');
    return r.length;
  },
};

/* ---------------- WhatsApp Cloud API ---------------- */
async function graph(path: string, body: Row) {
  const res = await fetch(`${GRAPH}/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`whatsapp ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
const PID = () => env('WHATSAPP_PHONE_NUMBER_ID');
const wa: Wa = {
  sendText: (to, text) => graph(`${PID()}/messages`, { messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 4000), preview_url: false } }),
  sendButtons: (to, text, buttons) => graph(`${PID()}/messages`, {
    messaging_product: 'whatsapp', to, type: 'interactive',
    interactive: { type: 'button', body: { text: text.slice(0, 1020) }, action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) } },
  }),
  markRead: (id) => graph(`${PID()}/messages`, { messaging_product: 'whatsapp', status: 'read', message_id: id }),
  async media(id) {
    const auth = { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}` };
    const meta = await (await fetch(`${GRAPH}/${id}`, { headers: auth })).json();
    if (!meta.url) throw new Error('mídia não encontrada');
    if (meta.file_size > 15 * 1024 * 1024) throw new Error('mídia muito grande');
    const buf = new Uint8Array(await (await fetch(meta.url, { headers: auth })).arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { mime: meta.mime_type, base64: btoa(bin) };
  },
};

/* ---------------- Gemini ---------------- */
const ai: Ai = {
  async interpret(parts, system) {
    const models = [env('GEMINI_MODEL') || 'gemini-flash-latest', 'gemini-flash-lite-latest'];
    let last: unknown;
    for (const model of models) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts }],
            generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: SCHEMA },
          }),
        });
        if (!res.ok) throw new Error(`gemini ${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const data = await res.json();
        const txt = data.candidates?.[0]?.content?.parts?.map((p: Row) => p.text || '').join('') || '';
        return JSON.parse(txt) as Intent;
      } catch (e) { last = e; console.error(String(e)); }
    }
    throw last;
  },
};

/* ---------------- servidor ---------------- */
Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    // verificação do webhook pela Meta
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env('WHATSAPP_VERIFY_TOKEN') && env('WHATSAPP_VERIFY_TOKEN')) {
      return new Response(url.searchParams.get('hub.challenge') || '', { status: 200 });
    }
    return new Response('Leco WhatsApp ok', { status: 200 });
  }
  if (req.method !== 'POST') return new Response('método não permitido', { status: 405 });
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get('x-hub-signature-256'), env('WHATSAPP_APP_SECRET')))) {
    return new Response('assinatura inválida', { status: 401 });
  }
  let body: Row;
  try { body = JSON.parse(raw); } catch { return new Response('json inválido', { status: 400 }); }
  // Responde já para a Meta e processa em segundo plano
  const work = handleWebhook(body, { db, wa, ai, now: () => new Date(), log: (...a) => console.error(...a.map(String)) });
  // @ts-ignore EdgeRuntime existe no Supabase
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work); else await work;
  return new Response('ok', { status: 200 });
});
