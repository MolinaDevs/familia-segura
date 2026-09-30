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

/**
 * PINs previsíveis — os primeiros que uma criança tenta: todos iguais, sequências (1234, 9876), pares
 * repetidos (1212, 1122), colunas/diagonais do teclado (2580, 1470, 3690, 1590) e anos (1950–2039).
 * O mesmo critério roda no app (lib/pin.ts) para avisar antes de enviar.
 */
const COMMON_PINS = new Set(["2580", "0852", "1470", "0741", "3690", "0963", "1590", "7531", "1379", "6969", "1004", "4321", "0007", "1313", "2468", "1357"]);
export function isWeakPin(pin: string) {
  if (/^(\d)\1+$/.test(pin)) return true;
  if ("01234567890".includes(pin) || "09876543210".includes(pin)) return true;
  if (/^(\d\d)\1+$/.test(pin) || /^(\d)\1(\d)\2$/.test(pin)) return true;
  if (pin.length === 4 && /^(19[5-9]\d|20[0-3]\d)$/.test(pin)) return true;
  return COMMON_PINS.has(pin);
}

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
