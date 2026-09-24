import { afterEach, describe, expect, it } from "vitest";
import { setPushTransport, type PushMessage } from "../src/lib/push";
import { api, asDevice, asGuardian, createFamily, pairDevice } from "./helpers";

const OWNER = "user_owner";
afterEach(() => setPushTransport(null));

describe("contrato do aparelho Android (Fase 2)", () => {
  it("aceita inventário com datas ISO e trata reinstalação como app novo", async () => {
    const family = await createFamily();
    const { device, deviceToken } = await pairDevice(OWNER, family.children[0].id);
    const now = new Date().toISOString();
    await api().post("/api/child/installed-apps").set(asDevice(deviceToken))
      .send({ snapshot: true, apps: [{ packageName: "com.roblox.client", label: "Roblox", installedAt: now }] }).expect(200);
    // desinstalou
    await api().post("/api/child/installed-apps").set(asDevice(deviceToken)).send({ snapshot: true, apps: [{ packageName: "com.whatsapp", label: "WhatsApp" }] }).expect(200);
    // reinstalou: volta como pendente
    const again = await api().post("/api/child/installed-apps").set(asDevice(deviceToken))
      .send({ snapshot: true, apps: [{ packageName: "com.whatsapp", label: "WhatsApp" }, { packageName: "com.roblox.client", label: "Roblox", installedAt: now }] });
    expect(again.body.pendingPackages.sort()).toEqual(["com.roblox.client", "com.whatsapp"]);
    const list = await api().get(`/api/family/devices/${device.id}/apps`).set(asGuardian(OWNER));
    expect(list.body.map((a: { packageName: string; status: string }) => `${a.packageName}:${a.status}`).sort())
      .toEqual(["com.roblox.client:pending", "com.whatsapp:pending"]);
  });

  it("app bloqueado continua bloqueado ao reinstalar", async () => {
    const family = await createFamily();
    const { device, deviceToken } = await pairDevice(OWNER, family.children[0].id);
    await api().post("/api/child/installed-apps").set(asDevice(deviceToken)).send({ snapshot: true, apps: [{ packageName: "com.tiktok", label: "TikTok" }] }).expect(200);
    await api().patch(`/api/family/devices/${device.id}/apps/com.tiktok`).set(asGuardian(OWNER)).send({ status: "blocked" }).expect(200);
    await api().post("/api/child/installed-apps").set(asDevice(deviceToken)).send({ snapshot: true, apps: [] }).expect(200);
    const back = await api().post("/api/child/installed-apps").set(asDevice(deviceToken)).send({ snapshot: true, apps: [{ packageName: "com.tiktok", label: "TikTok" }] });
    expect(back.body).toEqual({ blockedPackages: ["com.tiktok"], pendingPackages: [] });
  });

  it("eventos em lote com data do aparelho; relógio absurdo é corrigido", async () => {
    const family = await createFamily();
    const { deviceToken } = await pairDevice(OWNER, family.children[0].id);
    await api().post("/api/family/push-tokens").set(asGuardian(OWNER)).send({ token: "ExponentPushToken[g]", platform: "ios" }).expect(204);
    const sent: PushMessage[] = [];
    setPushTransport(async (m) => { sent.push(...m); });
    const recent = new Date(Date.now() - 60_000).toISOString();
    await api().post("/api/child/events").set(asDevice(deviceToken)).send({ events: [
      { type: "device_reboot", occurredAt: recent },
      { type: "limit_reached", detail: "YouTube", occurredAt: "2001-01-01T00:00:00.000Z" },
      { type: "tamper_attempt", detail: "Configurações do aparelho" },
    ] }).expect(204);
    const events = (await api().get("/api/family").set(asGuardian(OWNER))).body.recentEvents;
    expect(events.map((e: { type: string }) => e.type).sort()).toEqual(["device_reboot", "limit_reached", "tamper_attempt"]);
    const limit = events.find((e: { type: string }) => e.type === "limit_reached");
    expect(new Date(limit.occurredAt).getFullYear()).toBe(new Date().getFullYear());
    expect(sent).toHaveLength(1);
    expect(sent[0].title).toContain("Tentativa de mexer");
  });

  it("tipo de evento desconhecido é rejeitado", async () => {
    const family = await createFamily();
    const { deviceToken } = await pairDevice(OWNER, family.children[0].id);
    await api().post("/api/child/events").set(asDevice(deviceToken)).send({ events: [{ type: "hack" }] }).expect(400);
  });

  it("uso de apps sem regra também entra no relatório com o nome do inventário", async () => {
    const family = await createFamily();
    const { deviceToken } = await pairDevice(OWNER, family.children[0].id);
    await api().post("/api/child/installed-apps").set(asDevice(deviceToken)).send({ snapshot: true, apps: [{ packageName: "br.com.jogo.legal", label: "Jogo Legal" }] }).expect(200);
    await api().post("/api/child/usage").set(asDevice(deviceToken)).send({ precision: "exact", samples: [{ appId: "br.com.jogo.legal", usageTodayMinutes: 25 }] }).expect(204);
    const report = (await api().get("/api/family/reports/usage").set(asGuardian(OWNER))).body;
    expect(report.apps[0]).toMatchObject({ appId: "br.com.jogo.legal", appName: "Jogo Legal", minutes: 25 });
  });

  it("política do aparelho traz prazo offline configurável pela família", async () => {
    const family = await createFamily();
    const { deviceToken } = await pairDevice(OWNER, family.children[0].id);
    await api().patch("/api/family/settings").set(asGuardian(OWNER)).send({ offlineLeaseHours: 240 }).expect(200);
    const policy = (await api().get("/api/child/overview").set(asDevice(deviceToken))).body.policy;
    expect(policy).toMatchObject({ leaseHours: 240, quarantineNewApps: true, pinVerifier: null });
    await api().patch("/api/family/settings").set(asGuardian(OWNER)).send({ offlineLeaseHours: 5 }).expect(400);
  });
});
