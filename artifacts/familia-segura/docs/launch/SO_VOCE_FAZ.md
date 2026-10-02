# O que só o dono pode fazer para publicar

Tudo o que dependia só de código, configuração e material já está pronto (lista no fim). Aqui fica apenas o
que exige a sua identidade, o seu dinheiro ou uma decisão sua — em ordem. Estado em 01/10/2026.

## Fase 1 — Pedir agora (são os prazos longos)

| # | O quê | Onde | Prazo típico |
|---|---|---|---|
| 1 | **D-U-N-S** da empresa (CNPJ 68.754.468/0001-05) | developer.apple.com/enroll/duns-lookup | até ~2 semanas |
| 2 | **Domínio** (ex.: `familiasegura.com.br`) | registro.br | minutos |
| 3 | Caixa de e-mail no domínio (suporte@ / privacidade@) | qualquer provedor | minutos |

## Fase 2 — Com o D-U-N-S em mãos

| # | O quê | Custo | Observação |
|---|---|---|---|
| 4 | Conta **Google Play Console** como organização | US$ 25 (uma vez) | Verificação da empresa: alguns dias |
| 5 | Conta **Apple Developer** como organização | US$ 99/ano | Aprovação: de dias a 2 semanas |
| 6 | Pedido **Family Controls (Distribution)** à Apple | — | Texto pronto em `APP_STORE_PASSO_A_PASSO.md` §0; dias a semanas |

## Fase 3 — Com as contas abertas (cada item leva minutos)

**Google Play**
7. Criar o app e preencher a Play Console seguindo `GOOGLE_PLAY_PASSO_A_PASSO.md` (respostas prontas, imagens em
   `store-assets/`).
8. Criar a assinatura `familia_segura_premium` (planos `monthly` e `annual`) e **definir os preços**.
9. Play Console → Configuração → Acesso à API: criar a **conta de serviço** e baixar a chave JSON. Enviar em
   expo.dev → Credentials → Android → "Google Service Account Key for Play Store submissions" (para o envio
   automático) e na RevenueCat (para validar compras). Arquivo secreto: apagar depois de enviar.
10. Gravar o **vídeo da divulgação de acessibilidade** (roteiro no guia, §3) e subir como "não listado" no YouTube.
11. Criar a **conta de revisão** no app (um e-mail só para isso, família de demonstração, PIN definido) e
    informar usuário/senha nos campos privados das duas lojas.

**Apple**
12. Informar o **Team ID** (developer.apple.com → Membership) — eu coloco no `app.json`.
13. Criar o app na App Store Connect e preencher seguindo `APP_STORE_PASSO_A_PASSO.md`.
14. Assinar o contrato "Apps pagos" e preencher dados bancários/fiscais.
15. Criar as assinaturas `familia_segura_premium_monthly` e `familia_segura_premium_annual` e **definir os preços**.
16. Gerar a **In-App Purchase Key** e enviar à RevenueCat (o painel dela já avisa que falta).

**Produção**
17. **Clerk produção**: "Go to prod" no Clerk com o domínio (ele mostra os registros DNS a criar no Cloudflare) e
    ativar login com Google/Apple. Trocar as duas chaves no Render e me passar a pública (`pk_live_…`).
18. **AdMob**: criar a conta e os dois apps; me passar os IDs (não são segredo) para substituir os de teste.
19. Apontar `api.seudominio.com.br` para o Render (Settings → Custom Domains) — eu atualizo o app.

## Fase 4 — Decisões

- Preços finais e teste grátis (sugestão em `docs/COMERCIAL.md`: R$ 19,90/mês, R$ 149,90/ano, 7 dias grátis).
- Revisão jurídica da Política, dos Termos e do RIPD (`docs/legal/`), em especial o público-alvo "18+" na Play.
- Data do lançamento e se será gradual (recomendado: 20% → 100%).

## Comandos de build e envio (quando as contas existirem)

Rodar em `artifacts/familia-segura`. A assinatura digital do app fica guardada na conta da Expo.

```bash
npx eas-cli@latest build --profile production --platform android
```

```bash
npx eas-cli@latest submit --profile production --platform android
```

```bash
npx eas-cli@latest build --profile production --platform ios
```

```bash
npx eas-cli@latest submit --profile production --platform ios
```

O envio ao Google vai para o **teste interno, como rascunho** (nada fica público sem você publicar no painel).
O **primeiro** envio de um app novo à Play precisa ser manual: baixar o `.aab` do build em expo.dev e subir
em Teste interno → Criar versão; os seguintes podem ser pelo comando.

## Antes de publicar para o público (viro eu, você só confirma)

- `PREMIUM_ACCEPT_SANDBOX` → `false` no `render.yaml` (hoje `true` para o beta).
- Chaves de produção do Clerk e IDs reais do AdMob no EAS (ambiente production).
- Conferir se concessões promocionais da RevenueCat continuam valendo com a regra de "só assinatura real".

## O que já está pronto (não precisa fazer)

- Servidor e banco em produção (Render), monitoramento (Sentry, UptimeRobot), notificações (Firebase).
- Projeto EAS vinculado, ambientes preview e production configurados, número de build automático.
- Manifesto auditado: sem permissões desnecessárias; sem pedido de Face ID; backup desligado.
- Política de Privacidade com todos os operadores (inclui Sentry, Firebase e hospedagem nos EUA), página de
  Suporte com contato e página de Exclusão de conta com caminho sem o app.
- Ficha das lojas, respostas de privacidade/classificação, notas para revisão e texto do pedido à Apple.
- Imagens: 5 capturas 1290×2796, ícone 512 e 1024, banner 1024×500 (`store-assets/`).
