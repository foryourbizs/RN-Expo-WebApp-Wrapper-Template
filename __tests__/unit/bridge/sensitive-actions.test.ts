// __tests__/unit/bridge/sensitive-actions.test.ts
import { isSensitiveAction, SENSITIVE_ACTIONS } from '@/lib/bridge';

describe('Sensitive Actions Classification', () => {
  describe('SENSITIVE_ACTIONS constant', () => {
    it('should include camera actions', () => {
      expect(SENSITIVE_ACTIONS).toContain('cam:start');
      expect(SENSITIVE_ACTIONS).toContain('cam:capture');
    });

    it('should include microphone actions', () => {
      expect(SENSITIVE_ACTIONS).toContain('mic:start');
      expect(SENSITIVE_ACTIONS).toContain('mic:record');
    });

    it('should include clipboard write action', () => {
      expect(SENSITIVE_ACTIONS).toContain('writeClipboard');
    });
  });

  describe('isSensitiveAction', () => {
    it('should return true for sensitive actions', () => {
      expect(isSensitiveAction('cam:start')).toBe(true);
      expect(isSensitiveAction('mic:start')).toBe(true);
      expect(isSensitiveAction('writeClipboard')).toBe(true);
    });

    it('should return false for basic actions', () => {
      expect(isSensitiveAction('showToast')).toBe(false);
      expect(isSensitiveAction('getDeviceInfo')).toBe(false);
      expect(isSensitiveAction('vibrate')).toBe(false);
    });

    it('should support wildcard matching for plugin namespaces', () => {
      // cam:* 패턴으로 모든 카메라 액션 민감 처리
      expect(isSensitiveAction('cam:anyAction')).toBe(true);
      expect(isSensitiveAction('mic:anyAction')).toBe(true);
    });
  });
});
