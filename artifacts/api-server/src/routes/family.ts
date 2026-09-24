import { Router, type IRouter } from "express";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import {
  db, appRulesTable, auditEventsTable, childrenTable, consentsTable, devicesTable, familiesTable, invitesTable,
  membershipsTable, pushTokensTable, routinesTable, usersTable,
} from "@workspace/db";
import {
  AcceptInviteBody, AcceptInviteResponse, ArchiveChildParams, CreateChildBody, CreateChildResponse, CreateFamilyBody,
  CreateFamilyResponse, CreateInviteBody, CreateInviteResponse, ExportFamilyDataResponse, GetFamilyOverviewResponse,
  ListAuditEventsResponse, RegisterGuardianPushTokenBody, RemoveMemberParams, SetGuardianPinBody, UpdateChildBody,
  UpdateChildParams, UpdateChildResponse, UpdateFamilySettingsBody, UpdateFamilySettingsResponse, UpdateMemberBody,
  UpdateMemberParams, UpdateMemberResponse,
} from "@workspace/api-zod";
import { EDITORS, fail, findMembership, requireAuth, requireMember, type AuthedRequest } from "../lib/auth";
import { audit } from "../lib/audit";
import { hashPin, newReadableCode, normalizeCode, sha256 } from "../lib/codes";
import { familyPlan, PLAN_LIMITS } from "../lib/limits";
import { consumeRateLimit } from "../lib/rateLimit";
import { lockFamily } from "../lib/tx";
import { isValidTimezone } from "../lib/time";
import { notifyDevicesPolicyChanged } from "../lib/push";
import { childView, countFamily, familyOverview, settingsView } from "../lib/views";

const router: IRouter = Router();
const CHILD_COLORS = ["#2A5A4A", "#D97736", "#3B6FB6", "#B04A7A", "#7A5AB5", "#2F8F9D", "#C0892B", "#5B7F2B", "#A8443C", "#4A5568"];
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

router.get("/family", requireMember(), async (req: AuthedRequest, res): Promise<void> => {
  res.json(GetFamilyOverviewResponse.parse(await familyOverview(req.member!.familyId, req.member!.userId)));
});

router.post("/family", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const input = CreateFamilyBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  if (!input.data.consentAccepted) { fail(res, 400, "Consent is required", "CONSENT_REQUIRED"); return; }
  if (input.data.timezone && !isValidTimezone(input.data.timezone)) { fail(res, 400, "Invalid timezone"); return; }
  if (await findMembership(req.userId!)) { fail(res, 409, "User already belongs to a family", "ALREADY_MEMBER"); return; }
  const family = await db.transaction(async (tx) => {
    let [user] = await tx.select().from(usersTable).where(eq(usersTable.clerkUserId, req.userId!));
    if (!user) [user] = await tx.insert(usersTable).values({ clerkUserId: req.userId!, displayName: input.data.guardianName }).returning();
    const [created] = await tx.insert(familiesTable).values({ name: input.data.name, ...(input.data.timezone ? { timezone: input.data.timezone } : {}) }).returning();
    await tx.insert(membershipsTable).values({ familyId: created.id, userId: user.id, displayName: input.data.guardianName, role: "owner" });
    await tx.insert(consentsTable).values({ familyId: created.id, userId: user.id, consentType: "family" });
    const [child] = await tx.insert(childrenTable).values({ familyId: created.id, displayName: input.data.childName, birthYear: input.data.childBirthYear, color: CHILD_COLORS[0] }).returning();
    await tx.insert(appRulesTable).values({ familyId: created.id, childId: child.id, appId: "youtube", appName: "YouTube", category: "Vídeo", icon: "youtube", iconColor: "#FF0000", androidPackages: ["com.google.android.youtube"] });
    await tx.insert(routinesTable).values({ familyId: created.id, childId: child.id, title: "Hora de dormir", description: "Desconectar e descansar", days: "dom,seg,ter,qua,qui", startTime: "21:00", endTime: "07:00", icon: "moon" });
    await tx.insert(auditEventsTable).values({ familyId: created.id, userId: user.id, action: "family.created", summary: "Família criada com consentimento" });
    return { family: created, userId: user.id };
  });
  res.status(201).json(CreateFamilyResponse.parse(await familyOverview(family.family.id, family.userId)));
});

