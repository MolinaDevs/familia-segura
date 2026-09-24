import { createHash, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: string, keylen: number, options: { N: number; r: number; p: number }) => Promise<Buffer>;

/** Sem 0/O, 1/I/L para evitar confusão na digitação. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const newDeviceToken = () => randomBytes(32).toString("base64url");

/** Código legível (ex.: 8 caracteres ≈ 8,5·10¹¹ combinações). */
export function newReadableCode(length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Normaliza o que a pessoa digitou: maiúsculas, sem hífen/espaço. */
export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const formatCode = (code: string) => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

export const PIN_SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 } as const;
export const PIN_ALGORITHM = "scrypt-n16384-r8-p1-32";

export async function hashPin(pin: string, salt = randomBytes(16).toString("hex")) {
  const hash = await scrypt(pin, salt, PIN_SCRYPT.keylen, { N: PIN_SCRYPT.N, r: PIN_SCRYPT.r, p: PIN_SCRYPT.p });
  return { salt, hash: hash.toString("hex") };
}

export async function verifyPin(pin: string, salt: string, expectedHex: string) {
  const { hash } = await hashPin(pin, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expectedHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
