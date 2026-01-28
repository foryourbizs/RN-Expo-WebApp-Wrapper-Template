// __tests__/unit/plugin/namespace.test.ts
import {
  createNamespacedAction,
  parseNamespacedAction,
  isNamespacedAction,
  getPluginKeyFromAction
} from '@/lib/plugin-system';

describe('Namespace Helpers', () => {
  describe('createNamespacedAction', () => {
    it('should create namespaced action', () => {
      expect(createNamespacedAction('cam', 'start')).toBe('cam:start');
      expect(createNamespacedAction('mic', 'record')).toBe('mic:record');
    });
  });

  describe('parseNamespacedAction', () => {
    it('should parse namespaced action', () => {
      const result = parseNamespacedAction('cam:start');
      expect(result).toEqual({ key: 'cam', action: 'start' });
    });

    it('should return null for non-namespaced action', () => {
      expect(parseNamespacedAction('showToast')).toBeNull();
    });

    it('should handle actions with multiple colons', () => {
      const result = parseNamespacedAction('cam:stream:start');
      expect(result).toEqual({ key: 'cam', action: 'stream:start' });
    });
  });

  describe('isNamespacedAction', () => {
    it('should return true for namespaced action', () => {
      expect(isNamespacedAction('cam:start')).toBe(true);
      expect(isNamespacedAction('mic:stop')).toBe(true);
    });

    it('should return false for non-namespaced action', () => {
      expect(isNamespacedAction('showToast')).toBe(false);
      expect(isNamespacedAction('getDeviceInfo')).toBe(false);
    });
  });

  describe('getPluginKeyFromAction', () => {
    it('should extract plugin key from namespaced action', () => {
      expect(getPluginKeyFromAction('cam:start')).toBe('cam');
      expect(getPluginKeyFromAction('push:getToken')).toBe('push');
    });

    it('should return null for non-namespaced action', () => {
      expect(getPluginKeyFromAction('showToast')).toBeNull();
    });
  });
});
