/**
 * WebView 네비게이션 관련 핸들러
 */

import { getWebViewInstance } from '@/lib/bridge';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

export const registerWebviewHandlers = (bridge: BridgeAPI, _platform: PlatformInfo) => {
  const { registerHandler } = bridge;

  // 외부 URL 열기
  registerHandler<{ url: string }>('openExternal', async ({ url }, respond) => {
    const { Linking } = await import('react-native');
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      respond({ success: true });
    } else {
      respond({ success: false, error: 'Cannot open URL' });
    }
  });

  // 뒤로가기
  registerHandler('goBack', () => {
    getWebViewInstance()?.goBack();
  });

  // 앞으로가기
  registerHandler('goForward', () => {
    getWebViewInstance()?.goForward();
  });

  // 새로고침
  registerHandler('reload', () => {
    getWebViewInstance()?.reload();
  });

  console.log('[WebView] Handlers registered');
};
