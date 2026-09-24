import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

/**
 * Retenção prometida na Política de Privacidade: uso e eventos por até 12 meses;
 * códigos de pareamento/convites vencidos e contadores de rate limit antigos são apagados.
 */
export async function runRetention(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const results = await db.transaction(async (tx) => {
    const hourly = await tx.execute(sql`delete from usage_hourly where day < ${cutoff}`);
    const daily = await tx.execute(sql`delete from usage_daily where day < ${cutoff}`);
    const grants = await tx.execute(sql`delete from temporary_grants where valid_on < ${cutoff}`);
    const events = await tx.execute(sql`delete from device_events where occurred_at < ${cutoff}::date`);
    await tx.execute(sql`delete from pairing_codes where expires_at < ${now.toISOString()}::timestamptz - interval '7 days'`);
    await tx.execute(sql`delete from family_invites where expires_at < ${now.toISOString()}::timestamptz - interval '30 days'`);
    await tx.execute(sql`delete from rate_limits where window_start < ${now.toISOString()}::timestamptz - interval '1 day'`);
    return { hourly: hourly.rowCount ?? 0, daily: daily.rowCount ?? 0, grants: grants.rowCount ?? 0, events: events.rowCount ?? 0 };
  });
  return results;
}

export function scheduleRetention() {
  const run = () => runRetention()
    .then((removed) => logger.info({ removed }, "Retenção de dados aplicada"))
    .catch((err) => logger.error({ err }, "Falha na retenção de dados"));
  setTimeout(run, 60_000).unref();
  setInterval(run, 24 * 60 * 60 * 1000).unref();
}
