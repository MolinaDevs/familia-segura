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
