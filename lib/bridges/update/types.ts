// lib/bridges/update/types.ts

/**
 * 업데이트 플러그인 키
 */
export const UPDATE_PLUGIN_KEY = 'upd';

/**
 * 업데이트 설정
 */
export interface UpdateConfig {
  /** 버전 체크 API 엔드포인트 (선택) */
  checkEndpoint?: string;
  /** iOS App Store ID */
  iosAppId?: string;
  /** Android 패키지명 */
  androidPackageName?: string;
  /** 강제 업데이트 대상 버전들 */
  forceUpdateVersions?: string[];
}

/**
 * 업데이트 체크 결과
 */
export interface UpdateCheckResult {
  /** 업데이트 가능 여부 */
  available: boolean;
  /** 현재 앱 버전 */
  currentVersion: string;
  /** 최신 버전 */
  latestVersion?: string;
  /** 강제 업데이트 여부 */
  isForced: boolean;
  /** 스토어 URL */
  storeUrl?: string;
  /** 에러 메시지 */
  error?: string;
}

/**
 * 앱 정보
 */
export interface AppInfo {
  /** 앱 버전 */
  version: string;
  /** 빌드 번호 */
  buildNumber: string;
  /** 앱 이름 */
  appName: string;
  /** 번들 ID / 패키지명 */
  bundleId: string;
}
