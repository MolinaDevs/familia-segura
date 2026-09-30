import { Router, type IRouter } from "express";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db, appRulesTable, childrenTable, deviceAppsTable, familiesTable, routinesTable, temporaryGrantsTable } from "@workspace/db";
import {
  CreateAppRuleBody, CreateAppRuleParams, CreateAppRuleResponse, CreateRoutineBody, CreateRoutineParams,
  CreateRoutineResponse, CreateTimeGrantBody, CreateTimeGrantParams, CreateTimeGrantResponse, DeleteAppRuleParams,
  DeleteRoutineParams, ListCatalogAppsResponse, UpdateAppRuleBody, UpdateAppRuleParams, UpdateAppRuleResponse,
  UpdateRoutineBody, UpdateRoutineParams, UpdateRoutineResponse,
} from "@workspace/api-zod";
import { EDITORS, fail, requireMember, type AuthedRequest } from "../lib/auth";
import { audit } from "../lib/audit";
import { findCatalogEntry, findCatalogEntryByPackage, GLOBAL_CATALOG } from "../lib/catalog";
import { notifyDevicesPolicyChanged } from "../lib/push";
import { localDate } from "../lib/time";
import { familyPlan, PLAN_LIMITS } from "../lib/limits";
import { grantsToday, routineView, ruleView, usageToday } from "../lib/views";

const router: IRouter = Router();
const PACKAGE_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/;

async function activeChild(familyId: string, childId: string) {
  const [child] = await db.select().from(childrenTable)
    .where(and(eq(childrenTable.id, childId), eq(childrenTable.familyId, familyId), isNull(childrenTable.archivedAt)));
  return child;
}

/** Apps com limite de tempo (bloqueados não contam: bloquear é segurança e fica ilimitado no grátis). */
async function timedAppsCount(childId: string, exceptAppId?: string) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(appRulesTable)
    .where(and(eq(appRulesTable.childId, childId), ne(appRulesTable.status, "blocked"),
      exceptAppId ? ne(appRulesTable.appId, exceptAppId) : undefined));
  return Number(row?.n ?? 0);
}

const TIMED_APPS_MESSAGE = (max: number) =>
  `No plano grátis dá para ter até ${max} apps com limite de tempo (bloquear apps continua ilimitado). Assine o Premium para limites ilimitados.`;

async function familyToday(familyId: string) {
  const [family] = await db.select({ timezone: familiesTable.timezone }).from(familiesTable).where(eq(familiesTable.id, familyId));
  return localDate(family?.timezone ?? "America/Sao_Paulo");
}

async function ruleResponse(familyId: string, rule: typeof appRulesTable.$inferSelect) {
  const today = await familyToday(familyId);
  const [usage, grants] = await Promise.all([usageToday(familyId, today, rule.childId), grantsToday(familyId, today, rule.childId)]);
  return ruleView(rule, usage, grants, "guardian");
}

/** Catálogo global + apps descobertos nos aparelhos Android da família (fora do catálogo). */
router.get("/catalog/apps", requireMember(), async (req: AuthedRequest, res): Promise<void> => {
  const discovered = await db.selectDistinctOn([deviceAppsTable.packageName], { packageName: deviceAppsTable.packageName, label: deviceAppsTable.label })
    .from(deviceAppsTable)
    .where(and(eq(deviceAppsTable.familyId, req.member!.familyId), isNull(deviceAppsTable.removedAt)));
  const extra = discovered
    .filter((app) => !findCatalogEntryByPackage(app.packageName))
    .map((app) => ({ id: app.packageName, name: app.label, category: "Instalados", icon: "smartphone", iconColor: "#718078", androidPackages: [app.packageName] }));
  res.json(ListCatalogAppsResponse.parse([...GLOBAL_CATALOG, ...extra.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))]));
});

