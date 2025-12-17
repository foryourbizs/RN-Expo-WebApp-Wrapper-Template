/**
 * 전역 상태 타입 정의
 * 모듈형 확장을 위한 타입 시스템
 */

import type { WebViewNavigation } from 'react-native-webview';

// ============================================
// 웹뷰 상태 타입
// ============================================
export interface WebviewState {
  // 현재 URL
  currentUrl: string;
  // 로딩 상태
  isLoading: boolean;
  // 페이지 타이틀
  pageTitle: string;
  // 뒤로가기 가능 여부
  canGoBack: boolean;
  // 앞으로가기 가능 여부
  canGoForward: boolean;
  // 에러 상태
  error: WebviewError | null;
  // 마지막 네비게이션 상태
  lastNavigation: WebViewNavigation | null;
}

export interface WebviewError {
  code: number;
  description: string;
  url: string;
}

export interface WebviewActions {
  setCurrentUrl: (url: string) => void;
  setIsLoading: (loading: boolean) => void;
  setPageTitle: (title: string) => void;
  setCanGoBack: (canGoBack: boolean) => void;
  setCanGoForward: (canGoForward: boolean) => void;
  setError: (error: WebviewError | null) => void;
  setLastNavigation: (navigation: WebViewNavigation | null) => void;
  resetWebviewState: () => void;
}

// ============================================
// 앱 상태 타입
// ============================================
export interface AppState {
  // 앱 초기화 완료 여부
  isInitialized: boolean;
  // 앱 활성 상태
  isActive: boolean;
  // 네트워크 연결 상태
  isOnline: boolean;
  // 현재 테마
  theme: 'light' | 'dark' | 'system';
}

export interface AppActions {
  setInitialized: (initialized: boolean) => void;
  setActive: (active: boolean) => void;
  setOnline: (online: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

// ============================================
// 확장 모듈 타입 (추후 구현용)
// ============================================

/**
 * 푸시 알림 모듈 상태 (추후 Firebase 연동)
 */
export interface NotificationModuleState {
  // FCM 토큰
  fcmToken: string | null;
  // 알림 권한 상태
  permissionStatus: 'granted' | 'denied' | 'undetermined';
  // 읽지 않은 알림 수
  unreadCount: number;
  // 알림 목록
  notifications: NotificationItem[];
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  timestamp: number;
  isRead: boolean;
}

/**
 * 로컬 알림/알람 모듈 상태
 */
export interface AlarmModuleState {
  // 설정된 알람 목록
  alarms: AlarmItem[];
  // 알람 권한 상태
  permissionGranted: boolean;
}

export interface AlarmItem {
  id: string;
  title: string;
  scheduledTime: number;
  repeatType: 'none' | 'daily' | 'weekly' | 'monthly';
  isEnabled: boolean;
}

/**
 * 기기 제어 모듈 상태 (IoT, 센서 등)
 */
export interface DeviceControlModuleState {
  // 연결된 기기 목록
  connectedDevices: DeviceInfo[];
  // 블루투스 상태
  bluetoothEnabled: boolean;
  // 위치 서비스 상태
  locationEnabled: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  lastSeen: number;
}

// ============================================
// 통합 스토어 타입
// ============================================
export interface RootStore extends 
  WebviewState, 
  WebviewActions,
  AppState,
  AppActions {
  // 모듈 확장을 위한 플레이스홀더
  // 추후 슬라이스 패턴으로 확장
  _modules: {
    notification?: NotificationModuleState;
    alarm?: AlarmModuleState;
    deviceControl?: DeviceControlModuleState;
  };
  
  // 모듈 등록 함수 (추후 구현)
  registerModule: <T>(moduleName: string, initialState: T) => void;
}
