# Instruções para revisão das lojas

## Conta de revisão

Criar uma conta de responsável exclusiva para revisão, com uma família de demonstração e sem dados reais. Registrar usuário e instruções no campo privado da loja, nunca neste repositório.

## Fluxo principal

1. Entrar como responsável.
2. Abrir Perfil e gerar um código de pareamento.
3. Em outro aparelho, escolher modo criança e informar o código.
4. Revisar as permissões nativas explicadas no aplicativo.
5. No aparelho do responsável, abrir Aplicativos e ajustar um limite Premium.
6. Abrir Rotinas e ativar uma pausa.
7. No aparelho infantil, confirmar que as regras estão visíveis.

## Assinatura

- Abrir Configurações > Família Segura Premium.
- Os planos mensal e anual vêm da oferta atual da loja.
- Comprar com conta sandbox.
- Restaurar a compra no segundo aparelho.
- Abrir Gerenciar assinatura para cancelamento.
- Após expiração confirmada, alterações Premium ficam indisponíveis, mas regras existentes não são apagadas.

## Observações Android

O AccessibilityService é necessário para identificar somente qual aplicativo está em primeiro plano e mostrar o bloqueio no momento correto. O serviço não lê conteúdo da tela e não solicita `QUERY_ALL_PACKAGES`, sobreposição, instalação silenciosa ou privilégios de proprietário do dispositivo.

## Observações iOS

O Family Controls exige aprovação do entitlement pela Apple. A equipe de revisão deve receber dois aparelhos/contas sandbox quando o pareamento e a aplicação real das regras forem validados.