import { Router, type IRouter } from "express";
import { and, asc, eq, gt, isNull, ne } from "drizzle-orm";
import { db, auditEventsTable, childrenTable, deviceAppsTable, devicesTable, pairingCodesTable } from "@workspace/db";
import {
  CreatePairingCodeBody, CreatePairingCodeResponse, ListDeviceAppsParams, ListDeviceAppsResponse, PairDeviceBody,
  PairDeviceResponse, RevokeDeviceParams, UpdateDeviceAppBody, UpdateDeviceAppParams, UpdateDeviceAppResponse,
  UpdateDeviceBody, UpdateDeviceParams, UpdateDeviceResponse,
} from "@workspace/api-zod";
import { EDITORS, fail, requireMember, type AuthedRequest } from "../lib/auth";
import { audit } from "../lib/audit";
import { formatCode, newDeviceToken, newReadableCode, normalizeCode, sha256 } from "../lib/codes";
import { familyPlan, PLAN_LIMITS } from "../lib/limits";
import { notifyDevicesPolicyChanged } from "../lib/push";
import { consumeRateLimit } from "../lib/rateLimit";
import { lockFamily } from "../lib/tx";
import { countFamily, deviceAppView, deviceView } from "../lib/views";

const router: IRouter = Router();
const PAIRING_TTL_MS = 15 * 60 * 1000;

function deviceLimitError(plan: "free" | "premium", max: number) {
  return plan === "free"
    ? { status: 402, message: "O plano gratuito permite 1 aparelho. Assine o Premium para até 10.", code: "DEVICE_LIMIT" }
    : { status: 409, message: `Limite de ${max} aparelhos atingido. Revogue um aparelho antigo para parear outro.`, code: "DEVICE_LIMIT" };
}

router.post("/family/pairing-codes", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const input = CreatePairingCodeBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  const m = req.member!;
  const [child] = await db.select().from(childrenTable)
    .where(and(eq(childrenTable.id, input.data.childId), eq(childrenTable.familyId, m.familyId), isNull(childrenTable.archivedAt)));
  if (!child) { fail(res, 404, "Child not found"); return; }
  const plan = await familyPlan(m.familyId);
  const counts = await countFamily(m.familyId);
  if (counts.devices >= PLAN_LIMITS[plan].maxDevices) {
    const e = deviceLimitError(plan, PLAN_LIMITS[plan].maxDevices);
    fail(res, e.status, e.message, e.code); return;
  }
  const code = newReadableCode(8);
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  await db.insert(pairingCodesTable).values({ familyId: m.familyId, childId: child.id, codeHash: sha256(code), expiresAt });
  await audit(m.familyId, m.userId, "pairing.code_created", `Código de pareamento gerado para ${child.displayName}`);
  res.status(201).json(CreatePairingCodeResponse.parse({ code: formatCode(code), expiresAt }));
});

router.post("/family/devices/pair", async (req, res): Promise<void> => {
  const input = PairDeviceBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  if (!(await consumeRateLimit(`pair:${req.ip ?? "unknown"}`, Number(process.env.RATE_LIMIT_PAIR ?? 10), 10 * 60 * 1000))) {
    fail(res, 429, "Too many pairing attempts"); return;
  }
  const codeHash = sha256(normalizeCode(input.data.code));
  const [pending] = await db.select().from(pairingCodesTable)
    .where(and(eq(pairingCodesTable.codeHash, codeHash), isNull(pairingCodesTable.usedAt), gt(pairingCodesTable.expiresAt, new Date())));
  if (!pending) { fail(res, 400, "Invalid or expired pairing code", "INVALID_CODE"); return; }
  const plan = await familyPlan(pending.familyId);
  const max = PLAN_LIMITS[plan].maxDevices;
  const token = newDeviceToken();
  const result = await db.transaction(async (tx) => {
    await lockFamily(tx, pending.familyId);
    const counts = await countFamily(pending.familyId, tx);
    if (counts.devices >= max) return "limit" as const;
    const [pair] = await tx.update(pairingCodesTable).set({ usedAt: new Date() })
      .where(and(eq(pairingCodesTable.id, pending.id), isNull(pairingCodesTable.usedAt))).returning();
    if (!pair) return undefined;
    const [child] = await tx.select().from(childrenTable).where(and(eq(childrenTable.id, pair.childId), isNull(childrenTable.archivedAt)));
    if (!child) return undefined;
    const [created] = await tx.insert(devicesTable).values({
      familyId: pair.familyId, childId: pair.childId, name: input.data.name, platform: input.data.platform,
      deviceTokenHash: sha256(token), osVersion: input.data.osVersion, model: input.data.model,
      appVersion: input.data.appVersion, timezone: input.data.timezone,
    }).returning();
    await tx.insert(auditEventsTable).values({ familyId: pair.familyId, action: "device.paired", summary: `${input.data.platform === "ios" ? "iPhone/iPad" : "Android"} "${input.data.name}" pareado para ${child.displayName}` });
    return created;
  });
  // Quem pareia é o aparelho da criança: sempre 409 (a oferta de Premium aparece no app do responsável).
  if (result === "limit") { const e = deviceLimitError(plan, max); fail(res, 409, e.message, e.code); return; }
  if (!result) { fail(res, 400, "Invalid or expired pairing code", "INVALID_CODE"); return; }
  res.status(201).json(PairDeviceResponse.parse({ device: deviceView(result), deviceToken: token }));
});

