// Testes do agente do WhatsApp com Meta, Gemini e banco simulados.
// Rodar: node tests/whatsapp-agent.mjs
import esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const out = path.join(os.tmpdir(), `leco-wa-core-${process.pid}.mjs`);
esbuild.buildSync({ entryPoints: [new URL('../supabase/functions/whatsapp/core.ts', import.meta.url).pathname], outfile: out, format: 'esm', platform: 'neutral', logLevel: 'error' });
const { handleWebhook, validSignature, answerQuery, invoiceOf } = await import(out);
process.on('exit', () => { try { fs.unlinkSync(out); } catch (e) { /* ok */ } });
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const U = 'user-1';
const state = {
  seen: new Set(), msgs: [], links: {}, codes: { 'LECO-123456': U },
  tx: [], batches: [],
  user: {
    name: 'Leonardo Sousa',
    accounts: [{ id: 'acc-nu', name: 'Nubank', initial_balance: 100000 }, { id: 'acc-poup', name: 'Poupança', initial_balance: 0 }],
    cards: [{ id: 'card-nu', name: 'Nubank Roxinho', closing_day: 3, due_day: 10, limit_amount: 500000 }],
    categories: [
      { id: 'c-ali', name: 'Alimentação', kind: 'out', budget: 80000 }, { id: 'c-tra', name: 'Transporte', kind: 'out', budget: 0 },
      { id: 'c-out', name: 'Outros gastos', kind: 'out', budget: 0 }, { id: 'c-sal', name: 'Salário', kind: 'in', budget: 0 },
      { id: 'c-oin', name: 'Outras receitas', kind: 'in', budget: 0 },
    ],
  },
};
const sent = [];
let nextIntent = null;
let lastParts = null;
const deps = {
  now: () => new Date('2026-10-23T15:00:00Z'),
  log: () => {},
  db: {
    async seenMessage(id, phone) { if (state.seen.has(id)) return true; state.seen.add(id); state.msgs.push({ phone, at: Date.now() }); return false; },
    async recentCount(phone) { return state.msgs.filter((m) => m.phone === phone).length; },
    async getLink(p) { return state.links[p] || null; },
    async consumeCode(c) { const u = state.codes[c]; delete state.codes[c]; return u || null; },
    async link(p, u) { state.links[p] = u; },
    async unlink(p) { delete state.links[p]; },
    async loadUser() { return { ...state.user, transactions: [...state.tx].sort((a, b) => (a.date < b.date ? 1 : -1)) }; },
    async insertTx(rows) { const keys = JSON.stringify(Object.keys(rows[0])); rows.forEach((r) => assert.equal(JSON.stringify(Object.keys(r)), keys)); const m = rows.map((r) => ({ ...r, id: crypto.randomUUID() })); state.tx.push(...m); return m; },
    async createBatch(u, ids) { const id = 'b' + state.batches.length; state.batches.push({ id, user_id: u, tx_ids: ids, undone: false }); return id; },
    async getBatch(id) { return id ? state.batches.find((b) => b.id === id) : [...state.batches].reverse().find((b) => !b.undone) || null; },
    async undoBatch(b) { const before = state.tx.length; state.tx = state.tx.filter((t) => !b.tx_ids.includes(t.id)); b.undone = true; return before - state.tx.length; },
  },
  wa: {
    async sendText(to, text) { sent.push({ to, text }); },
    async sendButtons(to, text, buttons) { sent.push({ to, text, buttons }); },
    async media(id) { return { mime: 'image/jpeg', base64: 'AAAA' + id }; },
    async markRead() {},
  },
  ai: { async interpret(parts) { lastParts = parts; return nextIntent; } },
};
let n = 0;
const PHONE = '5511999998888';
const send = async (msg, intent = null) => {
  nextIntent = intent; sent.length = 0;
  await handleWebhook({ entry: [{ changes: [{ value: { messages: [{ id: 'wamid.' + n++, from: PHONE, ...msg }] } }] }] }, deps);
  return sent.map((s) => s.text).join('\n---\n');
};
const T = (body) => ({ type: 'text', text: { body } });

