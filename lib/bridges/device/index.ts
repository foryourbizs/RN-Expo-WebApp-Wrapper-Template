/**
 * 디바이스/앱 정보 관련 핸들러
 */

import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

export const registerDeviceHandlers = (bridge: BridgeAPI, _platform: PlatformInfo) => {
  const { registerHandler } = bridge;

  // 디바이스 정보 요청 (expo-device 사용 - 프로덕션 빌드에서도 동작)
  registerHandler('getInfo', async (_payload, respond) => {
    try {
      const { Platform } = await import('react-native');
      const Device = await import('expo-device');

      respond({
        platform: Platform.OS,
        version: Platform.Version,
        isTV: Platform.isTV,
        // expo-device 추가 정보
        brand: Device.brand ?? null,
        modelName: Device.modelName ?? null,
        deviceName: Device.deviceName ?? null, // Android 13+에서는 null일 수 있음
        osName: Device.osName ?? null,
        osVersion: Device.osVersion ?? null,
        deviceType: Device.deviceType ?? null,
        isDevice: Device.isDevice ?? null,
      });
    } catch (error) {
      console.error('[Device] getInfo error:', error);
      respond({
        error: 'Failed to get device info',
        platform: null,
        version: null,
      });
    }
  });

  // 앱 정보 요청 (expo-application 사용 - 프로덕션 빌드에서도 동작)
  registerHandler('getAppInfo', async (_payload, respond) => {
    try {
      const Application = await import('expo-application');
      respond({
        name: Application.applicationName ?? null,
        version: Application.nativeApplicationVersion ?? null,
        buildVersion: Application.nativeBuildVersion ?? null,
        bundleId: Application.applicationId ?? null,
      });
    } catch (error) {
      console.error('[Device] getAppInfo error:', error);
      respond({
        error: 'Failed to get app info',
        name: null,
        version: null,
      });
    }
  });

  console.log('[Device] Handlers registered');
};
