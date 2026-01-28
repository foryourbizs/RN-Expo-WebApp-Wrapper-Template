// __tests__/unit/handlers/screen-pinning.test.ts
import { registerScreenPinningHandlers, SCREEN_PINNING_PLUGIN_KEY } from '@/lib/bridges/screen-pinning';
import { setupBridgeTest, BridgeTestContext } from '../../mocks/bridge';

jest.mock('rnww-plugin-screen-pinning', () => ({
  registerScreenPinningHandlers: jest.fn(),
}));

describe('Screen Pinning Handler Wrapper', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
    jest.clearAllMocks();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('should register handlers without throwing', () => {
    expect(() => registerScreenPinningHandlers(ctx.bridge, ctx.platform)).not.toThrow();
  });

  it('should export correct plugin key', () => {
    expect(SCREEN_PINNING_PLUGIN_KEY).toBe('pin');
  });
});
