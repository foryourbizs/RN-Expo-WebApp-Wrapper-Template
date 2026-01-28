// lib/plugin-system/validation.ts
import { RNWWPlugin } from './types';

/**
 * 시스템 예약 키 (프레임워크 내부용)
 * - 플러그인 키는 각 플러그인에서 자체 정의
 * - 프레임워크는 시스템 충돌 방지를 위한 최소한의 키만 예약
 */
export const SYSTEM_RESERVED_KEYS = [
  'app',   // 시스템 예약 - 앱 전역 이벤트
  'web',   // 시스템 예약 - 웹뷰 이벤트
] as const;

/**
 * @deprecated Use SYSTEM_RESERVED_KEYS instead
 * 하위 호환성을 위해 유지
 */
export const RESERVED_KEYS = SYSTEM_RESERVED_KEYS;

/**
 * 공식 플러그인 이름 prefix
 */
export const OFFICIAL_PLUGIN_PREFIX = 'rnww-plugin-';

/**
 * 플러그인이 공식 플러그인인지 확인
 */
export const isOfficialPlugin = (name: string): boolean => {
  return name.startsWith(OFFICIAL_PLUGIN_PREFIX);
};

/**
 * 플러그인 유효성 검증
 * - 필수 필드 확인
 * - 키 형식 검증 (3-8자, 영문 소문자)
 * - 시스템 예약 키 충돌 검사
 * - 키 중복은 PluginRegistry에서 처리
 */
export const validatePlugin = (plugin: RNWWPlugin): void => {
  // 필수 필드 확인
  if (!plugin.name || typeof plugin.name !== 'string') {
    throw new Error('Plugin must have a valid name');
  }

  if (!plugin.key || typeof plugin.key !== 'string') {
    throw new Error('Plugin must have a valid key');
  }

  if (!plugin.version || typeof plugin.version !== 'string') {
    throw new Error('Plugin must have a valid version');
  }

  if (!Array.isArray(plugin.platform) || plugin.platform.length === 0) {
    throw new Error('Plugin must specify at least one platform');
  }

  if (typeof plugin.registerHandlers !== 'function') {
    throw new Error('Plugin must have a registerHandlers function');
  }

  // 키 길이 검증 (3-8자)
  if (plugin.key.length < 3 || plugin.key.length > 8) {
    throw new Error('Plugin key must be 3-8 characters');
  }

  // 시스템 예약 키 검증 (app, web만 차단)
  if (SYSTEM_RESERVED_KEYS.includes(plugin.key as typeof SYSTEM_RESERVED_KEYS[number])) {
    throw new Error(`Plugin key '${plugin.key}' is reserved for system use`);
  }

  // 키 형식 검증 (영문 소문자만)
  if (!/^[a-z]+$/.test(plugin.key)) {
    throw new Error('Plugin key must contain only lowercase letters');
  }
};
