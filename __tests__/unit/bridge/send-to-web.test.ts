// __tests__/unit/bridge/send-to-web.test.ts
import { sendToWeb, setBridgeWebView } from '@/lib/bridge';
import { setupBridgeTest, BridgeTestContext } from '../../mocks/bridge';

describe('sendToWeb', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('should inject JavaScript into WebView', () => {
    sendToWeb('testAction', { foo: 'bar' });

    expect(ctx.mockWebView.injectJavaScript).toHaveBeenCalledTimes(1);
  });

  it('should include action and payload in injected script', () => {
    sendToWeb('testAction', { foo: 'bar' });

    const injectedScript = ctx.mockWebView._getInjectedScripts()[0];
    expect(injectedScript).toContain('testAction');
    expect(injectedScript).toContain('foo');
    expect(injectedScript).toContain('bar');
  });

  it('should use native:// protocol', () => {
    sendToWeb('testAction', {});

    const injectedScript = ctx.mockWebView._getInjectedScripts()[0];
    expect(injectedScript).toContain('native://testAction');
  });

  it('should not throw when WebView is null', () => {
    setBridgeWebView(null);

    expect(() => {
      sendToWeb('testAction', {});
    }).not.toThrow();
  });

  it('should not inject when WebView is null', () => {
    setBridgeWebView(null);
    sendToWeb('testAction', {});

    expect(ctx.mockWebView.injectJavaScript).not.toHaveBeenCalled();
  });
});
