import { ReplitConnectors } from "@replit/connectors-sdk";
import type { NextFunction, Request, Response } from "express";

const PREMIUM_ENTITLEMENT = "premium";
const ACTIVE_CACHE_MS = 5 * 60 * 1000;
const FAILURE_GRACE_MS = 72 * 60 * 60 * 1000;
const connectors = new ReplitConnectors();

type AuthedRequest = Request & { userId?: string };
type CachedEntitlement = {
  active: boolean;
  checkedAt: number;
  validUntil: number;
};

type ActiveEntitlementsResponse = {
  items?: Array<{
    lookup_key?: string;
    expires_at?: number | null;
  }>;
};

const accessCache = new Map<string, CachedEntitlement>();

function deny(res: Response) {
  res.status(402).json({
    error: "Premium subscription required",
    entitlement: PREMIUM_ENTITLEMENT,
  });
}

export async function requirePremium(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.userId;
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!userId || !projectId) {
    deny(res);
    return;
  }

  const now = Date.now();
  const cached = accessCache.get(userId);
  if (cached?.active && now - cached.checkedAt < ACTIVE_CACHE_MS && now < cached.validUntil) {
    next();
    return;
  }

  try {
    const response = await connectors.proxy(
      "revenuecat",
      `/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(userId)}/active_entitlements`,
      { method: "GET" },
    );
    if (response.status === 404) {
      accessCache.set(userId, { active: false, checkedAt: now, validUntil: now });
      deny(res);
      return;
    }
    if (!response.ok) throw new Error(`RevenueCat entitlement check failed (${response.status})`);

    const payload = await response.json() as ActiveEntitlementsResponse;
    const entitlement = payload.items?.find((item) => item.lookup_key === PREMIUM_ENTITLEMENT);
    if (!entitlement) {
      accessCache.set(userId, { active: false, checkedAt: now, validUntil: now });
      deny(res);
      return;
    }

    const storeExpiry = entitlement.expires_at ?? Number.POSITIVE_INFINITY;
    const validUntil = Math.min(now + FAILURE_GRACE_MS, storeExpiry);
    accessCache.set(userId, { active: true, checkedAt: now, validUntil });
    next();
  } catch (error) {
    req.log.warn({ err: error, userId }, "RevenueCat entitlement verification failed");
    if (cached?.active && now < cached.validUntil && now - cached.checkedAt < FAILURE_GRACE_MS) {
      next();
      return;
    }
    res.status(503).json({ error: "Subscription verification temporarily unavailable" });
  }
}

export async function requirePremiumForApproval(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.body?.status !== "approved") {
    next();
    return;
  }
  await requirePremium(req, res, next);
}