// lib/web-sdk/app-bridge.ts
import { AppBridgeMessage, AppBridgeListener } from './types';

/**
 * AppBridge 인터페이스
 * 웹에서 React Native 앱과 통신하기 위한 브릿지
 */
export interface IAppBridge {
  /**
   * 앱으로 메시지 전송 (응답 없음)
   * @param action - 액션명 (예: 'showToast', 'cam:start')
   * @param payload - 전송할 데이터
   * @example
   * AppBridge.send('showToast', { message: 'Hello!' });
   */
  send(action: string, payload?: Record<string, unknown>): void;

  /**
   * 앱으로 메시지 전송 후 응답 대기
   * @param action - 액션명
   * @param payload - 전송할 데이터
   * @param timeout - 타임아웃 (ms, 기본 10000)
   * @returns Promise with response data
   * @example
   * const info = await AppBridge.call('getDeviceInfo');
   * console.log(info.platform); // 'android' or 'ios'
   */
  call<T = unknown>(
    action: string,
    payload?: Record<string, unknown>,
    timeout?: number
  ): Promise<T>;

  /**
   * 앱에서 오는 이벤트 리스너 등록
   * @param action - 액션명 또는 '*' (모든 이벤트)
   * @param callback - 콜백 함수
   * @example
   * AppBridge.on('push:onReceived', (payload) => {
   *   console.log('Push received:', payload.title);
   * });
   */
  on<T = unknown>(action: string, callback: AppBridgeListener<T>): void;

  /**
   * 한 번만 이벤트 수신 후 자동 해제
   * @param action - 액션명
   * @param callback - 콜백 함수
   */
  once<T = unknown>(action: string, callback: AppBridgeListener<T>): void;

  /**
   * 이벤트 리스너 해제
   * @param action - 액션명
   * @param callback - 해제할 콜백 (없으면 해당 액션의 모든 리스너 해제)
   */
  off(action: string, callback?: AppBridgeListener): void;

  /**
   * 특정 이벤트를 Promise로 대기
   * @param action - 액션명
   * @param timeout - 타임아웃 (ms, 기본 10000)
   * @returns Promise with payload and message
   * @example
   * const { payload } = await AppBridge.waitFor('link:onReceived', 30000);
   * console.log('Deeplink received:', payload.url);
   */
  waitFor<T = unknown>(
    action: string,
    timeout?: number
  ): Promise<{ payload: T; message: AppBridgeMessage }>;

  /**
   * 앱 환경 여부 확인
   * @returns true if running in React Native WebView
   */
  isApp(): boolean;

  /**
   * SDK 버전
   */
  readonly version: string;
}

/**
 * Window 객체에 AppBridge 타입 선언 (전역 타입용)
 */
declare global {
  interface Window {
    AppBridge?: IAppBridge;
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}
