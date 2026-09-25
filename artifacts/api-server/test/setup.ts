import { vi, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";

// Clerk simulado: o usuário autenticado vem do header `x-test-user`.
// Registro das contas apagadas no Clerk simulado (compartilhado com os testes via globalThis).
const clerkDeleted = vi.hoisted(() => {
  const list: string[] = [];
  (globalThis as { __clerkDeleted?: string[] }).__clerkDeleted = list;
  return list;
});

vi.mock("@clerk/express", () => ({
  clerkClient: { users: { deleteUser: async (id: string) => { clerkDeleted.push(id); } } },
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: { header: (name: string) => string | undefined }) => ({
    userId: req.header("x-test-user") ?? null,
    sessionClaims: {},
  }),
}));

const { db, pool } = await import("@workspace/db");

beforeEach(async () => {
  process.env.PREMIUM_BYPASS = "true";
  const { rows } = await pool.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public' and tablename <> '__drizzle_migrations'",
  );
  if (rows.length > 0) {
    await db.execute(sql.raw(`truncate ${rows.map((r) => `"${r.tablename}"`).join(", ")} restart identity cascade`));
  }
});

afterAll(async () => {
  await pool.end();
});
