// __tests__/unit/handlers/webview.test.ts
import { registerWebviewHandlers } from '@/lib/bridges/webview';
import { setupBridgeTest, BridgeTestContext } from '../../mocks/bridge';

describe('WebView Handlers', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe('registerWebviewHandlers', () => {
    it('should register handlers without throwing', () => {
      expect(() => {
        registerWebviewHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });

    it('should be callable multiple times without error', () => {
      expect(() => {
        registerWebviewHandlers(ctx.bridge, ctx.platform);
        registerWebviewHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });
  });

  // Note: 실제 webview 동작은 E2E 테스트에서 검증
  // - navigate { url } → WebView URL 변경
  // - reload → WebView 새로고침
  // - goBack, goForward → 히스토리 탐색
  // iOS와 Android 모두 지원
});
