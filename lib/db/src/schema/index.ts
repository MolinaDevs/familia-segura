import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, uuid, integer, boolean, timestamp, jsonb, uniqueIndex, unique, index, date, primaryKey } from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const usersTable = pgTable("users", {
  id: id(), clerkUserId: text("clerk_user_id").notNull().unique(),
  displayName: text("display_name").notNull(), email: text("email"),
  createdAt: created(),
});

export const familiesTable = pgTable("families", {
  id: id(), name: text("name").notNull(), createdAt: created(),
  /** Fuso da família: define o "hoje" de limites, liberações e relatórios. */
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  /** Quantas horas o aparelho mantém as regras sem conseguir falar com o servidor. */
  offlineLeaseHours: integer("offline_lease_hours").notNull().default(72),
  /** PIN do responsável (scrypt) usado no aparelho da criança para ações protegidas. */
  guardianPinHash: text("guardian_pin_hash"),
  guardianPinSalt: text("guardian_pin_salt"),
  guardianPinUpdatedAt: timestamp("guardian_pin_updated_at", { withTimezone: true }),
  /** Android: apps instalados depois do pareamento ficam bloqueados até aprovação. */
  quarantineNewApps: boolean("quarantine_new_apps").notNull().default(true),
  /** iOS: denyAppInstallation. Android: loja e instaladores bloqueados (liberáveis pelo PIN). */
  blockAppInstalls: boolean("block_app_installs").notNull().default(true),
  /** iOS: denyAppRemoval. Android: telas de desinstalação de qualquer app bloqueadas. */
  blockAppRemoval: boolean("block_app_removal").notNull().default(true),
  /** iOS: filtro de conteúdo adulto da Apple ("adult") ou desligado ("off"). */
  webFilter: text("web_filter").notNull().default("adult"),
});

/** Papéis: owner (titular), guardian (co-responsável), viewer (só leitura). */
export const membershipsTable = pgTable("family_memberships", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(), role: text("role").notNull().default("owner"),
  invitedBy: uuid("invited_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: created(),
}, (t) => [uniqueIndex("family_membership_unique").on(t.familyId, t.userId), uniqueIndex("family_membership_user_unique").on(t.userId)]);

export const invitesTable = pgTable("family_invites", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull().unique(), role: text("role").notNull(),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: uuid("used_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: created(),
});

export const childrenTable = pgTable("children", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(), birthYear: integer("birth_year").notNull(),
  color: text("color").notNull().default("#2A5A4A"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [index("children_family_idx").on(t.familyId)]);

export const devicesTable = pgTable("devices", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(), platform: text("platform").notNull(), deviceTokenHash: text("device_token_hash").notNull().unique(), status: text("status").notNull().default("active"),
  protectionState: text("protection_state").notNull().default("unknown"),
  protectionIssues: jsonb("protection_issues").$type<string[]>().notNull().default([]),
  protectionUpdatedAt: timestamp("protection_updated_at", { withTimezone: true }),
  osVersion: text("os_version"), appVersion: text("app_version"), model: text("model"),
  timezone: text("timezone"), batteryLevel: integer("battery_level"),
  pushToken: text("push_token"),
  /** Liberação de instalação de apps dada à distância pelo responsável (iPhone e Android). */
  installUnlockUntil: timestamp("install_unlock_until", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(), createdAt: created(),
}, (t) => [index("devices_family_idx").on(t.familyId), index("devices_child_idx").on(t.childId)]);

export const pairingCodesTable = pgTable("pairing_codes", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }), createdAt: created(),
}, (t) => [index("pairing_codes_hash_idx").on(t.codeHash)]);

/**
 * Catálogo de apps. Linhas com family_id nulo são globais (curadas);
 * apps descobertos no inventário Android viram entradas da família (id = nome do pacote).
 */
export const appCatalogTable = pgTable("app_catalog", {
  id: text("id").notNull(),
  familyId: uuid("family_id").references(() => familiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(), category: text("category").notNull(),
  icon: text("icon").notNull().default("grid"), iconColor: text("icon_color").notNull().default("#718078"),
  androidPackages: jsonb("android_packages").$type<string[]>().notNull().default([]),
  iosBundleIds: jsonb("ios_bundle_ids").$type<string[]>().notNull().default([]),
  createdAt: created(),
}, (t) => [unique("app_catalog_scope_unique").on(t.familyId, t.id).nullsNotDistinct()]);

/** Regra de um app para uma criança. Vale para todos os aparelhos dela (iOS e Android). */
export const appRulesTable = pgTable("app_rules", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  appId: text("app_id").notNull(), appName: text("app_name").notNull(), category: text("category").notNull(),
  icon: text("icon").notNull(), iconColor: text("icon_color").notNull(),
  androidPackages: jsonb("android_packages").$type<string[]>().notNull().default([]),
  /** Legado: substituído por usage_daily. Mantido para bancos antigos. */
  usageTodayMinutes: integer("usage_today_minutes").notNull().default(0),
  dailyLimitMinutes: integer("daily_limit_minutes").notNull().default(60), status: text("status").notNull().default("allowed"),
}, (t) => [uniqueIndex("app_rules_child_app_unique").on(t.childId, t.appId)]);

export const routinesTable = pgTable("routines", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(), description: text("description").notNull(), days: text("days").notNull(),
  startTime: text("start_time").notNull(), endTime: text("end_time").notNull(), enabled: boolean("enabled").notNull().default(true), icon: text("icon").notNull(),
});

