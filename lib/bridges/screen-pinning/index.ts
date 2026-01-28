// lib/bridges/screen-pinning/index.ts
import { registerScreenPinningHandlers as moduleRegister } from 'rnww-plugin-screen-pinning';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

/**
 * 스크린 피닝 플러그인 키
 */
export const SCREEN_PINNING_PLUGIN_KEY = 'pin';

/**
 * 앱 고정(Screen Pinning) 관련 핸들러 - Android 전용
 */
export const registerScreenPinningHandlers = (bridge: BridgeAPI, platform: PlatformInfo) => {
  moduleRegister({
    bridge,
    platform: { OS: platform.OS },
  });
};
