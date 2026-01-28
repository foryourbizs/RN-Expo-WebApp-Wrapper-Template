// __tests__/unit/bridge/handler-options.test.ts
import { registerHandler, handleBridgeMessage } from '@/lib/bridge';
import { setupBridgeTest, simulateWebMessage, BridgeTestContext } from '../../mocks/bridge';

describe('Handler Options', () => {
  let ctx: BridgeTestContext;
  let validToken: string;

  beforeEach(() => {
    ctx = setupBridgeTest();
    validToken = ctx.getValidToken();
    jest.useFakeTimers();
  });

  afterEach(() => {
    ctx.cleanup();
    jest.useRealTimers();
  });

  describe('timeout option', () => {
    it('should auto-respond with error after timeout', () => {
      const handler = jest.fn(); // respond를 호출하지 않음
      registerHandler('slowAction', handler, { timeout: 1000 });

      const message = simulateWebMessage('slowAction', {}, 'req-123', validToken);
      handleBridgeMessage(message);

      // 타임아웃 전에는 에러 응답 없음
      expect(ctx.mockWebView.injectJavaScript).not.toHaveBeenCalled();

      // 타임아웃 후
      jest.advanceTimersByTime(1001);

      expect(ctx.mockWebView.injectJavaScript).toHaveBeenCalled();
      const script = ctx.mockWebView._getInjectedScripts()[0];
      expect(script).toContain('timeout');
    });

    it('should not timeout if respond is called before timeout', () => {
      const handler = jest.fn((payload, respond) => {
        respond({ result: 'ok' });
      });
      registerHandler('fastAction', handler, { timeout: 1000 });

      const message = simulateWebMessage('fastAction', {}, 'req-123', validToken);
      handleBridgeMessage(message);

      // 즉시 응답
      expect(ctx.mockWebView.injectJavaScript).toHaveBeenCalledTimes(1);

      // 타임아웃 후에도 추가 호출 없음
      jest.advanceTimersByTime(1001);
      expect(ctx.mockWebView.injectJavaScript).toHaveBeenCalledTimes(1);
    });
  });

  describe('once option', () => {
    it('should unregister handler after first call', () => {
      const handler = jest.fn((payload, respond) => {
        respond({ result: 'ok' });
      });
      registerHandler('onceAction', handler, { once: true });

      // 첫 번째 호출
      const message1 = simulateWebMessage('onceAction', {}, 'req-1', validToken);
      handleBridgeMessage(message1);
      expect(handler).toHaveBeenCalledTimes(1);

      // 두 번째 호출 - 핸들러가 제거되었으므로 호출 안됨
      const message2 = simulateWebMessage('onceAction', {}, 'req-2', validToken);
      handleBridgeMessage(message2);
      expect(handler).toHaveBeenCalledTimes(1); // 여전히 1회
    });
  });
});
