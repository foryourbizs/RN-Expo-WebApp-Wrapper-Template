// __tests__/unit/plugin/security/security-types.test.ts
import {
  SECURITY_PLUGIN_KEY,
  SecurityCheckResult,
  RootCheckResult,
  IntegrityCheckResult,
} from '@/lib/bridges/security';

describe('Security Plugin Types', () => {
  it('should have correct plugin key', () => {
    expect(SECURITY_PLUGIN_KEY).toBe('sec');
  });

  it('should define SecurityCheckResult interface', () => {
    const result: SecurityCheckResult = {
      isSecure: true,
      isRooted: false,
      isDebugging: false,
      isEmulator: false,
      checks: [],
    };

    expect(result.isSecure).toBe(true);
  });

  it('should define RootCheckResult interface', () => {
    const result: RootCheckResult = {
      isRooted: false,
      indicators: [],
    };

    expect(result.isRooted).toBe(false);
  });

  it('should define IntegrityCheckResult interface', () => {
    const result: IntegrityCheckResult = {
      isValid: true,
      appSignature: 'abc123',
    };

    expect(result.isValid).toBe(true);
  });
});
