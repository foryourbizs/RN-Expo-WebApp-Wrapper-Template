// lib/security/config/SecurityConfig.ts
/**
 * 보안 설정 스키마
 */

export interface SecurityConfig {
  allowedOrigins: string[];
  blockedSchemes: string[];
  allowedSchemes: string[];
  allowInsecureHttp: boolean;
  lockdownDurationMs: number;
  messageMaxAgeMs: number;
  navigationRateLimit: {
    shortWindow: { windowMs: number; maxRequests: number };
    longWindow: { windowMs: number; maxRequests: number };
  };
  maxRedirectChain: number;
  debug: boolean;
}

declare const __DEV__: boolean;

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  allowedOrigins: [],
  blockedSchemes: ['data', 'blob', 'javascript', 'vbscript'],
  allowedSchemes: ['https', 'http', 'about'],
  allowInsecureHttp: typeof __DEV__ !== 'undefined' ? __DEV__ : false,
  lockdownDurationMs: 30000,
  messageMaxAgeMs: 30000,
  navigationRateLimit: {
    shortWindow: { windowMs: 1000, maxRequests: 30 },
    longWindow: { windowMs: 10000, maxRequests: 100 },
  },
  maxRedirectChain: 5,
  debug: typeof __DEV__ !== 'undefined' ? __DEV__ : false,
};

export function createSecurityConfig(
  partial: Partial<SecurityConfig>
): SecurityConfig {
  return {
    ...DEFAULT_SECURITY_CONFIG,
    ...partial,
    navigationRateLimit: {
      ...DEFAULT_SECURITY_CONFIG.navigationRateLimit,
      ...partial.navigationRateLimit,
    },
  };
}
