import { Router, type IRouter } from "express";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db, appRulesTable, childrenTable, devicesTable, familiesTable } from "@workspace/db";
import { GetUsageReportQueryParams, GetUsageReportResponse } from "@workspace/api-zod";
import { fail, requireMember, type AuthedRequest } from "../lib/auth";
import { findCatalogEntry, findCatalogEntryByPackage } from "../lib/catalog";
import { familyPlan, PLAN_LIMITS } from "../lib/limits";
import { addDays, daysBetween, localDate } from "../lib/time";

const router: IRouter = Router();
const TAMPER_TYPES = ["protection_disabled", "tamper_attempt", "uninstall_attempt", "pin_failed"];

type Row = Record<string, unknown>;
const rows = async <T extends Row>(query: SQL) => (await db.execute<T>(query)).rows;
const int = (value: unknown) => Number(value ?? 0);

router.get("/family/reports/usage", requireMember(), async (req: AuthedRequest, res): Promise<void> => {
  const q = GetUsageReportQueryParams.safeParse(req.query);
  if (!q.success) { fail(res, 400, q.error.message); return; }
  const familyId = req.member!.familyId;
  const days = q.data.days ?? 7;
  const plan = await familyPlan(familyId);
  if (days > PLAN_LIMITS[plan].reportDays) {
    fail(res, 402, `Histórico de mais de ${PLAN_LIMITS[plan].reportDays} dias é um recurso Premium`, "REPORT_RANGE"); return;
  }
  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyId));
  const children = await db.select().from(childrenTable).where(and(eq(childrenTable.familyId, familyId), isNull(childrenTable.archivedAt)));
  const childId = q.data.childId;
  if (childId && !children.some((c) => c.id === childId)) { fail(res, 404, "Child not found"); return; }

  const tz = family.timezone;
  const to = localDate(tz);
  const from = addDays(to, -(days - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  const scopeIds = childId ? [childId] : children.map((c) => c.id);
  if (scopeIds.length === 0) scopeIds.push("00000000-0000-0000-0000-000000000000");
  const scopeList = sql.join(scopeIds.map((id) => sql`${id}::uuid`), sql`, `);
  const inScope = (column: string) => sql`${sql.raw(column)} in (${scopeList})`;

  const [daily, previous, apps, heatmap, byDevice, byChild, grantsByDay, reached, requests, extra, tamper] = await Promise.all([
    rows<{ day: string; minutes: number }>(sql`select day::text as day, sum(minutes)::int as minutes from usage_daily
      where family_id = ${familyId} and ${inScope("child_id")} and day between ${from} and ${to} group by day`),
    rows<{ minutes: number }>(sql`select coalesce(sum(minutes), 0)::int as minutes from usage_daily
      where family_id = ${familyId} and ${inScope("child_id")} and day between ${prevFrom} and ${prevTo}`),
    rows<{ app_id: string; minutes: number; estimated: boolean }>(sql`select app_id, sum(minutes)::int as minutes, bool_or(precision = 'estimated') as estimated
      from usage_daily where family_id = ${familyId} and ${inScope("child_id")} and day between ${from} and ${to}
      group by app_id order by 2 desc limit 20`),
    rows<{ weekday: number; hour: number; minutes: number }>(sql`select extract(dow from day)::int as weekday, hour, sum(minutes)::int as minutes
      from usage_hourly where family_id = ${familyId} and ${inScope("child_id")} and day between ${from} and ${to} group by 1, 2`),
    rows<{ device_id: string; minutes: number }>(sql`select device_id, sum(minutes)::int as minutes from usage_daily
      where family_id = ${familyId} and ${inScope("child_id")} and day between ${from} and ${to} group by device_id`),
    rows<{ child_id: string; minutes: number }>(sql`select child_id, sum(minutes)::int as minutes from usage_daily
      where family_id = ${familyId} and ${inScope("child_id")} and day between ${from} and ${to} group by child_id`),
    rows<{ day: string; minutes: number }>(sql`select valid_on::text as day, sum(minutes)::int as minutes from temporary_grants
      where family_id = ${familyId} and ${inScope("child_id")} and valid_on between ${from} and ${to} group by valid_on`),
    rows<{ n: number }>(sql`with u as (
        select child_id, app_id, day, sum(minutes) as m from usage_daily
        where family_id = ${familyId} and ${inScope("child_id")} and day between ${from} and ${to} group by 1, 2, 3
      ), g as (
        select child_id, app_id, valid_on as day, sum(minutes) as m from temporary_grants
        where family_id = ${familyId} and ${inScope("child_id")} and valid_on between ${from} and ${to} group by 1, 2, 3
      )
      select count(*)::int as n from u
      join app_rules r on r.child_id = u.child_id and r.app_id = u.app_id
      left join g on g.child_id = u.child_id and g.app_id = u.app_id and g.day = u.day
      where r.status <> 'blocked' and r.daily_limit_minutes > 0 and u.m >= r.daily_limit_minutes + coalesce(g.m, 0)`),
    rows<{ status: string; n: number }>(sql`select status, count(*)::int as n from time_requests
      where family_id = ${familyId} and ${inScope("child_id")}
        and (created_at at time zone ${tz})::date between ${from}::date and ${to}::date group by status`),
    rows<{ minutes: number }>(sql`select coalesce(sum(minutes), 0)::int as minutes from temporary_grants
      where family_id = ${familyId} and ${inScope("child_id")} and valid_on between ${from} and ${to}`),
    rows<{ device_id: string; n: number }>(sql`select device_id, count(*)::int as n from device_events
      where family_id = ${familyId} and ${inScope("child_id")} and type in (${sql.join(TAMPER_TYPES.map((t) => sql`${t}`), sql`, `)})
        and (occurred_at at time zone ${tz})::date between ${from}::date and ${to}::date group by device_id`),
  ]);

  const rules = await db.select().from(appRulesTable).where(eq(appRulesTable.familyId, familyId));
  const scopedRules = rules.filter((r) => scopeIds.includes(r.childId));
  const baseLimit = scopedRules.filter((r) => r.status !== "blocked" && r.dailyLimitMinutes > 0).reduce((sum, r) => sum + r.dailyLimitMinutes, 0);
  const labels = await rows<{ package_name: string; label: string }>(sql`select distinct on (package_name) package_name, label from device_apps where family_id = ${familyId}`);
  const labelOf = new Map(labels.map((l) => [l.package_name, l.label]));
  const describe = (appId: string) => {
    const rule = rules.find((r) => r.appId === appId);
    if (rule) return { appName: rule.appName, iconColor: rule.iconColor };
    const entry = findCatalogEntry(appId) ?? findCatalogEntryByPackage(appId);
    if (entry) return { appName: entry.name, iconColor: entry.iconColor };
    return { appName: labelOf.get(appId) ?? appId, iconColor: "#718078" };
  };

  const dailyMap = new Map(daily.map((d) => [d.day, int(d.minutes)]));
  const grantMap = new Map(grantsByDay.map((g) => [g.day, int(g.minutes)]));
  const range = daysBetween(from, to);
  const total = range.reduce((sum, day) => sum + (dailyMap.get(day) ?? 0), 0);

  const devices = await db.select().from(devicesTable).where(eq(devicesTable.familyId, familyId));
  const scopedDevices = devices.filter((d) => scopeIds.includes(d.childId));
  const deviceById = new Map(devices.map((d) => [d.id, d]));
  const tamperByDevice = new Map(tamper.map((t) => [t.device_id, int(t.n)]));
  const requestCount = (status: string) => int(requests.find((r) => r.status === status)?.n);

  const anyEstimated = apps.some((a) => a.estimated);
  const anyExact = apps.some((a) => !a.estimated);
  const precision = apps.length === 0 ? "none" : anyEstimated && anyExact ? "mixed" : anyEstimated ? "estimated" : "exact";

  res.json(GetUsageReportResponse.parse({
    from, to, precision,
    totals: { minutes: total, dailyAverage: Math.round(total / days), previousPeriodMinutes: int(previous[0]?.minutes) },
    daily: range.map((day) => ({ date: day, minutes: dailyMap.get(day) ?? 0, limitMinutes: baseLimit + (grantMap.get(day) ?? 0) })),
    apps: apps.map((a) => ({ appId: a.app_id, ...describe(a.app_id), minutes: int(a.minutes), precision: a.estimated ? "estimated" : "exact" })),
    heatmap: heatmap.map((h) => ({ weekday: int(h.weekday), hour: int(h.hour), minutes: int(h.minutes) })),
    devices: byDevice.filter((d) => deviceById.has(d.device_id)).map((d) => {
      const device = deviceById.get(d.device_id)!;
      return { deviceId: device.id, name: device.name, platform: device.platform, minutes: int(d.minutes) };
    }).sort((a, b) => b.minutes - a.minutes),
    children: children.filter((c) => scopeIds.includes(c.id)).map((c) => ({
      childId: c.id, name: c.displayName, color: c.color, minutes: int(byChild.find((b) => b.child_id === c.id)?.minutes),
    })),
    compliance: {
      limitsReached: int(reached[0]?.n),
      requestsCreated: requests.reduce((sum, r) => sum + int(r.n), 0),
      requestsApproved: requestCount("approved"),
      requestsDenied: requestCount("denied"),
      extraMinutesGranted: int(extra[0]?.minutes),
    },
    protection: scopedDevices.filter((d) => d.status !== "revoked").map((d) => ({
      deviceId: d.id, name: d.name, platform: d.platform, state: d.protectionState, lastSeenAt: d.lastSeenAt, tamperEvents: tamperByDevice.get(d.id) ?? 0,
    })),
  }));
});

export default router;
