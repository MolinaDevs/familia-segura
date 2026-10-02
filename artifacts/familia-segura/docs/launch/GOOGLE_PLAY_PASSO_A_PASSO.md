# Google Play Console — preenchimento passo a passo

Tudo o que a Play Console pergunta, com a resposta pronta. Conferido contra o build em 01/10/2026 (manifesto
sem localização, câmera, contatos, SMS nem `QUERY_ALL_PACKAGES`; ID de anúncios bloqueado; backup desligado).
Os textos longos da ficha estão em `STORE_LISTING_PT_BR.md`; as imagens, em `store-assets/`.

## 0. Criar o app

| Campo | Resposta |
|---|---|
| Nome do app | Família Segura: Controle Parental |
| Idioma padrão | Português (Brasil) – pt-BR |
| App ou jogo | App |
| Gratuito ou pago | Gratuito (com compras no app) |
| Nome do pacote (no primeiro envio) | `com.familiasegura.app` |

## 1. Ficha da loja (Presença na loja → Ficha principal)

- **Descrição curta e completa**: `STORE_LISTING_PT_BR.md`.
- **Ícone (512×512)**: `store-assets/play-icone-512.png`.
- **Recurso gráfico (1024×500)**: `store-assets/play-banner-1024x500.png`.
- **Capturas de tela do telefone**: os 5 arquivos de `store-assets/screenshots/` (mínimo 2, máximo 8).
- **Categoria**: Parentalidade. **Tags**: controle parental, família.
- **Contato**: e-mail de suporte da empresa; site (quando houver domínio); **Política de Privacidade**:
  `https://familia-segura-api.onrender.com/api/legal/privacy` (trocar pelo domínio próprio quando existir).

## 2. Conteúdo do app (Política → Conteúdo do app)

### Política de Privacidade
URL acima.

### Acesso ao app
"Todas as funções ou algumas são restritas" → **adicionar instruções**:
- Usuário e senha da **conta de revisão** (criar uma conta de responsável só para isso, com família de
  demonstração e PIN definido; nunca guardar a senha no repositório).
- Em "Outras informações", colar o texto em inglês de `REVIEW_NOTES.md` (inclui como parear o segundo aparelho).

### Anúncios
**Sim, o app contém anúncios** (banner não personalizado, só no app do responsável, só no plano grátis).

### Classificação de conteúdo (questionário IARC)
- Categoria: **Utilitário, produtividade, comunicação ou outro**.
- Violência, sexualidade, linguagem imprópria, drogas, jogos de azar: **Não** em todas.
- Interação entre usuários / troca de conteúdo: **Não** (responsáveis da mesma família só veem regras e relatórios).
- Compartilha localização: **Não**. Compras digitais: **Sim**.
- Resultado esperado: **Livre**.

### Público-alvo e conteúdo
- Faixa etária alvo: **18 anos ou mais** (o app é operado pelo responsável).
- "O app pode atrair crianças sem querer?": **Não** (ícone e ficha falam com adultos).
- Com isso o app **não** entra no programa "Feito para a família". Revisar com o jurídico: o aparelho da criança
  roda o mesmo app em modo restrito, sem anúncios e sem compras.

### Apps de notícias / Governo / Saúde / Recursos financeiros
**Não** em todos.

### ID de publicidade
"O app usa ID de publicidade?" → **Não** (a permissão `AD_ID` é removida do build; os anúncios são não personalizados).

### Segurança dos dados (Data safety)

Respostas gerais:
- Coleta ou compartilha dados do usuário? **Sim**.
- Dados criptografados em trânsito? **Sim**.
- O usuário pode pedir exclusão? **Sim** — no app (Família → Excluir minha conta) e pela página
  `https://familia-segura-api.onrender.com/api/legal/delete-account`.

Tipos de dados (marcar só estes):

