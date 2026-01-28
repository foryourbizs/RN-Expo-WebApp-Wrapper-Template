# Platform Support

This document details the platform compatibility of RNWW built-in handlers and plugins.

## Built-in Handlers

| Handler | Action | Android | iOS | Notes |
|---------|--------|:-------:|:---:|-------|
| **device** | getDeviceInfo | ✅ | ✅ | |
| **ui** | showToast | ✅ | ✅ | |
| | vibrate | ✅ | ✅ | iOS uses Haptic Feedback |
| **clipboard** | readClipboard | ✅ | ✅ | |
| | writeClipboard | ✅ | ✅ | Sensitive action |
| **status-bar** | setStatusBar | ✅ | ⚠️ | `color` Android only |
| | getStatusBar | ✅ | ✅ | |
| | restoreStatusBar | ✅ | ✅ | |
| **navigation-bar** | setNavigationBar | ✅ | ❌ | Android only |
| | getNavigationBar | ✅ | ❌ | Android only |
| | restoreNavigationBar | ✅ | ❌ | Android only |
| **orientation** | setOrientation | ✅ | ✅ | |
| | getOrientation | ✅ | ✅ | |
| | unlockOrientation | ✅ | ✅ | |
| **keep-awake** | activateKeepAwake | ✅ | ✅ | |
| | deactivateKeepAwake | ✅ | ✅ | |
| **splash** | hideSplash | ✅ | ✅ | |
| **webview** | openExternalUrl | ✅ | ✅ | |
| | reload | ✅ | ✅ | |
| | goBack | ✅ | ✅ | |
| | goForward | ✅ | ✅ | |
| **screen-pinning** | All actions | ✅ | ❌ | Android only (plugin) |

**Legend:**
- ✅ Fully supported
- ⚠️ Partially supported (see notes)
- ❌ Not supported

## Plugin Support

| Plugin | Android | iOS | Notes |
|--------|:-------:|:---:|-------|
| rnww-plugin-camera | ✅ | ✅ | |
| rnww-plugin-microphone | ✅ | ✅ | |
| rnww-plugin-screen-pinning | ✅ | ❌ | Android only |
| push (built-in) | ✅ | ✅ | expo-notifications based |
| update (built-in) | ✅ | ✅ | expo-application based |
| security (built-in) | ✅ | ✅ | expo-device based |

## Push Notifications (push:*)

| Action | Android | iOS | Notes |
|--------|:-------:|:---:|-------|
| push:requestPermission | ✅ | ✅ | Returns { granted, token } |
| push:getToken | ✅ | ✅ | Returns { token, type } |
| push:onReceived | ✅ | ✅ | App→Web event (foreground) |
| push:onOpened | ✅ | ✅ | App→Web event (notification tap) |

### Push Usage Example

```javascript
// 권한 요청 및 토큰 받기
const result = await AppBridge.call('push:requestPermission');
if (result.granted) {
  console.log('Push token:', result.token);
  // 서버에 토큰 등록
  await fetch('/api/register-token', {
    method: 'POST',
    body: JSON.stringify({ token: result.token })
  });
}

// 알림 수신 이벤트 (앱이 포그라운드일 때)
AppBridge.on('push:onReceived', (payload) => {
  console.log('Notification received:', payload.title, payload.body);
  // 인앱 알림 표시
});

// 알림 탭 이벤트 (사용자가 알림을 탭했을 때)
AppBridge.on('push:onOpened', (payload) => {
  console.log('User tapped notification:', payload.data);
  // payload.data를 기반으로 특정 화면으로 이동
});
```

### Push Token Types

- `expo`: Expo Push Token (Expo 서버 경유)
- `fcm`: Firebase Cloud Messaging (Android)
- `apns`: Apple Push Notification Service (iOS)

## Security Plugin (sec:*)

| Action | Android | iOS | Notes |
|--------|:-------:|:---:|-------|
| sec:checkRoot | ✅ | ✅ | Detect root/jailbreak |
| sec:checkIntegrity | ✅ | ✅ | App integrity check |
| sec:check | ✅ | ✅ | Comprehensive security check |
| sec:getEnvironment | ✅ | ✅ | Get device environment info |

### Security Usage Example

