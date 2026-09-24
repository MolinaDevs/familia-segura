# Deploy da API

A API é um servidor Node (Express) + Postgres. Roda no Replit (como já estava) ou em qualquer provedor Node
(Railway, Render, Fly.io, VPS) com um Postgres gerenciado (Neon, Supabase, RDS…).

## Variáveis de ambiente (produção)

| Variável | Obrigatória | Observação |
|---|---|---|
| `DATABASE_URL` | sim | Postgres 15+ (usa `UNIQUE NULLS NOT DISTINCT`) |
| `PORT` | sim | o Replit usa 8080 |
| `NODE_ENV` | sim | `production` |
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | sim | chaves de produção do Clerk |
| `REVENUECAT_PROJECT_ID`, `REVENUECAT_SECRET_API_KEY` | sim | Secret API key **v2** (leitura de customers) |
| `REVENUECAT_PREMIUM_ENTITLEMENT` | não | padrão `premium` |
| `LEGAL_CONTROLLER_NAME`, `LEGAL_CONTROLLER_CNPJ`, `LEGAL_DPO_EMAIL` | sim p/ lojas | aparecem na Política de Privacidade |
| `CORS_ORIGINS` | não | só se houver painel web |
| `PUSH_DISABLED` | não | `true` desliga o envio de push |
| `PREMIUM_BYPASS` | **nunca em produção** | ignorado quando `NODE_ENV=production` |

## Passos

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run migrate      # aplica lib/db/migrations (reconhece banco antigo criado por push)
pnpm --filter @workspace/api-server run build
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

No Replit o `scripts/post-merge.sh` já roda `migrate` (não usar mais `db push`).

## Rotinas automáticas

- Retenção (12 meses de uso/eventos; códigos e convites vencidos) roda 1 min após subir e a cada 24 h.
- Push via Expo (`exp.host`); nenhum custo, exige o `projectId` do EAS no app.

## App

Build com EAS apontando para a API:

```bash
cd artifacts/familia-segura
EXPO_PUBLIC_API_URL=https://api.seu-dominio.com.br npx eas-cli build --platform all --profile production
```

(ou defina as variáveis `EXPO_PUBLIC_*` no painel do EAS, ambiente `production`).

## Checagem pós-deploy

- `GET /api/healthz` → `{"status":"ok"}`
- `GET /api/legal/privacy` mostra razão social/CNPJ/encarregado preenchidos.
- Criar família de teste, parear um aparelho, conferir push de "pediu mais tempo".
