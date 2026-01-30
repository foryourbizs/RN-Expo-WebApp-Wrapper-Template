# 브릿지 API

Web ↔ App 양방향 통신 시스템

## 웹 → 앱

### AppBridge.send(action, payload?)
응답 없이 앱으로 메시지 전송

```javascript
AppBridge.send('ui:toast', { message: '완료!' });
AppBridge.send('ui:vibrate');
```

### AppBridge.call(action, payload?, timeout?)
앱으로 메시지 전송 후 응답 대기 (Promise)

```javascript
const device = await AppBridge.call('device:getInfo');
const app = await AppBridge.call('device:getAppInfo');
```

## 앱 → 웹

### AppBridge.on(action, callback)
앱에서 오는 메시지 리스너 등록

```javascript
AppBridge.on('push:onReceived', (payload) => {
  console.log('푸시:', payload.title);
});

// 모든 메시지 수신
AppBridge.on('*', (payload, message) => {
  console.log('액션:', message.action, payload);
});
```

### AppBridge.once(action, callback)
한 번만 수신 후 자동 해제

```javascript
AppBridge.once('initComplete', (data) => {
  console.log('초기화 완료:', data);
});
```

### AppBridge.waitFor(action, timeout?)
특정 메시지 대기 (Promise)

```javascript
const { payload } = await AppBridge.waitFor('userLogin', 30000);
```

### AppBridge.off(action, callback?)
리스너 해제

```javascript
AppBridge.off('push:onReceived', myHandler);
AppBridge.off('push:onReceived'); // 해당 액션의 모든 리스너 해제
```

## 유틸리티

### AppBridge.isApp()
앱 환경인지 확인

```javascript
if (window.AppBridge?.isApp()) {
  // 앱에서만 실행
}
```

## 내장 핸들러

| 플러그인 | 액션 | 응답 | 설명 |
|----------|------|------|------|
| device | getInfo | `{ platform, brand, modelName, ... }` | 디바이스 정보 |
| device | getAppInfo | `{ name, version, buildVersion, bundleId }` | 앱 정보 |
| ui | toast | - | 토스트 (iOS: Alert) |
| ui | vibrate | - | 진동 |
| clipboard | read | `{ text }` | 클립보드 읽기 |
| clipboard | copy | `{ success }` | 클립보드 복사 |
| webview | goBack | - | 뒤로가기 |
| webview | goForward | - | 앞으로가기 |
| webview | reload | - | 새로고침 |
| webview | openExternal | `{ success }` | 외부 URL 열기 |
| splash | hide | - | 스플래시 숨김 |
| orientation | get | `{ orientation, lock }` | 화면 방향 |
| orientation | set | `{ success, mode }` | 화면 방향 설정 |
| status-bar | get | `{ saved }` | 상태바 상태 |
| status-bar | set | `{ success, hidden, style }` | 상태바 설정 |
| status-bar | restore | `{ success, restored }` | 상태바 복원 |
| navigation-bar | get | `{ visible, buttonStyle, ... }` | 네비바 상태 (Android) |
| navigation-bar | set | `{ success }` | 네비바 설정 (Android) |
| push | requestPermission | `{ granted, token? }` | 푸시 권한 요청 |
| push | getToken | `{ token, type }` | 푸시 토큰 획득 |
| keep-awake | activate | `{ success, isActive }` | 화면 켜짐 유지 |
| keep-awake | deactivate | `{ success, isActive }` | 화면 켜짐 유지 해제 |
| keep-awake | get | `{ success, isActive }` | 상태 확인 |

> 네임스페이스는 `npm run config` → 플러그인 탭에서 변경 가능

## 이벤트

앱에서 웹으로 자동 전송되는 이벤트:

```javascript
// 푸시 수신
AppBridge.on('push:onReceived', ({ title, body, data }) => {
  console.log('푸시 도착:', title);
});

// 푸시 탭 (알림 클릭)
AppBridge.on('push:onOpened', ({ title, body, data }) => {
  console.log('푸시 열림:', title);
});
```

## 파일/바이너리 전송

Blob, File 객체는 자동으로 base64 변환:

```javascript
const file = new File(['content'], 'test.txt', { type: 'text/plain' });
await AppBridge.call('myHandler', { file });
// 앱에서는 { __type: 'base64', data: '...', mimeType: 'text/plain' } 형태로 수신
```
