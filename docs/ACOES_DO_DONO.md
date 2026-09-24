# Ações que só o dono pode fazer

O código não consegue concluir estes itens: exigem contas, contratos, pagamentos ou aparelhos físicos.

## Urgente (caminho crítico)
1. **Conta Apple Developer** (US$ 99/ano) e **pedido do entitlement Family Controls (Distribution)**
   para `com.familiasegura.app` e as 3 extensões (`ActivityMonitorExtension`, `ShieldAction`,
   `ShieldConfiguration`). Formulário: developer.apple.com/contact/request/family-controls-distribution.
   A aprovação costuma levar semanas.
2. **Conta Expo (EAS)**: `npx eas-cli login` e, dentro de `artifacts/familia-segura`, `npx eas-cli init`
   (grava o `projectId` no `app.json`).
3. **Conta Google Play Console** (US$ 25, taxa única) e verificação da conta.

## Para o primeiro teste em aparelho real (Android)
```bash
cd artifacts/familia-segura
npx eas-cli build --platform android --profile development
```
Instale o APK gerado no celular da criança e no do responsável, rode a API (`docs/SETUP_LOCAL.md`) e
abra o app com `pnpm --filter @workspace/familia-segura run dev:local`.

## Teste de plataforma cruzada (risco principal)
- Responsável **sem iPhone** criando uma conta Apple, colocando a criança no Compartilhamento Familiar
  e autorizando o Family Controls no iPhone da criança. Confirmar se é possível sem nenhum aparelho
  Apple do adulto.

## Chaves e serviços
- Clerk: chaves de produção e provedores de login (Google/Apple).
- RevenueCat: **Secret API key v2** (`REVENUECAT_SECRET_API_KEY`), produtos nas lojas, oferta `default`.
- Hospedagem da API + Postgres gerenciado (Replit, Railway, Render, Fly, Supabase etc.).
- Expo Push: nenhum custo; exige `projectId` do EAS.

## Jurídico e comercial
- Advogado para Política de Privacidade, Termos, RIPD e consentimento (LGPD art. 14 / ECA Digital).
- Nome e marca "Família Segura" no INPI; dados do controlador e canal de suporte.
- Preços finais dos planos.
