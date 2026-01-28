// lib/bridges/microphone/index.ts
import { registerMicrophoneHandlers as moduleRegister } from 'rnww-plugin-microphone';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

/**
 * 마이크 플러그인 키
 */
export const MICROPHONE_PLUGIN_KEY = 'mic';

/**
 * 마이크 관련 핸들러 등록
 */
export const registerMicrophoneHandlers = (bridge: BridgeAPI, platform: PlatformInfo) => {
  moduleRegister({
    bridge,
    platform: { OS: platform.OS },
  });
};
