import { afterEach, describe, expect, it } from "vitest";
import { isWeakPin } from "../src/lib/codes";
import { setPushTransport, type PushMessage } from "../src/lib/push";
import { api, asDevice, asGuardian, createFamily, pairDevice } from "./helpers";

const OWNER = "user_owner";
afterEach(() => setPushTransport(null));

describe("segurança (revisão 2026-09-30)", () => {
  it("S3: recusa PINs previsíveis e aceita PINs razoáveis", async () => {
    for (const pin of ["0000", "1111", "1234", "9876", "4321", "1212", "1122", "2580", "1470", "2010", "1985", "123456", "121212"]) {
      expect(isWeakPin(pin), pin).toBe(true);
    }
    for (const pin of ["4827", "7351", "90612", "385047", "1648"]) expect(isWeakPin(pin), pin).toBe(false);
    await createFamily();
    const weak = await api().put("/api/family/guardian-pin").set(asGuardian(OWNER)).send({ pin: "2580" });
    expect(weak.status).toBe(400);
    expect(weak.body.code).toBe("WEAK_PIN");
    expect((await api().put("/api/family/guardian-pin").set(asGuardian(OWNER)).send({ pin: "4827" })).status).toBe(204);
  });

  it("S4: eventos do aparelho têm limite; alerta aos pais é deduplicado e com texto curto", async () => {
    const family = await createFamily();
    const { deviceToken } = await pairDevice(OWNER, family.children[0].id, "android");
    await api().post("/api/family/push-tokens").set(asGuardian(OWNER)).send({ token: "ExponentPushToken[pai]", platform: "android" }).expect(204);
    const sent: PushMessage[] = [];
    setPushTransport(async (messages) => { sent.push(...messages); });
    const longText = "Seu responsável mandou desligar a proteção agora ".repeat(4); // 196 caracteres (limite do servidor: 240)
    const send = () => api().post("/api/child/events").set(asDevice(deviceToken))
      .send({ events: [{ type: "tamper_attempt", detail: longText }] });
    for (let i = 0; i < 30; i++) expect((await send()).status).toBe(204);
    expect((await send()).status).toBe(429);
    const alerts = sent.filter((m) => m.to === "ExponentPushToken[pai]");
    expect(alerts).toHaveLength(3);
    expect(alerts[0].body!.length).toBeLessThan(longText.length);
    expect(alerts[0].body).toMatch(/^Aparelho "/);
  });

  it("S8: cabeçalhos de segurança e API só JSON", async () => {
    const res = await api().get("/api/legal/privacy");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
