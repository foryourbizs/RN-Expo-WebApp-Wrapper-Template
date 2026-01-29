// lib/bridges/wifi/index.ts
import { registerWifiHandlers as moduleRegister } from 'rnww-plugin-wifi';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

/**
 * WiFi 플러그인 키
 */
export const WIFI_PLUGIN_KEY = 'wifi';

/**
 * WiFi 관련 핸들러 등록
 */
export const registerWifiHandlers = (bridge: BridgeAPI, platform: PlatformInfo) => {
  moduleRegister({
    bridge,
    platform: { OS: platform.OS },
  });
};
