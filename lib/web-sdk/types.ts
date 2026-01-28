// lib/web-sdk/types.ts

/**
 * AppBridge 메시지 구조
 */
export interface AppBridgeMessage {
  /** 액션명 (예: 'showToast', 'cam:start') */
  action: string;
  /** 페이로드 데이터 */
  payload?: Record<string, unknown>;
  /** 요청 ID (call 사용 시 응답 매칭용) */
  requestId?: string;
  /** 타임스탬프 */
  timestamp?: number;
}

/**
 * AppBridge 응답 구조
 */
export interface AppBridgeResponse<T = unknown> {
  /** 성공 여부 */
  success: boolean;
  /** 응답 데이터 */
  data?: T;
  /** 에러 메시지 */
  error?: string;
  /** 요청 ID */
  requestId?: string;
}

/**
 * 이벤트 리스너 타입
 */
export type AppBridgeListener<T = unknown> = (
  payload: T,
  message: AppBridgeMessage
) => void;

/**
 * AppBridge 초기화 옵션
 */
export interface AppBridgeOptions {
  /** 기본 타임아웃 (ms) */
  timeout?: number;
  /** 디버그 모드 */
  debug?: boolean;
}

/**
 * 파일 데이터 (base64 변환용)
 */
export interface Base64FileData {
  __type: 'base64';
  data: string;
  mimeType: string;
  name: string;
  size: number;
}

/**
 * 빌트인 액션 목록
 */
export type BuiltInAction =
  | 'getDeviceInfo'
  | 'showToast'
  | 'vibrate'
  | 'readClipboard'
  | 'writeClipboard'
  | 'setStatusBar'
  | 'getStatusBar'
  | 'restoreStatusBar'
  | 'setNavigationBar'
  | 'getNavigationBar'
  | 'restoreNavigationBar'
  | 'setOrientation'
  | 'getOrientation'
  | 'unlockOrientation'
  | 'activateKeepAwake'
  | 'deactivateKeepAwake'
  | 'hideSplash'
  | 'openExternalUrl'
  | 'reload'
  | 'goBack'
  | 'goForward';

/**
 * 플러그인 액션 (namespace:action 형식)
 */
export type PluginAction =
  // Camera
  | 'cam:start'
  | 'cam:stop'
  | 'cam:capture'
  | 'cam:onFrame'
  // Microphone
  | 'mic:start'
  | 'mic:stop'
  | 'mic:onData'
  // Push
  | 'push:requestPermission'
  | 'push:getToken'
  | 'push:onReceived'
  | 'push:onOpened'
  // Update
  | 'upd:getAppInfo'
  | 'upd:check'
  | 'upd:openStore'
  // Security
  | 'sec:checkRoot'
  | 'sec:checkIntegrity'
  | 'sec:check'
  | 'sec:getEnvironment'
  // Screen Pinning (Android only)
  | 'pin:start'
  | 'pin:stop'
  | 'pin:getStatus';
