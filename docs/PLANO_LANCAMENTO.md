# Plano de lançamento — Família Segura

Revisão ponto a ponto do app, novo modelo Grátis × Premium, anúncios no plano grátis, tutorial para o
novo usuário e comparação com os concorrentes. Executado por fases; cada fase fecha com testes, CI verde
e registro no fim deste documento.

## 1. Diagnóstico

### 1.1 Estado atual (antes deste plano)

- Backend completo e testado (56 testes de API), Android e iOS compilando no CI.
- Identidade visual nova aplicada (logo oficial, paleta, Montserrat + Nunito Sans, ícones Phosphor).
- **Diferença entre planos é só de quantidade**: grátis = 1 criança, 1 aparelho, 1 responsável, 7 dias de
  relatório; todo o resto é igual. Para a família típica (1 filho, 1 celular) quase não há motivo para
  assinar.
- **Não existem**: "pausar agora", resumo semanal, tutorial pós-cadastro (só uma lista "Primeiros passos"
  simples), anúncios.

### 1.2 Auditoria ponto a ponto

| Área | Situação | Ação |
|---|---|---|
| Conta (entrar, criar, recuperar) | Padrão novo, validação na linha | ok |
| Cadastro da família | Padrão novo, idade validada | ok |
| Painel | Rotina atual/próxima, alertas honestos de contato | Receber "Pausar agora" e o guia de primeiros passos |
| Apps / regras | Funcional | Aplicar limite do plano grátis (5 apps com regra) |
| Rotinas | Funcional, trava de tela no Android | Grátis: até 2 rotinas; trava de tela vira Premium |
| Relatórios | 7 dias grátis / 12 meses Premium | Somar resumo semanal (Premium) |
| Família / aparelhos / responsáveis | Funcional | ok |
| Configurações | Funcional | Mostrar o plano atual e o que o Premium libera |
| Assinatura | Só lista de benefícios | Comparativo Grátis × Premium claro |
| Aparelho da criança | Reformulado | Mostrar pausa ativa |
| Android nativo | Bloqueio, rotina, trava, anti-desinstalação, DNS | Respeitar pausa |
| iOS nativo | Family Controls, rotinas, bloqueios | Respeitar pausa |
| Acessibilidade | Chips com 36 px e seletor de criança com 40 px de altura (mínimo recomendado 44) | Corrigir |
| LGPD / ECA Digital | Consentimento, exportação, exclusão, sem localização | Anúncios só para adultos, sem perfilamento |
| Lojas | Exclusão de conta, manifestos de privacidade, sem QUERY_ALL_PACKAGES | Declarar anúncios no Data Safety / App Privacy |

## 2. Concorrentes (pesquisa set/2026)

| App | Preço | O que cobra | O que copiamos |
|---|---|---|---|
| Google Family Link | Grátis | — | Referência de grátis: bônus de tempo, "school time" com apps liberados, limite por dia da semana |
| Qustodio | Grátis (1 aparelho) · US$ 54,95–99,95/ano | Limites por app, rotinas, relatórios longos | Grátis com 7 dias de relatório; "pausar a internet" |
| OurPact | US$ 6,99–9,99/mês | Mesada de tempo, recompensas | "Bloquear agora" (grant/block) em destaque |
| Norton Family | US$ 49,99/ano | Regras da casa, horário de escola | Resumo de atividade |
| Kaspersky Safe Kids | ~US$ 28/ano | Preço baixo | Preço acessível no Brasil |
| Bark | Assinatura | Monitoramento de conteúdo com IA | **Não copiar**: lê mensagens; contraria nosso "transparência, não espionagem" |

**Posicionamento:** o grátis precisa competir com o Family Link (que é grátis e só funciona bem com
Android), e o pago precisa entregar conforto para famílias com mais de um filho ou que querem controle
fino. Nosso diferencial é iPhone + Android na mesma família, transparência para a criança e conformidade
com o ECA Digital.

