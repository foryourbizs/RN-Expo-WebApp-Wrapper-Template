// __tests__/unit/plugin/plugin-registry.test.ts
import { PluginRegistry, RNWWPlugin, BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;
  let mockBridge: BridgeAPI;
  let mockPlatform: PlatformInfo;

  const createMockPlugin = (key: string, name = `rnww-plugin-${key}`): RNWWPlugin => ({
    name,
    key,
    version: '1.0.0',
    platform: ['android', 'ios'],
    registerHandlers: jest.fn(),
  });

  beforeEach(() => {
    registry = new PluginRegistry();
    mockBridge = {
      registerHandler: jest.fn(),
      sendToWeb: jest.fn(),
    };
    mockPlatform = { OS: 'android' };
  });

  describe('register', () => {
    it('should register a valid plugin', () => {
      const plugin = createMockPlugin('cam');

      expect(() => registry.register(plugin)).not.toThrow();
      expect(registry.has('cam')).toBe(true);
    });

    it('should throw on duplicate key registration', () => {
      const plugin1 = createMockPlugin('test', 'test-plugin-1');
      const plugin2 = createMockPlugin('test', 'test-plugin-2');

      registry.register(plugin1);
      expect(() => registry.register(plugin2)).toThrow(/already registered/i);
    });

    it('should validate plugin on registration', () => {
      const invalidPlugin = { key: 'x' } as RNWWPlugin;

      expect(() => registry.register(invalidPlugin)).toThrow();
    });
  });

  describe('initialize', () => {
    it('should call registerHandlers on all plugins', () => {
      const plugin1 = createMockPlugin('cam');
      const plugin2 = createMockPlugin('mic');

      registry.register(plugin1);
      registry.register(plugin2);
      registry.initialize(mockBridge, mockPlatform);

      expect(plugin1.registerHandlers).toHaveBeenCalledWith(mockBridge, mockPlatform);
      expect(plugin2.registerHandlers).toHaveBeenCalledWith(mockBridge, mockPlatform);
    });

    it('should call onInit if defined', async () => {
      const plugin = createMockPlugin('test', 'test-plugin');
      plugin.onInit = jest.fn().mockResolvedValue(undefined);

      registry.register(plugin);
      await registry.initialize(mockBridge, mockPlatform);

      expect(plugin.onInit).toHaveBeenCalled();
    });

    it('should skip plugins not supporting current platform', () => {
      const androidOnlyPlugin = createMockPlugin('pin');
      androidOnlyPlugin.platform = ['android'];

      registry.register(androidOnlyPlugin);
      registry.initialize(mockBridge, { OS: 'ios' });

      expect(androidOnlyPlugin.registerHandlers).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should return registered plugin by key', () => {
      const plugin = createMockPlugin('cam');
      registry.register(plugin);

      expect(registry.get('cam')).toBe(plugin);
    });

    it('should return undefined for unregistered key', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered plugins', () => {
      const plugin1 = createMockPlugin('cam');
      const plugin2 = createMockPlugin('mic');

      registry.register(plugin1);
      registry.register(plugin2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(plugin1);
      expect(all).toContain(plugin2);
    });
  });

  describe('destroy', () => {
    it('should call onDestroy on all plugins', () => {
      const plugin = createMockPlugin('test', 'test-plugin');
      plugin.onDestroy = jest.fn();

      registry.register(plugin);
      registry.initialize(mockBridge, mockPlatform);
      registry.destroy();

      expect(plugin.onDestroy).toHaveBeenCalled();
    });
  });
});
