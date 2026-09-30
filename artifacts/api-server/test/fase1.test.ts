import { afterEach, describe, expect, it } from "vitest";
import { scryptSync } from "node:crypto";
import { setPushTransport, type PushMessage } from "../src/lib/push";
import { addChild, api, asDevice, asGuardian, createFamily, invite, pairDevice, setPremium } from "./helpers";

const OWNER = "user_owner";

afterEach(() => setPushTransport(null));

async function registerGuardianPush(userId = OWNER) {
  await api().post("/api/family/push-tokens").set(asGuardian(userId)).send({ token: `ExponentPushToken[${userId}]`, platform: "android" }).expect(204);
}

function capturePush() {
  const sent: PushMessage[] = [];
  setPushTransport(async (messages) => { sent.push(...messages); });
  return sent;
}

describe("limites da família: 10 crianças e 10 aparelhos", () => {
  it("plano gratuito: 1 criança e 1 aparelho, com 402 pedindo Premium", async () => {
    setPremium(false);
    const family = await createFamily();
    const second = await addChild(OWNER, "Bia");
    expect(second.status).toBe(402);
    expect(second.body.code).toBe("CHILD_LIMIT");
    await pairDevice(OWNER, family.children[0].id);
    const code = await api().post("/api/family/pairing-codes").set(asGuardian(OWNER)).send({ childId: family.children[0].id });
    expect(code.status).toBe(402);
    expect(code.body.code).toBe("DEVICE_LIMIT");
  });

  it("Premium: até 10 crianças; a 11ª é recusada", async () => {
    await createFamily();
    for (let i = 2; i <= 10; i++) expect((await addChild(OWNER, `Criança ${i}`)).status).toBe(201);
    const eleventh = await addChild(OWNER, "Excedente");
    expect(eleventh.status).toBe(409);
    const overview = await api().get("/api/family").set(asGuardian(OWNER));
    expect(overview.body.children).toHaveLength(10);
    expect(overview.body.limits).toMatchObject({ plan: "premium", maxChildren: 10, maxDevices: 10, children: 10 });
  });

  it("criações simultâneas nunca passam de 10 crianças (trava transacional)", async () => {
    await createFamily();
    const results = await Promise.all(Array.from({ length: 14 }, (_, i) => addChild(OWNER, `Paralela ${i}`)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(9);
    const overview = await api().get("/api/family").set(asGuardian(OWNER));
    expect(overview.body.children).toHaveLength(10);
  });

  it("Premium: até 10 aparelhos; revogar libera a vaga", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const devices = [];
    for (let i = 0; i < 10; i++) devices.push(await pairDevice(OWNER, childId, i % 2 ? "ios" : "android", `Aparelho ${i}`));
    const blocked = await api().post("/api/family/pairing-codes").set(asGuardian(OWNER)).send({ childId });
    expect(blocked.status).toBe(409);
    await api().delete(`/api/family/devices/${devices[0].device.id}`).set(asGuardian(OWNER)).expect(204);
    await pairDevice(OWNER, childId, "ios", "Substituto");
  });

  it("pareamentos simultâneos respeitam o limite de aparelhos", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    for (let i = 0; i < 8; i++) await pairDevice(OWNER, childId, "android", `A${i}`);
    const codes = await Promise.all(Array.from({ length: 5 }, () =>
      api().post("/api/family/pairing-codes").set(asGuardian(OWNER)).send({ childId })));
    const pairs = await Promise.all(codes.map((c) =>
      api().post("/api/family/devices/pair").send({ code: c.body.code, name: "Corrida", platform: "ios" })));
    expect(pairs.filter((p) => p.status === 201)).toHaveLength(2);
    expect(pairs.filter((p) => p.status === 409)).toHaveLength(3);
  });

  it("criança arquivada libera a vaga e revoga os aparelhos dela", async () => {
    const family = await createFamily();
    const { deviceToken } = await pairDevice(OWNER, family.children[0].id);
    await api().delete(`/api/family/children/${family.children[0].id}`).set(asGuardian(OWNER)).expect(204);
    expect((await api().get("/api/child/overview").set(asDevice(deviceToken))).status).toBe(401);
    const overview = await api().get("/api/family").set(asGuardian(OWNER));
    expect(overview.body.limits.children).toBe(0);
    expect(overview.body.limits.devices).toBe(0);
  });
});

