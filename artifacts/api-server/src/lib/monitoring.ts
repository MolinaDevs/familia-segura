import * as Sentry from "@sentry/node";

/**
 * Sentry (erros do servidor). Desligado sem SENTRY_DSN e nos testes: nada sai da máquina.
 * Privacidade (LGPD/ECA): sem dados pessoais por padrão, sem corpo de requisição, sem cabeçalhos de autenticação.
 */
const dsn = process.env.SENTRY_DSN;
export const monitoringEnabled = Boolean(dsn) && process.env.NODE_ENV !== "test";

if (monitoringEnabled) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "production",
    release: process.env.RENDER_GIT_COMMIT,
    // Sentry 11 coleta por padrão corpo, cabeçalhos, cookies e query: tudo desligado (dados de famílias e crianças).
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });
}

const REPORTED = Symbol.for("familia-segura.reported");

/** Envia o erro uma vez só (o mesmo erro pode passar por mais de um log). */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!monitoringEnabled || !(error instanceof Error)) return;
  const marked = error as Error & { [REPORTED]?: boolean };
  if (marked[REPORTED]) return;
  marked[REPORTED] = true;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Antes de encerrar o processo: garante que os últimos erros foram enviados. */
export async function flushMonitoring(timeoutMs = 2000) {
  if (monitoringEnabled) await Sentry.flush(timeoutMs).catch(() => false);
}
