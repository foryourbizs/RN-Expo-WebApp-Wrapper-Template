# Preview Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a real-time app preview panel to the config editor that shows how settings will appear on a phone mockup.

**Architecture:** Create a PreviewContext for managing preview state (screen, orientation, device size, settings). Modify Accordion to support controlled mode and emit open events. Add a PreviewPanel component with phone mockup that renders different screen previews (Splash, WebView, Offline, Theme) based on active accordion section.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, react-i18next

---

## Task 1: Create PreviewContext

**Files:**
- Create: `tools/config-editor/client/src/contexts/PreviewContext.tsx`

**Step 1: Create the context file**

```typescript
// tools/config-editor/client/src/contexts/PreviewContext.tsx
import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';

export type PreviewScreen = 'splash' | 'webview' | 'offline' | 'theme';
export type Orientation = 'portrait' | 'landscape';
export type DeviceSize = 'small' | 'phone' | 'large' | 'tablet';
export type HighlightTarget = 'statusBar' | 'navBar' | null;

interface PreviewSettings {
  loadIframe: boolean;
  showStatusBar: boolean;
  showNavBar: boolean;
}

interface PreviewState {
  currentScreen: PreviewScreen;
  orientation: Orientation;
  deviceSize: DeviceSize;
  themeMode: 'light' | 'dark';
  settings: PreviewSettings;
  highlightTarget: HighlightTarget;
  isFullscreen: boolean;
}

interface PreviewContextValue extends PreviewState {
  setCurrentScreen: (screen: PreviewScreen) => void;
  setOrientation: (orientation: Orientation) => void;
  toggleOrientation: () => void;
  setDeviceSize: (size: DeviceSize) => void;
  setThemeMode: (mode: 'light' | 'dark') => void;
  toggleThemeMode: () => void;
  updateSettings: (settings: Partial<PreviewSettings>) => void;
  setHighlightTarget: (target: HighlightTarget) => void;
  setIsFullscreen: (isFullscreen: boolean) => void;
}

const defaultSettings: PreviewSettings = {
  loadIframe: false,
  showStatusBar: true,
  showNavBar: true,
};

const PreviewContext = createContext<PreviewContextValue | null>(null);

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [currentScreen, setCurrentScreen] = useState<PreviewScreen>('webview');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [deviceSize, setDeviceSize] = useState<DeviceSize>('phone');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [settings, setSettings] = useState<PreviewSettings>(defaultSettings);
  const [highlightTarget, setHighlightTarget] = useState<HighlightTarget>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleOrientation = useCallback(() => {
    setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
  }, []);

  const toggleThemeMode = useCallback(() => {
    setThemeMode(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const updateSettings = useCallback((newSettings: Partial<PreviewSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const value = useMemo(() => ({
    currentScreen,
    orientation,
    deviceSize,
    themeMode,
    settings,
    highlightTarget,
    isFullscreen,
    setCurrentScreen,
    setOrientation,
    toggleOrientation,
    setDeviceSize,
    setThemeMode,
    toggleThemeMode,
    updateSettings,
    setHighlightTarget,
    setIsFullscreen,
  }), [
    currentScreen, orientation, deviceSize, themeMode, settings,
    highlightTarget, isFullscreen, toggleOrientation, toggleThemeMode, updateSettings
  ]);

  return (
    <PreviewContext.Provider value={value}>
      {children}
    </PreviewContext.Provider>
  );
}

export function usePreview() {
  const context = useContext(PreviewContext);
  if (!context) {
    throw new Error('usePreview must be used within PreviewProvider');
  }
  return context;
}
```

**Step 2: Verify file created**

Run: `dir tools\config-editor\client\src\contexts`
Expected: Shows `PreviewContext.tsx`

**Step 3: Commit**

```bash
git add tools/config-editor/client/src/contexts/PreviewContext.tsx
git commit -m "feat(config-editor): add PreviewContext for preview panel state"
```

---

## Task 2: Modify Accordion to support controlled mode

**Files:**
- Modify: `tools/config-editor/client/src/components/form/Accordion.tsx`

**Step 1: Add controlled mode and onToggle callback**

Replace the entire file content with:

```typescript
import { useState, useEffect, ReactNode } from 'react';

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Controlled mode: external open state */
  isOpen?: boolean;
  /** Callback when accordion is toggled */
  onToggle?: (isOpen: boolean) => void;
  /** Unique identifier for tracking */
  sectionId?: string;
}

export default function Accordion({
  title,
  children,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle,
  sectionId,
}: AccordionProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);

  // 제어 모드 여부 확인
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  // 제어 모드에서 외부 값이 변경되면 내부 상태도 동기화
  useEffect(() => {
    if (isControlled) {
      setInternalIsOpen(controlledIsOpen);
    }
  }, [isControlled, controlledIsOpen]);

  const handleToggle = () => {
    const newState = !isOpen;

    if (!isControlled) {
      setInternalIsOpen(newState);
    }

    onToggle?.(newState);
  };

  return (
    <div className="border border-slate-200 rounded-lg mb-3 overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        data-section-id={sectionId}
        className={`
          w-full px-4 py-2.5 flex items-center justify-between text-left
          ${isOpen ? 'bg-slate-100 border-b border-slate-200' : 'bg-slate-50 hover:bg-slate-100'}
          transition-colors
        `}
      >
        <span className="font-medium text-sm text-slate-700">{title}</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-white">{children}</div>
      )}
    </div>
  );
}
```

**Step 2: Verify existing usages still work**

Run: `cd tools/config-editor/client && npm run build`
Expected: Build succeeds (backward compatible - existing usages without new props work)

**Step 3: Commit**

```bash
git add tools/config-editor/client/src/components/form/Accordion.tsx
git commit -m "feat(config-editor): add controlled mode and onToggle to Accordion"
```

---

## Task 3: Create device size constants

**Files:**
- Create: `tools/config-editor/client/src/constants/devices.ts`

