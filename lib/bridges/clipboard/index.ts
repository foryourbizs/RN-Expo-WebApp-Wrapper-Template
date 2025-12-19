/**
 * 클립보드 관련 핸들러
 */

import { registerHandler } from '@/lib/bridge';

export const registerClipboardHandlers = () => {
  // 클립보드 복사 (expo-clipboard 필요: npx expo install expo-clipboard)
  registerHandler<{ text: string }>('copyToClipboard', async ({ text }, respond) => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(text);
      respond({ success: true });
    } catch (error) {
      respond({ success: false, error: 'Clipboard not available' });
    }
  });

  // 클립보드 읽기
  registerHandler('getClipboard', async (_payload, respond) => {
    try {
      const Clipboard = await import('expo-clipboard');
      const text = await Clipboard.getStringAsync();
      respond({ success: true, text });
    } catch (error) {
      respond({ success: false, error: 'Clipboard not available' });
    }
  });

  console.log('[Bridge] Clipboard handlers registered');
};
