/**
 * 스플래시 화면 관련 핸들러
 */

import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

export const registerSplashHandlers = (bridge: BridgeAPI, _platform: PlatformInfo) => {
  const { registerHandler } = bridge;

  // 스플래시 숨기기
  registerHandler('hide', async () => {
    const { hideSplashScreen } = await import('@/app/_layout');
    hideSplashScreen();
  });

  console.log('[Splash] Handlers registered');
};
