/**
 * 플러그인 설정 파일
 * - auto: npm 패키지 플러그인 (외부 의존성)
 * - manual: 로컬 구현 플러그인 (lib/bridges 내)
 *
 * 기본값은 이 파일에 정의되며, constants/plugins.json에서 오버라이드 가능
 */

import type { PluginsConfig } from '@/lib/plugin-system';
import pluginsOverrides from './plugins.json';

/**
 * 기본 플러그인 설정
 */
const PLUGINS_CONFIG_DEFAULTS: PluginsConfig = {
  plugins: {
    // 외부 npm 패키지 플러그인
    auto: [
      { name: 'rnww-plugin-camera', namespace: 'cam' },
      { name: 'rnww-plugin-microphone', namespace: 'mic' },
      { name: 'rnww-plugin-screen-pinning', namespace: 'pin' },
      { name: 'rnww-plugin-background', namespace: 'bg' },
      { name: 'rnww-plugin-gps', namespace: 'gps' },
      { name: 'rnww-plugin-wifi', namespace: 'wifi' },
      { name: 'rnww-plugin-bluetooth', namespace: 'bt' },
    ],
    // 로컬 구현 플러그인
    manual: [
      { path: './clipboard', namespace: 'clip' },
      { path: './device', namespace: 'device' },
      { path: './orientation', namespace: 'orient' },
      { path: './status-bar', namespace: 'sbar' },
      { path: './navigation-bar', namespace: 'nbar' },
      { path: './keep-awake', namespace: 'awake' },
      { path: './push', namespace: 'push' },
      { path: './update', namespace: 'update' },
      { path: './security', namespace: 'sec' },
      { path: './splash', namespace: 'splash' },
      { path: './ui', namespace: 'ui' },
      { path: './webview', namespace: 'webview' },
    ],
  },
};

// JSON 오버라이드 처리
const { $schema, ...overrides } = pluginsOverrides as { $schema?: string } & Partial<PluginsConfig>;

// 플러그인 배열은 병합이 아닌 교체 (빈 배열이 아닌 경우)
export const PLUGINS_CONFIG: PluginsConfig = {
  plugins: {
    auto: overrides.plugins?.auto?.length
      ? overrides.plugins.auto
      : PLUGINS_CONFIG_DEFAULTS.plugins.auto,
    manual: overrides.plugins?.manual?.length
      ? overrides.plugins.manual
      : PLUGINS_CONFIG_DEFAULTS.plugins.manual,
  },
};
