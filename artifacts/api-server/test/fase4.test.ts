import { describe, expect, it } from "vitest";
import { db, usageDailyTable, usageHourlyTable } from "@workspace/db";
import { runRetention } from "../src/lib/retention";
import { api, asDevice, asGuardian, createFamily, pairDevice } from "./helpers";

describe("jurídico e retenção (Fase 4)", () => {
  it("páginas legais públicas, incluindo a versão para a criança", async () => {
    for (const page of ["privacy", "terms", "support", "delete-account", "crianca"]) {
      const res = await api().get(`/api/legal/${page}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain("Família Segura");
    }
    const privacy = await api().get("/api/legal/privacy");
    expect(privacy.text).toContain("LGPD");
    expect(privacy.text).toContain("ECA Digital");
  });

  it("apaga uso com mais de 12 meses e mantém o recente", async () => {
    const family = await createFamily();
    const { device, deviceToken } = await pairDevice("user_owner", family.children[0].id);
    await api().post("/api/child/usage").set(asDevice(deviceToken)).send({ samples: [{ appId: "youtube", usageTodayMinutes: 10 }] }).expect(204);
    const old = { familyId: family.family.id, childId: family.children[0].id, deviceId: device.id, appId: "youtube", day: "2020-01-01", minutes: 30 };
    await db.insert(usageDailyTable).values(old);
    await db.insert(usageHourlyTable).values({ ...old, hour: 10 });
    const removed = await runRetention();
    expect(removed).toMatchObject({ daily: 1, hourly: 1 });
    const report = (await api().get("/api/family/reports/usage").set(asGuardian("user_owner"))).body;
    expect(report.totals.minutes).toBe(10);
  });

  it("nova criança recebe cor da paleta validada", async () => {
    await createFamily();
    const res = await api().post("/api/family/children").set(asGuardian("user_owner")).send({ displayName: "Nina", birthYear: 2016 });
    expect(res.body.color).toBe("#eb6834");
  });
});

describe("robustez da API (Fase 5)", () => {
  it("aceita inventário Android grande (600 apps) e envia cabeçalhos de segurança", async () => {
    const family = await createFamily();
    const { deviceToken } = await pairDevice("user_owner", family.children[0].id);
    const apps = Array.from({ length: 600 }, (_, i) => ({ packageName: `br.com.exemplo.aplicativo.numero${i}`, label: `Aplicativo de exemplo número ${i} com nome comprido` }));
    const res = await api().post("/api/child/installed-apps").set(asDevice(deviceToken)).send({ snapshot: true, apps });
    expect(res.status).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("exclusão de conta (exigência Apple 5.1.1)", () => {
  const deleted = () => (globalThis as { __clerkDeleted?: string[] }).__clerkDeleted ?? [];

  it("co-responsável exclui a própria conta sem apagar a família; titular apaga tudo", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test";
    const { invite } = await import("./helpers");
    const family = await createFamily();
    await invite("user_owner", "user_guardian", "guardian");
    await api().delete("/api/account").set(asGuardian("user_guardian")).expect(204);
    expect(deleted()).toContain("user_guardian");
    expect((await api().get("/api/family").set(asGuardian("user_guardian"))).status).toBe(404);
    const overview = await api().get("/api/family").set(asGuardian("user_owner"));
    expect(overview.body.members).toHaveLength(1);

    const { deviceToken } = await pairDevice("user_owner", family.children[0].id);
    await api().delete("/api/account").set(asGuardian("user_owner")).expect(204);
    expect(deleted()).toContain("user_owner");
    expect((await api().get("/api/family").set(asGuardian("user_owner"))).status).toBe(404);
    expect((await api().get("/api/child/overview").set(asDevice(deviceToken))).status).toBe(401);
    delete process.env.CLERK_SECRET_KEY;
  });
});

describe("limite por criança com vários aparelhos", () => {
  it("cada aparelho recebe quanto já foi usado nos outros", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const phone = await pairDevice("user_owner", childId, "android", "Celular");
    const tablet = await pairDevice("user_owner", childId, "ios", "Tablet");
    await api().post("/api/child/usage").set(asDevice(phone.deviceToken)).send({ samples: [{ appId: "youtube", usageTodayMinutes: 40 }] }).expect(204);
    await api().post("/api/child/usage").set(asDevice(tablet.deviceToken)).send({ samples: [{ appId: "youtube", usageTodayMinutes: 15 }] }).expect(204);
    const onPhone = (await api().get("/api/child/overview").set(asDevice(phone.deviceToken))).body.apps[0];
    const onTablet = (await api().get("/api/child/overview").set(asDevice(tablet.deviceToken))).body.apps[0];
    expect(onPhone).toMatchObject({ usageTodayMinutes: 55, otherDevicesUsageMinutes: 15 });
    expect(onTablet).toMatchObject({ usageTodayMinutes: 55, otherDevicesUsageMinutes: 40 });
    const guardian = (await api().get("/api/family").set(asGuardian("user_owner"))).body.apps[0];
    expect(guardian).toMatchObject({ usageTodayMinutes: 55, otherDevicesUsageMinutes: 0 });
  });
});

describe("erros viram JSON", () => {
  it("JSON malformado responde 400 em JSON, sem stack", async () => {
    const res = await api().post("/api/family").set(asGuardian("u")).set("Content-Type", "application/json").send("{quebrado");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Requisição inválida" });
  });
});

describe("modo demonstração (somente desenvolvimento)", () => {
  it("aceita dev:<usuario> só com DEV_AUTH=true e fora de produção", async () => {
    const bearer = { Authorization: "Bearer dev:ana" };
    expect((await api().get("/api/family").set(bearer)).status).toBe(401);
    process.env.DEV_AUTH = "true";
    expect((await api().get("/api/family").set(bearer)).status).toBe(404);
    process.env.NODE_ENV = "production";
    expect((await api().get("/api/family").set(bearer)).status).toBe(401);
    process.env.NODE_ENV = "test";
    delete process.env.DEV_AUTH;
  });
});

describe("liberação de instalação à distância", () => {
  it("responsável libera por minutos; app instalado nesse período entra aprovado; 0 encerra", async () => {
    const family = await createFamily();
    const { device, deviceToken } = await pairDevice("user_owner", family.children[0].id);
    await api().post("/api/child/installed-apps").set(asDevice(deviceToken)).send({ snapshot: true, apps: [{ packageName: "com.whatsapp", label: "WhatsApp" }] }).expect(200);
    const unlocked = await api().post(`/api/family/devices/${device.id}/install-unlock`).set(asGuardian("user_owner")).send({ minutes: 15 });
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.installUnlockUntil).toBeTruthy();
    const policy = (await api().get("/api/child/overview").set(asDevice(deviceToken))).body.policy;
    expect(new Date(policy.installUnlockUntil).getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    const res = await api().post("/api/child/installed-apps").set(asDevice(deviceToken))
      .send({ snapshot: true, apps: [{ packageName: "com.whatsapp", label: "WhatsApp" }, { packageName: "br.escola.app", label: "App da Escola" }] });
    expect(res.body.pendingPackages).toEqual([]);
    await api().post(`/api/family/devices/${device.id}/install-unlock`).set(asGuardian("user_owner")).send({ minutes: 0 }).expect(200);
    expect((await api().get("/api/child/overview").set(asDevice(deviceToken))).body.policy.installUnlockUntil).toBeNull();
    const blocked = await api().post(`/api/family/devices/${device.id}/install-unlock`).set(asGuardian("user_owner")).send({ minutes: 120 });
    expect(blocked.status).toBe(400);
  });
});

describe("fim da liberação de instalação", () => {
  it("prazo vencido é apagado e o aparelho recebe push para bloquear de novo", async () => {
    const { setPushTransport } = await import("../src/lib/push");
    const { expireInstallUnlocks } = await import("../src/lib/unlockExpiry");
    const family = await createFamily();
    const { device, deviceToken } = await pairDevice("user_owner", family.children[0].id, "ios");
    await api().post("/api/child/push-token").set(asDevice(deviceToken)).send({ token: "ExponentPushToken[ipad]", platform: "ios" }).expect(204);
    await api().post(`/api/family/devices/${device.id}/install-unlock`).set(asGuardian("user_owner")).send({ minutes: 5 }).expect(200);
    const sent: Array<{ to: string }> = [];
    setPushTransport(async (m) => { sent.push(...m); });
    expect(await expireInstallUnlocks(new Date(Date.now() + 60_000))).toBe(0);
    expect(await expireInstallUnlocks(new Date(Date.now() + 6 * 60_000))).toBe(1);
    expect(sent.map((m) => m.to)).toEqual(["ExponentPushToken[ipad]"]);
    setPushTransport(null);
    const policy = (await api().get("/api/child/overview").set(asDevice(deviceToken))).body.policy;
    expect(policy.installUnlockUntil).toBeNull();
  });
});

describe("pedido para instalar app", () => {
  it("criança pede, responsável aprova e o aparelho fica liberado; sem aparelho é recusado", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const { device, deviceToken } = await pairDevice("user_owner", childId, "ios");
    const req = await api().post("/api/family/time-requests").set(asDevice(deviceToken))
      .send({ kind: "install", childId, appId: "Minecraft", requestedMinutes: 15, message: "trabalho da escola" });
    expect(req.status).toBe(201);
    expect(req.body).toMatchObject({ kind: "install", appName: "Minecraft", deviceId: device.id });
    await api().patch(`/api/family/time-requests/${req.body.id}`).set(asGuardian("user_owner")).send({ status: "approved" }).expect(200);
    const policy = (await api().get("/api/child/overview").set(asDevice(deviceToken))).body.policy;
    expect(new Date(policy.installUnlockUntil).getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    const overview = (await api().get("/api/family").set(asGuardian("user_owner"))).body;
    expect(overview.apps.every((a: { extraTodayMinutes: number }) => a.extraTodayMinutes === 0)).toBe(true);
    const byGuardian = await api().post("/api/family/time-requests").set(asGuardian("user_owner"))
      .send({ kind: "install", childId, appId: "Roblox", requestedMinutes: 15, message: "" });
    expect(byGuardian.status).toBe(400);
  });
});
