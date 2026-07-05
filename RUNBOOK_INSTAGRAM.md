# RUNBOOK — Dashboard Instagram (AMGomes Social Analytics)

> Carregar este arquivo ANTES de mexer no projeto. Criado em 05/07/2026.

## O que é

Dashboard de análise de Instagram das 4 lojas para a **Ana Lídia**, com dois papéis:
**gestão** (aba Visão Geral: comparação entre lojas, tendência 12 meses, 90d vs 90d, alertas)
e **execução de marketing** (por loja: plano de postagem, o que funcionou por tema/formato/dia/horário,
metas, concorrentes).

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
| **L1 Casa da Beleza Altamira** | @casadabelezaaltamira (IG 17841403942947039, Page 271167596379346) | ✅ conectada 05/07 |
| **L4 MissBeleza Altamira** | @missbelezaoficial (IG 17841408856810548, Page "MissBeleza" 2152437001676475) | ✅ conectada 05/07 |
| **L5 MissBeleza Santarém** | @missbelezastm (IG 17841463963553956, Page "Miss Beleza Stm" 432919069914495) | ✅ conectada 05/07 |
| L3 Casa da Beleza Itaituba | — | ❌ SEM Página FB na conta do Athila (não apareceu no OAuth) |

⚠️ @missbelezaoficial é a **L4**, não L5 (confirmado pelo Athila 05/07). Existe também uma Página
"Miss Beleza" (2105506966128429) SEM Instagram vinculado — ignorar (antiga/duplicada).

Como foi conectado (se precisar repetir/adicionar loja): o OAuth "já autorizado" mantém a seleção
antiga de Páginas. Caminho que funcionou: usuário edita as Páginas do app em
facebook.com/settings?tab=business_tools → "AMGomes Social Analytics" → marca todas → na tela de
reconexão do OAuth, clicar em **"Editar configurações"** (NUNCA "Reconectar" direto, que restaura a
seleção antiga) → Generate Access Token no Explorer → exchange short→long→page tokens (permanentes)
→ salvar `L{n}_PAGE_ID/_IG_ID/_PAGE_TOKEN` no `.env`. O coletor lê as chaves automaticamente.
Para a L3: criar Página FB + IG business da loja (ou obter admin da existente) e repetir o fluxo.

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
