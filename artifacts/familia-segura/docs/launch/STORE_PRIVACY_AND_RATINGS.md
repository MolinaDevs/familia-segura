# Privacidade, Data Safety e classificação

Este documento é um roteiro para preenchimento nas lojas. Confirmar as respostas no build candidato e submeter à revisão jurídica.

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
| Mensagens, fotos, contatos, localização precisa | Não | Não | Não tratados |

Não usar os dados para rastreamento entre empresas ou publicidade direcionada.

## Google Play Data Safety

- Dados criptografados em trânsito: sim.
- Exclusão disponível: sim, no aplicativo e em `/api/legal/delete-account`.
- Conta obrigatória para responsável: sim.
- Dados compartilhados com prestadores: Clerk (autenticação), RevenueCat/Google Play (assinatura) e Replit (infraestrutura), somente para prestação do serviço.
- Coleta de atividade em apps: minutos por app e lista de apps instalados, para controle parental, aprovação de apps e relatórios.
- Device Admin: usado apenas para impedir a desinstalação sem o PIN do responsável (declarar na Play Console).
- Retenção: dados de uso por até 12 meses; exclusão completa ao excluir a família.
- AccessibilityService: detecta o pacote em primeiro plano para aplicar bloqueios e, nas telas de Configurações/instalador, verifica apenas se tratam de desligar/desinstalar o Família Segura ou apps (para exigir o PIN). Não lê mensagens, senhas ou o que é digitado, e nada disso sai do aparelho.
- Não declarar o app como ferramenta de acessibilidade. Usar a divulgação proeminente já exibida antes da ativação.

## Classificação etária sugerida

- Apple: 4+, sujeito ao questionário final.
- Google Play/IARC: Livre ou equivalente, sujeito ao questionário final.
- Sem conteúdo gerado por usuários, jogos de azar, violência, conteúdo sexual ou compras de itens aleatórios.
- Contém compras dentro do app e funções de controle parental.