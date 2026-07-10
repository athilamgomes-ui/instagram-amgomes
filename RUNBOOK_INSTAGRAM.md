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

**Agendamento:** Task MCP `dashboard-instagram-update` (18:30 todo dia) — **NÃO é launchd bash direto.**
⚠️ Corrigido em 09/07/2026: o launchd antigo `com.amgomes.instagram` chamava `/bin/bash` direto pra
rodar o script dentro de `~/Desktop/...` e falhava sempre com **"Operation not permitted"**
(`/tmp/com.amgomes.instagram.err`) — o Desktop é pasta protegida por TCC no macOS e um processo
em background do launchd sem GUI não tem essa permissão (por isso NUNCA atualizava sozinho, só
quando eu rodava manual via Bash). Curiosamente `com.amgomes.instagram.stories` (que chama
`node script.mjs` direto, sem passar por `/bin/bash` executando o arquivo) funcionava normalmente —
a trava do TCC é por processo/binário responsável, não só por pasta. Fix: plist antigo desligado e
renomeado `com.amgomes.instagram.plist.disabled-2026-07-09` (não apagado). A execução real agora
acontece dentro do Claude Desktop via Task MCP (que já tem a permissão), acordado pelo launchd
`com.amgomes.dashboard` que já dispara `open -a Claude` às 18:30 todo dia — mesmo padrão de
Vendas/Compras. **Nunca mais criar launchd que chame `/bin/bash <script em ~/Desktop>` direto —
sempre Task MCP.** Logs do pipeline: `/tmp/com.amgomes.instagram.{out,err}` (ainda escritos pelo
script quando rodado manual; a Task MCP reporta no chat, não nesses arquivos).

## Credenciais e API

- `.env` (gitignorado, NUNCA commitar): App ID/Secret da Meta, Page Token **permanente** (não expira),
  IG Business ID. App Meta: "AMGomes Social Analytics" (ID 2089657445229024), portfólio MISS BELEZA (241132993237012).
- Token foi obtido via Graph API Explorer → user token → long-lived → **page token permanente**.
  Se o token morrer (senha do FB trocada, permissões revogadas): repetir o fluxo no Explorer
  (permissões: instagram_basic, instagram_manage_comments, instagram_manage_messages,
  pages_show_list, pages_read_engagement, business_management) e refazer o exchange.
- **Insights FUNCIONAM desde 05/07 (token v2)**: `instagram_manage_insights` adicionada ao caso de
  uso do app (não aparecia no dropdown do Explorer — foi adicionada em Casos de uso → Permissões e
  recursos) e re-OAuth. Métricas por mídia: saved, shares, reach, views, total_interactions.
  Cache incremental em `insights_cache.json` (posts >90d são imutáveis; teto 300 chamadas/loja/run).
- **Stories**: API só expõe stories ATIVOS (24h). `coleta_stories.mjs` roda 2×/dia (launchd
  `com.amgomes.instagram.stories`, 12h/20h) acumulando em `historico_stories.json` (com insights:
  alcance, respostas, interações). O dashboard analisa esse histórico automaticamente.
- **Direct/conversas: BLOQUEADO em acesso standard.** `/{page-id}/conversations` estoura Timeout
  (subcode 2534084 — "muitas conversas com usuários sem função no app") para qualquer página além
  da 1ª (`limit=1` sem fields lê SÓ a conversa mais recente). Ler o inbox completo (e automatizar
  atendimento/Helena IA) exige **Acesso Avançado** a `instagram_manage_messages` via App Review +
  verificação de negócio. `coleta_direct.mjs` existe e funciona no que o acesso permite.
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

## Fluxo de execução da Ana Lídia (definido 05/07/2026)

Dashboard = estratégia · **Canva** = arte · **Meta Business Suite (Planner)** = agendamento automático.
No plano de postagem de cada loja há: botão **"🗓️ Agendar no Business Suite"** (abre o Planner
da Página certa via `PAGE_IDS` hardcoded no index.html — IDs públicos, ok em repo público) e
**legendas prontas por tema** (botão copiar; campos [PRODUTO]/[PREÇO] a preencher). Legendas se
adaptam: se "🎁 Sorteio" está nos temas top da conta, o 1º card é sorteio, senão oferta.
L3 sem Página → sem botão. Lovable NÃO gera imagens (é builder de apps) — explicado ao Athila 05/07.
Fase 2 possível: publicar direto pelo painel via `instagram_content_publish` (não implementado).

## Regras herdadas do padrão da casa

- Timestamp exibido = o da coleta, estático, escrito pelo pipeline (regra do "timestamp mentiroso").
- Após deploy, entregar URL com `?v=<número>` (cache GitHub Pages de 10 min).
- Nunca duas sessões editando ao mesmo tempo; lock em `/tmp/instagram_update.lock`.
- Repo público: `.env` no `.gitignore` — conferir antes de qualquer `git add -A` fora do pipeline.

## Verificação da empresa — CONCLUÍDA 06/07/2026, mas NÃO liberou o Direct sozinha

Athila enviou os documentos do CNPJ no Business Manager em 05/07/2026. Vigia (`verificar_empresa.mjs`,
launchd `com.amgomes.meta.verificacao`) detectou `verified` em 06/07 08:39, notificou e se descarregou
sozinho, como previsto.

**Retestado `node coleta_direct.mjs L5 40` em 06/07/2026 — MESMO erro de antes:**
Timeout / subcode 2534084 / "Solicite acesso avançado à permissão instagram_manage_messages ou
reduza o número de tópicos... com usuários sem função no app". Ou seja: verificação de negócio era
**pré-requisito, não a solução** — o inbox completo do Direct via API exige, além da empresa
verificada, o **App Review aprovado** especificamente para `instagram_manage_messages` (Acesso
Avançado da permissão, não só do portfólio).

**RETESTADO 06/07/2026 após a empresa verificada — CONFIRMADO: não existe rota sem Tech Provider.**
Fui em Casos de uso → API do Instagram → Permissões e recursos → `instagram_manage_messages` →
Ações → "Adicionar à análise do app". Apareceu de novo o modal "To add a permission or feature to
App Review, become a Tech Provider", agora com 3 sub-requisitos explícitos: (1) Verificação da
empresa, (2) Verificação de acesso, (3) Análise do app. **A verificação da empresa que o Athila já
fez é só o 1º dos 3 passos PARA virar Tech Provider — não é uma alternativa a ele.** Ou seja: para
este app, qualquer Acesso Avançado via App Review (incluindo `instagram_manage_messages`) exige
virar Tech Provider, mesmo sendo um app de negócio próprio sem atender terceiros. Cliquei em
"Go back" — não confirmei nada.

**Decisão pendente do Athila:** virar Tech Provider é IRREVERSÍVEL. Prós: libera o inbox completo
do Direct via API (base pra Helena IA). Contras: status muda o perfil de compliance/revisão do app
para sempre, mesmo o app nunca tendo servido terceiros. Pré-requisitos de envio já prontos:
política de privacidade, URL de exclusão de dados, categoria do app. Falta: ícone do app (upload
manual pendente) e o formulário + screencast do App Review (textos em `app_review_justificativa.md`).
Alternativa sem depender da Meta: atendimento por Direct continua manual pelas vendedoras; a
"Helena IA" pode nascer primeiro em outro canal (ex. WhatsApp Business API) enquanto o Direct não
é decidido.
