// __tests__/unit/plugin/update/update-handlers.test.ts
import { registerUpdateHandlers } from '@/lib/bridges/update';
import { setupBridgeTest, BridgeTestContext } from '../../../mocks/bridge';

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
  applicationName: 'TestApp',
  applicationId: 'com.test.app',
}));

jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
}));

describe('Update Handlers', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
    jest.clearAllMocks();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('should register handlers without throwing', () => {
    expect(() => registerUpdateHandlers(ctx.bridge, ctx.platform)).not.toThrow();
  });

  it('should be callable multiple times without error', () => {
    expect(() => {
      registerUpdateHandlers(ctx.bridge, ctx.platform);
      registerUpdateHandlers(ctx.bridge, ctx.platform);
    }).not.toThrow();
  });
});
