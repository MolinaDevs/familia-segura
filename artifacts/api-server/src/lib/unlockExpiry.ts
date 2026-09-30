import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { notifyDevicesPolicyChanged } from "./push";
import { every, singleFlight } from "./jobs";

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

/** Pausas ("Pausar agora") vencidas: limpa e avisa os aparelhos para liberar os apps na hora. */
export async function expirePauses(now: Date = new Date()) {
  const expired = await db.execute<{ family_id: string; id: string }>(sql`
    update children set paused_until = null
    where paused_until is not null and paused_until <= ${now.toISOString()}::timestamptz
    returning family_id, id`);
  for (const row of expired.rows) await notifyDevicesPolicyChanged(row.family_id, row.id);
  return expired.rows.length;
}

export function scheduleUnlockExpiry() {
  every(60_000, singleFlight(async () => {
    await expireInstallUnlocks().catch((err) => logger.error({ err }, "Falha ao encerrar liberações de instalação"));
    await expirePauses().catch((err) => logger.error({ err }, "Falha ao encerrar pausas"));
  }));
}
