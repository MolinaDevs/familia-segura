import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

type PushData = { type?: string; deviceId?: string };

/** Para onde leva o toque em cada aviso do responsável (os tipos vêm da API). */
function routeFor(data: PushData) {
  if (data.deviceId && ['tamper', 'protection', 'pending_apps'].includes(data.type ?? '')) {
    return { pathname: '/(app)/device/[id]' as const, params: { id: data.deviceId } };
  }
  if (data.type === 'weekly_summary') return '/(app)/(tabs)/reports' as const;
  if (data.type === 'time_request') return '/(app)/(tabs)' as const;
  return null;
}

/** Tocar numa notificação abre a tela certa (antes, todas só abriam o app no painel). */
export function useNotificationRouting(enabled: boolean) {
  const response = Platform.OS === 'web' ? null : Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !response) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const target = routeFor((response.notification.request.content.data ?? {}) as PushData);
    if (target) router.push(target);
  }, [enabled, response]);
}
