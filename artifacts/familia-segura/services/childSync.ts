import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  getChildOverview,
  reportDeviceEvents,
  syncChildProtection,
  syncChildUsage,
  syncInstalledApps,
  type ChildOverview,
  type DeviceEventsInputEventsItemType,
} from '@workspace/api-client-react';
import {
  applyAndroidPolicies,
  clearAndroidPolicies,
  drainAndroidEvents,
  getAndroidInstalledApps,
  getAndroidProtectionSummary,
  getAndroidUsageSamples,
  isAndroidNative,
  setAndroidGuardianUnlock,
} from '@/services/androidParentalControls';
import { applyNativePolicies, getAllowedUsageSamples, getBoundRuleIds, getNativeControlState, loadNativeControls } from '@/services/iosParentalControls';
import { applyIosDeviceProtection, clearIosDeviceProtection, getIosDeviceProtection } from '@/services/iosDeviceProtection';

export type SyncStatus = 'ok' | 'offline' | 'unpaired' | 'revoked';
export type SyncResult = { status: SyncStatus; overview: ChildOverview | null };

const CHILD_MODE_KEY = 'childMode';
const cacheKey = (deviceId: string) => `@familia-segura/child-overview_${deviceId}`;
const EVENT_TYPES: DeviceEventsInputEventsItemType[] = [
  'protection_disabled', 'protection_enabled', 'tamper_attempt', 'uninstall_attempt', 'app_installed',
  'app_removed', 'limit_reached', 'routine_block', 'device_reboot', 'pin_failed',
];

export async function deviceAuthHeaders(): Promise<Record<string, string> | null> {
  if (Platform.OS === 'web') return null;
  const token = await SecureStore.getItemAsync('deviceToken');
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function loadCachedOverview(): Promise<ChildOverview | null> {
  const deviceId = Platform.OS === 'web' ? null : await SecureStore.getItemAsync('deviceId');
  if (!deviceId) return null;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(deviceId));
    return raw ? (JSON.parse(raw) as ChildOverview) : null;
  } catch {
    return null;
  }
}

/** Revogado pelo responsável: remove credenciais e desliga a proteção local imediatamente. */
export async function clearChildDevice() {
  const deviceId = await SecureStore.getItemAsync('deviceId').catch(() => null);
  if (Platform.OS === 'android') {
    clearAndroidPolicies();
    setAndroidGuardianUnlock(0);
  }
  if (Platform.OS === 'ios') {
    clearIosDeviceProtection();
    const native = await loadNativeControls();
    try {
      native?.stopMonitoring();
      native?.clearAllManagedSettingsStoreSettings();
      // Sem a autorização "child", o app volta a poder ser apagado normalmente (fim do vínculo com a família).
      await native?.revokeAuthorization().catch(() => undefined);
    } catch {
      // sem autorização: nada aplicado
    }
  }
  await AsyncStorage.multiRemove([CHILD_MODE_KEY, INVENTORY_KEY]).catch(() => undefined);
  if (deviceId) await AsyncStorage.removeItem(cacheKey(deviceId)).catch(() => undefined);
  await Promise.all(['deviceId', 'childId', 'deviceToken'].map((key) => SecureStore.deleteItemAsync(key).catch(() => undefined)));
}

const INVENTORY_KEY = '@familia-segura/inventory-sent';
const INVENTORY_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const inventoryKey = (packages: string[]) => [...packages].sort().join('|');

/** Lista de apps (até 600) só vai ao servidor quando muda ou a cada 6 h — economiza bateria e dados. */
async function inventoryChanged(packages: string[]) {
  try {
    const raw = await AsyncStorage.getItem(INVENTORY_KEY);
    if (!raw) return true;
    const sent = JSON.parse(raw) as { key: string; at: number };
    return sent.key !== inventoryKey(packages) || Date.now() - sent.at > INVENTORY_MAX_AGE_MS;
  } catch {
    return true;
  }
}

async function markInventorySent(packages: string[]) {
  await AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify({ key: inventoryKey(packages), at: Date.now() })).catch(() => undefined);
}

const EVENTS_BUFFER_KEY = '@familia-segura/pending-device-events';
type BufferedEvent = { type: DeviceEventsInputEventsItemType; detail?: string; occurredAt: string };

/**
 * Eventos nativos (adulteração, instalação, reinício) passam por um buffer persistente:
 * a fila nativa é esvaziada na leitura, então só apagamos o buffer depois que o servidor confirmar.
 */
async function flushDeviceEvents(headers: Record<string, string>) {
  const fresh: BufferedEvent[] = drainAndroidEvents()
    .filter((event): event is typeof event & { type: DeviceEventsInputEventsItemType } => EVENT_TYPES.includes(event.type as DeviceEventsInputEventsItemType))
    .map((event) => ({ type: event.type, detail: event.detail ? event.detail.slice(0, 240) : undefined, occurredAt: new Date(event.at).toISOString() }));
  let buffered: BufferedEvent[] = [];
  try {
    buffered = JSON.parse((await AsyncStorage.getItem(EVENTS_BUFFER_KEY)) ?? '[]') as BufferedEvent[];
  } catch {
    buffered = [];
  }
  const pending = [...buffered, ...fresh].slice(-200);
  if (pending.length === 0) return;
  await AsyncStorage.setItem(EVENTS_BUFFER_KEY, JSON.stringify(pending));
  for (let i = 0; i < pending.length; i += 50) {
    await reportDeviceEvents({ events: pending.slice(i, i + 50) }, { headers });
  }
  await AsyncStorage.removeItem(EVENTS_BUFFER_KEY);
}

