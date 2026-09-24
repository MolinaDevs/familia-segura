# Plano de execução — Família Segura

Requisitos do dono (2026-09-24):
- Controle parental rígido, alinhado ao ECA Digital (Lei 15.211/2025) e à LGPD (art. 14).
- Publicação na App Store e na Google Play.
- Controle de horas de uso, permissão por app, bloqueio de instalação/desinstalação sem autorização.
- Plataformas cruzadas: responsável e criança podem estar em iOS ou Android, em qualquer combinação.
- Família com até **10 crianças** e até **10 aparelhos** (responsáveis fora desse limite; até 4 no Premium).
- Gráficos de uso para o responsável.

| Fase | Entregas | Critério de pronto |
|---|---|---|
| 0. Destravar | dev-client + perfis EAS, migrations versionadas, Postgres local, testes da API, CI, Premium sem Replit, CORS | typecheck + testes verdes; APK de desenvolvimento gerável pelo EAS |
| 1. Fundação | bugs críticos, histórico de uso, liberações temporárias, CRUD de apps/rotinas, várias crianças, convites e papéis, limites 10/10, catálogo de apps, push, PIN do responsável | fluxo responsável ↔ criança coberto por testes |
| 2. Android rígido | Device Admin, bloqueio de Configurações com PIN, quarentena de apps novos, Play Store bloqueada, checagem por minuto, alerta de adulteração, inventário de apps | criança não desinstala/instala/desliga sem PIN |
| 3. iOS rígido | denyAppRemoval/denyAppInstallation, filtro web, seletor com PIN, faixas de uso mais finas, Swift compartilhado | mesmo teste num iPhone com Compartilhamento Familiar |
| 4. Produto/design/jurídico | onboarding, modos por idade, seletor de criança, tela de aparelhos, gráficos, relatório semanal, modo escuro, planos, textos legais | revisão jurídica + teste com famílias |
| 5. Lançamento | TestFlight, teste interno Play, declaração de acessibilidade, notas de revisão, beta | aprovado nas lojas |

Ações que dependem do dono estão em `docs/ACOES_DO_DONO.md`.

## Registro de execução

### Fase 0 ✅
Ambiente fora do Expo Go e do Replit; migrations; testes; CI.

### Fase 1 ✅ — fundação
- **Modelo**: papéis (titular/co-responsável/observador) e convites; crianças com cor, faixa etária e arquivamento;
  aparelhos com SO, modelo, versão, bateria, fuso e push; catálogo de 34 apps populares no BR (pacotes Android);
  inventário Android com quarentena; vínculos de regra no iPhone; histórico `usage_daily` + `usage_hourly`;
  liberações de tempo por dia (`temporary_grants`); eventos de aparelho; tokens de push; rate limit no Postgres.
- **Limites**: grátis = 1 criança / 1 aparelho / 1 responsável / 7 dias de relatório;
  Premium = **10 crianças / 10 aparelhos** / 4 responsáveis / 365 dias. Checagem com trava da linha da família
  (testado com criações e pareamentos simultâneos). Premium vem da assinatura do titular.
- **Bugs corrigidos**: tempo extra e aprovação de pedido aumentavam o limite para sempre (agora vale só hoje);
  uso do dia nunca zerava e não tinha histórico; tela de detalhe quebrava sem apps; pedido de tempo por texto livre;
  textos em inglês na tela da criança; aprovação de pedido e edição de limites bloqueadas no plano grátis.
- **Segurança**: código de pareamento com 8 caracteres (≈8,5·10¹¹) + rate limit persistente; PIN do responsável
  (scrypt) com verificação online limitada a 5/15 min e verificador offline; push imediato em adulteração.
- **Relatórios** (`GET /family/reports/usage`): uso diário com linha de limite, ranking de apps, mapa de calor
  dia×hora, por aparelho, por criança, cumprimento de regras e saúde da proteção. Dado do iPhone marcado como estimado.
