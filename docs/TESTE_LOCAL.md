# Testar no computador (sem contas Apple, Google ou Clerk)

Modo **demonstração**: login fictício, só em desenvolvimento. Travas: a API exige `DEV_AUTH=true` **e**
`NODE_ENV` diferente de `production`; o app exige `EXPO_PUBLIC_DEV_AUTH=true` **e** modo de desenvolvimento.
Build de produção nunca ativa isso.

## Uma vez

1. Instale Node 24, pnpm 10 (`npm i -g pnpm@10`) e Docker Desktop.
2. `pnpm install` na raiz do projeto.
3. Crie `.env` na raiz (use `.env.example` como base) com, pelo menos:
   ```
   DATABASE_URL=postgres://familia:familia@localhost:55432/familia_segura
   PORT=5000
   NODE_ENV=development
   DEV_AUTH=true
   PREMIUM_BYPASS=true
   PUSH_DISABLED=true
   CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsuZXhhbXBsZS5jb20k
   CLERK_SECRET_KEY=sk_test_demo_local
   CORS_ORIGINS=http://localhost:8081
   ```
4. Crie `artifacts/familia-segura/.env.local`:
   ```
   EXPO_PUBLIC_API_URL=http://localhost:5000
   EXPO_PUBLIC_DEV_AUTH=true
   EXPO_PUBLIC_DEV_USER=responsavel
   ```

## Sempre que for testar (3 terminais)

```bash
docker compose up -d db
pnpm --filter @workspace/db run migrate
pnpm --filter @workspace/api-server run seed:demo     # recria a Família Demonstração (30 dias de uso)
```
```bash
pnpm --filter @workspace/api-server run dev:local      # API em http://localhost:5000
```
```bash
pnpm --filter @workspace/familia-segura exec expo start --web --port 8081
```
Abra **http://localhost:8081** no navegador (use o modo "celular" das ferramentas do navegador: F12 → ícone de celular).
A primeira compilação leva de 2 a 3 minutos.

## Quem é quem na demonstração

| Usuário (`EXPO_PUBLIC_DEV_USER`) | Papel |
|---|---|
| `responsavel` (Ana) | titular — pode tudo |
| `carlos` | co-responsável — edita regras, aprova pedidos |
| `vo` (Vó Maria) | observadora — só vê |

Troque o usuário no `.env.local` e reinicie o `expo start` para testar os papéis.
PIN do responsável na demonstração: **4827**.

## O que dá e o que não dá para testar assim

- ✅ Todo o app do responsável: Home, Apps, Rotina, Relatórios, Família, aparelhos, convites, configurações, modo escuro.
- ✅ Testes automáticos da API: `pnpm --filter @workspace/api-server run test` (usam o banco `familia_segura_test`,
  **não** apagam a demonstração).
- ❌ Proteção no aparelho da criança (bloqueios, anti-desinstalação): precisa de celular Android com o APK de
  desenvolvimento (`docs/ACOES_DO_DONO.md`) ou emulador do Android Studio.
- ❌ Compras (lojas) e notificações push reais.
