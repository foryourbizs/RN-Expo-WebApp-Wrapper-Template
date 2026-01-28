// __tests__/unit/bridge/security-token.test.ts
import { getBridgeClientScript } from '@/lib/bridge-client';
import { SecurityEngine } from '@/lib/security/SecurityEngine';

describe('Security Token Concealment', () => {
  let testToken: string;

  beforeEach(() => {
    // Reset SecurityEngine to get fresh token
    SecurityEngine.resetInstance();
    testToken = SecurityEngine.getInstance().getSecurityToken();
  });

  afterEach(() => {
    SecurityEngine.resetInstance();
  });

  describe('getBridgeClientScript', () => {
    it('should require security token parameter', () => {
      // @ts-expect-error - testing runtime behavior
      expect(() => getBridgeClientScript()).toThrow();
      // @ts-expect-error - testing runtime behavior
      expect(() => getBridgeClientScript(null)).toThrow();
      // @ts-expect-error - testing runtime behavior
      expect(() => getBridgeClientScript('')).toThrow();
    });

    it('should NOT expose getToken method in AppBridge', () => {
      const script = getBridgeClientScript(testToken);

      // getToken 메서드가 존재하지 않아야 함
      expect(script).not.toContain('getToken: function');
      expect(script).not.toContain('getToken:function');
    });

    it('should NOT expose BRIDGE_TOKEN variable name', () => {
      const script = getBridgeClientScript(testToken);

      // 토큰 변수명이 노출되지 않아야 함 (난독화)
      expect(script).not.toMatch(/var\s+BRIDGE_TOKEN\s*=/);
    });

    it('should contain security token in closure', () => {
      const script = getBridgeClientScript(testToken);

      // 토큰 값 자체는 스크립트에 포함되어야 함 (클로저 내부)
      expect(script).toContain(testToken);
    });

    it('should use Symbol for internal token storage', () => {
      const script = getBridgeClientScript(testToken);

      // Symbol을 사용하여 토큰 은닉
      expect(script).toContain('Symbol');
    });
  });

  describe('SecurityEngine token', () => {
    it('should return consistent token within session', () => {
      const token1 = SecurityEngine.getInstance().getSecurityToken();
      const token2 = SecurityEngine.getInstance().getSecurityToken();

      expect(token1).toBe(token2);
    });

    it('should return non-empty string', () => {
      const token = SecurityEngine.getInstance().getSecurityToken();

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(32);
    });

    it('should generate different tokens after reset', () => {
      const token1 = SecurityEngine.getInstance().getSecurityToken();
      SecurityEngine.resetInstance();
      const token2 = SecurityEngine.getInstance().getSecurityToken();

      expect(token1).not.toBe(token2);
    });
  });
});
