# Plano de testes em aparelhos reais e beta fechado

Objetivo: provar em aparelho real o que os testes automáticos (47 da API) e o CI (compilação Kotlin/Swift) não
provam. Canais: **TestFlight** (iOS) e **Teste interno/fechado** do Google Play (Android). Meta: 20 famílias por 2 semanas.

## Matriz de plataformas (requisito do dono)

| # | Responsável | Criança | Deve funcionar |
|---|---|---|---|
| 1 | iPhone | Android | regras, limites, rotinas, pedidos, aprovação de apps novos, anti-desinstalação |
| 2 | Android | iPhone | idem (associação de apps no iPhone da criança, com PIN); **confirmar Compartilhamento Familiar com adulto sem iPhone** |
| 3 | iPhone | iPhone | idem |
| 4 | Android | Android | idem |
| 5 | 2 responsáveis (iPhone + Android) | 3 crianças, 5 aparelhos mistos | papéis, push para os dois, relatórios "Todos" |
| 6 | Premium | 10 crianças / 10 aparelhos | 11º aparelho recusado; revogar libera vaga |

## Roteiro por aparelho da criança

### Android
- [ ] Parear; conceder acesso ao uso, serviço de proteção, administrador, bateria.
- [ ] App bloqueado abre a tela de pausa; limite vence **com o app aberto** (até 30 s).
- [ ] Rotina de sono bloqueia tudo, **menos telefone/emergência**.
- [ ] Instalar um app pela loja: loja bloqueada (se "bloquear instalação") — liberar com PIN, instalar, app novo fica **bloqueado até aprovar**; responsável recebe push; aprovar libera.
- [ ] Tentar desinstalar o Família Segura (tela inicial, Configurações > Apps, Play Store): bloqueado; responsável recebe push.
- [ ] Tentar desligar acessibilidade/administrador/acesso ao uso em Configurações: bloqueado.
- [ ] Tentar apagar outro app (se "bloquear remoção"): bloqueado.
- [ ] Área do responsável: PIN errado 5× trava 15 min e avisa; PIN certo libera por 15 min.
- [ ] Modo avião 2 dias: regras continuam; após o prazo offline configurado, suspensas.
- [ ] Reinício do aparelho: proteção volta sozinha; evento aparece para o responsável.
- [ ] Revogar no app do responsável: regras somem do aparelho na próxima sincronização.
- [ ] Fabricantes: Samsung, Motorola, Xiaomi (textos de Configurações diferentes — ajustar `TAMPER_WORDS` se preciso).

### iPhone / iPad
- [ ] Criança no Compartilhamento Familiar; autorizar Tempo de Uso com a conta Apple do adulto.
- [ ] Associar apps às regras pela Área do responsável (PIN).
- [ ] Limite diário, bloqueio e rotina aplicados pelo sistema (tela de pausa da Apple).
- [ ] Não consegue apagar apps nem o Família Segura; não consegue instalar (App Store bloqueada) até liberar com PIN.
- [ ] Filtro de conteúdo adulto ativo no Safari.
- [ ] Mudança de regra chega por push silencioso (ou ao abrir o app).

## Responsável
- [ ] Onboarding com sugestão por idade; PIN; convite ao segundo responsável (Android ↔ iPhone).
- [ ] Pedido de tempo chega por push e é aprovado na Home; tempo extra vale só hoje.
- [ ] Relatórios de 7 dias; 30 dias pede Premium no plano grátis.
- [ ] Modo escuro em todas as telas.
- [ ] Exportar dados e excluir família.

## Critérios para publicar
- Nenhuma falha de proteção (bypass) aberta nas combinações 1–4.
- Crash-free ≥ 99,5% no beta; sincronização em segundo plano funcionando em ≥ 90% dos aparelhos.
- Aprovação das declarações do Google Play e do entitlement da Apple.
