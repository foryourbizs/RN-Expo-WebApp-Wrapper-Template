/**
 * UI 피드백 관련 핸들러 (Toast, Vibration)
 */

import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

export const registerUIHandlers = (bridge: BridgeAPI, _platform: PlatformInfo) => {
  const { registerHandler } = bridge;

  // 토스트 메시지 (Android: Toast, iOS: Alert)
  registerHandler<{ message: string; duration?: 'short' | 'long' }>(
    'toast',
    async ({ message, duration = 'short' }) => {
      const { ToastAndroid, Platform, Alert } = await import('react-native');
      if (Platform.OS === 'android') {
        ToastAndroid.show(message, duration === 'long' ? ToastAndroid.LONG : ToastAndroid.SHORT);
      } else {
        // iOS는 Toast가 없으므로 Alert 사용 (자동 닫힘 없음)
        Alert.alert('', message);
      }
    }
  );

  // 진동
  registerHandler<{ pattern?: number[] }>('vibrate', async ({ pattern }) => {
    const { Vibration } = await import('react-native');
    if (pattern) {
      Vibration.vibrate(pattern);
    } else {
      Vibration.vibrate();
    }
  });

  console.log('[UI] Handlers registered');
};
