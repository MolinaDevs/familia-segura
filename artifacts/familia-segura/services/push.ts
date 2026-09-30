import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerDevicePushToken, registerGuardianPushToken, unregisterGuardianPushToken } from '@workspace/api-client-react';
import { deviceAuthHeaders } from '@/services/childSync';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Token Expo Push. Exige build nativa com projectId do EAS (não funciona no simulador). */
async function expoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alertas', {
      name: 'Alertas da família',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

const GUARDIAN_TOKEN_KEY = '@familia-segura/guardian-push-token';

/** Responsável: recebe pedidos de tempo, apps novos e alertas de adulteração. */
export async function registerGuardianPush() {
  const token = await expoPushToken();
  if (!token) return;
  await registerGuardianPushToken({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' })
    .then(() => AsyncStorage.setItem(GUARDIAN_TOKEN_KEY, token))
    .catch(() => undefined);
}

/**
 * Saída da conta: este aparelho para de receber os avisos da família (nomes das crianças, pedidos, alertas).
 * Precisa rodar antes do signOut, enquanto a sessão ainda autentica a chamada.
 */
export async function unregisterGuardianPush(sessionToken?: string | null) {
  const token = await AsyncStorage.getItem(GUARDIAN_TOKEN_KEY).catch(() => null);
  if (!token) return;
  // No modo criança o cliente da API usa a credencial do aparelho: a sessão do responsável vai explícita.
  const options = sessionToken ? { headers: { Authorization: `Bearer ${sessionToken}` } } : undefined;
  await Promise.race([
    unregisterGuardianPushToken({ token }, options).catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]);
  await AsyncStorage.removeItem(GUARDIAN_TOKEN_KEY).catch(() => undefined);
}

/** Aparelho da criança: recebe push silencioso para buscar regras novas na hora. */
export async function registerChildPush() {
  const token = await expoPushToken();
  const headers = await deviceAuthHeaders();
  if (!token || !headers) return;
  await registerDevicePushToken({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' }, { headers }).catch(() => undefined);
}