- **Testes**: 34 casos (API) cobrindo limites, concorrência, papéis, plataformas cruzadas, tempo extra, relatórios,
  quarentena, PIN e push.

### Fase 2 ✅ — Android rígido
- Device Admin (anti-desinstalação), bloqueio de telas de Configurações/instalador/Play Store que desligariam a
  proteção (liberável por 15 min com PIN), quarentena imediata de apps instalados, reavaliação do limite a cada
  30 s, telefone/emergência sempre liberados, fila de eventos nativa (reinício, adulteração, instalação, limite).
- Área do responsável no aparelho da criança (PIN online + offline scrypt idêntico ao servidor): liberar
  configurações, configurar proteção, sincronizar, desvincular.
- Sincronização central (`services/childSync.ts`): primeiro plano, a cada minuto, em segundo plano (~15 min) e por
  push silencioso; inventário de apps, uso de todos os apps (relatórios), eventos, estado da proteção.
- Prazo offline configurável pela família (12 h a 30 dias).
- CI compila o Kotlin (job `android-native`); detalhes e declarações do Google Play em `docs/ANDROID_PROTECAO.md`.
- **Não verificado localmente**: compilação Kotlin e comportamento em aparelho (sem JDK/SDK nesta máquina).

### Fase 3 ✅ — iOS rígido
- Módulo Swift próprio (`modules/familia-segura-ios-controls`): `denyAppRemoval` e `denyAppInstallation` num
  ManagedSettingsStore separado; filtro de conteúdo adulto da Apple via biblioteca.
- Configurações da família `blockAppInstalls`, `blockAppRemoval`, `webFilter` (padrão: tudo ligado), valendo para
  iOS e Android (Android: loja/instalador de APK e telas de desinstalação de qualquer app bloqueados).
- Liberação temporária (15 min) pelo PIN; seletor de apps do iPhone só pela Área do responsável.
- `targets/` (cópias geradas pelo plugin a cada prebuild) saiu do git — fim do `Shared.swift` triplicado.
- CI compila o iOS para simulador (job `ios-native`). **Não verificado localmente** (sem macOS/Xcode).

### Fase 4 ✅ — produto, design e jurídico
- Navegação: Home · Apps · Rotina · **Relatórios** · **Família**; seletor de criança (até 10) em todas as telas.
- Telas novas: nova/editar criança (com sugestões por faixa etária — ECA Digital), parear aparelho (instruções
  iPhone/Android, código com contagem regressiva), adicionar app (catálogo + apps instalados), editor de rotinas,
  detalhe do aparelho (saúde, bateria, renomear, trocar criança, revogar, apps instalados com aprovar/bloquear),
  responsáveis (convites e papéis), configurações reais (PIN, instalar/apagar apps, aprovação de apps novos,
  filtro web, prazo offline, notificações). Onboarding com consentimento LGPD art. 14 e "Tenho um convite".
- Home com primeiros passos, alertas de proteção/adulteração, pedidos de tempo e apps novos para decidir ali.
- Gráficos (react-native-svg): uso diário com linha de limite, ranking de apps, mapa de calor dia×hora,
  comparação entre crianças e aparelhos, cumprimento de combinados, saúde da proteção. Paleta das crianças
  validada para daltonismo; toque mostra o valor; descrições acessíveis.
- Modo escuro de verdade (paleta própria) e fim das cores fixas; identidade unificada (verde, sem o coral antigo).
- Jurídico: política de privacidade reescrita (LGPD/ECA Digital, dados reais, retenção, direitos), página
  "Para a criança", termos/suporte/exclusão atualizados; retenção automática de 12 meses implementada;
  rascunho de RIPD em `docs/legal/`. Comercial em `docs/COMERCIAL.md`; textos de loja e Data Safety atualizados.
- 46 testes de API; bundles Android/iOS gerados. **Telas não verificadas visualmente em aparelho** (exigem Clerk + build nativa).
