import { requireOptionalNativeModule } from 'expo-modules-core';

export type AndroidProtectionStatus = {
  androidApiLevel: number;
  usageAccessGranted: boolean;
  accessibilityEnabled: boolean;
  batteryOptimizationExempt: boolean;
  serviceRunning: boolean;
  policyLeaseActive: boolean;
};

export type AndroidPolicy = {
  validUntilEpochMs: number;
  apps: Array<{
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

type AndroidControlsModule = {
  isAvailable(): boolean;
  getProtectionStatus(): AndroidProtectionStatus;
  openUsageAccessSettings(): void;
  openAccessibilitySettings(): void;
  openBatteryOptimizationSettings(): void;
  savePolicies(policy: AndroidPolicy): void;
  getUsageToday(packageNames: string[]): Record<string, number>;
};

export default requireOptionalNativeModule<AndroidControlsModule>('FamiliaSeguraAndroidControls');