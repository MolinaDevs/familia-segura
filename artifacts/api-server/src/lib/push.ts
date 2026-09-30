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

/** Resultado por mensagem, na mesma ordem (formato dos "tickets" da Expo). */
export type PushTicket = { status: "ok" | "error"; details?: { error?: string } };
type Transport = (messages: PushMessage[]) => Promise<PushTicket[] | void>;

const SEND_TIMEOUT_MS = 8_000;

const expoTransport: Transport = async (messages) => {
  const tickets: PushTicket[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    // Com prazo: a Expo lenta não pode segurar a resposta da API (os envios acontecem dentro das rotas).
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn({ status: response.status }, "Falha ao enviar push");
      tickets.push(...batch.map(() => ({ status: "error" as const })));
      continue;
    }
    const payload = (await response.json().catch(() => null)) as { data?: PushTicket[] } | null;
    tickets.push(...(payload?.data ?? batch.map(() => ({ status: "ok" as const }))));
  }
  return tickets;
};

let transport: Transport | null = process.env.NODE_ENV === "test" || process.env.PUSH_DISABLED === "true" ? null : expoTransport;

/** Usado nos testes para capturar os envios. */
export function setPushTransport(next: Transport | null) {
  transport = next;
}

async function send(messages: PushMessage[]) {
  if (!transport || messages.length === 0) return;
  try {
    const tickets = await transport(messages);
    if (tickets) await forgetUnregistered(messages, tickets);
  } catch (error) {
    logger.warn({ err: error }, "Erro no envio de push");
  }
}

/**
 * App desinstalado ou token trocado: a Expo responde DeviceNotRegistered. O token é apagado para não
 * acumular envios inúteis (e a Expo/Apple não penalizarem o remetente).
 */
async function forgetUnregistered(messages: PushMessage[], tickets: PushTicket[]) {
  const dead = messages.filter((_, i) => tickets[i]?.status === "error" && tickets[i]?.details?.error === "DeviceNotRegistered").map((m) => m.to);
  if (dead.length === 0) return;
  await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, dead));
  await db.update(devicesTable).set({ pushToken: null }).where(inArray(devicesTable.pushToken, dead));
  logger.info({ removed: dead.length }, "Tokens de push inválidos removidos");
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
