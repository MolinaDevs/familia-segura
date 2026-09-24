import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";

// Aplica as migrations versionadas de lib/db/migrations (substitui o `drizzle-kit push`).
const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

type Journal = { entries: Array<{ idx: number; tag: string; when: number }> };

/**
 * Bancos criados antes com `drizzle-kit push` (ex.: o do Replit) já têm as tabelas da migration 0000,
 * mas não têm o registro de migrations. Nesse caso marcamos só a 0000 como aplicada.
 */
async function baselineLegacyPushDatabase() {
  const { rows: legacy } = await pool.query<{ exists: boolean }>(
    "select to_regclass('public.families') is not null as exists",
  );
  if (!legacy[0]?.exists) return;
  await pool.query("create schema if not exists drizzle");
  await pool.query(
    "create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)",
  );
  const { rows: applied } = await pool.query("select 1 from drizzle.__drizzle_migrations limit 1");
  if (applied.length > 0) return;
  const journal = JSON.parse(readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8")) as Journal;
  const first = journal.entries.find((entry) => entry.idx === 0);
  if (!first) return;
  const sqlText = readFileSync(path.join(migrationsFolder, `${first.tag}.sql`), "utf8");
  const hash = createHash("sha256").update(sqlText).digest("hex");
  await pool.query("insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)", [hash, first.when]);
  console.log(`Banco legado detectado: migration ${first.tag} marcada como aplicada.`);
}

await baselineLegacyPushDatabase();
await migrate(db, { migrationsFolder });
await pool.end();
console.log("Migrations aplicadas.");
