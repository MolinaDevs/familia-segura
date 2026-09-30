import { and, eq, gte, isNull, lte, or, lt, sql } from "drizzle-orm";
import { appRulesTable, childrenTable, db, familiesTable, usageDailyTable } from "@workspace/db";
import { familyPlan, PLAN_LIMITS } from "./limits";
import { logger } from "./logger";
import { notifyGuardians } from "./push";
import { every, singleFlight } from "./jobs";
import { localDate, localHour } from "./time";

/** Domingo, a partir das 19h no fuso da família: fecha a semana antes da nova começar. */
const SEND_WEEKDAY = 0;
const SEND_HOUR = 19;

function addDays(day: string, delta: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function localWeekday(timezone: string, at: Date) {
  const day = localDate(timezone, at);
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** "12h10", "2h", "45 min". */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/**
 * Resumo dos últimos 7 dias (até `today`, inclusive) de cada criança, comparado com os 7 anteriores.
 * Só minutos somados por dia e app: nada além do que o relatório já mostra.
 */
export async function buildWeeklySummary(familyId: string, today: string) {
  const weekStart = addDays(today, -6);
  const previousStart = addDays(today, -13);
  const children = await db.select({ id: childrenTable.id, name: childrenTable.displayName }).from(childrenTable)
    .where(and(eq(childrenTable.familyId, familyId), isNull(childrenTable.archivedAt)))
    .orderBy(childrenTable.createdAt, childrenTable.displayName);
  if (children.length === 0) return null;

  const rows = await db.select({
    childId: usageDailyTable.childId,
    appId: usageDailyTable.appId,
    current: sql<number>`coalesce(sum(case when ${usageDailyTable.day} >= ${weekStart} then ${usageDailyTable.minutes} else 0 end), 0)::int`,
    previous: sql<number>`coalesce(sum(case when ${usageDailyTable.day} < ${weekStart} then ${usageDailyTable.minutes} else 0 end), 0)::int`,
  }).from(usageDailyTable)
    .where(and(eq(usageDailyTable.familyId, familyId), gte(usageDailyTable.day, previousStart), lte(usageDailyTable.day, today)))
    .groupBy(usageDailyTable.childId, usageDailyTable.appId);
  const names = await db.select({ childId: appRulesTable.childId, appId: appRulesTable.appId, name: appRulesTable.appName })
    .from(appRulesTable).where(eq(appRulesTable.familyId, familyId));
  const appName = (childId: string, appId: string) => names.find((n) => n.childId === childId && n.appId === appId)?.name ?? appId;

  const lines = children.map((child) => {
    const mine = rows.filter((r) => r.childId === child.id);
    const current = mine.reduce((sum, r) => sum + Number(r.current), 0);
    const previous = mine.reduce((sum, r) => sum + Number(r.previous), 0);
    if (current === 0) return { childId: child.id, current, previous, text: `${child.name}: sem uso registrado na semana.` };
    const top = [...mine].sort((a, b) => Number(b.current) - Number(a.current))[0];
    let trend = "";
    if (previous > 0) {
      const change = Math.round(((current - previous) / previous) * 100);
      trend = change === 0 ? ", igual à semana passada" : change < 0 ? `, ${-change}% menos que a semana passada` : `, ${change}% mais que a semana passada`;
    }
    return {
      childId: child.id, current, previous,
      text: `${child.name}: ${formatDuration(current)} de tela${trend}. Mais usado: ${appName(child.id, top.appId)}.`,
    };
  });
  const shown = lines.slice(0, 3).map((l) => l.text);
  if (lines.length > 3) shown.push(`E mais ${lines.length - 3} criança(s) no relatório.`);
  return { title: "Resumo da semana", body: shown.join("\n"), lines };
}

/**
 * Envia o resumo às famílias Premium cujo relógio local já passou de domingo 19h e que ainda não o
 * receberam nesta semana. Roda de 15 em 15 minutos; a marca `weekly_summary_sent_on` evita repetição.
 */
export async function sendWeeklySummaries(now: Date = new Date()) {
  const families = await db.select({ id: familiesTable.id, timezone: familiesTable.timezone, sentOn: familiesTable.weeklySummarySentOn })
    .from(familiesTable);
  let sent = 0;
  for (const family of families) {
    if (localWeekday(family.timezone, now) !== SEND_WEEKDAY || localHour(family.timezone, now) < SEND_HOUR) continue;
    const today = localDate(family.timezone, now);
    if (family.sentOn === today) continue;
    // Marca antes de enviar: se o push falhar, não insiste a cada 15 min (o relatório continua no app).
    const [claimed] = await db.update(familiesTable).set({ weeklySummarySentOn: today })
      .where(and(eq(familiesTable.id, family.id), or(isNull(familiesTable.weeklySummarySentOn), lt(familiesTable.weeklySummarySentOn, today))))
      .returning({ id: familiesTable.id });
    if (!claimed) continue;
    if (!PLAN_LIMITS[await familyPlan(family.id)].weeklySummary) continue;
    const summary = await buildWeeklySummary(family.id, today);
    if (!summary) continue;
    await notifyGuardians(family.id, { title: summary.title, body: summary.body, data: { type: "weekly_summary" } });
    sent++;
  }
  return sent;
}

export function scheduleWeeklySummaries() {
  every(15 * 60_000, singleFlight(() =>
    sendWeeklySummaries().catch((err) => logger.error({ err }, "Falha ao enviar resumos semanais"))));
}
