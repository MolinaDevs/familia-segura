import { Router, type IRouter } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db, appRulesTable, auditEventsTable, childrenTable, deviceAppsTable, deviceEventsTable, deviceRuleBindingsTable,
  devicesTable, familiesTable, usageDailyTable, usageHourlyTable,
} from "@workspace/db";
import {
  GetChildOverviewResponse, RegisterDevicePushTokenBody, ReportDeviceEventsBody, SyncChildProtectionBody,
  SyncChildUsageBody, SyncInstalledAppsBody, SyncInstalledAppsResponse, VerifyGuardianPinBody, VerifyGuardianPinResponse,
} from "@workspace/api-zod";
import { fail, requireDevice, type AuthedRequest } from "../lib/auth";
import { verifyPin } from "../lib/codes";
import { notifyGuardians } from "../lib/push";
import { consumeRateLimit } from "../lib/rateLimit";
import { addDays, localDate, localHour } from "../lib/time";
import { childOverview } from "../lib/views";

const router: IRouter = Router();

/** Eventos que indicam adulteração: o responsável recebe push na hora. */
const ALERT_EVENTS: Record<string, string> = {
  protection_disabled: "A proteção foi desativada",
  tamper_attempt: "Tentativa de mexer nas configurações de proteção",
  uninstall_attempt: "Tentativa de desinstalar o Família Segura",
  pin_failed: "PIN do responsável digitado errado várias vezes",
};

async function deviceContext(deviceId: string) {
  const [row] = await db.select({ childName: childrenTable.displayName, timezone: familiesTable.timezone, quarantine: familiesTable.quarantineNewApps })
    .from(devicesTable)
    .innerJoin(childrenTable, eq(childrenTable.id, devicesTable.childId))
    .innerJoin(familiesTable, eq(familiesTable.id, devicesTable.familyId))
    .where(eq(devicesTable.id, deviceId));
  return row;
}

router.get("/child/overview", requireDevice, async (req: AuthedRequest, res): Promise<void> => {
  const overview = await childOverview(req.device!);
  if (!overview) { fail(res, 404, "Child not found"); return; }
  res.json(GetChildOverviewResponse.parse(overview));
});

/**
 * Recebe o uso acumulado de hoje por app. Guardamos o maior valor do dia (usage_daily)
 * e somamos o incremento na hora local informada (usage_hourly) para o mapa de calor.
 */
router.post("/child/usage", requireDevice, async (req: AuthedRequest, res): Promise<void> => {
  const input = SyncChildUsageBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  const device = req.device!;
  const ctx = await deviceContext(device.id);
  const zone = device.timezone ?? ctx?.timezone ?? "America/Sao_Paulo";
  const serverDay = localDate(zone);
  const day = input.data.localDate && input.data.localDate >= addDays(serverDay, -1) && input.data.localDate <= addDays(serverDay, 1)
    ? input.data.localDate : serverDay;
  const hour = input.data.localHour ?? localHour(zone);
  const precision = input.data.precision ?? (device.platform === "ios" ? "estimated" : "exact");
  const samples = new Map<string, number>();
  for (const s of input.data.samples) samples.set(s.appId, Math.max(samples.get(s.appId) ?? 0, s.usageTodayMinutes));
  if (samples.size === 0) { res.sendStatus(204); return; }

  await db.transaction(async (tx) => {
    const existing = await tx.select({ appId: usageDailyTable.appId, minutes: usageDailyTable.minutes }).from(usageDailyTable)
      .where(and(eq(usageDailyTable.deviceId, device.id), eq(usageDailyTable.day, day), inArray(usageDailyTable.appId, [...samples.keys()])));
    const previous = new Map(existing.map((row) => [row.appId, row.minutes]));
    for (const [appId, minutes] of samples) {
      const delta = minutes - (previous.get(appId) ?? 0);
      if (delta <= 0 && previous.has(appId)) continue;
      await tx.insert(usageDailyTable).values({ familyId: device.familyId, childId: device.childId, deviceId: device.id, appId, day, minutes, precision })
        .onConflictDoUpdate({
          target: [usageDailyTable.deviceId, usageDailyTable.appId, usageDailyTable.day],
          set: { minutes: sql`greatest(${usageDailyTable.minutes}, excluded.minutes)`, precision, updatedAt: new Date() },
        });
      if (delta > 0) {
        await tx.insert(usageHourlyTable).values({ familyId: device.familyId, childId: device.childId, deviceId: device.id, appId, day, hour, minutes: delta })
          .onConflictDoUpdate({
            target: [usageHourlyTable.deviceId, usageHourlyTable.appId, usageHourlyTable.day, usageHourlyTable.hour],
            set: { minutes: sql`${usageHourlyTable.minutes} + excluded.minutes` },
          });
      }
    }
  });
  res.sendStatus(204);
});

