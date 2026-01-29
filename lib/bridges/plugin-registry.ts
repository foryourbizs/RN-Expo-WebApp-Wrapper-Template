// lib/bridges/plugin-registry.ts
/**
 * 플러그인 레지스트리
 * - 동적 import를 위한 매핑 객체
 * - Metro 번들러 호환을 위해 정적 경로 사용
 */

/** Auto 플러그인 매핑 (npm 패키지) */
export const AUTO_PLUGINS: Record<string, () => Promise<any>> = {
  'rnww-plugin-camera': () => import('rnww-plugin-camera'),
  'rnww-plugin-microphone': () => import('rnww-plugin-microphone'),
  'rnww-plugin-screen-pinning': () => import('rnww-plugin-screen-pinning'),
  'rnww-plugin-background': () => import('rnww-plugin-background'),
  'rnww-plugin-gps': () => import('rnww-plugin-gps'),
  'rnww-plugin-wifi': () => import('rnww-plugin-wifi'),
  'rnww-plugin-bluetooth': () => import('rnww-plugin-bluetooth'),
};

/** Manual 플러그인 매핑 (로컬 구현) */
export const MANUAL_PLUGINS: Record<string, () => Promise<any>> = {
  './clipboard': () => import('./clipboard'),
  './device': () => import('./device'),
  './orientation': () => import('./orientation'),
  './status-bar': () => import('./status-bar'),
  './navigation-bar': () => import('./navigation-bar'),
  './keep-awake': () => import('./keep-awake'),
  './push': () => import('./push'),
  './update': () => import('./update'),
  './security': () => import('./security'),
  './splash': () => import('./splash'),
  './ui': () => import('./ui'),
  './webview': () => import('./webview'),
};
