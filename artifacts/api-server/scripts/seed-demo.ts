/**
 * Dados de demonstração para testar o app no computador (modo DEV_AUTH).
 * Uso: pnpm --filter @workspace/api-server run seed:demo
 * Recria a "Família Demonstração" do usuário dev_responsavel. Nunca rode em produção.
 */
import { eq } from "drizzle-orm";
import {
  db, pool, appRulesTable, auditEventsTable, childrenTable, consentsTable, deviceAppsTable, deviceEventsTable,
  devicesTable, familiesTable, membershipsTable, routinesTable, temporaryGrantsTable, timeRequestsTable,
  usageDailyTable, usageHourlyTable, usersTable,
} from "@workspace/db";
import { GLOBAL_CATALOG } from "../src/lib/catalog";
import { hashPin, newDeviceToken, sha256 } from "../src/lib/codes";
import { addDays, localDate } from "../src/lib/time";

if (process.env.NODE_ENV === "production") throw new Error("seed:demo não roda em produção");

const TZ = "America/Sao_Paulo";
let seed = 42;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];

async function user(clerkUserId: string, displayName: string) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));
  if (existing) {
    await db.delete(membershipsTable).where(eq(membershipsTable.userId, existing.id));
    return existing;
  }
  const [created] = await db.insert(usersTable).values({ clerkUserId, displayName }).returning();
  return created;
}

