import { Platform } from 'react-native';
import type { AppRule, Routine } from '@workspace/api-client-react';
import AndroidControls, {
  type AndroidProtectionStatus,
} from '@/modules/familia-segura-android-controls/src/FamiliaSeguraAndroidControlsModule';

export type AndroidProtectionState = 'active' | 'partial' | 'disabled' | 'unavailable';

export type AndroidProtectionSummary = {
  state: AndroidProtectionState;
  issues: string[];
  nativeBuildRequired: boolean;
  status: AndroidProtectionStatus | null;
};

const packageAliases: Record<string, string> = {
  youtube: 'com.google.android.youtube',
  instagram: 'com.instagram.android',
  tiktok: 'com.zhiliaoapp.musically',
  whatsapp: 'com.whatsapp',
  facebook: 'com.facebook.katana',
  messenger: 'com.facebook.orca',
  chrome: 'com.android.chrome',
  netflix: 'com.netflix.mediaclient',
  spotify: 'com.spotify.music',
  roblox: 'com.roblox.client',
  minecraft: 'com.mojang.minecraftpe',
};

const OFFLINE_POLICY_LEASE_MS = 72 * 60 * 60 * 1000;

export function packageNameForApp(appId: string) {
  const normalized = appId.trim().toLocaleLowerCase('en-US');
  if (normalized.includes('.')) return normalized;
  return packageAliases[normalized] ?? normalized;
}

export function getAndroidProtectionSummary(): AndroidProtectionSummary {
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
  if (!status.batteryOptimizationExempt) issues.push('Otimização de bateria ativa');
  if (!status.policyLeaseActive) issues.push('Regras precisam ser atualizadas');
  const corePermissions = status.usageAccessGranted && status.accessibilityEnabled;
  const state: AndroidProtectionState = corePermissions
    ? (issues.length === 0 ? 'active' : 'partial')
    : (status.usageAccessGranted || status.accessibilityEnabled ? 'partial' : 'disabled');
  return { state, issues, nativeBuildRequired: false, status };
}

export function openAndroidUsageSettings() {
  AndroidControls?.openUsageAccessSettings();
}

export function openAndroidAccessibilitySettings() {
  AndroidControls?.openAccessibilitySettings();
}

export function openAndroidBatterySettings() {
  AndroidControls?.openBatteryOptimizationSettings();
}

export function applyAndroidPolicies(rules: AppRule[], routines: Routine[]) {
  if (!AndroidControls) return { configuredRules: 0, configuredRoutines: 0, skippedRules: rules.length };
  const apps = rules
    .map((rule) => ({
      packageName: packageNameForApp(rule.appId),
      appName: rule.appName,
      status: rule.status,
      dailyLimitMinutes: rule.dailyLimitMinutes,
    }))
    .filter((rule) => rule.packageName.includes('.'));
  AndroidControls.savePolicies({
    validUntilEpochMs: Date.now() + OFFLINE_POLICY_LEASE_MS,
    apps,
    routines: routines.map((routine) => ({
      days: routine.days,
      startTime: routine.startTime,
      endTime: routine.endTime,
      enabled: routine.enabled,
    })),
  });
  return {
    configuredRules: apps.length,
    configuredRoutines: routines.filter((routine) => routine.enabled).length,
    skippedRules: rules.length - apps.length,
  };
}

export function clearAndroidPolicies() {
  AndroidControls?.savePolicies({ validUntilEpochMs: 0, apps: [], routines: [] });
}

export function getAndroidUsageSamples(rules: AppRule[]) {
  if (!AndroidControls) return [];
  const mapped = rules.map((rule) => ({ appId: rule.appId, packageName: packageNameForApp(rule.appId) }));
  const usage = AndroidControls.getUsageToday(mapped.map((item) => item.packageName));
  return mapped.map((item) => ({
    appId: item.appId,
    usageTodayMinutes: Math.max(0, Math.min(1440, Math.round(usage[item.packageName] ?? 0))),
  }));
}