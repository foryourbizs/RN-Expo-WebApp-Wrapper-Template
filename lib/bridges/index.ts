/**
 * Bridge Handlers 통합 모듈
 * 그룹별로 분리된 핸들러들을 통합 등록
 *
 * TODO: Phase 2 남은 플러그인들
 * - [ ] deeplink (link:*) - 딥링크/유니버설 링크 처리
 */

import { Platform } from 'react-native';
import { registerHandler, sendToWeb } from '@/lib/bridge';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

import { registerBackgroundHandlers } from './background';
import { registerCameraHandlers } from './camera';
import { registerClipboardHandlers } from './clipboard';
import { registerDeviceHandlers } from './device';
import { registerGpsHandlers } from './gps';
import { registerKeepAwakeHandlers } from './keep-awake';
import { registerMicrophoneHandlers } from './microphone';
import { registerNavigationBarHandlers } from './navigation-bar';
import { registerOrientationHandlers } from './orientation';
import { registerPushHandlers } from './push';
import { registerScreenPinningHandlers } from './screen-pinning';
import { registerSecurityHandlers } from './security';
import { registerSplashHandlers } from './splash';
import { registerStatusBarHandlers } from './status-bar';
import { registerUIHandlers } from './ui';
import { registerUpdateHandlers } from './update';
import { registerWebviewHandlers } from './webview';

/**
 * 내장 플러그인 네임스페이스 정의
 * - 모든 핸들러 액션은 자동으로 `namespace:action` 형식이 됨
 * - 핸들러는 namespace를 알 필요 없이 그냥 'action'만 등록하면 됨
 */
export const BUILTIN_NAMESPACES = {
  device: 'device',
  ui: 'ui',
  clipboard: 'clip',
  webview: 'webview',
  splash: 'splash',
  orientation: 'orient',
  statusBar: 'sbar',
  navigationBar: 'nbar',
  screenPinning: 'pin',
  keepAwake: 'awake',
  camera: 'cam',
  microphone: 'mic',
  push: 'push',
  update: 'update',
  security: 'sec',
  background: 'bg',
  gps: 'gps',
} as const;

export type BuiltinNamespace = typeof BUILTIN_NAMESPACES[keyof typeof BUILTIN_NAMESPACES];

/**
 * 네임스페이스가 적용된 BridgeAPI 생성
 * - registerHandler('action', ...) → 실제로는 'namespace:action'으로 등록
 * - sendToWeb('event', ...) → 실제로는 'namespace:event'로 전송
 */
const createNamespacedBridge = (namespace: string): BridgeAPI => ({
  registerHandler: (action, handler, options) =>
    registerHandler(`${namespace}:${action}`, handler, options),
  sendToWeb: (action, payload) =>
    sendToWeb(`${namespace}:${action}`, payload),
});

/**
 * 모든 내장 핸들러 등록
 */
export const registerBuiltInHandlers = () => {
  const platform: PlatformInfo = { OS: Platform.OS as 'android' | 'ios' };

  // 빌트인 핸들러 등록 (네임스페이스 자동 주입)
  registerDeviceHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.device), platform);
  registerUIHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.ui), platform);
  registerClipboardHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.clipboard), platform);
  registerWebviewHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.webview), platform);
  registerSplashHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.splash), platform);
  registerOrientationHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.orientation), platform);
  registerStatusBarHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.statusBar), platform);
  registerNavigationBarHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.navigationBar), platform);
  registerScreenPinningHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.screenPinning), platform);
  registerKeepAwakeHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.keepAwake), platform);
  registerCameraHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.camera), platform);
  registerMicrophoneHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.microphone), platform);
  registerPushHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.push), platform);
  registerUpdateHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.update), platform);
  registerSecurityHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.security), platform);
  registerBackgroundHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.background), platform);
  registerGpsHandlers(createNamespacedBridge(BUILTIN_NAMESPACES.gps), platform);

  console.log('[Bridge] All built-in handlers registered');
};
