import { describe, expect, it } from "vitest";
import { api, asDevice, asGuardian, createFamily, invite, pairDevice } from "./helpers";

const OWNER = "user_owner";

describe("proteção de instalação/remoção de apps (Fase 3)", () => {
  it("família nasce com bloqueio de instalar e apagar apps e filtro adulto ligados", async () => {
    const family = await createFamily();
    expect(family.settings).toMatchObject({ blockAppInstalls: true, blockAppRemoval: true, webFilter: "adult" });
    const { deviceToken } = await pairDevice(OWNER, family.children[0].id, "ios");
    const policy = (await api().get("/api/child/overview").set(asDevice(deviceToken))).body.policy;
    expect(policy).toMatchObject({ blockAppInstalls: true, blockAppRemoval: true, webFilter: "adult" });
  });

  it("responsável afrouxa as proteções e o aparelho recebe a nova política", async () => {
    const family = await createFamily();
    const { deviceToken } = await pairDevice(OWNER, family.children[0].id, "android");
    const updated = await api().patch("/api/family/settings").set(asGuardian(OWNER)).send({ blockAppInstalls: false, webFilter: "off" });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ blockAppInstalls: false, blockAppRemoval: true, webFilter: "off" });
    const policy = (await api().get("/api/child/overview").set(asDevice(deviceToken))).body.policy;
    expect(policy).toMatchObject({ blockAppInstalls: false, blockAppRemoval: true, webFilter: "off" });
  });

  it("observador não altera as proteções; valor inválido é recusado", async () => {
    await createFamily();
    await invite(OWNER, "user_viewer", "viewer");
    expect((await api().patch("/api/family/settings").set(asGuardian("user_viewer")).send({ blockAppRemoval: false })).status).toBe(403);
    expect((await api().patch("/api/family/settings").set(asGuardian(OWNER)).send({ webFilter: "tudo" })).status).toBe(400);
  });
});
