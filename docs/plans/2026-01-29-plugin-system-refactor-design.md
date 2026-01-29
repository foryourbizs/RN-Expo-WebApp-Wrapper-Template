# 플러그인 시스템 리팩토링 설계

## 개요

플러그인 추가 시 수정해야 하는 파일 수를 4개에서 2개로 줄여 유지보수성 개선.

## 현재 문제점

플러그인 추가 시 수정 필요한 파일:
1. `package.json` - 의존성 추가
2. `scripts/setup-plugins.js` - pluginsToSetup 배열에 추가
3. `lib/bridges/<plugin>/index.ts` - 래퍼 파일 생성
4. `lib/bridges/index.ts` - import + BUILTIN_NAMESPACES + register 호출 추가

## 개선 후

플러그인 추가 시 수정 필요한 파일:
1. `package.json` - 의존성 추가
2. `constants/plugins.config.ts` - 플러그인 설정 추가
3. `lib/bridges/plugin-registry.ts` - import 매핑 추가 (auto 플러그인만)

## 설계

### 1. 설정 파일 구조

```typescript
// constants/plugins.config.ts
import type { PluginsConfig } from '@/lib/plugin-system/types';

export const PLUGINS_CONFIG: PluginsConfig = {
  plugins: {
    // 외부 npm 패키지 플러그인
    auto: [
      { name: 'rnww-plugin-camera', namespace: 'cam', keepModules: ['customcamera'] },
      { name: 'rnww-plugin-microphone', namespace: 'mic', keepModules: ['custommicrophone'] },
      { name: 'rnww-plugin-screen-pinning', namespace: 'pin', keepModules: ['screenpinning'] },
      { name: 'rnww-plugin-background', namespace: 'bg', keepModules: ['custombackground'] },
      { name: 'rnww-plugin-gps', namespace: 'gps', keepModules: ['customgps'] },
      { name: 'rnww-plugin-wifi', namespace: 'wifi', keepModules: ['customwifi'] },
      { name: 'rnww-plugin-bluetooth', namespace: 'bt', keepModules: ['custombluetooth'] },
    ],
    // 로컬 구현 플러그인
    manual: [
      { path: './clipboard', namespace: 'clip' },
      { path: './device', namespace: 'device' },
      { path: './orientation', namespace: 'orient' },
      { path: './status-bar', namespace: 'sbar' },
      { path: './navigation-bar', namespace: 'nbar' },
      { path: './keep-awake', namespace: 'awake' },
      { path: './push', namespace: 'push' },
      { path: './update', namespace: 'update' },
      { path: './security', namespace: 'sec' },
      { path: './splash', namespace: 'splash' },
      { path: './ui', namespace: 'ui' },
      { path: './webview', namespace: 'webview' },
    ],
  },
};
```

### 2. 타입 정의

```typescript
// lib/plugin-system/types.ts

/** Auto 플러그인 (npm 패키지) */
export interface AutoPlugin {
  /** npm 패키지명 */
  name: string;
  /** 브릿지 네임스페이스 (예: 'cam' → 'cam:action') */
  namespace: string;
  /** 등록 메서드명 (기본: 'registerHandlers') */
  method?: string;
  /** 네이티브 빌드 시 유지할 모듈 폴더 */
  keepModules: string[];
}

/** Manual 플러그인 (로컬 구현) */
export interface ManualPlugin {
  /** lib/bridges 기준 상대 경로 */
  path: string;
  /** 브릿지 네임스페이스 */
  namespace: string;
  /** 엔트리 파일명 (기본: 'index.ts') */
  entry?: string;
  /** 등록 메서드명 (기본: 'register{Namespace}Handlers') */
  method?: string;
}

/** 플러그인 설정 */
export interface PluginsConfig {
  plugins: {
    auto: AutoPlugin[];
    manual: ManualPlugin[];
  };
}
```

### 3. 플러그인 레지스트리

```typescript
// lib/bridges/plugin-registry.ts

/** Auto 플러그인 매핑 (새 플러그인 추가 시 여기에 한 줄 추가) */
export const AUTO_PLUGINS = {
  'rnww-plugin-camera': () => import('rnww-plugin-camera'),
  'rnww-plugin-microphone': () => import('rnww-plugin-microphone'),
  'rnww-plugin-screen-pinning': () => import('rnww-plugin-screen-pinning'),
  'rnww-plugin-background': () => import('rnww-plugin-background'),
  'rnww-plugin-gps': () => import('rnww-plugin-gps'),
  'rnww-plugin-wifi': () => import('rnww-plugin-wifi'),
  'rnww-plugin-bluetooth': () => import('rnww-plugin-bluetooth'),
} as const;

/** Manual 플러그인 매핑 */
export const MANUAL_PLUGINS = {
  './clipboard': () => import('./clipboard'),
  './device': () => import('./device'),
  './orientation': () => import('./orientation'),
  './status-bar': () => import('./status-bar'),
  './navigation-bar': () => import('./navigation-bar'),
  './keep-awake': () => import('./keep-awake'),
  './push': () => import('./push'),
  './update': () => import('./update'),
  './security': () => import('./security'),
  './splash': () => import('./splash'),
  './ui': () => import('./ui'),
  './webview': () => import('./webview'),
} as const;
```

### 4. 플러그인 로더

```typescript
// lib/bridges/index.ts
import { Platform } from 'react-native';
import { PLUGINS_CONFIG } from '@/constants/plugins.config';
import { AUTO_PLUGINS, MANUAL_PLUGINS } from './plugin-registry';
import { createNamespacedBridge } from '@/lib/plugin-system';

export const registerBuiltInHandlers = async () => {
  const platform = { OS: Platform.OS as 'android' | 'ios' };

  // Auto 플러그인 로드
  for (const plugin of PLUGINS_CONFIG.plugins.auto) {
    const loader = AUTO_PLUGINS[plugin.name];
    if (!loader) continue;

    const mod = await loader();
    const method = plugin.method ?? 'registerHandlers';
    mod[method]({
      bridge: createNamespacedBridge(plugin.namespace),
      platform,
    });
  }

  // Manual 플러그인 로드
  for (const plugin of PLUGINS_CONFIG.plugins.manual) {
    const loader = MANUAL_PLUGINS[plugin.path];
    if (!loader) continue;

    const mod = await loader();
    const method = plugin.method ?? `register${toPascalCase(plugin.namespace)}Handlers`;
    mod[method](createNamespacedBridge(plugin.namespace), platform);
  }

  console.log('[Bridge] All plugins registered');
};
```

### 5. setup-plugins.js 개선

설정 파일(`constants/plugins.config.ts`)에서 auto 플러그인 정보를 읽어서 처리하도록 변경.
`pluginsToSetup` 하드코딩 배열 제거.

## 기본값 정리

| 항목 | 기본값 |
|------|--------|
| `auto.method` | `registerHandlers` |
| `manual.entry` | `index.ts` |
| `manual.method` | `register{PascalCase(namespace)}Handlers` |

## 마이그레이션

1. 타입 정의 파일 생성 (`lib/plugin-system/types.ts`)
2. 설정 파일 생성 (`constants/plugins.config.ts`)
3. 레지스트리 파일 생성 (`lib/bridges/plugin-registry.ts`)
4. `lib/bridges/index.ts` 리팩토링
5. `scripts/setup-plugins.js` 리팩토링
6. 기존 개별 래퍼 파일들 정리 (auto 플러그인용)
