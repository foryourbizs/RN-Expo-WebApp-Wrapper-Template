// lib/bridges/background/index.ts
import { registerBackgroundHandlers as moduleRegister } from 'rnww-plugin-background';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

/**
 * 백그라운드 플러그인 키
 */
export const BACKGROUND_PLUGIN_KEY = 'bg';

/**
 * 백그라운드 관련 핸들러 등록
 */
export const registerBackgroundHandlers = (bridge: BridgeAPI, platform: PlatformInfo) => {
  moduleRegister({
    bridge,
    platform: { OS: platform.OS },
  });
};