async function main() {
  const owner = await user("dev_responsavel", "Ana");
  const [old] = await db.select().from(membershipsTable).where(eq(membershipsTable.userId, owner.id));
  if (old) await db.delete(familiesTable).where(eq(familiesTable.id, old.familyId));
  const guardian = await user("dev_carlos", "Carlos");
  const viewer = await user("dev_vo", "Vó Maria");

  const pin = await hashPin("4827");
  const [family] = await db.insert(familiesTable).values({
    name: "Família Demonstração", timezone: TZ, guardianPinHash: pin.hash, guardianPinSalt: pin.salt, guardianPinUpdatedAt: new Date(),
  }).returning();
  await db.insert(membershipsTable).values([
    { familyId: family.id, userId: owner.id, displayName: "Ana", role: "owner" },
    { familyId: family.id, userId: guardian.id, displayName: "Carlos", role: "guardian", invitedBy: owner.id },
    { familyId: family.id, userId: viewer.id, displayName: "Vó Maria", role: "viewer", invitedBy: owner.id },
  ]);
  await db.insert(consentsTable).values({ familyId: family.id, userId: owner.id, consentType: "family" });

  const kids = await db.insert(childrenTable).values([
    { familyId: family.id, displayName: "Leo", birthYear: 2015, color: "#2a78d6" },
    { familyId: family.id, displayName: "Bia", birthYear: 2012, color: "#eb6834" },
    { familyId: family.id, displayName: "Nina", birthYear: 2018, color: "#1baf7a" },
  ]).returning();
  const [leo, bia, nina] = kids;

  const ruleSpec: Record<string, Array<[string, number, "allowed" | "blocked"]>> = {
    [leo.id]: [["youtube", 60, "allowed"], ["roblox", 60, "allowed"], ["minecraft", 45, "allowed"], ["whatsapp", 30, "allowed"], ["tiktok", 0, "blocked"]],
    [bia.id]: [["tiktok", 45, "allowed"], ["instagram", 45, "allowed"], ["youtube", 90, "allowed"], ["whatsapp", 90, "allowed"], ["free-fire", 60, "allowed"]],
    [nina.id]: [["youtube-kids", 45, "allowed"], ["roblox", 30, "allowed"], ["youtube", 0, "blocked"]],
  };
  for (const kid of kids) {
    await db.insert(appRulesTable).values(ruleSpec[kid.id].map(([id, limit, status]) => {
      const c = GLOBAL_CATALOG.find((e) => e.id === id)!;
      return { familyId: family.id, childId: kid.id, appId: c.id, appName: c.name, category: c.category, icon: c.icon, iconColor: c.iconColor, androidPackages: c.androidPackages, dailyLimitMinutes: limit, status };
    }));
  }
  await db.insert(routinesTable).values([
    { familyId: family.id, childId: leo.id, title: "Hora de dormir", description: "", days: "dom,seg,ter,qua,qui", startTime: "21:00", endTime: "07:00", icon: "moon", lockScreen: true },
    { familyId: family.id, childId: leo.id, title: "Escola", description: "", days: "seg,ter,qua,qui,sex", startTime: "07:00", endTime: "12:30", icon: "book" },
    { familyId: family.id, childId: bia.id, title: "Hora de dormir", description: "", days: "dom,seg,ter,qua,qui", startTime: "22:00", endTime: "06:30", icon: "moon" },
    { familyId: family.id, childId: nina.id, title: "Hora de dormir", description: "", days: "dom,seg,ter,qua,qui,sex,sab", startTime: "20:00", endTime: "07:00", icon: "moon", lockScreen: true },
  ]);

  const now = Date.now();
  const devices = await db.insert(devicesTable).values([
    { familyId: family.id, childId: leo.id, name: "Galaxy do Leo", platform: "android", deviceTokenHash: sha256(newDeviceToken()), protectionState: "active", osVersion: "14", model: "Samsung Galaxy A15", batteryLevel: 76, lastSeenAt: new Date(now - 3 * 60_000), protectionUpdatedAt: new Date() },
    { familyId: family.id, childId: leo.id, name: "iPad da sala", platform: "ios", deviceTokenHash: sha256(newDeviceToken()), protectionState: "active", osVersion: "18.1", model: "iPad", batteryLevel: 41, lastSeenAt: new Date(now - 8 * 60_000), protectionUpdatedAt: new Date() },
    { familyId: family.id, childId: bia.id, name: "iPhone da Bia", platform: "ios", deviceTokenHash: sha256(newDeviceToken()), protectionState: "partial", protectionIssues: ["Instalação de apps liberada"], osVersion: "18.0", model: "iPhone 13", batteryLevel: 18, lastSeenAt: new Date(now - 5 * 60_000), protectionUpdatedAt: new Date() },
    { familyId: family.id, childId: nina.id, name: "Tablet da Nina", platform: "android", deviceTokenHash: sha256(newDeviceToken()), protectionState: "disabled", protectionIssues: ["Serviço de proteção desativado"], osVersion: "13", model: "Lenovo Tab M9", batteryLevel: 63, lastSeenAt: new Date(now - 26 * 3600_000), protectionUpdatedAt: new Date() },
  ]).returning();

  // 30 dias de uso, distribuído em horários plausíveis (tarde e noite, mais no fim de semana).
  const today = localDate(TZ);
  const dailyRows: (typeof usageDailyTable.$inferInsert)[] = [];
  const hourlyRows: (typeof usageHourlyTable.$inferInsert)[] = [];
  for (let d = 29; d >= 0; d--) {
    const day = addDays(today, -d);
    const weekend = [0, 6].includes(new Date(`${day}T12:00:00`).getDay());
    for (const device of devices) {
      const rules = ruleSpec[device.childId].filter(([, , status]) => status === "allowed");
      for (const [appId, limit] of rules) {
        const factor = device.platform === "ios" && device.childId === leo.id ? 0.35 : 1;
        const minutes = Math.round(limit * factor * (0.35 + rand() * (weekend ? 1.1 : 0.8)));
        if (minutes <= 0) continue;
        const estimated = device.platform === "ios";
        const value = estimated ? Math.max(15, Math.round(minutes / 15) * 15) : minutes;
        dailyRows.push({ familyId: family.id, childId: device.childId, deviceId: device.id, appId, day, minutes: value, precision: estimated ? "estimated" : "exact" });
        const hours = weekend ? [10, 11, 14, 15, 16, 19, 20] : [13, 14, 15, 16, 18, 19, 20];
        let left = value;
        while (left > 0) {
          const chunk = Math.min(left, 5 + Math.floor(rand() * 20));
          hourlyRows.push({ familyId: family.id, childId: device.childId, deviceId: device.id, appId, day, hour: pick(hours), minutes: chunk });
          left -= chunk;
        }
      }
    }
  }
  const hourlyMerged = new Map<string, typeof usageHourlyTable.$inferInsert>();
  for (const row of hourlyRows) {
    const key = `${row.deviceId}:${row.appId}:${row.day}:${row.hour}`;
    const current = hourlyMerged.get(key);
    if (current) current.minutes = (current.minutes ?? 0) + (row.minutes ?? 0);
    else hourlyMerged.set(key, { ...row });
  }
  for (let i = 0; i < dailyRows.length; i += 500) await db.insert(usageDailyTable).values(dailyRows.slice(i, i + 500));
  const merged = [...hourlyMerged.values()];
  for (let i = 0; i < merged.length; i += 500) await db.insert(usageHourlyTable).values(merged.slice(i, i + 500));

  await db.insert(timeRequestsTable).values([
    { familyId: family.id, childId: leo.id, deviceId: devices[0].id, appId: "roblox", appName: "Roblox", requestedMinutes: 30, message: "Falta só terminar a fase com meu primo" },
    { familyId: family.id, childId: bia.id, deviceId: devices[2].id, appId: "instagram", appName: "Instagram", requestedMinutes: 15, message: "" },
  ]);
  await db.insert(temporaryGrantsTable).values({ familyId: family.id, childId: bia.id, appId: "youtube", minutes: 20, validOn: today, source: "manual", createdBy: owner.id });
  await db.insert(deviceAppsTable).values([
    { familyId: family.id, deviceId: devices[0].id, packageName: "com.google.android.youtube", label: "YouTube", status: "approved" },
    { familyId: family.id, deviceId: devices[0].id, packageName: "com.roblox.client", label: "Roblox", status: "approved" },
    { familyId: family.id, deviceId: devices[0].id, packageName: "com.whatsapp", label: "WhatsApp", status: "approved" },
    { familyId: family.id, deviceId: devices[0].id, packageName: "com.kitkagames.fallbuddies", label: "Stumble Guys", status: "pending", installedAt: new Date(now - 40 * 60_000) },
    { familyId: family.id, deviceId: devices[3].id, packageName: "com.zhiliaoapp.musically", label: "TikTok", status: "pending", installedAt: new Date(now - 3 * 3600_000) },
  ]);
  await db.insert(deviceEventsTable).values([
    { familyId: family.id, deviceId: devices[0].id, childId: leo.id, type: "uninstall_attempt", detail: "Configurações do aparelho", occurredAt: new Date(now - 2 * 3600_000) },
    { familyId: family.id, deviceId: devices[3].id, childId: nina.id, type: "protection_disabled", detail: "Serviço de proteção desligado", occurredAt: new Date(now - 26 * 3600_000) },
  ]);
  await db.insert(auditEventsTable).values({ familyId: family.id, userId: owner.id, action: "family.created", summary: "Família de demonstração criada" });

  console.log(`Demonstração pronta: família ${family.id}, ${dailyRows.length} registros diários, ${merged.length} por hora. PIN do responsável: 4827`);
  await pool.end();
}

await main();
