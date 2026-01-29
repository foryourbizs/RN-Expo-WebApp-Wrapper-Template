/**
 * 앱 환경설정 상수
 * 웹뷰 및 앱 전반적인 설정을 관리
 *
 * 기본값은 이 파일에 정의되며, constants/app.json에서 오버라이드 가능
 */

declare const __DEV__: boolean;

import { deepMerge, DeepPartial } from './utils/deep-merge';
import appOverrides from './app.json';

/**
 * 기본 설정값
 */
const APP_CONFIG_DEFAULTS = {
  // 웹뷰 설정
  webview: {
    // 메인 웹사이트 URL
    baseUrl: 'https://example.com/',

    // 웹뷰 기본 옵션
    options: {
      // JavaScript 활성화
      javaScriptEnabled: true,
      // DOM 스토리지 활성화 (localStorage, sessionStorage)
      domStorageEnabled: true,
      // 서드파티 쿠키 허용
      thirdPartyCookiesEnabled: true,
      // 미디어 자동재생 허용
      mediaPlaybackRequiresUserAction: true,
      // 혼합 컨텐츠 허용 (HTTPS 페이지에서 HTTP 리소스)
      mixedContentMode: 'compatibility' as 'compatibility' | 'never' | 'always',
      // 캐시 모드
      cacheEnabled: true,
      // 인라인 미디어 재생 허용 (iOS)
      allowsInlineMediaPlayback: true,
      // 스와이프 뒤로/앞으로 제스처 (iOS)
      allowsBackForwardNavigationGestures: true,
    },

    // 성능 최적화 옵션 (Android)
    performance: {
      // 레이어 타입: 'none' | 'software' | 'hardware'
      androidLayerType: 'hardware' as 'none' | 'software' | 'hardware',
      // 오버스크롤 모드
      overScrollMode: 'never' as 'always' | 'content' | 'never',
      // 텍스트 줌 고정 (100% = 변경없음)
      textZoom: 100,
      // 중첩 스크롤 비활성화
      nestedScrollEnabled: false,
      // 스크롤바 숨김
      hideScrollIndicators: true,
      // 풀스크린 비디오 허용
      allowsFullscreenVideo: true,
      // 멀티 윈도우 지원
      setSupportMultipleWindows: false,
    },

    // 커스텀 User-Agent
    userAgent: 'webapp-wrapper',
  },

  // 오프라인 화면 설정
  offline: {
    // 오프라인 감지 활성화
    enabled: true,
    // 오프라인 화면 제목
    title: '인터넷 연결 없음',
    // 오프라인 화면 메시지
    message: '네트워크 연결을 확인해주세요.\nWi-Fi 또는 모바일 데이터가\n활성화되어 있는지 확인하세요.',
    // 재시도 버튼 텍스트
    retryButtonText: '다시 시도',
    // 배경색
    backgroundColor: '#ffffff',
    // 다크모드 배경색
    darkBackgroundColor: '#1a1a1a',
    // 자동 재연결 시도 (온라인 복구 시 자동 새로고침)
    autoReconnect: true,
  },

  // 상태바 설정
  statusBar: {
    // 상태바 표시 여부
    visible: true,
    // 상태바 스타일: 'auto' | 'light' | 'dark'
    style: 'dark' as 'auto' | 'light' | 'dark',
    // 상태바와 웹뷰 겹침 여부
    overlapsWebView: false,
    // 상태바 오버레이 표시
    showOverlay: true,
    // 상태바 오버레이 색상
    overlayColor: 'rgba(0,0,0,0.5)',
    // 상태바 반투명 여부 (Android)
    translucent: true,
  },

  // 하단 네비게이션 바 설정 (Android 전용)
  navigationBar: {
    // 네비게이션 바 표시 모드
    visibility: 'visible' as 'visible' | 'hidden',
    // 숨김 시 동작 방식
    behavior: 'overlay-swipe' as 'overlay-swipe' | 'inset-swipe',
    // 네비게이션 바 배경색
    backgroundColor: '#ffffff',
    // 다크모드 네비게이션 바 배경색
    darkBackgroundColor: '#000000',
    // 네비게이션 바 버튼 스타일
    buttonStyle: 'dark' as 'light' | 'dark',
  },

  // SafeArea 설정
  safeArea: {
    // SafeArea 사용 여부
    enabled: false,
    // 적용할 영역
    edges: 'none' as 'all' | 'top' | 'bottom' | 'none',
    // SafeArea 배경색
    backgroundColor: '#ffffff',
    // 다크모드 SafeArea 배경색
    darkBackgroundColor: '#000000',
  },

  // 테마 설정
  theme: {
    // 로딩 인디케이터 색상
    loadingIndicatorColor: '#007AFF',
  },

  // 커스텀 스플래시 스크린 설정
  splash: {
    // 스플래시 활성화 여부
    enabled: true,
    // 최소 표시 시간 (ms)
    minDisplayTime: 1000,
    // 페이드 아웃 시간 (ms)
    fadeOutDuration: 300,
    // 배경색
    backgroundColor: '#ffffff',
    // 다크모드 배경색
    darkBackgroundColor: '#000000',
    // 로고 이미지 (null이면 텍스트만)
    logoImage: null as string | null,
    // 로딩 텍스트
    loadingText: '로딩 중...',
    // 로딩 인디케이터 표시
    showLoadingIndicator: true,
  },

  // 디버그 설정
  debug: {
    // 디버그 모드 활성화
    enabled: __DEV__,
    // 최대 로그 라인 수
    maxLogLines: 50,
    // 로그 오버레이 투명도
    overlayOpacity: 0.85,
    // 로그 폰트 크기
    fontSize: 11,
    // 로그 레벨 색상
    colors: {
      info: '#3498db',
      warn: '#f39c12',
      error: '#e74c3c',
      success: '#27ae60',
      event: '#9b59b6',
      nav: '#1abc9c',
    },
  },

  // 보안 설정
  security: {
    // 허용된 Origin 목록 (빈 배열이면 모든 Origin 허용)
    allowedOrigins: [] as string[],
    // 차단된 URL 스킴
    blockedSchemes: ['data', 'blob', 'javascript', 'vbscript'],
    // 허용된 URL 스킴
    allowedSchemes: ['https', 'http', 'about'],
    // 개발 환경에서 HTTP 허용
    allowInsecureHttp: __DEV__,
    // 락다운 지속 시간 (ms)
    lockdownDurationMs: 30000,
    // 메시지 최대 유효 시간 (ms)
    messageMaxAgeMs: 30000,
    // 네비게이션 Rate Limit 설정
    navigationRateLimit: {
      shortWindow: { windowMs: 1000, maxRequests: 30 },
      longWindow: { windowMs: 10000, maxRequests: 100 },
    },
    // 리다이렉트 체인 최대 길이
    maxRedirectChain: 5,
    // 디버그 모드 (보안 로그 상세 출력)
    debug: __DEV__,
  },
};

// 타입 정의
export type AppConfigType = typeof APP_CONFIG_DEFAULTS;

// JSON 오버라이드와 병합하여 최종 설정 생성
const { $schema, ...overrides } = appOverrides as { $schema?: string } & DeepPartial<AppConfigType>;
export const APP_CONFIG = deepMerge(APP_CONFIG_DEFAULTS, overrides);

// 하위 타입 추출
export type WebviewConfig = AppConfigType['webview'];
export type SecurityConfigType = AppConfigType['security'];
