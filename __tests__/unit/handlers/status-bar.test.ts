// __tests__/unit/handlers/status-bar.test.ts
import { registerStatusBarHandlers } from '@/lib/bridges/status-bar';
import { setupBridgeTest, BridgeTestContext } from '../../mocks/bridge';

describe('StatusBar Handlers', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe('registerStatusBarHandlers', () => {
    it('should register handlers without throwing', () => {
      expect(() => {
        registerStatusBarHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });

    it('should be callable multiple times without error', () => {
      expect(() => {
        registerStatusBarHandlers(ctx.bridge, ctx.platform);
        registerStatusBarHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });
  });

  // Note: 실제 StatusBar 동작은 E2E 테스트에서 검증
  // - setStatusBar { hidden, style, color }
  // - getStatusBar
  // - restoreStatusBar
  // color는 Android에서만 동작함을 문서화
});
