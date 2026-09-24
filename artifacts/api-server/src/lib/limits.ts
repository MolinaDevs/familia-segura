import { and, eq } from "drizzle-orm";
import { db, membershipsTable, usersTable } from "@workspace/db";
import { hasPremium } from "../middlewares/requirePremium";

/**
 * Limites por plano. Requisito do dono: até 10 crianças e 10 aparelhos por família no Premium.
 * Responsáveis (titular + co-responsáveis + observadores) ficam fora dessa conta, com teto próprio.
 */
export const PLAN_LIMITS = {
  free: { maxChildren: 1, maxDevices: 1, maxGuardians: 1, reportDays: 7 },
  premium: { maxChildren: 10, maxDevices: 10, maxGuardians: 4, reportDays: 365 },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

/** O plano vem da assinatura do titular: co-responsáveis herdam o Premium da família. */
export async function familyPlan(familyId: string): Promise<Plan> {
  const [owner] = await db.select({ clerkUserId: usersTable.clerkUserId })
    .from(membershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, membershipsTable.userId))
    .where(and(eq(membershipsTable.familyId, familyId), eq(membershipsTable.role, "owner")));
  if (!owner) return "free";
  try {
    return (await hasPremium(owner.clerkUserId)) ? "premium" : "free";
  } catch {
    // Falha temporária na verificação: não derruba a família, aplica o plano gratuito para novas criações.
    return "free";
  }
}
