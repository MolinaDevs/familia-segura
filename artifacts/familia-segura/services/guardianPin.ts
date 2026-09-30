import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { scryptAsync } from '@noble/hashes/scrypt';
import { bytesToHex } from '@noble/hashes/utils';
import { verifyGuardianPin, type PinVerifier } from '@workspace/api-client-react';
import { deviceAuthHeaders, loadCachedOverview } from '@/services/childSync';

/** Contador no armazenamento seguro: a criança não consegue zerá-lo editando os dados do app. */
const ATTEMPTS_KEY = 'pinAttempts';
const LEGACY_ATTEMPTS_KEY = '@familia-segura/pin-attempts';
const MAX_OFFLINE_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export type PinCheck = { valid: boolean; lockedUntil?: number; offline?: boolean; noPin?: boolean };

/** Mesmo algoritmo do servidor: scrypt N=16384, r=8, p=1, 32 bytes, salt em texto (hex). */
export async function verifyPinOffline(pin: string, verifier: PinVerifier): Promise<boolean> {
  const hash = await scryptAsync(pin, verifier.salt, { N: 16384, r: 8, p: 1, dkLen: 32 });
  const computed = bytesToHex(hash);
  if (computed.length !== verifier.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ verifier.hash.charCodeAt(i);
  return diff === 0;
}

async function offlineAttempts(): Promise<number[]> {
  try {
    await AsyncStorage.removeItem(LEGACY_ATTEMPTS_KEY).catch(() => undefined);
    const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY);
    const list = raw ? (JSON.parse(raw) as number[]) : [];
    return list.filter((at) => Date.now() - at < WINDOW_MS);
  } catch {
    return [];
  }
}

/**
 * Verifica o PIN do responsável no aparelho da criança.
 * Online: o servidor limita a 5 tentativas a cada 15 min. Sem conexão: verificador offline com o mesmo limite local.
 */
export async function checkGuardianPin(pin: string): Promise<PinCheck> {
  const headers = await deviceAuthHeaders();
  if (headers) {
    try {
      const result = await verifyGuardianPin({ pin }, { headers });
      return { valid: result.valid };
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 429) return { valid: false, lockedUntil: Date.now() + WINDOW_MS };
      if (status && status < 500) return { valid: false };
    }
  }
  const cached = await loadCachedOverview();
  const verifier = cached?.policy.pinVerifier;
  if (!verifier) return { valid: false, offline: true, noPin: true };
  const attempts = await offlineAttempts();
  if (attempts.length >= MAX_OFFLINE_ATTEMPTS) return { valid: false, offline: true, lockedUntil: attempts[0] + WINDOW_MS };
  const valid = await verifyPinOffline(pin, verifier);
  if (!valid) await SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify([...attempts, Date.now()])).catch(() => undefined);
  return { valid, offline: true };
}
