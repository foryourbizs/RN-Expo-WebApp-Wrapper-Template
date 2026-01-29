// constants/plugins.config.ts
/**
 * 플러그인 설정 파일
 * - auto: npm 패키지 플러그인 (외부 의존성)
 * - manual: 로컬 구현 플러그인 (lib/bridges 내)
 */

import type { PluginsConfig } from '@/lib/plugin-system';

export const PLUGINS_CONFIG: PluginsConfig = {
  plugins: {
    // 외부 npm 패키지 플러그인
    auto: [
      { name: 'rnww-plugin-camera', namespace: 'cam', keepModules: ['customcamera'] },
      { name: 'rnww-plugin-microphone', namespace: 'mic', keepModules: ['custommicrophone'] },
      { name: 'rnww-plugin-screen-pinning', namespace: 'pin', keepModules: ['screenpinning'] },
      { name: 'rnww-plugin-background', namespace: 'bg', keepModules: ['custombackground'] },
      { name: 'rnww-plugin-gps', namespace: 'gps', keepModules: ['customgps'] },
      { name: 'rnww-plugin-wifi', namespace: 'wifi', keepModules: ['customwifi'] },
      { name: 'rnww-plugin-bluetooth', namespace: 'bt', keepModules: ['custombluetooth'] },
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
