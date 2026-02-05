/**
 * Bridge Handlers 통합 모듈
 * 설정 파일 기반으로 플러그인 동적 로드
 */

import { Platform } from 'react-native';
import { registerHandler, sendToWeb, BridgeExtension, getSecurityToken } from '@/lib/bridge';
import { getBridgeClientScript } from '@/lib/bridge-client';
import { BridgeAPI, PlatformInfo, PluginMeta, toPascalCase } from '@/lib/plugin-system';
import { PLUGINS_CONFIG } from '@/constants/plugins.config';
import { AUTO_PLUGINS, MANUAL_PLUGINS } from './plugin-registry';

/** 로드된 플러그인 메타데이터 저장 */
const loadedPluginMeta: Map<string, PluginMeta> = new Map();

/**
 * 네임스페이스가 적용된 BridgeAPI 생성
 */
const createNamespacedBridge = (namespace: string): BridgeAPI => ({
  registerHandler: (action, handler, options) =>
    registerHandler(`${namespace}:${action}`, handler, options),
  sendToWeb: (action, payload) =>
    sendToWeb(`${namespace}:${action}`, payload),
});

/**
 * Auto 플러그인 로드 (npm 패키지)
 */
const loadAutoPlugins = async (platform: PlatformInfo) => {
  for (const plugin of PLUGINS_CONFIG.plugins.auto) {
    const loader = AUTO_PLUGINS[plugin.name];
    if (!loader) {
      console.warn(`[Bridge] Auto plugin not found in registry: ${plugin.name}`);
      continue;
    }

    try {
      const mod = await loader();
      const method = plugin.method ?? 'registerHandlers';
      const registerFn = mod[method];

      if (typeof registerFn !== 'function') {
        console.warn(`[Bridge] Method '${method}' not found in ${plugin.name}`);
        continue;
      }

      // 플러그인 설정 객체 구성
      const config: Record<string, unknown> = {
        bridge: createNamespacedBridge(plugin.namespace),
        platform,
      };

      // background 플러그인 옵션 처리: Headless Bridge 연동
      if (plugin.options?.background?.enableHeadlessBridge) {
        config.bridgeExtension = BridgeExtension;
        config.bridgeClientScript = getBridgeClientScript(getSecurityToken());
        console.log(`[Bridge] Headless Bridge enabled for: ${plugin.name}`);
      }

      registerFn(config);
      console.log(`[Bridge] Auto plugin loaded: ${plugin.name} (${plugin.namespace})`);
    } catch (error) {
      console.error(`[Bridge] Failed to load auto plugin ${plugin.name}:`, error);
    }
  }
};

/**
 * Manual 플러그인 로드 (로컬 구현)
 */
const loadManualPlugins = async (platform: PlatformInfo) => {
  for (const plugin of PLUGINS_CONFIG.plugins.manual) {
    const loader = MANUAL_PLUGINS[plugin.path];
    if (!loader) {
      console.warn(`[Bridge] Manual plugin not found in registry: ${plugin.path}`);
      continue;
    }

    try {
      const mod = await loader();
      const method = plugin.method ?? `register${toPascalCase(plugin.namespace)}Handlers`;
      const registerFn = mod[method];

      if (typeof registerFn !== 'function') {
        console.warn(`[Bridge] Method '${method}' not found in ${plugin.path}`);
        continue;
      }

      registerFn(createNamespacedBridge(plugin.namespace), platform);
      console.log(`[Bridge] Manual plugin loaded: ${plugin.path} (${plugin.namespace})`);
    } catch (error) {
      console.error(`[Bridge] Failed to load manual plugin ${plugin.path}:`, error);
    }
  }
};

/**
 * 모든 플러그인 등록
 */
export const registerBuiltInHandlers = async () => {
  const platform: PlatformInfo = { OS: Platform.OS as 'android' | 'ios' };

  await Promise.all([
    loadAutoPlugins(platform),
    loadManualPlugins(platform),
  ]);

  console.log('[Bridge] All plugins registered');
};

// 기존 호환성을 위해 BUILTIN_NAMESPACES 유지 (deprecated)
/** @deprecated Use PLUGINS_CONFIG instead */
export const BUILTIN_NAMESPACES = Object.fromEntries(
  [
    ...PLUGINS_CONFIG.plugins.auto.map(p => [p.name.replace('rnww-plugin-', ''), p.namespace]),
    ...PLUGINS_CONFIG.plugins.manual.map(p => [p.path.replace('./', ''), p.namespace]),
  ]
) as Record<string, string>;

export type BuiltinNamespace = string;
