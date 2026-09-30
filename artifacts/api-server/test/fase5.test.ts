import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { childrenTable, db } from "@workspace/db";
import { setPushTransport, type PushMessage } from "../src/lib/push";
import { expirePauses } from "../src/lib/unlockExpiry";
import { api, asDevice, asGuardian, createFamily, invite, pairDevice, setPremium } from "./helpers";

const OWNER = "user_owner";
afterEach(() => setPushTransport(null));

describe("pausar agora", () => {
  it("vale no plano grátis, chega ao aparelho e pode ser encerrada", async () => {
    setPremium(false);
    const family = await createFamily();
    const childId = family.children[0].id;
    const { deviceToken } = await pairDevice(OWNER, childId, "android");
    const sent: PushMessage[] = [];
    setPushTransport(async (messages) => { sent.push(...messages); });
    await api().post("/api/child/push-token").set(asDevice(deviceToken)).send({ token: "ExponentPushToken[crianca]", platform: "android" }).expect(204);

    const paused = await api().post(`/api/family/children/${childId}/pause`).set(asGuardian(OWNER)).send({ minutes: 30 });
    expect(paused.status).toBe(200);
    const until = new Date(paused.body.pausedUntil).getTime();
    expect(until - Date.now()).toBeGreaterThan(29 * 60_000);
    expect(until - Date.now()).toBeLessThanOrEqual(30 * 60_000);
    // O aparelho recebe o aviso para aplicar na hora e a política traz a pausa.
    expect(sent.some((m) => m.to === "ExponentPushToken[crianca]")).toBe(true);
    const policy = (await api().get("/api/child/overview").set(asDevice(deviceToken))).body.policy;
    expect(policy.pausedUntil).toBeTruthy();
    const overview = (await api().get("/api/family").set(asGuardian(OWNER))).body;
    expect(overview.children[0].pausedUntil).toBeTruthy();

    const resumed = await api().delete(`/api/family/children/${childId}/pause`).set(asGuardian(OWNER));
    expect(resumed.status).toBe(200);
    expect(resumed.body.pausedUntil).toBeNull();
    expect((await api().get("/api/child/overview").set(asDevice(deviceToken))).body.policy.pausedUntil).toBeNull();
  });

  it("\"até liberar\" dura até o responsável encerrar; observador não pausa; valores inválidos recusados", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const untilRelease = await api().post(`/api/family/children/${childId}/pause`).set(asGuardian(OWNER)).send({ minutes: 0 });
    expect(new Date(untilRelease.body.pausedUntil).getTime() - Date.now()).toBeGreaterThan(7 * 24 * 3600_000);
    expect((await api().post(`/api/family/children/${childId}/pause`).set(asGuardian(OWNER)).send({ minutes: 721 })).status).toBe(400);
    await invite(OWNER, "user_vo", "viewer", "Vó");
    expect((await api().post(`/api/family/children/${childId}/pause`).set(asGuardian("user_vo")).send({ minutes: 15 })).status).toBe(403);
    // Outra família não enxerga a criança.
    await createFamily("user_outra");
    expect((await api().post(`/api/family/children/${childId}/pause`).set(asGuardian("user_outra")).send({ minutes: 15 })).status).toBe(404);
  });

  it("pausa vencida é encerrada pela tarefa e o aparelho é avisado", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const { deviceToken } = await pairDevice(OWNER, childId, "ios");
    const sent: PushMessage[] = [];
    setPushTransport(async (messages) => { sent.push(...messages); });
    await api().post("/api/child/push-token").set(asDevice(deviceToken)).send({ token: "ExponentPushToken[ipad]", platform: "ios" }).expect(204);
    await db.update(childrenTable).set({ pausedUntil: new Date(Date.now() - 1000) }).where(eq(childrenTable.id, childId));
    expect(await expirePauses()).toBeGreaterThanOrEqual(1);
    const [row] = await db.select({ pausedUntil: childrenTable.pausedUntil }).from(childrenTable).where(eq(childrenTable.id, childId));
    expect(row.pausedUntil).toBeNull();
    expect(sent.some((m) => m.to === "ExponentPushToken[ipad]")).toBe(true);
  });
});
