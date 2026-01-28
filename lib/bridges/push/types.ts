// lib/bridges/push/types.ts

/**
 * 푸시 플러그인 키
 */
export const PUSH_PLUGIN_KEY = 'push';

/**
 * Android 푸시 설정
 */
export interface AndroidPushConfig {
  /** 알림 채널 ID */
  channelId: string;
  /** 알림 채널 이름 */
  channelName: string;
  /** 알림 채널 설명 (선택) */
  channelDescription?: string;
  /** 알림 아이콘 (선택) */
  icon?: string;
  /** 알림 색상 (선택) */
  color?: string;
}

/**
 * iOS 푸시 설정
 */
export interface iOSPushConfig {
  /** 앱 시작 시 권한 요청 여부 */
  requestPermissionOnInit: boolean;
}

/**
 * 푸시 플러그인 설정
 */
export interface PushPluginConfig {
  android: AndroidPushConfig;
  ios: iOSPushConfig;
}

/**
 * 푸시 권한 요청 결과
 */
export interface PushPermissionResult {
  /** 권한 허용 여부 */
  granted: boolean;
  /** 푸시 토큰 (권한 허용 시) */
  token?: string;
  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 푸시 토큰 결과
 */
export interface PushTokenResult {
  /** 푸시 토큰 */
  token: string;
  /** 토큰 타입 */
  type: 'expo' | 'fcm' | 'apns';
}

/**
 * 푸시 알림 페이로드
 */
export interface PushNotificationPayload {
  /** 알림 제목 */
  title?: string;
  /** 알림 본문 */
  body?: string;
  /** 커스텀 데이터 */
  data?: Record<string, unknown>;
  /** 알림 ID (선택) */
  notificationId?: string;
}

/**
 * 푸시 알림 이벤트 타입
 */
export type PushEventType = 'received' | 'opened' | 'dismissed';
