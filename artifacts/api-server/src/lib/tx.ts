import { sql } from "drizzle-orm";
import type { db } from "@workspace/db";

/** Trava a linha da família até o fim da transação: serializa checagens de limite (10 crianças / 10 aparelhos). */
export async function lockFamily(tx: Pick<typeof db, "execute">, familyId: string) {
  await tx.execute(sql`select id from families where id = ${familyId} for update`);
}
