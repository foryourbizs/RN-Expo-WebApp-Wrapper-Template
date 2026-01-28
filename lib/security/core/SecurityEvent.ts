// lib/security/core/SecurityEvent.ts
/**
 * 보안 이벤트 타입 정의
 */

// 위협 레벨
export enum ThreatLevel {
  NORMAL = 'NORMAL',
  ELEVATED = 'ELEVATED',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// 보안 이벤트 타입
export enum SecurityEventType {
  NAVIGATION_BLOCKED = 'NAVIGATION_BLOCKED',
  NAVIGATION_ALLOWED = 'NAVIGATION_ALLOWED',
  URL_VALIDATION_FAILED = 'URL_VALIDATION_FAILED',
  DANGEROUS_SCHEME_BLOCKED = 'DANGEROUS_SCHEME_BLOCKED',
  DOUBLE_ENCODING_DETECTED = 'DOUBLE_ENCODING_DETECTED',
  SSRF_ATTEMPT_BLOCKED = 'SSRF_ATTEMPT_BLOCKED',
  INJECTION_DETECTED = 'INJECTION_DETECTED',
  MALICIOUS_INTENT_DETECTED = 'MALICIOUS_INTENT_DETECTED',
  PROTOTYPE_POLLUTION_DETECTED = 'PROTOTYPE_POLLUTION_DETECTED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  NONCE_REUSE = 'NONCE_REUSE',
  MESSAGE_EXPIRED = 'MESSAGE_EXPIRED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  THREAT_LEVEL_CHANGED = 'THREAT_LEVEL_CHANGED',
  LOCKDOWN_ACTIVATED = 'LOCKDOWN_ACTIVATED',
  LOCKDOWN_DEACTIVATED = 'LOCKDOWN_DEACTIVATED',
}

// 이벤트 심각도
export enum EventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// 보안 이벤트 인터페이스
export interface SecurityEvent {
  type: SecurityEventType;
  severity: EventSeverity;
  timestamp: number;
  details: Record<string, unknown>;
  source?: string;
}

// 보안 결정 인터페이스
export interface SecurityDecision {
  allowed: boolean;
  reason?: string;
  event?: SecurityEvent;
}

// 탐지 시그니처
export interface DetectionSignature {
  id: string;
  name: string;
  description: string;
  severity: EventSeverity;
}

// 인젝션 시그니처 상수
export const INJECTION_SIGNATURES: Record<string, DetectionSignature> = {
  SIG_BRIDGE_001: {
    id: 'SIG_BRIDGE_001',
    name: 'Bridge Internal Access',
    description: 'AppBridge 내부 접근 시도',
    severity: EventSeverity.CRITICAL,
  },
  SIG_BRIDGE_002: {
    id: 'SIG_BRIDGE_002',
    name: 'PostMessage Manipulation',
    description: 'postMessage 직접 호출/조작',
    severity: EventSeverity.CRITICAL,
  },
  SIG_PROTO_001: {
    id: 'SIG_PROTO_001',
    name: 'Prototype Pollution',
    description: '프로토타입 체인 오염 시도',
    severity: EventSeverity.CRITICAL,
  },
  SIG_INJECT_001: {
    id: 'SIG_INJECT_001',
    name: 'Dynamic Code Execution',
    description: '동적 코드 실행 시도',
    severity: EventSeverity.CRITICAL,
  },
  SIG_OBFUSC_001: {
    id: 'SIG_OBFUSC_001',
    name: 'Obfuscation Pattern',
    description: '난독화 패턴 탐지',
    severity: EventSeverity.WARNING,
  },
};