**Step 1: Create device constants file**

```typescript
// tools/config-editor/client/src/constants/devices.ts

export const DEVICE_SIZES = {
  small: { width: 320, height: 568, label: 'Small Phone' },
  phone: { width: 375, height: 812, label: 'Phone' },
  large: { width: 428, height: 926, label: 'Large Phone' },
  tablet: { width: 768, height: 1024, label: 'Tablet' },
} as const;

export type DeviceSizeKey = keyof typeof DEVICE_SIZES;

// 미리보기 패널에서 사용할 스케일 계산
export function calculateScale(
  deviceWidth: number,
  deviceHeight: number,
  containerWidth: number,
  containerHeight: number,
  orientation: 'portrait' | 'landscape'
): number {
  const actualWidth = orientation === 'portrait' ? deviceWidth : deviceHeight;
  const actualHeight = orientation === 'portrait' ? deviceHeight : deviceWidth;

  const scaleX = containerWidth / actualWidth;
  const scaleY = containerHeight / actualHeight;

  return Math.min(scaleX, scaleY, 1); // 최대 1배 (확대 방지)
}

// 섹션 ID와 미리보기 화면 매핑
export const SECTION_TO_SCREEN_MAP: Record<string, 'splash' | 'webview' | 'offline' | 'theme'> = {
  webview: 'webview',
  'webview-options': 'webview',
  'webview-performance': 'webview',
  offline: 'offline',
  statusBar: 'webview',
  navigationBar: 'webview',
  safeArea: 'webview',
  theme: 'webview',
  splash: 'splash',
  security: 'webview',
  debug: 'webview',
};

// 강조 표시할 섹션
export const HIGHLIGHT_SECTIONS: Record<string, 'statusBar' | 'navBar'> = {
  statusBar: 'statusBar',
  navigationBar: 'navBar',
};
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/constants/devices.ts
git commit -m "feat(config-editor): add device size constants and section mapping"
```

---

## Task 4: Create PhoneMockup component

**Files:**
- Create: `tools/config-editor/client/src/components/preview/PhoneMockup.tsx`

**Step 1: Create directory and PhoneMockup component**

```typescript
// tools/config-editor/client/src/components/preview/PhoneMockup.tsx
import { ReactNode, useMemo } from 'react';
import { usePreview } from '../../contexts/PreviewContext';
import { DEVICE_SIZES } from '../../constants/devices';
import type { AppConfig } from '../../types/config';

interface PhoneMockupProps {
  children: ReactNode;
  appConfig: AppConfig | null;
}

export default function PhoneMockup({ children, appConfig }: PhoneMockupProps) {
  const { orientation, deviceSize, settings, highlightTarget, themeMode } = usePreview();

  const device = DEVICE_SIZES[deviceSize];
  const isLandscape = orientation === 'landscape';

  const frameWidth = isLandscape ? device.height : device.width;
  const frameHeight = isLandscape ? device.width : device.height;

  // Status Bar 설정
  const statusBarConfig = appConfig?.statusBar;
  const showStatusBar = settings.showStatusBar && (statusBarConfig?.visible !== false);
  const statusBarStyle = statusBarConfig?.style || 'dark';
  const statusBarOverlay = statusBarConfig?.overlayColor || 'transparent';

  // Navigation Bar 설정
  const navBarConfig = appConfig?.navigationBar;
  const showNavBar = settings.showNavBar && (navBarConfig?.visibility !== 'hidden');
  const navBarBgColor = themeMode === 'dark'
    ? (navBarConfig?.darkBackgroundColor || '#000000')
    : (navBarConfig?.backgroundColor || '#ffffff');
  const navBarButtonStyle = navBarConfig?.buttonStyle || 'dark';

  // 강조 스타일
  const highlightClass = 'ring-2 ring-blue-400 ring-offset-1 animate-pulse';

  const frameStyle = useMemo(() => ({
    width: `${frameWidth}px`,
    height: `${frameHeight}px`,
    transform: isLandscape ? 'rotate(0deg)' : 'rotate(0deg)',
    transition: 'width 200ms, height 200ms',
  }), [frameWidth, frameHeight, isLandscape]);

  return (
    <div
      className="relative bg-slate-900 rounded-[40px] border-2 border-slate-700 shadow-xl overflow-hidden"
      style={frameStyle}
    >
      {/* Status Bar */}
      {showStatusBar && (
        <div
          className={`
            absolute top-0 left-0 right-0 h-11 z-10 flex items-center justify-between px-6
            ${highlightTarget === 'statusBar' ? highlightClass : ''}
          `}
          style={{ backgroundColor: statusBarOverlay }}
        >
          <span className={`text-xs font-medium ${statusBarStyle === 'light' ? 'text-white' : 'text-black'}`}>
            9:41
          </span>
          <div className={`flex items-center gap-1 ${statusBarStyle === 'light' ? 'text-white' : 'text-black'}`}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v18l-8-9 8-9z" />
            </svg>
            <span className="text-xs">100%</span>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 17h20v2H2v-2zm0-4h20v2H2v-2zm0-4h20v2H2V9zm0-4h20v2H2V5z" />
            </svg>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          top: showStatusBar ? '44px' : 0,
          bottom: showNavBar ? '34px' : 0,
        }}
      >
        {children}
      </div>

      {/* Navigation Bar */}
      {showNavBar && (
        <div
          className={`
            absolute bottom-0 left-0 right-0 h-[34px] flex items-center justify-center gap-16
            ${highlightTarget === 'navBar' ? highlightClass : ''}
          `}
          style={{ backgroundColor: navBarBgColor }}
        >
          <button className={`text-lg ${navBarButtonStyle === 'light' ? 'text-white' : 'text-black'}`}>◀</button>
          <button className={`text-lg ${navBarButtonStyle === 'light' ? 'text-white' : 'text-black'}`}>●</button>
          <button className={`text-lg ${navBarButtonStyle === 'light' ? 'text-white' : 'text-black'}`}>▢</button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/components/preview/PhoneMockup.tsx
git commit -m "feat(config-editor): add PhoneMockup component with status/nav bars"
```

