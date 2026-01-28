// __tests__/unit/plugin/push/push-handlers.test.ts
import { registerPushHandlers } from '@/lib/bridges/push';
import { setupBridgeTest, BridgeTestContext } from '../../../mocks/bridge';

// expo-notifications 모킹
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: {
    MAX: 5,
  },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        eas: { projectId: 'test-project-id' }
      }
    }
  }
}));

describe('Push Handlers', () => {
  let ctx: BridgeTestContext;

  beforeEach(() => {
    ctx = setupBridgeTest();
    jest.clearAllMocks();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  describe('registerPushHandlers', () => {
    it('should register handlers without throwing', () => {
      expect(() => registerPushHandlers(ctx.bridge, ctx.platform)).not.toThrow();
    });

    it('should be callable multiple times without error', () => {
      expect(() => {
        registerPushHandlers(ctx.bridge, ctx.platform);
        registerPushHandlers(ctx.bridge, ctx.platform);
      }).not.toThrow();
    });
  });
});