router.delete("/family", requireMember("owner"), async (req: AuthedRequest, res): Promise<void> => {
  const m = req.member!;
  await db.transaction(async (tx) => {
    await tx.delete(familiesTable).where(eq(familiesTable.id, m.familyId));
    await tx.delete(usersTable).where(eq(usersTable.id, m.userId));
  });
  req.log.info({ familyId: m.familyId }, "Family deleted");
  res.sendStatus(204);
});

router.patch("/family/settings", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const input = UpdateFamilySettingsBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  if (input.data.timezone && !isValidTimezone(input.data.timezone)) { fail(res, 400, "Invalid timezone"); return; }
  const [family] = await db.update(familiesTable).set(input.data).where(eq(familiesTable.id, req.member!.familyId)).returning();
  await audit(family.id, req.member!.userId, "family.settings_updated", "Configurações da família alteradas", input.data);
  await notifyDevicesPolicyChanged(family.id);
  res.json(UpdateFamilySettingsResponse.parse(settingsView(family)));
});

router.put("/family/guardian-pin", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const input = SetGuardianPinBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, "O PIN deve ter de 4 a 8 números"); return; }
  if (/^(\d)\1+$/.test(input.data.pin) || "0123456789".includes(input.data.pin) || "9876543210".includes(input.data.pin)) {
    fail(res, 400, "Escolha um PIN menos previsível", "WEAK_PIN"); return;
  }
  const { salt, hash } = await hashPin(input.data.pin);
  await db.update(familiesTable).set({ guardianPinHash: hash, guardianPinSalt: salt, guardianPinUpdatedAt: new Date() })
    .where(eq(familiesTable.id, req.member!.familyId));
  await audit(req.member!.familyId, req.member!.userId, "family.pin_updated", "PIN do responsável alterado");
  await notifyDevicesPolicyChanged(req.member!.familyId);
  res.sendStatus(204);
});

router.post("/family/children", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const input = CreateChildBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  const m = req.member!;
  const plan = await familyPlan(m.familyId);
  const result = await db.transaction(async (tx) => {
    await lockFamily(tx, m.familyId);
    const counts = await countFamily(m.familyId, tx);
    const max = PLAN_LIMITS[plan].maxChildren;
    if (counts.children >= max) return { limit: max } as const;
    const [child] = await tx.insert(childrenTable).values({
      familyId: m.familyId, displayName: input.data.displayName, birthYear: input.data.birthYear,
      color: input.data.color ?? CHILD_COLORS[counts.children % CHILD_COLORS.length],
    }).returning();
    await tx.insert(auditEventsTable).values({ familyId: m.familyId, userId: m.userId, action: "child.created", summary: `Perfil de ${child.displayName} criado` });
    return { child } as const;
  });
  if ("limit" in result) {
    const premiumWouldHelp = plan === "free";
    fail(res, premiumWouldHelp ? 402 : 409, premiumWouldHelp ? "O plano gratuito permite 1 criança. Assine o Premium para até 10." : `Limite de ${result.limit} crianças atingido`, "CHILD_LIMIT");
    return;
  }
  res.status(201).json(CreateChildResponse.parse(childView(result.child)));
});

router.patch("/family/children/:childId", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const p = UpdateChildParams.safeParse(req.params), input = UpdateChildBody.safeParse(req.body);
  if (!p.success || !input.success) { fail(res, 400, "Invalid request"); return; }
  const [child] = await db.update(childrenTable).set(input.data)
    .where(and(eq(childrenTable.id, p.data.childId), eq(childrenTable.familyId, req.member!.familyId), isNull(childrenTable.archivedAt))).returning();
  if (!child) { fail(res, 404, "Child not found"); return; }
  await audit(child.familyId, req.member!.userId, "child.updated", `Perfil de ${child.displayName} atualizado`);
  res.json(UpdateChildResponse.parse(childView(child)));
});

