import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  db, appRulesTable, childrenTable, consentsTable, deviceAppsTable, deviceEventsTable, devicesTable, familiesTable,
  membershipsTable, routinesTable, temporaryGrantsTable, timeRequestsTable, usageDailyTable,
  type AppRule, type Child, type Device, type DeviceApp, type Family, type TimeRequest,
} from "@workspace/db";
import { ageBand, localDate } from "./time";
import { familyPlan, PLAN_LIMITS } from "./limits";
import { PIN_ALGORITHM } from "./codes";

// 3 ciclos da sincronização em segundo plano (~15 min cada): evita alarme falso de "sem contato".
const ONLINE_WINDOW_MS = 45 * 60 * 1000;

export const childView = (c: Child) => ({
  id: c.id, displayName: c.displayName, birthYear: c.birthYear, color: c.color, ageBand: ageBand(c.birthYear),
});

export const deviceView = (d: Device) => ({
  id: d.id, childId: d.childId, name: d.name,
  platform: d.platform as "ios" | "android",
  status: (d.status === "revoked" ? "revoked" : Date.now() - d.lastSeenAt.getTime() > ONLINE_WINDOW_MS ? "offline" : "active") as "active" | "offline" | "revoked",
  protectionState: d.protectionState as "unknown" | "active" | "partial" | "disabled" | "unavailable",
  protectionIssues: d.protectionIssues, protectionUpdatedAt: d.protectionUpdatedAt, lastSeenAt: d.lastSeenAt,
  online: d.status !== "revoked" && Date.now() - d.lastSeenAt.getTime() <= ONLINE_WINDOW_MS,
  osVersion: d.osVersion, model: d.model, appVersion: d.appVersion, batteryLevel: d.batteryLevel,
  installUnlockUntil: d.installUnlockUntil && d.installUnlockUntil.getTime() > Date.now() ? d.installUnlockUntil : null,
});

export const deviceAppView = (a: DeviceApp) => ({
  id: a.id, deviceId: a.deviceId, packageName: a.packageName, label: a.label,
  status: a.status as "approved" | "blocked" | "pending",
  installedAt: a.installedAt, removedAt: a.removedAt, firstSeenAt: a.firstSeenAt, lastSeenAt: a.lastSeenAt,
});

export const timeRequestView = (r: TimeRequest, childName: string) => ({
  id: r.id, kind: r.kind as "time" | "install", deviceId: r.deviceId, childId: r.childId, childName, appId: r.appId, appName: r.appName, requestedMinutes: r.requestedMinutes,
  message: r.message, status: r.status as "pending" | "approved" | "denied", createdAt: r.createdAt, resolvedAt: r.resolvedAt,
});

type Totals = Map<string, number>;
const key = (childId: string, appId: string) => `${childId}:${appId}`;

export async function usageToday(familyId: string, day: string, childId?: string, deviceId?: string): Promise<Totals> {
  const conditions = [eq(usageDailyTable.familyId, familyId), eq(usageDailyTable.day, day)];
  if (childId) conditions.push(eq(usageDailyTable.childId, childId));
  if (deviceId) conditions.push(eq(usageDailyTable.deviceId, deviceId));
  const rows = await db.select({ childId: usageDailyTable.childId, appId: usageDailyTable.appId, minutes: sql<number>`sum(${usageDailyTable.minutes})::int` })
    .from(usageDailyTable).where(and(...conditions)).groupBy(usageDailyTable.childId, usageDailyTable.appId);
  return new Map(rows.map((r) => [key(r.childId, r.appId), Number(r.minutes)]));
}

export async function grantsToday(familyId: string, day: string, childId?: string): Promise<Totals> {
  const conditions = [eq(temporaryGrantsTable.familyId, familyId), eq(temporaryGrantsTable.validOn, day)];
  if (childId) conditions.push(eq(temporaryGrantsTable.childId, childId));
  const rows = await db.select({ childId: temporaryGrantsTable.childId, appId: temporaryGrantsTable.appId, minutes: sql<number>`sum(${temporaryGrantsTable.minutes})::int` })
    .from(temporaryGrantsTable).where(and(...conditions)).groupBy(temporaryGrantsTable.childId, temporaryGrantsTable.appId);
  return new Map(rows.map((r) => [key(r.childId, r.appId), Number(r.minutes)]));
}

/**
 * Regra com uso e tempo extra de hoje.
 * - guardian: `dailyLimitMinutes` é o limite base (o que o responsável configurou).
 * - child: `dailyLimitMinutes` já inclui o extra; app bloqueado com extra vira "permitido só pelo extra".
 */
