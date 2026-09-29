import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { ChildPolicy } from '@workspace/api-client-react';
import IosControls from '@/modules/familia-segura-ios-controls/src/FamiliaSeguraIosControlsModule';
import { loadNativeControls } from '@/services/iosParentalControls';

const INSTALL_UNLOCK_KEY = '@familia-segura/ios-install-unlock-until';

async function installUnlockedUntil(): Promise<number> {
  const raw = await AsyncStorage.getItem(INSTALL_UNLOCK_KEY).catch(() => null);
  return raw ? Number(raw) : 0;
}

/**
 * Aplica no iPhone/iPad as proteções da família:
 * - não apagar apps (denyAppRemoval) e não instalar apps (denyAppInstallation);
 * - filtro de conteúdo adulto da Apple nos navegadores.
 * A liberação de instalação pelo PIN dura 15 min e é desfeita na próxima sincronização depois disso.
 */
export async function applyIosDeviceProtection(policy: ChildPolicy) {
  if (Platform.OS !== 'ios') return;
  // Liberação pelo PIN no aparelho OU à distância pelo responsável (app do responsável → aparelho → liberar instalação).
  const remoteUntil = policy.installUnlockUntil ? new Date(policy.installUnlockUntil).getTime() : 0;
  const installUnlocked = Math.max(await installUnlockedUntil(), remoteUntil) > Date.now();
  if (IosControls?.isAvailable()) {
    IosControls.applyDeviceProtection(policy.blockAppRemoval, policy.blockAppInstalls && !installUnlocked);
  }
  const native = await loadNativeControls();
  if (!native) return;
  try {
    if (policy.webFilter === 'adult') native.setWebContentFilterPolicy({ type: 'auto' }, 'familia-segura-policy');
    else native.clearWebContentFilterPolicy('familia-segura-policy');
  } catch {
    // Autorização ausente: a proteção aparece como pendente na tela de configuração.
  }
}

export async function unlockIosInstallations(minutes: number, policy: ChildPolicy | null) {
  if (Platform.OS !== 'ios') return;
  await AsyncStorage.setItem(INSTALL_UNLOCK_KEY, String(Date.now() + minutes * 60_000));
  if (IosControls?.isAvailable()) IosControls.applyDeviceProtection(policy?.blockAppRemoval ?? true, false);
}

export function clearIosDeviceProtection() {
  if (Platform.OS !== 'ios') return;
  IosControls?.clearDeviceProtection();
}

export function getIosDeviceProtection() {
  if (Platform.OS !== 'ios' || !IosControls) return null;
  return IosControls.getDeviceProtection();
}