router.post("/family/children/:childId/apps", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const p = CreateAppRuleParams.safeParse(req.params), input = CreateAppRuleBody.safeParse(req.body);
  if (!p.success || !input.success) { fail(res, 400, "Invalid request"); return; }
  const m = req.member!;
  const child = await activeChild(m.familyId, p.data.childId);
  if (!child) { fail(res, 404, "Child not found"); return; }

  let values: { appId: string; appName: string; category: string; icon: string; iconColor: string; androidPackages: string[] };
  const catalog = input.data.catalogAppId ? findCatalogEntry(input.data.catalogAppId) : undefined;
  if (catalog) {
    values = { appId: catalog.id, appName: catalog.name, category: catalog.category, icon: catalog.icon, iconColor: catalog.iconColor, androidPackages: catalog.androidPackages };
  } else if (input.data.catalogAppId && PACKAGE_RE.test(input.data.catalogAppId)) {
    // App descoberto no inventário Android: id = pacote.
    const [known] = await db.select({ label: deviceAppsTable.label }).from(deviceAppsTable)
      .where(and(eq(deviceAppsTable.familyId, m.familyId), eq(deviceAppsTable.packageName, input.data.catalogAppId))).limit(1);
    values = { appId: input.data.catalogAppId, appName: input.data.name ?? known?.label ?? input.data.catalogAppId, category: input.data.category ?? "Instalados", icon: "smartphone", iconColor: "#718078", androidPackages: [input.data.catalogAppId] };
  } else if (input.data.name) {
    const packages = (input.data.androidPackages ?? []).filter((pkg) => PACKAGE_RE.test(pkg));
    const slug = input.data.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "app";
    values = { appId: `custom-${slug}`, appName: input.data.name, category: input.data.category ?? "Outros", icon: "grid", iconColor: "#718078", androidPackages: packages };
  } else {
    fail(res, 400, "Informe um app do catálogo ou um nome", "APP_REQUIRED"); return;
  }

  if ((input.data.status ?? "allowed") !== "blocked") {
    const limits = PLAN_LIMITS[await familyPlan(m.familyId)];
    if (await timedAppsCount(child.id) >= limits.maxTimedApps) {
      fail(res, 402, TIMED_APPS_MESSAGE(limits.maxTimedApps), "TIMED_APPS_LIMIT"); return;
    }
  }

  const [rule] = await db.insert(appRulesTable).values({
    familyId: m.familyId, childId: child.id, ...values,
    dailyLimitMinutes: input.data.dailyLimitMinutes ?? 60, status: input.data.status ?? "allowed",
  }).onConflictDoNothing({ target: [appRulesTable.childId, appRulesTable.appId] }).returning();
  if (!rule) { fail(res, 409, `${values.appName} já tem regra para ${child.displayName}`, "RULE_EXISTS"); return; }
  await audit(m.familyId, m.userId, "rule.created", `Regra de ${rule.appName} criada para ${child.displayName}`);
  await notifyDevicesPolicyChanged(m.familyId, child.id);
  res.status(201).json(CreateAppRuleResponse.parse(await ruleResponse(m.familyId, rule)));
});

router.delete("/family/children/:childId/apps/:appId", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const p = DeleteAppRuleParams.safeParse(req.params);
  if (!p.success) { fail(res, 400, p.error.message); return; }
  const m = req.member!;
  const [rule] = await db.delete(appRulesTable)
    .where(and(eq(appRulesTable.familyId, m.familyId), eq(appRulesTable.childId, p.data.childId), eq(appRulesTable.appId, p.data.appId))).returning();
  if (!rule) { fail(res, 404, "Rule not found"); return; }
  await audit(m.familyId, m.userId, "rule.deleted", `Regra de ${rule.appName} removida`);
  await notifyDevicesPolicyChanged(m.familyId, rule.childId);
  res.sendStatus(204);
});

router.patch("/family/apps/:appId/rules", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const p = UpdateAppRuleParams.safeParse(req.params), input = UpdateAppRuleBody.safeParse(req.body);
  if (!p.success || !input.success) { fail(res, 400, "Invalid request"); return; }
  const m = req.member!;
  const { childId, ...update } = input.data;
  if (update.status && update.status !== "blocked") {
    const limits = PLAN_LIMITS[await familyPlan(m.familyId)];
    const [current] = await db.select({ status: appRulesTable.status }).from(appRulesTable)
      .where(and(eq(appRulesTable.appId, p.data.appId), eq(appRulesTable.childId, childId), eq(appRulesTable.familyId, m.familyId)));
    if (current?.status === "blocked" && await timedAppsCount(childId, p.data.appId) >= limits.maxTimedApps) {
      fail(res, 402, TIMED_APPS_MESSAGE(limits.maxTimedApps), "TIMED_APPS_LIMIT"); return;
    }
  }
  const [rule] = await db.update(appRulesTable).set(update)
    .where(and(eq(appRulesTable.appId, p.data.appId), eq(appRulesTable.childId, childId), eq(appRulesTable.familyId, m.familyId))).returning();
  if (!rule) { fail(res, 404, "Rule not found"); return; }
  const summary = update.status === "blocked" ? `${rule.appName} bloqueado`
    : update.dailyLimitMinutes !== undefined ? `Limite de ${rule.appName}: ${rule.dailyLimitMinutes} min/dia` : `Regra de ${rule.appName} atualizada`;
  await audit(m.familyId, m.userId, "rule.updated", summary, update);
  await notifyDevicesPolicyChanged(m.familyId, rule.childId);
  res.json(UpdateAppRuleResponse.parse(await ruleResponse(m.familyId, rule)));
});

