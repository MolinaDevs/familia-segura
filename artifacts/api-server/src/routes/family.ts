import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { and, eq, isNull, gt, sql } from "drizzle-orm";
import { createHash, randomInt, randomBytes } from "node:crypto";
import { db, usersTable, familiesTable, membershipsTable, childrenTable, devicesTable, pairingCodesTable, appRulesTable, routinesTable, timeRequestsTable, auditEventsTable, consentsTable } from "@workspace/db";
import { GetFamilyOverviewResponse, CreateFamilyBody, CreateFamilyResponse, CreateChildBody, CreateChildResponse, CreatePairingCodeBody, CreatePairingCodeResponse, PairDeviceBody, PairDeviceResponse, GetChildOverviewResponse, SyncChildUsageBody, SyncChildProtectionBody, RevokeDeviceParams, UpdateAppRuleParams, UpdateAppRuleBody, UpdateAppRuleResponse, UpdateRoutineParams, UpdateRoutineBody, UpdateRoutineResponse, CreateTimeRequestBody, CreateTimeRequestResponse, ResolveTimeRequestParams, ResolveTimeRequestBody, ResolveTimeRequestResponse, ListAuditEventsResponse, ExportFamilyDataResponse } from "@workspace/api-zod";
import { requirePremium, requirePremiumForApproval } from "../middlewares/requirePremium";

type AuthedRequest = Request & { userId?: string };
const router: IRouter = Router();
const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction): void => {
  const userId = getAuth(req).userId ?? (getAuth(req).sessionClaims?.userId as string | undefined);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId; next();
};
const hash = (code: string) => createHash("sha256").update(code).digest("hex");
const deviceToken = () => randomBytes(32).toString("base64url");
const pairingAttempts = new Map<string, { started: number; count: number }>();
const deviceAuth = async (req: Request) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return undefined;
  const token = header.slice(7);
  if (!token) return undefined;
  const [d] = await db.select().from(devicesTable).where(and(eq(devicesTable.deviceTokenHash, hash(token)), eq(devicesTable.status, "active")));
  if (!d) return undefined;
  await db.update(devicesTable).set({ lastSeenAt: new Date() }).where(and(eq(devicesTable.id, d.id), eq(devicesTable.status, "active")));
  return d;
};
const authFamily = async (userId: string) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, userId));
  if (!user) return undefined;
  const [membership] = await db.select().from(membershipsTable).where(eq(membershipsTable.userId, user.id));
  return membership;
};
const audit = (familyId: string, userId: string | undefined, action: string, summary: string) =>
  db.insert(auditEventsTable).values({ familyId, userId, action, summary });
const profile = (c: typeof childrenTable.$inferSelect) => ({ id: c.id, displayName: c.displayName, birthYear: c.birthYear });
const device = (d: typeof devicesTable.$inferSelect) => ({ id: d.id, childId: d.childId, name: d.name, platform: d.platform as "ios" | "android", status: d.status as "active" | "offline" | "revoked", protectionState: d.protectionState as "unknown" | "active" | "partial" | "disabled" | "unavailable", protectionIssues: d.protectionIssues, protectionUpdatedAt: d.protectionUpdatedAt, lastSeenAt: d.lastSeenAt });
const overview = async (familyId: string) => {
  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyId));
  if (!family) return undefined;
  const [members, children, devices, apps, routines, requests, consent] = await Promise.all([
    db.select().from(membershipsTable).where(eq(membershipsTable.familyId, familyId)),
    db.select().from(childrenTable).where(eq(childrenTable.familyId, familyId)),
    db.select().from(devicesTable).where(eq(devicesTable.familyId, familyId)),
    db.select().from(appRulesTable).where(eq(appRulesTable.familyId, familyId)),
    db.select().from(routinesTable).where(eq(routinesTable.familyId, familyId)),
    db.select().from(timeRequestsTable).where(eq(timeRequestsTable.familyId, familyId)),
    db.select().from(consentsTable).where(eq(consentsTable.familyId, familyId)),
  ]);
  return { family, members: members.map((m) => ({ id: m.id, displayName: m.displayName, role: m.role as "owner" | "guardian" })), children: children.map(profile), devices: devices.map(device), apps: apps.map((a) => ({ ...a, status: a.status as "allowed" | "attention" | "blocked" })), routines, timeRequests: requests.map((r) => ({ ...r, childName: children.find((c) => c.id === r.childId)?.displayName ?? "", status: r.status as "pending" | "approved" | "denied" })), privacy: { consentAcceptedAt: consent[0]?.acceptedAt ?? family.createdAt, retentionDays: 365, collectedData: ["family", "members", "children", "devices", "rules", "routines", "requests", "audit"] } };
};

