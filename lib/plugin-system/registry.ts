// lib/plugin-system/registry.ts
import { RNWWPlugin, BridgeAPI, PlatformInfo } from './types';
import { validatePlugin } from './validation';

/**
 * 플러그인 레지스트리
 * 모든 플러그인을 관리하고 초기화
 */
export class PluginRegistry {
  private plugins: Map<string, RNWWPlugin> = new Map();
  private initialized: boolean = false;

  /**
   * 플러그인 등록
   */
  register(plugin: RNWWPlugin): void {
    // 유효성 검증
    validatePlugin(plugin);

    // 중복 검사
    if (this.plugins.has(plugin.key)) {
      throw new Error(`Plugin with key '${plugin.key}' is already registered`);
    }

    this.plugins.set(plugin.key, plugin);
    console.log(`[PluginRegistry] Registered: ${plugin.name} (${plugin.key})`);
  }

  /**
   * 플러그인 존재 여부 확인
   */
  has(key: string): boolean {
    return this.plugins.has(key);
  }

  /**
   * 플러그인 가져오기
   */
  get(key: string): RNWWPlugin | undefined {
    return this.plugins.get(key);
  }

  /**
   * 모든 플러그인 가져오기
   */
  getAll(): RNWWPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 모든 플러그인 초기화
   */
  async initialize(bridge: BridgeAPI, platform: PlatformInfo): Promise<void> {
    if (this.initialized) {
      console.warn('[PluginRegistry] Already initialized');
      return;
    }

    for (const plugin of this.plugins.values()) {
      // 플랫폼 지원 확인
      if (!plugin.platform.includes(platform.OS as 'android' | 'ios')) {
        console.log(`[PluginRegistry] Skipping ${plugin.name} (not supported on ${platform.OS})`);
        continue;
      }

      try {
        // 핸들러 등록
        plugin.registerHandlers(bridge, platform);

        // onInit 호출 (있으면)
        if (plugin.onInit) {
          await plugin.onInit();
        }

        console.log(`[PluginRegistry] Initialized: ${plugin.name}`);
      } catch (error) {
        console.error(`[PluginRegistry] Failed to initialize ${plugin.name}:`, error);
      }
    }

    this.initialized = true;
  }

  /**
   * 모든 플러그인 정리
   */
  destroy(): void {
    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.onDestroy) {
          plugin.onDestroy();
        }
      } catch (error) {
        console.error(`[PluginRegistry] Error destroying ${plugin.name}:`, error);
      }
    }

    this.plugins.clear();
    this.initialized = false;
    console.log('[PluginRegistry] Destroyed all plugins');
  }
}
