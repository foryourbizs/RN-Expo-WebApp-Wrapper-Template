// lib/bridges/camera/index.ts
import { registerCameraHandlers as moduleRegister } from 'rnww-plugin-camera';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

/**
 * 카메라 플러그인 키
 */
export const CAMERA_PLUGIN_KEY = 'cam';

/**
 * 카메라 관련 핸들러 등록
 */
export const registerCameraHandlers = (bridge: BridgeAPI, platform: PlatformInfo) => {
  moduleRegister({
    bridge,
    platform: { OS: platform.OS },
  });
};
