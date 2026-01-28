# RNWW API Reference

> Web 개발자를 위한 AppBridge API 문서

## 목차

- [초기화](#초기화)
- [기본 메서드](#기본-메서드)
- [빌트인 액션](#빌트인-액션)
- [플러그인 액션](#플러그인-액션)

---

## 초기화

AppBridge는 WebView가 로드될 때 자동으로 주입됩니다.
`AppBridgeReady` 이벤트를 통해 초기화 완료를 감지할 수 있습니다.

```javascript
// 초기화 대기
window.addEventListener('AppBridgeReady', () => {
  console.log('AppBridge is ready!');
  console.log('Running in app:', AppBridge.isApp());
  console.log('SDK version:', AppBridge.version);
});

// 앱 환경 체크
if (window.AppBridge && AppBridge.isApp()) {
  // 앱에서만 실행되는 코드
} else {
  // 웹 브라우저 대체 로직
}
```

---

## 기본 메서드

### send(action, payload?)

앱으로 메시지를 전송합니다. 응답을 기다리지 않습니다.

```javascript
// 토스트 표시
AppBridge.send('showToast', { message: 'Hello!' });

// 진동
AppBridge.send('vibrate', { duration: 100 });
```

### call(action, payload?, timeout?)

앱으로 메시지를 전송하고 응답을 기다립니다.

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| action | string | - | 액션명 |
| payload | object | {} | 전송 데이터 |
| timeout | number | 10000 | 타임아웃 (ms) |

```javascript
// 디바이스 정보 가져오기
const deviceInfo = await AppBridge.call('getDeviceInfo');
console.log(deviceInfo.platform); // 'android' or 'ios'
console.log(deviceInfo.model);

// 타임아웃 지정
try {
  const result = await AppBridge.call('someAction', { data: 'value' }, 5000);
} catch (error) {
  console.error('Timeout or error:', error.message);
}
```

### on(action, callback)

앱에서 오는 이벤트를 수신합니다.

```javascript
// 푸시 알림 수신
AppBridge.on('push:onReceived', (payload) => {
  console.log('Push received:', payload.title, payload.body);
});

// 모든 이벤트 수신 (와일드카드)
AppBridge.on('*', (payload, message) => {
  console.log('Event:', message.action, payload);
});
```

### once(action, callback)

이벤트를 한 번만 수신하고 자동으로 리스너를 해제합니다.

```javascript
AppBridge.once('link:onReceived', (payload) => {
  console.log('Deeplink (once):', payload.url);
});
```

### off(action, callback?)

등록된 리스너를 해제합니다.

```javascript
const handler = (payload) => console.log(payload);

// 리스너 등록
AppBridge.on('someEvent', handler);

// 특정 리스너 해제
AppBridge.off('someEvent', handler);

// 해당 액션의 모든 리스너 해제
AppBridge.off('someEvent');
```

### waitFor(action, timeout?)

이벤트를 Promise로 대기합니다.

```javascript
try {
  const { payload, message } = await AppBridge.waitFor('link:onReceived', 30000);
  console.log('Deeplink:', payload.url);
} catch (error) {
  console.log('Timeout waiting for deeplink');
}
```

### isApp()

현재 환경이 React Native WebView인지 확인합니다.

```javascript
if (AppBridge.isApp()) {
  // 네이티브 기능 사용
  const info = await AppBridge.call('getDeviceInfo');
} else {
  // 웹 브라우저 대체 로직
  console.log('Running in web browser');
}
```

---

## 빌트인 액션

### Device

| 액션 | 설명 | 페이로드 | 응답 |
|------|------|----------|------|
| getDeviceInfo | 디바이스 정보 | - | { platform, model, osVersion, ... } |

```javascript
const info = await AppBridge.call('getDeviceInfo');
// {
//   platform: 'android',
//   model: 'Pixel 6',
//   osVersion: '13',
//   appVersion: '1.0.0',
//   ...
// }
```

### UI

| 액션 | 설명 | 페이로드 | 응답 |
|------|------|----------|------|
| showToast | 토스트 메시지 | { message, duration? } | - |
| vibrate | 진동 | { duration? } | - |

```javascript
AppBridge.send('showToast', { message: '저장되었습니다' });
AppBridge.send('vibrate', { duration: 100 });
```

### Clipboard

| 액션 | 설명 | 페이로드 | 응답 |
|------|------|----------|------|
| readClipboard | 클립보드 읽기 | - | { text } |
| writeClipboard | 클립보드 쓰기 | { text } | { success } |

```javascript
// 읽기
const { text } = await AppBridge.call('readClipboard');

// 쓰기
await AppBridge.call('writeClipboard', { text: '복사할 텍스트' });
```

### Status Bar

| 액션 | 설명 | 페이로드 | 응답 |
|------|------|----------|------|
| setStatusBar | 상태바 설정 | { hidden?, style?, color? } | - |
| getStatusBar | 상태바 정보 | - | { hidden, style, color } |
| restoreStatusBar | 상태바 복원 | - | - |

```javascript
// 상태바 숨기기
await AppBridge.call('setStatusBar', { hidden: true });

// 스타일 변경
await AppBridge.call('setStatusBar', {
  style: 'light-content',  // 'default' | 'light-content' | 'dark-content'
  color: '#000000'         // Android only
});
```

### Navigation Bar (Android Only)

| 액션 | 설명 | 페이로드 | 응답 |
|------|------|----------|------|
| setNavigationBar | 네비게이션바 설정 | { visible?, color? } | - |
| getNavigationBar | 네비게이션바 정보 | - | { visible, color } |
| restoreNavigationBar | 네비게이션바 복원 | - | - |

### Orientation

| 액션 | 설명 | 페이로드 | 응답 |
|------|------|----------|------|
| setOrientation | 화면 방향 고정 | { orientation } | - |
| getOrientation | 현재 방향 | - | { orientation } |
| unlockOrientation | 방향 잠금 해제 | - | - |

```javascript
// 세로 고정
await AppBridge.call('setOrientation', { orientation: 'portrait' });

// 가로 고정
await AppBridge.call('setOrientation', { orientation: 'landscape' });

// 잠금 해제
await AppBridge.call('unlockOrientation');
```

### Keep Awake

| 액션 | 설명 | 페이로드 | 응답 |
|------|------|----------|------|
| activateKeepAwake | 화면 켜짐 유지 | - | - |
| deactivateKeepAwake | 화면 켜짐 해제 | - | - |

### WebView

| 액션 | 설명 | 페이로드 | 응답 |
|------|------|----------|------|
| openExternalUrl | 외부 브라우저로 열기 | { url } | - |
| reload | 페이지 새로고침 | - | - |
| goBack | 뒤로 가기 | - | - |
| goForward | 앞으로 가기 | - | - |

```javascript
// 외부 링크 열기
AppBridge.send('openExternalUrl', { url: 'https://example.com' });

// 새로고침
AppBridge.send('reload');
```

---

## 플러그인 액션

플러그인 액션은 `namespace:action` 형식을 사용합니다.

### Push (push:*)

```javascript
// 권한 요청 및 토큰 획득
const result = await AppBridge.call('push:requestPermission');
if (result.granted) {
  console.log('Token:', result.token);
  // 서버에 토큰 등록
  await fetch('/api/register-token', {
    method: 'POST',
    body: JSON.stringify({ token: result.token })
  });
}

// 토큰만 가져오기 (이미 권한 있는 경우)
const { token, type } = await AppBridge.call('push:getToken');
// type: 'expo' | 'fcm' | 'apns'

// 알림 수신 이벤트 (포그라운드)
AppBridge.on('push:onReceived', (payload) => {
  console.log('Notification:', payload.title, payload.body);
  // 인앱 알림 표시
});

// 알림 탭 이벤트
AppBridge.on('push:onOpened', (payload) => {
  console.log('User tapped:', payload.data);
  // 특정 화면으로 이동
  if (payload.data.screen) {
    router.push(payload.data.screen);
  }
});
```

### Update (upd:*)

```javascript
// 앱 정보 가져오기
const info = await AppBridge.call('upd:getAppInfo');
console.log('Version:', info.version);     // '1.0.0'
console.log('Build:', info.buildNumber);   // '1'
console.log('App Name:', info.appName);
console.log('Bundle ID:', info.bundleId);

// 업데이트 체크 (커스텀 API 사용)
const update = await AppBridge.call('upd:check', {
  endpoint: 'https://api.example.com/version'
});

if (update.available) {
  if (update.isForced) {
    // 강제 업데이트
    alert('앱 업데이트가 필요합니다.');
    await AppBridge.call('upd:openStore');
  } else {
    // 선택적 업데이트
    if (confirm(`새 버전 ${update.latestVersion}이 있습니다. 업데이트하시겠습니까?`)) {
      await AppBridge.call('upd:openStore');
    }
  }
}

// 직접 버전 비교
const quickCheck = await AppBridge.call('upd:check', {
  latestVersion: '2.0.0'
});
```

### Security (sec:*)

```javascript
// 종합 보안 체크
const security = await AppBridge.call('sec:check');
console.log('Is Secure:', security.isSecure);
console.log('Is Rooted:', security.isRooted);
console.log('Is Debugging:', security.isDebugging);
console.log('Is Emulator:', security.isEmulator);

if (!security.isSecure) {
  console.log('Failed checks:', security.failedChecks);

  if (security.isRooted) {
    alert('루팅된 기기에서는 사용할 수 없습니다.');
  }

  if (security.isEmulator) {
    alert('에뮬레이터에서는 사용할 수 없습니다.');
  }
}

// Root/Jailbreak만 체크
const root = await AppBridge.call('sec:checkRoot');
if (root.isRooted) {
  console.log('Root indicators:', root.indicators);
}

// 환경 정보 확인
const env = await AppBridge.call('sec:getEnvironment');
console.log('Platform:', env.platform);      // 'android' | 'ios'
console.log('Is Device:', env.isDevice);     // true if real device
console.log('Brand:', env.brand);
console.log('Model:', env.model);
```

### Camera (cam:*)

```javascript
// 카메라 시작
await AppBridge.call('cam:start', {
  facing: 'back',    // 'front' | 'back'
  quality: 'high'    // 'low' | 'medium' | 'high'
});

// 프레임 수신
AppBridge.on('cam:onFrame', (frame) => {
  // frame.data: base64 이미지 데이터
  const img = document.getElementById('preview');
  img.src = `data:image/jpeg;base64,${frame.data}`;
});

// 사진 촬영
const photo = await AppBridge.call('cam:capture');
console.log('Photo:', photo.uri);

// 카메라 정지
await AppBridge.call('cam:stop');
```

### Microphone (mic:*)

```javascript
// 녹음 시작
await AppBridge.call('mic:start');

// 오디오 데이터 수신
AppBridge.on('mic:onData', (audio) => {
  // audio.data: base64 오디오 데이터
  processAudio(audio.data);
});

// 녹음 정지
await AppBridge.call('mic:stop');
```

### Screen Pinning (pin:*) - Android Only

```javascript
// 화면 고정 시작
await AppBridge.call('pin:start');

// 상태 확인
const status = await AppBridge.call('pin:getStatus');
console.log('Is Pinned:', status.isPinned);

// 화면 고정 해제
await AppBridge.call('pin:stop');
```

---

## 에러 처리

```javascript
try {
  const result = await AppBridge.call('someAction');
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('Request timed out');
  } else {
    console.log('Error:', error.message);
  }
}
```

---

## TypeScript 지원

Web SDK는 TypeScript 타입 정의를 제공합니다.

```typescript
import type {
  IAppBridge,
  AppBridgeMessage,
  AppBridgeListener
} from '@/lib/web-sdk';

// 타입 안전한 응답 처리
interface DeviceInfo {
  platform: 'android' | 'ios';
  model: string;
  osVersion: string;
}

const info = await AppBridge.call<DeviceInfo>('getDeviceInfo');
```

---

## 버전 히스토리

| 버전 | 변경사항 |
|------|----------|
| 3.0.0 | Web SDK 타입 정의 추가, API 문서화 |
| 2.4.0 | Security 플러그인 추가 |
| 2.3.0 | Update 플러그인 추가 |
| 2.2.0 | Push 플러그인 추가 |
| 2.1.0 | 보안 강화 (토큰 은닉, nonce 검증) |
