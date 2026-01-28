// __tests__/unit/utils/platform.test.ts
import { isAndroid, isIOS, getPlatform, getPlatformVersion, platformSupports } from '@/lib/utils/platform';

describe('Platform Utils', () => {
  describe('platform detection', () => {
    it('should detect platform correctly', () => {
      const platform = getPlatform();
      expect(['android', 'ios', 'web']).toContain(platform);
    });

    it('should return boolean for isAndroid', () => {
      expect(typeof isAndroid()).toBe('boolean');
    });

    it('should return boolean for isIOS', () => {
      expect(typeof isIOS()).toBe('boolean');
    });

    it('should return version string', () => {
      const version = getPlatformVersion();
      expect(typeof version).toBe('string');
    });
  });

  describe('platformSupports', () => {
    it('should return boolean for navigationBar feature', () => {
      const result = platformSupports('navigationBar');
      expect(typeof result).toBe('boolean');
    });

    it('should return boolean for screenPinning feature', () => {
      const result = platformSupports('screenPinning');
      expect(typeof result).toBe('boolean');
    });

    it('should return boolean for clipboard feature', () => {
      const result = platformSupports('clipboard');
      expect(typeof result).toBe('boolean');
    });

    it('should return boolean for orientation feature', () => {
      const result = platformSupports('orientation');
      expect(typeof result).toBe('boolean');
    });

    it('should return false for unknown feature', () => {
      // @ts-expect-error - testing unknown feature
      const result = platformSupports('unknownFeature');
      expect(result).toBe(false);
    });
  });
});
