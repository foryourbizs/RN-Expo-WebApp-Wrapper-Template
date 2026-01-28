/**
 * 플랫폼 감지 및 기능 지원 유틸리티
 */

import { Platform } from 'react-native';

/**
 * 현재 플랫폼 반환
 */
export const getPlatform = (): 'android' | 'ios' | 'web' => {
  return Platform.OS as 'android' | 'ios' | 'web';
};

/**
 * Android 여부
 */
export const isAndroid = (): boolean => {
  return Platform.OS === 'android';
};

/**
 * iOS 여부
 */
export const isIOS = (): boolean => {
  return Platform.OS === 'ios';
};

/**
 * 플랫폼 버전 반환
 */
export const getPlatformVersion = (): string => {
  return String(Platform.Version);
};

/**
 * 기능별 플랫폼 지원 여부
 */
type PlatformFeature =
  | 'navigationBar'       // Android only
  | 'screenPinning'       // Android only
  | 'statusBarColor'      // Android only
  | 'hapticFeedback'      // Both (iOS has more options)
  | 'orientation'         // Both
  | 'clipboard'           // Both
  | 'keepAwake';          // Both

const FEATURE_SUPPORT: Record<PlatformFeature, { android: boolean; ios: boolean }> = {
  navigationBar: { android: true, ios: false },
  screenPinning: { android: true, ios: false },
  statusBarColor: { android: true, ios: false },
  hapticFeedback: { android: true, ios: true },
  orientation: { android: true, ios: true },
  clipboard: { android: true, ios: true },
  keepAwake: { android: true, ios: true },
};

/**
 * 특정 기능이 현재 플랫폼에서 지원되는지 확인
 */
export const platformSupports = (feature: PlatformFeature): boolean => {
  const support = FEATURE_SUPPORT[feature];
  if (!support) return false;
  return Platform.OS === 'android' ? support.android : support.ios;
};

/**
 * 플랫폼 미지원 응답 생성
 */
export const unsupportedPlatformResponse = (feature: string) => ({
  success: false,
  error: `${feature} is not supported on ${Platform.OS}`,
  platform: Platform.OS,
});
