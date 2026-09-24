# Proteção no Android — como funciona

Fase 2 do plano. Objetivo: a criança não consegue **desinstalar**, **instalar apps sem aprovação** nem
**desligar a proteção** sem o PIN do responsável.

## Camadas

| Camada | Mecanismo | Arquivo |
|---|---|---|
| Bloqueio de apps | Serviço de acessibilidade detecta o app em primeiro plano e mostra a tela de pausa | `FamiliaSeguraAccessibilityService.kt` |
| Limite diário | `UsageStatsManager` + reavaliação a cada 30 s (o limite vence mesmo sem trocar de app) | idem |
| Rotinas | Janela por dia da semana; atravessa a meia-noite; **telefone e emergência nunca bloqueados** | idem |
| Anti-desinstalação | Administrador do dispositivo (Device Admin): o Android exige desativá-lo antes de desinstalar | `FamiliaSeguraDeviceAdminReceiver.kt` |
| Anti-desligamento | Com PIN definido, o serviço fecha as telas de Configurações/instalador/Play Store que mencionam o Família Segura junto com ações perigosas (desinstalar, forçar parada, desativar, limpar dados, acesso ao uso, bateria) | `isTamperScreen()` |
| Apps novos | App instalado depois do pareamento fica bloqueado na hora (lista local) e vira "pendente" no servidor até o responsável aprovar | `packageReceiver` + `POST /child/installed-apps` |
| Lojas | Play Store pode ser bloqueada como qualquer app (está no catálogo) | regra normal |
| Eventos | Fila local (reinício, adulteração, instalação, limite atingido) enviada ao servidor; adulteração gera push ao responsável | `PolicyStore` + `POST /child/events` |
| Offline | Regras valem pelo prazo configurado pela família (`offlineLeaseHours`, 12 h a 30 dias; padrão 72 h). Só renova com resposta autenticada do servidor | `applyAndroidPolicies` |

## Área do responsável no aparelho da criança

Tudo que afrouxa a proteção passa pelo PIN (4–8 dígitos, scrypt):

- **Liberar configurações por 15 min** (para o próprio responsável ajustar o aparelho);
- **Configurar a proteção** (permissões, administrador, bateria);
- **Desvincular o aparelho** (remove o administrador, apaga credenciais, desliga as regras).

Verificação online (servidor limita a 5 tentativas / 15 min e avisa o responsável) com verificador offline
de mesmo algoritmo e o mesmo limite local.

## Sincronização

`services/childSync.ts` roda ao abrir o app, ao voltar ao primeiro plano, a cada minuto com o app aberto,
em segundo plano (~15 min, `expo-background-task`) e ao receber push silencioso `policy_changed`
(mudança feita pelo responsável).

## Limites conhecidos (sem Device Owner)

- **Restaurar o aparelho de fábrica** e **modo de segurança** não podem ser bloqueados por um app comum.
  O responsável recebe o alerta "proteção desligada" e o aparelho aparece como sem contato.
- A detecção de telas de Configurações usa texto da tela; fabricantes com textos muito diferentes podem
  precisar de novas palavras-chave (`TAMPER_WORDS`).
- Um **"Modo Blindado"** com Device Owner (configuração por QR code após restaurar o aparelho) bloquearia
  também restauração de fábrica e instalação pela loja — previsto para depois do lançamento.

## Google Play — declarações obrigatórias

1. **Accessibility API**: declarar uso para controle parental; vídeo mostrando a divulgação proeminente
   (texto em `app/(child)/android-controls.tsx`) antes de abrir as configurações.
2. **Device Admin**: declarar a finalidade (impedir desinstalação sem autorização do responsável).
3. **Package visibility**: usamos `<queries>` com `LAUNCHER` — **não** pedimos `QUERY_ALL_PACKAGES`.
4. **Data safety**: apps instalados e tempo de uso são coletados para a funcionalidade parental.
5. Política "Families" / público-alvo: o app é para responsáveis (adultos); o modo criança é pareado por eles.

## Verificação

- Kotlin compila no CI (`.github/workflows/ci.yml`, job `android-native`).
- Teste manual obrigatório em aparelho real (checklist em `docs/launch/RELEASE_CHECKLIST.md`).
