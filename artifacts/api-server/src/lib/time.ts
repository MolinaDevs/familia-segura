/** Utilitários de data no fuso da família (datas como string YYYY-MM-DD). */

export function localDate(timezone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: safeZone(timezone), year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

export function localHour(timezone: string, at: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: safeZone(timezone), hour: "2-digit", hourCycle: "h23" }).format(at);
  return Number(hour) % 24;
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) out.push(day);
  return out;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function safeZone(timezone: string) {
  return isValidTimezone(timezone) ? timezone : "America/Sao_Paulo";
}

/** Faixa etária usada para modos de autonomia progressiva (ECA Digital). */
export function ageBand(birthYear: number, now: Date = new Date()) {
  const age = now.getFullYear() - birthYear;
  if (age <= 9) return "ate9" as const;
  if (age <= 12) return "de10a12" as const;
  if (age <= 15) return "de13a15" as const;
  if (age <= 17) return "de16a17" as const;
  return "adulto" as const;
}