describe("plataformas cruzadas", () => {
  it("a mesma regra vale para iPhone e Android da mesma criança", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const android = await pairDevice(OWNER, childId, "android", "Galaxy");
    const iphone = await pairDevice(OWNER, childId, "ios", "iPhone");
    await api().patch("/api/family/apps/youtube/rules").set(asGuardian(OWNER)).send({ childId, dailyLimitMinutes: 45 }).expect(200);
    for (const token of [android.deviceToken, iphone.deviceToken]) {
      const res = await api().get("/api/child/overview").set(asDevice(token));
      expect(res.status).toBe(200);
      const youtube = res.body.apps.find((a: { appId: string }) => a.appId === "youtube");
      expect(youtube.dailyLimitMinutes).toBe(45);
      expect(youtube.androidPackages).toContain("com.google.android.youtube");
    }
    const overview = await api().get("/api/family").set(asGuardian(OWNER));
    expect(overview.body.devices.map((d: { platform: string }) => d.platform).sort()).toEqual(["android", "ios"]);
  });

  it("iPhone informa quais regras já têm app associado (tokens ficam no aparelho)", async () => {
    const family = await createFamily();
    const iphone = await pairDevice(OWNER, family.children[0].id, "ios");
    const overview = await api().get("/api/child/overview").set(asDevice(iphone.deviceToken));
    const ruleId = overview.body.apps[0].id;
    await api().post("/api/child/protection").set(asDevice(iphone.deviceToken))
      .send({ state: "active", issues: [], boundRuleIds: [ruleId, "00000000-0000-0000-0000-000000000000"], osVersion: "18.1", model: "iPhone 15" })
      .expect(204);
    const guardian = await api().get("/api/family").set(asGuardian(OWNER));
    expect(guardian.body.devices[0]).toMatchObject({ osVersion: "18.1", model: "iPhone 15", protectionState: "active" });
  });
});

describe("papéis e convites", () => {
  it("co-responsável edita regras; observador só lê; só o titular convida", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    expect((await invite(OWNER, "user_guardian", "guardian", "Carlos")).status).toBe(200);
    expect((await invite(OWNER, "user_viewer", "viewer", "Vó Maria")).status).toBe(200);

    await api().patch("/api/family/apps/youtube/rules").set(asGuardian("user_guardian")).send({ childId, dailyLimitMinutes: 30 }).expect(200);
    const denied = await api().patch("/api/family/apps/youtube/rules").set(asGuardian("user_viewer")).send({ childId, dailyLimitMinutes: 300 });
    expect(denied.status).toBe(403);
    expect((await api().get("/api/family").set(asGuardian("user_viewer"))).status).toBe(200);
    expect((await api().post("/api/family/invites").set(asGuardian("user_guardian")).send({ role: "viewer" })).status).toBe(403);

    const members = (await api().get("/api/family").set(asGuardian(OWNER))).body.members;
    expect(members.map((m: { role: string }) => m.role).sort()).toEqual(["guardian", "owner", "viewer"]);
  });

  it("convite é de uso único e respeita o limite de 4 responsáveis", async () => {
    await createFamily();
    const created = await api().post("/api/family/invites").set(asGuardian(OWNER)).send({ role: "guardian" });
    await api().post("/api/family/invites/accept").set(asGuardian("u2")).send({ code: created.body.code, displayName: "Dois", consentAccepted: true }).expect(200);
    const reuse = await api().post("/api/family/invites/accept").set(asGuardian("u3")).send({ code: created.body.code, displayName: "Três", consentAccepted: true });
    expect(reuse.status).toBe(400);
    await invite(OWNER, "u3", "viewer");
    await invite(OWNER, "u4", "viewer");
    const fifth = await api().post("/api/family/invites").set(asGuardian(OWNER)).send({ role: "viewer" });
    expect(fifth.status).toBe(409);
  });

  it("plano gratuito não convida responsáveis", async () => {
    setPremium(false);
    await createFamily();
    expect((await api().post("/api/family/invites").set(asGuardian(OWNER)).send({ role: "guardian" })).status).toBe(402);
  });

  it("co-responsável herda o Premium do titular e pode sair da família", async () => {
    await createFamily();
    await invite(OWNER, "user_guardian", "guardian");
    expect((await addChild("user_guardian", "Nina")).status).toBe(201);
    const me = (await api().get("/api/family").set(asGuardian("user_guardian"))).body.members.find((m: { isCurrentUser: boolean }) => m.isCurrentUser);
    await api().delete(`/api/family/members/${me.id}`).set(asGuardian("user_guardian")).expect(204);
    expect((await api().get("/api/family").set(asGuardian("user_guardian"))).status).toBe(404);
  });
});

