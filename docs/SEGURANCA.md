# Revisão de segurança — Família Segura (30/09/2026)

Escopo: API (Express + Postgres), app (Expo/React Native, modo responsável e modo criança), módulos nativos
Android (Kotlin) e iOS (Swift), CI/CD e repositório público. Testes só no ambiente local.

Modelo de ameaça principal: **a criança é o adversário mais provável** — tem o aparelho na mão, tempo e
motivação para desligar a proteção. Depois: terceiros atacando a API pela internet, abuso de um aparelho
adulterado contra a família, vazamento de dados de crianças (LGPD/ECA Digital) e cadeia de suprimentos.

## 1. Resumo executivo

A base é sólida: tokens de aparelho de 256 bits guardados só como hash e revogáveis; papéis checados no
servidor em todas as rotas de família (sem IDOR na auditoria anterior e nas rotas novas); PIN com scrypt, sal
próprio e comparação em tempo constante; códigos de pareamento e convite com aleatoriedade criptográfica,
validade curta, uso único e limite de tentativas; validação de entrada com limites em tudo que o aparelho
envia; erros sem vazar detalhes; modo demonstração com dupla trava; nenhum segredo real no histórico do git.

Foram encontradas **2 falhas altas, 4 médias e 4 baixas**, todas corrigidas nesta revisão, e 3 riscos
aceitos (ferramentas de build) documentados.

## 2. Achados

| ID | Severidade | Achado | Status |
|---|---|---|---|
| S1 | **Alta** | Verificador do PIN guardado em armazenamento comum (AsyncStorage) junto com o cache das regras: em aparelho com root ou por backup, a criança extrai o verificador e descobre um PIN de 4 dígitos em segundos por força bruta offline — e com ele desliga a proteção. O contador de tentativas offline também ficava ali. | Corrigido |
| S2 | **Alta** | Backup do Android ligado (padrão do Expo): dados do app (cache, contadores, políticas) podem ser copiados/restaurados, inclusive para outro aparelho. | Corrigido |
| S3 | Média | Repetições e sequências já eram recusadas, mas o PIN aceitava os padrões mais populares (1212, 2580 — a coluna do meio do teclado —, 1122, 6969, anos como 2010…), os primeiros que uma criança tenta. | Corrigido |
| S4 | Média | `/child/events` sem limite: aparelho adulterado pode inundar o banco e mandar notificações ilimitadas aos pais, com texto escolhido por ele (engenharia social). | Corrigido |
| S5 | Média | Sem limite global de requisições por IP na API (só em rotas sensíveis específicas). | Corrigido |
| S6 | Média | 21 vulnerabilidades conhecidas em dependências de **build** (xmldom, brace-expansion, decode-uri-component, uuid). Nenhuma no servidor nem no app em execução. | 18 corrigidas; 3 aceitas (§4) |
| S7 | Baixa | App em produção aceitaria uma URL de API `http://` se a variável fosse configurada errado (tokens em texto claro). | Corrigido |
| S8 | Baixa | Cabeçalhos: faltavam CSP, bloqueio de iframe e Permissions-Policy nas páginas legais (HTML); parser `urlencoded` desnecessário numa API só JSON. | Corrigido |
| S9 | Baixa | CI sem permissões mínimas (`GITHUB_TOKEN` com escopo padrão) e sem atualização automática de dependências. | Corrigido |
| S10 | Baixa | Proxy do Clerk (modelo Replit) deriva a chave pública do cabeçalho Host. Sem impacto com o destino fixo do Clerk e JWT verificado pela chave secreta, mas frágil fora do Replit. | Documentado para o deploy |

## 3. Correções aplicadas

- **S1** — o verificador do PIN sai do cache e vai para o armazenamento seguro do sistema (Keystore no
  Android, Keychain no iOS, via `expo-secure-store`); o contador de tentativas offline também. O cache comum
  das regras não tem mais nada que ajude a descobrir o PIN.
- **S2** — `android.allowBackup: false`.
- **S3** — PINs fracos recusados no servidor e no app: todos os dígitos iguais, sequências crescentes ou
  decrescentes (1234, 9876…) e os mais usados (1212, 2580, 0852, 1122, 6969, 1004, 2000…). Mensagem clara.
- **S4** — `/child/events` limitado a 30 envios por 10 min por aparelho (429); notificação de adulteração no
  máximo 3 por 15 min por aparelho (os eventos continuam registrados); texto vindo do aparelho truncado em 80
  caracteres e sempre depois de um título definido pelo servidor.
- **S5** — limite global de 600 requisições por 5 min por IP (`express-rate-limit`), folgado para famílias
  atrás do mesmo roteador e firme contra inundação.
- **S6** — versões corrigidas via `overrides` (xmldom 0.8.15, brace-expansion 5.0.12).
- **S7** — em build de produção, URL de API que não seja `https://` é recusada (o app mostra "Acesso ainda
  não configurado" em vez de falar em texto claro).
- **S8** — `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'`,
  `X-Frame-Options: DENY`, `Permissions-Policy` restritiva, `Cross-Origin-Opener-Policy`; parser `urlencoded`
  removido.
- **S9** — `permissions: contents: read` no workflow; Dependabot para npm e GitHub Actions.

## 4. Riscos aceitos

- `decode-uri-component` < 0.5 e `uuid` < 11.1.1: só em ferramentas de build (Expo CLI, plugins), sem entrada
  controlada por atacante; a correção exige subir versão principal e quebraria o Expo CLI. Reavaliar quando o
  Expo atualizar.
- **Limites do sistema operacional** (documentados em `docs/ANDROID_PROTECAO.md`): restaurar o aparelho de
  fábrica e o modo de segurança do Android não podem ser bloqueados por um app comum; o responsável recebe o
  alerta "proteção desligada" e o aparelho aparece sem contato. No iPhone, a proteção vale a da Apple (Tempo de
  Uso + Compartilhamento Familiar). Um "Modo Blindado" com Device Owner fica para depois do lançamento.
- Aparelho com root/jailbreak pode encerrar o serviço de proteção; o servidor percebe (sem contato/proteção
  desligada) e avisa. Detecção de root fica como melhoria futura.

## 5. Recomendações para o dono (produção)

- Hospedar a API só com HTTPS, atrás de um proxy (1 salto, compatível com `trust proxy`), e definir
  `CORS_ORIGINS` só com o domínio web oficial (ou vazio).
- Fora do Replit, configurar o Clerk com domínio próprio ou desligar o proxy (S10).
- Chaves de produção só no cofre do provedor/EAS (nunca no repositório — o repositório é público).
- Ativar backups do Postgres com criptografia e retenção; restringir o acesso ao banco por IP.
- Ativar alertas do Dependabot e "secret scanning" no GitHub (grátis em repositório público).
- Monitorar 401/429 e picos de `/child/events` e `/family/devices/pair` nos logs.

## 6. Verificação

Testes automatizados novos (PIN fraco, limite de eventos, aviso deduplicado); suíte da API, checagem de tipos
e build Android/iOS no CI.
