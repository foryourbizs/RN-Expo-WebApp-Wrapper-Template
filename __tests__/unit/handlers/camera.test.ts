// __tests__/unit/handlers/camera.test.ts
import { registerCameraHandlers, CAMERA_PLUGIN_KEY } from '@/lib/bridges/camera';
import { setupBridgeTest, BridgeTestContext } from '../../mocks/bridge';

// 외부 모듈 모킹
jest.mock('rnww-plugin-camera', () => ({
  registerCameraHandlers: jest.fn(),
}));

describe('Camera Handler Wrapper', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
    jest.clearAllMocks();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe('registerCameraHandlers', () => {
    it('should register handlers without throwing', () => {
      expect(() => registerCameraHandlers(ctx.bridge, ctx.platform)).not.toThrow();
    });

    it('should export correct plugin key', () => {
      expect(CAMERA_PLUGIN_KEY).toBe('cam');
    });
  });
});
