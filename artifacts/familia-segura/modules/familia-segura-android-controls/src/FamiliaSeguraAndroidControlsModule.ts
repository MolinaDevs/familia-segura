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
  privateDnsMode: string;
  privateDnsHost: string;
};

export type AndroidPolicy = {
  validUntilEpochMs: number;
  /** Ativa a proteção contra desligar/desinstalar (só com PIN do responsável definido). */
  tamperProtection: boolean;
  quarantineNewApps: boolean;
  blockAppInstalls: boolean;
  blockAppRemoval: boolean;
  webFilter: 'off' | 'adult';
  /** Liberação de instalação dada à distância pelo responsável. */
  installUnlockUntilEpochMs: number;
  /** "Pausar agora": todos os apps em pausa até este instante (0 = sem pausa). */
  pausedUntilEpochMs: number;
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
    lockScreen?: boolean;
  }>;
};

/** Dados do assistente de configuração (fabricante, origem da instalação, o que o serviço guardou). */
export type AndroidSetupInfo = {
  manufacturer: string;
  brand: string;
  androidApiLevel: number;
  installer: string;
  /** Instalado por uma loja: não cai em "configuração restrita" do Android 13+. */
  fromStore: boolean;
  policyPresent: boolean;
  rulesCount: number;
  routinesCount: number;
  tamperProtection: boolean;
  /** Epoch ms da última vez que a tela de pausa ficou visível (0 = nunca). */
  lastBlockShownAt: number;
};

export type AndroidQueuedEvent = { type: string; detail: string; at: number };
export type AndroidInstalledApp = { packageName: string; label: string; system: boolean; installedAt: number };

type AndroidControlsModule = {
  isAvailable(): boolean;
  getProtectionStatus(): AndroidProtectionStatus;
  openUsageAccessSettings(): void;
  openAccessibilitySettings(): void;
  openBatteryOptimizationSettings(): void;
  getSetupInfo(): AndroidSetupInfo;
  openAppDetails(): boolean;
  openAutostartSettings(): boolean;
  openPopupPermissionSettings(): boolean;
  testBlock(): boolean;
  openNetworkSettings(): void;
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
