// __tests__/unit/handlers/keep-awake.test.ts
import { registerKeepAwakeHandlers } from '@/lib/bridges/keep-awake';
import { setupBridgeTest, BridgeTestContext } from '../../mocks/bridge';

describe('KeepAwake Handlers', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe('registerKeepAwakeHandlers', () => {
    it('should register handlers without throwing', () => {
      expect(() => {
        registerKeepAwakeHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });

    it('should be callable multiple times without error', () => {
      expect(() => {
        registerKeepAwakeHandlers(ctx.bridge, ctx.platform);
        registerKeepAwakeHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });
  });

  // Note: 실제 keep-awake 동작은 E2E 테스트에서 검증
  // - activateKeepAwake
  // - deactivateKeepAwake
  // iOS와 Android 모두 지원 (Expo KeepAwake)
});