Fontes: [Qustodio free vs premium](https://www.qustodio.com/en/difference-between-qustodio-free-and-qustodio-premium/),
[OurPact pricing](https://www.ourpact.com/pricing), [Family Link screen time](https://support.google.com/families/answer/7103340?hl=en),
[Security.org 2026](https://www.security.org/parental-controls/best/), [Impulsec 2026](https://impulsec.com/parental-control-software/best-parental-control-app/).

## 3. Novo modelo Grátis × Premium

| Recurso | Grátis | Premium |
|---|---|---|
| Crianças / aparelhos / responsáveis | 1 / 1 / 1 | 10 / 10 / 4 |
| Bloquear apps, aprovar instalações, anti-desinstalação | ✓ | ✓ |
| Filtro de conteúdo adulto | ✓ | ✓ |
| **Pausar agora** (novo) | ✓ | ✓ |
| Pedidos de tempo e tempo extra | ✓ | ✓ |
| Apps com limite diário | até 5 | ilimitados |
| Rotinas | até 2 | ilimitadas |
| Trava de tela na hora de dormir (Android) | — | ✓ |
| Relatórios | 7 dias | 12 meses |
| **Resumo semanal** por notificação (novo) | — | ✓ |
| Anúncios | discretos, só no app do responsável | sem anúncios |

Proteção e segurança continuam grátis: bloquear, pausar, filtro adulto e anti-desinstalação são o mínimo
ético de um controle parental. O Premium vende **conforto e escala**, não a segurança básica.

**Rebaixamento:** quem deixa o Premium mantém as regras e rotinas que já tem (nada é apagado nem para de
funcionar sem aviso), mas não cria novas acima do limite. A trava de tela para de valer, e o app explica
por quê.

## 4. Anúncios no plano grátis (sem espantar o usuário)

Regras, por lei e por experiência:

1. **Só no app do responsável** (adulto). O aparelho da criança nunca inicializa o SDK de anúncios (ECA
   Digital, art. 22 e 26; Google Play Families).
2. **Sem personalização** (`requestNonPersonalizedAdsOnly`) e classificação de conteúdo **G**.
3. **Nada de tela cheia** (sem intersticial, sem vídeo com prêmio, sem abrir sozinho). Só **um banner
   discreto no fim** de Relatórios e da lista de Apps — nunca no painel, nos alertas, no cadastro, na
   conta, na assinatura nem em qualquer fluxo de segurança.
4. **Carência de 3 dias** após criar a conta: o novo usuário configura tudo sem anúncio.
5. Se o anúncio não carregar (ou não houver ID configurado), aparece um cartão da casa convidando para o
   Premium ("Sem anúncios e com rotinas ilimitadas"), com botão para fechar.
6. IDs de teste do Google até o dono cadastrar os reais (`app.json` e `lib/ads.ts`).

## 5. Primeiros passos guiados

- **Boas-vindas em 3 telas** logo após criar a família (como funciona, conectar o aparelho, combinados),
  com "Pular".
- **Guia "Primeiros passos"** no painel, com progresso: criança criada → PIN definido → aparelho
  conectado → apps e limites revisados → rotinas revisadas → (opcional) outro responsável. Cada passo abre
  a tela certa e some quando tudo estiver pronto.
- **Dicas de contexto**: um cartão curto na primeira visita a Apps, Rotina e Relatórios, que pode ser
  dispensado e não volta.

## 6. Fases de execução

| Fase | Entrega | Pronto quando |
|---|---|---|
| 1 | Planos: limites no servidor (apps, rotinas, trava), tela Premium comparativa, avisos de limite no app | Testes de API cobrindo grátis/Premium/rebaixamento; CI verde |
| 2 | Pausar agora: servidor, painel, aparelho da criança, Android e iOS, expiração automática | Testes de API; Android e iOS compilando |
| 3 | Resumo semanal (Premium) por notificação | Teste do cálculo; tarefa agendada |
| 4 | Anúncios: SDK, banner, carência, cartão da casa, bloqueio no modo criança | Compila nas duas plataformas; nenhuma chamada de anúncio no modo criança |
| 5 | Primeiros passos: boas-vindas, guia com progresso, dicas de contexto | Conferido no navegador |
| 6 | Acessibilidade, textos de loja, documentação, ações do dono, revisão final | CI verde e checklist de lançamento completo |

## 7. Pós-lançamento (fora deste plano)

Do benchmark, para versões futuras: apps sempre liberados durante rotinas (ex.: Classroom na escola),
limite diário diferente por dia da semana, limite total de tela, recompensas por tarefas, filtro de sites
por categoria. Localização fica de fora de propósito (privacidade e posicionamento).

## 8. Registro de execução

(preenchido a cada fase)

### Fase 1 — Planos Grátis × Premium ✓

- Servidor (`lib/limits.ts`, `routes/rules.ts`): grátis com até 5 apps com limite de tempo (bloquear não
  conta), até 2 rotinas por criança e sem trava de tela; `limits` agora traz `maxTimedApps`, `maxRoutines`,
  `reportDays` e `features` (lockScreen, weeklySummary, adFree).
- Rebaixamento: nada é apagado; a trava guardada deixa de valer no aparelho e volta com o Premium; editar
  uma rotina que já tinha trava não dá erro.
- App: contador "4 de 5 apps com limite no plano grátis" (Apps) e de rotinas (Rotina), selo PREMIUM na trava,
  modelos que não ligam a trava no grátis, comparativo Grátis × Premium na assinatura (também sem preços).
- Testes: 58 (novos: limite de apps, limite de rotinas, trava Premium e rebaixamento).

### Fase 2 — Pausar agora ✓

- Servidor: `children.paused_until` (migração 0006), `POST/DELETE /family/children/{id}/pause` (15/30/60 min
  ou "até liberar" = 30 dias), só responsáveis que editam; a política do aparelho traz `pausedUntil`; tarefa
  de 1 em 1 minuto encerra pausas vencidas e avisa os aparelhos.
- Android: bloqueia todos os apps (exceto telefone, emergência e relógio) até o horário, mesmo sem internet.
- iPhone: modo "bloquear tudo" + agenda de fim da pausa (a Apple exige 15 min ou mais; pausas menores e "até
  liberar" terminam pelo aviso do servidor).
- App: cartão "Pausar os apps de {nome}" no painel, com "Liberar agora"; a tela da criança mostra a pausa.
- Correção achada no teste: ordem das crianças instável quando criadas no mesmo instante (desempate por nome).
- Testes: 61 (novos: pausa grátis, chega ao aparelho, até liberar, observador, outra família, expiração).
