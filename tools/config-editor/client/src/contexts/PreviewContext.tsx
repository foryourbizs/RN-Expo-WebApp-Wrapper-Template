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