router.get("/family", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const membership = await authFamily(req.userId!);
  if (!membership) { res.status(404).json({ error: "Family not found" }); return; }
  res.json(GetFamilyOverviewResponse.parse(await overview(membership.familyId)));
});
router.post("/family", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const input = CreateFamilyBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: input.error.message }); return; }
  if (!input.data.consentAccepted) { res.status(400).json({ error: "Consent is required" }); return; }
  const existingUser = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.clerkUserId, req.userId!));
  if (existingUser[0]) {
    const existingMembership = await db.select({ id: membershipsTable.id }).from(membershipsTable).where(eq(membershipsTable.userId, existingUser[0].id));
    if (existingMembership[0]) { res.status(409).json({ error: "User already belongs to a family" }); return; }
  }
  const result = await db.transaction(async (tx) => {
    let [user] = await tx.select().from(usersTable).where(eq(usersTable.clerkUserId, req.userId!));
    if (!user) [user] = await tx.insert(usersTable).values({ clerkUserId: req.userId!, displayName: input.data.guardianName }).returning();
    else {
      const [existing] = await tx.select().from(membershipsTable).where(eq(membershipsTable.userId, user.id));
      if (existing) throw new Error("USER_ALREADY_MEMBER");
    }
    const [family] = await tx.insert(familiesTable).values({ name: input.data.name }).returning();
    await tx.insert(membershipsTable).values({ familyId: family.id, userId: user.id, displayName: input.data.guardianName, role: "owner" });
    await tx.insert(consentsTable).values({ familyId: family.id, userId: user.id, consentType: "family" });
    const [child] = await tx.insert(childrenTable).values({ familyId: family.id, displayName: input.data.childName, birthYear: input.data.childBirthYear }).returning();
    await tx.insert(appRulesTable).values({ familyId: family.id, childId: child.id, appId: "youtube", appName: "YouTube", category: "Vídeo", icon: "play", iconColor: "#FF0000" });
    await tx.insert(routinesTable).values({ familyId: family.id, childId: child.id, title: "Hora de dormir", description: "Desconectar e descansar", days: "seg,ter,qua,qui,sex", startTime: "21:00", endTime: "07:00", icon: "moon" });
    return family;
  });
  await audit(result.id, undefined, "family.created", "Família criada com consentimento");
  res.status(201).json(CreateFamilyResponse.parse(await overview(result.id)));
});
router.delete("/family", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const m = await authFamily(req.userId!); if (!m) { res.status(404).json({ error: "Family not found" }); return; }
  if (m.role !== "owner") { res.status(403).json({ error: "Only the family owner can delete the family" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, req.userId!));
  await db.transaction(async (tx) => {
    await tx.delete(familiesTable).where(eq(familiesTable.id, m.familyId));
    if (user) await tx.delete(usersTable).where(eq(usersTable.id, user.id));
  });
  req.log.info({ familyId: m.familyId }, "Family deleted"); res.sendStatus(204);
});
router.post("/family/children", requireAuth, requirePremium, async (req: AuthedRequest, res): Promise<void> => {
  const input = CreateChildBody.safeParse(req.body); const m = await authFamily(req.userId!);
  if (!input.success) { res.status(400).json({ error: input.error.message }); return; } if (!m) { res.status(404).json({ error: "Family not found" }); return; }
  const [child] = await db.insert(childrenTable).values({ ...input.data, familyId: m.familyId }).returning(); await audit(m.familyId, undefined, "child.created", "Perfil da criança criado");
  res.status(201).json(CreateChildResponse.parse(profile(child)));
});
router.post("/family/pairing-codes", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const input = CreatePairingCodeBody.safeParse(req.body); const m = await authFamily(req.userId!);
  if (!input.success) { res.status(400).json({ error: input.error.message }); return; } if (!m) { res.status(404).json({ error: "Family not found" }); return; }
  const [child] = await db.select().from(childrenTable).where(and(eq(childrenTable.id, input.data.childId), eq(childrenTable.familyId, m.familyId)));
  if (!child) { res.status(404).json({ error: "Child not found" }); return; }
  const code = randomInt(100000, 1000000).toString(); const expiresAt = new Date(Date.now() + 600000);
  await db.insert(pairingCodesTable).values({ familyId: m.familyId, childId: child.id, codeHash: hash(code), expiresAt });
  res.status(201).json(CreatePairingCodeResponse.parse({ code, expiresAt }));
});
router.post("/family/devices/pair", async (req, res): Promise<void> => {
  const input = PairDeviceBody.safeParse(req.body); if (!input.success) { res.status(400).json({ error: input.error.message }); return; }
  const ip = req.ip ?? "unknown", now = Date.now(), attempt = pairingAttempts.get(ip);
  if (!attempt || now - attempt.started > 15_000) pairingAttempts.set(ip, { started: now, count: 1 });
  else if (attempt.count >= 5) { res.status(429).json({ error: "Too many pairing attempts" }); return; }
  else attempt.count++;
  const token = deviceToken();
  const result = await db.transaction(async (tx) => {
    const [pair] = await tx.update(pairingCodesTable).set({ usedAt: new Date() }).where(and(eq(pairingCodesTable.codeHash, hash(input.data.code)), isNull(pairingCodesTable.usedAt), gt(pairingCodesTable.expiresAt, new Date()))).returning();
    if (!pair) return undefined;
    const [created] = await tx.insert(devicesTable).values({ familyId: pair.familyId, childId: pair.childId, name: input.data.name, platform: input.data.platform, deviceTokenHash: hash(token) }).returning();
    await tx.insert(auditEventsTable).values({ familyId: pair.familyId, action: "device.paired", summary: "Dispositivo pareado" });
    return created;
  });
  if (!result) { res.status(400).json({ error: "Invalid or expired pairing code" }); return; }
  res.status(201).json(PairDeviceResponse.parse({ device: device(result), deviceToken: token }));
});
router.delete("/family/devices/:deviceId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const p = RevokeDeviceParams.safeParse(req.params); const m = await authFamily(req.userId!); if (!p.success) { res.status(400).json({ error: p.error.message }); return; } if (!m) { res.status(404).json({ error: "Not found" }); return; }
  const [d] = await db.update(devicesTable).set({ status: "revoked" }).where(and(eq(devicesTable.id, p.data.deviceId), eq(devicesTable.familyId, m.familyId))).returning(); if (!d) { res.status(404).json({ error: "Device not found" }); return; } await audit(m.familyId, undefined, "device.revoked", "Dispositivo revogado"); res.sendStatus(204);
});
router.get("/child/overview", async (req, res): Promise<void> => {
  const d = await deviceAuth(req);
  if (!d) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [child] = await db.select().from(childrenTable).where(and(eq(childrenTable.id, d.childId), eq(childrenTable.familyId, d.familyId)));
  if (!child) { res.status(404).json({ error: "Child not found" }); return; }
  const [apps, routines] = await Promise.all([
    db.select().from(appRulesTable).where(and(eq(appRulesTable.childId, child.id), eq(appRulesTable.familyId, d.familyId))),
    db.select().from(routinesTable).where(and(eq(routinesTable.childId, child.id), eq(routinesTable.familyId, d.familyId))),
  ]);
  res.json(GetChildOverviewResponse.parse({ child: profile(child), apps: apps.map((a) => ({ ...a, status: a.status as "allowed" | "attention" | "blocked" })), routines, collectedData: ["app usage", "rules", "routines"] }));
});
router.post("/child/usage", async (req, res): Promise<void> => {
  const input = SyncChildUsageBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: input.error.message }); return; }
  const d = await deviceAuth(req);
  if (!d) { res.status(401).json({ error: "Unauthorized" }); return; }
  await db.transaction(async (tx) => {
    for (const sample of input.data.samples) {
      await tx.update(appRulesTable)
        .set({ usageTodayMinutes: sample.usageTodayMinutes })
        .where(and(
          eq(appRulesTable.familyId, d.familyId),
          eq(appRulesTable.childId, d.childId),
          eq(appRulesTable.appId, sample.appId),
        ));
    }
    await tx.insert(auditEventsTable).values({
      familyId: d.familyId,
      action: "device.usage_synced",
      summary: `Uso permitido pelo sistema sincronizado (${input.data.samples.length} itens)`,
    });
  });
  res.sendStatus(204);
});
router.post("/child/protection", async (req, res): Promise<void> => {
  const input = SyncChildProtectionBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: input.error.message }); return; }
  const d = await deviceAuth(req);
  if (!d) { res.status(401).json({ error: "Unauthorized" }); return; }
  await db.update(devicesTable).set({
    protectionState: input.data.state,
    protectionIssues: input.data.issues,
    protectionUpdatedAt: new Date(),
  }).where(and(eq(devicesTable.id, d.id), eq(devicesTable.status, "active")));
  if (d.protectionState !== input.data.state) {
    await audit(d.familyId, undefined, "device.protection_changed", `Proteção do dispositivo: ${input.data.state}`);
  }
  res.sendStatus(204);
});

