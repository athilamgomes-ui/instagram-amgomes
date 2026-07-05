#!/usr/bin/env node
/**
 * Coleta diária de STORIES — acumula em historico_stories.json.
 * A Graph API só expõe stories ATIVOS (24h); rodar 2x/dia via launchd
 * garante o histórico que o dashboard analisa no sábado.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(join(__dir, '.env'), 'utf8').split('\n')) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const [k, ...v] = line.split('=');
  env[k.trim()] = v.join('=').trim();
}

const LOJAS = ['L1', 'L4', 'L5']
  .map(c => ({ codigo: c, igId: env[`${c}_IG_ID`], token: env[`${c}_PAGE_TOKEN`] }))
  .filter(l => l.igId && l.token);

const BASE = 'https://graph.facebook.com/v25.0';
async function api(path, params, token) {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const d = await (await fetch(url)).json();
  if (d.error) throw new Error(d.error.message);
  return d;
}

const histPath = join(__dir, 'historico_stories.json');
let hist = [];
if (existsSync(histPath)) { try { hist = JSON.parse(readFileSync(histPath, 'utf8')); } catch {} }

let novos = 0, atualizados = 0;
for (const loja of LOJAS) {
  try {
    const st = await api(`${loja.igId}/stories`, { fields: 'id,caption,media_type,timestamp' }, loja.token);
    for (const s of (st.data || [])) {
      const item = { id: s.id, tipo: s.media_type, data: s.timestamp, loja: loja.codigo,
                     legenda: s.caption || '' };
      try {
        const ins = await api(`${s.id}/insights`, { metric: 'reach,views,replies,total_interactions,navigation' }, loja.token);
        for (const m of (ins.data || [])) {
          const map = { reach: 'alcance', views: 'views', replies: 'respostas',
                        total_interactions: 'interacoes', navigation: 'navegacao' };
          item[map[m.name] || m.name] = m.values?.[0]?.value ?? 0;
        }
      } catch { /* insights indisponíveis */ }
      const ex = hist.find(h => h.id === item.id);
      if (ex) { Object.assign(ex, item); atualizados++; }
      else { hist.push(item); novos++; }
    }
  } catch (e) { console.error(`${loja.codigo}: ${e.message}`); }
}

writeFileSync(histPath, JSON.stringify(hist, null, 1));
console.log(`stories: +${novos} novos, ${atualizados} atualizados, total ${hist.length} (${new Date().toLocaleString('pt-BR')})`);