export const timeRequestsTable = pgTable("time_requests", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => devicesTable.id, { onDelete: "set null" }),
  appId: text("app_id").notNull(), appName: text("app_name").notNull(), requestedMinutes: integer("requested_minutes").notNull(),
  message: text("message").notNull(), status: text("status").notNull().default("pending"),
  resolvedBy: uuid("resolved_by").references(() => usersTable.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: created(),
});

/** Tempo extra válido só no dia indicado (fuso da família). Não altera o limite diário. */
export const temporaryGrantsTable = pgTable("temporary_grants", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  appId: text("app_id").notNull(), minutes: integer("minutes").notNull(),
  validOn: date("valid_on").notNull(), source: text("source").notNull(),
  timeRequestId: uuid("time_request_id").references(() => timeRequestsTable.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: created(),
}, (t) => [index("temporary_grants_child_day_idx").on(t.childId, t.validOn)]);

/** Uso acumulado do dia por aparelho e app (maior valor informado pelo aparelho). */
export const usageDailyTable = pgTable("usage_daily", {
  familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").notNull().references(() => devicesTable.id, { onDelete: "cascade" }),
  appId: text("app_id").notNull(), day: date("day").notNull(),
  minutes: integer("minutes").notNull().default(0),
  precision: text("precision").notNull().default("exact"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.deviceId, t.appId, t.day] }), index("usage_daily_child_day_idx").on(t.childId, t.day)]);

/** Distribuição por hora: cada sincronização soma o incremento na hora local informada. */
export const usageHourlyTable = pgTable("usage_hourly", {
  familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").notNull().references(() => devicesTable.id, { onDelete: "cascade" }),
  appId: text("app_id").notNull(), day: date("day").notNull(), hour: integer("hour").notNull(),
  minutes: integer("minutes").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.deviceId, t.appId, t.day, t.hour] }), index("usage_hourly_child_day_idx").on(t.childId, t.day)]);

/** Inventário de apps instalados (Android) e decisão do responsável. */
export const deviceAppsTable = pgTable("device_apps", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").notNull().references(() => devicesTable.id, { onDelete: "cascade" }),
  packageName: text("package_name").notNull(), label: text("label").notNull(),
  /** approved | blocked | pending (instalado depois do pareamento, aguardando o responsável) */
  status: text("status").notNull().default("approved"),
  installedAt: timestamp("installed_at", { withTimezone: true }),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("device_apps_unique").on(t.deviceId, t.packageName)]);

/** iOS: quais regras já têm app/categoria associados no aparelho (o token fica no aparelho). */
export const deviceRuleBindingsTable = pgTable("device_rule_bindings", {
  deviceId: uuid("device_id").notNull().references(() => devicesTable.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id").notNull().references(() => appRulesTable.id, { onDelete: "cascade" }),
  boundAt: timestamp("bound_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.deviceId, t.ruleId] })]);

/** Eventos do aparelho: proteção alterada, tentativa de adulteração, app instalado/removido, bloqueios. */
export const deviceEventsTable = pgTable("device_events", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").notNull().references(() => devicesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), detail: text("detail"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: created(),
}, (t) => [index("device_events_family_idx").on(t.familyId, t.occurredAt)]);

export const pushTokensTable = pgTable("push_tokens", {
  id: id(), userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), platform: text("platform").notNull(),
  createdAt: created(),
});

/** Rate limit persistente (sobrevive a reinícios e vale para várias instâncias). */
export const rateLimitsTable = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
});

export const auditEventsTable = pgTable("audit_events", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }), action: text("action").notNull(),
  summary: text("summary").notNull(), metadata: jsonb("metadata"), createdAt: created(),
});
export const consentsTable = pgTable("consents", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  consentType: text("consent_type").notNull(), acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable);
export const insertFamilySchema = createInsertSchema(familiesTable);
export const insertMembershipSchema = createInsertSchema(membershipsTable);
export const insertChildSchema = createInsertSchema(childrenTable);
export const insertDeviceSchema = createInsertSchema(devicesTable);
export const insertPairingCodeSchema = createInsertSchema(pairingCodesTable);
export const insertAppRuleSchema = createInsertSchema(appRulesTable);
export const insertRoutineSchema = createInsertSchema(routinesTable);
export const insertTimeRequestSchema = createInsertSchema(timeRequestsTable);
export const insertAuditEventSchema = createInsertSchema(auditEventsTable);
export const insertConsentSchema = createInsertSchema(consentsTable);
export type User = typeof usersTable.$inferSelect;
export type Family = typeof familiesTable.$inferSelect;
export type Membership = typeof membershipsTable.$inferSelect;
export type Child = typeof childrenTable.$inferSelect;
export type Device = typeof devicesTable.$inferSelect;
export type PairingCode = typeof pairingCodesTable.$inferSelect;
export type AppRule = typeof appRulesTable.$inferSelect;
export type Routine = typeof routinesTable.$inferSelect;
export type TimeRequest = typeof timeRequestsTable.$inferSelect;
export type AuditEvent = typeof auditEventsTable.$inferSelect;
export type Consent = typeof consentsTable.$inferSelect;
export type AppCatalogEntry = typeof appCatalogTable.$inferSelect;
export type TemporaryGrant = typeof temporaryGrantsTable.$inferSelect;
export type DeviceApp = typeof deviceAppsTable.$inferSelect;
export type DeviceEvent = typeof deviceEventsTable.$inferSelect;
