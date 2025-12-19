/**
 * WebView 네비게이션 관련 핸들러
 */

import { registerHandler, getWebViewInstance } from '@/lib/bridge';

export const registerWebviewHandlers = () => {
  // 외부 URL 열기
  registerHandler<{ url: string }>('openExternalUrl', async ({ url }, respond) => {
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

  console.log('[Bridge] WebView handlers registered');
};
