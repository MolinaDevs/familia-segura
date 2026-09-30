# Revisão de frontend — Família Segura (30/09/2026)

Escopo: app Expo/React Native (`artifacts/familia-segura`) — login e cadastro (Clerk), sessão, integração com a
API (cliente gerado do OpenAPI + React Query), cache local, formulários e validações, modo criança.
Complementa `docs/SEGURANCA.md` e `docs/BACKEND.md`.

## 1. Resumo

A base é sólida: cliente da API gerado do contrato (tipos iguais aos do servidor), um `QueryClient` por
identidade (trocar de conta não mistura dados), modo criança independente do login, credenciais do aparelho no
armazenamento seguro, formulários com estados de carregando/erro e textos claros.

Foram encontrados **2 problemas altos, 5 médios e 3 baixos** — todos corrigidos.

## 2. Achados

| ID | Severidade | Achado | Impacto |
|---|---|---|---|
| F1 | **Alta** | Login parava em "verificação extra ainda não disponível" quando o Clerk pede código: **primeira entrada em aparelho novo** (proteção "client trust") ou conta com duas etapas. | Responsável sem conseguir entrar ao trocar de celular. |
| F2 | **Alta** | "Sair da conta" não desregistrava o token de push nem apagava o cache da família. | O celular continuava recebendo avisos com nomes das crianças, pedidos e alertas; dados da família ficavam no aparelho (LGPD, celular compartilhado). |
| F3 | Média | Mensagens do Clerk exibidas em inglês (erros gerais e por campo); login diferenciava "e-mail não cadastrado" de "senha errada". | Experiência ruim; enumeração de contas. |
| F4 | Média | React Query no padrão: 3 retentativas até em 401/403/404, sem atualizar ao voltar para o app. | Tela de cadastro inicial demorava ~7 s para aparecer; dados velhos ao reabrir. |
| F5 | Média | Removido da família (ou família excluída): o app continuava mostrando o cache da família; qualquer 4xx aparecia como "Sem conexão". | Dados de uma família da qual a pessoa não faz mais parte; mensagem enganosa. |
| F6 | Média | Cadastro inicial aceitava nomes com 1 letra e sem limite de tamanho (a API exige 2–80), e qualquer recusa virava "confira a internet". | Erro sem explicação para a pessoa. |
| F7 | Média | Cadastro/recuperação: senha < 8 só era recusada pelo Clerk depois do envio; reenvio de código sem intervalo; falhas de envio do código ignoradas. | Frustração e códigos em excesso. |
| F8 | Baixa | Celular da criança pareado com o responsável logado mantinha a sessão do responsável; falha de rede no pareamento dizia "código não funcionou". | Conta do responsável no aparelho da criança. |
| F9 | Baixa | Toque duplo em bloquear app/rotina mandava duas alterações opostas. | Regra voltava ao estado anterior. |
| F10 | Baixa | Cache da família de versão antiga do app (sem `limits.features`) derrubava a aba Apps (anúncio). | Tela quebrada logo após atualizar o app. |

## 3. Correções

- **F1** — `sign-in.tsx`: após a senha, `needs_second_factor`/`needs_client_trust` abrem a etapa "Confirme que é
  você" com código por e-mail (preferido), SMS ou app autenticador; reenviar código.
- **F2** — nova rota `DELETE /api/family/push-tokens` (só apaga token do próprio usuário) e `lib/session.ts`
  (`signOutCompletely`): desregistra o push, apaga o cache da família e encerra a sessão — usado em "Sair da conta"
  e "Sair da família".
- **F3** — `lib/clerkErrors.ts`: códigos do Clerk → português; login responde "E-mail ou senha não conferem" nos
  dois casos; aplicado a login, cadastro, recuperação e erros por campo.
- **F4** — `lib/queryClient.ts`: sem retentativa em 4xx, até 2 em rede/5xx com espera crescente, escrita sem
  retentativa, atualização ao voltar para o app (`AppState`) e ao reconectar.
- **F5** — `AppContext`: 404 depois de já ter família = vínculo perdido → apaga cache e volta à entrada;
  "Sem conexão" só em falha de rede/5xx.
- **F6** — `onboarding.tsx`: limites iguais ao contrato (2–80 / 1–50), erro no campo, e mensagens distintas para
  sem conexão, limite de tentativas e dado recusado.
- **F7** — cadastro exige 8+ caracteres antes de enviar, reenvio com espera de 30 s, erro no envio do código
  tratado; recuperação valida 8+ caracteres.
- **F8** — ao abrir em modo criança, sessão do responsável encerrada e push desregistrado (sem reiniciar a
  navegação); pareamento distingue "sem conexão".
- **F9** — alternar app/rotina ignora novo toque enquanto a alteração anterior está em andamento.
- **F10** — cache com versão no nome (formato antigo é ignorado) e anúncio defensivo.
- Extra: `X-Request-Id` exposto via CORS para a versão web.

## 4. Verificação

Tipos (app, API, scripts) OK; API **73/73** (novo teste da remoção de token); app web conferido no navegador
(início e Apps carregando com a API, sem erros novos).

Não automatizável aqui (exige Clerk real): etapa de código no login, cadastro e recuperação — conferir num build
de teste com uma conta nova em aparelho novo.
