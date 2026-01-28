// __tests__/unit/handlers/clipboard.test.ts
import { registerClipboardHandlers } from '@/lib/bridges/clipboard';
import { setupBridgeTest, BridgeTestContext } from '../../mocks/bridge';

describe('Clipboard Handlers', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe('registerClipboardHandlers', () => {
    it('should register handlers without throwing', () => {
      expect(() => {
        registerClipboardHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });

    it('should be callable multiple times without error', () => {
      expect(() => {
        registerClipboardHandlers(ctx.bridge, ctx.platform);
        registerClipboardHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });
  });

  // Note: 실제 clipboard 동작은 E2E 테스트에서 검증
  // - readClipboard → { success, text }
  // - writeClipboard { text } → { success }
  // iOS와 Android 모두 지원 (Expo Clipboard)
});