| Tipo (categoria da Play) | Coletado | Compartilhado | Obrigatório | Finalidade |
|---|---|---|---|---|
| Informações pessoais → Nome | Sim | Não | Sim | Funcionalidade do app, gerenciamento de conta |
| Informações pessoais → Endereço de e-mail | Sim | Não | Sim | Gerenciamento de conta (login) |
| Informações pessoais → IDs de usuário | Sim | Não | Sim | Funcionalidade, gerenciamento de conta |
| Informações financeiras → Histórico de compras | Sim | Não | Opcional | Funcionalidade (acesso Premium) |
| Atividade no app → Outras ações | Sim | Não | Sim | Funcionalidade (tempo de uso por app, pedidos de tempo) |
| Apps no dispositivo → Apps instalados (só Android) | Sim | Não | Sim | Funcionalidade (aprovar apps novos, regras) |
| Informações e desempenho do app → Registros de falhas | Sim | Não | Sim | Análise (diagnóstico de erros) |
| Informações e desempenho do app → Diagnóstico | Sim | Não | Sim | Análise, funcionalidade (estado da proteção) |
| Dispositivo ou outros IDs | Sim | Sim (Google AdMob, só plano grátis) | Sim | Funcionalidade (pareamento, notificações); Publicidade |

"Compartilhado" na Play significa repassar a terceiro para uso próprio dele: os operadores que só prestam
serviço (Clerk, RevenueCat, Expo/Firebase, Sentry, Render) **não** contam como compartilhamento. O AdMob conta:
seguir também a página "Divulgação de dados do SDK de anúncios para dispositivos móveis" do Google ao declarar.

**Não** coletados: localização, mensagens, fotos, vídeos, áudio, arquivos, calendário, contatos, histórico de
navegação, dados de saúde.

## 3. Declarações de permissões sensíveis

### API AccessibilityService (formulário próprio)
- O app usa a API? **Sim**. É uma ferramenta de acessibilidade? **Não** (`isAccessibilityTool="false"` no build).
- Finalidade (colar):

> Família Segura is a parental control app. On the child's device, set up by a parent, the accessibility
> service identifies which app is in the foreground so the app can enforce the daily time limits, schedules and
> blocks the parent configured, showing a pause screen instead. On Settings and package-installer screens it only
> checks whether the screen would turn off the protection or uninstall an app, and then requires the parent's
> PIN. It does not read messages, passwords or typed text, does not perform gestures on the user's behalf, and
> no accessibility data leaves the device. A prominent in-app disclosure with an explicit consent checkbox is
> shown before the user is sent to the Accessibility settings.

- **Vídeo obrigatório** (link do YouTube "não listado"), 30–60 s, gravado no aparelho da criança:
  1. Área do responsável (PIN) → Configurar a proteção;
  2. a tela de divulgação, com o texto visível, e o toque na caixa de consentimento;
  3. o botão que abre as Configurações de acessibilidade e a ativação de "Proteção Família Segura";
  4. de volta ao app: abrir um app bloqueado e mostrar a tela de pausa;
  5. tentar desativar a proteção em Configurações e mostrar o pedido de PIN.

### Administrador do dispositivo
Uso declarado no build: **`force-lock`** (trava a tela na rotina de dormir, recurso Premium) e, por estar ativo,
o app não pode ser desinstalado sem antes desativar o administrador — o que pede o PIN do responsável. Nenhuma
outra política (apagar dados, senha, câmera) é usada. A ativação é feita pelo adulto, com explicação na tela.

### Acesso ao uso (`PACKAGE_USAGE_STATS`)
Sem formulário próprio. Finalidade, se perguntarem: tempo de uso por app para aplicar limites e gerar relatórios
ao responsável.

### Não usamos
`QUERY_ALL_PACKAGES` (visibilidade só de apps com ícone, via `<queries>`), localização, SMS, registro de
chamadas, sobreposição de tela (`SYSTEM_ALERT_WINDOW`), instalação de pacotes, serviço em primeiro plano.

## 4. Assinaturas (Monetização → Produtos → Assinaturas)

- Assinatura: `familia_segura_premium`; planos básicos `monthly` (mensal, renovação automática) e `annual`
  (anual). Preços e teste grátis: decisão do dono (`docs/COMERCIAL.md` sugere R$ 19,90/mês, R$ 149,90/ano,
  7 dias grátis).
- Conectar a Play à RevenueCat: Project settings → Apps → Família Segura Android → credenciais da conta de
  serviço (JSON) e "Real-time developer notifications".
- Testadores de licença (Configuração → Teste de licença): e-mails de quem vai testar a compra sem cobrança.

## 5. Envio

1. Teste interno → criar versão → enviar o `.aab` (feito pelo EAS: ver `SO_VOCE_FAZ.md`).
2. Adicionar os e-mails dos testadores e compartilhar o link de participação.
3. Com o beta aprovado: Produção → países (Brasil) → lançamento gradual (20% → 100%).
