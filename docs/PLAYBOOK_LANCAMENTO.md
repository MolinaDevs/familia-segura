# Playbook: do código "pronto" ao app publicado

Método extraído da construção do Família Segura (Expo/React Native + API Node/Express + Postgres), de
set–out/2026. Serve para repetir o mesmo caminho em outro app: a ordem das fases, o que verificar em cada uma,
as armadilhas que já custaram tempo e a forma de trabalho com um dono não técnico.

Como usar numa sessão nova: ler este arquivo inteiro, descobrir em que fase o app está (§2) e seguir a partir
dali. As fases são independentes; o que não se aplica à stack do app novo é pulado, não adaptado à força.

## 1. Forma de trabalho (o que funcionou)

- **Idioma e leitor**: tudo em português do Brasil, para um dono que decide mas não é técnico. Explicar o
  problema pelo efeito ("o responsável não conseguiria entrar ao trocar de celular"), não pelo mecanismo.
- **Ciclo fixo por pedido**: analisar → listar achados com gravidade → plano → executar → testar → commit →
  push → acompanhar o CI em segundo plano → avisar o resultado. O dono sempre responde "me avise o resultado":
  nunca encerrar com CI pendente sem dizer que ele está rodando, e sempre voltar com o resultado.
- **Achados em tabela** (ID, gravidade, problema, correção), com um relatório em `docs/` por revisão. O relatório
  só diz "corrigido" para o que foi implementado e testado.
- **Uma revisão por papel**, cada uma pedida como "revisão como especialista em X, sem deixar lacunas: análise,
  plano de ação e execução": segurança → backend → frontend → auditoria direcionada → infraestrutura → lojas.
  Revisões em sequência acham coisas diferentes; uma revisão "geral" acha menos.
- **Verificar antes de afirmar**: rodar testes e tipos; conferir de fora com `curl` o que foi publicado; abrir o
  app no navegador depois de mexer em tela. Quando algo não pôde ser testado (precisa de aparelho real, conta
  real), dizer isso e dizer como o dono testa.
- **Painéis de terceiros**: o dono manda prints (em PDF); responder campo a campo, com o valor a digitar. Quando
  a tela dele não bate com a instrução, pedir o print em vez de insistir.
- **Segredos**: nunca pedir chave secreta no chat. Chave pública (publishable, DSN, IDs) pode vir pelo chat.
  Secreta vai direto do painel de origem para o painel de destino. Validar a secreta de fora, pelo efeito
  (ex.: cabeçalho de erro do servidor), nunca lendo o valor.
- **Decisões do dono** (hospedagem, tipo de conta, preço): dar uma recomendação com o motivo e a condição que
  faria mudar de ideia; perguntar só o que muda o próximo passo.
- **Erro próprio**: dizer qual foi, o efeito e a correção, e seguir.
- **Memória e documentos**: gravar o checklist de produção na memória do projeto e em `docs/`, para a próxima
  sessão começar sabendo o estado.

## 2. Sequência das fases

| # | Fase | Pedido típico do dono | Entregável |
|---|---|---|---|
| 1 | Revisão ponto a ponto e plano de lançamento | "revise tudo, plano e execute por fases" | `docs/PLANO_LANCAMENTO.md`, grátis × pago, tutorial de primeiros passos |
| 2 | Segurança | "revisão de segurança como especialista" | `docs/SEGURANCA.md` |
| 3 | Backend | "a mesma verificação como especialista em backend" | `docs/BACKEND.md` |
| 4 | Frontend | "login, validações, integração com o backend" | `docs/FRONTEND.md` |
| 5 | Auditoria direcionada | "XSS, rotas expostas, chaves, banco aberto, SQL injection, limites, pacotes inventados" | seção nova em `SEGURANCA.md` |
| 6 | Parecer de lançamento e infraestrutura | "quero rodar sem depender da minha máquina, com monitoramento" | `docs/INFRAESTRUTURA.md`, `render.yaml` |
| 7 | Subida em produção | dono cria contas; guiar por print | API no ar, monitorada |
| 8 | Build de teste e beta | "testar com usuários reais antes das lojas" | build instalável, roteiro de beta |
| 9 | Preparação das lojas | "faça tudo e me acione só no estritamente necessário" | guias campo a campo, imagens, lista "só você faz" |

## 3. O que verificar em cada revisão

### Segurança (modelo de ameaça primeiro: quem é o adversário mais provável?)
- Segredos e verificadores (PIN, tokens) fora de armazenamento comum: `SecureStore`/Keychain, nunca `AsyncStorage`.
- `android.allowBackup: false`.
- Senhas/PINs fracos recusados no servidor e avisados no app (mesma regra dos dois lados).
- Toda rota que um aparelho/cliente pode chamar em laço: limite por identidade; texto vindo do cliente que vira
  notificação: truncado e sempre depois de um título do servidor.
