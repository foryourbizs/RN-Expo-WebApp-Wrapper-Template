// tools/config-editor/client/src/contexts/PreviewContext.tsx
import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';

export type PreviewScreen = 'splash' | 'webview' | 'offline' | 'error' | 'theme';
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
  previewUrl: string | null;  // 반영된 URL (null이면 config의 baseUrl 사용)
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
  applyPreviewUrl: (url: string) => void;  // URL 반영 버튼 클릭 시 호출
}

const defaultSettings: PreviewSettings = {
  loadIframe: true,  // 기본적으로 실제 URL 로드
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const applyPreviewUrl = useCallback((url: string) => {
    setPreviewUrl(url);
  }, []);

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
    previewUrl,
    setCurrentScreen,
    setOrientation,
    toggleOrientation,
    setDeviceSize,
    setThemeMode,
    toggleThemeMode,
    updateSettings,
    setHighlightTarget,
    setIsFullscreen,
    applyPreviewUrl,
  }), [
    currentScreen, orientation, deviceSize, themeMode, settings,
    highlightTarget, isFullscreen, previewUrl, toggleOrientation, toggleThemeMode, updateSettings, applyPreviewUrl
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