describe("tempo extra e pedidos (correção do bug do limite permanente)", () => {
  it("aprovar pedido libera minutos só hoje, sem mudar o limite diário", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const { deviceToken } = await pairDevice(OWNER, childId);
    await registerGuardianPush();
    const sent = capturePush();
    const request = await api().post("/api/family/time-requests").set(asDevice(deviceToken))
      .send({ childId, appId: "youtube", requestedMinutes: 20, message: "terminar o vídeo" });
    expect(request.status).toBe(201);
    expect(request.body.appName).toBe("YouTube");
    expect(sent.some((m) => m.title?.includes("pediu mais tempo"))).toBe(true);

    await api().patch(`/api/family/time-requests/${request.body.id}`).set(asGuardian(OWNER)).send({ status: "approved" }).expect(200);
    const guardianView = (await api().get("/api/family").set(asGuardian(OWNER))).body.apps[0];
    expect(guardianView).toMatchObject({ dailyLimitMinutes: 60, extraTodayMinutes: 20, effectiveLimitMinutes: 80 });
    const childView = (await api().get("/api/child/overview").set(asDevice(deviceToken))).body.apps[0];
    expect(childView.dailyLimitMinutes).toBe(80);
  });

  it("tempo extra manual em app bloqueado libera só os minutos concedidos", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const { deviceToken } = await pairDevice(OWNER, childId);
    await api().patch("/api/family/apps/youtube/rules").set(asGuardian(OWNER)).send({ childId, status: "blocked" }).expect(200);
    expect((await api().get("/api/child/overview").set(asDevice(deviceToken))).body.apps[0].status).toBe("blocked");
    await api().post(`/api/family/children/${childId}/grants`).set(asGuardian(OWNER)).send({ appId: "youtube", minutes: 15 }).expect(201);
    const app = (await api().get("/api/child/overview").set(asDevice(deviceToken))).body.apps[0];
    expect(app).toMatchObject({ status: "allowed", dailyLimitMinutes: 15 });
    const rule = (await api().get("/api/family").set(asGuardian(OWNER))).body.apps[0];
    expect(rule.status).toBe("blocked");
  });

  it("negar pedido não libera nada; pedido só para app com regra", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const { deviceToken } = await pairDevice(OWNER, childId);
    const unknown = await api().post("/api/family/time-requests").set(asDevice(deviceToken)).send({ childId, appId: "tiktok", requestedMinutes: 10, message: "" });
    expect(unknown.status).toBe(404);
    const request = await api().post("/api/family/time-requests").set(asDevice(deviceToken)).send({ childId, appId: "youtube", requestedMinutes: 10, message: "" });
    await api().patch(`/api/family/time-requests/${request.body.id}`).set(asGuardian(OWNER)).send({ status: "denied" }).expect(200);
    expect((await api().get("/api/family").set(asGuardian(OWNER))).body.apps[0].extraTodayMinutes).toBe(0);
  });
});

