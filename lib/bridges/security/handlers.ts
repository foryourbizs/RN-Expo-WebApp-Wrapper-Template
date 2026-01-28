// lib/bridges/security/handlers.ts
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';
import {
  SecurityCheckResult,
  RootCheckResult,
  IntegrityCheckResult,
  SecurityConfig,
} from './types';

// 기본 설정
let securityConfig: SecurityConfig = {
  checkRoot: true,
  checkDebugging: true,
  checkEmulator: true,
  exitOnRisk: false,
};

/**
 * 보안 설정 지정
 */
export const setSecurityConfig = (config: SecurityConfig) => {
  securityConfig = { ...securityConfig, ...config };
};

/**
 * 디버깅 여부 체크
 */
const checkDebugging = (): boolean => {
  if (__DEV__) {
    return true;
  }
  return false;
};

/**
 * 에뮬레이터 여부 체크
 */
const checkEmulator = (): boolean => {
  return !Device.isDevice;
};

/**
 * Root/Jailbreak 체크 (기본 구현)
 * 실제 앱에서는 더 정교한 체크 필요
 */
const checkRoot = (): RootCheckResult => {
  const indicators: string[] = [];

  // 기본적인 에뮬레이터 체크 (루트의 일부 지표)
  if (!Device.isDevice) {
    indicators.push('emulator_detected');
  }

  // 개발 모드 체크
  if (__DEV__) {
    indicators.push('dev_mode');
  }

  return {
    isRooted: indicators.length > 0,
    indicators,
  };
};

/**
 * 보안 핸들러 등록
 */
export const registerSecurityHandlers = (bridge: BridgeAPI, _platform: PlatformInfo) => {
  const { registerHandler } = bridge;

  // Root/Jailbreak 체크
  registerHandler<void, RootCheckResult>('checkRoot', async (_, respond) => {
    try {
      const result = checkRoot();
      respond(result);
    } catch (error) {
      respond({
        isRooted: false,
        indicators: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // 무결성 체크 (기본 구현)
  registerHandler<void, IntegrityCheckResult>('checkIntegrity', async (_, respond) => {
    try {
      // 기본 구현: 항상 유효
      // 실제 앱에서는 서버와 서명 검증 필요
      respond({
        isValid: true,
        appSignature: 'not_implemented',
      });
    } catch (error) {
      respond({
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // 종합 보안 체크
  registerHandler<void, SecurityCheckResult>('check', async (_, respond) => {
    try {
      const checks: string[] = [];
      const failedChecks: string[] = [];

      let isRooted = false;
      let isDebugging = false;
      let isEmulator = false;

      // Root 체크
      if (securityConfig.checkRoot) {
        checks.push('root_check');
        const rootResult = checkRoot();
        isRooted = rootResult.isRooted;
        if (isRooted) {
          failedChecks.push('root_check');
        }
      }

      // 디버깅 체크
      if (securityConfig.checkDebugging) {
        checks.push('debugging_check');
        isDebugging = checkDebugging();
        if (isDebugging) {
          failedChecks.push('debugging_check');
        }
      }

      // 에뮬레이터 체크
      if (securityConfig.checkEmulator) {
        checks.push('emulator_check');
        isEmulator = checkEmulator();
        if (isEmulator) {
          failedChecks.push('emulator_check');
        }
      }

      const isSecure = failedChecks.length === 0;

      respond({
        isSecure,
        isRooted,
        isDebugging,
        isEmulator,
        checks,
        failedChecks: failedChecks.length > 0 ? failedChecks : undefined,
      });
    } catch (error) {
      respond({
        isSecure: false,
        isRooted: false,
        isDebugging: false,
        isEmulator: false,
        checks: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // 보안 환경 정보 반환
  registerHandler<void, { platform: string; isDevice: boolean; brand: string | null; model: string | null }>(
    'getEnvironment',
    async (_, respond) => {
      respond({
        platform: Platform.OS,
        isDevice: Device.isDevice,
        brand: Device.brand,
        model: Device.modelName,
      });
    }
  );

  console.log('[Security] Handlers registered');
};
