import { AppState, Platform } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';

const statusOf = (error: unknown) => (error as { status?: number } | null)?.status;

/**
 * Padrões do app:
 * - 4xx não se repete (sessão vencida, sem família, sem permissão: repetir só atrasa a tela certa);
 * - falha de rede ou 5xx tenta mais 2 vezes, com espera crescente;
 * - sem retentativa em escrita (não duplicar tempo extra, regra ou convite).
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          const status = statusOf(error);
          if (status && status < 500) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
  });
}

// No celular, "voltar ao app" conta como foco: os dados da família atualizam ao reabrir.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
    return () => subscription.remove();
  });
}
