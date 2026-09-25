import { requireOptionalNativeModule } from 'expo-modules-core';

export type AndroidProtectionStatus = {
  androidApiLevel: number;
  usageAccessGranted: boolean;
  accessibilityEnabled: boolean;
  batteryOptimizationExempt: boolean;
  serviceRunning: boolean;
  policyLeaseActive: boolean;
  deviceAdminActive: boolean;
  guardianUnlockedUntil: number;
  model: string;
  osVersion: string;
  batteryLevel: number;
};

export type AndroidPolicy = {
  validUntilEpochMs: number;
  /** Ativa a proteção contra desligar/desinstalar (só com PIN do responsável definido). */
  tamperProtection: boolean;
  quarantineNewApps: boolean;
  blockAppInstalls: boolean;
  blockAppRemoval: boolean;
  blockedPackages: string[];
  pendingPackages: string[];
  /** Pacotes que o servidor acabou de receber no inventário (podem sair da quarentena local). */
  inventorySyncedPackages?: string[];
  apps: Array<{
    ruleId: string;
    otherDevicesMinutes: number;
    packageName: string;
    appName: string;
    status: string;
    dailyLimitMinutes: number;
  }>;
  routines: Array<{
    days: string;
    startTime: string;
    endTime: string;
    enabled: boolean;
  }>;
};

export type AndroidQueuedEvent = { type: string; detail: string; at: number };
export type AndroidInstalledApp = { packageName: string; label: string; system: boolean; installedAt: number };

type AndroidControlsModule = {
  isAvailable(): boolean;
  getProtectionStatus(): AndroidProtectionStatus;
  openUsageAccessSettings(): void;
  openAccessibilitySettings(): void;
  openBatteryOptimizationSettings(): void;
  requestDeviceAdmin(explanation: string): void;
  removeDeviceAdmin(): void;
  savePolicies(policy: AndroidPolicy): void;
  setGuardianUnlock(minutes: number): void;
  drainEvents(): AndroidQueuedEvent[];
  getInstalledApps(): AndroidInstalledApp[];
  getUsageToday(packageNames: string[]): Record<string, number>;
  getAllUsageToday(): Record<string, number>;
};

export default requireOptionalNativeModule<AndroidControlsModule>('FamiliaSeguraAndroidControls');
