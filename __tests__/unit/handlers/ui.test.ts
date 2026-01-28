// __tests__/unit/handlers/ui.test.ts
// Note: 핸들러 내부에서 dynamic import를 사용하므로,
// 핸들러 등록만 테스트합니다.
// 실제 핸들러 동작은 E2E 테스트에서 검증합니다.

import { registerUIHandlers } from '@/lib/bridges/ui';
import { setupBridgeTest, BridgeTestContext } from '../../mocks/bridge';

describe('UI Handlers', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe('registerUIHandlers', () => {
    it('should register handlers without throwing', () => {
      expect(() => {
        registerUIHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });

    it('should be callable multiple times without error', () => {
      expect(() => {
        registerUIHandlers(ctx.bridge, ctx.platform);
        registerUIHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });
  });
});
