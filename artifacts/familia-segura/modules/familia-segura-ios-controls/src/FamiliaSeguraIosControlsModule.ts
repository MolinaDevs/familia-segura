import { requireOptionalNativeModule } from 'expo-modules-core';

type IosControlsModule = {
  isAvailable(): boolean;
  applyDeviceProtection(denyAppRemoval: boolean, denyAppInstallation: boolean): void;
  getDeviceProtection(): { denyAppRemoval: boolean; denyAppInstallation: boolean };
  clearDeviceProtection(): void;
};

export default requireOptionalNativeModule<IosControlsModule>('FamiliaSeguraIosControls');
