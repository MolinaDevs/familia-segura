import { db, auditEventsTable } from "@workspace/db";

export const audit = (familyId: string, userId: string | undefined, action: string, summary: string, metadata?: Record<string, unknown>) =>
  db.insert(auditEventsTable).values({ familyId, userId, action, summary, metadata });
