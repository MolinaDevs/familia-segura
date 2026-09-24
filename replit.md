# Família Segura

Aplicativo mobile de controle parental que ajuda responsáveis a acompanhar o uso digital, definir limites por aplicativo e criar rotinas de pausa transparentes para crianças.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
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
- `artifacts/familia-segura/context/AppContext.tsx` — estado local e persistência das regras
- `artifacts/familia-segura/constants/colors.ts` — identidade visual
- `artifacts/familia-segura/app/` — telas e navegação

## Architecture decisions

- O primeiro build é local-first e usa AsyncStorage; não depende de conta ou servidor.
- Bloqueios reais de outros aplicativos exigem capacidades nativas específicas de iOS/Android e não são simulados nesta versão.
- A interface prioriza transparência: regras e rotinas são apresentadas como acordos visíveis para a família.

## Product

- Painel diário de tempo total e aplicativos que precisam de atenção
- Limites diários, bloqueio e exceções temporárias por aplicativo
- Rotinas de sono e escola
- Perfil da criança, privacidade e preferências da família

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