export function ruleView(rule: AppRule, usage: Totals, grants: Totals, audience: "guardian" | "child", thisDeviceUsage?: Totals) {
  const extra = grants.get(key(rule.childId, rule.appId)) ?? 0;
  const blocked = rule.status === "blocked";
  const effective = blocked || rule.dailyLimitMinutes === 0 ? extra : rule.dailyLimitMinutes + extra;
  const childStatus = blocked && extra === 0 ? "blocked" : blocked ? "allowed" : rule.status;
  const status = (audience === "child" ? childStatus : rule.status) as "allowed" | "attention" | "blocked";
  return {
    id: rule.id, childId: rule.childId, appId: rule.appId, appName: rule.appName, category: rule.category,
    icon: rule.icon, iconColor: rule.iconColor, androidPackages: rule.androidPackages,
    usageTodayMinutes: usage.get(key(rule.childId, rule.appId)) ?? 0,
    otherDevicesUsageMinutes: thisDeviceUsage
      ? Math.max(0, (usage.get(key(rule.childId, rule.appId)) ?? 0) - (thisDeviceUsage.get(key(rule.childId, rule.appId)) ?? 0))
      : 0,
    dailyLimitMinutes: audience === "child" ? effective : rule.dailyLimitMinutes,
    extraTodayMinutes: extra,
    effectiveLimitMinutes: effective,
    status,
  };
}

export const routineView = (r: typeof routinesTable.$inferSelect) => ({
  id: r.id, childId: r.childId, title: r.title, description: r.description, days: r.days,
  startTime: r.startTime, endTime: r.endTime, enabled: r.enabled, icon: r.icon, lockScreen: r.lockScreen,
});

export async function familyLimits(familyId: string) {
  const plan = await familyPlan(familyId);
  const limits = PLAN_LIMITS[plan];
  const counts = await countFamily(familyId);
  return { plan, maxChildren: limits.maxChildren, maxDevices: limits.maxDevices, maxGuardians: limits.maxGuardians, ...counts };
}

/** Contagens usadas nos limites. Aceita a transação para contar com a linha da família travada. */
export async function countFamily(familyId: string, executor: Pick<typeof db, "select"> = db) {
  const count = sql<number>`count(*)::int`;
  const [[children], [devices], [guardians]] = await Promise.all([
    executor.select({ n: count }).from(childrenTable).where(and(eq(childrenTable.familyId, familyId), isNull(childrenTable.archivedAt))),
    executor.select({ n: count }).from(devicesTable).where(and(eq(devicesTable.familyId, familyId), ne(devicesTable.status, "revoked"))),
    executor.select({ n: count }).from(membershipsTable).where(eq(membershipsTable.familyId, familyId)),
  ]);
  return { children: Number(children?.n ?? 0), devices: Number(devices?.n ?? 0), guardians: Number(guardians?.n ?? 0) };
}

export const settingsView = (f: Family) => ({
  timezone: f.timezone, offlineLeaseHours: f.offlineLeaseHours, quarantineNewApps: f.quarantineNewApps,
  hasGuardianPin: Boolean(f.guardianPinHash),
  blockAppInstalls: f.blockAppInstalls, blockAppRemoval: f.blockAppRemoval, webFilter: f.webFilter as "off" | "adult",
});

