// __tests__/unit/handlers/orientation.test.ts
import { registerOrientationHandlers } from '@/lib/bridges/orientation';
import { setupBridgeTest, BridgeTestContext } from '../../mocks/bridge';

describe('Orientation Handlers', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe('registerOrientationHandlers', () => {
    it('should register handlers without throwing', () => {
      expect(() => {
        registerOrientationHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });

    it('should be callable multiple times without error', () => {
      expect(() => {
        registerOrientationHandlers(ctx.bridge, ctx.platform);
        registerOrientationHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });
  });

  // Note: 실제 orientation 동작은 E2E 테스트에서 검증
  // - getOrientation
  // - setOrientation { mode: 'portrait' | 'landscape' | 'auto' | ... }
  // - unlockOrientation
  // iOS와 Android 모두 지원
});
