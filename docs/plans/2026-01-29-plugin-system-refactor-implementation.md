# Plugin System Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 플러그인 추가 시 수정 파일을 4개에서 2개로 줄여 유지보수성 개선

**Architecture:** 설정 파일(`constants/plugins.config.ts`)을 Single Source of Truth로 사용. 플러그인 레지스트리에서 동적 import 매핑을 관리하고, `lib/bridges/index.ts`에서 설정 기반으로 플러그인 로드.

**Tech Stack:** TypeScript, React Native, Expo

---

### Task 1: 플러그인 설정 타입 추가

**Files:**
- Modify: `lib/plugin-system/types.ts`

**Step 1: types.ts에 설정 타입 추가**

`lib/plugin-system/types.ts` 파일 끝에 다음 타입 추가:

```typescript
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
  /** 네이티브 빌드 시 유지할 모듈 폴더 */
  keepModules: string[];
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
```

**Step 2: index.ts에 export 확인**

`lib/plugin-system/index.ts`에서 이미 `export * from './types'`가 있으므로 추가 작업 불필요.

**Step 3: 커밋**

```bash
git add lib/plugin-system/types.ts
git commit -m "feat(plugin-system): add plugin config types

- AutoPluginConfig for npm package plugins
- ManualPluginConfig for local implementations
- PluginsConfig for centralized configuration"
```

---

### Task 2: 플러그인 설정 파일 생성

**Files:**
- Create: `constants/plugins.config.ts`

**Step 1: 설정 파일 생성**

```typescript
// constants/plugins.config.ts
/**
 * 플러그인 설정 파일
 * - auto: npm 패키지 플러그인 (외부 의존성)
 * - manual: 로컬 구현 플러그인 (lib/bridges 내)
 */

import type { PluginsConfig } from '@/lib/plugin-system';

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

**Step 2: 커밋**

```bash
git add constants/plugins.config.ts
git commit -m "feat(config): add centralized plugins configuration

Single source of truth for plugin registration:
- 7 auto plugins (npm packages)
- 12 manual plugins (local implementations)"
```

---

### Task 3: 유틸리티 함수 추가

**Files:**
- Modify: `lib/plugin-system/index.ts`

**Step 1: toPascalCase 유틸리티 추가**

`lib/plugin-system/index.ts` 파일에 추가:

```typescript
/**
 * 문자열을 PascalCase로 변환
 * @example 'clip' → 'Clip', 'status-bar' → 'StatusBar'
 */
export const toPascalCase = (str: string): string => {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};
```

**Step 2: 커밋**

```bash
git add lib/plugin-system/index.ts
git commit -m "feat(plugin-system): add toPascalCase utility"
```

---

### Task 4: 플러그인 레지스트리 생성

**Files:**
- Create: `lib/bridges/plugin-registry.ts`

**Step 1: 레지스트리 파일 생성**

```typescript
// lib/bridges/plugin-registry.ts
/**
 * 플러그인 레지스트리
 * - 동적 import를 위한 매핑 객체
 * - Metro 번들러 호환을 위해 정적 경로 사용
 */

/** Auto 플러그인 매핑 (npm 패키지) */
export const AUTO_PLUGINS: Record<string, () => Promise<any>> = {
  'rnww-plugin-camera': () => import('rnww-plugin-camera'),
  'rnww-plugin-microphone': () => import('rnww-plugin-microphone'),
  'rnww-plugin-screen-pinning': () => import('rnww-plugin-screen-pinning'),
  'rnww-plugin-background': () => import('rnww-plugin-background'),
  'rnww-plugin-gps': () => import('rnww-plugin-gps'),
  'rnww-plugin-wifi': () => import('rnww-plugin-wifi'),
  'rnww-plugin-bluetooth': () => import('rnww-plugin-bluetooth'),
};

/** Manual 플러그인 매핑 (로컬 구현) */
export const MANUAL_PLUGINS: Record<string, () => Promise<any>> = {
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
};
```

**Step 2: 커밋**

```bash
git add lib/bridges/plugin-registry.ts
git commit -m "feat(bridges): add plugin registry for dynamic imports

Maps plugin names to lazy import functions for Metro bundler compatibility"
```

---

### Task 5: lib/bridges/index.ts 리팩토링

**Files:**
- Modify: `lib/bridges/index.ts`

**Step 1: index.ts 전체 교체**

기존 파일을 다음으로 교체:

```typescript
/**
 * Bridge Handlers 통합 모듈
 * 설정 파일 기반으로 플러그인 동적 로드
 */

