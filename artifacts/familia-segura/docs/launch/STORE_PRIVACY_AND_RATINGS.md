# Privacidade, Data Safety e classificação

Este documento é o resumo; as respostas campo a campo estão em `GOOGLE_PLAY_PASSO_A_PASSO.md` e
`APP_STORE_PASSO_A_PASSO.md`. Confirmar as respostas no build candidato e submeter à revisão jurídica.

## Apple App Privacy

| Categoria | Coletado | Vinculado à identidade | Finalidade |
| --- | --- | --- | --- |
| Nome de exibição | Sim | Sim | Funcionalidade e conta |
| Identificadores de usuário/família | Sim | Sim | Autenticação e funcionalidade |
| Identificadores de dispositivo próprios | Sim | Sim | Pareamento e segurança |
| Compras/assinatura | Sim, via loja/RevenueCat | Sim | Acesso Premium |
| Uso de apps (minutos por app, por dia e hora) | Sim | Sim | Funcionalidade parental e relatórios |
| Apps instalados (somente Android) | Sim | Sim | Aprovação de apps novos pelo responsável |
| Eventos do aparelho (reinício, tentativa de desligar a proteção) | Sim | Sim | Segurança da proteção |
| Diagnóstico de proteção | Sim | Sim | Segurança e suporte |
| Registros de falhas e desempenho (Sentry) | Sim | Não | Correção de erros |
| E-mail do responsável | Sim | Sim | Login (Clerk) |
| Mensagens, fotos, contatos, localização precisa | Não | Não | Não tratados |

Não usar os dados para rastreamento entre empresas ou publicidade direcionada.

**Anúncios (plano grátis, só no app do responsável):** o Google Mobile Ads SDK traz o próprio manifesto de
privacidade. Declarar, conforme a orientação atual do Google para o AdMob, os dados que o SDK coleta para
**publicidade de terceiros** (ex.: interação com o produto/anúncio, dados de diagnóstico e identificadores do
app), marcados como **não usados para rastreamento**. O app não pede ATT e só solicita anúncios não
personalizados. O aparelho da criança nunca inicializa o SDK.

## Google Play Data Safety

- Dados criptografados em trânsito: sim.
- Exclusão disponível: sim, no aplicativo e em `/api/legal/delete-account`.
- Conta obrigatória para responsável: sim.
- Operadores (prestadores de serviço, não contam como "compartilhamento" na Play): Clerk (autenticação), RevenueCat/Google Play (assinatura), Expo e Google Firebase Cloud Messaging (notificações), Sentry (registros de falhas e diagnóstico, sem dados pessoais nem conteúdo de tela) e Render (hospedagem, EUA).
- **Contém anúncios: sim** (plano grátis, só no app do responsável, não personalizados). Declarar o Google
  AdMob como destinatário dos dados que o SDK coleta para publicidade, conforme a página de divulgação de
  dados do AdMob para o Play. A permissão `AD_ID` é bloqueada no build.
- Público-alvo na Play Console: **adultos (18+)** — o app é operado pelo responsável; o modo criança não mostra
  anúncios. Revisar com o jurídico antes de enviar (política Families e ECA Digital, art. 22 e 26).
- Coleta de atividade em apps: minutos por app e lista de apps instalados, para controle parental, aprovação de apps e relatórios.
- Device Admin: política `force-lock` (travar a tela na rotina de dormir) e bloqueio da desinstalação sem o PIN do responsável (declarar na Play Console).
- Retenção: dados de uso por até 12 meses; exclusão completa ao excluir a família.
- AccessibilityService: detecta o pacote em primeiro plano para aplicar bloqueios e, nas telas de Configurações/instalador, verifica apenas se tratam de desligar/desinstalar o Família Segura ou apps (para exigir o PIN). Não lê mensagens, senhas ou o que é digitado, e nada disso sai do aparelho.
- Não declarar o app como ferramenta de acessibilidade. Usar a divulgação proeminente já exibida antes da ativação.

## Classificação etária sugerida

- Apple: 4+, sujeito ao questionário final.
- Google Play/IARC: Livre ou equivalente, sujeito ao questionário final.
- Sem conteúdo gerado por usuários, jogos de azar, violência, conteúdo sexual ou compras de itens aleatórios.
- Contém compras dentro do app e funções de controle parental.