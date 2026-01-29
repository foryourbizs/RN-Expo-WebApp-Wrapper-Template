// lib/bridges/update/handlers.ts
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';
import {
  UpdateCheckResult,
  AppInfo,
  UpdateConfig,
} from './types';

/**
 * 앱 버전 가져오기 (네이티브 빌드 + Expo Go 지원)
 */
const getAppVersion = (): string => {
  // 1. 네이티브 빌드 버전 (우선)
  if (Application.nativeApplicationVersion) {
    return Application.nativeApplicationVersion;
  }
  // 2. expo-constants에서 가져오기 (Expo Go / 개발 환경)
  if (Constants.expoConfig?.version) {
    return Constants.expoConfig.version;
  }
  // 3. manifest2에서 가져오기 (Expo Go - EAS Update)
  const manifest2 = Constants.manifest2;
  if (manifest2?.extra?.expoClient?.version) {
    return manifest2.extra.expoClient.version;
  }
  return '0.0.0';
};

/**
 * 빌드 번호 가져오기
 */
const getBuildNumber = (): string => {
  if (Application.nativeBuildVersion) {
    return Application.nativeBuildVersion;
  }
  // Android: versionCode, iOS: buildNumber
  const buildNum = Platform.OS === 'ios'
    ? Constants.expoConfig?.ios?.buildNumber
    : Constants.expoConfig?.android?.versionCode?.toString();
  return buildNum || '1';
};

/**
 * 앱 이름 가져오기
 */
const getAppName = (): string => {
  return Application.applicationName || Constants.expoConfig?.name || 'App';
};

/**
 * 번들 ID 가져오기
 */
const getBundleId = (): string => {
  if (Application.applicationId) {
    return Application.applicationId;
  }
  return Platform.OS === 'ios'
    ? Constants.expoConfig?.ios?.bundleIdentifier || ''
    : Constants.expoConfig?.android?.package || '';
};

// 기본 설정 (앱에서 오버라이드 가능)
let updateConfig: UpdateConfig = {};

/**
 * 업데이트 설정 지정
 */
export const setUpdateConfig = (config: UpdateConfig) => {
  updateConfig = { ...updateConfig, ...config };
};

/**
 * 스토어 URL 생성
 */
const getStoreUrl = (): string => {
  if (Platform.OS === 'ios') {
    const appId = updateConfig.iosAppId || Application.applicationId;
    return `https://apps.apple.com/app/id${appId}`;
  } else {
    const packageName = updateConfig.androidPackageName || Application.applicationId;
    return `https://play.google.com/store/apps/details?id=${packageName}`;
  }
};

/**
 * 버전 비교 (semver 간단 비교)
 */
const isNewerVersion = (current: string, latest: string): boolean => {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const c = currentParts[i] || 0;
    const l = latestParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
};

/**
 * 업데이트 핸들러 등록
 */
export const registerUpdateHandlers = (bridge: BridgeAPI, _platform: PlatformInfo) => {
  const { registerHandler } = bridge;

  // 앱 정보 가져오기
  registerHandler<void, AppInfo>('getAppInfo', async (_, respond) => {
    respond({
      version: getAppVersion(),
      buildNumber: getBuildNumber(),
      appName: getAppName(),
      bundleId: getBundleId(),
    });
  });

  // 업데이트 체크 (커스텀 API 사용)
  registerHandler<{ endpoint?: string; latestVersion?: string }, UpdateCheckResult>(
    'check',
    async (payload, respond) => {
      try {
        const currentVersion = getAppVersion();
        const endpoint = payload?.endpoint || updateConfig.checkEndpoint;

        let latestVersion = payload?.latestVersion;
        let isForced = false;

        // 커스텀 API로 버전 체크
        if (endpoint && !latestVersion) {
          try {
            const response = await fetch(endpoint);
            const data = await response.json();
            latestVersion = data.version || data.latestVersion;
            isForced = data.forceUpdate || false;
          } catch (e) {
            console.warn('[Update] Failed to fetch version from endpoint:', e);
          }
        }

        // 강제 업데이트 버전 체크
        if (updateConfig.forceUpdateVersions?.includes(currentVersion)) {
          isForced = true;
        }

        const available = latestVersion ? isNewerVersion(currentVersion, latestVersion) : false;

        respond({
          available,
          currentVersion,
          latestVersion,
          isForced: available && isForced,
          storeUrl: getStoreUrl(),
        });
      } catch (error) {
        respond({
          available: false,
          currentVersion: getAppVersion(),
          isForced: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // 스토어 열기
  registerHandler<void, { success: boolean; error?: string }>(
    'openStore',
    async (_, respond) => {
      try {
        const storeUrl = getStoreUrl();
        await Linking.openURL(storeUrl);
        respond({ success: true });
      } catch (error) {
        respond({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to open store',
        });
      }
    }
  );

  console.log('[Update] Handlers registered');
};