router.post("/family/children/:childId/routines", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const p = CreateRoutineParams.safeParse(req.params), input = CreateRoutineBody.safeParse(req.body);
  if (!p.success || !input.success) { fail(res, 400, input.success ? "Invalid request" : input.error.message); return; }
  const m = req.member!;
  const child = await activeChild(m.familyId, p.data.childId);
  if (!child) { fail(res, 404, "Child not found"); return; }
  if (input.data.startTime === input.data.endTime) { fail(res, 400, "Início e fim não podem ser iguais", "EMPTY_ROUTINE"); return; }
  const limits = PLAN_LIMITS[await familyPlan(m.familyId)];
  const [{ routines }] = await db.select({ routines: sql<number>`count(*)::int` }).from(routinesTable).where(eq(routinesTable.childId, child.id));
  if (Number(routines) >= limits.maxRoutines) {
    fail(res, 402, `No plano grátis dá para ter até ${limits.maxRoutines} rotinas por criança. Assine o Premium para rotinas ilimitadas.`, "ROUTINE_LIMIT"); return;
  }
  const [routine] = await db.insert(routinesTable).values({
    familyId: m.familyId, childId: child.id, title: input.data.title, description: input.data.description ?? "",
    days: input.data.days, startTime: input.data.startTime, endTime: input.data.endTime,
    // Trava de tela é Premium: no grátis a rotina é criada sem ela (as sugestões por idade não falham).
    icon: input.data.icon ?? "clock", enabled: input.data.enabled ?? true, lockScreen: limits.lockScreen && (input.data.lockScreen ?? false),
  }).returning();
  await audit(m.familyId, m.userId, "routine.created", `Rotina "${routine.title}" criada para ${child.displayName}`);
  await notifyDevicesPolicyChanged(m.familyId, child.id);
  res.status(201).json(CreateRoutineResponse.parse(routineView(routine)));
});

router.patch("/family/routines/:routineId", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const p = UpdateRoutineParams.safeParse(req.params), input = UpdateRoutineBody.safeParse(req.body);
  if (!p.success || !input.success) { fail(res, 400, "Invalid request"); return; }
  const m = req.member!;
  if (input.data.lockScreen && !PLAN_LIMITS[await familyPlan(m.familyId)].lockScreen) {
    // Rebaixamento: a trava que já estava guardada pode continuar; só ligar uma nova é Premium.
    const [current] = await db.select({ lockScreen: routinesTable.lockScreen }).from(routinesTable)
      .where(and(eq(routinesTable.id, p.data.routineId), eq(routinesTable.familyId, m.familyId)));
    if (!current?.lockScreen) { fail(res, 402, "Travar a tela na hora de dormir é um recurso Premium.", "PREMIUM_FEATURE"); return; }
  }
  const [routine] = await db.update(routinesTable).set(input.data)
    .where(and(eq(routinesTable.id, p.data.routineId), eq(routinesTable.familyId, m.familyId))).returning();
  if (!routine) { fail(res, 404, "Routine not found"); return; }
  await audit(m.familyId, m.userId, "routine.updated", `Rotina "${routine.title}" ${input.data.enabled === false ? "pausada" : input.data.enabled ? "ativada" : "atualizada"}`);
  await notifyDevicesPolicyChanged(m.familyId, routine.childId);
  res.json(UpdateRoutineResponse.parse(routineView(routine)));
});

router.delete("/family/routines/:routineId", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const p = DeleteRoutineParams.safeParse(req.params);
  if (!p.success) { fail(res, 400, p.error.message); return; }
  const m = req.member!;
  const [routine] = await db.delete(routinesTable)
    .where(and(eq(routinesTable.id, p.data.routineId), eq(routinesTable.familyId, m.familyId))).returning();
  if (!routine) { fail(res, 404, "Routine not found"); return; }
  await audit(m.familyId, m.userId, "routine.deleted", `Rotina "${routine.title}" removida`);
  await notifyDevicesPolicyChanged(m.familyId, routine.childId);
  res.sendStatus(204);
});

/** Tempo extra só para hoje: não altera o limite diário (corrige o bug do limite que crescia para sempre). */
router.post("/family/children/:childId/grants", requireMember(...EDITORS), async (req: AuthedRequest, res): Promise<void> => {
  const p = CreateTimeGrantParams.safeParse(req.params), input = CreateTimeGrantBody.safeParse(req.body);
  if (!p.success || !input.success) { fail(res, 400, "Invalid request"); return; }
  const m = req.member!;
  const child = await activeChild(m.familyId, p.data.childId);
  if (!child) { fail(res, 404, "Child not found"); return; }
  const [rule] = await db.select().from(appRulesTable)
    .where(and(eq(appRulesTable.childId, child.id), eq(appRulesTable.appId, input.data.appId)));
  if (!rule) { fail(res, 404, "Rule not found"); return; }
  const today = await familyToday(m.familyId);
  const [{ total }] = await db.select({ total: sql<number>`coalesce(sum(${temporaryGrantsTable.minutes}), 0)::int` })
    .from(temporaryGrantsTable)
    .where(and(eq(temporaryGrantsTable.childId, child.id), eq(temporaryGrantsTable.appId, rule.appId), eq(temporaryGrantsTable.validOn, today)));
  if (Number(total) + input.data.minutes > 480) { fail(res, 409, "Máximo de 8 horas extras por app no mesmo dia", "GRANT_LIMIT"); return; }
  const [grant] = await db.insert(temporaryGrantsTable).values({
    familyId: m.familyId, childId: child.id, appId: rule.appId, minutes: input.data.minutes, validOn: today, source: "manual", createdBy: m.userId,
  }).returning();
  await audit(m.familyId, m.userId, "grant.created", `+${grant.minutes} min de ${rule.appName} hoje para ${child.displayName}`);
  await notifyDevicesPolicyChanged(m.familyId, child.id);
  res.status(201).json(CreateTimeGrantResponse.parse({ ...grant, source: "manual" }));
});

export default router;
