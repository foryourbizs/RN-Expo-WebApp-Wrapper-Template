// lib/security/audit/SecurityLogger.ts
/**
 * 보안 이벤트 로깅 시스템
 */

import { SecurityEvent, SecurityEventType, EventSeverity, ThreatLevel } from '../core/SecurityEvent';

// 외부 로거 인터페이스
export interface ExternalLogger {
  log(event: SecurityEvent): void;
}

// 로그 필터 함수 타입
type LogFilter = (event: SecurityEvent) => boolean;

// 최대 로그 보관 수
const MAX_LOG_ENTRIES = 1000;

export class SecurityLogger {
  private logs: SecurityEvent[] = [];
  private externalLoggers: ExternalLogger[] = [];
  private filters: LogFilter[] = [];
  private debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * 보안 이벤트 로깅
   */
  log(event: SecurityEvent): void {
    // 필터 적용
    if (this.filters.some(filter => !filter(event))) {
      return;
    }

    // 내부 로그 저장
    this.logs.push(event);
    this.trimLogs();

    // 콘솔 출력 (디버그 모드 또는 심각한 이벤트)
    if (this.debug || event.severity === EventSeverity.CRITICAL || event.severity === EventSeverity.ERROR) {
      this.logToConsole(event);
    }

    // 외부 로거 전달
    for (const logger of this.externalLoggers) {
      try {
        logger.log(event);
      } catch (error) {
        console.error('[SecurityLogger] External logger error:', error);
      }
    }
  }

  /**
   * 이벤트 타입별 로깅 헬퍼
   */
  logEvent(
    type: SecurityEventType,
    severity: EventSeverity,
    details: Record<string, unknown>,
    source?: string
  ): void {
    this.log({
      type,
      severity,
      timestamp: Date.now(),
      details,
      source,
    });
  }

  /**
   * 위협 레벨 변경 로깅
   */
  logThreatLevelChange(
    previousLevel: ThreatLevel,
    newLevel: ThreatLevel,
    reason: string
  ): void {
    this.logEvent(
      SecurityEventType.THREAT_LEVEL_CHANGED,
      newLevel === ThreatLevel.CRITICAL ? EventSeverity.CRITICAL : EventSeverity.WARNING,
      { previousLevel, newLevel, reason },
      'SecurityEngine'
    );
  }

  /**
   * 락다운 활성화 로깅
   */
  logLockdownActivated(durationMs: number, trigger: SecurityEvent): void {
    this.logEvent(
      SecurityEventType.LOCKDOWN_ACTIVATED,
      EventSeverity.CRITICAL,
      { durationMs, triggeredBy: trigger },
      'SecurityEngine'
    );
  }

  /**
   * 락다운 해제 로깅
   */
  logLockdownDeactivated(reason: string): void {
    this.logEvent(
      SecurityEventType.LOCKDOWN_DEACTIVATED,
      EventSeverity.INFO,
      { reason },
      'SecurityEngine'
    );
  }

  /**
   * 외부 로거 추가
   */
  addExternalLogger(logger: ExternalLogger): void {
    this.externalLoggers.push(logger);
  }

  /**
   * 외부 로거 제거
   */
  removeExternalLogger(logger: ExternalLogger): void {
    const index = this.externalLoggers.indexOf(logger);
    if (index > -1) {
      this.externalLoggers.splice(index, 1);
    }
  }

  /**
   * 로그 필터 추가
   */
  addFilter(filter: LogFilter): void {
    this.filters.push(filter);
  }

  /**
   * 로그 필터 제거
   */
  clearFilters(): void {
    this.filters = [];
  }

  /**
   * 로그 조회
   */
  getLogs(options?: {
    type?: SecurityEventType;
    severity?: EventSeverity;
    since?: number;
    limit?: number;
  }): SecurityEvent[] {
    let result = [...this.logs];

    if (options?.type) {
      result = result.filter(e => e.type === options.type);
    }

    if (options?.severity) {
      result = result.filter(e => e.severity === options.severity);
    }

    if (options?.since) {
      const since = options.since;
      result = result.filter(e => e.timestamp >= since);
    }

    if (options?.limit) {
      result = result.slice(-options.limit);
    }

    return result;
  }

  /**
   * 특정 시간 범위의 이벤트 수 카운트
   */
  countEvents(type: SecurityEventType, windowMs: number): number {
    const since = Date.now() - windowMs;
    return this.logs.filter(e => e.type === type && e.timestamp >= since).length;
  }

  /**
   * 로그 클리어
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * 디버그 모드 설정
   */
  setDebug(debug: boolean): void {
    this.debug = debug;
  }

  /**
   * 로그 트림 (최대 크기 유지)
   */
  private trimLogs(): void {
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
    }
  }

  /**
   * 콘솔 출력
   */
  private logToConsole(event: SecurityEvent): void {
    const prefix = '[Security]';
    const timestamp = new Date(event.timestamp).toISOString();
    const message = `${prefix} [${timestamp}] [${event.severity.toUpperCase()}] ${event.type}`;

    switch (event.severity) {
      case EventSeverity.CRITICAL:
        console.error(`${message}`, event.details);
        break;
      case EventSeverity.ERROR:
        console.error(`${message}`, event.details);
        break;
      case EventSeverity.WARNING:
        console.warn(`${message}`, event.details);
        break;
      default:
        console.log(`${message}`, event.details);
    }
  }
}
