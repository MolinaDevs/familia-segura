# Proteção no iPhone e iPad

O app usa apenas APIs públicas da Apple: `FamilyControls`, `ManagedSettings`, `ManagedSettingsUI` e
`DeviceActivity`. Os tokens escolhidos no seletor da Apple ficam no App Group e **não** vão para o servidor.

## O que é aplicado

| Proteção | Como | Onde |
|---|---|---|
| Bloqueio por app / categoria | `blockSelection` no store padrão | `services/iosParentalControls.ts` (biblioteca react-native-device-activity) |
| Limite diário | `DeviceActivity` com eventos de limite (até 12 regras monitoradas + rotinas, teto de 20 atividades da Apple) | idem |
| Rotinas | "block all" em janelas semanais mescladas, isoladas dos bloqueios por app | idem |
| Hora de dormir | A Apple não deixa apps travarem nem desligarem a tela: a opção "Travar a tela" vale só no Android; no iPhone a rotina pausa todos os apps | — |
| **Não apagar apps** (inclusive o Família Segura) | `application.denyAppRemoval` num store próprio `familiaSeguraProtecao` | `modules/familia-segura-ios-controls` |
| **Não instalar apps** | `application.denyAppInstallation` no mesmo store; liberável por 15 min com o PIN | idem + `services/iosDeviceProtection.ts` |
| **Liberar instalação à distância** | O responsável libera 15/30/60 min pelo app dele (Família → aparelho). A Apple não deixa ver/aprovar app por app, então a aprovação é uma janela de tempo | `installUnlockUntil` na política + `services/iosDeviceProtection.ts` |
| Filtro de conteúdo adulto | `webContent.blockedByFilter = .auto()` | biblioteca (`setWebContentFilterPolicy`) |

As chaves vêm da família (`blockAppInstalls`, `blockAppRemoval`, `webFilter`) — padrão: tudo ligado.

Com a autorização do tipo **child** (Compartilhamento Familiar), a criança também não consegue revogar a
autorização nem apagar o Família Segura sem a senha de um adulto da família na Apple.

## Seletor de apps protegido

A Apple só mostra os apps instalados dentro do próprio aparelho, e o token escolhido não sai dele. Por isso:

1. O responsável cria a regra no app dele (qualquer plataforma), por exemplo "YouTube, 60 min".
2. No iPhone da criança, a regra fica **pendente** até alguém abrir *Área do responsável → Configurar a
   proteção* (exige o PIN) e associar o app no seletor.
3. O aparelho informa ao servidor quais regras já estão associadas (`boundRuleIds`).

## Dados de uso

A Apple não permite enviar ao servidor os minutos exatos por app. Enviamos **faixas** a partir dos eventos de
limite (ex.: passou de 15, 30, 45 min) — marcadas como `estimated` nos relatórios. O detalhe exato só pode ser
exibido no próprio aparelho (extensão DeviceActivityReport — fora do escopo desta versão).

## Alvos nativos

O plugin `react-native-device-activity` **gera** `targets/` (ActivityMonitorExtension, ShieldAction,
ShieldConfiguration + `Shared.swift`) a cada `expo prebuild`; a pasta não é versionada.
O módulo `modules/familia-segura-ios-controls` é autolinkado pelo Expo.

## Pendência da conta Apple (dono)

1. Conta Apple Developer e Team ID em `expo.ios.appleTeamId` (`app.json`).
2. Registrar `com.familiasegura.app` e os bundle identifiers das 3 extensões.
3. Pedir à Apple o entitlement **Family Controls (Distribution)** para o app e cada extensão.
4. Ativar o App Group `group.com.familiasegura.app` em todos os identifiers.
5. Build nativa (Family Controls não funciona no Expo Go).

## Verificação

- CI: job `ios-native` compila o app para simulador sem assinatura.
- Teste real obrigatório num iPhone de criança dentro do Compartilhamento Familiar.
