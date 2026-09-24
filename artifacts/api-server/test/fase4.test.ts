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
