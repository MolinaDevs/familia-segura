import { sql } from "drizzle-orm";
import type { db } from "@workspace/db";

/** Trava a linha da família até o fim da transação: serializa checagens de limite (10 crianças / 10 aparelhos). */
export async function lockFamily(tx: Pick<typeof db, "execute">, familyId: string) {
  await tx.execute(sql`select id from families where id = ${familyId} for update`);
}

/**
 * Trava a linha do aparelho: sincronizações simultâneas do mesmo aparelho (app + tarefa em segundo plano)
 * rodam uma de cada vez — sem uso contado em dobro nem conflito de chave no inventário.
 */
export async function lockDevice(tx: Pick<typeof db, "execute">, deviceId: string) {
  await tx.execute(sql`select id from devices where id = ${deviceId} for update`);
}