describe("regras e rotinas", () => {
  it("adiciona app do catálogo, app personalizado e remove", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const tiktok = await api().post(`/api/family/children/${childId}/apps`).set(asGuardian(OWNER)).send({ catalogAppId: "tiktok", dailyLimitMinutes: 30 });
    expect(tiktok.status).toBe(201);
    expect(tiktok.body.androidPackages).toContain("com.zhiliaoapp.musically");
    expect((await api().post(`/api/family/children/${childId}/apps`).set(asGuardian(OWNER)).send({ catalogAppId: "tiktok" })).status).toBe(409);
    const custom = await api().post(`/api/family/children/${childId}/apps`).set(asGuardian(OWNER)).send({ name: "Jogo da Escola", androidPackages: ["br.com.escola.jogo"] });
    expect(custom.body.appId).toBe("custom-jogo-da-escola");
    await api().delete(`/api/family/children/${childId}/apps/tiktok`).set(asGuardian(OWNER)).expect(204);
    const catalog = await api().get("/api/catalog/apps").set(asGuardian(OWNER));
    expect(catalog.body.length).toBeGreaterThan(20);
  });

  it("cria, edita e remove rotina", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const created = await api().post(`/api/family/children/${childId}/routines`).set(asGuardian(OWNER))
      .send({ title: "Escola", days: "seg,ter,qua,qui,sex", startTime: "07:00", endTime: "12:00", icon: "book" });
    expect(created.status).toBe(201);
    const invalid = await api().post(`/api/family/children/${childId}/routines`).set(asGuardian(OWNER))
      .send({ title: "X", days: "segunda", startTime: "07:00", endTime: "08:00" });
    expect(invalid.status).toBe(400);
    await api().patch(`/api/family/routines/${created.body.id}`).set(asGuardian(OWNER)).send({ enabled: false }).expect(200);
    await api().delete(`/api/family/routines/${created.body.id}`).set(asGuardian(OWNER)).expect(204);
  });

  it("travar a tela: Premium liga por rotina e chega ao aparelho; grátis recusa", async () => {
    setPremium(false);
    const family = await createFamily();
    const childId = family.children[0].id;
    const bedtime = family.routines.find((r: { title: string }) => r.title === "Hora de dormir");
    expect(bedtime?.lockScreen).toBe(false);
    // Grátis: ligar a trava é recurso Premium.
    const free = await api().patch(`/api/family/routines/${bedtime.id}`).set(asGuardian(OWNER)).send({ lockScreen: true });
    expect(free.status).toBe(402);
    expect(free.body.code).toBe("PREMIUM_FEATURE");
    setPremium(true);
    const updated = await api().patch(`/api/family/routines/${bedtime.id}`).set(asGuardian(OWNER)).send({ lockScreen: true });
    expect(updated.body.lockScreen).toBe(true);
    const { deviceToken } = await pairDevice(OWNER, childId, "android");
    const overview = (await api().get("/api/child/overview").set(asDevice(deviceToken))).body;
    expect(overview.routines.find((r: { id: string }) => r.id === bedtime.id)?.lockScreen).toBe(true);
    // Rebaixamento: a configuração fica guardada, mas deixa de valer no aparelho.
    setPremium(false);
    const after = (await api().get("/api/child/overview").set(asDevice(deviceToken))).body;
    expect(after.routines.find((r: { id: string }) => r.id === bedtime.id)?.lockScreen).toBe(false);
  });

  it("plano gratuito também edita limites e bloqueios (o básico não é pago)", async () => {
    setPremium(false);
    const family = await createFamily();
    await api().patch("/api/family/apps/youtube/rules").set(asGuardian(OWNER)).send({ childId: family.children[0].id, status: "blocked" }).expect(200);
  });
});

describe("uso e relatórios", () => {
  it("guarda o acumulado do dia, distribui por hora e alimenta os gráficos", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const { deviceToken } = await pairDevice(OWNER, childId);
    const today = (await api().get("/api/family").set(asGuardian(OWNER))).body.today;
    await api().post("/api/child/usage").set(asDevice(deviceToken)).send({ localDate: today, localHour: 9, samples: [{ appId: "youtube", usageTodayMinutes: 20 }] }).expect(204);
    await api().post("/api/child/usage").set(asDevice(deviceToken)).send({ localDate: today, localHour: 15, samples: [{ appId: "youtube", usageTodayMinutes: 50 }, { appId: "com.roblox.client", usageTodayMinutes: 10 }] }).expect(204);
    // valor menor (reenvio atrasado) não reduz nem duplica
    await api().post("/api/child/usage").set(asDevice(deviceToken)).send({ localDate: today, localHour: 16, samples: [{ appId: "youtube", usageTodayMinutes: 30 }] }).expect(204);

    const rule = (await api().get("/api/family").set(asGuardian(OWNER))).body.apps[0];
    expect(rule.usageTodayMinutes).toBe(50);

    const report = await api().get(`/api/family/reports/usage?days=7&childId=${childId}`).set(asGuardian(OWNER));
    expect(report.status).toBe(200);
    expect(report.body.totals.minutes).toBe(60);
    expect(report.body.daily).toHaveLength(7);
    expect(report.body.apps[0]).toMatchObject({ appId: "youtube", appName: "YouTube", minutes: 50 });
    expect(report.body.apps[1]).toMatchObject({ appName: "Roblox", minutes: 10 });
    const hours = Object.fromEntries(report.body.heatmap.map((h: { hour: number; minutes: number }) => [h.hour, h.minutes]));
    expect(hours).toMatchObject({ 9: 20, 15: 40 });
    expect(report.body.children[0]).toMatchObject({ name: "Leo", minutes: 60 });
    expect(report.body.compliance.limitsReached).toBe(0);
  });

  it("iPhone gera dado marcado como estimado; limite atingido entra no cumprimento", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const iphone = await pairDevice(OWNER, childId, "ios");
    await api().post("/api/child/usage").set(asDevice(iphone.deviceToken)).send({ samples: [{ appId: "youtube", usageTodayMinutes: 60 }] }).expect(204);
    const report = (await api().get("/api/family/reports/usage").set(asGuardian(OWNER))).body;
    expect(report.precision).toBe("estimated");
    expect(report.compliance.limitsReached).toBe(1);
  });

  it("histórico acima de 7 dias exige Premium", async () => {
    setPremium(false);
    await createFamily();
    expect((await api().get("/api/family/reports/usage?days=30").set(asGuardian(OWNER))).status).toBe(402);
  });
});