// 1. não vinculado
let r = await send(T('gastei 50 no mercado'));
assert.match(r, /vincule este número/); console.log('✓ não vinculado pede código');
// 2. código errado / certo
r = await send(T('LECO-000000')); assert.match(r, /inválido ou expirado/);
r = await send(T('meu código é leco-123456')); assert.match(r, /Pronto, Leonardo/); assert.equal(state.links[PHONE], U);
console.log('✓ vinculação por código');
// 3. despesa simples
r = await send(T('gastei 45,90 no mercado'), { intencao: 'registrar', lancamentos: [{ tipo: 'despesa', valor: 45.9, descricao: 'Mercado', data: '2026-10-23', categoria: 'alimentacao' }] });
assert.match(r, /Registrado no Leco/); assert.match(r, /R\$ 45,90/); assert.match(r, /Alimentação · Nubank · 23\/10\/2026/);
assert.equal(state.tx[0].amount, 4590); assert.equal(state.tx[0].category_id, 'c-ali'); assert.equal(state.tx[0].paid, true);
assert.equal(sent[0].buttons[0].id, 'undo:b0'); console.log('✓ despesa simples com botão Desfazer');
// 4. parcelado no cartão (23/10 >= fechamento 3 → fatura de novembro)
r = await send(T('tênis 300 em 3x no roxinho'), { intencao: 'registrar', lancamentos: [{ tipo: 'despesa', valor: 300, descricao: 'Tênis', data: '2026-10-23', categoria: 'Vestuário', cartao: 'Roxinho', parcelas: 3 }] });
const inst = state.tx.filter((t) => t.card_id);
assert.deepEqual(inst.map((t) => t.amount), [10000, 10000, 10000]); assert.deepEqual(inst.map((t) => t.invoice), ['2026-11', '2026-12', '2027-01']);
assert.equal(inst[0].category_id, 'c-out'); assert.match(r, /3x de R\$ 100,00/); assert.match(r, /fatura de novembro/);
console.log('✓ parcelado no cartão, faturas e categoria reserva');
// 5. receita + transferência numa mensagem
r = await send(T('recebi 3500 de salário e passei 500 para a poupança'), { intencao: 'registrar', lancamentos: [
  { tipo: 'receita', valor: 3500, descricao: 'Salário', data: '2026-10-23', categoria: 'Salário' },
  { tipo: 'transferencia', valor: 500, descricao: 'Reserva', data: '2026-10-23', conta: 'nubank', conta_destino: 'poupanca' }] });
