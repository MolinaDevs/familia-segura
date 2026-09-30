/**
 * Qual rotina vale agora, ou qual é a próxima — no horário do aparelho.
 * Mesma regra do Android nativo: janela por dia da semana; se o fim é menor que o início, atravessa a
 * meia-noite e o trecho da madrugada pertence ao dia em que a rotina começou.
 */
type RoutineLike = { enabled: boolean; days: string; startTime: string; endTime: string };

const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const DAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map((part) => parseInt(part, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};
const hasDay = (routine: RoutineLike, day: number) =>
  routine.days.split(',').map((d) => d.trim()).includes(DAY_KEYS[(day + 7) % 7]);

export type RoutineMoment<T> =
  | { state: 'active'; routine: T; until: string }
  | { state: 'next'; routine: T; startsIn: string };

/** Rotina valendo agora; se nenhuma, a próxima a começar (até 7 dias à frente). */
export function routineMoment<T extends RoutineLike>(routines: T[], now = new Date()): RoutineMoment<T> | null {
  const today = now.getDay();
  const minute = now.getHours() * 60 + now.getMinutes();
  const enabled = routines.filter((r) => r.enabled);

  for (const routine of enabled) {
    const start = toMinutes(routine.startTime);
    const end = toMinutes(routine.endTime);
    const active = end > start
      ? hasDay(routine, today) && minute >= start && minute < end
      : (hasDay(routine, today) && minute >= start) || (hasDay(routine, today - 1) && minute < end);
    if (active) return { state: 'active', routine, until: routine.endTime };
  }

  let best: { routine: T; inMinutes: number; day: number } | null = null;
  for (const routine of enabled) {
    const start = toMinutes(routine.startTime);
    for (let offset = 0; offset <= 7; offset++) {
      const day = today + offset;
      if (!hasDay(routine, day)) continue;
      const inMinutes = offset * 1440 + start - minute;
      if (inMinutes <= 0) continue;
      if (!best || inMinutes < best.inMinutes) best = { routine, inMinutes, day };
      break;
    }
  }
  if (!best) return null;
  const offset = Math.floor((best.inMinutes + minute) / 1440);
  const when = offset === 0 ? `hoje às ${best.routine.startTime}`
    : offset === 1 ? `amanhã às ${best.routine.startTime}`
    : `${DAY_NAMES[best.day % 7]} às ${best.routine.startTime}`;
  return { state: 'next', routine: best.routine, startsIn: when };
}