---

## Task 5: Create SplashPreview component

**Files:**
- Create: `tools/config-editor/client/src/components/preview/screens/SplashPreview.tsx`

**Step 1: Create SplashPreview**

```typescript
// tools/config-editor/client/src/components/preview/screens/SplashPreview.tsx
import { usePreview } from '../../../contexts/PreviewContext';
import type { AppConfig, ThemeConfig } from '../../../types/config';

interface SplashPreviewProps {
  appConfig: AppConfig | null;
  themeConfig: ThemeConfig | null;
}

export default function SplashPreview({ appConfig, themeConfig }: SplashPreviewProps) {
  const { themeMode } = usePreview();

  const splash = appConfig?.splash;
  const theme = appConfig?.theme;

  const backgroundColor = themeMode === 'dark'
    ? (splash?.darkBackgroundColor || '#000000')
    : (splash?.backgroundColor || '#ffffff');

  const indicatorColor = theme?.loadingIndicatorColor || '#007AFF';
  const loadingText = splash?.loadingText || '';
  const showIndicator = splash?.showLoadingIndicator !== false;
  const logoImage = splash?.logoImage;

  const textColor = themeMode === 'dark' ? '#ffffff' : '#000000';

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center"
      style={{ backgroundColor }}
    >
      {/* Logo */}
      {logoImage ? (
        <img
          src={logoImage}
          alt="App Logo"
          className="w-24 h-24 object-contain mb-4"
          onError={(e) => {
            // 이미지 로드 실패 시 기본 아이콘 표시
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div
          className="w-24 h-24 rounded-2xl mb-4 flex items-center justify-center"
          style={{ backgroundColor: indicatorColor }}
        >
          <span className="text-white text-3xl font-bold">A</span>
        </div>
      )}

      {/* Loading Text */}
      {loadingText && (
        <p
          className="text-sm mb-4"
          style={{ color: textColor }}
        >
          {loadingText}
        </p>
      )}

      {/* Loading Indicator */}
      {showIndicator && (
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: indicatorColor, animationDelay: '0ms' }}
          />
          <div
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: indicatorColor, animationDelay: '150ms' }}
          />
          <div
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: indicatorColor, animationDelay: '300ms' }}
          />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/components/preview/screens/SplashPreview.tsx
git commit -m "feat(config-editor): add SplashPreview component"
```

---

## Task 6: Create WebViewPreview component

**Files:**
- Create: `tools/config-editor/client/src/components/preview/screens/WebViewPreview.tsx`

**Step 1: Create WebViewPreview**

```typescript
// tools/config-editor/client/src/components/preview/screens/WebViewPreview.tsx
import { useState, useEffect, useRef } from 'react';
import { usePreview } from '../../../contexts/PreviewContext';
import type { AppConfig } from '../../../types/config';

interface WebViewPreviewProps {
  appConfig: AppConfig | null;
}

export default function WebViewPreview({ appConfig }: WebViewPreviewProps) {
  const { settings, themeMode } = usePreview();
  const [iframeError, setIframeError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const baseUrl = appConfig?.webview?.baseUrl || '';
  const loadIframe = settings.loadIframe && baseUrl;

  const safeArea = appConfig?.safeArea;
  const safeAreaEnabled = safeArea?.enabled;
  const safeAreaBgColor = themeMode === 'dark'
    ? (safeArea?.darkBackgroundColor || '#000000')
    : (safeArea?.backgroundColor || '#ffffff');

  useEffect(() => {
    if (loadIframe) {
      setIsLoading(true);
      setIframeError(false);

      // 10초 타임아웃
      timeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        setIframeError(true);
      }, 10000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loadIframe, baseUrl]);

  const handleIframeLoad = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsLoading(false);
  };

  const handleIframeError = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsLoading(false);
    setIframeError(true);
  };

  const handleRetry = () => {
    setIframeError(false);
    setIsLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = baseUrl;
    }
  };

  // 플레이스홀더 모드
  if (!loadIframe) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center bg-slate-100"
        style={safeAreaEnabled ? {
          paddingTop: '20px',
          paddingBottom: '20px',
          backgroundColor: safeAreaBgColor
        } : undefined}
      >
        <div className="w-16 h-16 rounded-xl bg-slate-300 mb-3 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
            <path d="M21 15l-5-5L5 21" strokeWidth="2" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-600">Your Web App</p>
        {baseUrl && (
          <p className="text-xs text-slate-400 mt-1 px-4 text-center truncate max-w-full">
            {baseUrl}
          </p>
        )}
      </div>
    );
  }

  // iframe 로드 에러
  if (iframeError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100">
        <svg className="w-12 h-12 text-slate-400 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path d="M12 8v4M12 16h.01" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium text-slate-600 mb-1">Failed to load</p>
        <p className="text-xs text-slate-400 mb-3">URL could not be loaded</p>
        <button
          onClick={handleRetry}
          className="px-3 py-1.5 text-xs bg-slate-800 text-white rounded hover:bg-slate-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mb-2" />
            <p className="text-xs text-slate-500">Loading...</p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={baseUrl}
        className="w-full h-full border-0"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-scripts allow-same-origin"
        title="WebView Preview"
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/components/preview/screens/WebViewPreview.tsx
git commit -m "feat(config-editor): add WebViewPreview with iframe and placeholder modes"
```

---

## Task 7: Create OfflinePreview component

**Files:**
- Create: `tools/config-editor/client/src/components/preview/screens/OfflinePreview.tsx`

**Step 1: Create OfflinePreview**

