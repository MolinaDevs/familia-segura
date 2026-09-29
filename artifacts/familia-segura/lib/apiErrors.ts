import { Alert } from '@/lib/alert';
import { router } from 'expo-router';

type ErrorLike = { status?: number; data?: { error?: string; code?: string } | null };

/** Mensagem amigável para erros da API, com atalho para a assinatura quando o limite é do plano. */
export function showApiError(error: unknown, fallback = 'Ação não pôde ser concluída. Verifique sua conexão.') {
  const err = (error ?? {}) as ErrorLike;
  const message = err.data?.error;
  if (err.status === 402) {
    Alert.alert('Recurso Premium', message ?? 'Este recurso faz parte do Premium.', [
      { text: 'Agora não', style: 'cancel' },
      { text: 'Ver planos', onPress: () => router.push('/(app)/subscription') },
    ]);
    return;
  }
  if (err.status === 403) {
    Alert.alert('Sem permissão', message ?? 'Seu papel na família não permite esta ação.');
    return;
  }
  if (err.status === 409 && message) {
    Alert.alert('Atenção', message);
    return;
  }
  Alert.alert('Erro', message && err.status && err.status < 500 ? message : fallback);
}

export const apiStatus = (error: unknown) => (error as ErrorLike | null)?.status;
