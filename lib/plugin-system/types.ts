// lib/plugin-system/types.ts
import { BridgeHandler } from '@/lib/bridge';

/**
 * Bridge API 인터페이스 (플러그인에 전달)
 */
export interface BridgeAPI {
  registerHandler: <T = unknown, R = unknown>(
    action: string,
    handler: BridgeHandler<T, R>,
    options?: { timeout?: number; once?: boolean }
  ) => void;
  sendToWeb: <T = unknown>(action: string, payload?: T) => void;
}

/**
 * 플랫폼 정보 인터페이스
 */
export interface PlatformInfo {
  OS: 'android' | 'ios' | 'web';
  Version?: string;
}

/**
 * RNWW 플러그인 인터페이스
 */
export interface RNWWPlugin {
  /** 플러그인 이름 (예: 'rnww-plugin-camera') */
  name: string;
  /** 플러그인 키 (3-8자, 예: 'cam') */
  key: string;
  /** 플러그인 버전 */
  version: string;
  /** 지원 플랫폼 */
  platform: ('ios' | 'android')[];
  /** 핸들러 등록 함수 */
  registerHandlers: (bridge: BridgeAPI, platform: PlatformInfo) => void;
  /** 초기화 함수 (선택) */
  onInit?: () => Promise<void>;
  /** 정리 함수 (선택) */
  onDestroy?: () => void;
}

/**
 * 플러그인 등록 옵션
 */
export interface PluginRegistrationOptions {
  bridge: BridgeAPI;
  platform: PlatformInfo;
}

/**
 * 백그라운드 플러그인 옵션
 */
export interface BackgroundPluginOptions {
  /** Headless WebView와 Bridge 자동 연동 */
  enableHeadlessBridge?: boolean;
}

/**
 * 플러그인 옵션 (플러그인별 설정)
 */
export interface PluginOptions {
  /** 백그라운드 플러그인 옵션 */
  background?: BackgroundPluginOptions;
}

/**
 * 플러그인 옵션 메타데이터 (개별 옵션 정의)
 */
export interface PluginOptionMeta {
  type: 'boolean' | 'string' | 'number';
  default?: boolean | string | number;
  label: { ko: string; en: string } | string;
  description?: { ko: string; en: string } | string;
}

/**
 * 플러그인 메타데이터
 * 플러그인이 export하여 호스트 앱에 정보 제공
 */
export interface PluginMeta {
  name: string;
  version?: string;
  /** 지원하는 옵션 정의 */
  supportedOptions?: {
    [category: string]: {
      [optionKey: string]: PluginOptionMeta;
    };
  };
}

/**
 * Auto 플러그인 설정 (npm 패키지)
 */
export interface AutoPluginConfig {
  /** npm 패키지명 */
  name: string;
  /** 브릿지 네임스페이스 (예: 'cam' → 'cam:action') */
  namespace: string;
  /** 등록 메서드명 (기본: 'registerHandlers') */
  method?: string;
  /** 플러그인별 옵션 */
  options?: PluginOptions;
}

/**
 * Manual 플러그인 설정 (로컬 구현)
 */
export interface ManualPluginConfig {
  /** lib/bridges 기준 상대 경로 */
  path: string;
  /** 브릿지 네임스페이스 */
  namespace: string;
  /** 엔트리 파일명 (기본: 'index.ts') */
  entry?: string;
  /** 등록 메서드명 (기본: 'register{Namespace}Handlers') */
  method?: string;
}

/**
 * 플러그인 설정
 */
export interface PluginsConfig {
  plugins: {
    auto: AutoPluginConfig[];
    manual: ManualPluginConfig[];
  };
}
