# Infraestrutura, monitoramento e caminho até as lojas

**Decisões do dono (30/09/2026):** hospedagem no **Render**; contas das lojas como **empresa (CNPJ)**.

Documento para o dono (sem precisar de conhecimento técnico): o que falta para lançar, como o Família Segura
vai rodar sem depender de nenhum computador pessoal, como saber na hora quando algo quebra e como testar com
famílias reais antes de publicar. Estado em 30/09/2026.

## 1. Parecer de lançamento

**Veredito: pronto para beta fechado com famílias reais; ainda não pronto para publicar nas lojas.**

O que está pronto (código):
- Produto completo (plano grátis × Premium, anúncios discretos, guia de primeiros passos, relatórios, pausa,
  trava de tela na hora de dormir) e revisado em 4 rodadas: segurança, backend, frontend e auditoria direcionada
  (`docs/SEGURANCA.md`, `docs/BACKEND.md`, `docs/FRONTEND.md`).
- 77 testes automáticos da API e CI verde a cada alteração (checagem, compilação Android e iOS).

O que impede publicar hoje (nenhum item é de código a escrever; são contas, aprovações e testes):

| # | Bloqueio | Por que importa | Quem |
|---|---|---|---|
| 1 | **Nunca rodou em aparelho real** | CI prova que compila, não que bloqueia apps de verdade em Samsung/Motorola/Xiaomi ou no iPhone. | Beta (§5) |
| 2 | **Apple: autorização "Family Controls (Distribution)"** | Sem ela o app não vai para o TestFlight nem para a App Store. A Apple leva de dias a semanas. | Dono — pedir já |
| 3 | **Google Play: declarações de permissões sensíveis** (Acessibilidade, Administrador do dispositivo, acesso ao uso, lista de apps) | É onde apps de controle parental mais são recusados. Precisa de vídeo e justificativa. | Dono, com textos prontos em `artifacts/familia-segura/docs/launch/` |
| 4 | **Produção não existe** (servidor, banco, domínio, chaves de produção) | Hoje a API só roda no computador de desenvolvimento/Replit. | §3 e §4 |
| 5 | **Sem monitoramento** de falhas no app e na API | Sem isso, você só descobre um problema quando o cliente reclama ou desinstala. | §4 |
| 6 | **Projeto EAS não vinculado** (`projectId` ausente em `app.json`) | Sem ele o app não recebe notificações (pedidos de tempo, alertas) e não há builds na nuvem. | Configuração inicial (§3, passo 5) |
| 7 | **Dados legais** (razão social, CNPJ, e-mail do encarregado) e IDs reais do AdMob | Exigidos na Política de Privacidade e pelas lojas. | Dono |

Achado desta verificação, já corrigido: a chave da loja de teste da RevenueCat está no repositório público
(`.replit`). Com ela, qualquer pessoa poderia "comprar" o Premium de graça. Agora o servidor de produção só
aceita **assinaturas reais das lojas**. No beta, as compras de teste valem com `PREMIUM_ACCEPT_SANDBOX=true`
(teste S17).

## 2. Como vai funcionar (visão geral)

```
 Celulares (responsável e criança)
        │ HTTPS
        ▼
 api.familiasegura.com.br ──► Servidor da API (Render)  ──► Banco Postgres gerenciado (Render, backups diários)
        │                           │
        │                           ├─► Clerk (login)      ├─► RevenueCat (assinaturas)
        │                           └─► Expo Push (avisos) └─► Sentry (erros)  ◄── UptimeRobot (checa a cada 1 min)
 Código no GitHub ──► CI (testes) ──► deploy automático no Render
 Builds do app: EAS (nuvem da Expo) ──► TestFlight / Google Play
```

Nada disso depende do seu computador: o código fica no GitHub, a API e o banco na nuvem, os builds do app na
nuvem da Expo. Qualquer pessoa autorizada consegue continuar o trabalho a partir das contas.

