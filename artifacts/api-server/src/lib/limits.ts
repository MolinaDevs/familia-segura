import { and, eq } from "drizzle-orm";
import { db, membershipsTable, usersTable } from "@workspace/db";
import { hasPremium } from "../middlewares/requirePremium";

/**
 * Limites por plano. Requisito do dono: até 10 crianças e 10 aparelhos por família no Premium.
 * Responsáveis (titular + co-responsáveis + observadores) ficam fora dessa conta, com teto próprio.
 */
export const PLAN_LIMITS = {
  // Segurança (bloquear, pausar, filtro adulto, anti-desinstalação) é igual nos dois planos;
  // o Premium vende escala e conforto (docs/PLANO_LANCAMENTO.md §3).
  free: {
    maxChildren: 1, maxDevices: 1, maxGuardians: 1, reportDays: 7,
    maxTimedApps: 5, maxRoutines: 2, lockScreen: false, weeklySummary: false, adFree: false,
  },
  premium: {
    maxChildren: 10, maxDevices: 10, maxGuardians: 4, reportDays: 365,
    maxTimedApps: 1000, maxRoutines: 1000, lockScreen: true, weeklySummary: true, adFree: true,
  },
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
