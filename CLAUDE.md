# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React Native + Expo template for wrapping web applications as native mobile apps. Provides bidirectional Web-to-App communication via a bridge system.

**Note:** Code comments are written in Korean.

## Commands

```bash
# Development
npx expo start              # Start dev server
npx expo run:android        # Run on Android
npx expo run:ios            # Run on iOS

# Linting
npm run lint                # Run ESLint

# Build (Windows)
.\build.bat                 # Interactive build script

# Build (Manual)
npx expo prebuild --clean
cd android && .\gradlew assembleRelease

# EAS Cloud Build
npx eas build --platform android --profile preview

# Plugin setup (runs automatically on npm install)
node scripts/setup-plugins.js
```

## Architecture

### Bridge System (Web <-> App Communication)

The core of this template is the bidirectional bridge between WebView and React Native:

```
Web -> App: app://actionName   (AppBridge.send/call -> registerHandler)
App -> Web: native://actionName (sendToWeb -> AppBridge.on/once/waitFor)
```

**Key files:**
- `lib/bridge.ts` - Native side: message handling, handler registration, `sendToWeb()`
- `lib/bridge-client.ts` - Web side: `AppBridge` object injected into WebView
- `lib/bridges/index.ts` - Registers all built-in handlers via `registerBuiltInHandlers()`

**Security:** Messages include a runtime-generated security token to prevent external injection attacks.

### Adding a New Bridge Handler

1. Create handler file in `lib/bridges/<feature>/index.ts`:
```typescript
import { registerHandler, sendToWeb } from '@/lib/bridge';

export const registerMyHandlers = () => {
  registerHandler<PayloadType>('myAction', async (payload, respond) => {
    // Handle the action
    respond({ success: true, data: result });
  });
};
```

2. Register in `lib/bridges/index.ts`:
```typescript
import { registerMyHandlers } from './my-feature';

export const registerBuiltInHandlers = () => {
  // ... existing handlers
  registerMyHandlers();
};
```

### Handler Options
- `timeout?: number` - Auto-error response if no response within timeout
- `once?: boolean` - Handler auto-unregisters after first call

### Configuration

All app configuration is centralized in `constants/app-config.ts`:
- `webview.baseUrl` - Target web application URL
- `webview.allowedUrlPatterns` - URL whitelist (wildcards supported: `https://*.example.com`)
- `statusBar`, `navigationBar` - System UI configuration
- `splash` - Splash screen settings
- `offline` - Offline screen settings
- `debug` - Debug overlay settings

### State Management

Uses Zustand with modular extension pattern:
- `stores/use-app-store.ts` - Main store with webview and app state
- Selectors: `useWebviewState()`, `useAppState()` for optimized re-renders
- Module extension: `registerModule()` for adding custom state slices

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

### Component Structure

- `app/_layout.tsx` - Root layout with splash screen orchestration, exports `hideSplashScreen()`
- `app/index.tsx` - Main screen rendering WebViewContainer
- `components/webview-container.tsx` - WebView with bridge integration, error handling, auto-recovery
- `components/custom-splash.tsx` - Animated splash screen
- `components/offline-screen.tsx` - Offline state UI
- `components/debug-overlay.tsx` - Debug log overlay (enabled via `APP_CONFIG.debug.enabled`)

### WebView Features

- URL filtering with wildcard patterns
- Android hardware back button handling
- Empty body auto-recovery (reload/cache clear)
- Render process crash recovery
- Loading timeout handling
