// __tests__/unit/handlers/microphone.test.ts
import { registerMicrophoneHandlers, MICROPHONE_PLUGIN_KEY } from '@/lib/bridges/microphone';
import { setupBridgeTest, BridgeTestContext } from '../../mocks/bridge';

jest.mock('rnww-plugin-microphone', () => ({
  registerMicrophoneHandlers: jest.fn(),
}));

describe('Microphone Handler Wrapper', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
    jest.clearAllMocks();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('should register handlers without throwing', () => {
    expect(() => registerMicrophoneHandlers(ctx.bridge, ctx.platform)).not.toThrow();
  });

  it('should export correct plugin key', () => {
    expect(MICROPHONE_PLUGIN_KEY).toBe('mic');
  });
});