router.patch("/family/apps/:appId/rules", requireAuth, requirePremium, async (req: AuthedRequest, res): Promise<void> => {
  const p = UpdateAppRuleParams.safeParse(req.params), input = UpdateAppRuleBody.safeParse(req.body), m = await authFamily(req.userId!); if (!p.success || !input.success) { res.status(400).json({ error: "Invalid request" }); return; } if (!m) { res.status(404).json({ error: "Not found" }); return; }
  const { childId, ...update } = input.data;
  const [a] = await db.update(appRulesTable).set(update).where(and(eq(appRulesTable.appId, p.data.appId), eq(appRulesTable.childId, childId), eq(appRulesTable.familyId, m.familyId))).returning(); if (!a) { res.status(404).json({ error: "Rule not found" }); return; } res.json(UpdateAppRuleResponse.parse({ ...a, status: a.status as "allowed" | "attention" | "blocked" }));
});
router.patch("/family/routines/:routineId", requireAuth, requirePremium, async (req: AuthedRequest, res): Promise<void> => {
  const p = UpdateRoutineParams.safeParse(req.params), input = UpdateRoutineBody.safeParse(req.body), m = await authFamily(req.userId!); if (!p.success || !input.success) { res.status(400).json({ error: "Invalid request" }); return; } if (!m) { res.status(404).json({ error: "Not found" }); return; }
  const [r] = await db.update(routinesTable).set(input.data).where(and(eq(routinesTable.id, p.data.routineId), eq(routinesTable.familyId, m.familyId))).returning(); if (!r) { res.status(404).json({ error: "Routine not found" }); return; } res.json(UpdateRoutineResponse.parse(r));
});
router.post("/family/time-requests", async (req: AuthedRequest, res): Promise<void> => {
  const input = CreateTimeRequestBody.safeParse(req.body); if (!input.success) { res.status(400).json({ error: input.error.message }); return; }
  const d = await deviceAuth(req);
  let m = d ? { familyId: d.familyId } : undefined;
  if (!d) {
    const clerkUser = getAuth(req).userId ?? (getAuth(req).sessionClaims?.userId as string | undefined);
    if (clerkUser) m = await authFamily(clerkUser);
  }
  if (!m) { res.status(401).json({ error: "Unauthorized" }); return; }
  const childId = d?.childId ?? input.data.childId;
  const [child] = await db.select().from(childrenTable).where(and(eq(childrenTable.id, childId), eq(childrenTable.familyId, m.familyId))); if (!child) { res.status(404).json({ error: "Child not found" }); return; }
  const [r] = await db.insert(timeRequestsTable).values({ ...input.data, childId, familyId: m.familyId, appName: input.data.appId }).returning(); await audit(m.familyId, undefined, "time_request.created", "Solicitação de tempo criada"); res.status(201).json(CreateTimeRequestResponse.parse({ ...r, childName: child.displayName, status: r.status as "pending" | "approved" | "denied" }));
});
router.patch("/family/time-requests/:requestId", requireAuth, requirePremiumForApproval, async (req: AuthedRequest, res): Promise<void> => {
  const p = ResolveTimeRequestParams.safeParse(req.params), input = ResolveTimeRequestBody.safeParse(req.body), m = await authFamily(req.userId!); if (!p.success || !input.success) { res.status(400).json({ error: "Invalid request" }); return; } if (!m) { res.status(404).json({ error: "Not found" }); return; }
  const r = await db.transaction(async (tx) => {
    const [request] = await tx.update(timeRequestsTable)
      .set(input.data)
      .where(and(eq(timeRequestsTable.id, p.data.requestId), eq(timeRequestsTable.familyId, m.familyId), eq(timeRequestsTable.status, "pending")))
      .returning();
    if (!request) return undefined;
    if (input.data.status === "approved") {
      await tx.update(appRulesTable)
        .set({
          dailyLimitMinutes: sql`least(1440, ${appRulesTable.dailyLimitMinutes} + ${request.requestedMinutes})`,
          status: "allowed",
        })
        .where(and(
          eq(appRulesTable.familyId, m.familyId),
          eq(appRulesTable.childId, request.childId),
          eq(appRulesTable.appId, request.appId),
        ));
    }
    await tx.insert(auditEventsTable).values({ familyId: m.familyId, action: "time_request.resolved", summary: input.data.status === "approved" ? "Tempo adicional aplicado" : "Solicitação de tempo negada" });
    return request;
  });
  if (!r) { res.status(404).json({ error: "Request not found or already resolved" }); return; }
  const [c] = await db.select().from(childrenTable).where(eq(childrenTable.id, r.childId)); res.json(ResolveTimeRequestResponse.parse({ ...r, childName: c?.displayName ?? "", status: r.status as "pending" | "approved" | "denied" }));
});
router.get("/family/audit", requireAuth, async (req: AuthedRequest, res): Promise<void> => { const m = await authFamily(req.userId!); if (!m) { res.status(404).json({ error: "Not found" }); return; } const rows = await db.select().from(auditEventsTable).where(eq(auditEventsTable.familyId, m.familyId)); res.json(ListAuditEventsResponse.parse(rows)); });
router.get("/family/export", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const m = await authFamily(req.userId!);
  if (!m) { res.status(404).json({ error: "Not found" }); return; }
  const auditEvents = await db.select().from(auditEventsTable).where(eq(auditEventsTable.familyId, m.familyId));
  res.json(ExportFamilyDataResponse.parse({ exportedAt: new Date(), data: await overview(m.familyId), auditEvents }));
});
export default router;