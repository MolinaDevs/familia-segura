import { useAuth as useClerkAuth } from '@clerk/expo';

/**
 * Modo demonstração para testar no computador sem conta no Clerk.
 * Só existe em desenvolvimento (__DEV__) e com EXPO_PUBLIC_DEV_AUTH=true; builds de produção nunca o ativam.
 * A API precisa de DEV_AUTH=true (também bloqueado em produção).
 */
export const DEV_AUTH = __DEV__ && process.env.EXPO_PUBLIC_DEV_AUTH === 'true';
const DEV_USER = (process.env.EXPO_PUBLIC_DEV_USER || 'responsavel').replace(/[^a-zA-Z0-9_-]/g, '');

type ClerkAuth = ReturnType<typeof useClerkAuth>;
const devAuth = {
  isLoaded: true,
  isSignedIn: true,
  userId: `dev_${DEV_USER}`,
  getToken: async () => `dev:${DEV_USER}`,
  signOut: async () => undefined,
} as unknown as ClerkAuth;

/** useAuth do app: Clerk em uso normal, responsável fictício no modo demonstração. */
export function useAuth(): ClerkAuth {
  // DEV_AUTH é constante durante toda a execução, então a ordem dos hooks não muda.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return DEV_AUTH ? devAuth : useClerkAuth();
}
