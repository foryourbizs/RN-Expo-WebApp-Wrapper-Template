/**
 * 커스텀 스플래시 스크린 컴포넌트
 * 앱 설정에서 활성화/비활성화 및 커스터마이징 가능
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  useColorScheme
} from 'react-native';

import { APP_CONFIG } from '@/constants/app-config';

interface CustomSplashProps {
  visible: boolean;
  onHidden?: () => void;
}

// 커스텀 스피너 컴포넌트 (ActivityIndicator 대체)
function CustomSpinner({ color, size = 40 }: { color: string; size?: number }) {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, [spinValue]);

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const dotSize = size * 0.2;
  const radius = size * 0.35;

  return (
    <Animated.View
      style={[
        styles.spinnerContainer,
        { width: size, height: size, transform: [{ rotate }] },
      ]}
    >
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i * 45 * Math.PI) / 180;
        const opacity = 0.3 + (i / 7) * 0.7;
        return (
          <View
            key={i}
            style={[
              styles.spinnerDot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: color,
                opacity,
                position: 'absolute',
                left: size / 2 - dotSize / 2 + Math.cos(angle) * radius,
                top: size / 2 - dotSize / 2 + Math.sin(angle) * radius,
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );
}

export default function CustomSplash({ visible, onHidden }: CustomSplashProps) {
  const colorScheme = useColorScheme();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const { splash } = APP_CONFIG;

  const backgroundColor = colorScheme === 'dark' 
    ? splash.darkBackgroundColor 
    : splash.backgroundColor;

  const textColor = colorScheme === 'dark' ? '#ffffff' : '#000000';
  const spinnerColor = colorScheme === 'dark' ? '#ffffff' : '#007AFF';

  useEffect(() => {
    if (!visible) {
      // 페이드 아웃 애니메이션
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: splash.fadeOutDuration,
        useNativeDriver: true,
      }).start(() => {
        onHidden?.();
      });
    }
  }, [visible, fadeAnim, onHidden, splash.fadeOutDuration]);

  if (!splash.enabled) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, opacity: fadeAnim },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {splash.logoImage && (
        <Image
          source={{ uri: splash.logoImage }}
          style={styles.logo}
          resizeMode="contain"
        />
      )}
      
      {splash.loadingText && (
        <Text style={[styles.loadingText, { color: textColor }]}>
          {splash.loadingText}
        </Text>
      )}
      
      {splash.showLoadingIndicator && (
        <CustomSpinner color={spinnerColor} size={40} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    marginBottom: 20,
  },
  spinnerContainer: {
    marginTop: 10,
  },
  spinnerDot: {},
});
