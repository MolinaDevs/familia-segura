import * as Sentry from '@sentry/react-native';

/**
 * Sentry (travamentos e erros do app). Desligado sem EXPO_PUBLIC_SENTRY_DSN e em desenvolvimento.
 * Privacidade (LGPD/ECA Digital): sem dados pessoais, sem capturas de tela nem gravação de sessão;
 * só o erro, a versão do app e o modelo do aparelho.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const monitoringEnabled = Boolean(dsn) && !__DEV__;

if (monitoringEnabled) {
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'production',
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: 0.05,
    beforeBreadcrumb(breadcrumb) {
      // Endereços da API com ids de crianças/aparelhos: mantém só o caminho, sem parâmetros.
      if (breadcrumb.data && typeof breadcrumb.data.url === 'string') {
        breadcrumb.data.url = breadcrumb.data.url.split('?')[0];
      }
      return breadcrumb;
    },
  });
}

/** Marca se o aparelho é do responsável ou da criança (ajuda a separar os problemas). */
export function setMonitoringMode(mode: 'guardian' | 'child') {
  if (monitoringEnabled) Sentry.setTag('mode', mode);
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!monitoringEnabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Envolve o layout raiz (captura erros não tratados e travamentos nativos). */
export function withMonitoring(Root: () => React.ReactElement): React.ComponentType {
  return monitoringEnabled ? Sentry.wrap(Root as React.ComponentType<Record<string, unknown>>) : Root;
}
