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
/**
 * Resposta "sem Premium" também fica em cache (curto): sem isso cada sincronização de aparelho do plano grátis
 * (1x/min) virava uma chamada à RevenueCat — estouro do limite da API e lentidão em todas as rotas.
 * 60 s é o atraso máximo para uma compra nova valer no servidor.
 */
const INACTIVE_CACHE_MS = 60 * 1000;
const FAILURE_GRACE_MS = 72 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_CACHE_ENTRIES = 50_000;

type AuthedRequest = Request & { userId?: string };
type CachedEntitlement = {
  active: boolean;
  checkedAt: number;
  validUntil: number;
};

type SubscriptionsResponse = {
  items?: Array<{
    gives_access?: boolean;
    store?: string;
    environment?: string;
    entitlements?: { items?: Array<{ id?: string; lookup_key?: string }> };
  }>;
};

type ActiveEntitlementsResponse = {
  items?: Array<{
    entitlement_id?: string;
    lookup_key?: string;
    expires_at?: number | null;
  }>;
};

const accessCache = new Map<string, CachedEntitlement>();
/** Consultas simultâneas do mesmo usuário (várias rotas/aparelhos ao mesmo tempo) viram uma só chamada. */
const inFlight = new Map<string, Promise<boolean>>();

function remember(userId: string, entry: CachedEntitlement) {
  if (accessCache.size >= MAX_CACHE_ENTRIES && !accessCache.has(userId)) {
    const oldest = accessCache.keys().next().value;
    if (oldest !== undefined) accessCache.delete(oldest);
  }
  accessCache.set(userId, entry);
}

/** Testes: começa sem cache. */
export function clearEntitlementCache() {
  accessCache.clear();
  inFlight.clear();
}

/**
 * Compras de teste (loja de teste da RevenueCat, sandbox da Apple/Google) são gratuitas. Em produção só valem
 * assinaturas reais — a chave da loja de teste é pública (está no app/repositório), então qualquer um poderia
 * "comprar" de graça com o próprio id. No ambiente de beta (TestFlight/teste fechado), PREMIUM_ACCEPT_SANDBOX=true.
 */
function realPurchasesOnly(): boolean {
  return process.env.NODE_ENV === "production" && process.env.PREMIUM_ACCEPT_SANDBOX !== "true";
}

const matchesEntitlement = (item: { id?: string; lookup_key?: string }) =>
  item.lookup_key === PREMIUM_ENTITLEMENT || item.id === PREMIUM_ENTITLEMENT;

/** Há assinatura real (loja de verdade, ambiente de produção) que dá acesso ao Premium? */
async function hasRealSubscription(projectId: string, secretKey: string, userId: string) {
  const response = await fetch(
    `${REVENUECAT_API}/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(userId)}/subscriptions`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${secretKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`RevenueCat subscriptions check failed (${response.status})`);
  const payload = (await response.json()) as SubscriptionsResponse;
  return (payload.items ?? []).some((sub) =>
    sub.gives_access === true
    && sub.environment === "production"
    && sub.store !== "test_store"
    && (sub.entitlements?.items ?? []).some(matchesEntitlement));
}

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
    {
      method: "GET",
      headers: { Authorization: `Bearer ${secretKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
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
  if (cached && !cached.active && now - cached.checkedAt < INACTIVE_CACHE_MS) return false;

  const pending = inFlight.get(userId);
  if (pending) return pending;
  const check = checkEntitlement(projectId, secretKey, userId, cached).finally(() => inFlight.delete(userId));
  inFlight.set(userId, check);
  return check;
}

async function checkEntitlement(projectId: string, secretKey: string, userId: string, cached: CachedEntitlement | undefined) {
  const now = Date.now();
  try {
    const response = await fetchActiveEntitlements(projectId, secretKey, userId);
    if (response.status === 404) {
      remember(userId, { active: false, checkedAt: now, validUntil: now });
      return false;
    }
    if (!response.ok) throw new Error(`RevenueCat entitlement check failed (${response.status})`);
    const payload = (await response.json()) as ActiveEntitlementsResponse;
    const entitlement = payload.items?.find(
      (item) => item.lookup_key === PREMIUM_ENTITLEMENT || item.entitlement_id === PREMIUM_ENTITLEMENT,
    );
    // Em produção o direito precisa vir de assinatura real (loja de verdade, ambiente de produção).
    if (entitlement && realPurchasesOnly() && !(await hasRealSubscription(projectId, secretKey, userId))) {
      remember(userId, { active: false, checkedAt: now, validUntil: now });
      return false;
    }
    if (!entitlement) {
      remember(userId, { active: false, checkedAt: now, validUntil: now });
      return false;
    }
    const storeExpiry = entitlement.expires_at ?? Number.POSITIVE_INFINITY;
    const validUntil = Math.min(now + FAILURE_GRACE_MS, storeExpiry);
    remember(userId, { active: true, checkedAt: now, validUntil });
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
