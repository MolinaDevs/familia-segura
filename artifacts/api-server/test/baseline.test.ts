import { describe, expect, it } from "vitest";
import { api, asDevice, asGuardian, createFamily, pairDevice } from "./helpers";

describe("fluxos atuais (baseline da Fase 0)", () => {
  it("healthcheck responde", async () => {
    const res = await api().get("/api/healthz");
    expect(res.status).toBe(200);
  });

  it("exige consentimento para criar família", async () => {
    const res = await api().post("/api/family").set(asGuardian("u1"))
      .send({ name: "F", guardianName: "A", childName: "L", childBirthYear: 2015, consentAccepted: false });
    expect(res.status).toBe(400);
  });

  it("cria família e devolve overview", async () => {
    const family = await createFamily();
    expect(family.children).toHaveLength(1);
    const res = await api().get("/api/family").set(asGuardian("user_owner"));
    expect(res.status).toBe(200);
    expect(res.body.family.id).toBe(family.family.id);
  });

  it("rejeita acesso sem autenticação", async () => {
    expect((await api().get("/api/family")).status).toBe(401);
    expect((await api().get("/api/child/overview")).status).toBe(401);
  });

  it("pareia aparelho e o aparelho lê só as regras da própria criança", async () => {
    const family = await createFamily();
    const { deviceToken } = await pairDevice("user_owner", family.children[0].id);
    const res = await api().get("/api/child/overview").set(asDevice(deviceToken));
    expect(res.status).toBe(200);
    expect(res.body.child.id).toBe(family.children[0].id);
  });

  it("código de pareamento é de uso único", async () => {
    const family = await createFamily();
    const code = await api().post("/api/family/pairing-codes").set(asGuardian("user_owner")).send({ childId: family.children[0].id });
    const first = await api().post("/api/family/devices/pair").send({ code: code.body.code, name: "A", platform: "ios" });
    const second = await api().post("/api/family/devices/pair").send({ code: code.body.code, name: "B", platform: "ios" });
    expect(first.status).toBe(201);
    expect(second.status).toBe(400);
  });

  it("aparelho revogado perde acesso", async () => {
    const family = await createFamily();
    const { device, deviceToken } = await pairDevice("user_owner", family.children[0].id);
    const del = await api().delete(`/api/family/devices/${device.id}`).set(asGuardian("user_owner"));
    expect(del.status).toBe(204);
    expect((await api().get("/api/child/overview").set(asDevice(deviceToken))).status).toBe(401);
  });

  it("isola famílias: responsável não vê nem revoga aparelho de outra família", async () => {
    const a = await createFamily("user_a");
    await createFamily("user_b");
    const { device } = await pairDevice("user_a", a.children[0].id);
    const res = await api().delete(`/api/family/devices/${device.id}`).set(asGuardian("user_b"));
    expect(res.status).toBe(404);
  });
});
