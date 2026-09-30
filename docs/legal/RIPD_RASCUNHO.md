# Relatório de Impacto à Proteção de Dados (RIPD) — RASCUNHO

> Rascunho técnico para revisão do advogado/encarregado. Não é parecer jurídico.
> Base: LGPD (Lei 13.709/2018, em especial art. 14 e art. 38) e ECA Digital (Lei 15.211/2025).

## 1. Identificação

- Controlador: `LEGAL_CONTROLLER_NAME` / `LEGAL_CONTROLLER_CNPJ` (a definir)
- Encarregado: `LEGAL_DPO_EMAIL` (a definir)
- Tratamento: controle parental de aparelhos de crianças e adolescentes.

## 2. Titulares e dados

| Titular | Dados | Finalidade | Base legal |
|---|---|---|---|
| Responsável | nome de exibição, id de conta, e-mail (Clerk), papel, token de push | conta, família, notificações | execução de contrato (art. 7º, V) |
| Criança/adolescente | nome/apelido, ano de nascimento, cor | perfil e faixa etária das regras | consentimento específico de um responsável (art. 14 §1º) |
| Aparelho da criança | plataforma, modelo, SO, fuso, bateria, estado da proteção, hash da credencial | aplicar e verificar a proteção | art. 14 §1º |
| Uso | minutos por app por dia/hora; no Android, apps instalados e eventos (instalação, remoção, adulteração, reinício) | limites, relatórios, aprovação de apps | art. 14 §1º |

**Não tratados:** mensagens, fotos, contatos, localização, navegação, conteúdo de tela, teclado.

## 3. Necessidade e proporcionalidade

- Minimização: iOS não envia nomes de apps (tokens ficam no aparelho); Android usa `<queries>` LAUNCHER e não
  `QUERY_ALL_PACKAGES`; serviço de acessibilidade só identifica o app em primeiro plano e, em Configurações,
  palavras que indicam desligamento/desinstalação.
- Retenção: uso e eventos por 12 meses (rotina automática `runRetention`); códigos e convites vencidos apagados.
- Transparência: tela da criança lista regras e dados compartilhados; página pública "Para a criança".
- Sem venda de dados nem perfilamento comercial. Plano grátis: banner não personalizado (Google AdMob) só no app do responsável; o aparelho da criança nunca mostra nem inicializa anúncios.

## 4. Riscos e medidas

| Risco | Medida |
|---|---|
| Uso abusivo por adulto (vigilância/controle excessivo) | sem espionagem de conteúdo; transparência obrigatória na tela da criança; sugestões por idade com autonomia progressiva |
| Acesso indevido à conta da família | autenticação Clerk; papéis (titular/co-responsável/observador); auditoria com autor |
| Aparelho perdido/roubado | credencial revogável; revogação apaga regras locais |
| Força bruta em pareamento/PIN/convite | códigos longos, uso único, validade curta, rate limit persistente, scrypt |
| Vazamento em trânsito | HTTPS; tokens só em armazenamento seguro do aparelho |
| Retenção excessiva | exclusão automática em 12 meses; exclusão total pelo titular |
| Transferência internacional | cláusulas contratuais com Clerk, RevenueCat, Expo e hospedagem |

## 5. Direitos dos titulares

Exportação (JSON), correção, exclusão da família, revogação do consentimento, canal do encarregado.

## 6. Pendências para o jurídico

- [ ] Confirmar enquadramento do ECA Digital para o app (ferramenta de supervisão parental) e obrigações aplicáveis.
- [ ] Texto final de consentimento e política (PT-BR) e registro da versão aceita.
- [ ] Contratos de operador (DPA) com fornecedores.
- [ ] Procedimento de incidente (art. 48) e prazo de comunicação à ANPD.
- [ ] Revisar a classificação etária e o público-alvo declarados nas lojas.
