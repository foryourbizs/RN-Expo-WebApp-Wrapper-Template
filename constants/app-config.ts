/**
 * 앱 환경설정 상수
 * 웹뷰 및 앱 전반적인 설정을 관리
 */

export const APP_CONFIG = {
  // 앱 기본 정보
  app: {
    name: 'RNWebWrapper',
    version: '1.0.0',
    bundleId: 'com.gdjs.rnwebwrapper',
  },

  // 웹뷰 설정
  webview: {
    // 메인 웹사이트 URL
    baseUrl: 'https://gdjs.link/',
    
    // 웹뷰 기본 옵션
    options: {
      // JavaScript 활성화
      javaScriptEnabled: true,
      // DOM 스토리지 활성화 (localStorage, sessionStorage)
      domStorageEnabled: true,
      // 서드파티 쿠키 허용
      thirdPartyCookiesEnabled: true,
      // 미디어 자동재생 허용
      mediaPlaybackRequiresUserAction: false,
      // 혼합 컨텐츠 허용 (HTTPS 페이지에서 HTTP 리소스)
      mixedContentMode: 'compatibility' as const,
      // 캐시 모드
      cacheEnabled: true,
      // 줌 허용
      scalesPageToFit: true,
      // 인라인 미디어 재생 허용 (iOS)
      allowsInlineMediaPlayback: true,
      // 백그라운드에서도 미디어 재생 (iOS)
      allowsBackForwardNavigationGestures: true,
      // 파일 접근 허용 (Android)
      allowFileAccess: true,
      // 유니버설 링크 허용 (Android)
      allowUniversalAccessFromFileURLs: false,
    },

    // 커스텀 User-Agent
    userAgent: 'webapp-wrapper',

    // 허용된 URL 패턴 (보안)
    allowedUrlPatterns: [
      'https://gdjs.link',
      'https://*.gdjs.link',
    ],
  },

  // 네트워크 설정
  network: {
    // 요청 타임아웃 (ms)
    timeout: 30000,
    // 재시도 횟수
    retryCount: 3,
  },

  // 테마 설정
  theme: {
    // 상태바 스타일
    statusBarStyle: 'auto' as 'auto' | 'light' | 'dark',
    // 웹뷰 배경색
    webviewBackgroundColor: '#FFFFFF',
    // 로딩 인디케이터 색상
    loadingIndicatorColor: '#007AFF',
  },

  // 스플래시 스크린 설정
  splash: {
    // 최소 표시 시간 (ms)
    minDisplayTime: 1500,
    // 페이드 아웃 시간 (ms)
    fadeOutDuration: 300,
    // WebView 로드 완료까지 대기
    waitForWebViewLoad: true,
  },

  // 기능 플래그 (추후 확장용)
  features: {
    // Firebase 푸시 알림
    pushNotifications: false,
    // 앱 내 알림
    localNotifications: false,
    // 기기 제어 기능
    deviceControl: false,
    // 생체인증
    biometrics: false,
    // 딥링크
    deepLinking: false,
    // 오프라인 모드
    offlineMode: false,
  },
} as const;

// 타입 추출
export type AppConfig = typeof APP_CONFIG;
export type WebviewConfig = typeof APP_CONFIG.webview;
export type FeatureFlags = typeof APP_CONFIG.features;
