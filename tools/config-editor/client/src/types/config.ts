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
    mode?: 'default' | 'image';
    minDisplayTime?: number;
    fadeOutDuration?: number;
    fullscreenImage?: string | null;
    logoImage?: string | null;
    loadingText?: string;
    showLoadingIndicator?: boolean;
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
  theme?: {
    loadingIndicatorColor?: string;
  };
}

export interface ThemeConfig {
  $schema?: string;
  colors?: {
    light?: {
      // 스플래시 화면
      splashBackground?: string;
      splashText?: string;
      splashSpinner?: string;
      // 오프라인 화면
      offlineBackground?: string;
      offlineText?: string;
      offlineSubText?: string;
      offlineButton?: string;
      // 에러 화면
      errorBackground?: string;
      errorTitle?: string;
      errorMessage?: string;
      errorButton?: string;
      // 로딩 인디케이터
      loadingIndicator?: string;
    };
    dark?: {
      // 스플래시 화면
      splashBackground?: string;
      splashText?: string;
      splashSpinner?: string;
      // 오프라인 화면
      offlineBackground?: string;
      offlineText?: string;
      offlineSubText?: string;
      offlineButton?: string;
      // 에러 화면
      errorBackground?: string;
      errorTitle?: string;
      errorMessage?: string;
      errorButton?: string;
      // 로딩 인디케이터
      loadingIndicator?: string;
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

// Expo app.json 설정 타입
export interface ExpoConfig {
  expo: {
    name?: string;
    slug?: string;
    version?: string;
    description?: string;
    orientation?: 'default' | 'portrait' | 'landscape';
    icon?: string;
    scheme?: string;
    userInterfaceStyle?: 'automatic' | 'light' | 'dark';
    newArchEnabled?: boolean;
    githubUrl?: string;
    ios?: {
      supportsTablet?: boolean;
      bundleIdentifier?: string;
      buildNumber?: string;
      infoPlist?: Record<string, string>;
    };
    android?: {
      package?: string;
      versionCode?: number;
      permissions?: string[];
      adaptiveIcon?: {
        foregroundImage?: string;
        backgroundImage?: string;
        backgroundColor?: string;
        monochromeImage?: string;
      };
      edgeToEdgeEnabled?: boolean;
      splash?: {
        backgroundColor?: string;
        resizeMode?: string;
      };
    };
    splash?: {
      backgroundColor?: string;
      resizeMode?: string;
      image?: string;
    };
    plugins?: Array<string | [string, Record<string, unknown>]>;
    experiments?: Record<string, boolean>;
    extra?: Record<string, unknown>;
  };
}
