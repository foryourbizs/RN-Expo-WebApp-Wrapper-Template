/**
 * 메인 홈 스크린 - WebView 컨테이너
 * 단일 웹 세션으로 https://gdjs.link/ 표시
 */

import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import WebViewContainer from '@/components/webview-container';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WebViewContainer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
