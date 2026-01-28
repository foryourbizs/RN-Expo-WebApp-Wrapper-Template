// lib/bridges/push/handlers.ts
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';
import {
  PushPermissionResult,
  PushTokenResult,
  PushNotificationPayload,
} from './types';

// 알림 수신 시 처리 방식 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Expo 푸시 토큰 가져오기
 */
const getExpoPushToken = async (): Promise<PushTokenResult | null> => {
  if (!Device.isDevice) {
    console.warn('[Push] Must use physical device for push notifications');
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return {
      token: tokenData.data,
      type: 'expo',
    };
  } catch (error) {
    console.error('[Push] Failed to get push token:', error);
    return null;
  }
};

/**
 * Android 알림 채널 설정
 */
const setupAndroidChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
};

/**
 * 푸시 핸들러 등록
 */
export const registerPushHandlers = (bridge: BridgeAPI, _platform: PlatformInfo) => {
  const { registerHandler, sendToWeb } = bridge;

  // Android 채널 설정
  setupAndroidChannel();

  // 권한 요청 핸들러
  registerHandler<void, PushPermissionResult>('requestPermission', async (_, respond) => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        respond({ granted: false, error: 'Permission not granted' });
        return;
      }

      const tokenResult = await getExpoPushToken();

      respond({
        granted: true,
        token: tokenResult?.token,
      });
    } catch (error) {
      respond({
        granted: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // 토큰 가져오기 핸들러
  registerHandler<void, PushTokenResult | { error: string }>('getToken', async (_, respond) => {
    try {
      const { status } = await Notifications.getPermissionsAsync();

      if (status !== 'granted') {
        respond({ error: 'Permission not granted' } as { error: string });
        return;
      }

      const tokenResult = await getExpoPushToken();

      if (!tokenResult) {
        respond({ error: 'Failed to get token' } as { error: string });
        return;
      }

      respond(tokenResult);
    } catch (error) {
      respond({ error: error instanceof Error ? error.message : 'Unknown error' } as { error: string });
    }
  });

  // 알림 수신 리스너 설정
  Notifications.addNotificationReceivedListener((notification) => {
    const payload: PushNotificationPayload = {
      title: notification.request.content.title ?? undefined,
      body: notification.request.content.body ?? undefined,
      data: notification.request.content.data,
      notificationId: notification.request.identifier,
    };

    sendToWeb('onReceived', payload);
  });

  // 알림 탭 리스너 설정
  Notifications.addNotificationResponseReceivedListener((response) => {
    const payload: PushNotificationPayload = {
      title: response.notification.request.content.title ?? undefined,
      body: response.notification.request.content.body ?? undefined,
      data: response.notification.request.content.data,
      notificationId: response.notification.request.identifier,
    };

    sendToWeb('onOpened', payload);
  });

  console.log('[Push] Handlers registered');
};
