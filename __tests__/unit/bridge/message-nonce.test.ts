// __tests__/unit/bridge/message-nonce.test.ts
import { handleBridgeMessage, registerHandler, clearHandlers, setBridgeWebView } from '@/lib/bridge';
import { SecurityEngine } from '@/lib/security/SecurityEngine';
import { createMockWebView } from '../../mocks/webview';

describe('Message Nonce Validation', () => {
  let mockWebView: ReturnType<typeof createMockWebView>;
  let validToken: string;

  beforeEach(() => {
    // Reset SecurityEngine to clear lockdown state and get fresh token
    SecurityEngine.resetInstance();

    mockWebView = createMockWebView();
    setBridgeWebView(mockWebView as any);
    validToken = SecurityEngine.getInstance().getSecurityToken();
    clearHandlers();
  });

  afterEach(() => {
    clearHandlers();
    setBridgeWebView(null);
    SecurityEngine.resetInstance();
  });

  const createMessage = (action: string, payload: any, options: {
    token?: string;
    nonce?: string;
    timestamp?: number;
  } = {}) => {
    return JSON.stringify({
      protocol: `app://${action}`,
      payload,
      timestamp: options.timestamp ?? Date.now(),
      __token: options.token ?? validToken,
      __nonce: options.nonce ?? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });
  };

  describe('timestamp validation', () => {
    it('should reject messages with timestamp older than 30 seconds', () => {
      registerHandler('testAction', jest.fn());

      const oldTimestamp = Date.now() - 31000; // 31초 전
      const message = createMessage('testAction', {}, { timestamp: oldTimestamp });

      const result = handleBridgeMessage(message);

      expect(result).toBe(false);
    });

    it('should accept messages with timestamp within 30 seconds', () => {
      const handler = jest.fn();
      registerHandler('testAction', handler);

      const recentTimestamp = Date.now() - 5000; // 5초 전
      const message = createMessage('testAction', {}, { timestamp: recentTimestamp });

      const result = handleBridgeMessage(message);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('nonce replay prevention', () => {
    it('should reject duplicate nonce (replay attack)', () => {
      const handler = jest.fn();
      registerHandler('testAction', handler);

      const nonce = 'unique-nonce-12345';
      const message1 = createMessage('testAction', { first: true }, { nonce });
      const message2 = createMessage('testAction', { second: true }, { nonce });

      // 첫 번째 메시지 성공
      const result1 = handleBridgeMessage(message1);
      expect(result1).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);

      // 동일 nonce로 두 번째 메시지 실패
      const result2 = handleBridgeMessage(message2);
      expect(result2).toBe(false);
      expect(handler).toHaveBeenCalledTimes(1); // 여전히 1회
    });

    it('should accept different nonces', () => {
      const handler = jest.fn();
      registerHandler('testAction', handler);

      const message1 = createMessage('testAction', {}, { nonce: 'nonce-1' });
      const message2 = createMessage('testAction', {}, { nonce: 'nonce-2' });

      handleBridgeMessage(message1);
      handleBridgeMessage(message2);

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('missing nonce handling', () => {
    it('should reject messages without nonce', () => {
      registerHandler('testAction', jest.fn());

      // nonce 없는 메시지
      const message = JSON.stringify({
        protocol: 'app://testAction',
        payload: {},
        timestamp: Date.now(),
        __token: validToken,
        // __nonce 없음
      });

      const result = handleBridgeMessage(message);

      expect(result).toBe(false);
    });
  });
});
