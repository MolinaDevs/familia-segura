# Família Segura

Controle parental para iPhone e Android, alinhado à LGPD e ao ECA Digital:
limites por app, rotinas, bloqueio de instalar/apagar apps, proteção contra desinstalação com PIN,
aprovação de apps novos, pedidos de tempo e relatórios — com transparência para a criança.
Famílias com até 10 crianças e 10 aparelhos, em qualquer combinação de plataformas.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `artifacts/familia-segura` | App Expo (responsável + modo criança), módulos nativos Android (Kotlin) e iOS (Swift) |
| `artifacts/api-server` | API Express (rotas, testes) |
| `lib/db` | Schema Drizzle e migrations |
| `lib/api-spec` | Contrato OpenAPI (gera `lib/api-client-react` e `lib/api-zod`) |
| `docs/` | Plano, setup, deploy, proteção Android, testes em aparelho, comercial, jurídico |

## Começar

Veja `docs/SETUP_LOCAL.md`. O app **não roda no Expo Go** (módulos nativos) — use um development build.

## Documentos

- `docs/PLANO_EXECUCAO.md` — fases e o que foi entregue em cada uma
- `docs/ACOES_DO_DONO.md` — o que depende de contas/contratos/aparelhos
- `docs/ANDROID_PROTECAO.md` e `artifacts/familia-segura/docs/ios-family-controls.md` — como a proteção funciona
- `docs/TESTE_BETA.md` — roteiro de testes reais
- `docs/DEPLOY.md`, `docs/COMERCIAL.md`, `docs/legal/RIPD_RASCUNHO.md`