- Limite global por IP + limite de escrita por identidade + limites próprios nas rotas sensíveis.
- Cabeçalhos (CSP, `X-Frame-Options`, `nosniff`, HSTS), sem parsers desnecessários.
- App de produção só fala `https://`.
- CI com `permissions: contents: read`; Dependabot; `pnpm audit` com overrides para o que tem correção.
- Repositório público: varrer código **e histórico** por chaves; conferir arquivos de plataforma (`.replit`, etc.).

### Backend
- Integrações externas: prazo (`AbortSignal.timeout`), cache **também do resultado negativo**, uma chamada por
  vez por chave, falha registrada em log (nunca engolida).
- Pool do banco: teto, prazos, listener de `error` (sem ele, queda de conexão ociosa derruba o processo).
- Desligamento gracioso, `unhandledRejection`/`uncaughtException`, variáveis obrigatórias checadas na subida.
- Índices para consultas frequentes e chaves estrangeiras; retenção de dados igual à prometida na política.
- Corridas: duas requisições simultâneas do mesmo cliente (travar a linha, gravar em lote).
- `/healthz` (processo vivo) e `/readyz` (banco responde); 404 em JSON; id de requisição devolvido.
- **Testar contra o formato real das APIs de terceiros**, não contra o formato imaginado (ver §4, RevenueCat).

### Frontend
- Login: todos os estados que o provedor pode devolver (segundo fator, aparelho novo), não só "completo".
- Mensagens do provedor de login traduzidas por código; não revelar se o e-mail tem conta.
- Sair da conta: desregistrar push no servidor, apagar cache local, encerrar sessão — nessa ordem.
- React Query: sem retentativa em 4xx; atualizar ao voltar para o app; usar `isPending` (não `isLoading`) para
  decidir "ainda carregando" — pedido em pausa não pode parecer "sem dados".
- Erro de servidor ≠ falta de internet: mensagens diferentes para 401/403, 404, 429, rede.
- Cache local com versão no nome; telas defensivas a dados de versão antiga.
- Validações do formulário iguais às do contrato da API (mínimos e máximos).
- Links e botões que dependem de variável de ambiente de uma plataforma (ex.: domínio do Replit): conferir que
  funcionam no build publicado.

### Auditoria direcionada
XSS (onde há HTML?), mapa de **todas** as rotas com o middleware de cada uma, chaves no histórico do git, porta
do banco local presa a `127.0.0.1`, nenhum `sql.raw`, limites em toda rota sensível, dependências conferidas
no registro (existência, idade, downloads) e lockfile só com o registro oficial.

## 4. Armadilhas que já aconteceram (conferir cedo)

| Onde | Armadilha | Sinal | Saída |
|---|---|---|---|
| `.env` do projeto | Chaves de **exemplo** (ex.: Clerk apontando para `clerk.example.com`) que "funcionam" porque o dev usa modo demonstração | App real trava no carregamento; servidor responde "secret key invalid" | Decodificar a chave pública (base64) e conferir o domínio antes de dizer que a chave serve |
| Clerk | `publishableKeyFromHost` (modelo do Replit) monta a chave pelo Host com `pk_live` | Login quebra só em produção | Usar a chave configurada; derivar do Host só com flag |
| Clerk | Instância de desenvolvimento serve para o beta; produção exige domínio próprio; "Native API" precisa estar ligada | — | Planejar o domínio cedo |
| RevenueCat API v2 | `active_entitlements` devolve só `entitlement_id` (`entl…`), nunca o nome | Premium concedido não aparece | Resolver o id pelo nome ou configurar o id; testar com o formato real |
| RevenueCat | Chave da **loja de teste** pública (no app/repositório) permite "comprar" de graça | — | Em produção aceitar só assinatura real (`store`, `environment`); flag para o beta |
| RevenueCat | "Gerenciar assinatura" não faz nada em Premium de cortesia | Botão mudo | Usar `managementURL`; explicar quando não há |
| Google Play Protect (Brasil) | Bloqueia APK de fora da loja que **declara** acessibilidade, sem opção de liberar | "App bloqueado para proteger seu dispositivo" | Beta só pelo Teste interno da Play; para o dono, ADB ou pausar o Play Protect |
| Bancos (Brasil) | App de banco abre no lugar do instalador de APK; pode recusar abrir com acessibilidade de fora da loja | — | "Abrir com" → instalador; avisar no roteiro do beta |
| Render | Nomes de plano mudam (`0.5c-512mb`, `0.1c-256mb`); `corepack enable` falha (somente leitura) | "Blueprint… a few issues"; `EROFS` | Conferir a spec atual; `corepack pnpm …` |
| Render | `autoDeployTrigger: checksPass` espera o CI inteiro (build iOS ~30 min) | Deploy "não acontece" | "Manual Deploy" quando há pressa; serviço gerenciado por Blueprint: variável não secreta vai no `render.yaml` |
| pnpm + Sentry | Script do Xcode resolve `@sentry/cli` antes de checar `SENTRY_DISABLE_AUTO_UPLOAD` | Build iOS falha em "Upload Debug Symbols" | `@sentry/cli` como dependência direta do app |
| pnpm | Dependência nova com peer opcional duplica variantes (ex.: `drizzle-orm` × `@opentelemetry/api`) | Erros de tipo sem relação com a mudança | Declarar o peer nos pacotes que usam a lib |
| esbuild | Pacote marcado `external` que não é dependência direta | `ERR_MODULE_NOT_FOUND` no bundle | Tirar do `external` |
| Sentry 11 | Coleta corpo, cabeçalhos e cookies por padrão | — | `dataCollection` desligado item a item; sem captura de tela no app |
| Android (Xiaomi) | Texto com `letterSpacing` e largura automática é medido curto | Última letra/palavra some | Largura do pai (`alignSelf: 'stretch'`) ou uma linha com folga |
| Expo | `expo-secure-store` adiciona pedido de Face ID em inglês | Aparece no Info.plist | `faceIDPermission: false` |
| Expo | Arquivo do Firebase em repositório público | — | Variável de arquivo no EAS + `app.config.js` |
| EAS | `env:create --force` em variável existente recria; ambientes são independentes | — | Listar `preview` e `production` depois de mexer |
| UptimeRobot | Monitorar a raiz (404 de propósito) marca "fora do ar" | — | Monitorar `/api/readyz`; "Latest incidents" é a verdade |
| Lojas | Página de suporte sem contato; exclusão de conta só pelo app | Recusa | Contato na página; caminho de exclusão sem o app |
| Lojas | Declaração que não bate com o build (ex.: política de Device Admin) | Recusa | Auditar o manifesto real (`expo config --type introspect`) |
| Contas | Empresa (CNPJ) exige D-U-N-S nas duas lojas; pessoal no Google exige teste fechado de 12 pessoas/14 dias | Semanas de espera | Pedir o D-U-N-S no primeiro dia |
| Ferramentas locais | `git add -A` leva arquivos do editor (`.vs/`) e sobras de CLI | — | Olhar `git status` antes de commitar; `.gitignore` |