describe("inventário Android e quarentena de apps novos", () => {
  it("inventário inicial aprovado; app novo fica pendente e avisa o responsável", async () => {
    const family = await createFamily();
    const { device, deviceToken } = await pairDevice(OWNER, family.children[0].id);
    const first = await api().post("/api/child/installed-apps").set(asDevice(deviceToken))
      .send({ snapshot: true, apps: [{ packageName: "com.whatsapp", label: "WhatsApp" }, { packageName: "com.google.android.youtube", label: "YouTube" }] });
    expect(first.body).toEqual({ blockedPackages: [], pendingPackages: [] });

    await registerGuardianPush();
    const sent = capturePush();
    const second = await api().post("/api/child/installed-apps").set(asDevice(deviceToken))
      .send({ snapshot: true, apps: [{ packageName: "com.whatsapp", label: "WhatsApp" }, { packageName: "com.roblox.client", label: "Roblox" }] });
    expect(second.body.pendingPackages).toEqual(["com.roblox.client"]);
    expect(sent.some((m) => m.title?.includes("instalou"))).toBe(true);

    const overview = (await api().get("/api/family").set(asGuardian(OWNER))).body;
    expect(overview.pendingApps.map((a: { packageName: string }) => a.packageName)).toEqual(["com.roblox.client"]);
    expect(overview.recentEvents.map((e: { type: string }) => e.type)).toEqual(expect.arrayContaining(["app_installed", "app_removed"]));

    await api().patch(`/api/family/devices/${device.id}/apps/com.roblox.client`).set(asGuardian(OWNER)).send({ status: "approved" }).expect(200);
    await api().patch(`/api/family/devices/${device.id}/apps/com.whatsapp`).set(asGuardian(OWNER)).send({ status: "blocked" }).expect(200);
    const policy = (await api().get("/api/child/overview").set(asDevice(deviceToken))).body.policy;
    expect(policy).toMatchObject({ blockedPackages: ["com.whatsapp"], pendingPackages: [] });

    const catalog = (await api().get("/api/catalog/apps").set(asGuardian(OWNER))).body;
    expect(catalog.some((c: { id: string }) => c.id === "com.whatsapp")).toBe(false);
  });
});

