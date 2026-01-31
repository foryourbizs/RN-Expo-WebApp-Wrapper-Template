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
 * 기본 색상 설정 (화면별 구분)
 */
const COLORS_DEFAULTS = {
  light: {
    // 스플래시 화면
    splashBackground: '#ffffff',
    splashText: 'rgba(0,0,0,0.6)',
    splashSpinner: 'rgba(0,122,255,0.9)',

    // 오프라인 화면
    offlineBackground: '#ffffff',
    offlineText: '#333333',
    offlineSubText: '#666666',
    offlineButton: '#007AFF',

    // 에러 화면
    errorBackground: '#fafafa',
    errorTitle: '#1a1a1a',
    errorMessage: '#666666',
    errorButton: '#007AFF',

    // 로딩 인디케이터
    loadingIndicator: '#007AFF',
  },
  dark: {
    // 스플래시 화면
    splashBackground: '#000000',
    splashText: 'rgba(255,255,255,0.8)',
    splashSpinner: 'rgba(255,255,255,0.9)',

    // 오프라인 화면
    offlineBackground: '#1a1a1a',
    offlineText: '#ffffff',
    offlineSubText: '#aaaaaa',
    offlineButton: '#007AFF',

    // 에러 화면
    errorBackground: '#1a1a1a',
    errorTitle: '#ffffff',
    errorMessage: '#aaaaaa',
    errorButton: '#007AFF',

    // 로딩 인디케이터
    loadingIndicator: '#007AFF',
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
