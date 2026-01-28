// __tests__/mocks/bridge.ts
import { createMockWebView, MockWebView } from './webview';
import { setBridgeWebView, clearHandlers, registerHandler, sendToWeb } from '@/lib/bridge';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';
import { SecurityEngine } from '@/lib/security/SecurityEngine';

export interface BridgeTestContext {
  mockWebView: MockWebView;
  bridge: BridgeAPI;
  platform: PlatformInfo;
  cleanup: () => void;
  getValidToken: () => string;
}

export const setupBridgeTest = (): BridgeTestContext => {
  // Reset SecurityEngine before each test to clear lockdown state
  SecurityEngine.resetInstance();

  const mockWebView = createMockWebView();
  setBridgeWebView(mockWebView as any);

  // BridgeAPI 생성 - 핸들러 테스트에 주입
  const bridge: BridgeAPI = { registerHandler, sendToWeb };
  const platform: PlatformInfo = { OS: 'android' }; // 테스트용 기본값

  // Get token from SecurityEngine (same source as validation)
  const getValidToken = () => SecurityEngine.getInstance().getSecurityToken();

  return {
    mockWebView,
    bridge,
    platform,
    getValidToken,
    cleanup: () => {
      clearHandlers();
      setBridgeWebView(null);
      SecurityEngine.resetInstance();
    },
  };
};

// 웹에서 보낸 메시지 시뮬레이션
export const simulateWebMessage = (
  action: string,
  payload: unknown = {},
  requestId?: string,
  token?: string
): string => {
  return JSON.stringify({
    protocol: `app://${action}`,
    payload,
    requestId,
    timestamp: Date.now(),
    __token: token,
    __nonce: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  });
};
