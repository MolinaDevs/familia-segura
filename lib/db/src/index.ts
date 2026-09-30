import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * Pool com limites explícitos: conexões contadas (o Postgres gerenciado tem teto), espera curta por conexão
 * e consultas presas encerradas pelo próprio banco em vez de segurar a requisição para sempre.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 15_000),
  idle_in_transaction_session_timeout: 30_000,
});

// Sem este listener, a queda de uma conexão ociosa (reinício do banco, rede) derruba o processo inteiro.
pool.on("error", (err) => {
  console.error("Conexão ociosa do Postgres falhou (o pool abre outra):", err.message);
});
export const db = drizzle(pool, { schema });

export * from "./schema";
