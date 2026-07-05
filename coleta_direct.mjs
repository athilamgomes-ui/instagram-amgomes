#!/usr/bin/env node
/**
 * Coleta conversas do Instagram Direct — DADOS SENSÍVEIS, saída local (gitignorada).
 * Uso: node coleta_direct.mjs L5 [limiteConversas]
 * Saída: direct_<loja>.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(join(__dir, '.env'), 'utf8').split('\n')) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const [k, ...v] = line.split('=');
  env[k.trim()] = v.join('=').trim();
}

const LOJA = process.argv[2] || 'L5';
const LIMITE = parseInt(process.argv[3] || '60', 10);
const PAGE_ID = env[`${LOJA}_PAGE_ID`];
const TOKEN = env[`${LOJA}_PAGE_TOKEN`];
if (!PAGE_ID || !TOKEN) { console.error(`${LOJA} sem credenciais`); process.exit(1); }

const BASE = 'https://graph.facebook.com/v25.0';
async function api(pathOrUrl, params, token, tentativas = 4) {
  const url = pathOrUrl.startsWith('http') ? new URL(pathOrUrl) : new URL(`${BASE}/${pathOrUrl}`);
  if (!pathOrUrl.startsWith('http')) {
    url.searchParams.set('access_token', token);
    for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  }
  for (let t = 1; t <= tentativas; t++) {
    const d = await (await fetch(url)).json();
    if (!d.error) return d;
    // Timeout e "unknown error" da Meta são transitórios — backoff e retry
    if (t === tentativas) throw new Error(JSON.stringify(d.error));
    await new Promise(r => setTimeout(r, 5000 * t));
  }
}

console.log(`📥 Direct da ${LOJA} (até ${LIMITE} conversas)...`);

// Listar conversas — SEM fields e limit=1 (único modo que não estoura o timeout da Meta
// em acesso standard; ver runbook). Lento porém confiável.
const conversas = [];
let after = null;
do {
  const params = { platform: 'instagram', limit: 1 };
  if (after) params.after = after;
  let d;
  try { d = await api(`${PAGE_ID}/conversations`, params, TOKEN, 6); }
  catch (e) { console.error(`\n   listagem parou em ${conversas.length}: ${e.message}`); break; }
  conversas.push(...(d.data || []));
  after = (conversas.length < LIMITE && d.paging?.cursors?.after && d.data?.length) ? d.paging.cursors.after : null;
  process.stdout.write(`   listadas: ${conversas.length}\r`);
  await new Promise(r => setTimeout(r, 1200));
} while (after);

console.log(`   ${conversas.length} conversas listadas`);

// Puxar mensagens de cada conversa
const resultado = [];
let i = 0;
for (const c of conversas.slice(0, LIMITE)) {
  i++;
  try {
    const msgs = await api(`${c.id}/messages`, {
      fields: 'message,from,created_time',
      limit: 20
    }, TOKEN);
    await new Promise(r => setTimeout(r, 400)); // respeitar rate limit
    resultado.push({
      id: c.id,
      atualizada: c.updated_time,
      totalMensagens: c.message_count,
      naoLidas: c.unread_count,
      participantes: [...new Set((msgs.data || []).map(m => m.from?.username || m.from?.name).filter(Boolean))],
      mensagens: (msgs.data || []).map(m => ({
        de: m.from?.name || m.from?.username || m.from?.id || '?',
        deId: m.from?.id,
        texto: m.message || '(mídia/anexo)',
        em: m.created_time
      })).reverse() // cronológica
    });
    process.stdout.write(`   ${i}/${Math.min(conversas.length, LIMITE)}\r`);
  } catch (e) {
    resultado.push({ id: c.id, erro: e.message });
  }
}

const out = join(__dir, `direct_${LOJA}.json`);
writeFileSync(out, JSON.stringify({ coletadoEm: new Date().toISOString(), pageId: PAGE_ID, loja: LOJA, conversas: resultado }, null, 1));
console.log(`\n✅ ${out} — ${resultado.length} conversas com mensagens`);