## 3. Infraestrutura recomendada

Critério: o mínimo de manutenção para quem não é técnico, custo baixo no começo e caminho claro para crescer.

| Peça | Serviço recomendado | Por quê | Custo inicial (estimativa) |
|---|---|---|---|
| Código e CI | **GitHub** (já em uso) | Fonte única; testes a cada alteração | Grátis |
| Servidor da API | **Render** (Web Service, região Virgínia/EUA) | Deploy automático a cada alteração aprovada, reinício automático, checagem de saúde, HTTPS pronto, painel simples | ~US$ 7/mês |
| Banco de dados | **Render Postgres** (mesma região) | Backups diários, rede privada com a API, um painel só | ~US$ 6–20/mês |
| Domínio | **registro.br** + DNS no **Cloudflare** | `.com.br` é o esperado no Brasil; Cloudflare é grátis e protege contra ataques | ~R$ 40/ano |
| Login | **Clerk** (instância de produção) | Já integrado; plano gratuito cobre o início | Grátis no início |
| Assinaturas | **RevenueCat** | Já integrado | Grátis até US$ 2,5 mil/mês de receita |
| Builds e envio às lojas | **EAS (Expo)** | Gera os apps Android/iOS na nuvem e envia às lojas | Grátis (fila) ou US$ 19/mês |
| Erros e travamentos | **Sentry** (app e API) | Mostra o erro, o aparelho e a linha do código; alerta por e-mail | Grátis (5 mil erros/mês) |
| Disponibilidade | **UptimeRobot** (ou Better Stack) | Testa a API a cada minuto e avisa se cair | Grátis |
| Lojas | Apple Developer / Google Play | Obrigatórias | US$ 99/ano / US$ 25 uma vez |

Total para começar: **cerca de US$ 15–30 por mês**, mais as contas das lojas.

Alternativa com dados no Brasil: **Fly.io**, região São Paulo (`gru`), com Postgres gerenciado em São Paulo
(Neon). Resposta um pouco mais rápida para o usuário brasileiro, mas mais técnico de operar. A LGPD não exige
servidor no Brasil (exige salvaguardas e transparência, já na Política de Privacidade). Começar no Render e
migrar depois, se necessário, é simples: a API é um servidor Node comum e o banco é Postgres padrão.

### Passo a passo da primeira subida (ordem sugerida)

1. **Domínio**: registrar `familiasegura.com.br` (ou o escolhido) no registro.br e apontar o DNS para o
   Cloudflare.
2. **Banco**: criar o Postgres no Render (plano com backup); copiar a URL interna.
3. **API**: criar o Web Service no Render ligado ao GitHub (branch `main`), com:
   - instalação/build: `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm --filter @workspace/api-server run build`
   - antes de cada deploy: `pnpm --filter @workspace/db run migrate`
   - início: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
   - checagem de saúde: `/api/readyz`
   - variáveis: as de `docs/ACOES_DO_DONO.md` §4.1 (`NODE_ENV=production`, `DATABASE_URL`,
     `TRUST_PROXY_HOPS=1`, chaves do Clerk e da RevenueCat, dados legais), `NODE_VERSION=24` e, **só durante
     o beta**, `PREMIUM_ACCEPT_SANDBOX=true`.
   - domínio próprio `api.seudominio.com.br` (o Render emite o HTTPS).
4. **Clerk produção**: criar a instância de produção com o domínio (registros DNS que o Clerk indicar) e
   ativar Google/Apple.
5. **EAS**: `eas init` no app (grava o `projectId`) e cadastrar no painel da Expo as variáveis
   `EXPO_PUBLIC_*` de produção (API com `https://`, Clerk, RevenueCat, AdMob).
6. **Monitoramento** (§4): Sentry e UptimeRobot.
7. **Conferência pós-deploy**: `/api/readyz` responde; `/api/legal/privacy` com razão social/CNPJ; criar
   família de teste, parear um aparelho, receber o aviso de "pediu mais tempo".

