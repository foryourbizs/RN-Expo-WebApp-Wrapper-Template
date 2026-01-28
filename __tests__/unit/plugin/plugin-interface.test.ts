// __tests__/unit/plugin/plugin-interface.test.ts
import { RNWWPlugin, validatePlugin, SYSTEM_RESERVED_KEYS } from '@/lib/plugin-system';

describe('RNWWPlugin Interface', () => {
  describe('Plugin Validation', () => {
    it('should accept valid plugin with required fields', () => {
      const validPlugin: RNWWPlugin = {
        name: 'rnww-plugin-test',
        key: 'test',
        version: '1.0.0',
        platform: ['android', 'ios'],
        registerHandlers: jest.fn(),
      };

      expect(() => validatePlugin(validPlugin)).not.toThrow();
    });

    it('should accept any plugin key that is not system reserved', () => {
      // 플러그인 키는 각 플러그인에서 자체 정의
      // 프레임워크는 시스템 키(app, web)만 차단
      const communityPlugin: RNWWPlugin = {
        name: 'community-plugin',
        key: 'cam', // 이제 커뮤니티도 사용 가능 (중복은 Registry에서 처리)
        version: '1.0.0',
        platform: ['android'],
        registerHandlers: jest.fn(),
      };

      expect(() => validatePlugin(communityPlugin)).not.toThrow();
    });

    it('should reject plugin with system reserved key', () => {
      const invalidPlugin: RNWWPlugin = {
        name: 'some-plugin',
        key: 'app', // 시스템 예약
        version: '1.0.0',
        platform: ['android'],
        registerHandlers: jest.fn(),
      };

      expect(() => validatePlugin(invalidPlugin)).toThrow(/reserved for system/i);
    });

    it('should reject plugin with key shorter than 3 chars', () => {
      const invalidPlugin: RNWWPlugin = {
        name: 'test-plugin',
        key: 'ab',
        version: '1.0.0',
        platform: ['android'],
        registerHandlers: jest.fn(),
      };

      expect(() => validatePlugin(invalidPlugin)).toThrow(/3-8 characters/i);
    });

    it('should reject plugin with key longer than 8 chars', () => {
      const invalidPlugin: RNWWPlugin = {
        name: 'test-plugin',
        key: 'verylongkey',
        version: '1.0.0',
        platform: ['android'],
        registerHandlers: jest.fn(),
      };

      expect(() => validatePlugin(invalidPlugin)).toThrow(/3-8 characters/i);
    });

    it('should reject plugin without registerHandlers function', () => {
      const invalidPlugin = {
        name: 'test-plugin',
        key: 'test',
        version: '1.0.0',
        platform: ['android'],
      };

      expect(() => validatePlugin(invalidPlugin as any)).toThrow(/registerHandlers/i);
    });
  });

  describe('System Reserved Keys', () => {
    it('should only reserve system keys (app, web)', () => {
      // 시스템 예약 키만 포함
      expect(SYSTEM_RESERVED_KEYS).toContain('app');
      expect(SYSTEM_RESERVED_KEYS).toContain('web');
      expect(SYSTEM_RESERVED_KEYS.length).toBe(2);
    });

    it('should not reserve plugin keys - each plugin defines its own', () => {
      // 플러그인 키는 예약되지 않음 (각 플러그인이 자체 정의)
      expect(SYSTEM_RESERVED_KEYS).not.toContain('cam');
      expect(SYSTEM_RESERVED_KEYS).not.toContain('mic');
      expect(SYSTEM_RESERVED_KEYS).not.toContain('push');
    });
  });
});
