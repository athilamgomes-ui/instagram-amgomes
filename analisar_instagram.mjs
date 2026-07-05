#!/usr/bin/env node
/**
 * Análise semanal do Instagram — AMGomes Social Analytics
 * Uso: node analisar_instagram.mjs [--loja L5] [--dias 7]
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// Carregar configuração
function loadConfig() {
  const envPath = join(__dir, '.env');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  const cfg = {};
  for (const line of lines) {
    if (line.startsWith('#') || !line.includes('=')) continue;
    const [k, ...v] = line.split('=');
    cfg[k.trim()] = v.join('=').trim();
  }
  return cfg;
}

const cfg = loadConfig();
const TOKEN = cfg.FB_PAGE_TOKEN;
const IG_ID = cfg.IG_BUSINESS_ID;
const BASE = 'https://graph.facebook.com/v25.0';

async function apiGet(path, params = {}) {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set('access_token', TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url.toString());
  const data = await resp.json();
  if (data.error) throw new Error(`API error: ${data.error.message}`);
  return data;
}

// ─── Coleta de dados ──────────────────────────────────────────────────────────

async function getPerfil() {
  return apiGet(IG_ID, {
    fields: 'username,name,followers_count,follows_count,media_count,biography,website'
  });
}

async function getPostsRecentes(dias = 7) {
  const since = Date.now() - dias * 86400000;
  // Instagram /media não aceita `since` como filtro; busca e filtra localmente
  const data = await apiGet(`${IG_ID}/media`, {
    fields: 'id,caption,media_type,timestamp,like_count,comments_count,permalink',
    limit: 100
  });
  return (data.data || []).filter(p => new Date(p.timestamp).getTime() >= since);
}

async function getInsights(mediaId) {
  try {
    const data = await apiGet(`${mediaId}/insights`, {
      metric: 'impressions,reach,engagement,saved'
    });
    const result = {};
    for (const m of (data.data || [])) result[m.name] = m.values?.[0]?.value ?? m.value;
    return result;
  } catch {
    return {};
  }
}

async function getStories() {
  try {
    const data = await apiGet(`${IG_ID}/stories`, {
      fields: 'id,caption,media_type,timestamp,media_url'
    });
    return data.data || [];
  } catch {
    return [];
  }
}

async function getMensagens() {
  try {
    const data = await apiGet(`${cfg.FB_PAGE_ID}/conversations`, {
      platform: 'instagram',
      fields: 'participants,updated_time,message_count,unread_count'
    });
    return data.data || [];
  } catch {
    return [];
  }
}

async function getInsightsConta(periodo = 'day', dias = 7) {
  try {
    const since = Math.floor((Date.now() - dias * 86400000) / 1000);
    const until = Math.floor(Date.now() / 1000);
    const data = await apiGet(`${IG_ID}/insights`, {
      metric: 'follower_count,impressions,reach,profile_views,website_clicks',
      period: periodo,
      since,
      until
    });
    return data.data || [];
  } catch {
    return [];
  }
}

// ─── Formatação do relatório ──────────────────────────────────────────────────

function formatData(isoStr) {
  return new Date(isoStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function tipoEmoji(tipo) {
  return tipo === 'VIDEO' ? '🎬' : tipo === 'CAROUSEL_ALBUM' ? '🖼️' : '📷';
}

function resumoCaption(cap, max = 80) {
  if (!cap) return '*(sem legenda)*';
  const clean = cap.replace(/\n/g, ' ').trim();
  return clean.length > max ? clean.substring(0, max) + '…' : clean;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dias = parseInt(args[args.indexOf('--dias') + 1] || '7', 10);

  console.log(`\n🔍 Coletando dados do Instagram @${cfg.IG_USERNAME || IG_ID} (últimos ${dias} dias)...\n`);

  const [perfil, posts, stories, mensagens, insightsConta] = await Promise.all([
    getPerfil(),
    getPostsRecentes(dias),
    getStories(),
    getMensagens(),
    getInsightsConta('day', dias)
  ]);

  // Buscar insights de cada post
  const postsComInsights = await Promise.all(
    posts.map(async p => ({
      ...p,
      insights: await getInsights(p.id)
    }))
  );

  // Calcular métricas agregadas dos posts
  const totalLikes = postsComInsights.reduce((s, p) => s + (p.like_count || 0), 0);
  const totalComentarios = postsComInsights.reduce((s, p) => s + (p.comments_count || 0), 0);
  const totalImpr = postsComInsights.reduce((s, p) => s + (p.insights.impressions || 0), 0);
  const totalAlcance = postsComInsights.reduce((s, p) => s + (p.insights.reach || 0), 0);
  const totalSalvos = postsComInsights.reduce((s, p) => s + (p.insights.saved || 0), 0);
  const engRate = perfil.followers_count > 0
    ? (((totalLikes + totalComentarios) / posts.length) / perfil.followers_count * 100).toFixed(2)
    : '0';

  // Insights da conta (seguidores ganhos no período)
  const followerMetric = insightsConta.find(m => m.name === 'follower_count');
  const followerValues = followerMetric?.values || [];
  const seguidoresGanhos = followerValues.length >= 2
    ? followerValues[followerValues.length - 1].value - followerValues[0].value
    : 'N/D';

  // Post com melhor desempenho
  const melhorPost = postsComInsights.sort((a, b) =>
    (b.insights.reach || 0) - (a.insights.reach || 0)
  )[0];

  // Mensagens não lidas
  const naoLidas = mensagens.filter(m => m.unread_count > 0);

  // ─── Montar relatório ────────────────────────────────────────────────────
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const linhas = [
    `# 📊 Análise Instagram @${perfil.username} — ${dataHoje}`,
    `**Loja:** Miss Beleza Santarém (L5) | **Período:** últimos ${dias} dias`,
    '',
    '---',
    '',
    '## 👤 Perfil atual',
    `| Seguidores | Seguindo | Posts totais |`,
    `|---|---|---|`,
    `| **${perfil.followers_count?.toLocaleString('pt-BR')}** | ${perfil.follows_count} | ${perfil.media_count} |`,
    '',
    seguidoresGanhos !== 'N/D'
      ? `📈 **Crescimento no período:** ${seguidoresGanhos >= 0 ? '+' : ''}${seguidoresGanhos} seguidores`
      : '',
    '',
    '---',
    '',
    `## 📸 Posts publicados (${posts.length} no período)`,
    '',
    `| Métrica | Total | Média/post |`,
    `|---|---|---|`,
    `| ❤️ Curtidas | ${totalLikes} | ${posts.length ? Math.round(totalLikes/posts.length) : 0} |`,
    `| 💬 Comentários | ${totalComentarios} | ${posts.length ? Math.round(totalComentarios/posts.length) : 0} |`,
    `| 👁️ Impressões | ${totalImpr.toLocaleString('pt-BR')} | ${posts.length ? Math.round(totalImpr/posts.length).toLocaleString('pt-BR') : 0} |`,
    `| 📍 Alcance | ${totalAlcance.toLocaleString('pt-BR')} | ${posts.length ? Math.round(totalAlcance/posts.length).toLocaleString('pt-BR') : 0} |`,
    `| 🔖 Salvos | ${totalSalvos} | ${posts.length ? Math.round(totalSalvos/posts.length) : 0} |`,
    `| 📊 Taxa de engajamento | **${engRate}%** | — |`,
    '',
  ];

  if (melhorPost) {
    linhas.push(
      '### 🏆 Post de maior alcance',
      `> ${tipoEmoji(melhorPost.media_type)} ${resumoCaption(melhorPost.caption)}`,
      `> 📅 ${formatData(melhorPost.timestamp)} | 👁️ ${melhorPost.insights.reach?.toLocaleString('pt-BR') || 0} alcance | ❤️ ${melhorPost.like_count || 0} curtidas`,
      `> 🔗 ${melhorPost.permalink}`,
      ''
    );
  }

  linhas.push(
    '### 📋 Todos os posts',
    '',
    '| Data | Tipo | Legenda | ❤️ | 💬 | 👁️ Alcance |',
    '|---|---|---|---|---|---|'
  );

  for (const p of postsComInsights) {
    linhas.push(
      `| ${formatData(p.timestamp)} | ${tipoEmoji(p.media_type)} | ${resumoCaption(p.caption, 50)} | ${p.like_count || 0} | ${p.comments_count || 0} | ${(p.insights.reach || 0).toLocaleString('pt-BR')} |`
    );
  }

  linhas.push(
    '',
    '---',
    '',
    `## 📖 Stories ativos (${stories.length})`,
    stories.length === 0 ? '*Nenhum story ativo no momento.*' :
      stories.map(s => `- ${tipoEmoji(s.media_type)} ${formatData(s.timestamp)} ${resumoCaption(s.caption, 60)}`).join('\n'),
    '',
    '---',
    '',
    `## 💬 Mensagens diretas`,
    `- **Total de conversas:** ${mensagens.length}`,
    `- **Com mensagens não lidas:** ${naoLidas.length}`,
    naoLidas.length > 0 ? `\n⚠️ **Atenção:** ${naoLidas.length} conversa(s) com mensagem(s) não lida(s)!` : '',
    '',
    '---',
    '',
    '## 💡 Observações automáticas',
  );

  // Gerar observações automáticas
  const obs = [];
  if (posts.length === 0) obs.push('⚠️ Nenhum post publicado no período. Considere aumentar a frequência de publicação.');
  if (parseFloat(engRate) < 1) obs.push('📉 Taxa de engajamento abaixo de 1% — considere conteúdo mais interativo (enquetes, perguntas, CTA).');
  if (parseFloat(engRate) >= 3) obs.push('🌟 Excelente engajamento (≥3%)! Continue com a estratégia atual.');
  if (naoLidas.length > 0) obs.push(`📬 ${naoLidas.length} DM(s) sem resposta — responder rapidamente melhora o alcance orgânico.`);
  if (stories.length === 0) obs.push('💡 Nenhum story ativo — stories são essenciais para manter visibilidade diária.');
  if (totalSalvos > totalLikes * 0.1) obs.push('🔖 Alto índice de posts salvos — conteúdo informativo de qualidade!');

  if (obs.length === 0) obs.push('✅ Tudo dentro do esperado para o período.');
  linhas.push(...obs);

  linhas.push(
    '',
    '---',
    `*Relatório gerado em ${new Date().toLocaleString('pt-BR')} via AMGomes Social Analytics*'`
  );

  const relatorio = linhas.filter(l => l !== null && l !== undefined).join('\n');
  console.log(relatorio);
  return relatorio;
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
