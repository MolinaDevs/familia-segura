import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { notifyDevicesPolicyChanged } from "./push";

/**
 * Liberações de instalação vencidas: limpa o prazo e manda push silencioso para o aparelho
 * voltar a bloquear na hora (sem esperar a próxima sincronização em segundo plano).
 */
export async function expireInstallUnlocks(now: Date = new Date()) {
  const expired = await db.execute<{ family_id: string; child_id: string }>(sql`
    update devices set install_unlock_until = null
    where install_unlock_until is not null and install_unlock_until <= ${now.toISOString()}::timestamptz
    returning family_id, child_id`);
  const children = new Map(expired.rows.map((r) => [`${r.family_id}:${r.child_id}`, r]));
  for (const row of children.values()) await notifyDevicesPolicyChanged(row.family_id, row.child_id);
  return expired.rows.length;
}

export function scheduleUnlockExpiry() {
  setInterval(() => {
    expireInstallUnlocks().catch((err) => logger.error({ err }, "Falha ao encerrar liberações de instalação"));
  }, 60_000).unref();
}