```javascript
// 종합 보안 체크
const security = await AppBridge.call('sec:check');

if (!security.isSecure) {
  console.log('Security issues detected:', security.failedChecks);

  if (security.isRooted) {
    alert('This device appears to be rooted/jailbroken');
  }

  if (security.isEmulator) {
    alert('Running on emulator is not allowed');
  }

  if (security.isDebugging) {
    console.log('Debug mode detected');
  }
}

// Root/Jailbreak만 체크
const rootCheck = await AppBridge.call('sec:checkRoot');
if (rootCheck.isRooted) {
  console.log('Root indicators:', rootCheck.indicators);
}

// 환경 정보 확인
const env = await AppBridge.call('sec:getEnvironment');
console.log('Platform:', env.platform);
console.log('Is real device:', env.isDevice);
```

## Update Plugin (upd:*)

| Action | Android | iOS | Notes |
|--------|:-------:|:---:|-------|
| upd:getAppInfo | ✅ | ✅ | Returns app version info |
| upd:check | ✅ | ✅ | Check for updates |
| upd:openStore | ✅ | ✅ | Open app store |

### Update Usage Example

```javascript
// 앱 정보 가져오기
const appInfo = await AppBridge.call('upd:getAppInfo');
console.log('Version:', appInfo.version);
console.log('Build:', appInfo.buildNumber);

// 업데이트 체크 (커스텀 API 사용)
const update = await AppBridge.call('upd:check', {
  endpoint: 'https://api.example.com/version'
});

if (update.available) {
  if (update.isForced) {
    // 강제 업데이트 UI 표시
    alert('업데이트가 필요합니다. 스토어로 이동합니다.');
    await AppBridge.call('upd:openStore');
  } else {
    // 선택적 업데이트 안내
    const userWants = confirm(`새 버전 ${update.latestVersion}이 있습니다. 업데이트하시겠습니까?`);
    if (userWants) {
      await AppBridge.call('upd:openStore');
    }
  }
}

// 최신 버전을 직접 지정하여 체크
const quickCheck = await AppBridge.call('upd:check', {
  latestVersion: '2.0.0'
});
```

## Platform-Specific Notes

### Status Bar (iOS)

- `setStatusBar({ color })` is **ignored on iOS** (system limitation)
- Use `style: 'light-content' | 'dark-content'` for icon colors
- `hidden` and `style` work on both platforms

```javascript
// Cross-platform safe usage
AppBridge.call('setStatusBar', {
  hidden: false,
  style: 'light-content',
  // color: '#000000' // Only works on Android
});
```

### Navigation Bar (Android Only)

iOS does not have a software navigation bar. When called on iOS, these actions will return:

```javascript
{
  success: false,
  error: "Navigation Bar is not supported on ios",
  platform: "ios"
}
```

For iOS notch/safe area handling, use CSS `env(safe-area-inset-*)` or React Native's `SafeAreaView`.

### Haptics / Vibration

- **Android**: Uses system vibration API
- **iOS**: Uses Haptic Engine (`UIImpactFeedbackGenerator`)
- Both platforms support the `vibrate` action, but the feel may differ

### Screen Pinning (Android Only)

Task locking (kiosk mode) is only available on Android. iOS does not support app pinning at the OS level.

For iOS kiosk solutions:
- Use Guided Access (device setting, requires manual setup)
- Consider MDM solutions for enterprise deployments

## Checking Platform Support at Runtime

Use the Bridge to check platform support:

```javascript
// Get device info including platform
const info = await AppBridge.call('getDeviceInfo');
console.log(info.platform); // 'android' or 'ios'

// Platform-specific code
if (info.platform === 'android') {
  await AppBridge.call('setNavigationBar', { visible: false });
}
```

## Sensitive Actions

The following actions are classified as sensitive and may require additional verification in future versions:

- `cam:*` - All camera actions
- `mic:*` - All microphone actions
- `writeClipboard` - Clipboard write
- `fs:*` - File system operations (future)

## Version History

| Version | Changes |
|---------|---------|
| 2.4.0 | Added security plugin (root/jailbreak detection) |
| 2.3.0 | Added update plugin (expo-application) |
| 2.2.0 | Added push notification plugin (expo-notifications) |
| 2.1.0 | Added security layers, nonce validation |
| 2.0.0 | Initial platform support documentation |
