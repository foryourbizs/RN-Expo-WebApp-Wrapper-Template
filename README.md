# React Native WebApp Wrapper

웹의 생산성과 네이티브의 강력함을 결합하는 React Native + Expo 템플릿

## Why?

웹 기술의 생산성은 압도적입니다. HTML/CSS/JavaScript로 만든 UI는 어떤 플랫폼에서도 동일하게 작동하고, 개발 속도도 빠릅니다.

하지만 웹에는 한계가 있습니다:
- 카메라, 마이크 접근 제한
- 푸시 알림 미지원
- 백그라운드 실행 불가
- 기기 정보 접근 불가

**이 프로젝트는 그 한계를 JavaScript 한 줄로 해결합니다.**

```javascript
// 웹에서 네이티브 카메라 실행
const photo = await AppBridge.call('camera:capture');

// 푸시 토큰 획득
const { token } = await AppBridge.call('push:requestPermission');

// 기기 정보
const device = await AppBridge.call('device:getInfo');
```

기존 웹앱 코드를 그대로 사용하면서, 필요한 곳에 JavaScript 한 줄만 추가하면 네이티브 기능을 사용할 수 있습니다.

## Quick Start

```bash
npm install
npm run config  # 웹 UI에서 모든 설정
npx expo start
```

## 핵심 기능

### 1. 양방향 브릿지

**웹 → 앱**
```javascript
// 단방향 (응답 없음)
AppBridge.send('ui:toast', { message: '저장 완료' });

// 요청-응답 (Promise)
const result = await AppBridge.call('device:getInfo');
```

**앱 → 웹**
```javascript
// 이벤트 수신
AppBridge.on('push:onReceived', (payload) => {
  console.log('푸시 도착:', payload.title);
});

// 한 번만 수신
AppBridge.once('initComplete', (data) => { ... });

// Promise로 대기
const { payload } = await AppBridge.waitFor('userLogin', 30000);
```

### 2. 플러그인 시스템

네임스페이스로 깔끔하게 관리:

```javascript
// 카메라 (namespace: camera)
await AppBridge.call('camera:capture');
await AppBridge.call('camera:startStream', { fps: 15 });

// 푸시 (namespace: push)
await AppBridge.call('push:requestPermission');

// 마이크 (namespace: mic)
await AppBridge.call('mic:start');
```

네임스페이스는 `npm run config` → 플러그인 탭에서 자유롭게 설정 가능합니다.

npm 플러그인 설치:
```bash
npm install rnww-plugin-camera
npm install rnww-plugin-bluetooth
```

### 3. 보안

- **토큰 검증**: 외부 주입 공격 차단
- **Nonce 검증**: 리플레이 공격 방지
- **URL 화이트리스트**: 허용된 도메인만 접근
- **Rate Limiting**: 과도한 요청 차단
- **자동 락다운**: 공격 감지 시 30초간 브릿지 차단

```javascript
// 앱에서 설정
security: {
  allowedOrigins: ['https://myapp.com'],
  blockedSchemes: ['javascript', 'vbscript'],
}
```

### 4. 설정

모든 설정은 웹 UI에서:
```bash
npm run config
```

| 탭 | 설명 |
|---|------|
| 앱 설정 | URL, 상태바, 스플래시, 오프라인 |
| 테마 | 라이트/다크 모드 |
| 플러그인 | npm 설치 및 관리 |
| 빌드 | 환경 확인, 키스토어, APK/AAB |

## 내장 핸들러

내장 플러그인 (네임스페이스는 설정에서 변경 가능):

| 플러그인 | 액션 | 설명 |
|----------|------|------|
| device | getInfo, getAppInfo | 기기/앱 정보 |
| ui | toast, vibrate | UI 피드백 |
| clipboard | copy, read | 클립보드 |
| status-bar | get, set | 상태바 제어 |
| navigation-bar | get, set | 네비게이션바 (Android) |
| orientation | get, set, lock | 화면 방향 |
| splash | hide | 스플래시 제어 |
| push | requestPermission, getToken, onReceived | 푸시 알림 |
| webview | goBack, goForward, reload | 웹뷰 네비게이션 |
| keep-awake | activate, deactivate, get | 화면 켜짐 유지 |

npm 플러그인:

| 패키지 | 설명 |
|--------|------|
| rnww-plugin-camera | 카메라 촬영, 스트리밍 |
| rnww-plugin-microphone | 마이크 녹음, 스트리밍 |
| rnww-plugin-bluetooth | 블루투스 연결 |
| rnww-plugin-wifi | WiFi 스캔, 연결 |
| rnww-plugin-screen-pinning | 앱 고정 (키오스크) |
| rnww-plugin-background | 백그라운드 작업 |

## 웹에서 타입 지원

```bash
npm install rn-webwrapper-bridge-types --save-dev
```

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "types": ["rn-webwrapper-bridge-types"]
  }
}

// 이제 타입 지원
const device = await AppBridge.call<DeviceInfo>('device:getInfo');
```

## 빌드

### 웹 UI (권장)
```bash
npm run config  # 빌드 탭
```

### CLI
```bash
# Windows
.\build.bat

# 수동
npx expo prebuild --clean
cd android && .\gradlew assembleRelease
```

## 커스텀 핸들러 추가

`lib/bridges/my-feature/index.ts`:
```typescript
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

export const registerMyFeatureHandlers = (bridge: BridgeAPI, platform: PlatformInfo) => {
  const { registerHandler, sendToWeb } = bridge;

  // 웹에서 호출: AppBridge.call('myf:doSomething')
  registerHandler('doSomething', async (payload, respond) => {
    const result = await doNativeWork(payload);
    respond({ success: true, data: result });
  });

  // 앱에서 웹으로 이벤트 전송
  sendToWeb('onStatusChange', { status: 'ready' });
};
```

`constants/plugins.config.ts`에 등록:
```typescript
manual: [
  { path: './my-feature', namespace: 'myf' },
]
```

## 적합한 프로젝트

- 기존 웹앱을 앱스토어에 배포해야 할 때
- 웹 개발팀이 앱 기능을 추가해야 할 때
- PWA의 한계를 넘어서야 할 때
- 네이티브 개발 리소스가 부족할 때

## License

MIT
