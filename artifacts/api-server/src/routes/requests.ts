import { Router, type IRouter } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, appRulesTable, auditEventsTable, childrenTable, familiesTable, temporaryGrantsTable, timeRequestsTable } from "@workspace/db";
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
    familyId = member?.familyId;
  }
  if (!familyId) { fail(res, 401, "Unauthorized"); return; }
  const childId = device?.childId ?? input.data.childId;
  const [child] = await db.select().from(childrenTable)
    .where(and(eq(childrenTable.id, childId), eq(childrenTable.familyId, familyId), isNull(childrenTable.archivedAt)));
  if (!child) { fail(res, 404, "Child not found"); return; }
  const [rule] = await db.select().from(appRulesTable)
    .where(and(eq(appRulesTable.childId, child.id), eq(appRulesTable.appId, input.data.appId)));
  if (!rule) { fail(res, 404, "Este app não tem regra configurada", "RULE_NOT_FOUND"); return; }
  const [{ pending }] = await db.select({ pending: sql<number>`count(*)::int` }).from(timeRequestsTable)
    .where(and(eq(timeRequestsTable.childId, child.id), eq(timeRequestsTable.status, "pending")));
  if (Number(pending) >= MAX_PENDING_PER_CHILD) { fail(res, 409, "Aguarde a resposta dos pedidos anteriores", "TOO_MANY_PENDING"); return; }
  const [request] = await db.insert(timeRequestsTable).values({
    familyId, childId: child.id, deviceId: device?.id, appId: rule.appId, appName: rule.appName,
    requestedMinutes: input.data.requestedMinutes, message: input.data.message,
  }).returning();
  await db.insert(auditEventsTable).values({ familyId, action: "time_request.created", summary: `${child.displayName} pediu +${request.requestedMinutes} min de ${rule.appName}` });
  await notifyGuardians(familyId, {
    title: `${child.displayName} pediu mais tempo`,
    body: `+${request.requestedMinutes} min de ${rule.appName}${request.message ? `: "${request.message}"` : ""}`,
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
    if (input.data.status === "approved") {
      await tx.insert(temporaryGrantsTable).values({
        familyId: m.familyId, childId: request.childId, appId: request.appId, minutes, validOn: today,
        source: "request", timeRequestId: request.id, createdBy: m.userId,
      });
    }
    await tx.insert(auditEventsTable).values({
      familyId: m.familyId, userId: m.userId, action: "time_request.resolved",
      summary: input.data.status === "approved" ? `+${minutes} min de ${request.appName} liberados hoje` : `Pedido de ${request.appName} negado`,
    });
    return request;
  });
  if (!resolved) { fail(res, 404, "Request not found or already resolved"); return; }
  await notifyDevicesPolicyChanged(m.familyId, resolved.childId);
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, resolved.childId));
  res.json(ResolveTimeRequestResponse.parse(timeRequestView(resolved, child?.displayName ?? "")));
});

export default router;
