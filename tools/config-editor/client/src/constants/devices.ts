// tools/config-editor/client/src/constants/devices.ts

export const DEVICE_SIZES = {
  small: { width: 320, height: 568, label: 'Small Phone' },
  phone: { width: 375, height: 812, label: 'Phone' },
  large: { width: 428, height: 926, label: 'Large Phone' },
  tablet: { width: 768, height: 1024, label: 'Tablet' },
} as const;

export type DeviceSizeKey = keyof typeof DEVICE_SIZES;

// 미리보기 패널에서 사용할 스케일 계산
export function calculateScale(
  deviceWidth: number,
  deviceHeight: number,
  containerWidth: number,
  containerHeight: number,
  orientation: 'portrait' | 'landscape'
): number {
  const actualWidth = orientation === 'portrait' ? deviceWidth : deviceHeight;
  const actualHeight = orientation === 'portrait' ? deviceHeight : deviceWidth;

  const scaleX = containerWidth / actualWidth;
  const scaleY = containerHeight / actualHeight;

  return Math.min(scaleX, scaleY, 1); // 최대 1배 (확대 방지)
}

// 섹션 ID와 미리보기 화면 매핑
export const SECTION_TO_SCREEN_MAP: Record<string, 'splash' | 'webview' | 'offline' | 'theme'> = {
  webview: 'webview',
  'webview-options': 'webview',
  'webview-performance': 'webview',
  offline: 'offline',
  statusBar: 'webview',
  navigationBar: 'webview',
  safeArea: 'webview',
  theme: 'webview',
  splash: 'splash',
  security: 'webview',
  debug: 'webview',
};

// 강조 표시할 섹션
export const HIGHLIGHT_SECTIONS: Record<string, 'statusBar' | 'navBar'> = {
  statusBar: 'statusBar',
  navigationBar: 'navBar',
};
