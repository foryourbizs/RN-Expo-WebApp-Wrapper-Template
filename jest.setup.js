// jest.setup.js
import '@testing-library/jest-native/extend-expect';

// React Native WebView 모킹
jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

// Console 정리 (테스트 시 불필요한 로그 제거)
// jest-expo와 충돌 방지를 위해 spyOn 사용
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'debug').mockImplementation(() => {});
jest.spyOn(console, 'info').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
// console.error는 테스트 디버깅을 위해 유지
