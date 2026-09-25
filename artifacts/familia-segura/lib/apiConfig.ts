import { Platform } from 'react-native';
import { setBaseUrl } from '@workspace/api-client-react';

/**
 * EXPO_PUBLIC_API_URL (URL completa) tem prioridade; EXPO_PUBLIC_DOMAIN mantém compatibilidade com o Replit.
 * Importado pelo layout raiz e pelas tarefas em segundo plano (que rodam sem a árvore de telas).
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const domain = process.env.EXPO_PUBLIC_DOMAIN;
setBaseUrl(apiUrl ? apiUrl : Platform.OS === 'web' ? null : domain ? `https://${domain}` : null);

/** false quando o build não sabe onde está a API (falta EXPO_PUBLIC_API_URL no EAS). */
export const apiConfigured = Platform.OS === 'web' || Boolean(apiUrl || domain);
