// =====================================================================
// LECO · leitura de comprovante com IA (Supabase Edge Function)
// O app envia a foto (ou PDF) e recebe os dados do lançamento.
// Só aceita usuários logados (o Supabase confere o token antes de chegar aqui).
// Segredos: GEMINI_API_KEY (obrigatório), GEMINI_MODEL (opcional).
// Limite diário por usuário: tabela ai_usage (supabase/ia.sql). Sem ela, não há limite.
// =====================================================================
const env = (k: string) => Deno.env.get(k) || '';
const DAILY_LIMIT = Number(env('AI_DAILY_LIMIT') || 40);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    encontrado: { type: 'BOOLEAN', description: 'true se a imagem é um cupom, nota, recibo, fatura, boleto ou comprovante de pagamento/transferência' },
    tipo: { type: 'STRING', enum: ['despesa', 'receita'] },
    valor: { type: 'NUMBER', description: 'Valor TOTAL pago ou recebido, em reais. Ex.: 87.35' },
    data: { type: 'STRING', description: 'Data da compra ou do pagamento, AAAA-MM-DD' },
    vencimento: { type: 'STRING', description: 'Só para boleto/fatura ainda não paga: data de vencimento AAAA-MM-DD' },
    estabelecimento: { type: 'STRING', description: 'Nome da loja, empresa ou pessoa (quem recebeu, se for despesa; quem pagou, se for receita)' },
    descricao: { type: 'STRING', description: 'Descrição curta para o lançamento, ex.: "Supermercado Dia" ou "Pix para João"' },
    categoria: { type: 'STRING', description: 'Uma das categorias da lista enviada, com o nome exato' },
    forma: { type: 'STRING', enum: ['credito', 'debito', 'pix', 'dinheiro', 'boleto', 'transferencia', 'outro'] },
    parcelas: { type: 'INTEGER', description: 'Número de parcelas no crédito; 1 se à vista' },
    cartao_final: { type: 'STRING', description: 'Últimos 4 dígitos do cartão, se aparecerem' },
    itens: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Até 5 itens principais da nota, se houver' },
    confianca: { type: 'NUMBER', description: 'De 0 a 1: quão seguro você está do valor e da data' },
  },
  required: ['encontrado'],
};

function prompt(b: Record<string, unknown>) {
  const cats = (b.categories || {}) as { out?: string[]; in?: string[] };
  return `Você lê comprovantes para o Leco, um app brasileiro de controle financeiro. Extraia os dados da imagem no formato JSON pedido.
Hoje é ${b.today || new Date().toISOString().slice(0, 10)}.
Categorias de despesa: ${(cats.out || []).join('; ')}
Categorias de receita: ${(cats.in || []).join('; ')}
Cartões do usuário: ${((b.cards as string[]) || []).join('; ') || '(nenhum)'}
Regras:
- Cupom fiscal, nota, recibo: despesa com o VALOR TOTAL (não o subtotal nem o troco). Data da emissão.
- Comprovante de Pix/TED/transferência: se o dono do comprovante enviou, é despesa (estabelecimento = quem recebeu); se recebeu, é receita (estabelecimento = quem pagou).
- Boleto não pago: despesa com o valor do documento; preencha "vencimento".
- Comprovante de cartão (maquininha): forma "credito" ou "debito" conforme o texto; parcelas se houver "PARC" ou "2x", "3x" etc.
- Escolha a categoria da lista que melhor combina (mercado/restaurante → alimentação; posto/uber → transporte; farmácia → saúde...).
- Valores em reais como número (1.234,56 → 1234.56). Datas DD/MM/AA viram AAAA-MM-DD.
- Se não for um comprovante ou estiver ilegível, responda {"encontrado": false}. Nunca invente valores.`;
}

async function underLimit(userId: string) {
  const url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key || !userId) return true;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/ai_use`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_user: userId, p_limit: DAILY_LIMIT }) });
    if (!r.ok) return true; // tabela ainda não criada: sem limite
    return (await r.json()) !== false;
  } catch (e) { return true; }
}

const userOf = (req: Request) => {
  try {
    const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return p.role === 'authenticated' ? String(p.sub || '') : '';
  } catch (e) { return ''; }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'método não permitido' });
  const user = userOf(req);
  if (!user) return json(401, { error: 'Entre na sua conta para usar a leitura de comprovantes.' });
  if (!env('GEMINI_API_KEY')) return json(503, { error: 'A leitura por IA ainda não foi ativada no servidor (falta a chave do Gemini).' });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch (e) { return json(400, { error: 'Pedido inválido.' }); }
  const image = String(body.image || '');
  const mime = String(body.mime || 'image/jpeg');
  if (!image || image.length > 9_000_000) return json(413, { error: 'Imagem muito grande. Tente uma foto menor.' });
  if (!/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(mime)) return json(415, { error: 'Envie uma foto ou um PDF.' });
  if (!(await underLimit(user))) return json(429, { error: `Limite de ${DAILY_LIMIT} leituras por dia atingido. Tente amanhã.` });

  const models = [env('GEMINI_MODEL') || 'gemini-flash-latest', 'gemini-flash-lite-latest'];
  let last = '';
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt(body) }] },
          contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: image } }, { text: 'Leia este comprovante.' }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: SCHEMA },
        }),
      });
      if (!r.ok) { last = `${model} ${r.status}: ${(await r.text()).slice(0, 200)}`; continue; }
      const data = await r.json();
      const txt = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
      return json(200, JSON.parse(txt));
    } catch (e) { last = String(e); }
  }
  console.error(last);
  return json(502, { error: 'O serviço de IA não respondeu agora. Tente de novo em instantes.' });
});