router.post("/child/protection", requireDevice, async (req: AuthedRequest, res): Promise<void> => {
  const input = SyncChildProtectionBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  const device = req.device!;
  const { state, issues, boundRuleIds, ...details } = input.data;
  await db.update(devicesTable).set({ protectionState: state, protectionIssues: issues, protectionUpdatedAt: new Date(), ...details })
    .where(and(eq(devicesTable.id, device.id), eq(devicesTable.status, "active")));

  if (boundRuleIds) {
    const validRules = boundRuleIds.length === 0 ? [] : await db.select({ id: appRulesTable.id }).from(appRulesTable)
      .where(and(eq(appRulesTable.childId, device.childId), inArray(appRulesTable.id, boundRuleIds)));
    await db.transaction(async (tx) => {
      await tx.delete(deviceRuleBindingsTable).where(eq(deviceRuleBindingsTable.deviceId, device.id));
      if (validRules.length > 0) await tx.insert(deviceRuleBindingsTable).values(validRules.map((r) => ({ deviceId: device.id, ruleId: r.id })));
    });
  }

  if (device.protectionState !== state) {
    await db.insert(auditEventsTable).values({ familyId: device.familyId, action: "device.protection_changed", summary: `Proteção de "${device.name}": ${state}` });
    const downgraded = device.protectionState === "active" && (state === "disabled" || state === "partial");
    await db.insert(deviceEventsTable).values({
      familyId: device.familyId, deviceId: device.id, childId: device.childId,
      type: state === "active" ? "protection_enabled" : "protection_disabled", detail: issues.join("; ").slice(0, 240) || state,
    });
    if (downgraded) {
      const ctx = await deviceContext(device.id);
      await notifyGuardians(device.familyId, {
        title: `Proteção ${state === "disabled" ? "desativada" : "incompleta"} no aparelho de ${ctx?.childName ?? "sua criança"}`,
        body: issues.length > 0 ? issues.join(", ") : `Verifique o aparelho "${device.name}".`,
        data: { type: "protection", deviceId: device.id },
      });
    }
  }
  res.sendStatus(204);
});

/**
 * Inventário de apps do Android. Primeira sincronização = tudo aprovado.
 * Depois, com a quarentena ativa, app novo fica "pendente" (bloqueado) até o responsável decidir.
 */