router.delete("/family/children/:childId", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const p = ArchiveChildParams.safeParse(req.params);
  if (!p.success) { fail(res, 400, "Invalid request"); return; }
  const m = req.member!;
  const archived = await db.transaction(async (tx) => {
    const [child] = await tx.update(childrenTable).set({ archivedAt: new Date() })
      .where(and(eq(childrenTable.id, p.data.childId), eq(childrenTable.familyId, m.familyId), isNull(childrenTable.archivedAt))).returning();
    if (!child) return undefined;
    await tx.update(devicesTable).set({ status: "revoked" }).where(and(eq(devicesTable.childId, child.id), eq(devicesTable.familyId, m.familyId)));
    await tx.insert(auditEventsTable).values({ familyId: m.familyId, userId: m.userId, action: "child.archived", summary: `Perfil de ${child.displayName} arquivado e aparelhos revogados` });
    return child;
  });
  if (!archived) { fail(res, 404, "Child not found"); return; }
  res.sendStatus(204);
});

router.post("/family/invites", requireMember("owner"), async (req: AuthedRequest, res): Promise<void> => {
  const input = CreateInviteBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  const m = req.member!;
  const plan = await familyPlan(m.familyId);
  const counts = await countFamily(m.familyId);
  const max = PLAN_LIMITS[plan].maxGuardians;
  if (counts.guardians >= max) {
    fail(res, plan === "free" ? 402 : 409, plan === "free" ? "Convidar outros responsáveis é um recurso Premium" : `Limite de ${max} responsáveis atingido`, "GUARDIAN_LIMIT");
    return;
  }
  const code = newReadableCode(10);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await db.insert(invitesTable).values({ familyId: m.familyId, codeHash: sha256(code), role: input.data.role, createdBy: m.userId, expiresAt });
  await audit(m.familyId, m.userId, "invite.created", `Convite criado (${input.data.role === "guardian" ? "co-responsável" : "observador"})`);
  res.status(201).json(CreateInviteResponse.parse({ code, role: input.data.role, expiresAt }));
});

router.post("/family/invites/accept", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const input = AcceptInviteBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  if (!input.data.consentAccepted) { fail(res, 400, "Consent is required", "CONSENT_REQUIRED"); return; }
  if (!(await consumeRateLimit(`invite:${req.userId}`, 10, 15 * 60 * 1000))) { fail(res, 429, "Muitas tentativas. Aguarde alguns minutos."); return; }
  if (await findMembership(req.userId!)) { fail(res, 409, "Você já participa de uma família", "ALREADY_MEMBER"); return; }
  const codeHash = sha256(normalizeCode(input.data.code));
  const [invite] = await db.select().from(invitesTable)
    .where(and(eq(invitesTable.codeHash, codeHash), isNull(invitesTable.usedAt), gt(invitesTable.expiresAt, new Date())));
  if (!invite) { fail(res, 400, "Convite inválido ou expirado", "INVALID_INVITE"); return; }
  const plan = await familyPlan(invite.familyId);
  const result = await db.transaction(async (tx) => {
    await lockFamily(tx, invite.familyId);
    const counts = await countFamily(invite.familyId, tx);
    if (counts.guardians >= PLAN_LIMITS[plan].maxGuardians) return "limit" as const;
    const [claimed] = await tx.update(invitesTable).set({ usedAt: new Date() })
      .where(and(eq(invitesTable.id, invite.id), isNull(invitesTable.usedAt))).returning();
    if (!claimed) return "used" as const;
    let [user] = await tx.select().from(usersTable).where(eq(usersTable.clerkUserId, req.userId!));
    if (!user) [user] = await tx.insert(usersTable).values({ clerkUserId: req.userId!, displayName: input.data.displayName }).returning();
    await tx.update(invitesTable).set({ usedBy: user.id }).where(eq(invitesTable.id, invite.id));
    await tx.insert(membershipsTable).values({ familyId: invite.familyId, userId: user.id, displayName: input.data.displayName, role: invite.role, invitedBy: invite.createdBy });
    await tx.insert(consentsTable).values({ familyId: invite.familyId, userId: user.id, consentType: "guardian_invite" });
    await tx.insert(auditEventsTable).values({ familyId: invite.familyId, userId: user.id, action: "member.joined", summary: `${input.data.displayName} entrou na família` });
    return user;
  });
  if (result === "limit") { fail(res, 409, "A família atingiu o limite de responsáveis", "GUARDIAN_LIMIT"); return; }
  if (result === "used") { fail(res, 400, "Convite inválido ou expirado", "INVALID_INVITE"); return; }
  res.json(AcceptInviteResponse.parse(await familyOverview(invite.familyId, result.id)));
});

