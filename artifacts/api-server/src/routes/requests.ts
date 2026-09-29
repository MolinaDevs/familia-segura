import { Router, type IRouter } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, appRulesTable, auditEventsTable, childrenTable, devicesTable, familiesTable, temporaryGrantsTable, timeRequestsTable } from "@workspace/db";
import {
  CreateTimeRequestBody, CreateTimeRequestResponse, ResolveTimeRequestBody, ResolveTimeRequestParams, ResolveTimeRequestResponse,
} from "@workspace/api-zod";
import { clerkUserId, deviceFromRequest, EDITORS, fail, findMembership, requireMember, type AuthedRequest } from "../lib/auth";
import { notifyDevicesPolicyChanged, notifyGuardians } from "../lib/push";
import { localDate } from "../lib/time";
import { timeRequestView } from "../lib/views";

const router: IRouter = Router();
const MAX_PENDING_PER_CHILD = 10;

/** Pedido de tempo: normalmente feito pelo aparelho da criança (token do aparelho). */
router.post("/family/time-requests", async (req: AuthedRequest, res): Promise<void> => {
  const input = CreateTimeRequestBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  const device = await deviceFromRequest(req);
  let familyId = device?.familyId;
  if (!device) {
    const clerkId = clerkUserId(req);
    const member = clerkId ? await findMembership(clerkId) : undefined;
    if (member?.role === "viewer") { fail(res, 403, "Observadores não criam pedidos", "ROLE_FORBIDDEN"); return; }
    familyId = member?.familyId;
  }
  if (!familyId) { fail(res, 401, "Unauthorized"); return; }
  const childId = device?.childId ?? input.data.childId;
  const [child] = await db.select().from(childrenTable)
    .where(and(eq(childrenTable.id, childId), eq(childrenTable.familyId, familyId), isNull(childrenTable.archivedAt)));
  if (!child) { fail(res, 404, "Child not found"); return; }
  const kind = input.data.kind ?? "time";
  // Pedido de instalação: vem do aparelho (é ele que será liberado); o app pedido ainda não tem regra.
  if (kind === "install" && !device) { fail(res, 400, "Pedido de instalação só pelo aparelho da criança", "DEVICE_REQUIRED"); return; }
  const [rule] = kind === "time"
    ? await db.select().from(appRulesTable).where(and(eq(appRulesTable.childId, child.id), eq(appRulesTable.appId, input.data.appId)))
    : [undefined];
  if (kind === "time" && !rule) { fail(res, 404, "Este app não tem regra configurada", "RULE_NOT_FOUND"); return; }
  const appName = rule?.appName ?? input.data.appId.trim().slice(0, 80);
  const [{ pending }] = await db.select({ pending: sql<number>`count(*)::int` }).from(timeRequestsTable)
    .where(and(eq(timeRequestsTable.childId, child.id), eq(timeRequestsTable.status, "pending")));
  if (Number(pending) >= MAX_PENDING_PER_CHILD) { fail(res, 409, "Aguarde a resposta dos pedidos anteriores", "TOO_MANY_PENDING"); return; }
  const [request] = await db.insert(timeRequestsTable).values({
    familyId, childId: child.id, deviceId: device?.id, kind, appId: rule?.appId ?? "install", appName,
    requestedMinutes: kind === "install" ? Math.min(60, input.data.requestedMinutes) : input.data.requestedMinutes, message: input.data.message,
  }).returning();
  await db.insert(auditEventsTable).values({
    familyId, action: "time_request.created",
    summary: kind === "install" ? `${child.displayName} pediu para instalar ${appName}` : `${child.displayName} pediu +${request.requestedMinutes} min de ${appName}`,
  });
  await notifyGuardians(familyId, {
    title: kind === "install" ? `${child.displayName} quer instalar um app` : `${child.displayName} pediu mais tempo`,
    body: kind === "install"
      ? `${appName}${request.message ? `: "${request.message}"` : ""}`
      : `+${request.requestedMinutes} min de ${appName}${request.message ? `: "${request.message}"` : ""}`,
    data: { type: "time_request", requestId: request.id },
  });
  res.status(201).json(CreateTimeRequestResponse.parse(timeRequestView(request, child.displayName)));
});

/** Aprovar cria uma liberação válida só hoje; o limite diário não muda. */
router.patch("/family/time-requests/:requestId", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const p = ResolveTimeRequestParams.safeParse(req.params), input = ResolveTimeRequestBody.safeParse(req.body);
  if (!p.success || !input.success) { fail(res, 400, "Invalid request"); return; }
  const m = req.member!;
  const [family] = await db.select({ timezone: familiesTable.timezone }).from(familiesTable).where(eq(familiesTable.id, m.familyId));
  const today = localDate(family?.timezone ?? "America/Sao_Paulo");
  const resolved = await db.transaction(async (tx) => {
    const [request] = await tx.update(timeRequestsTable)
      .set({ status: input.data.status, resolvedBy: m.userId, resolvedAt: new Date() })
      .where(and(eq(timeRequestsTable.id, p.data.requestId), eq(timeRequestsTable.familyId, m.familyId), eq(timeRequestsTable.status, "pending")))
      .returning();
    if (!request) return undefined;
    const minutes = input.data.grantedMinutes ?? request.requestedMinutes;
    if (input.data.status === "approved" && request.kind === "install") {
      // Aprovar pedido de instalação = liberar a instalação no aparelho que pediu.
      if (request.deviceId) {
        await tx.update(devicesTable).set({ installUnlockUntil: new Date(Date.now() + Math.min(60, minutes) * 60_000) })
          .where(and(eq(devicesTable.id, request.deviceId), eq(devicesTable.familyId, m.familyId)));
      }
    } else if (input.data.status === "approved") {
      await tx.insert(temporaryGrantsTable).values({
        familyId: m.familyId, childId: request.childId, appId: request.appId, minutes, validOn: today,
        source: "request", timeRequestId: request.id, createdBy: m.userId,
      });
    }
    await tx.insert(auditEventsTable).values({
      familyId: m.familyId, userId: m.userId, action: "time_request.resolved",
      summary: input.data.status !== "approved" ? `Pedido de ${request.appName} negado`
        : request.kind === "install" ? `Instalação liberada por ${Math.min(60, minutes)} min para ${request.appName}` : `+${minutes} min de ${request.appName} liberados hoje`,
    });
    return request;
  });
  if (!resolved) { fail(res, 404, "Request not found or already resolved"); return; }
  await notifyDevicesPolicyChanged(m.familyId, resolved.childId);
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, resolved.childId));
  res.json(ResolveTimeRequestResponse.parse(timeRequestView(resolved, child?.displayName ?? "")));
});

export default router;
