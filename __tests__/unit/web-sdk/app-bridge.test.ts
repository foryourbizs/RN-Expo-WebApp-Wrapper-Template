// __tests__/unit/web-sdk/app-bridge.test.ts
import { IAppBridge } from '@/lib/web-sdk';

describe('AppBridge Interface', () => {
  it('should define IAppBridge interface with required methods', () => {
    // Mock implementation for type checking
    const mockBridge: IAppBridge = {
      send: jest.fn(),
      call: jest.fn().mockResolvedValue({}),
      on: jest.fn(),
      once: jest.fn(),
      off: jest.fn(),
      waitFor: jest.fn().mockResolvedValue({}),
      isApp: jest.fn().mockReturnValue(true),
      version: '3.0.0',
    };

    expect(mockBridge.send).toBeDefined();
    expect(mockBridge.call).toBeDefined();
    expect(mockBridge.on).toBeDefined();
    expect(mockBridge.once).toBeDefined();
    expect(mockBridge.off).toBeDefined();
    expect(mockBridge.waitFor).toBeDefined();
    expect(mockBridge.isApp).toBeDefined();
    expect(mockBridge.version).toBe('3.0.0');
  });

  it('should allow generic type parameters for call method', async () => {
    interface DeviceInfo {
      platform: string;
      model: string;
    }

    const mockBridge: IAppBridge = {
      send: jest.fn(),
      call: jest.fn().mockResolvedValue({ platform: 'android', model: 'Pixel' }),
      on: jest.fn(),
      once: jest.fn(),
      off: jest.fn(),
      waitFor: jest.fn().mockResolvedValue({}),
      isApp: jest.fn().mockReturnValue(true),
      version: '3.0.0',
    };

    const info = await mockBridge.call<DeviceInfo>('getDeviceInfo');
    expect(info.platform).toBe('android');
  });
});
