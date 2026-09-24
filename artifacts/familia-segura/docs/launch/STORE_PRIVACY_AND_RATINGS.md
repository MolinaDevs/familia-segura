# Privacidade, Data Safety e classificação

Este documento é um roteiro para preenchimento nas lojas. Confirmar as respostas no build candidato e submeter à revisão jurídica.

## Apple App Privacy

| Categoria | Coletado | Vinculado à identidade | Finalidade |
| --- | --- | --- | --- |
| Nome de exibição | Sim | Sim | Funcionalidade e conta |
| Identificadores de usuário/família | Sim | Sim | Autenticação e funcionalidade |
| Identificadores de dispositivo próprios | Sim | Sim | Pareamento e segurança |
| Compras/assinatura | Sim, via loja/RevenueCat | Sim | Acesso Premium |
| Uso de apps configurados (totais) | Sim | Sim | Funcionalidade parental |
| Diagnóstico de proteção | Sim | Sim | Segurança e suporte |
| Mensagens, fotos, contatos, localização precisa | Não | Não | Não tratados |

Não usar os dados para rastreamento entre empresas ou publicidade direcionada.

## Google Play Data Safety

- Dados criptografados em trânsito: sim.
- Exclusão disponível: sim, no aplicativo e em `/api/legal/delete-account`.
- Conta obrigatória para responsável: sim.
- Dados compartilhados com prestadores: Clerk (autenticação), RevenueCat/Google Play (assinatura) e Replit (infraestrutura), somente para prestação do serviço.
- Coleta de atividade em apps: apenas totais dos apps configurados, para controle parental e funcionalidade do aplicativo.
- AccessibilityService: detecta o pacote em primeiro plano para aplicar bloqueios; não lê conteúdo da tela, texto, mensagens ou senhas.
- Não declarar o app como ferramenta de acessibilidade. Usar a divulgação proeminente já exibida antes da ativação.

## Classificação etária sugerida

- Apple: 4+, sujeito ao questionário final.
- Google Play/IARC: Livre ou equivalente, sujeito ao questionário final.
- Sem conteúdo gerado por usuários, jogos de azar, violência, conteúdo sexual ou compras de itens aleatórios.
- Contém compras dentro do app e funções de controle parental.