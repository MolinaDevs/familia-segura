import { Platform } from 'react-native';
import type { AppRule, ChildPolicy, Routine } from '@workspace/api-client-react';
import AndroidControls, {
  type AndroidInstalledApp,
  type AndroidProtectionStatus,
  type AndroidQueuedEvent,
} from '@/modules/familia-segura-android-controls/src/FamiliaSeguraAndroidControlsModule';

export type AndroidProtectionState = 'active' | 'partial' | 'disabled' | 'unavailable';

export type AndroidProtectionSummary = {
  state: AndroidProtectionState;
  issues: string[];
  nativeBuildRequired: boolean;
  status: AndroidProtectionStatus | null;
};

const FALLBACK_LEASE_HOURS = 72;

/** Compatibilidade com regras antigas que só tinham o id curto. */
const legacyAliases: Record<string, string> = {
  youtube: 'com.google.android.youtube',
  instagram: 'com.instagram.android',
  tiktok: 'com.zhiliaoapp.musically',
  whatsapp: 'com.whatsapp',
};

export function packagesForRule(rule: Pick<AppRule, 'appId' | 'androidPackages'>): string[] {
  if (rule.androidPackages?.length) return rule.androidPackages;
  const normalized = rule.appId.trim().toLocaleLowerCase('en-US');
  if (normalized.includes('.')) return [normalized];
  return legacyAliases[normalized] ? [legacyAliases[normalized]] : [];
}

export const isAndroidNative = () => Platform.OS === 'android' && Boolean(AndroidControls?.isAvailable());

/** Servidores de DNS familiar aceitos (bloqueiam conteúdo adulto e forçam busca segura/YouTube restrito). */
export const FAMILY_DNS_HOSTS = ['family-filter-dns.cleanbrowsing.org', 'family.adguard-dns.com', 'family.cloudflare-dns.com'];
export const RECOMMENDED_FAMILY_DNS = FAMILY_DNS_HOSTS[0];

export function androidWebFilterActive(status: AndroidProtectionStatus | null) {
  return Boolean(status && status.privateDnsMode === 'hostname' && FAMILY_DNS_HOSTS.includes(status.privateDnsHost.trim().toLowerCase()));
}

export function getAndroidProtectionSummary(webFilter: 'off' | 'adult' = 'off'): AndroidProtectionSummary {
  if (Platform.OS !== 'android') {
    return { state: 'unavailable', issues: ['Disponível apenas no Android'], nativeBuildRequired: false, status: null };
  }
  if (!AndroidControls?.isAvailable()) {
    return { state: 'unavailable', issues: ['Build nativa necessária'], nativeBuildRequired: true, status: null };
  }
  const status = AndroidControls.getProtectionStatus();
  const issues: string[] = [];
  if (!status.usageAccessGranted) issues.push('Acesso ao uso desativado');
  if (!status.accessibilityEnabled) issues.push('Serviço de proteção desativado');
  if (status.accessibilityEnabled && !status.serviceRunning) issues.push('Serviço aguardando inicialização');
  if (!status.deviceAdminActive) issues.push('Proteção contra desinstalação desativada');
  if (!status.batteryOptimizationExempt) issues.push('Otimização de bateria ativa');
  if (!status.policyLeaseActive) issues.push('Regras precisam ser atualizadas');
  if (webFilter === 'adult' && !androidWebFilterActive(status)) issues.push('Filtro de conteúdo adulto inativo (DNS privado)');
  if (status.guardianUnlockedUntil > Date.now()) issues.push('Liberado temporariamente pelo responsável');
  const corePermissions = status.usageAccessGranted && status.accessibilityEnabled;
  const state: AndroidProtectionState = corePermissions
    ? (issues.length === 0 ? 'active' : 'partial')
    : (status.usageAccessGranted || status.accessibilityEnabled ? 'partial' : 'disabled');
  return { state, issues, nativeBuildRequired: false, status };
}