router.patch("/family/devices/:deviceId", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const p = UpdateDeviceParams.safeParse(req.params), input = UpdateDeviceBody.safeParse(req.body);
  if (!p.success || !input.success) { fail(res, 400, "Invalid request"); return; }
  const m = req.member!;
  if (input.data.childId) {
    const [child] = await db.select().from(childrenTable)
      .where(and(eq(childrenTable.id, input.data.childId), eq(childrenTable.familyId, m.familyId), isNull(childrenTable.archivedAt)));
    if (!child) { fail(res, 404, "Child not found"); return; }
  }
  const [device] = await db.update(devicesTable).set(input.data)
    .where(and(eq(devicesTable.id, p.data.deviceId), eq(devicesTable.familyId, m.familyId), ne(devicesTable.status, "revoked"))).returning();
  if (!device) { fail(res, 404, "Device not found"); return; }
  await audit(m.familyId, m.userId, "device.updated", `Aparelho "${device.name}" atualizado`);
  if (input.data.childId) await notifyDevicesPolicyChanged(m.familyId, device.childId);
  res.json(UpdateDeviceResponse.parse(deviceView(device)));
});

router.delete("/family/devices/:deviceId", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const p = RevokeDeviceParams.safeParse(req.params);
  if (!p.success) { fail(res, 400, p.error.message); return; }
  const m = req.member!;
  const [device] = await db.update(devicesTable).set({ status: "revoked", pushToken: null })
    .where(and(eq(devicesTable.id, p.data.deviceId), eq(devicesTable.familyId, m.familyId))).returning();
  if (!device) { fail(res, 404, "Device not found"); return; }
  await audit(m.familyId, m.userId, "device.revoked", `Aparelho "${device.name}" revogado`);
  res.sendStatus(204);
});

async function familyDevice(familyId: string, deviceId: string) {
  const [device] = await db.select().from(devicesTable)
    .where(and(eq(devicesTable.id, deviceId), eq(devicesTable.familyId, familyId), ne(devicesTable.status, "revoked")));
  return device;
}

router.get("/family/devices/:deviceId/apps", requireMember(), async (req: AuthedRequest, res): Promise<void> => {
  const p = ListDeviceAppsParams.safeParse(req.params);
  if (!p.success) { fail(res, 400, p.error.message); return; }
  const device = await familyDevice(req.member!.familyId, p.data.deviceId);
  if (!device) { fail(res, 404, "Device not found"); return; }
  const apps = await db.select().from(deviceAppsTable)
    .where(and(eq(deviceAppsTable.deviceId, device.id), isNull(deviceAppsTable.removedAt)))
    .orderBy(asc(deviceAppsTable.label));
  res.json(ListDeviceAppsResponse.parse(apps.map(deviceAppView)));
});

router.patch("/family/devices/:deviceId/apps/:packageName", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const p = UpdateDeviceAppParams.safeParse(req.params), input = UpdateDeviceAppBody.safeParse(req.body);
  if (!p.success || !input.success) { fail(res, 400, "Invalid request"); return; }
  const m = req.member!;
  const device = await familyDevice(m.familyId, p.data.deviceId);
  if (!device) { fail(res, 404, "Device not found"); return; }
  const [app] = await db.update(deviceAppsTable).set({ status: input.data.status })
    .where(and(eq(deviceAppsTable.deviceId, device.id), eq(deviceAppsTable.packageName, p.data.packageName))).returning();
  if (!app) { fail(res, 404, "App not found"); return; }
  await audit(m.familyId, m.userId, input.data.status === "approved" ? "device_app.approved" : "device_app.blocked",
    `${app.label} ${input.data.status === "approved" ? "liberado" : "bloqueado"} em "${device.name}"`);
  await notifyDevicesPolicyChanged(m.familyId, device.childId);
  res.json(UpdateDeviceAppResponse.parse(deviceAppView(app)));
});

export default router;
