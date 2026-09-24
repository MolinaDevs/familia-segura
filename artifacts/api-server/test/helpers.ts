import request from "supertest";
import app from "../src/app";

export const api = () => request(app);

export const asGuardian = (userId: string) => ({ "x-test-user": userId });
export const asDevice = (token: string) => ({ Authorization: `Bearer ${token}` });

export function setPremium(enabled: boolean) {
  process.env.PREMIUM_BYPASS = enabled ? "true" : "false";
}

export async function createFamily(userId = "user_owner", overrides: Record<string, unknown> = {}) {
  const res = await api()
    .post("/api/family")
    .set(asGuardian(userId))
    .send({ name: "Família Teste", guardianName: "Ana", childName: "Leo", childBirthYear: 2015, consentAccepted: true, ...overrides });
  if (res.status !== 201) throw new Error(`createFamily falhou: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function addChild(userId: string, name: string) {
  return api().post("/api/family/children").set(asGuardian(userId)).send({ displayName: name, birthYear: 2014 });
}

export async function pairDevice(userId: string, childId: string, platform: "ios" | "android" = "android", name = "Aparelho") {
  const code = await api().post("/api/family/pairing-codes").set(asGuardian(userId)).send({ childId });
  if (code.status !== 201) throw new Error(`pairing-code falhou: ${code.status} ${JSON.stringify(code.body)}`);
  const res = await api().post("/api/family/devices/pair").send({ code: code.body.code, name, platform });
  if (res.status !== 201) throw new Error(`pair falhou: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { device: { id: string; childId: string }; deviceToken: string };
}

export async function invite(ownerId: string, userId: string, role: "guardian" | "viewer", displayName = "Bia") {
  const created = await api().post("/api/family/invites").set(asGuardian(ownerId)).send({ role });
  if (created.status !== 201) throw new Error(`invite falhou: ${created.status} ${JSON.stringify(created.body)}`);
  return api().post("/api/family/invites/accept").set(asGuardian(userId)).send({ code: created.body.code, displayName, consentAccepted: true });
}
