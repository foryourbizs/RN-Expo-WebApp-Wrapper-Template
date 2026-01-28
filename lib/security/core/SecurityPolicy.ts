// lib/security/core/SecurityPolicy.ts
/**
 * 선언적 정책 정의 및 규칙 기반 검증 엔진
 */

import { SecurityConfig, DEFAULT_SECURITY_CONFIG } from '../config/SecurityConfig';
import { SecurityDecision, SecurityEventType, EventSeverity, SecurityEvent } from './SecurityEvent';

export class SecurityPolicy {
  private config: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 현재 설정 획득
   */
  getConfig(): Readonly<SecurityConfig> {
    return { ...this.config };
  }

  /**
   * URL 스킴 정책 검증
   */
  validateUrlScheme(scheme: string): SecurityDecision {
    // 입력 타입 검증
    if (typeof scheme !== 'string' || scheme.length === 0) {
      return this.createBlockedDecision(
        SecurityEventType.DANGEROUS_SCHEME_BLOCKED,
        'Invalid scheme: must be a non-empty string',
        { scheme, type: typeof scheme }
      );
    }

    const normalizedScheme = scheme.toLowerCase().replace(':', '');

    // 차단 스킴 확인
    if (this.config.blockedSchemes.includes(normalizedScheme)) {
      return this.createBlockedDecision(
        SecurityEventType.DANGEROUS_SCHEME_BLOCKED,
        `Blocked scheme: ${normalizedScheme}`,
        { scheme: normalizedScheme }
      );
    }

    // 허용 스킴 확인
    if (!this.config.allowedSchemes.includes(normalizedScheme)) {
      // http는 개발 환경에서만 허용
      if (normalizedScheme === 'http' && !this.config.allowInsecureHttp) {
        return this.createBlockedDecision(
          SecurityEventType.DANGEROUS_SCHEME_BLOCKED,
          'HTTP not allowed in production',
          { scheme: normalizedScheme }
        );
      }
    }

    return { allowed: true };
  }

  /**
   * Origin 정책 검증
   */
  validateOrigin(origin: string): SecurityDecision {
    // 입력 타입 검증
    if (typeof origin !== 'string' || origin.length === 0) {
      return this.createBlockedDecision(
        SecurityEventType.URL_VALIDATION_FAILED,
        'Invalid origin: must be a non-empty string',
        { origin, type: typeof origin }
      );
    }

    // 허용 Origin 목록이 비어있으면 모두 허용
    // 의도적 동작: 개발 편의를 위해 빈 목록은 모든 Origin 허용을 의미함
    if (this.config.allowedOrigins.length === 0) {
      return { allowed: true };
    }

    // 와일드카드 패턴 매칭
    const isAllowed = this.config.allowedOrigins.some(pattern => {
      if (pattern.includes('*')) {
        const regexPattern = pattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\\\*/g, '[^/]+');
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(origin);
      }
      return origin === pattern;
    });

    if (!isAllowed) {
      return this.createBlockedDecision(
        SecurityEventType.URL_VALIDATION_FAILED,
        `Origin not in whitelist: ${origin}`,
        { origin, allowedOrigins: this.config.allowedOrigins }
      );
    }

    return { allowed: true };
  }

  /**
   * 메시지 타임스탬프 정책 검증
   */
  validateMessageTimestamp(timestamp: number): SecurityDecision {
    const now = Date.now();
    const age = now - timestamp;

    // 미래 타임스탬프 차단
    if (age < 0) {
      return this.createBlockedDecision(
        SecurityEventType.MESSAGE_EXPIRED,
        'Message timestamp is in the future',
        { timestamp, now, diff: age }
      );
    }

    // 만료된 메시지 차단
    if (age > this.config.messageMaxAgeMs) {
      return this.createBlockedDecision(
        SecurityEventType.MESSAGE_EXPIRED,
        `Message expired (age: ${age}ms, max: ${this.config.messageMaxAgeMs}ms)`,
        { timestamp, now, age, maxAge: this.config.messageMaxAgeMs }
      );
    }

    return { allowed: true };
  }

  /**
   * 리다이렉트 체인 길이 검증
   */
  validateRedirectChain(chainLength: number): SecurityDecision {
    // 음수 값 검증
    if (chainLength < 0) {
      return this.createBlockedDecision(
        SecurityEventType.NAVIGATION_BLOCKED,
        `Invalid redirect chain length: ${chainLength}`,
        { chainLength }
      );
    }

    if (chainLength > this.config.maxRedirectChain) {
      return this.createBlockedDecision(
        SecurityEventType.NAVIGATION_BLOCKED,
        `Redirect chain too long (${chainLength} > ${this.config.maxRedirectChain})`,
        { chainLength, maxChain: this.config.maxRedirectChain }
      );
    }

    return { allowed: true };
  }

  /**
   * 네비게이션 Rate Limit 설정 획득
   */
  getNavigationRateLimitConfig(): SecurityConfig['navigationRateLimit'] {
    // 깊은 복사로 내부 상태 보호
    return {
      ...this.config.navigationRateLimit,
      shortWindow: { ...this.config.navigationRateLimit.shortWindow },
      longWindow: { ...this.config.navigationRateLimit.longWindow },
    };
  }

  /**
   * 락다운 지속 시간 획득
   */
  getLockdownDurationMs(): number {
    return this.config.lockdownDurationMs;
  }

  /**
   * 디버그 모드 확인
   */
  isDebugMode(): boolean {
    return this.config.debug;
  }

  /**
   * 차단 결정 생성 헬퍼
   */
  private createBlockedDecision(
    eventType: SecurityEventType,
    reason: string,
    details: Record<string, unknown>
  ): SecurityDecision {
    const event: SecurityEvent = {
      type: eventType,
      severity: EventSeverity.WARNING,
      timestamp: Date.now(),
      details,
      source: 'SecurityPolicy',
    };

    return {
      allowed: false,
      reason,
      event,
    };
  }
}
