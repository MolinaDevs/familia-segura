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