```typescript
// tools/config-editor/client/src/components/preview/screens/OfflinePreview.tsx
import { usePreview } from '../../../contexts/PreviewContext';
import type { AppConfig } from '../../../types/config';

interface OfflinePreviewProps {
  appConfig: AppConfig | null;
}

export default function OfflinePreview({ appConfig }: OfflinePreviewProps) {
  const { themeMode } = usePreview();

  const offline = appConfig?.offline;

  const backgroundColor = themeMode === 'dark'
    ? (offline?.darkBackgroundColor || '#1a1a1a')
    : (offline?.backgroundColor || '#ffffff');

  const title = offline?.title || 'No Connection';
  const message = offline?.message || 'Please check your internet connection';
  const buttonText = offline?.retryButtonText || 'Retry';

  const textColor = themeMode === 'dark' ? '#ffffff' : '#000000';
  const subTextColor = themeMode === 'dark' ? '#9ca3af' : '#6b7280';

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center px-8"
      style={{ backgroundColor }}
    >
      {/* Wi-Fi Off Icon */}
      <svg
        className="w-16 h-16 mb-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke={subTextColor}
        strokeWidth="1.5"
      >
        <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9z" />
        <path d="M5 13l2 2c2.76-2.76 7.24-2.76 10 0l2-2C14.14 8.14 9.87 8.14 5 13z" />
        <path d="M9 17l3 3 3-3c-1.65-1.66-4.34-1.66-6 0z" />
        <line x1="2" y1="2" x2="22" y2="22" strokeLinecap="round" />
      </svg>

      {/* Title */}
      <h2
        className="text-lg font-semibold mb-2 text-center"
        style={{ color: textColor }}
      >
        {title}
      </h2>

      {/* Message */}
      <p
        className="text-sm text-center mb-6"
        style={{ color: subTextColor }}
      >
        {message}
      </p>

      {/* Retry Button */}
      <button
        className="px-6 py-2 rounded-lg text-sm font-medium text-white"
        style={{ backgroundColor: '#3b82f6' }}
      >
        {buttonText}
      </button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/components/preview/screens/OfflinePreview.tsx
git commit -m "feat(config-editor): add OfflinePreview component"
```

---

## Task 8: Create ThemePreview component

**Files:**
- Create: `tools/config-editor/client/src/components/preview/screens/ThemePreview.tsx`

**Step 1: Create ThemePreview**

```typescript
// tools/config-editor/client/src/components/preview/screens/ThemePreview.tsx
import { usePreview } from '../../../contexts/PreviewContext';
import type { ThemeConfig } from '../../../types/config';

interface ThemePreviewProps {
  themeConfig: ThemeConfig | null;
}

const DEFAULT_COLORS = {
  light: {
    text: '#11181C',
    background: '#ffffff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#ffffff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#ffffff',
  },
};

export default function ThemePreview({ themeConfig }: ThemePreviewProps) {
  const { themeMode } = usePreview();

  const colors = themeConfig?.colors?.[themeMode] || {};
  const defaultColors = DEFAULT_COLORS[themeMode];

  const textColor = colors.text || defaultColors.text;
  const backgroundColor = colors.background || defaultColors.background;
  const tintColor = colors.tint || defaultColors.tint;
  const iconColor = colors.icon || defaultColors.icon;
  const tabIconDefault = colors.tabIconDefault || defaultColors.tabIconDefault;
  const tabIconSelected = colors.tabIconSelected || defaultColors.tabIconSelected;

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ backgroundColor }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: iconColor + '30' }}>
        <h1 className="text-lg font-semibold" style={{ color: textColor }}>
          Sample App
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {/* Text Samples */}
        <div className="mb-4">
          <p className="text-sm mb-1" style={{ color: textColor }}>
            This is primary text color
          </p>
          <p className="text-xs" style={{ color: iconColor }}>
            This is secondary text (icon color)
          </p>
        </div>

        {/* Button */}
        <button
          className="w-full py-2 rounded-lg text-sm font-medium text-white mb-4"
          style={{ backgroundColor: tintColor }}
        >
          Primary Button (Tint)
        </button>

        {/* Card */}
        <div
          className="p-3 rounded-lg mb-4"
          style={{ backgroundColor: iconColor + '15' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={iconColor}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-sm font-medium" style={{ color: textColor }}>
              Icon Color Sample
            </span>
          </div>
          <p className="text-xs" style={{ color: iconColor }}>
            Card with icon and text samples
          </p>
        </div>

        {/* Color Swatches */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Text', color: textColor },
            { label: 'Tint', color: tintColor },
            { label: 'Icon', color: iconColor },
          ].map(({ label, color }) => (
            <div key={label} className="text-center">
              <div
                className="w-full h-8 rounded mb-1"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px]" style={{ color: iconColor }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Bar */}
      <div
        className="flex items-center justify-around py-2 border-t"
        style={{ borderColor: iconColor + '30' }}
      >
        {[
          { icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', selected: true },
          { icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', selected: false },
          { icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', selected: false },
        ].map((tab, i) => (
          <div key={i} className="flex flex-col items-center">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke={tab.selected ? tabIconSelected : tabIconDefault}
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            <span
              className="text-[10px] mt-0.5"
              style={{ color: tab.selected ? tabIconSelected : tabIconDefault }}
            >
              {['Home', 'Search', 'Profile'][i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/components/preview/screens/ThemePreview.tsx
git commit -m "feat(config-editor): add ThemePreview with sample UI"
```

---

## Task 9: Create screens index file

**Files:**
- Create: `tools/config-editor/client/src/components/preview/screens/index.ts`

**Step 1: Create barrel export**

```typescript
// tools/config-editor/client/src/components/preview/screens/index.ts
export { default as SplashPreview } from './SplashPreview';
export { default as WebViewPreview } from './WebViewPreview';
export { default as OfflinePreview } from './OfflinePreview';
export { default as ThemePreview } from './ThemePreview';
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/components/preview/screens/index.ts
git commit -m "feat(config-editor): add screens index barrel export"
```

---

## Task 10: Create PreviewControls component

