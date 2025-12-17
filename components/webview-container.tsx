/**
 * WebView 컨테이너 컴포넌트
 * 단일 웹 세션을 유지하며 전역 상태와 연동
 */

import React, { useRef, useCallback, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  ActivityIndicator, 
  BackHandler, 
  Platform,
  Text,
  Pressable,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { 
  WebViewNavigation,
  WebViewErrorEvent, 
} from 'react-native-webview/lib/WebViewTypes';
import { useFocusEffect } from '@react-navigation/native';

import { APP_CONFIG } from '@/constants/app-config';

// WebView 인스턴스를 전역에서 접근 가능하도록 (네비게이션 제어용)
export let webViewRef: React.RefObject<WebView | null>;

interface WebViewError {
  code: number;
  description: string;
  url: string;
}

export default function WebViewContainer() {
  const ref = useRef<WebView>(null);
  webViewRef = ref;

  // 로컬 상태 사용 (무한 루프 방지)
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [error, setError] = useState<WebViewError | null>(null);

  const { webview, theme } = APP_CONFIG;

  // Android 하드웨어 뒤로가기 버튼 처리
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBack && ref.current) {
          ref.current.goBack();
          return true;
        }
        return false;
      });

      return () => backHandler.remove();
    }, [canGoBack])
  );

  // 네비게이션 상태 변경 핸들러
  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  }, []);

  // 로드 시작
  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  // 로드 완료
  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  // 에러 처리
  const handleError = useCallback((event: WebViewErrorEvent) => {
    const { nativeEvent } = event;
    setError({
      code: nativeEvent.code,
      description: nativeEvent.description,
      url: nativeEvent.url,
    });
    setIsLoading(false);
  }, []);

  // 재시도 핸들러
  const handleRetry = useCallback(() => {
    setError(null);
    ref.current?.reload();
  }, []);

  // 에러 화면 렌더링
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>페이지를 불러올 수 없습니다</Text>
        <Text style={styles.errorDescription}>{error.description}</Text>
        <Pressable onPress={handleRetry}>
          <Text style={styles.retryButton}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={ref}
        source={{ uri: webview.baseUrl }}
        style={styles.webview}
        // 데스크톱 Chrome User-Agent (웹 호환성 향상)
        userAgent={webview.userAgent}
        // 기본 옵션
        javaScriptEnabled={webview.options.javaScriptEnabled}
        domStorageEnabled={webview.options.domStorageEnabled}
        thirdPartyCookiesEnabled={webview.options.thirdPartyCookiesEnabled}
        mediaPlaybackRequiresUserAction={webview.options.mediaPlaybackRequiresUserAction}
        mixedContentMode={webview.options.mixedContentMode}
        cacheEnabled={webview.options.cacheEnabled}
        allowsInlineMediaPlayback={webview.options.allowsInlineMediaPlayback}
        allowsBackForwardNavigationGestures={webview.options.allowsBackForwardNavigationGestures}
        allowFileAccess={webview.options.allowFileAccess}
        // 세션 유지를 위한 설정
        sharedCookiesEnabled={true}
        incognito={false}
        // 추가 호환성 옵션
        javaScriptCanOpenWindowsAutomatically={true}
        allowsFullscreenVideo={true}
        allowsProtectedMedia={true}
        mediaCapturePermissionGrantType="grant"
        setSupportMultipleWindows={false}
        overScrollMode="never"
        textZoom={100}
        // 이벤트 핸들러
        onNavigationStateChange={handleNavigationStateChange}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
      />
      
      {/* 로딩 인디케이터 */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator 
            size="large" 
            color={theme.loadingIndicatorColor} 
          />
        </View>
      )}
    </View>
  );
}

// 외부에서 WebView 제어를 위한 헬퍼 함수들
export const webViewControls = {
  goBack: () => webViewRef?.current?.goBack(),
  goForward: () => webViewRef?.current?.goForward(),
  reload: () => webViewRef?.current?.reload(),
  stopLoading: () => webViewRef?.current?.stopLoading(),
  injectJavaScript: (script: string) => webViewRef?.current?.injectJavaScript(script),
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  errorDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});
