#!/usr/bin/env node
/**
 * Coleta completa do Instagram — AMGomes Social Analytics
 * Coleta perfil, TODOS os posts (com paginação), stories e conversas
 * de cada loja configurada e grava dados.js (estático, com timestamp real).
 *
 * Uso: node coleta_instagram.mjs
 * Exit codes: 0=ok · 10=falha de coleta (não sobrescreve dados.js)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const lines = readFileSync(join(__dir, '.env'), 'utf8').split('\n');
  const cfg = {};
  for (const line of lines) {
    if (line.startsWith('#') || !line.includes('=')) continue;
    const [k, ...v] = line.split('=');
    cfg[k.trim()] = v.join('=').trim();
  }
  return cfg;
}

const env = loadEnv();
const BASE = 'https://graph.facebook.com/v25.0';

// Cada loja lê L{n}_PAGE_ID / L{n}_IG_ID / L{n}_PAGE_TOKEN do .env; sem chaves = não conectada
const DEF_LOJAS = [
  { codigo: 'L1', nome: 'Casa da Beleza Altamira' },
  { codigo: 'L3', nome: 'Casa da Beleza Itaituba' },
  { codigo: 'L4', nome: 'MissBeleza Altamira' },
  { codigo: 'L5', nome: 'MissBeleza Santarém' },
];
const LOJAS = DEF_LOJAS.map(l => ({
  ...l,
  pageId: env[`${l.codigo}_PAGE_ID`] || null,
  igId: env[`${l.codigo}_IG_ID`] || null,
  token: env[`${l.codigo}_PAGE_TOKEN`] || null,
}));

async function apiGet(pathOrUrl, params = {}, token) {
  const url = pathOrUrl.startsWith('http') ? new URL(pathOrUrl) : new URL(`${BASE}/${pathOrUrl}`);
  if (!pathOrUrl.startsWith('http')) {
    url.searchParams.set('access_token', token);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const resp = await fetch(url.toString());
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function coletarLoja(loja) {
  if (!loja.igId || !loja.token) {
    return { codigo: loja.codigo, nome: loja.nome, conectada: false };
  }

  console.log(`\n📥 ${loja.codigo} (${loja.nome})...`);

  // Perfil
  const perfil = await apiGet(loja.igId, {
    fields: 'username,name,followers_count,follows_count,media_count,biography,website,profile_picture_url'
  }, loja.token);
  console.log(`   @${perfil.username}: ${perfil.followers_count} seguidores, ${perfil.media_count} posts`);

  // TODOS os posts com paginação
  const posts = [];
  let url = null;
  let page = 0;
  do {
    const data = url
      ? await apiGet(url, {}, loja.token)
      : await apiGet(`${loja.igId}/media`, {
          fields: 'id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink',
          limit: 100
        }, loja.token);
    posts.push(...(data.data || []));
    url = data.paging?.next || null;
    page++;
    process.stdout.write(`   posts: ${posts.length}\r`);
  } while (url && page < 20);
  console.log(`   posts coletados: ${posts.length}`);

  // Stories ativos
  let stories = [];
  try {
    const st = await apiGet(`${loja.igId}/stories`, {
      fields: 'id,caption,media_type,timestamp'
    }, loja.token);
    stories = st.data || [];
  } catch { /* sem permissão ou sem stories */ }

  // Conversas (DMs)
  let conversas = [];
  try {
    const conv = await apiGet(`${loja.pageId}/conversations`, {
      platform: 'instagram',
      fields: 'updated_time,message_count,unread_count'
    }, loja.token);
    conversas = conv.data || [];
  } catch { /* sem permissão */ }

  return {
    codigo: loja.codigo,
    nome: loja.nome,
    conectada: true,
    perfil: {
      username: perfil.username,
      nome: perfil.name,
      seguidores: perfil.followers_count,
      seguindo: perfil.follows_count,
      totalPosts: perfil.media_count,
      bio: perfil.biography || '',
      website: perfil.website || '',
      foto: perfil.profile_picture_url || ''
    },
    posts: posts.map(p => ({
      id: p.id,
      legenda: p.caption || '',
      tipo: p.media_type,
      produto: p.media_product_type || '',
      data: p.timestamp,
      curtidas: p.like_count ?? 0,
      comentarios: p.comments_count ?? 0,
      link: p.permalink
    })),
    stories: stories.map(s => ({ id: s.id, tipo: s.media_type, data: s.timestamp })),
    dms: {
      totalConversas: conversas.length,
      naoLidas: conversas.filter(c => c.unread_count > 0).length
    }
  };
}

async function main() {
  const resultado = {
    coletadoEm: new Date().toISOString(),
    coletadoEmBR: new Date().toLocaleString('pt-BR', { timeZone: 'America/Belem' }),
    lojas: []
  };

  let algumaOk = false;
  for (const loja of LOJAS) {
    try {
      const dados = await coletarLoja(loja);
      resultado.lojas.push(dados);
      if (dados.conectada) algumaOk = true;
    } catch (err) {
      console.error(`   ❌ ${loja.codigo}: ${err.message}`);
      resultado.lojas.push({ codigo: loja.codigo, nome: loja.nome, conectada: false, erro: err.message });
    }
  }

  if (!algumaOk) {
    console.error('\n❌ Nenhuma loja coletada com sucesso. dados.js preservado.');
    process.exit(10);
  }

  // Carregar histórico de seguidores (série temporal própria, a API não dá histórico)
  const histPath = join(__dir, 'historico_seguidores.json');
  let historico = [];
  if (existsSync(histPath)) {
    try { historico = JSON.parse(readFileSync(histPath, 'utf8')); } catch { historico = []; }
  }
  const hoje = new Date().toISOString().slice(0, 10);
  for (const l of resultado.lojas) {
    if (!l.conectada) continue;
    const jaTem = historico.find(h => h.data === hoje && h.loja === l.codigo);
    if (!jaTem) {
      historico.push({ data: hoje, loja: l.codigo, seguidores: l.perfil.seguidores, posts: l.perfil.totalPosts });
    }
  }
  writeFileSync(histPath, JSON.stringify(historico, null, 2));
  resultado.historicoSeguidores = historico;

  // Metas (se existir arquivo)
  const metasPath = join(__dir, 'metas.json');
  if (existsSync(metasPath)) {
    try { resultado.metas = JSON.parse(readFileSync(metasPath, 'utf8')); } catch { /* ignora */ }
  }

  // Concorrentes (se existir arquivo)
  const concPath = join(__dir, 'concorrentes.json');
  if (existsSync(concPath)) {
    try { resultado.concorrentes = JSON.parse(readFileSync(concPath, 'utf8')); } catch { /* ignora */ }
  }

  // Gravar dados.js
  const js = '// Gerado automaticamente por coleta_instagram.mjs — NÃO EDITAR NA MÃO\n' +
             'const DADOS_IG = ' + JSON.stringify(resultado, null, 1) + ';\n';
  writeFileSync(join(__dir, 'dados.js'), js);
  console.log(`\n✅ dados.js gravado — coleta de ${resultado.coletadoEmBR}`);
}

main().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(10);
});
