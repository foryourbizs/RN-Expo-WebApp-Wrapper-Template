// lib/security/SecurityEngine.ts
/**
 * 보안 엔진 - 통합 오케스트레이터
 * 모든 보안 컴포넌트를 소유하고 조율
 */

import { SecurityContext } from './core/SecurityContext';
import { SecurityPolicy } from './core/SecurityPolicy';
import { SecurityConfig, DEFAULT_SECURITY_CONFIG } from './config/SecurityConfig';
import { UrlValidator } from './validators/UrlValidator';
import { NavigationGuard, NavigationRequest } from './guards/NavigationGuard';
import { InjectionGuard, CodeSource } from './guards/InjectionGuard';
import { SecurityLogger } from './audit/SecurityLogger';
import {
  SecurityDecision,
  SecurityEvent,
  SecurityEventType,
  EventSeverity,
  ThreatLevel,
} from './core/SecurityEvent';

// 브릿지 메시지 인터페이스
export interface BridgeMessage {
  protocol: string;
  action?: string;
  payload?: unknown;
  requestId?: string;
  timestamp?: number;
  __token?: string;
  __nonce?: string;
}

// WebView 핸들러 인터페이스
export interface WebViewSecurityHandlers {
  onShouldStartLoadWithRequest: (request: NavigationRequest) => boolean;
  injectedJavaScriptBeforeContentLoaded: string;
}

// 위협 레벨 변경 리스너
type ThreatLevelListener = (newLevel: ThreatLevel, previousLevel: ThreatLevel) => void;

export class SecurityEngine {
  private static instance: SecurityEngine | null = null;

  private context: SecurityContext;
  private policy: SecurityPolicy;
  private urlValidator: UrlValidator;
  private navigationGuard: NavigationGuard;
  private injectionGuard: InjectionGuard;
  private logger: SecurityLogger;
  private threatLevelListeners: ThreatLevelListener[] = [];
  private lockdownTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(config: Partial<SecurityConfig> = {}) {
    // 컴포넌트 초기화
    this.context = SecurityContext.getInstance();
    this.policy = new SecurityPolicy(config);
    this.urlValidator = new UrlValidator(this.policy);
    this.navigationGuard = new NavigationGuard(this.context, this.policy, this.urlValidator);
    this.injectionGuard = new InjectionGuard(config.debug ?? DEFAULT_SECURITY_CONFIG.debug);
    this.logger = new SecurityLogger(config.debug ?? DEFAULT_SECURITY_CONFIG.debug);
  }

  /**
   * 싱글톤 인스턴스 획득
   */
  static getInstance(config?: Partial<SecurityConfig>): SecurityEngine {
    if (!SecurityEngine.instance) {
      SecurityEngine.instance = new SecurityEngine(config);
    }
    return SecurityEngine.instance;
  }

  /**
   * 인스턴스 리셋 (테스트용)
   */
  static resetInstance(): void {
    if (SecurityEngine.instance?.lockdownTimer) {
      clearTimeout(SecurityEngine.instance.lockdownTimer);
    }
    SecurityEngine.instance = null;
    SecurityContext.resetInstance();
  }

  /**
   * URL 검증
   */
  validateUrl(url: string): SecurityDecision {
    const decision = this.urlValidator.validate(url);
    if (decision.event) {
      this.logger.log(decision.event);
    }
    if (!decision.allowed) {
      this.handleSecurityEvent(decision.event!);
    }
    return decision;
  }

  /**
   * 네비게이션 검증
   */
  validateNavigation(request: NavigationRequest): SecurityDecision {
    const decision = this.navigationGuard.validate(request);
    if (decision.event) {
      this.logger.log(decision.event);
    }
    if (!decision.allowed) {
      this.handleSecurityEvent(decision.event!);
    }
    return decision;
  }

  /**
   * 브릿지 메시지 검증
   */
  validateBridgeMessage(message: BridgeMessage): SecurityDecision {
    // 1. 락다운 확인
    if (this.context.isLockdownActive()) {
      const event = this.createSecurityEvent(
        SecurityEventType.NAVIGATION_BLOCKED,
        EventSeverity.WARNING,
        { message: 'Bridge blocked: System in lockdown' }
      );
      this.logger.log(event);
      return { allowed: false, reason: 'System in lockdown', event };
    }

    // 2. 토큰 검증
    if (!message.__token || !this.context.validateToken(message.__token)) {
      const event = this.createSecurityEvent(
        SecurityEventType.INVALID_TOKEN,
        EventSeverity.CRITICAL,
        { protocol: message.protocol }
      );
      this.logger.log(event);
      this.handleSecurityEvent(event);
      return { allowed: false, reason: 'Invalid security token', event };
    }

    // 3. Nonce 검증
    if (!message.__nonce || !this.context.validateAndUseNonce(message.__nonce)) {
      const event = this.createSecurityEvent(
        SecurityEventType.NONCE_REUSE,
        EventSeverity.CRITICAL,
        { protocol: message.protocol, nonce: message.__nonce }
      );
      this.logger.log(event);
      this.handleSecurityEvent(event);
      return { allowed: false, reason: 'Invalid or reused nonce', event };
    }

    // 4. 타임스탬프 검증
    if (message.timestamp) {
      const timestampResult = this.policy.validateMessageTimestamp(message.timestamp);
      if (!timestampResult.allowed) {
        if (timestampResult.event) {
          this.logger.log(timestampResult.event);
        }
        return timestampResult;
      }
    }

    return { allowed: true };
  }

