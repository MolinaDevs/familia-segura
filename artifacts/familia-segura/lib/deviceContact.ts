/**
 * Critério único de "sem contato" (painel, Família e tela do aparelho): só depois de 3 h, porque a
 * sincronização em segundo plano do celular pode levar ~15 min e o sistema às vezes a adia.
 */
export const STALE_MS = 3 * 3600_000;

export const isStale = (lastSeenAt: string | Date) => Date.now() - new Date(lastSeenAt).getTime() > STALE_MS;

/** "29/09, 19:10" */
export const shortDate = (iso: string | Date) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
