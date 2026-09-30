import AsyncStorage from '@react-native-async-storage/async-storage';
import { unregisterGuardianPush } from '@/services/push';

/** Dados da família guardados para abrir rápido/sem internet: saem junto com a conta (celular compartilhado). */
const SESSION_PREFIXES = ['@familia-segura/overview_', '@familia-segura/selected-child_'];

export async function forgetSessionData() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => SESSION_PREFIXES.some((prefix) => key.startsWith(prefix)));
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  } catch {
    // armazenamento indisponível: nada a limpar
  }
}

/** Sair da conta de verdade: sem avisos da família neste aparelho e sem dados da família em cache. */
export async function signOutCompletely(signOut: () => Promise<unknown>, sessionToken?: string | null) {
  await unregisterGuardianPush(sessionToken);
  await forgetSessionData();
  await signOut();
}