router.post("/child/installed-apps", requireDevice, async (req: AuthedRequest, res): Promise<void> => {
  const input = SyncInstalledAppsBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  const device = req.device!;
  const ctx = await deviceContext(device.id);
  const now = new Date();
  const newlyPending: string[] = [];

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(deviceAppsTable).where(eq(deviceAppsTable.deviceId, device.id));
    const initialInventory = existing.length === 0;
    const byPackage = new Map(existing.map((app) => [app.packageName, app]));
    const reported = new Set<string>();

    for (const app of input.data.apps) {
      if (reported.has(app.packageName)) continue;
      reported.add(app.packageName);
      const known = byPackage.get(app.packageName);
      const quarantine = !initialInventory && Boolean(ctx?.quarantine);
      if (!known) {
        const status = quarantine ? "pending" : "approved";
        await tx.insert(deviceAppsTable).values({
          familyId: device.familyId, deviceId: device.id, packageName: app.packageName, label: app.label, status,
          installedAt: app.installedAt ?? (initialInventory ? null : now),
        });
        if (!initialInventory) {
          await tx.insert(deviceEventsTable).values({ familyId: device.familyId, deviceId: device.id, childId: device.childId, type: "app_installed", detail: app.label });
          if (status === "pending") newlyPending.push(app.label);
        }
      } else {
        const reinstalled = known.removedAt !== null;
        const status = reinstalled && quarantine && known.status !== "blocked" ? "pending" : known.status;
        await tx.update(deviceAppsTable).set({ label: app.label, lastSeenAt: now, removedAt: null, status, ...(reinstalled ? { installedAt: now } : {}) })
          .where(eq(deviceAppsTable.id, known.id));
        if (reinstalled) {
          await tx.insert(deviceEventsTable).values({ familyId: device.familyId, deviceId: device.id, childId: device.childId, type: "app_installed", detail: app.label });
          if (status === "pending") newlyPending.push(app.label);
        }
      }
    }

    if (input.data.snapshot) {
      for (const app of existing) {
        if (reported.has(app.packageName) || app.removedAt) continue;
        await tx.update(deviceAppsTable).set({ removedAt: now }).where(eq(deviceAppsTable.id, app.id));
        await tx.insert(deviceEventsTable).values({ familyId: device.familyId, deviceId: device.id, childId: device.childId, type: "app_removed", detail: app.label });
      }
    }
  });

  if (newlyPending.length > 0) {
    await notifyGuardians(device.familyId, {
      title: `${ctx?.childName ?? "Sua criança"} instalou ${newlyPending.length === 1 ? "um app novo" : `${newlyPending.length} apps novos`}`,
      body: `${newlyPending.slice(0, 3).join(", ")}${newlyPending.length > 3 ? "…" : ""} — bloqueado até você aprovar.`,
      data: { type: "pending_apps", deviceId: device.id },
    });
  }

  const current = await db.select({ packageName: deviceAppsTable.packageName, status: deviceAppsTable.status, removedAt: deviceAppsTable.removedAt })
    .from(deviceAppsTable).where(eq(deviceAppsTable.deviceId, device.id));
  const active = current.filter((a) => !a.removedAt);
  res.json(SyncInstalledAppsResponse.parse({
    blockedPackages: active.filter((a) => a.status === "blocked").map((a) => a.packageName),
    pendingPackages: active.filter((a) => a.status === "pending").map((a) => a.packageName),
  }));
});

router.post("/child/events", requireDevice, async (req: AuthedRequest, res): Promise<void> => {
  const input = ReportDeviceEventsBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  const device = req.device!;
  const now = Date.now();
  await db.insert(deviceEventsTable).values(input.data.events.map((event) => ({
    familyId: device.familyId, deviceId: device.id, childId: device.childId, type: event.type, detail: event.detail,
    // Relógio do aparelho não é confiável: limita a ±7 dias do servidor.
    occurredAt: event.occurredAt && Math.abs(event.occurredAt.getTime() - now) < 7 * 86_400_000 ? event.occurredAt : new Date(now),
  })));
  const alert = input.data.events.find((event) => ALERT_EVENTS[event.type]);
  if (alert) {
    const ctx = await deviceContext(device.id);
    await notifyGuardians(device.familyId, {
      title: `${ALERT_EVENTS[alert.type]} — ${ctx?.childName ?? "aparelho"}`,
      body: alert.detail ?? `Aparelho "${device.name}"`,
      data: { type: "tamper", deviceId: device.id },
    });
  }
  res.sendStatus(204);
});

/** Verificação online do PIN (o aparelho também tem verificação offline via pinVerifier). */
router.post("/child/verify-pin", requireDevice, async (req: AuthedRequest, res): Promise<void> => {
  const input = VerifyGuardianPinBody.safeParse(req.body);
  if (!input.success) { res.json(VerifyGuardianPinResponse.parse({ valid: false })); return; }
  const device = req.device!;
  if (!(await consumeRateLimit(`pin:${device.id}`, 5, 15 * 60 * 1000))) { fail(res, 429, "Muitas tentativas. Aguarde 15 minutos."); return; }
  const [family] = await db.select({ hash: familiesTable.guardianPinHash, salt: familiesTable.guardianPinSalt })
    .from(familiesTable).where(eq(familiesTable.id, device.familyId));
  const valid = Boolean(family?.hash && family.salt && (await verifyPin(input.data.pin, family.salt, family.hash)));
  if (!valid) {
    await db.insert(deviceEventsTable).values({ familyId: device.familyId, deviceId: device.id, childId: device.childId, type: "pin_failed" });
  }
  res.json(VerifyGuardianPinResponse.parse({ valid }));
});

router.post("/child/push-token", requireDevice, async (req: AuthedRequest, res): Promise<void> => {
  const input = RegisterDevicePushTokenBody.safeParse(req.body);
  if (!input.success) { fail(res, 400, input.error.message); return; }
  await db.update(devicesTable).set({ pushToken: input.data.token }).where(eq(devicesTable.id, req.device!.id));
  res.sendStatus(204);
});

export default router;
