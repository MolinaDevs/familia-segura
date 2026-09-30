# Revisão de backend — Família Segura (30/09/2026)

Escopo: API Express 5 + Drizzle + Postgres (`artifacts/api-server`, `lib/db`), tarefas periódicas, integrações
externas (RevenueCat, Expo Push, Clerk), dados e operação em produção. Complementa `docs/SEGURANCA.md`.

## 1. Resumo

A base é boa: contrato OpenAPI com validação Zod em todas as entradas, escopo por família em todas as consultas,
transações com trava da família nos limites de plano, tarefas idempotentes entre instâncias (`update … returning`),
migrations versionadas e 66 testes de integração com banco real.

Os problemas estavam na **operação sob carga e falhas**: integrações sem prazo nem cache, pool do banco sem
limites, sem desligamento gracioso, consultas frequentes sem índice e corridas em sincronizações simultâneas do
mesmo aparelho. Foram **2 altos, 5 médios e 4 baixos** — todos corrigidos.

## 2. Achados

| ID | Severidade | Achado | Impacto |
|---|---|---|---|
| B1 | **Alta** | Verificação Premium na RevenueCat só guardava em cache quem **é** assinante; sem prazo de resposta. | Cada sincronização de aparelho do plano grátis (1x/min) e cada abertura de tela chamava a RevenueCat: estouro do limite da API, lentidão em todas as rotas e, em pane, requisições presas. |
| B2 | **Alta** | Pool do Postgres sem listener de erro, sem teto de conexões e sem prazo de consulta. | Uma conexão ociosa caindo (reinício do banco, rede) **derrubava o processo**; consulta presa segurava a requisição indefinidamente. |
| B3 | Média | Sem desligamento gracioso nem tratamento de erros globais do processo. | Cada deploy cortava requisições em andamento (ex.: pareamento no meio). |
| B4 | Média | 21 consultas/chaves estrangeiras sem índice (auditoria, rotinas, pedidos, regras por família, tokens de push, eventos…). | Varredura completa das tabelas grandes com o crescimento; exclusão de família lenta (cascatas). |
| B5 | Média | Retenção de 12 meses não apagava pedidos de tempo nem auditoria, embora o app informe "365 dias" (LGPD). | Dado guardado além do informado ao titular. |
| B6 | Média | Sincronizações simultâneas do mesmo aparelho (app + tarefa em segundo plano): uso por hora contado em dobro e conflito de chave no inventário (erro 500). Inventário com até 600 comandos por sincronização. | Relatório errado; carga desnecessária no banco. |
| B7 | Média | Envio de push sem prazo e tokens inválidos nunca removidos. | Expo lenta travava rotas; envios inúteis acumulando. |
| B8 | Baixa | "Visto por último" gravado a cada requisição do aparelho. | Várias escritas por sincronização, sem ganho. |
| B9 | Baixa | Só havia checagem de "vivo"; nenhuma de "pronto" (banco respondendo). | Balanceador mandando tráfego para instância sem banco. |
| B10 | Baixa | Rota inexistente devolvia HTML; sem id de requisição; tarefas periódicas podiam se sobrepor; configuração incompleta só falhava no primeiro uso. | Suporte e operação mais difíceis. |
| B11 | Baixa | Remoção de membro fazia duas exclusões fora de transação. | Estado parcial em falha no meio. |

## 3. Correções

- **B1** — `requirePremium.ts`: cache de 60 s para "sem Premium" (5 min para assinante, como antes), uma só
  chamada por usuário mesmo com pedidos simultâneos, prazo de 5 s e cache com teto de tamanho. Uma compra nova
  vale no servidor em até 60 s.
- **B2** — `lib/db`: `max` (padrão 10, `DB_POOL_MAX`), espera por conexão de 5 s, `statement_timeout` de 15 s
  (`DB_STATEMENT_TIMEOUT_MS`), transação ociosa encerrada em 30 s e listener `error`.
- **B3** — `index.ts`: SIGTERM/SIGINT param de aceitar conexões, terminam as requisições, cancelam as tarefas e
  fecham o pool (saída forçada após 10 s); `unhandledRejection`/`uncaughtException` registrados; prazos do
  servidor HTTP (`requestTimeout` 30 s, keep-alive compatível com balanceadores); em produção, ausência de
  `DATABASE_URL`/`CLERK_*` impede a subida e a de RevenueCat gera aviso.
- **B4** — migration `0008_indices_desempenho` com 20 índices (famílias × data, chaves estrangeiras das cascatas,
  `occurred_at`/`created_at` para a retenção).
- **B5** — retenção apaga também pedidos de tempo, auditoria e apps removidos há mais de 12 meses; Política de
  Privacidade atualizada para dizer exatamente o que expira e o que fica enquanto a família existir.
- **B6** — sincronizações de uso e inventário travam a linha do aparelho (`lockDevice`); inventário em lote
  (inserções, "visto" e remoções em um comando cada; só apps alterados são atualizados um a um).
- **B7** — push com prazo de 8 s; respostas `DeviceNotRegistered` apagam o token (responsáveis e aparelhos).
- **B8** — "visto por último" com resolução de 1 min.
- **B9** — `GET /api/readyz` (consulta o banco; 503 quando indisponível), no contrato OpenAPI.
- **B10** — 404 em JSON; `X-Request-Id` em toda resposta (aceita o do cliente, se válido) e nível de log por
  status (4xx aviso, 5xx erro); tarefas periódicas com `singleFlight` (sem sobreposição) e canceladas no
  desligamento.
- **B11** — remoção de membro e tokens na mesma transação.

## 4. Testes

`test/backend.test.ts` (6 casos novos): prontidão, 404 e id de requisição; "visto por último" limitado;
uso e inventário com sincronizações simultâneas (300 apps, sem duplicar nem falhar); retenção de pedidos e
auditoria; limpeza de token inválido; cache e deduplicação da RevenueCat. Suíte: **72/72**.

## 5. Recomendações de operação

- Health check do balanceador em `/api/readyz`; liveness em `/api/healthz`.
- `DB_POOL_MAX` × número de instâncias abaixo do limite de conexões do Postgres gerenciado (ou usar PgBouncer).
- Rodar `pnpm --filter @workspace/db run migrate` no deploy **antes** de subir a nova versão.
- Alertas: taxa de 5xx, latência p95 acima de 1 s, 503 em `/readyz`, logs "Falha na retenção"/"Erro no envio de push".
- Com mais de uma instância, o limite global por IP (`express-rate-limit`) vale por instância; os limites
  sensíveis (PIN, pareamento, convites, eventos) já são globais no Postgres.
- Próximos passos (fora do lançamento): recibos de push da Expo (erros tardios), fila para envios de push fora do
  caminho da requisição e webhook da RevenueCat para refletir compras instantaneamente.