export async function familyOverview(familyId: string, currentUserId?: string) {
  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyId));
  if (!family) return undefined;
  const today = localDate(family.timezone);
  const [members, children, devices, rules, routines, requests, consent, pendingApps, events, usage, grants, limits] = await Promise.all([
    db.select().from(membershipsTable).where(eq(membershipsTable.familyId, familyId)).orderBy(membershipsTable.createdAt),
    db.select().from(childrenTable).where(and(eq(childrenTable.familyId, familyId), isNull(childrenTable.archivedAt))).orderBy(childrenTable.createdAt),
    db.select().from(devicesTable).where(and(eq(devicesTable.familyId, familyId), ne(devicesTable.status, "revoked"))).orderBy(devicesTable.createdAt),
    db.select().from(appRulesTable).where(eq(appRulesTable.familyId, familyId)).orderBy(appRulesTable.appName),
    db.select().from(routinesTable).where(eq(routinesTable.familyId, familyId)),
    db.select().from(timeRequestsTable).where(eq(timeRequestsTable.familyId, familyId)).orderBy(desc(timeRequestsTable.createdAt)).limit(50),
    db.select().from(consentsTable).where(eq(consentsTable.familyId, familyId)).orderBy(consentsTable.acceptedAt).limit(1),
    db.select().from(deviceAppsTable).where(and(eq(deviceAppsTable.familyId, familyId), eq(deviceAppsTable.status, "pending"), isNull(deviceAppsTable.removedAt))).orderBy(desc(deviceAppsTable.firstSeenAt)),
    db.select().from(deviceEventsTable).where(eq(deviceEventsTable.familyId, familyId)).orderBy(desc(deviceEventsTable.occurredAt)).limit(20),
    usageToday(familyId, today),
    grantsToday(familyId, today),
    familyLimits(familyId),
  ]);
  const activeChildIds = new Set(children.map((c) => c.id));
  const activeDeviceIds = new Set(devices.map((d) => d.id));
  const childName = (id: string) => children.find((c) => c.id === id)?.displayName ?? "";
  return {
    family: { id: family.id, name: family.name, createdAt: family.createdAt },
    today,
    members: members.map((m) => ({ id: m.id, displayName: m.displayName, role: m.role as "owner" | "guardian" | "viewer", isCurrentUser: m.userId === currentUserId })),
    children: children.map(childView),
    devices: devices.map(deviceView),
    apps: rules.filter((r) => activeChildIds.has(r.childId)).map((r) => ruleView(r, usage, grants, "guardian")),
    routines: routines.filter((r) => activeChildIds.has(r.childId)).map(routineView),
    timeRequests: requests.filter((r) => activeChildIds.has(r.childId)).map((r) => timeRequestView(r, childName(r.childId))),
    pendingApps: pendingApps.filter((a) => activeDeviceIds.has(a.deviceId)).map(deviceAppView),
    recentEvents: events.filter((e) => activeDeviceIds.has(e.deviceId)).map((e) => ({ id: e.id, deviceId: e.deviceId, childId: e.childId, type: e.type, detail: e.detail, occurredAt: e.occurredAt })),
    limits,
    settings: settingsView(family),
    privacy: {
      consentAcceptedAt: consent[0]?.acceptedAt ?? family.createdAt,
      retentionDays: 365,
      collectedData: ["responsáveis", "crianças", "aparelhos", "regras", "rotinas", "pedidos de tempo", "uso por app", "apps instalados (Android)", "eventos de proteção", "auditoria"],
    },
  };
}

export async function childOverview(device: Device) {
  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, device.familyId));
  const [child] = await db.select().from(childrenTable)
    .where(and(eq(childrenTable.id, device.childId), eq(childrenTable.familyId, device.familyId), isNull(childrenTable.archivedAt)));
  if (!family || !child) return undefined;
  const today = localDate(family.timezone);
  const [rules, routines, apps, requests, usage, grants, deviceUsage] = await Promise.all([
    db.select().from(appRulesTable).where(and(eq(appRulesTable.childId, child.id), eq(appRulesTable.familyId, family.id))).orderBy(appRulesTable.appName),
    db.select().from(routinesTable).where(and(eq(routinesTable.childId, child.id), eq(routinesTable.familyId, family.id))),
    db.select().from(deviceAppsTable).where(and(eq(deviceAppsTable.deviceId, device.id), isNull(deviceAppsTable.removedAt), inArray(deviceAppsTable.status, ["blocked", "pending"]))),
    db.select().from(timeRequestsTable).where(and(eq(timeRequestsTable.childId, child.id), eq(timeRequestsTable.status, "pending"))).orderBy(desc(timeRequestsTable.createdAt)).limit(20),
    usageToday(family.id, today, child.id),
    grantsToday(family.id, today, child.id),
    usageToday(family.id, today, child.id, device.id),
  ]);
  return {
    child: childView(child),
    deviceId: device.id,
    apps: rules.map((r) => ruleView(r, usage, grants, "child", deviceUsage)),
    routines: routines.map(routineView),
    collectedData: ["tempo de uso dos apps com regra", "apps instalados (Android)", "estado da proteção do aparelho", "seus pedidos de tempo"],
    policy: {
      leaseHours: family.offlineLeaseHours,
      quarantineNewApps: family.quarantineNewApps,
      blockAppInstalls: family.blockAppInstalls,
      blockAppRemoval: family.blockAppRemoval,
      webFilter: family.webFilter as "off" | "adult",
      installUnlockUntil: device.installUnlockUntil && device.installUnlockUntil.getTime() > Date.now() ? device.installUnlockUntil : null,
      timezone: family.timezone,
      serverTime: new Date(),
      blockedPackages: apps.filter((a) => a.status === "blocked").map((a) => a.packageName),
      pendingPackages: apps.filter((a) => a.status === "pending").map((a) => a.packageName),
      pinVerifier: family.guardianPinHash && family.guardianPinSalt
        ? { algorithm: PIN_ALGORITHM, salt: family.guardianPinSalt, hash: family.guardianPinHash }
        : null,
    },
    pendingRequests: requests.map((r) => timeRequestView(r, child.displayName)),
  };
}
