/**
 * 스플래시 화면 관련 핸들러
 */

import { registerHandler } from '@/lib/bridge';

export const registerSplashHandlers = () => {
  // 스플래시 숨기기
  registerHandler('hideSplash', async () => {
    const { hideSplashScreen } = await import('@/app/_layout');
    hideSplashScreen();
  });

  console.log('[Bridge] Splash handlers registered');
};
