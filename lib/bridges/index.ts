/**
 * Bridge Handlers 통합 모듈
 * 그룹별로 분리된 핸들러들을 통합 등록
 */

import { registerDeviceHandlers } from './device';
import { registerUIHandlers } from './ui';
import { registerClipboardHandlers } from './clipboard';
import { registerWebviewHandlers } from './webview';
import { registerSplashHandlers } from './splash';
import { registerOrientationHandlers } from './orientation';
import { registerStatusBarHandlers } from './status-bar';
import { registerNavigationBarHandlers } from './navigation-bar';
import { registerScreenPinningHandlers } from './screen-pinning';

/**
 * 모든 내장 핸들러 등록
 */
export const registerBuiltInHandlers = () => {
  registerDeviceHandlers();
  registerUIHandlers();
  registerClipboardHandlers();
  registerWebviewHandlers();
  registerSplashHandlers();
  registerOrientationHandlers();
  registerStatusBarHandlers();
  registerNavigationBarHandlers();
  registerScreenPinningHandlers();

  console.log('[Bridge] All built-in handlers registered');
};
