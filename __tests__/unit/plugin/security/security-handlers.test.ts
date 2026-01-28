// __tests__/unit/plugin/security/security-handlers.test.ts
import { registerSecurityHandlers } from '@/lib/bridges/security';
import { setupBridgeTest, BridgeTestContext } from '../../../mocks/bridge';

jest.mock('expo-device', () => ({
  isDevice: true,
  deviceName: 'Test Device',
  modelName: 'Test Model',
  brand: 'Test Brand',
}));

describe('Security Handlers', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
    jest.clearAllMocks();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('should register handlers without throwing', () => {
    expect(() => registerSecurityHandlers(ctx.bridge, ctx.platform)).not.toThrow();
  });

  it('should be callable multiple times without error', () => {
    expect(() => {
      registerSecurityHandlers(ctx.bridge, ctx.platform);
      registerSecurityHandlers(ctx.bridge, ctx.platform);
    }).not.toThrow();
  });
});
