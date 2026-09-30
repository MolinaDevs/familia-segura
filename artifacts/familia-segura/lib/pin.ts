/**
 * PINs previsíveis — os primeiros que uma criança tenta. Espelha isWeakPin da API (src/lib/codes.ts):
 * aqui só para avisar antes de enviar; quem decide é o servidor.
 */
const COMMON_PINS = new Set(['2580', '0852', '1470', '0741', '3690', '0963', '1590', '7531', '1379', '6969', '1004', '4321', '0007', '1313', '2468', '1357']);

export const WEAK_PIN_MESSAGE = 'Esse PIN é fácil de adivinhar. Evite sequências, números repetidos e anos.';

export function isWeakPin(pin: string) {
  if (/^(\d)\1+$/.test(pin)) return true;
  if ('01234567890'.includes(pin) || '09876543210'.includes(pin)) return true;
  if (/^(\d\d)\1+$/.test(pin) || /^(\d)\1(\d)\2$/.test(pin)) return true;
  if (pin.length === 4 && /^(19[5-9]\d|20[0-3]\d)$/.test(pin)) return true;
  return COMMON_PINS.has(pin);
}
