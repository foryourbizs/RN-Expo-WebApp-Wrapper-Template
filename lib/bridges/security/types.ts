// lib/bridges/security/types.ts

/**
 * 보안 플러그인 키
 */
export const SECURITY_PLUGIN_KEY = 'sec';

/**
 * Root/Jailbreak 체크 결과
 */
export interface RootCheckResult {
  /** Root/Jailbreak 여부 */
  isRooted: boolean;
  /** 감지된 지표들 */
  indicators: string[];
  /** 에러 메시지 */
  error?: string;
}

/**
 * 무결성 체크 결과
 */
export interface IntegrityCheckResult {
  /** 무결성 유효 여부 */
  isValid: boolean;
  /** 앱 서명 해시 */
  appSignature?: string;
  /** 에러 메시지 */
  error?: string;
}

/**
 * 종합 보안 체크 결과
 */
export interface SecurityCheckResult {
  /** 전체 보안 상태 */
  isSecure: boolean;
  /** Root/Jailbreak 여부 */
  isRooted: boolean;
  /** 디버깅 연결 여부 */
  isDebugging: boolean;
  /** 에뮬레이터 여부 */
  isEmulator: boolean;
  /** 수행된 체크 목록 */
  checks: string[];
  /** 실패한 체크들 */
  failedChecks?: string[];
  /** 에러 메시지 */
  error?: string;
}

/**
 * 보안 설정
 */
export interface SecurityConfig {
  /** Root/Jailbreak 감지 활성화 */
  checkRoot?: boolean;
  /** 디버깅 감지 활성화 */
  checkDebugging?: boolean;
  /** 에뮬레이터 감지 활성화 */
  checkEmulator?: boolean;
  /** 위험 환경에서 앱 종료 */
  exitOnRisk?: boolean;
}
