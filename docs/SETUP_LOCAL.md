# Ambiente local (Windows, macOS ou Linux)

Pré-requisitos: Node 24, pnpm 10 (`npm i -g pnpm@10`), Docker.

```bash
pnpm install
cp .env.example .env            # preencha as chaves
docker compose up -d db         # Postgres em localhost:55432
pnpm --filter @workspace/db run migrate
pnpm --filter @workspace/api-server run dev:local   # API em http://localhost:5000
pnpm --filter @workspace/api-server run test        # testes da API
pnpm run typecheck
```

## App no celular
O app **não roda no Expo Go** (usa módulos nativos: Family Controls, AccessibilityService, RevenueCat).
Use o *development build* (ver `docs/ACOES_DO_DONO.md`) e depois:

```bash
pnpm --filter @workspace/familia-segura run dev:local
```

`EXPO_PUBLIC_API_URL` deve apontar para o IP do computador na rede (ex.: `http://192.168.0.10:5000`).

## Banco de dados
- Alterou `lib/db/src/schema`? Gere uma migration: `pnpm --filter @workspace/db run generate -- --name descricao`.
- Aplique com `pnpm --filter @workspace/db run migrate`. Não use mais `push` fora de testes descartáveis.
