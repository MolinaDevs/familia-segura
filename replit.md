# Família Segura

Aplicativo mobile de controle parental que ajuda responsáveis a acompanhar o uso digital, definir limites por aplicativo e criar rotinas de pausa transparentes para crianças.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run migrate` — aplica as migrations
- `pnpm --filter @workspace/api-server run test` — testes da API (Postgres local via docker compose)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/familia-segura/` — aplicativo Expo
- `artifacts/familia-segura/context/AppContext.tsx` — estado da família (API + cache) e criança selecionada
- `artifacts/familia-segura/services/childSync.ts` — sincronização do aparelho da criança
- `artifacts/familia-segura/constants/colors.ts` — identidade visual
- `artifacts/familia-segura/app/` — telas e navegação

## Architecture decisions

- Servidor é a fonte da verdade (Express + Postgres); aparelhos da criança autenticam por credencial própria revogável e aplicam as regras localmente (offline por prazo configurável).
- Bloqueios reais: Android (acessibilidade + Device Admin + quarentena de apps) e iOS (Family Controls/ManagedSettings, módulo `modules/familia-segura-ios-controls`).
- Não roda no Expo Go: usar development build (EAS). `targets/` é gerado no prebuild (fora do git).
- Banco com migrations versionadas: `pnpm --filter @workspace/db run migrate` (não usar `push`).
- Documentação completa em `docs/` (plano, setup, deploy, proteção, testes, comercial, jurídico).

## Product

- Até 10 crianças e 10 aparelhos por família (Premium), iPhone e Android em qualquer combinação
- Limites e bloqueios por app, rotinas, tempo extra só do dia, pedidos de tempo
- Bloqueio de instalar/apagar apps, aprovação de apps novos, anti-desinstalação com PIN
- Relatórios com gráficos; co-responsáveis e observadores; transparência para a criança (ECA Digital)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