**Files:**
- Create: `tools/config-editor/client/src/components/preview/PreviewControls.tsx`

**Step 1: Create PreviewControls**

```typescript
// tools/config-editor/client/src/components/preview/PreviewControls.tsx
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreview, PreviewScreen } from '../../contexts/PreviewContext';
import { DEVICE_SIZES, DeviceSizeKey } from '../../constants/devices';

interface PreviewControlsProps {
  showThemeToggle?: boolean;
}

export default function PreviewControls({ showThemeToggle = false }: PreviewControlsProps) {
  const { t } = useTranslation();
  const {
    currentScreen,
    orientation,
    deviceSize,
    themeMode,
    toggleOrientation,
    setDeviceSize,
    toggleThemeMode,
  } = usePreview();

  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowDeviceMenu(false);
      }
    };

    if (showDeviceMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDeviceMenu]);

  const screenLabels: Record<PreviewScreen, string> = {
    splash: 'Splash',
    webview: 'WebView',
    offline: 'Offline',
    theme: 'Theme',
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 현재 화면 표시 */}
      <span className="text-xs text-slate-500 mr-2">
        {screenLabels[currentScreen]}
      </span>

      {/* 회전 토글 */}
      <button
        onClick={toggleOrientation}
        className={`
          p-1.5 rounded hover:bg-slate-200 transition-colors
          ${orientation === 'landscape' ? 'bg-blue-100 text-blue-600' : 'text-slate-600'}
        `}
        title={t('preview.rotate')}
      >
        <svg
          className={`w-4 h-4 transition-transform ${orientation === 'landscape' ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* 디바이스 크기 선택 */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowDeviceMenu(!showDeviceMenu)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 rounded hover:bg-slate-200 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round" />
          </svg>
          <span>{DEVICE_SIZES[deviceSize].label}</span>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDeviceMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
            {(Object.keys(DEVICE_SIZES) as DeviceSizeKey[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setDeviceSize(key);
                  setShowDeviceMenu(false);
                }}
                className={`
                  w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 transition-colors
                  ${deviceSize === key ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}
                `}
              >
                {DEVICE_SIZES[key].label}
                <span className="text-slate-400 ml-1">
                  ({DEVICE_SIZES[key].width}×{DEVICE_SIZES[key].height})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 다크모드 토글 (Theme 탭에서만) */}
      {showThemeToggle && (
        <button
          onClick={toggleThemeMode}
          className={`
            p-1.5 rounded hover:bg-slate-200 transition-colors
            ${themeMode === 'dark' ? 'bg-slate-800 text-yellow-400' : 'text-slate-600'}
          `}
          title={themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {themeMode === 'dark' ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/components/preview/PreviewControls.tsx
git commit -m "feat(config-editor): add PreviewControls with rotation and device size"
```

---

## Task 11: Create PreviewSettings popover

**Files:**
- Create: `tools/config-editor/client/src/components/preview/PreviewSettings.tsx`

**Step 1: Create PreviewSettings**

```typescript
// tools/config-editor/client/src/components/preview/PreviewSettings.tsx
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreview } from '../../contexts/PreviewContext';

export default function PreviewSettings() {
  const { t } = useTranslation();
  const { settings, updateSettings } = usePreview();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          p-1.5 rounded transition-colors
          ${isOpen ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700'}
        `}
        title={t('preview.settings')}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-20 min-w-[180px]">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.loadIframe}
                onChange={(e) => updateSettings({ loadIframe: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span className="text-xs text-slate-700">{t('preview.loadIframe')}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showStatusBar}
                onChange={(e) => updateSettings({ showStatusBar: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span className="text-xs text-slate-700">{t('preview.showStatusBar')}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showNavBar}
                onChange={(e) => updateSettings({ showNavBar: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span className="text-xs text-slate-700">{t('preview.showNavBar')}</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/components/preview/PreviewSettings.tsx
git commit -m "feat(config-editor): add PreviewSettings popover"
```

---

## Task 12: Create PreviewPanel component

**Files:**
- Create: `tools/config-editor/client/src/components/preview/PreviewPanel.tsx`

**Step 1: Create PreviewPanel**

```typescript
// tools/config-editor/client/src/components/preview/PreviewPanel.tsx
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreview } from '../../contexts/PreviewContext';
import { DEVICE_SIZES, calculateScale } from '../../constants/devices';
import PhoneMockup from './PhoneMockup';
import PreviewControls from './PreviewControls';
import PreviewSettings from './PreviewSettings';
import { SplashPreview, WebViewPreview, OfflinePreview, ThemePreview } from './screens';
import type { AppConfig, ThemeConfig } from '../../types/config';

interface PreviewPanelProps {
  appConfig: AppConfig | null;
  themeConfig: ThemeConfig | null;
  activeTab: string;
}

export default function PreviewPanel({ appConfig, themeConfig, activeTab }: PreviewPanelProps) {
  const { t } = useTranslation();
  const { currentScreen, orientation, deviceSize, themeMode, setCurrentScreen, setIsFullscreen, isFullscreen } = usePreview();

  // 탭에 따라 기본 화면 설정
  useEffect(() => {
    if (activeTab === 'theme') {
      setCurrentScreen('theme');
    }
  }, [activeTab, setCurrentScreen]);

  const device = DEVICE_SIZES[deviceSize];
  const isLandscape = orientation === 'landscape';
  const mockupWidth = isLandscape ? device.height : device.width;
  const mockupHeight = isLandscape ? device.width : device.height;

  // 컨테이너 크기에 맞게 스케일 계산 (최대 높이 600px 기준)
  const maxHeight = 600;
  const maxWidth = 400;
  const scale = calculateScale(mockupWidth, mockupHeight, maxWidth, maxHeight, orientation);

  const handleDoubleClick = useCallback(() => {
    setIsFullscreen(true);
  }, [setIsFullscreen]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return <SplashPreview appConfig={appConfig} themeConfig={themeConfig} />;
      case 'offline':
        return <OfflinePreview appConfig={appConfig} />;
      case 'theme':
        return <ThemePreview themeConfig={themeConfig} />;
      case 'webview':
      default:
        return <WebViewPreview appConfig={appConfig} />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 border-l border-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-medium text-slate-700">{t('preview.title')}</span>
          {/* Theme Mode Badge */}
          {activeTab === 'theme' && (
            <span className={`
              px-1.5 py-0.5 text-[10px] rounded
              ${themeMode === 'dark' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}
            `}>
              {themeMode === 'dark' ? 'Dark' : 'Light'}
            </span>
          )}
        </div>
        <PreviewSettings />
      </div>

      {/* Controls */}
      <div className="px-4 py-2 border-b border-slate-200 bg-white">
        <PreviewControls showThemeToggle={activeTab === 'theme'} />
      </div>

      {/* Preview Area */}
      <div
        className="flex-1 flex items-center justify-center p-4 overflow-hidden"
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
        >
          <PhoneMockup appConfig={appConfig}>
            {renderScreen()}
          </PhoneMockup>
        </div>
      </div>

      {/* Hint */}
      <div className="px-4 py-2 text-center">
        <span className="text-[10px] text-slate-400">
          {t('preview.doubleClickHint')}
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/components/preview/PreviewPanel.tsx
git commit -m "feat(config-editor): add PreviewPanel main container"
```

---

## Task 13: Create preview index barrel export

**Files:**
- Create: `tools/config-editor/client/src/components/preview/index.ts`

**Step 1: Create barrel export**

```typescript
// tools/config-editor/client/src/components/preview/index.ts
export { default as PreviewPanel } from './PreviewPanel';
export { default as PhoneMockup } from './PhoneMockup';
export { default as PreviewControls } from './PreviewControls';
export { default as PreviewSettings } from './PreviewSettings';
export * from './screens';
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/components/preview/index.ts
git commit -m "feat(config-editor): add preview components barrel export"
```

---

## Task 14: Add i18n translations for preview

**Files:**
- Modify: `tools/config-editor/client/src/i18n/en.json`
- Modify: `tools/config-editor/client/src/i18n/ko.json`

**Step 1: Update English translations**

Add to the root object in `en.json`:

```json
"preview": {
  "title": "Preview",
  "rotate": "Rotate",
  "settings": "Settings",
  "loadIframe": "Load actual URL",
  "showStatusBar": "Show Status Bar",
  "showNavBar": "Show Navigation Bar",
  "doubleClickHint": "Double-click to fullscreen",
  "showPreview": "Show Preview"
}
```

**Step 2: Update Korean translations**

Add to the root object in `ko.json`:

```json
"preview": {
  "title": "미리보기",
  "rotate": "회전",
  "settings": "설정",
  "loadIframe": "실제 URL 로드",
  "showStatusBar": "상태 바 표시",
  "showNavBar": "내비게이션 바 표시",
  "doubleClickHint": "더블클릭으로 전체화면",
  "showPreview": "미리보기"
}
```

**Step 3: Commit**

```bash
git add tools/config-editor/client/src/i18n/en.json tools/config-editor/client/src/i18n/ko.json
git commit -m "feat(config-editor): add i18n translations for preview panel"
```

---

## Task 15: Create useAccordionSync hook

**Files:**
- Create: `tools/config-editor/client/src/hooks/useAccordionSync.ts`

**Step 1: Create the hook**

```typescript
// tools/config-editor/client/src/hooks/useAccordionSync.ts
import { useCallback } from 'react';
import { usePreview, PreviewScreen, HighlightTarget } from '../contexts/PreviewContext';
import { SECTION_TO_SCREEN_MAP, HIGHLIGHT_SECTIONS } from '../constants/devices';

export function useAccordionSync() {
  const { setCurrentScreen, setHighlightTarget } = usePreview();

  const handleAccordionToggle = useCallback((sectionId: string, isOpen: boolean) => {
    if (!isOpen) {
      // 섹션이 닫히면 강조 해제
      setHighlightTarget(null);
      return;
    }

    // 열린 섹션에 맞는 화면으로 전환
    const screen = SECTION_TO_SCREEN_MAP[sectionId];
    if (screen) {
      setCurrentScreen(screen);
    }

    // 강조 표시 설정
    const highlight = HIGHLIGHT_SECTIONS[sectionId];
    setHighlightTarget(highlight || null);
  }, [setCurrentScreen, setHighlightTarget]);

  return { handleAccordionToggle };
}
```

**Step 2: Add to hooks index**

Add to `tools/config-editor/client/src/hooks/index.ts`:

```typescript
export { useConfig } from './useConfig';
export { usePlugins } from './usePlugins';
export { useAccordionSync } from './useAccordionSync';
```

**Step 3: Commit**

```bash
git add tools/config-editor/client/src/hooks/useAccordionSync.ts tools/config-editor/client/src/hooks/index.ts
git commit -m "feat(config-editor): add useAccordionSync hook for preview sync"
```

---

## Task 16: Update AppConfig page with accordion sync

**Files:**
- Modify: `tools/config-editor/client/src/pages/AppConfig.tsx`

**Step 1: Update AppConfig to use accordion sync**

Add import at top:

```typescript
import { useAccordionSync } from '../hooks/useAccordionSync';
```

Add hook usage inside the component (after existing hooks):

```typescript
const { handleAccordionToggle } = useAccordionSync();
```

Update each Accordion with sectionId and onToggle. For example, change:

```tsx
<Accordion title={t('app.webview.title')} defaultOpen>
```

To:

```tsx
<Accordion
  title={t('app.webview.title')}
  defaultOpen
  sectionId="webview"
  onToggle={(isOpen) => handleAccordionToggle('webview', isOpen)}
>
```

Apply this pattern to all Accordions:
- `webview` section: sectionId="webview"
- Nested `options`: sectionId="webview-options"
- Nested `performance`: sectionId="webview-performance"
- `offline` section: sectionId="offline"
- `statusBar` section: sectionId="statusBar"
- `navigationBar` section: sectionId="navigationBar"
- `safeArea` section: sectionId="safeArea"
- `theme` section: sectionId="theme"
- `splash` section: sectionId="splash"
- `security` section: sectionId="security"
- `debug` section: sectionId="debug"

**Step 2: Verify build passes**

Run: `cd tools/config-editor/client && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add tools/config-editor/client/src/pages/AppConfig.tsx
git commit -m "feat(config-editor): integrate accordion sync with preview in AppConfig"
```

---

## Task 17: Update Layout for 2-column layout

**Files:**
- Modify: `tools/config-editor/client/src/components/Layout.tsx`

**Step 1: Update Layout to accept preview panel**

```typescript
import { ReactNode, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';

interface LayoutProps {
  children: ReactNode;
  previewPanel?: ReactNode;
}

export default function Layout({ children, previewPanel }: LayoutProps) {
  const { t } = useTranslation();
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(true);

  // 반응형 처리
  useEffect(() => {
    const checkWidth = () => {
      setIsWideScreen(window.innerWidth >= 1024);
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-base font-semibold text-white">RNWW Config</h1>
          <div className="flex items-center gap-3">
            {/* 모바일에서 Preview 토글 버튼 */}
            {!isWideScreen && previewPanel && (
              <button
                onClick={() => setShowPreviewModal(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {t('preview.showPreview')}
              </button>
            )}
            <LanguageSelector />
            <span className="text-xs text-slate-400">v1.0</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-4">
        {previewPanel && isWideScreen ? (
          <div className="grid grid-cols-[65%_35%] gap-4">
            <div>{children}</div>
            <div className="sticky top-4 h-[calc(100vh-6rem)]">
              {previewPanel}
            </div>
          </div>
        ) : (
          children
        )}
      </main>

      {/* 모바일 Preview 모달 */}
      {showPreviewModal && previewPanel && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <span className="font-medium text-slate-700">{t('preview.title')}</span>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {previewPanel}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/components/Layout.tsx
git commit -m "feat(config-editor): update Layout for 2-column preview layout"
```

---

## Task 18: Update App.tsx to integrate preview

**Files:**
- Modify: `tools/config-editor/client/src/App.tsx`

**Step 1: Update App.tsx**

Replace the entire file:

```typescript
// tools/config-editor/client/src/App.tsx
import { useState, useCallback } from 'react';
import Layout from './components/Layout';
import TabNav from './components/TabNav';
import AppConfigPage from './pages/AppConfig';
import ThemeConfigPage from './pages/ThemeConfig';
import PluginsConfigPage from './pages/PluginsConfig';
import BuildConfigPage from './pages/BuildConfig';
import { PreviewPanel } from './components/preview';
import { PreviewProvider } from './contexts/PreviewContext';
import { useConfig } from './hooks/useConfig';
import type { AppConfig, ThemeConfig } from './types/config';

function AppContent() {
  const [activeTab, setActiveTab] = useState('appSettings');
  const [unsavedTabs, setUnsavedTabs] = useState<string[]>([]);

  // 미리보기를 위해 config 데이터 로드
  const { data: appConfig } = useConfig<AppConfig>('app');
  const { data: themeConfig } = useConfig<ThemeConfig>('theme');

  const handleUnsavedChange = useCallback((tab: string) => (hasChanges: boolean) => {
    setUnsavedTabs(prev => {
      if (hasChanges && !prev.includes(tab)) {
        return [...prev, tab];
      }
      if (!hasChanges && prev.includes(tab)) {
        return prev.filter(t => t !== tab);
      }
      return prev;
    });
  }, []);

  const previewPanel = (
    <PreviewPanel
      appConfig={appConfig}
      themeConfig={themeConfig}
      activeTab={activeTab}
    />
  );

  return (
    <Layout previewPanel={previewPanel}>
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <TabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          unsavedTabs={unsavedTabs}
        />
        <div className="p-6">
          {activeTab === 'appSettings' && (
            <AppConfigPage onUnsavedChange={handleUnsavedChange('appSettings')} />
          )}
          {activeTab === 'theme' && (
            <ThemeConfigPage onUnsavedChange={handleUnsavedChange('theme')} />
          )}
          {activeTab === 'plugins' && (
            <PluginsConfigPage onUnsavedChange={handleUnsavedChange('plugins')} />
          )}
          {activeTab === 'build' && (
            <BuildConfigPage />
          )}
        </div>
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <PreviewProvider>
      <AppContent />
    </PreviewProvider>
  );
}
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/App.tsx
git commit -m "feat(config-editor): integrate PreviewPanel into App"
```

---

## Task 19: Add keyboard shortcuts

**Files:**
- Create: `tools/config-editor/client/src/hooks/useKeyboardShortcuts.ts`

**Step 1: Create keyboard shortcuts hook**

```typescript
// tools/config-editor/client/src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { usePreview, DeviceSize } from '../contexts/PreviewContext';

const DEVICE_SIZE_KEYS: Record<string, DeviceSize> = {
  '1': 'small',
  '2': 'phone',
  '3': 'large',
  '4': 'tablet',
};

export function useKeyboardShortcuts() {
  const { toggleOrientation, setDeviceSize } = usePreview();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // input이나 textarea에서는 무시
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // R: 회전
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        toggleOrientation();
      }

      // 1-4: 디바이스 크기
      if (DEVICE_SIZE_KEYS[e.key]) {
        e.preventDefault();
        setDeviceSize(DEVICE_SIZE_KEYS[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleOrientation, setDeviceSize]);
}
```

**Step 2: Update hooks index**

Add to `tools/config-editor/client/src/hooks/index.ts`:

```typescript
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
```

**Step 3: Use in App.tsx**

Add import and call the hook in `AppContent`:

```typescript
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function AppContent() {
  // ... existing code
  useKeyboardShortcuts();
  // ... rest of component
}
```

**Step 4: Commit**

```bash
git add tools/config-editor/client/src/hooks/useKeyboardShortcuts.ts tools/config-editor/client/src/hooks/index.ts tools/config-editor/client/src/App.tsx
git commit -m "feat(config-editor): add keyboard shortcuts for preview (R, 1-4)"
```

---

## Task 20: Create fullscreen modal

**Files:**
- Create: `tools/config-editor/client/src/components/preview/FullscreenModal.tsx`

**Step 1: Create FullscreenModal**

```typescript
// tools/config-editor/client/src/components/preview/FullscreenModal.tsx
import { useEffect } from 'react';
import { usePreview } from '../../contexts/PreviewContext';
import { DEVICE_SIZES } from '../../constants/devices';
import PhoneMockup from './PhoneMockup';
import PreviewControls from './PreviewControls';
import { SplashPreview, WebViewPreview, OfflinePreview, ThemePreview } from './screens';
import type { AppConfig, ThemeConfig } from '../../types/config';

interface FullscreenModalProps {
  appConfig: AppConfig | null;
  themeConfig: ThemeConfig | null;
  activeTab: string;
}

export default function FullscreenModal({ appConfig, themeConfig, activeTab }: FullscreenModalProps) {
  const { currentScreen, orientation, deviceSize, isFullscreen, setIsFullscreen } = usePreview();

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, setIsFullscreen]);

  if (!isFullscreen) return null;

  const device = DEVICE_SIZES[deviceSize];
  const isLandscape = orientation === 'landscape';
  const mockupWidth = isLandscape ? device.height : device.width;
  const mockupHeight = isLandscape ? device.width : device.height;

  // 화면의 80%까지 확대
  const maxWidth = window.innerWidth * 0.8;
  const maxHeight = window.innerHeight * 0.8;
  const scaleX = maxWidth / mockupWidth;
  const scaleY = maxHeight / mockupHeight;
  const scale = Math.min(scaleX, scaleY, 1.5); // 최대 1.5배

  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return <SplashPreview appConfig={appConfig} themeConfig={themeConfig} />;
      case 'offline':
        return <OfflinePreview appConfig={appConfig} />;
      case 'theme':
        return <ThemePreview themeConfig={themeConfig} />;
      case 'webview':
      default:
        return <WebViewPreview appConfig={appConfig} />;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center"
      onClick={() => setIsFullscreen(false)}
    >
      {/* Controls */}
      <div
        className="mb-4 p-3 bg-white rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <PreviewControls showThemeToggle={activeTab === 'theme'} />
      </div>

      {/* Phone Mockup */}
      <div
        className="transition-transform duration-200"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
      >
        <PhoneMockup appConfig={appConfig}>
          {renderScreen()}
        </PhoneMockup>
      </div>

      {/* Close hint */}
      <p className="mt-4 text-white/60 text-sm">
        Press ESC or click outside to close
      </p>
    </div>
  );
}
```

**Step 2: Update preview index**

Add to `tools/config-editor/client/src/components/preview/index.ts`:

```typescript
export { default as FullscreenModal } from './FullscreenModal';
```

**Step 3: Add FullscreenModal to App.tsx**

In `AppContent`, add after the Layout:

```typescript
import { PreviewPanel, FullscreenModal } from './components/preview';

// Inside AppContent's return, after </Layout>:
return (
  <>
    <Layout previewPanel={previewPanel}>
      {/* ... existing content ... */}
    </Layout>
    <FullscreenModal
      appConfig={appConfig}
      themeConfig={themeConfig}
      activeTab={activeTab}
    />
  </>
);
```

**Step 4: Commit**

```bash
git add tools/config-editor/client/src/components/preview/FullscreenModal.tsx tools/config-editor/client/src/components/preview/index.ts tools/config-editor/client/src/App.tsx
git commit -m "feat(config-editor): add fullscreen modal for preview"
```

---

## Task 21: Build and test

**Files:**
- None (verification only)

**Step 1: Install dependencies if needed**

Run: `cd tools/config-editor/client && npm install`

**Step 2: Build the project**

Run: `cd tools/config-editor/client && npm run build`
Expected: Build succeeds with no errors

**Step 3: Test locally**

Run: `cd tools/config-editor && npm run dev` (or appropriate dev command)
Expected: Config editor opens with preview panel on the right

**Step 4: Manual testing checklist**

- [ ] Preview panel visible on right side (>=1024px)
- [ ] Preview panel hidden with "Show Preview" button on mobile (<1024px)
- [ ] Device rotation works (click button or press R)
- [ ] Device size selection works (dropdown or press 1-4)
- [ ] Theme toggle works on Theme tab
- [ ] Accordion sections change preview screen correctly
- [ ] Status Bar and Navigation Bar highlight when their sections are open
- [ ] Settings popover opens/closes correctly
- [ ] Double-click opens fullscreen modal
- [ ] ESC closes fullscreen modal
- [ ] Config changes reflect immediately in preview

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(config-editor): complete preview panel implementation"
```

---

## Summary

This plan implements a real-time preview panel for the config editor with:

1. **PreviewContext** - Central state management for preview settings
2. **PhoneMockup** - Phone frame with configurable Status/Navigation bars
3. **Screen Components** - Splash, WebView, Offline, Theme previews
4. **PreviewControls** - Rotation, device size, theme mode controls
5. **PreviewSettings** - Popover for iframe/bar visibility toggles
6. **Accordion Sync** - Auto-switch preview based on open accordion
7. **Responsive Layout** - 2-column on desktop, modal on mobile
8. **Keyboard Shortcuts** - R for rotation, 1-4 for device sizes
9. **Fullscreen Modal** - Double-click to expand preview

Total: 21 tasks, each taking 2-5 minutes.