## 5. Receita de infraestrutura (dono sem equipe técnica)

- **Código e CI**: GitHub; CI com tipos, testes e build nativo Android/iOS.
- **API + Postgres**: Render por Blueprint (`render.yaml` versionado): plano pago (o grátis hiberna), banco sem
  acesso externo (`ipAllowList: []`), migração no pré-deploy, health check em `/api/readyz`, deploy só com CI
  verde, segredos com `sync: false`.
- **Builds**: EAS (conta de equipe), ambientes `preview` (beta) e `production`, `appVersionSource: remote`.
- **Erros**: Sentry no app e na API, desligado sem DSN, sem dados pessoais.
- **Disponibilidade**: UptimeRobot em `/api/readyz`.
- **Push Android**: Firebase (arquivo via EAS; chave FCM V1 enviada ao EAS).
- **Domínio**: registro.br + Cloudflare; destrava login de produção e e-mail profissional.
- Ordem de subida: banco/API → conferir de fora (saúde, HTTPS, 401 sem login, limites, páginas legais) →
  monitoramento → EAS → build de teste → push.

Variáveis que não podem faltar: `NODE_ENV`, `DATABASE_URL`, chaves do provedor de login, chaves e **id do
entitlement** da assinatura, dados legais (razão social, CNPJ, encarregado), `TRUST_PROXY_HOPS`, DSN do Sentry,
flag de compras de teste (ligada no beta, desligada no lançamento).

## 6. Preparação das lojas (o que dá para fazer sem as contas)

1. Auditar manifesto e Info.plist; remover permissões e pedidos que o app não usa.
2. Política de Privacidade com **todos** os operadores atuais; suporte com contato; exclusão sem o app.
3. Capturas reais do app com dados de demonstração (Chrome headless, janela 500×1084 e fator 2,58 → 1290×2796),
   ícones 512/1024, banner 1024×500.
4. Guias campo a campo (Play Console e App Store Connect), texto do pedido de capacidades especiais (ex.:
   Family Controls), notas para a revisão, roteiro do vídeo exigido.
5. Uma lista única do que só o dono faz, em ordem e com prazo (`SO_VOCE_FAZ.md`).

## 7. Mensagem para abrir a sessão do próximo app

> Leia `docs/PLAYBOOK_LANCAMENTO.md` (ou a skill `lancamento-app`). Este é outro aplicativo que quero levar até
> a publicação com o mesmo método. Primeiro descubra em que fase ele está, me diga o que já existe e o que
> falta, e proponha a ordem das fases. Tudo em português, comigo decidindo e você executando; acompanhe o CI e
> me avise os resultados; me acione só para o que exige minhas contas ou uma decisão minha.
