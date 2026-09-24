import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Janela fixa persistida no Postgres: funciona com várias instâncias e sobrevive a reinícios.
 * Retorna true se a ação ainda está dentro do limite.
 */
export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
  const result = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count)
    values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else rate_limits.window_start end
    returning count
  `);
  return Number(result.rows[0]?.count ?? 0) <= limit;
}
