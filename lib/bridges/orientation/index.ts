/**
 * 화면 방향 관련 핸들러
 */

import { registerHandler } from '@/lib/bridge';

export const registerOrientationHandlers = () => {
  // 화면 방향 조회
  registerHandler('getOrientation', async (_payload, respond) => {
    try {
      const ScreenOrientation = await import('expo-screen-orientation');
      const orientation = await ScreenOrientation.getOrientationAsync();
      const lockState = await ScreenOrientation.getOrientationLockAsync();
      
      // orientation 숫자를 문자열로 변환
      const orientationMap: Record<number, string> = {
        [ScreenOrientation.Orientation.UNKNOWN]: 'unknown',
        [ScreenOrientation.Orientation.PORTRAIT_UP]: 'portrait-up',
        [ScreenOrientation.Orientation.PORTRAIT_DOWN]: 'portrait-down',
        [ScreenOrientation.Orientation.LANDSCAPE_LEFT]: 'landscape-left',
        [ScreenOrientation.Orientation.LANDSCAPE_RIGHT]: 'landscape-right',
      };
      
      // lock 상태를 문자열로 변환
      const lockMap: Record<number, string> = {
        [ScreenOrientation.OrientationLock.DEFAULT]: 'default',
        [ScreenOrientation.OrientationLock.ALL]: 'all',
        [ScreenOrientation.OrientationLock.PORTRAIT]: 'portrait',
        [ScreenOrientation.OrientationLock.PORTRAIT_UP]: 'portrait-up',
        [ScreenOrientation.OrientationLock.PORTRAIT_DOWN]: 'portrait-down',
        [ScreenOrientation.OrientationLock.LANDSCAPE]: 'landscape',
        [ScreenOrientation.OrientationLock.LANDSCAPE_LEFT]: 'landscape-left',
        [ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT]: 'landscape-right',
      };

      respond({
        success: true,
        orientation: orientationMap[orientation] || 'unknown',
        lock: lockMap[lockState] || 'unknown',
        raw: { orientation, lockState },
      });
    } catch (error) {
      respond({ success: false, error: 'Screen orientation not available' });
    }
  });

  // 화면 방향 설정
  registerHandler<{ mode: 'portrait' | 'landscape' | 'auto' | 'portrait-up' | 'portrait-down' | 'landscape-left' | 'landscape-right' }>(
    'setOrientation',
    async ({ mode }, respond) => {
      try {
        const ScreenOrientation = await import('expo-screen-orientation');
        
        const lockMap: Record<string, number> = {
          'auto': ScreenOrientation.OrientationLock.DEFAULT,
          'all': ScreenOrientation.OrientationLock.ALL,
          'portrait': ScreenOrientation.OrientationLock.PORTRAIT,
          'portrait-up': ScreenOrientation.OrientationLock.PORTRAIT_UP,
          'portrait-down': ScreenOrientation.OrientationLock.PORTRAIT_DOWN,
          'landscape': ScreenOrientation.OrientationLock.LANDSCAPE,
          'landscape-left': ScreenOrientation.OrientationLock.LANDSCAPE_LEFT,
          'landscape-right': ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
        };

        const lockValue = lockMap[mode];
        if (lockValue === undefined) {
          respond({ success: false, error: `Invalid mode: ${mode}. Use: auto, portrait, landscape, portrait-up, portrait-down, landscape-left, landscape-right` });
          return;
        }

        await ScreenOrientation.lockAsync(lockValue);
        respond({ success: true, mode });
      } catch (error) {
        respond({ success: false, error: error instanceof Error ? error.message : 'Failed to set orientation' });
      }
    }
  );

  // 화면 방향 잠금 해제 (자동 회전 활성화)
  registerHandler('unlockOrientation', async (_payload, respond) => {
    try {
      const ScreenOrientation = await import('expo-screen-orientation');
      await ScreenOrientation.unlockAsync();
      respond({ success: true });
    } catch (error) {
      respond({ success: false, error: 'Failed to unlock orientation' });
    }
  });

  console.log('[Bridge] Orientation handlers registered');
};
