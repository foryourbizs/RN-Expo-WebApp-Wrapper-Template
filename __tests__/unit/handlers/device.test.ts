// __tests__/unit/handlers/device.test.ts
// Note: 핸들러 내부에서 dynamic import를 사용하므로,
// 핸들러 등록만 테스트합니다.
// 실제 핸들러 동작은 E2E 테스트에서 검증합니다.

import { registerDeviceHandlers } from '@/lib/bridges/device';
import { setupBridgeTest, BridgeTestContext } from '../../mocks/bridge';

describe('Device Handlers', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe('registerDeviceHandlers', () => {
    it('should register handlers without throwing', () => {
      expect(() => {
        registerDeviceHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });

    it('should be callable multiple times without error', () => {
      expect(() => {
        registerDeviceHandlers(ctx.bridge, ctx.platform);
        registerDeviceHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });
  });
});
