import { router, type Href } from 'expo-router';

/**
 * Voltar com segurança: se a tela foi aberta direto (link, notificação, recarga), não há histórico
 * e `router.back()` falha. Nesse caso vai para a tela indicada.
 */
export function goBack(fallback: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
