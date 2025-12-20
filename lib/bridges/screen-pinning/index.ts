/**
 * 앱 고정(Screen Pinning) 관련 핸들러 - Android 전용
 */

import { registerHandler } from '@/lib/bridge';

export const registerScreenPinningHandlers = () => {
  // 앱 고정 상태 확인
  registerHandler('getScreenPinning', async (_payload, respond) => {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ success: false, isPinned: false, error: 'Only supported on Android' });
        return;
      }
      
      const ScreenPinning = await import('@/modules/screen-pinning');
      const status = await ScreenPinning.isScreenPinned();
      respond({ success: true, ...status });
    } catch (error) {
      respond({ success: false, isPinned: false, error: error instanceof Error ? error.message : 'Failed to get screen pinning status' });
    }
  });

  // 앱 고정 시작
  registerHandler('startScreenPinning', async (_payload, respond) => {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ success: false, error: 'Only supported on Android' });
        return;
      }
      
      const ScreenPinning = await import('@/modules/screen-pinning');
      const result = await ScreenPinning.startScreenPinning();
      respond(result);
    } catch (error) {
      respond({ success: false, error: error instanceof Error ? error.message : 'Failed to start screen pinning' });
    }
  });

  // 앱 고정 해제
  registerHandler('stopScreenPinning', async (_payload, respond) => {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ success: false, error: 'Only supported on Android' });
        return;
      }
      
      const ScreenPinning = await import('@/modules/screen-pinning');
      const result = await ScreenPinning.stopScreenPinning();
      respond(result);
    } catch (error) {
      respond({ success: false, error: error instanceof Error ? error.message : 'Failed to stop screen pinning' });
    }
  });

  console.log('[Bridge] ScreenPinning handlers registered');
};