assert.match(r, /2 lançamentos registrados/); assert.ok(state.tx.some((t) => t.kind === 'transfer' && t.to_account_id === 'acc-poup'));
console.log('✓ vários lançamentos na mesma mensagem');
// 6. conta futura fica a pagar
r = await send(T('boleto de luz 180 vence dia 30'), { intencao: 'registrar', lancamentos: [{ tipo: 'despesa', valor: 180, descricao: 'Conta de luz', data: '2026-10-30', ja_pago: false }] });
assert.match(r, /a pagar/); assert.equal(state.tx.at(-1).paid, false); console.log('✓ conta futura a pagar');
// 7. sem valor → pergunta
r = await send(T('comprei pão'), { intencao: 'registrar', lancamentos: [], pergunta: 'Quanto custou o pão?' });
assert.equal(r, 'Quanto custou o pão?'); console.log('✓ pergunta quando falta valor');
// 8. consultas
r = await send(T('qual meu saldo?'), { intencao: 'consultar', consulta: { tipo: 'saldo' } });
// 1000 - 45,90 + 3500 - 500 = 3954,10 no Nubank; poupança 500
assert.match(r, /Nubank: \*R\$ 3\.954,10\*/); assert.match(r, /Poupança: \*R\$ 500,00\*/); assert.match(r, /Saldo em contas: R\$ 4\.454,10/);
console.log('✓ saldo calculado'); 
r = await send(T('quanto gastei este mês?'), { intencao: 'consultar', consulta: { tipo: 'gastos', de: '2026-10-01', ate: '2026-10-31' } });
assert.match(r, /gastou \*R\$ 145,90\*/); console.log('✓ gastos do mês'); 
r = await send(T('o que vence?'), { intencao: 'consultar', consulta: { tipo: 'vencimentos' } });
assert.match(r, /Conta de luz/); console.log('✓ vencimentos'); 
r = await send(T('resumo'), { intencao: 'consultar', consulta: { tipo: 'resumo' } }); 
r = await send(T('orçamentos'), { intencao: 'consultar', consulta: { tipo: 'orcamentos' } }); assert.match(r, /Alimentação: R\$ 45,90 de R\$ 800,00 \(6%\)/);
r = await send(T('faturas'), { intencao: 'consultar', consulta: { tipo: 'faturas' } }); 
// 9. desfazer pelo botão
const before = state.tx.length;
r = await send({ type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'undo:b1', title: 'Desfazer' } } });
assert.match(r, /3 lançamentos removidos/); assert.equal(state.tx.length, before - 3);
r = await send({ type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'undo:b1', title: 'Desfazer' } } });
assert.match(r, /Não encontrei/); console.log('✓ desfazer pelo botão (e não desfaz duas vezes)');
r = await send(T('desfazer')); assert.match(r, /1 lançamento removido/); console.log('✓ desfazer por texto (último lote)');
// 10. foto e áudio vão como mídia para a IA
await send({ type: 'image', image: { id: 'img1', mime_type: 'image/jpeg', caption: 'mercado' } }, { intencao: 'registrar', lancamentos: [{ tipo: 'despesa', valor: 87.35, descricao: 'Supermercado Dia', data: '2026-10-22', categoria: 'Alimentação' }] });
assert.equal(lastParts[0].inline_data.mime_type, 'image/jpeg'); assert.match(lastParts[1].text, /legenda: "mercado"/);
await send({ type: 'audio', audio: { id: 'aud1', mime_type: 'audio/ogg; codecs=opus' } }, { intencao: 'ajuda' });
assert.ok(lastParts[0].inline_data); console.log('✓ foto e áudio enviados à IA');
// 11. mensagem repetida da Meta não duplica
const cnt = state.tx.length; nextIntent = { intencao: 'registrar', lancamentos: [{ tipo: 'despesa', valor: 10, descricao: 'X', data: '2026-10-23' }] };
const dup = { entry: [{ changes: [{ value: { messages: [{ id: 'wamid.dup', from: PHONE, ...T('x 10') }] } }] }] };
await handleWebhook(dup, deps); await handleWebhook(dup, deps); assert.equal(state.tx.length, cnt + 1); console.log('✓ mensagem repetida ignorada');
// 12. IA fora do ar
deps.ai.interpret = async () => { throw new Error('503'); };
r = await send(T('gastei 5')); assert.match(r, /serviço de IA não respondeu/); console.log('✓ erro da IA tratado');
// 13. assinatura
const body = '{"a":1}'; const sig = 'sha256=' + crypto.createHmac('sha256', 'segredo').update(body).digest('hex');
assert.equal(await validSignature(body, sig, 'segredo'), true); assert.equal(await validSignature(body, sig, 'outro'), false); assert.equal(await validSignature(body, null, 'segredo'), false);
console.log('✓ assinatura da Meta');
// 14. regra da fatura
assert.equal(invoiceOf({ closing_day: 31 }, '2026-02-28'), '2026-03'); assert.equal(invoiceOf({ closing_day: 10 }, '2026-10-09'), '2026-10');
console.log('✓ regra da fatura');
console.log('\nTODOS OS TESTES PASSARAM');
