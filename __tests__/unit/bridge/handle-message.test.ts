// __tests__/unit/bridge/handle-message.test.ts
import { registerHandler, handleBridgeMessage, clearHandlers } from '@/lib/bridge';
import { setupBridgeTest, simulateWebMessage, BridgeTestContext } from '../../mocks/bridge';

describe('handleBridgeMessage', () => {
  let ctx: BridgeTestContext;
  let validToken: string;

  beforeEach(() => {
    ctx = setupBridgeTest();
    validToken = ctx.getValidToken();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('should return false for non-JSON message', () => {
    const result = handleBridgeMessage('not json');
    expect(result).toBe(false);
  });

  it('should return false for non-bridge protocol', () => {
    const message = JSON.stringify({
      protocol: 'http://example.com',
      payload: {},
    });

    const result = handleBridgeMessage(message);
    expect(result).toBe(false);
  });

  it('should return false for invalid security token', () => {
    const message = simulateWebMessage('testAction', {}, undefined, 'invalid-token');

    const result = handleBridgeMessage(message);
    expect(result).toBe(false);
  });

  it('should call registered handler with valid message', () => {
    const handler = jest.fn();
    registerHandler('testAction', handler);

    const message = simulateWebMessage('testAction', { foo: 'bar' }, undefined, validToken);
    const result = handleBridgeMessage(message);

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledWith(
      { foo: 'bar' },
      expect.any(Function)
    );
  });

  it('should handle unknown action gracefully', () => {
    const message = simulateWebMessage('unknownAction', {}, 'req-123', validToken);

    const result = handleBridgeMessage(message);

    expect(result).toBe(true); // 메시지는 처리됨 (에러 응답 전송)
  });

  it('should send response when handler calls respond', () => {
    const handler = jest.fn((payload, respond) => {
      respond({ success: true, data: 'test' });
    });
    registerHandler('testAction', handler);

    const message = simulateWebMessage('testAction', {}, 'req-123', validToken);
    handleBridgeMessage(message);

    // WebView에 응답이 전송되었는지 확인
    expect(ctx.mockWebView.injectJavaScript).toHaveBeenCalled();
  });
});
