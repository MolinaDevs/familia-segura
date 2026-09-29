import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/**
 * Os testes apagam as tabelas a cada caso: usam um banco PRÓPRIO (familia_segura_test por padrão),
 * nunca o de desenvolvimento. Cria o banco se faltar e aplica as migrations.
 */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "postgres://familia:familia@localhost:55432/familia_segura_test");
  const dbName = url.pathname.slice(1);
  const admin = new URL(url.toString());
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [dbName]);
  if (!rowCount) await client.query(`create database "${dbName.replace(/"/g, "")}"`);
  await client.end();

  const pool = new pg.Pool({ connectionString: url.toString() });
  const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../lib/db/migrations");
  await migrate(drizzle(pool), { migrationsFolder });
  await pool.end();
}
