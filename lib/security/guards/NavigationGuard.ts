// lib/security/guards/NavigationGuard.ts
/**
 * WebView 네비게이션 인터셉트 및 제어
 * Rate Limiting + URL 검증 + 리다이렉트 체인 검사
 */

import { SecurityDecision, SecurityEventType, EventSeverity, ThreatLevel } from '../core/SecurityEvent';
import { SecurityContext } from '../core/SecurityContext';
import { SecurityPolicy } from '../core/SecurityPolicy';
import { UrlValidator } from '../validators/UrlValidator';

// 네비게이션 요청 인터페이스
export interface NavigationRequest {
  url: string;
  isRedirect?: boolean;
  mainDocumentURL?: string;
  navigationType?: string;
}

// Rate Limit 트래커
interface RateLimitTracker {
  timestamps: number[];
}

export class NavigationGuard {
  private context: SecurityContext;
  private policy: SecurityPolicy;
  private urlValidator: UrlValidator;
  private rateLimitTracker: RateLimitTracker = { timestamps: [] };
  private redirectChain: string[] = [];
  private lastOrigin: string | null = null;

  constructor(
    context: SecurityContext,
    policy: SecurityPolicy,
    urlValidator: UrlValidator
  ) {
    this.context = context;
    this.policy = policy;
    this.urlValidator = urlValidator;
  }

  /**
   * 네비게이션 요청 검증
   */
  validate(request: NavigationRequest): SecurityDecision {
    // 1. 락다운 상태 확인
    if (this.context.isLockdownActive()) {
      return this.createBlockedDecision(
        SecurityEventType.NAVIGATION_BLOCKED,
        'Navigation blocked: System in lockdown',
        { url: request.url, lockdownRemaining: this.context.getLockdownRemainingMs() }
      );
    }

    // 2. 위협 레벨 확인
    const threatLevel = this.context.getThreatLevel();
    if (threatLevel === ThreatLevel.CRITICAL) {
      return this.createBlockedDecision(
        SecurityEventType.NAVIGATION_BLOCKED,
        'Navigation blocked: Critical threat level',
        { url: request.url, threatLevel }
      );
    }

    // 3. Rate Limit 검사
    const rateLimitResult = this.checkRateLimit();
    if (!rateLimitResult.allowed) return rateLimitResult;

    // 4. URL 검증
    const urlResult = this.urlValidator.validate(request.url);
    if (!urlResult.allowed) return urlResult;

    // 5. 리다이렉트 체인 검사 (리다이렉트인 경우)
    if (request.isRedirect) {
      const chainResult = this.checkRedirectChain(request.url);
      if (!chainResult.allowed) return chainResult;
    } else {
      // 새 네비게이션 시 체인 리셋
      this.resetRedirectChain();
    }

    // 6. Origin 변경 검사
    const originResult = this.checkOriginChange(request.url);
    if (!originResult.allowed) return originResult;

    // 성공
    return this.createAllowedDecision(request.url);
  }

  /**
   * Rate Limit 검사
   */
  private checkRateLimit(): SecurityDecision {
    const now = Date.now();
    const config = this.policy.getNavigationRateLimitConfig();

    // 오래된 타임스탬프 정리
    const { shortWindow, longWindow } = config;
    const oldestRelevant = now - Math.max(shortWindow.windowMs, longWindow.windowMs);
    this.rateLimitTracker.timestamps = this.rateLimitTracker.timestamps.filter(
      t => t > oldestRelevant
    );

    // Short window 검사 (버스트)
    const shortWindowCount = this.rateLimitTracker.timestamps.filter(
      t => t > now - shortWindow.windowMs
    ).length;

    if (shortWindowCount >= shortWindow.maxRequests) {
      return this.createBlockedDecision(
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded: ${shortWindowCount} requests in ${shortWindow.windowMs}ms`,
        { windowMs: shortWindow.windowMs, count: shortWindowCount, max: shortWindow.maxRequests }
      );
    }

    // Long window 검사 (지속 공격)
    const longWindowCount = this.rateLimitTracker.timestamps.filter(
      t => t > now - longWindow.windowMs
    ).length;

    if (longWindowCount >= longWindow.maxRequests) {
      return this.createBlockedDecision(
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded: ${longWindowCount} requests in ${longWindow.windowMs}ms`,
        { windowMs: longWindow.windowMs, count: longWindowCount, max: longWindow.maxRequests }
      );
    }

    // 타임스탬프 기록
    this.rateLimitTracker.timestamps.push(now);

    return { allowed: true };
  }

  /**
   * 리다이렉트 체인 검사
   */
  private checkRedirectChain(url: string): SecurityDecision {
    this.redirectChain.push(url);

    const chainResult = this.policy.validateRedirectChain(this.redirectChain.length);
    if (!chainResult.allowed) {
      // 체인 리셋
      this.resetRedirectChain();
      return chainResult;
    }

    // 순환 리다이렉트 검사
    const uniqueUrls = new Set(this.redirectChain);
    if (uniqueUrls.size !== this.redirectChain.length) {
      const result = this.createBlockedDecision(
        SecurityEventType.NAVIGATION_BLOCKED,
        'Circular redirect detected',
        { redirectChain: this.redirectChain }
      );
      this.resetRedirectChain();
      return result;
    }

    return { allowed: true };
  }

  /**
   * Origin 변경 검사
   */
  private checkOriginChange(url: string): SecurityDecision {
    try {
      const parsedUrl = new URL(url);
      const newOrigin = parsedUrl.origin;

      if (this.lastOrigin !== null && this.lastOrigin !== newOrigin) {
        // Origin이 변경됨 - 캐시 확인
        if (!this.context.isOriginCached(newOrigin)) {
          // 새 Origin은 정책으로 검증
          const originResult = this.policy.validateOrigin(newOrigin);
          if (!originResult.allowed) {
            return originResult;
          }
          // 검증 성공 시 캐시
          this.context.cacheVerifiedOrigin(newOrigin);
        }
      }

      this.lastOrigin = newOrigin;
    } catch {
      // URL 파싱 실패 - UrlValidator에서 이미 처리됨
    }

    return { allowed: true };
  }

  /**
   * 리다이렉트 체인 리셋
   */
  resetRedirectChain(): void {
    this.redirectChain = [];
  }

  /**
   * Rate Limit 리셋 (테스트용)
   */
  resetRateLimit(): void {
    this.rateLimitTracker.timestamps = [];
  }

  /**
   * 현재 Origin 획득
   */
  getCurrentOrigin(): string | null {
    return this.lastOrigin;
  }

  /**
   * 허용 결정 생성
   */
  private createAllowedDecision(url: string): SecurityDecision {
    return {
      allowed: true,
      event: {
        type: SecurityEventType.NAVIGATION_ALLOWED,
        severity: EventSeverity.INFO,
        timestamp: Date.now(),
        details: { url },
        source: 'NavigationGuard',
      },
    };
  }

  /**
   * 차단 결정 생성
   */
  private createBlockedDecision(
    eventType: SecurityEventType,
    reason: string,
    details: Record<string, unknown>
  ): SecurityDecision {
    return {
      allowed: false,
      reason,
      event: {
        type: eventType,
        severity: EventSeverity.WARNING,
        timestamp: Date.now(),
        details,
        source: 'NavigationGuard',
      },
    };
  }
}
