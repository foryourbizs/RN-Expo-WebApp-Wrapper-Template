// lib/bridges/bluetooth/index.ts
import { registerBluetoothHandlers as moduleRegister } from 'rnww-plugin-bluetooth';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

/**
 * Bluetooth 플러그인 키
 */
export const BLUETOOTH_PLUGIN_KEY = 'bt';

/**
 * Bluetooth 관련 핸들러 등록
 */
export const registerBluetoothHandlers = (bridge: BridgeAPI, platform: PlatformInfo) => {
  moduleRegister({
    bridge,
    platform: { OS: platform.OS },
  });
};
