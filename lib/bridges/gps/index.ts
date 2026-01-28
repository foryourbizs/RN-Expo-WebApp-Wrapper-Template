// lib/bridges/gps/index.ts
import { registerGpsHandlers as moduleRegister } from 'rnww-plugin-gps';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

/**
 * GPS 플러그인 키
 */
export const GPS_PLUGIN_KEY = 'gps';

/**
 * GPS 관련 핸들러 등록
 */
export const registerGpsHandlers = (bridge: BridgeAPI, platform: PlatformInfo) => {
  moduleRegister({
    bridge,
    platform: { OS: platform.OS },
  });
};