Os passos 2 e 3 já estão no arquivo **`render.yaml`** na raiz do repositório (infraestrutura como código): no
Render, **New → Blueprint →** escolher o repositório. Ele cria a API e o banco (sem acesso pela internet, só pela
rede privada), só publica depois que o CI passa, roda as migrações antes de cada versão e pede as chaves
secretas na criação — elas nunca ficam no repositório.

### Contas das lojas como empresa (CNPJ)

- **D-U-N-S** (número gratuito da Dun & Bradstreet, exigido pela Apple e pelo Google para contas de empresa):
  consultar/solicitar pela ferramenta da Apple em developer.apple.com/enroll/duns-lookup. Pode levar até
  ~2 semanas: **pedir primeiro**.
- **Apple Developer Program** como organização (US$ 99/ano): razão social igual à do CNPJ/D-U-N-S, site da
  empresa e e-mail com o domínio próprio. A razão social aparece como "vendedor" na App Store.
- **Google Play Console** como organização (US$ 25): D-U-N-S, site e verificação da empresa. **Dispensa o teste
  fechado obrigatório de 12 testadores/14 dias** das contas pessoais (o beta continua recomendado).
- Os mesmos dados vão para `LEGAL_CONTROLLER_NAME`/`LEGAL_CONTROLLER_CNPJ` (Política de Privacidade).

### Ativar o Sentry (monitoramento de erros)

O código já está integrado no app e na API, **desligado até existir a chave**:
1. Criar conta em sentry.io (plano Developer, grátis) e dois projetos: `familia-segura-api` (Node) e
   `familia-segura-app` (React Native).
2. API: colar o DSN do projeto da API em `SENTRY_DSN` no Render.
3. App: colar o DSN do projeto do app em `EXPO_PUBLIC_SENTRY_DSN` no painel do EAS (ambientes preview e
   production) e gerar um novo build.
4. Opcional (erros com a linha exata do código no app): criar um token no Sentry, cadastrar `SENTRY_AUTH_TOKEN`,
   `SENTRY_ORG` e `SENTRY_PROJECT` no EAS e trocar `SENTRY_DISABLE_AUTO_UPLOAD` para `false` no `eas.json`.
5. No Sentry, ligar os alertas por e-mail de "erro novo" e "pico de erros".

Privacidade: nenhum dado pessoal, corpo de requisição, cabeçalho de login, captura de tela ou gravação de
sessão é enviado — só o erro, a versão e o modelo do aparelho (configurado em `lib/monitoring.ts` do app e da API).

### Ambientes

- **Agora (beta)**: um ambiente só, que já é o de produção, com `PREMIUM_ACCEPT_SANDBOX=true` para as compras
  de teste do TestFlight e do teste fechado.
- **No lançamento**: trocar para `PREMIUM_ACCEPT_SANDBOX=false`. Com o produto no ar, criar um ambiente de
  homologação (segundo serviço + banco pequeno) para testar mudanças antes de chegarem aos clientes.

## 4. Monitoramento: o que vigiar e quem avisa

| O quê | Ferramenta | Alerta quando | Já preparado no código |
|---|---|---|---|
| API fora do ar ou sem banco | UptimeRobot em `/api/readyz` | 2 falhas seguidas (≈2 min) | Sim (`/api/readyz` verifica o banco) |
| Erros no servidor (500) | Sentry (API) | Erro novo ou pico | Sim — liga com `SENTRY_DSN` |
| App travando/fechando | Sentry (app) + Play Console/App Store Connect | Erro novo; "sem travamentos" abaixo de 99,5% | Sim — liga com `EXPO_PUBLIC_SENTRY_DSN` |
| Lentidão | Sentry Performance / métricas do Render | Resposta p95 acima de 1 s | Logs com tempo de resposta |
| Banco cheio / muitas conexões | Painel do Render | Disco acima de 80% | Retenção de 12 meses apaga dados antigos |
| Ataques e abusos | Logs (429/401) | Pico de 429 em pareamento/PIN | Limites de tentativas em todas as rotas sensíveis |
| Falha em rotinas automáticas | Logs ("Falha na retenção", "Erro no envio de push") | Qualquer ocorrência | Sim (mensagens padronizadas) |
| Receita e assinaturas | Painel da RevenueCat | Queda de renovações | — |
| Notas e comentários nas lojas | Play Console / App Store Connect | Nota abaixo de 4 | — |