describe("PIN do responsável e alertas de adulteração", () => {
  it("define PIN, verifica online e entrega verificador offline compatível", async () => {
    const family = await createFamily();
    const { deviceToken } = await pairDevice(OWNER, family.children[0].id);
    expect((await api().put("/api/family/guardian-pin").set(asGuardian(OWNER)).send({ pin: "1234" })).status).toBe(400);
    await api().put("/api/family/guardian-pin").set(asGuardian(OWNER)).send({ pin: "4827" }).expect(204);
    expect((await api().post("/api/child/verify-pin").set(asDevice(deviceToken)).send({ pin: "4827" })).body.valid).toBe(true);
    expect((await api().post("/api/child/verify-pin").set(asDevice(deviceToken)).send({ pin: "0000" })).body.valid).toBe(false);

    const verifier = (await api().get("/api/child/overview").set(asDevice(deviceToken))).body.policy.pinVerifier;
    const offline = scryptSync("4827", verifier.salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex");
    expect(offline).toBe(verifier.hash);
  });

  it("bloqueia após 5 tentativas de PIN", async () => {
    const family = await createFamily();
    const { deviceToken } = await pairDevice(OWNER, family.children[0].id);
    await api().put("/api/family/guardian-pin").set(asGuardian(OWNER)).send({ pin: "4827" }).expect(204);
    for (let i = 0; i < 5; i++) await api().post("/api/child/verify-pin").set(asDevice(deviceToken)).send({ pin: "1111" });
    expect((await api().post("/api/child/verify-pin").set(asDevice(deviceToken)).send({ pin: "4827" })).status).toBe(429);
  });

  it("proteção desligada e tentativa de desinstalar geram push imediato", async () => {
    const family = await createFamily();
    const { deviceToken } = await pairDevice(OWNER, family.children[0].id);
    await api().post("/api/family/push-tokens").set(asGuardian(OWNER)).send({ token: "ExponentPushToken[guardian-1]", platform: "ios" }).expect(204);
    const sent = capturePush();
    await api().post("/api/child/protection").set(asDevice(deviceToken)).send({ state: "active", issues: [] }).expect(204);
    await api().post("/api/child/protection").set(asDevice(deviceToken)).send({ state: "disabled", issues: ["Serviço de proteção desativado"] }).expect(204);
    await api().post("/api/child/events").set(asDevice(deviceToken)).send({ events: [{ type: "uninstall_attempt", detail: "Tela de desinstalação aberta" }] }).expect(204);
    expect(sent.map((m) => m.title)).toEqual([
      expect.stringContaining("Proteção desativada"),
      expect.stringContaining("desinstalar"),
    ]);
    expect(sent.every((m) => m.to === "ExponentPushToken[guardian-1]")).toBe(true);
  });

  it("mudança de regra manda push silencioso para os aparelhos da criança", async () => {
    const family = await createFamily();
    const childId = family.children[0].id;
    const { deviceToken } = await pairDevice(OWNER, childId);
    await api().post("/api/child/push-token").set(asDevice(deviceToken)).send({ token: "ExponentPushToken[child-1]", platform: "android" }).expect(204);
    const sent = capturePush();
    await api().patch("/api/family/apps/youtube/rules").set(asGuardian(OWNER)).send({ childId, dailyLimitMinutes: 20 }).expect(200);
    expect(sent).toEqual([expect.objectContaining({ to: "ExponentPushToken[child-1]", data: { type: "policy_changed" } })]);
  });
});

describe("plano grátis × Premium", () => {
  it("grátis: até 5 apps com limite; bloquear continua ilimitado; desbloquear no limite pede Premium", async () => {
    setPremium(false);
    const family = await createFamily();
    const childId = family.children[0].id;
    const add = (catalogAppId: string, status?: "blocked") =>
      api().post(`/api/family/children/${childId}/apps`).set(asGuardian(OWNER)).send({ catalogAppId, dailyLimitMinutes: 30, ...(status ? { status } : {}) });
    // A família já nasce com o YouTube (1º app com limite); mais 4 chegam aos 5 do plano grátis.
    for (const app of ["roblox", "minecraft", "whatsapp", "netflix"]) expect((await add(app)).status).toBe(201);
    const sixth = await add("spotify");
    expect(sixth.status).toBe(402);
    expect(sixth.body.code).toBe("TIMED_APPS_LIMIT");
    // Bloquear é segurança: não conta no limite.
    expect((await add("tiktok", "blocked")).status).toBe(201);
    expect((await add("instagram", "blocked")).status).toBe(201);
    const unblock = await api().patch("/api/family/apps/tiktok/rules").set(asGuardian(OWNER)).send({ childId, status: "allowed" });
    expect(unblock.status).toBe(402);
    // Premium libera.
    setPremium(true);
    expect((await add("spotify")).status).toBe(201);
    const limits = (await api().get("/api/family").set(asGuardian(OWNER))).body.limits;
    expect(limits.maxTimedApps).toBeGreaterThan(5);
    expect(limits.features.adFree).toBe(true);
  });

  it("grátis: até 2 rotinas por criança; Premium ilimitado", async () => {
    setPremium(false);
    const family = await createFamily();
    const childId = family.children[0].id;
    const add = (title: string) => api().post(`/api/family/children/${childId}/routines`).set(asGuardian(OWNER))
      .send({ title, days: "seg,ter", startTime: "14:00", endTime: "15:00" });
    // A família já nasce com a "Hora de dormir".
    expect((await add("Lição de casa")).status).toBe(201);
    const third = await add("Escola");
    expect(third.status).toBe(402);
    expect(third.body.code).toBe("ROUTINE_LIMIT");
    const limits = (await api().get("/api/family").set(asGuardian(OWNER))).body.limits;
    expect(limits).toMatchObject({ plan: "free", maxRoutines: 2, maxTimedApps: 5, features: { lockScreen: false, adFree: false } });
    setPremium(true);
    expect((await add("Escola")).status).toBe(201);
  });
});
