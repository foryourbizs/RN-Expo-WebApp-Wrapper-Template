/**
 * 테마 설정 (색상, 폰트)
 *
 * 기본값은 이 파일에 정의되며, constants/theme.json에서 오버라이드 가능
 * 참고: Fonts는 플랫폼 특성상 JSON 오버라이드 불가
 */

import { Platform } from 'react-native';
import { deepMerge, DeepPartial } from './utils/deep-merge';
import themeOverrides from './theme.json';

/**
 * 기본 색상 설정
 */
const COLORS_DEFAULTS = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
  },
};

// 타입 정의
export type ColorsType = typeof COLORS_DEFAULTS;

// JSON 오버라이드와 병합
const { $schema, colors: colorOverrides } = themeOverrides as {
  $schema?: string;
  colors?: DeepPartial<ColorsType>;
};

export const Colors = colorOverrides
  ? deepMerge(COLORS_DEFAULTS, colorOverrides)
  : COLORS_DEFAULTS;

/**
 * 폰트 설정 (플랫폼별)
 * 참고: JSON 오버라이드 불가 (플랫폼별 시스템 폰트 사용)
 */
export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
