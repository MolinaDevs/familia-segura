# Family Controls no iPhone e iPad

O app usa apenas as APIs públicas `FamilyControls`, `ManagedSettings`,
`ManagedSettingsUI` e `DeviceActivity`. Os tokens escolhidos no seletor da
Apple ficam no App Group e não são enviados para o servidor.

## Alvos nativos gerados

O plugin `react-native-device-activity` gera estes alvos durante a build:

- `ActivityMonitorExtension`
- `ShieldAction`
- `ShieldConfiguration`

Todos usam o entitlement `com.apple.developer.family-controls` e o App Group
`group.com.familiasegura.app`.

## Pendência da conta Apple

Antes de uma build de distribuição:

1. Criar a conta Apple Developer e obter o Team ID.
2. Adicionar o Team ID em `expo.ios.appleTeamId` no `app.json`.
3. Registrar `com.familiasegura.app` e os três bundle identifiers das extensões.
4. Solicitar à Apple o entitlement Family Controls de distribuição para o app
   e para cada extensão.
5. Ativar o App Group `group.com.familiasegura.app` em todos os identifiers.
6. Criar uma build nativa. Family Controls não funciona no Expo Go.

O aplicativo mostra “Build nativa necessária”, “Autorização pendente”,
“Permissão desativada” ou “Proteção autorizada” sem desativar silenciosamente
as regras.

Os resumos de uso são estimativas conservadoras baseadas nos eventos de limite
permitidos pelo Device Activity. O app não promete histórico detalhado nem
acesso aos nomes de outros aplicativos instalados.