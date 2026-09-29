import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, devicesTable, membershipsTable, usersTable, type Device } from "@workspace/db";
import { sha256 } from "./codes";

export type Role = "owner" | "guardian" | "viewer";
export type MemberContext = { membershipId: string; familyId: string; userId: string; role: Role; displayName: string };

export type AuthedRequest = Request & { userId?: string; member?: MemberContext; device?: Device };

/**
 * Modo demonstração para testes locais sem conta no Clerk: "Authorization: Bearer dev:<usuario>".
 * Duas travas: nunca em produção e só com DEV_AUTH=true.
 */
export const devAuthEnabled = () => process.env.DEV_AUTH === "true" && process.env.NODE_ENV !== "production";

export function clerkUserId(req: Request): string | undefined {
  if (devAuthEnabled()) {
    const header = req.header("authorization");
    if (header?.startsWith("Bearer dev:")) return `dev_${header.slice("Bearer dev:".length).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`;
  }
  const auth = getAuth(req);
  const claims = auth.sessionClaims as { userId?: string } | null | undefined;
  return auth.userId ?? claims?.userId ?? undefined;
}

export function fail(res: Response, status: number, error: string, code?: string) {
  res.status(status).json(code ? { error, code } : { error });
}

export const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction): void => {
  const userId = clerkUserId(req);
  if (!userId) { fail(res, 401, "Unauthorized"); return; }
  req.userId = userId;
  next();
};

export async function findMembership(clerkId: string): Promise<MemberContext | undefined> {
  const [row] = await db.select({
    membershipId: membershipsTable.id, familyId: membershipsTable.familyId, userId: usersTable.id,
    role: membershipsTable.role, displayName: membershipsTable.displayName,
  }).from(usersTable)
    .innerJoin(membershipsTable, eq(membershipsTable.userId, usersTable.id))
    .where(eq(usersTable.clerkUserId, clerkId));
  return row ? { ...row, role: row.role as Role } : undefined;
}

/**
 * Exige um membro da família com um dos papéis indicados.
 * - viewer: só leitura
 * - guardian: edita regras, aparelhos, crianças e pedidos
 * - owner: tudo, inclusive convites, papéis e exclusão da família
 */
export function requireMember(...roles: Role[]) {
  const allowed = roles.length > 0 ? roles : (["owner", "guardian", "viewer"] as Role[]);
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = clerkUserId(req);
    if (!userId) { fail(res, 401, "Unauthorized"); return; }
    req.userId = userId;
    const member = await findMembership(userId);
    if (!member) { fail(res, 404, "Family not found"); return; }
    if (!allowed.includes(member.role)) { fail(res, 403, "Seu papel na família não permite esta ação", "ROLE_FORBIDDEN"); return; }
    req.member = member;
    next();
  };
}

export const EDITORS: Role[] = ["owner", "guardian"];

/** Autenticação do aparelho da criança por token revogável (nunca pelo id da criança). */
export async function deviceFromRequest(req: Request): Promise<Device | undefined> {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return undefined;
  const token = header.slice(7).trim();
  if (!token) return undefined;
  const [device] = await db.select().from(devicesTable)
    .where(and(eq(devicesTable.deviceTokenHash, sha256(token)), eq(devicesTable.status, "active")));
  if (!device) return undefined;
  await db.update(devicesTable).set({ lastSeenAt: new Date() }).where(eq(devicesTable.id, device.id));
  return device;
}

export const requireDevice = async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
  const device = await deviceFromRequest(req);
  if (!device) { fail(res, 401, "Unauthorized"); return; }
  req.device = device;
  next();
};
