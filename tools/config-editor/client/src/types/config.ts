export interface AppConfig {
  $schema?: string;
  webview?: {
    baseUrl?: string;
    userAgent?: string;
    options?: {
      javaScriptEnabled?: boolean;
      domStorageEnabled?: boolean;
      thirdPartyCookiesEnabled?: boolean;
      mediaPlaybackRequiresUserAction?: boolean;
      mixedContentMode?: 'compatibility' | 'never' | 'always';
      cacheEnabled?: boolean;
      allowsInlineMediaPlayback?: boolean;
      allowsBackForwardNavigationGestures?: boolean;
    };
    performance?: {
      androidLayerType?: 'none' | 'software' | 'hardware';
      overScrollMode?: 'always' | 'content' | 'never';
      textZoom?: number;
      nestedScrollEnabled?: boolean;
      hideScrollIndicators?: boolean;
      allowsFullscreenVideo?: boolean;
      setSupportMultipleWindows?: boolean;
    };
  };
  offline?: {
    enabled?: boolean;
    title?: string;
    message?: string;
    retryButtonText?: string;
    backgroundColor?: string;
    darkBackgroundColor?: string;
    autoReconnect?: boolean;
  };
  statusBar?: {
    visible?: boolean;
    style?: 'auto' | 'light' | 'dark';
    overlapsWebView?: boolean;
    showOverlay?: boolean;
    overlayColor?: string;
    translucent?: boolean;
  };
  navigationBar?: {
    visibility?: 'visible' | 'hidden';
    behavior?: 'overlay-swipe' | 'inset-swipe';
    backgroundColor?: string;
    darkBackgroundColor?: string;
    buttonStyle?: 'light' | 'dark';
  };
  safeArea?: {
    enabled?: boolean;
    edges?: 'all' | 'top' | 'bottom' | 'none';
    backgroundColor?: string;
    darkBackgroundColor?: string;
  };
  splash?: {
    enabled?: boolean;
    minDisplayTime?: number;
    fadeOutDuration?: number;
    backgroundColor?: string;
    darkBackgroundColor?: string;
    logoImage?: string | null;
    loadingText?: string;
    showLoadingIndicator?: boolean;
  };
  theme?: {
    loadingIndicatorColor?: string;
  };
  security?: {
    allowedOrigins?: string[];
    blockedSchemes?: string[];
    allowedSchemes?: string[];
    allowInsecureHttp?: boolean;
    debug?: boolean;
  };
  debug?: {
    enabled?: boolean | null;
    maxLogLines?: number;
    overlayOpacity?: number;
    fontSize?: number;
    colors?: {
      info?: string;
      warn?: string;
      error?: string;
      success?: string;
      event?: string;
      nav?: string;
    };
  };
}

export interface ThemeConfig {
  $schema?: string;
  colors?: {
    light?: {
      text?: string;
      background?: string;
      tint?: string;
      icon?: string;
      tabIconDefault?: string;
      tabIconSelected?: string;
    };
    dark?: {
      text?: string;
      background?: string;
      tint?: string;
      icon?: string;
      tabIconDefault?: string;
      tabIconSelected?: string;
    };
  };
}

export interface PluginsConfig {
  $schema?: string;
  plugins?: {
    auto?: Array<{
      name: string;
      namespace: string;
      method?: string;
      keepModules?: string[];
    }>;
    manual?: Array<{
      path: string;
      namespace: string;
      entry?: string;
      method?: string;
    }>;
  };
}
