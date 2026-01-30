// lib/bridges/plugin-registry.ts
/**
 * 플러그인 레지스트리
 * - 동적 import를 위한 매핑 객체
 * - Metro 번들러 호환을 위해 정적 경로 사용
 *
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * Generated from: constants/plugins.json
 * Run: npm run generate:plugins
 */

/** Auto 플러그인 매핑 (npm 패키지) */
export const AUTO_PLUGINS: Record<string, () => Promise<any>> = {
  'rnww-plugin-wifi': () => import('rnww-plugin-wifi'),
  'rnww-plugin-bluetooth': () => import('rnww-plugin-bluetooth'),
  'rnww-plugin-screen-pinning': () => import('rnww-plugin-screen-pinning'),
  'rnww-plugin-camera': () => import('rnww-plugin-camera'),
  'rnww-plugin-background': () => import('rnww-plugin-background'),
  'rnww-plugin-microphone': () => import('rnww-plugin-microphone'),
};

/** Manual 플러그인 매핑 (로컬 구현) */
export const MANUAL_PLUGINS: Record<string, () => Promise<any>> = {
  './webview': () => import('./webview'),
  './security': () => import('./security'),
  './orientation': () => import('./orientation'),
  './push': () => import('./push'),
  './splash': () => import('./splash'),
  './status-bar': () => import('./status-bar'),
  './ui': () => import('./ui'),
  './update': () => import('./update'),
  './keep-awake': () => import('./keep-awake'),
  './navigation-bar': () => import('./navigation-bar'),
  './clipboard': () => import('./clipboard'),
  './device': () => import('./device'),
};
