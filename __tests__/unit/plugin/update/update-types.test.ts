// __tests__/unit/plugin/update/update-types.test.ts
import {
  UPDATE_PLUGIN_KEY,
  UpdateCheckResult,
  UpdateConfig,
} from '@/lib/bridges/update';

describe('Update Plugin Types', () => {
  it('should have correct plugin key', () => {
    expect(UPDATE_PLUGIN_KEY).toBe('upd');
  });

  it('should define UpdateCheckResult interface', () => {
    const result: UpdateCheckResult = {
      available: true,
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      isForced: false,
      storeUrl: 'https://play.google.com/store/apps/details?id=com.example',
    };

    expect(result.available).toBe(true);
  });

  it('should define UpdateConfig interface', () => {
    const config: UpdateConfig = {
      checkEndpoint: 'https://api.example.com/version',
      iosAppId: '123456789',
      androidPackageName: 'com.example.app',
      forceUpdateVersions: ['1.0.0'],
    };

    expect(config.checkEndpoint).toBeDefined();
  });
});
