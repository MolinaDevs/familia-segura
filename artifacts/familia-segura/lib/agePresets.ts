import { createAppRule, createRoutine, updateAppRule, type ChildProfileAgeBand, type Routine as ApiRoutine } from '@workspace/api-client-react';

/**
 * Sugestões por faixa etária (autonomia progressiva, em linha com o ECA Digital):
 * quanto menor a criança, mais restrito. O responsável pode aplicar ou não, e ajustar depois.
 * Redes sociais abaixo de 13 anos ficam bloqueadas (idade mínima dos próprios serviços).
 */
export type AgePreset = {
  label: string;
  summary: string;
  routines: Array<{ title: string; days: string; startTime: string; endTime: string; icon: string; description: string }>;
  apps: Array<{ catalogAppId: string; dailyLimitMinutes: number; status?: 'allowed' | 'blocked' }>;
};

const WEEKDAYS = 'seg,ter,qua,qui,sex';
const SCHOOL_NIGHTS = 'dom,seg,ter,qua,qui';
const WEEKEND_NIGHTS = 'sex,sab';

export const AGE_PRESETS: Record<ChildProfileAgeBand, AgePreset> = {
  ate9: {
    label: 'Até 9 anos',
    summary: 'Vídeo infantil com limite curto, sem redes sociais nem mensagens, sono a partir das 20h.',
    routines: [
      { title: 'Hora de dormir', days: SCHOOL_NIGHTS, startTime: '20:00', endTime: '07:00', icon: 'moon', description: 'Desconectar e descansar' },
      { title: 'Hora de dormir (fim de semana)', days: WEEKEND_NIGHTS, startTime: '21:00', endTime: '08:00', icon: 'moon', description: 'Desconectar e descansar' },
      { title: 'Escola', days: WEEKDAYS, startTime: '07:30', endTime: '12:00', icon: 'book', description: 'Foco nas aulas' },
    ],
    apps: [
      { catalogAppId: 'youtube-kids', dailyLimitMinutes: 45 },
      { catalogAppId: 'youtube', dailyLimitMinutes: 0, status: 'blocked' },
      { catalogAppId: 'tiktok', dailyLimitMinutes: 0, status: 'blocked' },
      { catalogAppId: 'instagram', dailyLimitMinutes: 0, status: 'blocked' },
      { catalogAppId: 'whatsapp', dailyLimitMinutes: 0, status: 'blocked' },
      { catalogAppId: 'roblox', dailyLimitMinutes: 30 },
      { catalogAppId: 'play-store', dailyLimitMinutes: 0, status: 'blocked' },
    ],
  },
  de10a12: {
    label: '10 a 12 anos',
    summary: 'Vídeo e jogos com limite, mensagens com limite, sem redes sociais, sono às 21h.',
    routines: [
      { title: 'Hora de dormir', days: SCHOOL_NIGHTS, startTime: '21:00', endTime: '07:00', icon: 'moon', description: 'Desconectar e descansar' },
      { title: 'Hora de dormir (fim de semana)', days: WEEKEND_NIGHTS, startTime: '22:00', endTime: '08:00', icon: 'moon', description: 'Desconectar e descansar' },
      { title: 'Escola', days: WEEKDAYS, startTime: '07:00', endTime: '12:30', icon: 'book', description: 'Foco nas aulas' },
    ],
    apps: [
      { catalogAppId: 'youtube', dailyLimitMinutes: 60 },
      { catalogAppId: 'roblox', dailyLimitMinutes: 60 },
      { catalogAppId: 'minecraft', dailyLimitMinutes: 60 },
      { catalogAppId: 'free-fire', dailyLimitMinutes: 45 },
      { catalogAppId: 'whatsapp', dailyLimitMinutes: 45 },
      { catalogAppId: 'tiktok', dailyLimitMinutes: 0, status: 'blocked' },
      { catalogAppId: 'instagram', dailyLimitMinutes: 0, status: 'blocked' },
    ],
  },
  de13a15: {
    label: '13 a 15 anos',
    summary: 'Redes sociais com limite, jogos e vídeo com mais tempo, sono às 22h.',
    routines: [
      { title: 'Hora de dormir', days: SCHOOL_NIGHTS, startTime: '22:00', endTime: '06:30', icon: 'moon', description: 'Desconectar e descansar' },
      { title: 'Escola', days: WEEKDAYS, startTime: '07:00', endTime: '12:30', icon: 'book', description: 'Foco nas aulas' },
    ],
    apps: [
      { catalogAppId: 'tiktok', dailyLimitMinutes: 45 },
      { catalogAppId: 'instagram', dailyLimitMinutes: 45 },
      { catalogAppId: 'youtube', dailyLimitMinutes: 90 },
      { catalogAppId: 'free-fire', dailyLimitMinutes: 60 },
      { catalogAppId: 'whatsapp', dailyLimitMinutes: 90 },
    ],
  },
  de16a17: {
    label: '16 e 17 anos',
    summary: 'Mais autonomia: só a pausa do sono e limites leves nas redes.',
    routines: [
      { title: 'Hora de dormir', days: SCHOOL_NIGHTS, startTime: '23:00', endTime: '06:00', icon: 'moon', description: 'Descanso antes da aula' },
    ],
    apps: [
      { catalogAppId: 'tiktok', dailyLimitMinutes: 90 },
      { catalogAppId: 'instagram', dailyLimitMinutes: 90 },
    ],
  },
  adulto: {
    label: 'Maior de idade',
    summary: 'Sem sugestões automáticas.',
    routines: [],
    apps: [],
  },
};


/** Aplica a sugestão da faixa etária: cria (ou ajusta) regras e rotinas. Retorna quantos itens foram aplicados. */
export async function applyAgePreset(childId: string, band: ChildProfileAgeBand, existingRoutines: Pick<ApiRoutine, 'title' | 'childId'>[]) {
  const preset = AGE_PRESETS[band];
  let applied = 0;
  for (const app of preset.apps) {
    const status = app.status ?? 'allowed';
    try {
      await createAppRule(childId, { catalogAppId: app.catalogAppId, dailyLimitMinutes: app.dailyLimitMinutes, status });
      applied++;
    } catch (error) {
      if ((error as { status?: number }).status === 409) {
        await updateAppRule(app.catalogAppId, { childId, dailyLimitMinutes: app.dailyLimitMinutes, status }).catch(() => undefined);
        applied++;
      }
    }
  }
  const titles = new Set(existingRoutines.filter((r) => r.childId === childId).map((r) => r.title));
  for (const routine of preset.routines) {
    if (titles.has(routine.title)) continue;
    await createRoutine(childId, routine).then(() => { applied++; }).catch(() => undefined);
  }
  return applied;
}