export const openAndroidUsageSettings = () => AndroidControls?.openUsageAccessSettings();
export const openAndroidAccessibilitySettings = () => AndroidControls?.openAccessibilitySettings();
export const openAndroidBatterySettings = () => AndroidControls?.openBatteryOptimizationSettings();
export const openAndroidNetworkSettings = () => AndroidControls?.openNetworkSettings();
export const requestAndroidDeviceAdmin = () => AndroidControls?.requestDeviceAdmin(
  'Impede que o Família Segura seja desinstalado sem o PIN do responsável. Desativar esta proteção avisa a família.',
);
export const removeAndroidDeviceAdmin = () => AndroidControls?.removeDeviceAdmin();
export const setAndroidGuardianUnlock = (minutes: number) => AndroidControls?.setGuardianUnlock(minutes);

/** Grava as regras para o serviço nativo. Só deve ser chamado após uma resposta autenticada do servidor. */
export function applyAndroidPolicies(rules: AppRule[], routines: Routine[], policy?: ChildPolicy, inventorySyncedPackages?: string[]) {
  if (!AndroidControls) return { configuredRules: 0, configuredRoutines: 0, skippedRules: rules.length };
  const apps = rules.flatMap((rule) => packagesForRule(rule).map((packageName) => ({
    ruleId: rule.id,
    otherDevicesMinutes: rule.otherDevicesUsageMinutes ?? 0,
    packageName,
    appName: rule.appName,
    status: rule.status,
    dailyLimitMinutes: rule.dailyLimitMinutes,
  })));
  const leaseHours = policy?.leaseHours ?? FALLBACK_LEASE_HOURS;
  AndroidControls.savePolicies({
    validUntilEpochMs: Date.now() + leaseHours * 60 * 60 * 1000,
    tamperProtection: Boolean(policy?.pinVerifier),
    quarantineNewApps: policy?.quarantineNewApps ?? false,
    blockAppInstalls: policy?.blockAppInstalls ?? false,
    blockAppRemoval: policy?.blockAppRemoval ?? false,
    webFilter: policy?.webFilter ?? 'off',
    installUnlockUntilEpochMs: policy?.installUnlockUntil ? new Date(policy.installUnlockUntil).getTime() : 0,
    blockedPackages: policy?.blockedPackages ?? [],
    pendingPackages: policy?.pendingPackages ?? [],
    ...(inventorySyncedPackages ? { inventorySyncedPackages } : {}),
    apps,
    routines: routines.map((routine) => ({
      days: routine.days,
      startTime: routine.startTime,
      endTime: routine.endTime,
      enabled: routine.enabled,
    })),
  });
  return {
    configuredRules: rules.filter((rule) => packagesForRule(rule).length > 0).length,
    configuredRoutines: routines.filter((routine) => routine.enabled).length,
    skippedRules: rules.filter((rule) => packagesForRule(rule).length === 0).length,
  };
}

export function clearAndroidPolicies() {
  AndroidControls?.savePolicies({
    validUntilEpochMs: 0, tamperProtection: false, quarantineNewApps: false, blockAppInstalls: false, blockAppRemoval: false,
    webFilter: 'off', installUnlockUntilEpochMs: 0,
    blockedPackages: [], pendingPackages: [], apps: [], routines: [],
  });
}

const clampMinutes = (value: number) => Math.max(0, Math.min(1440, Math.round(value)));

/**
 * Uso de hoje: apps com regra (somando os pacotes de cada regra) + demais apps usados,
 * para o responsável ver o ranking completo nos gráficos.
 */
export function getAndroidUsageSamples(rules: AppRule[]) {
  if (!AndroidControls) return [];
  const all = AndroidControls.getAllUsageToday();
  const covered = new Set<string>();
  const samples = rules.map((rule) => {
    const packages = packagesForRule(rule);
    packages.forEach((pkg) => covered.add(pkg));
    const minutes = packages.reduce((sum, pkg) => sum + (all[pkg] ?? 0), 0);
    return { appId: rule.appId, usageTodayMinutes: clampMinutes(minutes) };
  });
  const others = Object.entries(all)
    .filter(([pkg, minutes]) => !covered.has(pkg) && minutes >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 150)
    .map(([pkg, minutes]) => ({ appId: pkg, usageTodayMinutes: clampMinutes(minutes) }));
  return [...samples, ...others];
}

export function getAndroidInstalledApps(): AndroidInstalledApp[] {
  return AndroidControls?.getInstalledApps() ?? [];
}

export function drainAndroidEvents(): AndroidQueuedEvent[] {
  return AndroidControls?.drainEvents() ?? [];
}