  /**
   * 코드 검증
   */
  validateCode(code: string, source: CodeSource = 'unknown'): SecurityDecision {
    const decision = this.injectionGuard.validateCode(code, source);
    if (decision.event) {
      this.logger.log(decision.event);
    }
    if (!decision.allowed) {
      this.handleSecurityEvent(decision.event!);
    }
    return decision;
  }

  /**
   * WebView 핸들러 생성
   */
  createWebViewHandlers(): WebViewSecurityHandlers {
    return {
      onShouldStartLoadWithRequest: (request: NavigationRequest) => {
        const decision = this.validateNavigation(request);
        return decision.allowed;
      },
      injectedJavaScriptBeforeContentLoaded: this.injectionGuard.generateL1BoundaryScript(
        this.context.getToken()
      ),
    };
  }

  /**
   * 보안 토큰 획득
   */
  getSecurityToken(): string {
    return this.context.getToken();
  }

  /**
   * 현재 위협 레벨 획득
   */
  getThreatLevel(): ThreatLevel {
    return this.context.getThreatLevel();
  }

  /**
   * 위협 레벨 변경 리스너 등록
   */
  onThreatLevelChange(listener: ThreatLevelListener): () => void {
    this.threatLevelListeners.push(listener);
    return () => {
      const index = this.threatLevelListeners.indexOf(listener);
      if (index > -1) {
        this.threatLevelListeners.splice(index, 1);
      }
    };
  }

  /**
   * 락다운 활성화
   */
  activateLockdown(trigger?: SecurityEvent): void {
    const durationMs = this.policy.getLockdownDurationMs();
    this.context.activateLockdown(durationMs);

    this.logger.logLockdownActivated(
      durationMs,
      trigger || this.createSecurityEvent(
        SecurityEventType.LOCKDOWN_ACTIVATED,
        EventSeverity.CRITICAL,
        { reason: 'Manual activation' }
      )
    );

    // 자동 해제 타이머
    if (this.lockdownTimer) {
      clearTimeout(this.lockdownTimer);
    }
    this.lockdownTimer = setTimeout(() => {
      this.deactivateLockdown('Automatic release after timeout');
    }, durationMs);

    this.notifyThreatLevelChange(ThreatLevel.CRITICAL);
  }

  /**
   * 락다운 해제
   */
  deactivateLockdown(reason: string = 'Manual deactivation'): void {
    if (this.lockdownTimer) {
      clearTimeout(this.lockdownTimer);
      this.lockdownTimer = null;
    }
    this.context.deactivateLockdown();
    this.logger.logLockdownDeactivated(reason);
    this.notifyThreatLevelChange(ThreatLevel.NORMAL);
  }

  /**
   * 락다운 상태 확인
   */
  isLockdownActive(): boolean {
    return this.context.isLockdownActive();
  }

  /**
   * 로거 획득
   */
  getLogger(): SecurityLogger {
    return this.logger;
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<SecurityConfig>): void {
    this.policy.updateConfig(config);
    if (config.debug !== undefined) {
      this.logger.setDebug(config.debug);
      this.injectionGuard.setDebug(config.debug);
    }
  }

  /**
   * 보안 이벤트 처리
   */
  private handleSecurityEvent(event: SecurityEvent): void {
    // Critical 이벤트는 즉시 락다운
    if (event.severity === EventSeverity.CRITICAL) {
      if (
        event.type === SecurityEventType.INVALID_TOKEN ||
        event.type === SecurityEventType.INJECTION_DETECTED ||
        event.type === SecurityEventType.NONCE_REUSE
      ) {
        this.activateLockdown(event);
      }
    }
  }

  /**
   * 위협 레벨 변경 알림
   */
  private notifyThreatLevelChange(newLevel: ThreatLevel): void {
    const previousLevel = this.context.getThreatLevel();
    if (previousLevel !== newLevel) {
      this.logger.logThreatLevelChange(previousLevel, newLevel, 'Security event');
      for (const listener of this.threatLevelListeners) {
        try {
          listener(newLevel, previousLevel);
        } catch (error) {
          console.error('[SecurityEngine] Threat level listener error:', error);
        }
      }
    }
  }

  /**
   * 보안 이벤트 생성 헬퍼
   */
  private createSecurityEvent(
    type: SecurityEventType,
    severity: EventSeverity,
    details: Record<string, unknown>
  ): SecurityEvent {
    return {
      type,
      severity,
      timestamp: Date.now(),
      details,
      source: 'SecurityEngine',
    };
  }
}
