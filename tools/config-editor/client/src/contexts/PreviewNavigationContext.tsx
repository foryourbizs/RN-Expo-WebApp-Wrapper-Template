// tools/config-editor/client/src/contexts/PreviewNavigationContext.tsx
// WebView 프리뷰 네비게이션 핸들러 공유 컨텍스트

import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';

interface NavigationHandlers {
  goBack: () => void;
  goForward: () => void;
  refresh: () => void;
}

interface PreviewNavigationContextValue {
  handlers: NavigationHandlers | null;
  isConnected: boolean;
  setHandlers: (handlers: NavigationHandlers | null) => void;
  setIsConnected: (connected: boolean) => void;
}

const PreviewNavigationContext = createContext<PreviewNavigationContextValue | null>(null);

export function PreviewNavigationProvider({ children }: { children: ReactNode }) {
  const [handlers, setHandlers] = useState<NavigationHandlers | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const value = useMemo(() => ({
    handlers,
    isConnected,
    setHandlers,
    setIsConnected,
  }), [handlers, isConnected]);

  return (
    <PreviewNavigationContext.Provider value={value}>
      {children}
    </PreviewNavigationContext.Provider>
  );
}

export function usePreviewNavigation() {
  const context = useContext(PreviewNavigationContext);
  if (!context) {
    throw new Error('usePreviewNavigation must be used within PreviewNavigationProvider');
  }
  return context;
}
