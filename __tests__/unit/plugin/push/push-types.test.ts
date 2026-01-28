// __tests__/unit/plugin/push/push-types.test.ts
import {
  PushPluginConfig,
  PushPermissionResult,
  PushTokenResult,
  PushNotificationPayload,
  PUSH_PLUGIN_KEY
} from '@/lib/bridges/push';

describe('Push Plugin Types', () => {
  it('should have correct plugin key', () => {
    expect(PUSH_PLUGIN_KEY).toBe('push');
  });

  it('should define PushPluginConfig interface', () => {
    const config: PushPluginConfig = {
      android: {
        channelId: 'default',
        channelName: '알림',
      },
      ios: {
        requestPermissionOnInit: false,
      },
    };

    expect(config.android.channelId).toBe('default');
    expect(config.ios.requestPermissionOnInit).toBe(false);
  });

  it('should define PushPermissionResult interface', () => {
    const result: PushPermissionResult = {
      granted: true,
      token: 'test-token',
    };

    expect(result.granted).toBe(true);
    expect(result.token).toBe('test-token');
  });

  it('should define PushTokenResult interface', () => {
    const result: PushTokenResult = {
      token: 'test-token',
      type: 'expo',
    };

    expect(result.token).toBe('test-token');
  });

  it('should define PushNotificationPayload interface', () => {
    const payload: PushNotificationPayload = {
      title: 'Test Title',
      body: 'Test Body',
      data: { key: 'value' },
    };

    expect(payload.title).toBe('Test Title');
    expect(payload.data?.key).toBe('value');
  });
});