import { Platform } from 'react-native';
import { registerHandler, sendToWeb } from '@/lib/bridge';
import { BridgeAPI, PlatformInfo, toPascalCase } from '@/lib/plugin-system';
import { PLUGINS_CONFIG } from '@/constants/plugins.config';
import { AUTO_PLUGINS, MANUAL_PLUGINS } from './plugin-registry';

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

      registerFn({
        bridge: createNamespacedBridge(plugin.namespace),
        platform,
      });
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
```

**Step 2: 커밋**

```bash
git add lib/bridges/index.ts
git commit -m "refactor(bridges): config-based plugin loading

- Load plugins dynamically from PLUGINS_CONFIG
- Separate auto (npm) and manual (local) plugin loading
- Add error handling and logging
- Keep BUILTIN_NAMESPACES for backwards compatibility (deprecated)"
```

---

### Task 6: setup-plugins.js 리팩토링

**Files:**
- Modify: `scripts/setup-plugins.js`

**Step 1: setup-plugins.js 전체 교체**

```javascript
const fs = require('fs');
const path = require('path');

/**
 * TypeScript 설정 파일에서 auto 플러그인 정보 추출
 * (간단한 정규식 파싱)
 */
const parsePluginsConfig = (configPath) => {
  const content = fs.readFileSync(configPath, 'utf-8');

  // auto 배열 추출
  const autoMatch = content.match(/auto:\s*\[([\s\S]*?)\]/);
  if (!autoMatch) return [];

  const autoContent = autoMatch[1];
  const plugins = [];

  // 각 플러그인 객체 파싱
  const pluginRegex = /{\s*name:\s*['"]([^'"]+)['"]\s*,\s*namespace:\s*['"][^'"]+['"]\s*,\s*keepModules:\s*\[([^\]]*)\]/g;
  let match;

  while ((match = pluginRegex.exec(autoContent)) !== null) {
    const name = match[1];
    const keepModulesStr = match[2];
    const keepModules = keepModulesStr
      .split(',')
      .map(s => s.trim().replace(/['"]/g, ''))
      .filter(s => s.length > 0);

    plugins.push({ name, keepModules });
  }

  return plugins;
};

// 설정 파일에서 플러그인 정보 로드
const configPath = path.join(__dirname, '..', 'constants', 'plugins.config.ts');
let pluginsToSetup = [];

if (fs.existsSync(configPath)) {
  pluginsToSetup = parsePluginsConfig(configPath);
  console.log(`📋 Loaded ${pluginsToSetup.length} plugins from config`);
} else {
  console.log('⚠️  plugins.config.ts not found, using fallback');
  // 폴백: 기존 하드코딩 목록 (마이그레이션 중 사용)
  pluginsToSetup = [
    { name: 'rnww-plugin-camera', keepModules: ['customcamera'] },
    { name: 'rnww-plugin-microphone', keepModules: ['custommicrophone'] },
    { name: 'rnww-plugin-screen-pinning', keepModules: ['screenpinning'] },
    { name: 'rnww-plugin-background', keepModules: ['custombackground'] },
    { name: 'rnww-plugin-gps', keepModules: ['customgps'] },
    { name: 'rnww-plugin-wifi', keepModules: ['customwifi'] },
    { name: 'rnww-plugin-bluetooth', keepModules: ['custombluetooth'] },
  ];
}

console.log('🔧 Setting up Expo plugins for autolinking...');

pluginsToSetup.forEach(plugin => {
  const pluginPath = path.join(__dirname, '..', 'node_modules', plugin.name);

  if (!fs.existsSync(pluginPath)) {
    console.log(`⚠️  ${plugin.name} not found, skipping...`);
    return;
  }

  // expo-module.config.json 복사
  const configSource = path.join(pluginPath, 'src', 'modules', 'expo-module.config.json');
  const configDest = path.join(pluginPath, 'expo-module.config.json');

  if (fs.existsSync(configSource)) {
    fs.copyFileSync(configSource, configDest);
    console.log(`✅ ${plugin.name}: expo-module.config.json copied`);
  }

  // android 폴더 복사
  const androidSource = path.join(pluginPath, 'src', 'modules', 'android');
  const androidDest = path.join(pluginPath, 'android');

  if (fs.existsSync(androidSource)) {
    if (fs.existsSync(androidDest)) {
      fs.rmSync(androidDest, { recursive: true, force: true });
    }
    fs.cpSync(androidSource, androidDest, { recursive: true });

    // keepModules 외 폴더 제거
    const javaModulesPath = path.join(androidDest, 'src', 'main', 'java', 'expo', 'modules');
    if (fs.existsSync(javaModulesPath)) {
      const folders = fs.readdirSync(javaModulesPath);
      folders.forEach(folder => {
        if (!plugin.keepModules.includes(folder)) {
          const folderPath = path.join(javaModulesPath, folder);
          if (fs.statSync(folderPath).isDirectory()) {
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log(`   🧹 Removed invalid folder: ${folder}`);
          }
        }
      });
    }

    console.log(`✅ ${plugin.name}: android folder copied`);
  }

  // ios 폴더 복사
  const iosSource = path.join(pluginPath, 'src', 'modules', 'ios');
  const iosDest = path.join(pluginPath, 'ios');

  if (fs.existsSync(iosSource)) {
    if (fs.existsSync(iosDest)) {
      fs.rmSync(iosDest, { recursive: true, force: true });
    }
    fs.cpSync(iosSource, iosDest, { recursive: true });
    console.log(`✅ ${plugin.name}: ios folder copied`);
  }
});

console.log('✨ Plugin setup complete!');
```

**Step 2: 커밋**

```bash
git add scripts/setup-plugins.js
git commit -m "refactor(scripts): read plugin config from plugins.config.ts

- Parse auto plugins from centralized config
- Fallback to hardcoded list if config not found
- Eliminates duplicate plugin definitions"
```

---

### Task 7: Auto 플러그인 래퍼 파일 제거

**Files:**
- Delete: `lib/bridges/camera/index.ts`
- Delete: `lib/bridges/microphone/index.ts`
- Delete: `lib/bridges/screen-pinning/index.ts`
- Delete: `lib/bridges/background/index.ts`
- Delete: `lib/bridges/gps/index.ts`
- Delete: `lib/bridges/wifi/index.ts`
- Delete: `lib/bridges/bluetooth/index.ts`

**Step 1: 래퍼 파일들 삭제**

Auto 플러그인은 이제 직접 import되므로 래퍼 파일 불필요.

Windows:
```powershell
Remove-Item -Recurse -Force lib/bridges/camera
Remove-Item -Recurse -Force lib/bridges/microphone
Remove-Item -Recurse -Force lib/bridges/screen-pinning
Remove-Item -Recurse -Force lib/bridges/background
Remove-Item -Recurse -Force lib/bridges/gps
Remove-Item -Recurse -Force lib/bridges/wifi
Remove-Item -Recurse -Force lib/bridges/bluetooth
```

**Step 2: 커밋**

```bash
git add -A
git commit -m "refactor(bridges): remove auto plugin wrapper files

Wrapper files no longer needed - plugins loaded directly from npm packages"
```

---

### Task 8: 빌드 테스트

**Step 1: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

**Step 2: Lint 체크**

```bash
npm run lint
```

Expected: 에러 없음

**Step 3: 플러그인 셋업 테스트**

```bash
node scripts/setup-plugins.js
```

Expected:
```
📋 Loaded 7 plugins from config
🔧 Setting up Expo plugins for autolinking...
✅ rnww-plugin-camera: ...
...
✨ Plugin setup complete!
```

**Step 4: 커밋 (필요시)**

```bash
git commit --allow-empty -m "test: verify plugin system refactor builds successfully"
```

---

### Task 9: 문서 업데이트

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Plugin System 섹션 업데이트**

CLAUDE.md의 Plugin System 섹션을 다음으로 교체:

```markdown
### Plugin System

플러그인은 `constants/plugins.config.ts`에서 중앙 관리됩니다:

**새 Auto 플러그인 추가 시 (npm 패키지):**
1. `package.json`에 의존성 추가
2. `constants/plugins.config.ts`의 `auto` 배열에 추가
3. `lib/bridges/plugin-registry.ts`의 `AUTO_PLUGINS`에 import 추가

**새 Manual 플러그인 추가 시 (로컬 구현):**
1. `lib/bridges/<plugin>/index.ts` 생성
2. `constants/plugins.config.ts`의 `manual` 배열에 추가
3. `lib/bridges/plugin-registry.ts`의 `MANUAL_PLUGINS`에 import 추가

**설정 구조:**
```typescript
// constants/plugins.config.ts
export const PLUGINS_CONFIG: PluginsConfig = {
  plugins: {
    auto: [
      { name: 'rnww-plugin-camera', namespace: 'cam', keepModules: ['customcamera'] },
    ],
    manual: [
      { path: './clipboard', namespace: 'clip' },
    ],
  },
};
```

- `auto.method`: 등록 메서드명 (기본: `registerHandlers`)
- `manual.entry`: 엔트리 파일명 (기본: `index.ts`)
- `manual.method`: 등록 메서드명 (기본: `register{PascalCase(namespace)}Handlers`)
```

**Step 2: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs: update plugin system documentation"
```

---

### Task 10: 최종 검증 및 정리

**Step 1: 전체 테스트**

```bash
npm run lint
npx tsc --noEmit
```

**Step 2: Git 상태 확인**

```bash
git status
git log --oneline -10
```

**Step 3: 최종 커밋 (필요시)**

```bash
git add -A
git commit -m "chore: cleanup after plugin system refactor"
```