Cada resposta da API traz um `X-Request-Id`, que liga a reclamação do cliente ao erro exato no log.

Rotina mínima do dono: olhar o Sentry e as avaliações das lojas uma vez por semana; os alertas de queda chegam
por e-mail ou no celular.

## 5. Testar com famílias reais antes de publicar

Dá para testar com pessoas reais, instalando pelos canais oficiais de teste das lojas, sem o app aparecer
publicamente.

### Android
- **Primeiras rodadas (equipe, 3–5 aparelhos)**: build `preview` do EAS gera um link de instalação direta (APK).
  Não passa pela Google; serve para amigos próximos na mesma semana.
- **Teste interno do Google Play**: até 100 pessoas convidadas por e-mail, disponível em minutos, sem revisão
  completa.
- **Teste fechado**: com a conta de empresa (CNPJ) não é obrigatório, mas é o melhor canal para o beta com as
  famílias (até milhares de testadores por lista de e-mails ou grupo), com atualização automática pela loja.

### iPhone
- **TestFlight**: interno (até 100 pessoas da equipe, sem revisão) e externo (até 10 mil, por link, com uma
  revisão rápida da Apple).
- **Condição**: o TestFlight exige a autorização Family Controls (Distribution) da Apple (bloqueio 2 do §1).
  Enquanto não sai, só dá para testar em iPhones cadastrados (build de desenvolvimento, até 100 aparelhos) —
  suficiente para a equipe.

### Como conduzir o beta ("in loco")
1. **Recrutar 15–20 famílias** (amigos, escola, grupos de pais), misturando iPhone e Android, de preferência com
   Samsung, Motorola e Xiaomi.
2. **Instalação presencial com as primeiras 5 famílias**: observar sem ajudar. As permissões do Android e o
   Compartilhamento Familiar da Apple são onde as pessoas travam; o que for observado vira ajuste de texto.
3. **Duração: 2–3 semanas** (cobre os 14 dias do Google), com um grupo de WhatsApp para dúvidas e um formulário
   curto no fim de cada semana.
4. **Roteiro de testes**: o de `docs/TESTE_BETA.md` (matriz iPhone × Android, tentativas de burlar, modo avião,
   reinício do aparelho).
5. **Critérios para publicar**: nenhuma forma de burlar a proteção sem ser percebida; 99,5% das sessões sem
   travamento; sincronização em segundo plano funcionando em 90% ou mais dos aparelhos; famílias dizendo que
   usariam (e quantas pagariam).
6. **LGPD no beta**: os testadores aceitam a mesma Política de Privacidade; avisar que é versão de teste e que
   podem excluir tudo no app a qualquer momento.

## 6. Cronograma sugerido

| Semana | O quê |
|---|---|
| 1 | Pedir o D-U-N-S e a autorização Family Controls da Apple; criar contas (lojas como empresa, Render, domínio, Sentry, UptimeRobot) |
| 1–2 | Subir API e banco pelo `render.yaml`; vincular EAS; colar os DSNs do Sentry; primeiro build `preview`; testes da equipe em aparelhos reais |
| 2–4 | Beta fechado (teste fechado do Google + TestFlight quando a Apple aprovar), com 15–20 famílias |
| 4–5 | Corrigir o que o beta mostrar; preparar declarações do Google Play com vídeo; fichas das lojas |
| 5–6 | Enviar para revisão; `PREMIUM_ACCEPT_SANDBOX=false`; lançamento |
