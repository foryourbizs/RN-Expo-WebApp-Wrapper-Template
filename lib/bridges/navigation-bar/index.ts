/**
 * 네비게이션 바(Navigation Bar) 관련 핸들러 - Android 전용
 */

import { registerHandler } from '@/lib/bridge';

// 저장된 네비게이션 바 상태
let savedNavigationBarState: { 
  visible: boolean; 
  color?: string; 
  buttonStyle?: 'light' | 'dark';
} | null = null;

export const registerNavigationBarHandlers = () => {
  // 네비게이션 바 상태 조회 (Android 전용)
  registerHandler('getNavigationBar', async (_payload, respond) => {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ success: false, error: 'Only supported on Android' });
        return;
      }
      
      const NavigationBar = await import('expo-navigation-bar');
      const visibility = await NavigationBar.getVisibilityAsync();
      const buttonStyle = await NavigationBar.getButtonStyleAsync();
      const backgroundColor = await NavigationBar.getBackgroundColorAsync();
      
      respond({
        success: true,
        visible: visibility === 'visible',
        buttonStyle,
        backgroundColor,
        saved: savedNavigationBarState,
      });
    } catch (error) {
      respond({ success: false, error: error instanceof Error ? error.message : 'Failed to get navigation bar state' });
    }
  });

  // 네비게이션 바 설정 (Android 전용) - 통합 설정
  registerHandler<{ 
    visible?: boolean; 
    color?: string; 
    buttonStyle?: 'light' | 'dark';
    behavior?: 'overlay-swipe' | 'inset-swipe' | 'inset-touch';
  }>('setNavigationBar', async ({ visible, color, buttonStyle, behavior = 'overlay-swipe' }, respond) => {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ success: false, error: 'Only supported on Android' });
        return;
      }
      
      const NavigationBar = await import('expo-navigation-bar');
      
      // 현재 상태 저장 (첫 호출 시)
      if (!savedNavigationBarState) {
        savedNavigationBarState = {
          visible: (await NavigationBar.getVisibilityAsync()) === 'visible',
          buttonStyle: await NavigationBar.getButtonStyleAsync(),
          color: await NavigationBar.getBackgroundColorAsync(),
        };
      }
      
      if (visible !== undefined) {
        if (!visible) {
          await NavigationBar.setBehaviorAsync(behavior);
        }
        await NavigationBar.setVisibilityAsync(visible ? 'visible' : 'hidden');
      }
      
      if (color) {
        await NavigationBar.setBackgroundColorAsync(color);
      }
      
      if (buttonStyle) {
        await NavigationBar.setButtonStyleAsync(buttonStyle);
      }
      
      respond({ success: true, visible, color, buttonStyle });
    } catch (error) {
      respond({ success: false, error: error instanceof Error ? error.message : 'Failed to set navigation bar' });
    }
  });

  // 네비게이션 바 원래 상태로 복원 (Android 전용)
  registerHandler('restoreNavigationBar', async (_payload, respond) => {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ success: false, error: 'Only supported on Android' });
        return;
      }
      
      const NavigationBar = await import('expo-navigation-bar');
      
      if (savedNavigationBarState) {
        await NavigationBar.setVisibilityAsync(savedNavigationBarState.visible ? 'visible' : 'hidden');
        if (savedNavigationBarState.color) {
          await NavigationBar.setBackgroundColorAsync(savedNavigationBarState.color);
        }
        if (savedNavigationBarState.buttonStyle) {
          await NavigationBar.setButtonStyleAsync(savedNavigationBarState.buttonStyle);
        }
        respond({ success: true, restored: savedNavigationBarState });
      } else {
        // 기본값으로 복원
        await NavigationBar.setVisibilityAsync('visible');
        respond({ success: true, restored: { visible: true } });
      }
    } catch (error) {
      respond({ success: false, error: 'Failed to restore navigation bar' });
    }
  });

  console.log('[Bridge] NavigationBar handlers registered');
};
