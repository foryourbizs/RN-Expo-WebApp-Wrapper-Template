/**
 * 상태바(Status Bar) 관련 핸들러
 */

import { APP_CONFIG } from '@/constants/app-config';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

// APP_CONFIG의 style 값을 RN StatusBar barStyle로 변환
const mapStyleToBarStyle = (style: string): 'default' | 'light-content' | 'dark-content' => {
  switch (style) {
    case 'light': return 'light-content';
    case 'dark': return 'dark-content';
    default: return 'default';
  }
};

// 저장된 상태바 상태 (APP_CONFIG 기반 초기값)
let savedStatusBarState: {
  hidden: boolean;
  style: 'default' | 'light-content' | 'dark-content';
  color?: string;
} | null = {
  hidden: !APP_CONFIG.statusBar.visible,
  style: mapStyleToBarStyle(APP_CONFIG.statusBar.style),
};

export const registerStatusBarHandlers = (bridge: BridgeAPI, _platform: PlatformInfo) => {
  const { registerHandler } = bridge;

  // 상태바 상태 조회
  registerHandler('get', async (_payload, respond) => {
    try {
      // React Native StatusBar는 상태 조회 API가 없어서 저장된 값 반환
      respond({
        success: true,
        saved: savedStatusBarState,
        note: 'StatusBar API does not provide current state query. Returns last saved state.',
      });
    } catch (error) {
      respond({ success: false, error: 'Failed to get status bar state' });
    }
  });

  // 상태바 설정
  registerHandler<{
    hidden?: boolean;
    style?: 'default' | 'light-content' | 'dark-content';
    color?: string;
    animated?: boolean;
  }>('set', async ({ hidden, style, color, animated = true }, respond) => {
    try {
      const { StatusBar, Platform } = await import('react-native');

      // 현재 상태 저장 (초기값이 없는 경우 대비)
      if (!savedStatusBarState) {
        savedStatusBarState = {
          hidden: !APP_CONFIG.statusBar.visible,
          style: mapStyleToBarStyle(APP_CONFIG.statusBar.style),
        };
      }

      if (hidden !== undefined) {
        StatusBar.setHidden(hidden, animated ? 'fade' : 'none');
        savedStatusBarState.hidden = hidden;
      }

      if (style) {
        StatusBar.setBarStyle(style, animated);
        savedStatusBarState.style = style;
      }

      if (color && Platform.OS === 'android') {
        StatusBar.setBackgroundColor(color, animated);
        savedStatusBarState.color = color;
      }

      respond({ success: true, hidden, style, color });
    } catch (error) {
      respond({ success: false, error: error instanceof Error ? error.message : 'Failed to set status bar' });
    }
  });

  // 상태바 원래 상태로 복원
  registerHandler('restore', async (_payload, respond) => {
    try {
      const { StatusBar, Platform } = await import('react-native');

      if (savedStatusBarState) {
        StatusBar.setHidden(savedStatusBarState.hidden, 'fade');
        StatusBar.setBarStyle(savedStatusBarState.style, true);
        if (savedStatusBarState.color && Platform.OS === 'android') {
          StatusBar.setBackgroundColor(savedStatusBarState.color, true);
        }
        respond({ success: true, restored: savedStatusBarState });
      } else {
        // 기본값으로 복원
        StatusBar.setHidden(false, 'fade');
        StatusBar.setBarStyle('default', true);
        respond({ success: true, restored: { hidden: false, style: 'default' } });
      }
    } catch (error) {
      respond({ success: false, error: 'Failed to restore status bar' });
    }
  });

  console.log('[StatusBar] Handlers registered');
};
