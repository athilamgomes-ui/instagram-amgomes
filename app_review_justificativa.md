# Acesso Avançado ao Direct (instagram_manage_messages) — plano e textos

## ⚠️ DESCOBERTA 05/07/2026 — leia antes de agir

Ao tentar adicionar a permissão à análise do app, a Meta exibiu: **"To add a permission or
feature to App Review, become a Tech Provider"** — status IRREVERSÍVEL, para empresas que
prestam serviço a TERCEIROS (agências/SaaS). Não somos isso: o app acessa só ativos do
próprio grupo.

**O caminho correto para apps de negócio próprio é a VERIFICAÇÃO DA EMPRESA** (Business
Verification) no Business Manager. Em apps empresariais conectados a um portfólio, a
verificação da empresa libera acesso pleno aos ativos que o próprio negócio possui — sem
App Review e sem virar Tech Provider. Após verificar, RETESTAR a leitura de conversas
(`node coleta_direct.mjs L5 40`). Só considerar Tech Provider se, verificado, o acesso
continuar limitado (decisão do Athila — é irreversível).

## Descrição de uso (colar no formulário, campo "Como você usará esta permissão?")

**EN (preferido pela Meta):**

> AMGomes Social Analytics is an internal business tool used exclusively by Grupo A.M. Gomes
> (beauty retail stores "Miss Beleza" and "Casa da Beleza" in Pará, Brazil) to manage its own
> Instagram professional accounts.
>
> We use instagram_manage_messages to: (1) read Direct messages received by our own stores'
> Instagram accounts to measure customer-service quality (response time, common questions,
> most requested products); and (2) reply to customers of our own stores, including automated
> first-response messages during business hours.
>
> The app is used only by employees of our company (app roles). We do not serve third parties.
> Messages are analyzed in aggregate for internal dashboards; personal data is never shared
> or published. Data deletion requests are honored via grupo@missbeleza.com.br (see privacy policy).

**PT (referência):**

> Ferramenta interna do Grupo A.M. Gomes para gerenciar as contas profissionais de Instagram
> das próprias lojas. Usamos a permissão para ler DMs recebidas pelas nossas lojas (medir
> qualidade de atendimento, perguntas e produtos mais pedidos) e responder clientes,
> incluindo primeira resposta automática. Só funcionários usam o app; nada é publicado
> ou compartilhado com terceiros.

## Screencast (a Meta exige vídeo demonstrando o uso)

Gravar tela (QuickTime → Gravação de Tela) mostrando:
1. Login no app via Facebook (Graph API Explorer ou fluxo do app)
2. Uma chamada à API lendo mensagens da própria conta (ex.: `GET /{page-id}/conversations?platform=instagram`)
3. Uma resposta sendo enviada via API (`POST /{conversation-id}/messages`) para um testador
4. Mostrar que a conta atendida pertence ao negócio

Dica: usar a conta de teste/funcionário como cliente. O vídeo pode ter narração em PT — legendas EN ajudam.

## Pré-requisitos de envio (status em 05/07/2026)

- [x] Política de Privacidade: https://athilamgomes-ui.github.io/instagram-amgomes/privacidade.html
- [x] URL de instruções de exclusão de dados (mesma página, seção 4)
- [x] Categoria do app: Negócio e Páginas
- [ ] Ícone do app 512×512 (upload em Configurações → Básico)
- [ ] **Verificação do negócio** no Business Manager (business.facebook.com/settings/security
      → "Central de Segurança" → "Iniciar verificação") — CNPJ, endereço, telefone e
      documento (contrato social ou cartão CNPJ). Leva 1–5 dias úteis.
- [ ] Adicionar `instagram_manage_messages` ao envio (Casos de uso → Permissões → Ações →
      "Adicionar à análise do app")
- [ ] Preencher formulário + screencast e enviar
