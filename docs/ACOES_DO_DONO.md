# Ações que só o dono pode fazer

O código das fases 0–5 está pronto. Estes itens exigem contas, contratos, pagamentos, aparelhos físicos ou
aceite de termos em seu nome — por isso não foram feitos automaticamente.

## 1. Urgente (caminho crítico)
1. **Conta Apple Developer** (US$ 99/ano) e **pedido do entitlement Family Controls (Distribution)** para
   `com.familiasegura.app` e as 3 extensões (`ActivityMonitorExtension`, `ShieldAction`, `ShieldConfiguration`).
   Formulário: developer.apple.com/contact/request/family-controls-distribution. Leva semanas.
   Depois: Team ID em `expo.ios.appleTeamId` (`artifacts/familia-segura/app.json`).
2. **Conta Expo (EAS)**: `npx eas-cli login` e, em `artifacts/familia-segura`, `npx eas-cli init`.
3. **Google Play Console** (US$ 25, taxa única) e verificação da conta.
4. **Subir o repositório para o GitHub** (o CI em `.github/workflows/ci.yml` compila Kotlin e Swift que não
   puderam ser compilados nesta máquina). Ex.: criar repositório vazio e `git remote add origin … && git push -u origin main`.

## 2. Primeiro teste em aparelho real (Android)
```bash
cd artifacts/familia-segura
npx eas-cli build --platform android --profile development
```
Instale o APK, rode a API (`docs/SETUP_LOCAL.md`) e abra com `pnpm --filter @workspace/familia-segura run dev:local`.
Siga `docs/TESTE_BETA.md`.

## 3. Risco principal a confirmar cedo
- Responsável **sem iPhone**: criar conta Apple, montar o Compartilhamento Familiar e autorizar o Tempo de Uso
  no iPhone da criança. Confirmar que funciona sem aparelho Apple do adulto.

## 4. Chaves e serviços (produção)
- Clerk: chaves de produção; login Google/Apple.
- RevenueCat: **Secret API key v2**; produtos nas lojas; oferta `default`.
- Hospedagem da API + Postgres 15+ (`docs/DEPLOY.md`).
- Dados do controlador: `LEGAL_CONTROLLER_NAME`, `LEGAL_CONTROLLER_CNPJ`, `LEGAL_DPO_EMAIL`.
- **AdMob (anúncios do plano grátis):** criar a conta e os apps Android/iOS; trocar os IDs de **teste** do
  plugin `react-native-google-mobile-ads` em `artifacts/familia-segura/app.json` pelos IDs reais dos apps; criar
  um bloco "Banner" por plataforma e definir `EXPO_PUBLIC_ADMOB_BANNER_ANDROID` e `EXPO_PUBLIC_ADMOB_BANNER_IOS`
  no EAS. No AdMob: classificação máxima **G**, anúncios **não personalizados**, bloquear categorias sensíveis
  (namoro, apostas, álcool, política). Publicar o `app-ads.txt` no site do app. Sem os IDs, o app mostra só o
  cartão do Premium (nada quebra).
- **RevenueCat:** o entitlement `premium` libera tudo do comparativo (docs/PLANO_LANCAMENTO.md §3).

### 4.1 Configuração obrigatória de produção (revisões de 30/09/2026)
**API**
- `NODE_ENV=production`: sem `DATABASE_URL`, `CLERK_SECRET_KEY` e `CLERK_PUBLISHABLE_KEY` o servidor não sobe.
- `DATABASE_URL` com `?sslmode=require` (conexão criptografada com o banco).
- `TRUST_PROXY_HOPS`: `1` atrás de proxy/balanceador; `0` sem proxy.
- `CORS_ORIGINS`: só o domínio web oficial (ou vazio).
- `REVENUECAT_PROJECT_ID` e `REVENUECAT_SECRET_API_KEY` (sem eles todos ficam no plano grátis).
- `PREMIUM_ACCEPT_SANDBOX=true` **só durante o beta** (compras de teste do TestFlight/teste fechado); no lançamento, `false` ou ausente.
- `DB_POOL_MAX` (padrão 10) × número de instâncias abaixo do limite de conexões do Postgres.
- Nunca definir `DEV_AUTH` nem `PREMIUM_BYPASS`.

**Deploy**
- Rodar `pnpm --filter @workspace/db run migrate` **antes** de subir a versão nova.
- Health check do balanceador em `/api/readyz`; liveness em `/api/healthz`.
- Fora do Replit: Clerk com domínio próprio ou proxy desligado.
- Backups do Postgres criptografados; acesso ao banco restrito por IP.

**App (EAS)**
- `EXPO_PUBLIC_API_URL` com `https://` (o app de produção recusa `http://`).
- **Não** definir `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` nos perfis de produção.

**GitHub e teste final**
- Ativar alertas do Dependabot e "Secret scanning" (repositório público).
- Build de teste com conta real: criar conta, entrar num 2º celular (código por e-mail), tocar em "Sair" e
  confirmar que os avisos da família param de chegar.

## 5. Jurídico e comercial
- Advogado: Política, Termos, RIPD (`docs/legal/RIPD_RASCUNHO.md`), DPAs com fornecedores, enquadramento no ECA Digital.
- INPI: nome/marca "Família Segura".
- Preço final (proposta em `docs/COMERCIAL.md`: R$ 19,90/mês ou R$ 149,90/ano, 7 dias grátis).

## 6. Envio às lojas
- Declarações do Google Play (Accessibility com vídeo, Device Admin, Data safety) — `docs/ANDROID_PROTECAO.md`.
- Notas de revisão e conta demo — `artifacts/familia-segura/docs/launch/REVIEW_NOTES.md`.
- Textos e screenshots — `artifacts/familia-segura/docs/launch/STORE_LISTING_PT_BR.md`.
- Checklist final — `artifacts/familia-segura/docs/launch/RELEASE_CHECKLIST.md`.
