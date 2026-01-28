// __tests__/unit/web-sdk/types.test.ts
import {
  AppBridgeMessage,
  AppBridgeResponse,
  AppBridgeListener,
  AppBridgeOptions,
} from '@/lib/web-sdk';

describe('Web SDK Types', () => {
  it('should define AppBridgeMessage interface', () => {
    const message: AppBridgeMessage = {
      action: 'test',
      payload: { data: 'value' },
      requestId: '123',
    };

    expect(message.action).toBe('test');
  });

  it('should define AppBridgeResponse interface', () => {
    const response: AppBridgeResponse = {
      success: true,
      data: { result: 'ok' },
      requestId: '123',
    };

    expect(response.success).toBe(true);
  });

  it('should define AppBridgeListener type', () => {
    const listener: AppBridgeListener = (payload, message) => {
      console.log(payload, message);
    };

    expect(typeof listener).toBe('function');
  });

  it('should define AppBridgeOptions interface', () => {
    const options: AppBridgeOptions = {
      timeout: 5000,
      debug: true,
    };

    expect(options.timeout).toBe(5000);
  });
});
