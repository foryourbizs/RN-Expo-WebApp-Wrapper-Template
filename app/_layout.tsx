import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import CustomSplash from '@/components/custom-splash';
import { APP_CONFIG } from '@/constants/app-config';
import { useColorScheme } from '@/hooks/use-color-scheme';

// 스플래시 상태를 전역에서 제어하기 위한 콜백
let hideSplashCallback: (() => void) | null = null;

export const hideSplashScreen = () => {
  hideSplashCallback?.();
};

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [showSplash, setShowSplash] = useState(true);
  const [splashFullyHidden, setSplashFullyHidden] = useState(false);
  const { statusBar, navigationBar } = APP_CONFIG;

  // Android 네비게이션 바 설정
  useEffect(() => {
    if (Platform.OS === 'android') {
      const setupNavigationBar = async () => {
        try {
          // 표시 모드 설정
          if (navigationBar.visibility === 'hidden') {
            // 숨김 모드: 네비게이션 바 영역까지 컨텐츠 확장
            await NavigationBar.setPositionAsync('absolute');
            await NavigationBar.setVisibilityAsync('hidden');
            await NavigationBar.setBehaviorAsync(navigationBar.behavior);
          } else {
            // 표시 모드
            await NavigationBar.setPositionAsync('relative');
            await NavigationBar.setVisibilityAsync('visible');
            
            // 배경색 설정
            const bgColor = colorScheme === 'dark' 
              ? navigationBar.darkBackgroundColor 
              : navigationBar.backgroundColor;
            await NavigationBar.setBackgroundColorAsync(bgColor);
          }

          // 버튼 스타일 설정
          await NavigationBar.setButtonStyleAsync(navigationBar.buttonStyle);
        } catch (error) {
          console.warn('[NavigationBar] Setup error:', error);
        }
      };
      setupNavigationBar();
    }
  }, [colorScheme, navigationBar]);

  // 외부에서 호출 가능한 숨김 함수 등록
  hideSplashCallback = useCallback(() => {
    setShowSplash(false);
  }, []);

  const handleSplashHidden = useCallback(() => {
    setSplashFullyHidden(true);
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
      
      {/* 상태바 설정 */}
      <StatusBar 
        style={statusBar.style}
        hidden={!statusBar.visible}
        translucent={statusBar.translucent}
      />
      
      {/* 커스텀 스플래시 - 페이드아웃 완료 전까지 렌더링 */}
      {!splashFullyHidden && (
        <CustomSplash visible={showSplash} onHidden={handleSplashHidden} />
      )}
    </ThemeProvider>
  );
}