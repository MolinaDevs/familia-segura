import * as WebBrowser from 'expo-web-browser';

/** Abre as páginas públicas servidas pela API (privacidade, termos, suporte, exclusão de conta). */
export function openLegal(page: 'privacy' | 'terms' | 'support' | 'delete-account') {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : '');
  return WebBrowser.openBrowserAsync(`${apiUrl}/api/legal/${page}`);
}
