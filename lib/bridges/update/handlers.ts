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
 * App Store에서 최신 버전 가져오기 (iOS)
 */
const getAppStoreVersion = async (bundleId: string): Promise<string | null> => {
  try {
    // iTunes Lookup API
    const response = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${bundleId}&country=kr`
    );
    const data = await response.json();

    if (data.resultCount > 0 && data.results[0]?.version) {
      return data.results[0].version;
    }
    return null;
  } catch (error) {
    console.warn('[Update] Failed to fetch App Store version:', error);
    return null;
  }
};

/**
 * Play Store에서 최신 버전 가져오기 (Android)
 */
const getPlayStoreVersion = async (packageName: string): Promise<string | null> => {
  try {
    // Play Store 페이지에서 버전 정보 스크래핑
    const response = await fetch(
      `https://play.google.com/store/apps/details?id=${packageName}&hl=ko`
    );
    const html = await response.text();

    // 버전 정보 패턴 매칭 (Play Store HTML 구조)
    // 패턴 1: [["버전"],["1.2.3"]] 형태
    const versionMatch = html.match(/\[\["[^"]*"\],\["(\d+\.\d+\.?\d*)/);
    if (versionMatch && versionMatch[1]) {
      return versionMatch[1];
    }

    // 패턴 2: "softwareVersion":"1.2.3" 형태
    const softwareMatch = html.match(/"softwareVersion":"(\d+\.\d+\.?\d*)"/);
    if (softwareMatch && softwareMatch[1]) {
      return softwareMatch[1];
    }

    // 패턴 3: Current Version 텍스트 근처
    const currentMatch = html.match(/Current Version.*?>([\d.]+)</);
    if (currentMatch && currentMatch[1]) {
      return currentMatch[1];
    }

    return null;
  } catch (error) {
    console.warn('[Update] Failed to fetch Play Store version:', error);
    return null;
  }
};

/**
 * 스토어에서 최신 버전 가져오기
 */
const getStoreVersion = async (): Promise<string | null> => {
  const bundleId = getBundleId();
  if (!bundleId) return null;

  if (Platform.OS === 'ios') {
    return getAppStoreVersion(bundleId);
  } else {
    return getPlayStoreVersion(bundleId);
  }
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

  // 업데이트 체크 (스토어 버전 자동 확인)
  registerHandler<{ endpoint?: string; latestVersion?: string; checkStore?: boolean }, UpdateCheckResult>(
    'check',
    async (payload, respond) => {
      try {
        const currentVersion = getAppVersion();
        const endpoint = payload?.endpoint || updateConfig.checkEndpoint;
        const checkStore = payload?.checkStore !== false; // 기본값 true

        let latestVersion = payload?.latestVersion;
        let isForced = false;

        // 1. 직접 전달된 버전이 있으면 사용
        if (latestVersion) {
          // 이미 설정됨
        }
        // 2. 커스텀 API로 버전 체크
        else if (endpoint) {
          try {
            const response = await fetch(endpoint);
            const data = await response.json();
            latestVersion = data.version || data.latestVersion;
            isForced = data.forceUpdate || false;
          } catch (e) {
            console.warn('[Update] Failed to fetch version from endpoint:', e);
          }
        }
        // 3. 스토어에서 직접 버전 가져오기
        else if (checkStore) {
          latestVersion = await getStoreVersion() || undefined;
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
