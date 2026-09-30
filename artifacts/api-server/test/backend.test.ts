import { afterEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { clearEntitlementCache, hasPremium } from "../src/middlewares/requirePremium";
import { setPushTransport } from "../src/lib/push";
import { runRetention } from "../src/lib/retention";
import { api, asDevice, asGuardian, createFamily, pairDevice, setPremium } from "./helpers";

const OWNER = "user_owner";
const first = async <T>(query: ReturnType<typeof sql>) => (await db.execute(query)).rows[0] as T;

afterEach(() => {
  setPushTransport(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  clearEntitlementCache();
});

describe("backend (revisão 2026-09-30)", () => {
  it("B9/B10: prontidão com banco, 404 em JSON e id de requisição", async () => {
    const ready = await api().get("/api/readyz");
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe("ok");
    expect(ready.headers["x-request-id"]).toMatch(/^[\w-]{8,64}$/);
    const missing = await api().get("/api/nao-existe");
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe("Not found");
    const traced = await api().get("/api/healthz").set("X-Request-Id", "suporte-12345");
    expect(traced.headers["x-request-id"]).toBe("suporte-12345");
  });

  it("B8: 'visto por último' grava no máximo 1x por minuto", async () => {
    const family = await createFamily();
    const { device, deviceToken } = await pairDevice(OWNER, family.children[0].id);
    const recent = new Date(Date.now() - 30_000);
    await db.execute(sql`update devices set last_seen_at = ${recent.toISOString()}::timestamptz where id = ${device.id}`);
    await api().get("/api/child/overview").set(asDevice(deviceToken)).expect(200);
    const kept = await first<{ last_seen_at: Date }>(sql`select last_seen_at from devices where id = ${device.id}`);
    expect(new Date(kept.last_seen_at).getTime()).toBe(recent.getTime());
    await db.execute(sql`update devices set last_seen_at = now() - interval '5 minutes' where id = ${device.id}`);
    await api().get("/api/child/overview").set(asDevice(deviceToken)).expect(200);
    const updated = await first<{ last_seen_at: Date }>(sql`select last_seen_at from devices where id = ${device.id}`);
    expect(Date.now() - new Date(updated.last_seen_at).getTime()).toBeLessThan(10_000);
  });

  it("B6: sincronizações simultâneas do mesmo aparelho não duplicam uso nem quebram o inventário", async () => {
    const family = await createFamily();
    const { device, deviceToken } = await pairDevice(OWNER, family.children[0].id);
    const today = family.today as string;
    const usage = () => api().post("/api/child/usage").set(asDevice(deviceToken))
      .send({ localDate: today, localHour: 10, samples: [{ appId: "youtube", usageTodayMinutes: 30 }] });
    const results = await Promise.all([usage(), usage(), usage()]);
    expect(results.map((r) => r.status)).toEqual([204, 204, 204]);
    const hourly = await first<{ minutes: number }>(sql`select coalesce(sum(minutes), 0)::int as minutes from usage_hourly where device_id = ${device.id}`);
    expect(hourly.minutes).toBe(30);

    const apps = Array.from({ length: 300 }, (_, i) => ({ packageName: `com.exemplo.app${i}`, label: `App ${i}` }));
    const inventory = () => api().post("/api/child/installed-apps").set(asDevice(deviceToken)).send({ snapshot: true, apps });
    const synced = await Promise.all([inventory(), inventory()]);
    expect(synced.map((r) => r.status)).toEqual([200, 200]);
    const stored = await first<{ n: number }>(sql`select count(*)::int as n from device_apps where device_id = ${device.id}`);
    expect(stored.n).toBe(300);

    // Depois do inventário inicial: um app novo entra pendente e um removido gera evento.
    const next = await api().post("/api/child/installed-apps").set(asDevice(deviceToken))
      .send({ snapshot: true, apps: [...apps.slice(1), { packageName: "com.novo.jogo", label: "Jogo Novo" }] });
    expect(next.status).toBe(200);
    expect(next.body.pendingPackages).toEqual(["com.novo.jogo"]);
    const events = (await db.execute<{ type: string; detail: string }>(sql`select type, detail from device_events where device_id = ${device.id} order by type`)).rows;
    expect(events).toEqual([{ type: "app_installed", detail: "Jogo Novo" }, { type: "app_removed", detail: "App 0" }]);
  });

  it("B5: retenção de 12 meses vale também para pedidos e auditoria", async () => {
    const family = await createFamily();
    const familyId = family.family.id as string;
    const childId = family.children[0].id as string;
    await db.execute(sql`insert into time_requests (family_id, child_id, app_id, app_name, requested_minutes, message, created_at)
      values (${familyId}, ${childId}, 'youtube', 'YouTube', 15, '', now() - interval '400 days'),
             (${familyId}, ${childId}, 'youtube', 'YouTube', 15, '', now() - interval '10 days')`);
    await db.execute(sql`insert into audit_events (family_id, action, summary, created_at)
      values (${familyId}, 'antigo', 'antigo', now() - interval '400 days')`);
    const removed = await runRetention();
    expect(removed.requests).toBe(1);
    expect(removed.audit).toBe(1);
    const left = await first<{ n: number }>(sql`select count(*)::int as n from time_requests where family_id = ${familyId}`);
    expect(left.n).toBe(1);
  });

  it("B7: token de push de app desinstalado é apagado", async () => {
    const family = await createFamily();
    await api().post("/api/family/push-tokens").set(asGuardian(OWNER)).send({ token: "ExponentPushToken[velho]", platform: "android" }).expect(204);
    await api().post("/api/family/push-tokens").set(asGuardian(OWNER)).send({ token: "ExponentPushToken[novo]", platform: "android" }).expect(204);
    setPushTransport(async (messages) => messages.map((m) => (m.to === "ExponentPushToken[velho]"
      ? { status: "error" as const, details: { error: "DeviceNotRegistered" } }
      : { status: "ok" as const })));
    const { deviceToken } = await pairDevice(OWNER, family.children[0].id);
    await api().post("/api/child/events").set(asDevice(deviceToken)).send({ events: [{ type: "tamper_attempt" }] }).expect(204);
    const tokens = (await db.execute<{ token: string }>(sql`select token from push_tokens`)).rows.map((r) => r.token);
    expect(tokens).toEqual(["ExponentPushToken[novo]"]);
  });

  it("B1: verificação Premium com cache também para quem não assina e uma chamada por vez", async () => {
    setPremium(false);
    vi.stubEnv("REVENUECAT_PROJECT_ID", "proj");
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test");
    const fetchMock = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const results = await Promise.all([hasPremium("gratis"), hasPremium("gratis"), hasPremium("gratis")]);
    expect(results).toEqual([false, false, false]);
    expect(await hasPremium("gratis")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
