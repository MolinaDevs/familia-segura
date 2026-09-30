import { Platform } from 'react-native';
import { setBaseUrl } from '@workspace/api-client-react';

/**
 * EXPO_PUBLIC_API_URL (URL completa) tem prioridade; EXPO_PUBLIC_DOMAIN mantém compatibilidade com o Replit.
 * Importado pelo layout raiz e pelas tarefas em segundo plano (que rodam sem a árvore de telas).
 */
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL;
const domain = process.env.EXPO_PUBLIC_DOMAIN;
// Em produção só HTTPS: tokens do aparelho e da conta nunca trafegam em texto claro (http só no desenvolvimento).
const apiUrl = rawApiUrl && (__DEV__ || rawApiUrl.startsWith('https://')) ? rawApiUrl : undefined;
if (rawApiUrl && !apiUrl) console.warn('EXPO_PUBLIC_API_URL ignorada: em produção a API precisa ser https://');
setBaseUrl(apiUrl ? apiUrl : Platform.OS === 'web' ? null : domain ? `https://${domain}` : null);

/** false quando o build não sabe onde está a API (falta EXPO_PUBLIC_API_URL no EAS, ou ela não é https). */
export const apiConfigured = Platform.OS === 'web' || Boolean(apiUrl || domain);
