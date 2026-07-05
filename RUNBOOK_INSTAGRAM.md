# RUNBOOK — Dashboard Instagram (AMGomes Social Analytics)

> Carregar este arquivo ANTES de mexer no projeto. Criado em 05/07/2026.

## O que é

Dashboard de análise de Instagram das 4 lojas, focado em **execução de marketing (Ana Lídia)**:
plano de postagem semanal, o que funcionou historicamente, metas de crescimento, concorrentes.

- **URL:** https://athilamgomes-ui.github.io/instagram-amgomes/ (usar `?v=<n>` após deploy — cache 10 min)
- **Repo:** https://github.com/athilamgomes-ui/instagram-amgomes (público — NUNCA commitar .env)
- **Pasta local:** `/Users/elkgomes/Desktop/claude/instagram-analytics/`

## Pipeline (um comando — agente NUNCA edita dados.js na mão)

```bash
bash /Users/elkgomes/Desktop/claude/instagram-analytics/atualizar_instagram.sh
```

Exit: 0=ok · 10=coleta falhou (dados.js anterior preservado + notificação macOS) · 30=lock (`/tmp/instagram_update.lock`).
Fluxo: `coleta_instagram.mjs` (Graph API → dados.js com timestamp REAL) → git commit/push → Pages.

**Agendamento:** launchd `com.amgomes.instagram` — **sábado 16:30** (logs em `/tmp/com.amgomes.instagram.{out,err}`).

## Credenciais e API

- `.env` (gitignorado, NUNCA commitar): App ID/Secret da Meta, Page Token **permanente** (não expira),
  IG Business ID. App Meta: "AMGomes Social Analytics" (ID 2089657445229024), portfólio MISS BELEZA (241132993237012).
- Token foi obtido via Graph API Explorer → user token → long-lived → **page token permanente**.
  Se o token morrer (senha do FB trocada, permissões revogadas): repetir o fluxo no Explorer
  (permissões: instagram_basic, instagram_manage_comments, instagram_manage_messages,
  pages_show_list, pages_read_engagement, business_management) e refazer o exchange.
- **Insights de alcance/impressões indisponíveis** (permissão `instagram_manage_insights` exige
  revisão da Meta). Engajamento é medido por curtidas+comentários. Não "corrigir" isso sem revisão aprovada.
- `/{ig-id}/media` **não aceita `since`** — coleta tudo paginado e filtra localmente.

## Lojas

| Loja | Conta | Status |
|---|---|---|
| L5 MissBeleza Santarém | @missbelezaoficial (IG 17841408856810548, Page 2152437001676475) | ✅ conectada |
| L1 / L3 / L4 | — | 🔌 pendente: refazer OAuth marcando as outras Páginas (só "MissBeleza" foi concedida) |

Para conectar as demais: Graph API Explorer → Generate Access Token → na tela do Facebook,
**marcar TODAS as Páginas** → salvar `L1_PAGE_ID`, `L1_IG_ID`, `L1_PAGE_TOKEN` (etc.) no `.env`.
O coletor já lê essas chaves e o dashboard mostra a aba automaticamente.

## Arquivos

- `coleta_instagram.mjs` — coletor (perfil, todos os posts paginados, stories, DMs) → `dados.js`
- `index.html` — painel (lê `dados.js`; JS NUNCA sobrescreve o timestamp de coleta)
- `metas.json` — metas editáveis (seguidores 30/90d, posts/semana, engajamento %)
- `concorrentes.json` — monitoramento manual; atualizar pedindo ao Claude
  "atualize o monitoramento de concorrentes do dashboard Instagram" (pesquisa web, sem API)
- `historico_seguidores.json` — série temporal própria (1 ponto por coleta/dia; API não dá histórico)
- `dados.js` — gerado; nunca editar na mão

## Regras herdadas do padrão da casa

- Timestamp exibido = o da coleta, estático, escrito pelo pipeline (regra do "timestamp mentiroso").
- Após deploy, entregar URL com `?v=<número>` (cache GitHub Pages de 10 min).
- Nunca duas sessões editando ao mesmo tempo; lock em `/tmp/instagram_update.lock`.
- Repo público: `.env` no `.gitignore` — conferir antes de qualquer `git add -A` fora do pipeline.
