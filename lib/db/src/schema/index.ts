import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, uuid, integer, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const usersTable = pgTable("users", {
  id: id(), clerkUserId: text("clerk_user_id").notNull().unique(),
  displayName: text("display_name").notNull(), email: text("email"),
  createdAt: created(),
});
export const familiesTable = pgTable("families", {
  id: id(), name: text("name").notNull(), createdAt: created(),
});
export const membershipsTable = pgTable("family_memberships", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(), role: text("role").notNull().default("owner"),
  createdAt: created(),
}, (t) => [uniqueIndex("family_membership_unique").on(t.familyId, t.userId), uniqueIndex("family_membership_user_unique").on(t.userId)]);
export const childrenTable = pgTable("children", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(), birthYear: integer("birth_year").notNull(), createdAt: created(),
});
export const devicesTable = pgTable("devices", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(), platform: text("platform").notNull(), deviceTokenHash: text("device_token_hash").notNull().unique(), status: text("status").notNull().default("active"),
  protectionState: text("protection_state").notNull().default("unknown"),
  protectionIssues: jsonb("protection_issues").$type<string[]>().notNull().default([]),
  protectionUpdatedAt: timestamp("protection_updated_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(), createdAt: created(),
});
export const pairingCodesTable = pgTable("pairing_codes", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }), createdAt: created(),
});
export const appRulesTable = pgTable("app_rules", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  appId: text("app_id").notNull(), appName: text("app_name").notNull(), category: text("category").notNull(),
  icon: text("icon").notNull(), iconColor: text("icon_color").notNull(), usageTodayMinutes: integer("usage_today_minutes").notNull().default(0),
  dailyLimitMinutes: integer("daily_limit_minutes").notNull().default(60), status: text("status").notNull().default("allowed"),
});
export const routinesTable = pgTable("routines", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(), description: text("description").notNull(), days: text("days").notNull(),
  startTime: text("start_time").notNull(), endTime: text("end_time").notNull(), enabled: boolean("enabled").notNull().default(true), icon: text("icon").notNull(),
});
export const timeRequestsTable = pgTable("time_requests", {
  id: id(), familyId: uuid("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  childId: uuid("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  appId: text("app_id").notNull(), appName: text("app_name").notNull(), requestedMinutes: integer("requested_minutes").notNull(),
  message: text("message").notNull(), status: text("status").notNull().default("pending"), createdAt: created(),
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