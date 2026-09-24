import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db, devicesTable, membershipsTable, pushTokensTable } from "@workspace/db";
import { logger } from "./logger";

export type PushMessage = {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  priority?: "default" | "high";
  sound?: "default" | null;
  _contentAvailable?: boolean;
};

type Transport = (messages: PushMessage[]) => Promise<void>;

const expoTransport: Transport = async (messages) => {
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch),
    });
    if (!response.ok) logger.warn({ status: response.status }, "Falha ao enviar push");
  }
};

let transport: Transport | null = process.env.NODE_ENV === "test" || process.env.PUSH_DISABLED === "true" ? null : expoTransport;

/** Usado nos testes para capturar os envios. */
export function setPushTransport(next: Transport | null) {
  transport = next;
}

async function send(messages: PushMessage[]) {
  if (!transport || messages.length === 0) return;
  try {
    await transport(messages);
  } catch (error) {
    logger.warn({ err: error }, "Erro no envio de push");
  }
}

/** Avisa responsáveis (titular e co-responsáveis; observadores só se includeViewers). */
export async function notifyGuardians(
  familyId: string,
  message: { title: string; body: string; data?: Record<string, unknown> },
  options: { includeViewers?: boolean } = {},
) {
  const members = await db.select({ userId: membershipsTable.userId, role: membershipsTable.role })
    .from(membershipsTable).where(eq(membershipsTable.familyId, familyId));
  const userIds = members.filter((m) => options.includeViewers || m.role !== "viewer").map((m) => m.userId);
  if (userIds.length === 0) return;
  const tokens = await db.select({ token: pushTokensTable.token }).from(pushTokensTable).where(inArray(pushTokensTable.userId, userIds));
  await send(tokens.map(({ token }) => ({ to: token, title: message.title, body: message.body, data: message.data, sound: "default", priority: "high" })));
}

/** Push silencioso para os aparelhos buscarem as regras novas imediatamente. */
export async function notifyDevicesPolicyChanged(familyId: string, childId?: string) {
  const conditions = [eq(devicesTable.familyId, familyId), ne(devicesTable.status, "revoked"), isNotNull(devicesTable.pushToken)];
  if (childId) conditions.push(eq(devicesTable.childId, childId));
  const devices = await db.select({ token: devicesTable.pushToken }).from(devicesTable).where(and(...conditions));
  await send(devices.filter((d): d is { token: string } => Boolean(d.token)).map(({ token }) => ({
    to: token, data: { type: "policy_changed" }, _contentAvailable: true, priority: "high",
  })));
}