router.patch("/family/members/:memberId", requireMember("owner"), async (req: AuthedRequest, res): Promise<void> => {
  const p = UpdateMemberParams.safeParse(req.params), input = UpdateMemberBody.safeParse(req.body);
  if (!p.success || !input.success) { fail(res, 400, "Invalid request"); return; }
  const m = req.member!;
  const [target] = await db.select().from(membershipsTable).where(and(eq(membershipsTable.id, p.data.memberId), eq(membershipsTable.familyId, m.familyId)));
  if (!target) { fail(res, 404, "Member not found"); return; }
  if (target.role === "owner") { fail(res, 403, "O papel do titular não pode ser alterado", "OWNER_IMMUTABLE"); return; }
  const [updated] = await db.update(membershipsTable).set({ role: input.data.role }).where(eq(membershipsTable.id, target.id)).returning();
  await audit(m.familyId, m.userId, "member.role_changed", `${updated.displayName} agora é ${input.data.role === "guardian" ? "co-responsável" : "observador"}`);
  res.json(UpdateMemberResponse.parse({ id: updated.id, displayName: updated.displayName, role: updated.role, isCurrentUser: updated.userId === m.userId }));
});

router.delete("/family/members/:memberId", requireMember(), async (req: AuthedRequest, res): Promise<void> => {
  const p = RemoveMemberParams.safeParse(req.params);
  if (!p.success) { fail(res, 400, "Invalid request"); return; }
  const m = req.member!;
  const [target] = await db.select().from(membershipsTable).where(and(eq(membershipsTable.id, p.data.memberId), eq(membershipsTable.familyId, m.familyId)));
  if (!target) { fail(res, 404, "Member not found"); return; }
  const leavingSelf = target.userId === m.userId;
  if (target.role === "owner") { fail(res, 403, "O titular não pode sair; exclua a família ou transfira a titularidade pelo suporte", "OWNER_IMMUTABLE"); return; }
  if (!leavingSelf && m.role !== "owner") { fail(res, 403, "Somente o titular remove responsáveis", "ROLE_FORBIDDEN"); return; }
  await db.delete(membershipsTable).where(eq(membershipsTable.id, target.id));
  await db.delete(pushTokensTable).where(eq(pushTokensTable.userId, target.userId));
  await audit(m.familyId, m.userId, "member.removed", leavingSelf ? `${target.displayName} saiu da família` : `${target.displayName} foi removido da família`);
  res.sendStatus(204);
});

router.post("/family/push-tokens", requireMember(), async (req: AuthedRequest, res): Promise<void> => {
  const input = RegisterGuardianPushTokenBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  await db.insert(pushTokensTable).values({ userId: req.member!.userId, token: input.data.token, platform: input.data.platform })
    .onConflictDoUpdate({ target: pushTokensTable.token, set: { userId: req.member!.userId, platform: input.data.platform } });
  res.sendStatus(204);
});

async function auditRows(familyId: string) {
  const rows = await db.select({
    id: auditEventsTable.id, action: auditEventsTable.action, summary: auditEventsTable.summary, createdAt: auditEventsTable.createdAt,
    actorName: membershipsTable.displayName,
  }).from(auditEventsTable)
    .leftJoin(membershipsTable, and(eq(membershipsTable.userId, auditEventsTable.userId), eq(membershipsTable.familyId, auditEventsTable.familyId)))
    .where(eq(auditEventsTable.familyId, familyId))
    .orderBy(desc(auditEventsTable.createdAt))
    .limit(500);
  return rows;
}

router.get("/family/audit", requireMember(), async (req: AuthedRequest, res): Promise<void> => {
  res.json(ListAuditEventsResponse.parse(await auditRows(req.member!.familyId)));
});

router.get("/family/export", requireMember("owner", "guardian"), async (req: AuthedRequest, res): Promise<void> => {
  const m = req.member!;
  res.json(ExportFamilyDataResponse.parse({ exportedAt: new Date(), data: await familyOverview(m.familyId, m.userId), auditEvents: await auditRows(m.familyId) }));
});

export default router;
