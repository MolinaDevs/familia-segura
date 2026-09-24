import type { NextFunction, Request, Response } from "express";

/**
 * Verificação do entitlement Premium direto na API REST v2 da RevenueCat.
 *
 * Antes dependia de `@replit/connectors-sdk`, que só funciona dentro do Replit.
 * Agora usa `REVENUECAT_SECRET_API_KEY` (chave secreta v2, somente leitura de
 * clientes) e `REVENUECAT_PROJECT_ID`, e roda em qualquer hospedagem.
 *
 * `PREMIUM_BYPASS=true` libera o Premium apenas fora de produção, para testes
 * locais e automatizados sem conta nas lojas.
 */
const PREMIUM_ENTITLEMENT = process.env.REVENUECAT_PREMIUM_ENTITLEMENT ?? "premium";
const REVENUECAT_API = process.env.REVENUECAT_API_URL ?? "https://api.revenuecat.com";
const ACTIVE_CACHE_MS = 5 * 60 * 1000;
const FAILURE_GRACE_MS = 72 * 60 * 60 * 1000;

type AuthedRequest = Request & { userId?: string };
type CachedEntitlement = {
  active: boolean;
  checkedAt: number;
  validUntil: number;
};

type ActiveEntitlementsResponse = {
  items?: Array<{
    entitlement_id?: string;
    lookup_key?: string;
    expires_at?: number | null;
  }>;
};

const accessCache = new Map<string, CachedEntitlement>();

export function premiumBypassEnabled(): boolean {
  return process.env.PREMIUM_BYPASS === "true" && process.env.NODE_ENV !== "production";
}

function deny(res: Response) {
  res.status(402).json({
    error: "Premium subscription required",
    entitlement: PREMIUM_ENTITLEMENT,
  });
}

async function fetchActiveEntitlements(projectId: string, secretKey: string, userId: string) {
  return fetch(
    `${REVENUECAT_API}/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(userId)}/active_entitlements`,
    { method: "GET", headers: { Authorization: `Bearer ${secretKey}`, Accept: "application/json" } },
  );
}

/** Retorna true/false para o entitlement; lança erro em falha temporária. */
export async function hasPremium(userId: string): Promise<boolean> {
  if (premiumBypassEnabled()) return true;
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  const secretKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!projectId || !secretKey) return false;

  const now = Date.now();
  const cached = accessCache.get(userId);
  if (cached?.active && now - cached.checkedAt < ACTIVE_CACHE_MS && now < cached.validUntil) return true;

  try {
    const response = await fetchActiveEntitlements(projectId, secretKey, userId);
    if (response.status === 404) {
      accessCache.set(userId, { active: false, checkedAt: now, validUntil: now });
      return false;
    }
    if (!response.ok) throw new Error(`RevenueCat entitlement check failed (${response.status})`);
    const payload = (await response.json()) as ActiveEntitlementsResponse;
    const entitlement = payload.items?.find(
      (item) => item.lookup_key === PREMIUM_ENTITLEMENT || item.entitlement_id === PREMIUM_ENTITLEMENT,
    );
    if (!entitlement) {
      accessCache.set(userId, { active: false, checkedAt: now, validUntil: now });
      return false;
    }
    const storeExpiry = entitlement.expires_at ?? Number.POSITIVE_INFINITY;
    const validUntil = Math.min(now + FAILURE_GRACE_MS, storeExpiry);
    accessCache.set(userId, { active: true, checkedAt: now, validUntil });
    return true;
  } catch (error) {
    if (cached?.active && now < cached.validUntil && now - cached.checkedAt < FAILURE_GRACE_MS) return true;
    throw error;
  }
}

export async function requirePremium(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    deny(res);
    return;
  }
  try {
    if (await hasPremium(userId)) next();
    else deny(res);
  } catch (error) {
    req.log.warn({ err: error, userId }, "RevenueCat entitlement verification failed");
    res.status(503).json({ error: "Subscription verification temporarily unavailable" });
  }
}

export async function requirePremiumForApproval(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  if (req.body?.status !== "approved") {
    next();
    return;
  }
  await requirePremium(req, res, next);
}