const localDateParts = () => {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { localDate, localHour: now.getHours() };
};

async function syncAndroid(overview: ChildOverview, headers: Record<string, string>) {
  applyAndroidPolicies(overview.apps, overview.routines, overview.policy);
  // Alertas primeiro: não podem esperar o inventário (mais pesado) dar certo.
  await flushDeviceEvents(headers).catch(() => undefined);

  const installed = getAndroidInstalledApps();
  if (installed.length > 0 && (await inventoryChanged(installed.map((app) => app.packageName)))) {
    const result = await syncInstalledApps({
      snapshot: true,
      apps: installed.slice(0, 600).map((app) => ({
        packageName: app.packageName,
        label: app.label.slice(0, 120) || app.packageName,
        installedAt: app.installedAt ? new Date(app.installedAt).toISOString() : undefined,
      })),
    }, { headers });
    // Reaplica com as listas mais recentes; só agora a quarentena local libera o que o servidor já conhece.
    applyAndroidPolicies(overview.apps, overview.routines, { ...overview.policy, ...result }, installed.map((app) => app.packageName));
    await markInventorySent(installed.map((app) => app.packageName));
  }

  const protection = getAndroidProtectionSummary(overview.policy.webFilter);
  await syncChildProtection({
    state: protection.state,
    issues: protection.issues.slice(0, 10),
    osVersion: protection.status?.osVersion,
    model: protection.status?.model?.slice(0, 80),
    batteryLevel: protection.status?.batteryLevel,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }, { headers });

  const samples = getAndroidUsageSamples(overview.apps);
  if (samples.length > 0) await syncChildUsage({ samples, precision: 'exact', ...localDateParts() }, { headers });
}

async function syncIos(overview: ChildOverview, headers: Record<string, string>) {
  await applyNativePolicies(overview.apps, overview.routines);
  await applyIosDeviceProtection(overview.policy);
  const state = await getNativeControlState();
  const device = getIosDeviceProtection();
  const issues: string[] = [];
  if (state !== 'approved') issues.push('Autorização do Tempo de Uso pendente');
  if (overview.policy.blockAppRemoval && device && !device.denyAppRemoval) issues.push('Bloqueio de apagar apps inativo');
  if (overview.policy.blockAppInstalls && device && !device.denyAppInstallation) issues.push('Instalação de apps liberada');
  await syncChildProtection({
    state: state === 'approved' ? (issues.length === 0 ? 'active' : 'partial') : state === 'unsupported' || state === 'native-build-required' ? 'unavailable' : 'disabled',
    issues,
    boundRuleIds: await getBoundRuleIds(overview.apps),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }, { headers });
  const samples = await getAllowedUsageSamples(overview.apps);
  if (samples.length > 0) await syncChildUsage({ samples, precision: 'estimated', ...localDateParts() }, { headers });
}

let inFlight: Promise<SyncResult> | null = null;

/**
 * Sincronização completa do aparelho da criança. Roda ao abrir o app, ao voltar para o primeiro plano,
 * em segundo plano (a cada ~15 min) e quando chega push silencioso de mudança de regra.
 * O prazo offline (lease) só é renovado com resposta autenticada do servidor — nunca a partir do cache.
 */
export function runChildSync(): Promise<SyncResult> {
  if (!inFlight) inFlight = doSync().finally(() => { inFlight = null; });
  return inFlight;
}

async function doSync(): Promise<SyncResult> {
  const headers = await deviceAuthHeaders();
  if (!headers) return { status: 'unpaired', overview: null };
  let overview: ChildOverview;
  try {
    overview = await getChildOverview({ headers });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) {
      await clearChildDevice();
      return { status: 'revoked', overview: null };
    }
    const cached = await loadCachedOverview();
    // iOS: as regras ficam no próprio sistema (Screen Time); reaplicar do cache não estende prazo algum.
    if (cached && Platform.OS === 'ios') {
      await applyNativePolicies(cached.apps, cached.routines).catch(() => undefined);
      await applyIosDeviceProtection(cached.policy).catch(() => undefined);
    }
    return { status: 'offline', overview: cached };
  }

  await AsyncStorage.setItem(cacheKey(overview.deviceId), JSON.stringify(overview)).catch(() => undefined);
  try {
    if (Platform.OS === 'android' && isAndroidNative()) await syncAndroid(overview, headers);
    else if (Platform.OS === 'ios') await syncIos(overview, headers);
  } catch {
    // Falha parcial (ex.: rede caiu no meio): as regras já foram aplicadas; tenta de novo no próximo ciclo.
  }
  return { status: 'ok', overview };
}
