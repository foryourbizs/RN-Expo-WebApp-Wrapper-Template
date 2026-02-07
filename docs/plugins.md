# 플러그인

## 플러그인 관리

```bash
npm run config  # 플러그인 탭
```

웹 UI에서:
- npm 플러그인 검색 및 설치
- 플러그인 활성화/비활성화
- 네임스페이스 설정

## 플러그인 종류

### Auto 플러그인 (npm)
npm에서 설치하는 외부 플러그인

```bash
npm install rnww-plugin-camera
npm install rnww-plugin-microphone
npm install rnww-plugin-bluetooth
```

### Manual 플러그인 (로컬)
`lib/bridges/` 폴더에 직접 작성하는 플러그인

## 사용 가능한 npm 플러그인

| 패키지 | 설명 |
|--------|------|
| `rnww-plugin-camera` | 카메라 (사진, 스트리밍) |
| `rnww-plugin-microphone` | 마이크 (녹음, 스트리밍) |
| `rnww-plugin-bluetooth` | 블루투스 |
| `rnww-plugin-wifi` | WiFi |
| `rnww-plugin-screen-pinning` | 앱 고정 (키오스크 모드) |
| `rnww-plugin-background` | 백그라운드 작업 |
| `rnww-plugin-gps` | GPS/위치 |

> npm에서 `rnww-plugin-` 으로 검색하면 더 많은 플러그인을 찾을 수 있습니다.

## 커스텀 핸들러 추가

### 1. 핸들러 파일 생성

`lib/bridges/my-feature/index.ts`:

```typescript
import { BridgeAPI, PlatformInfo } from '@/lib/plugin-system';

export const registerMyFeatureHandlers = (bridge: BridgeAPI, platform: PlatformInfo) => {
  const { registerHandler, sendToWeb } = bridge;

  // 웹에서 호출 가능한 핸들러
  registerHandler('doSomething', async (payload, respond) => {
    const result = await doSomething(payload);
    respond({ success: true, data: result });
  });

  // 타임아웃 설정 (5초)
  registerHandler('slowAction', async (payload, respond) => {
    const result = await slowTask();
    respond(result);
  }, { timeout: 5000 });

  // 한 번만 실행
  registerHandler('oneTime', (payload, respond) => {
    respond({ done: true });
  }, { once: true });
};

// 앱에서 웹으로 메시지 전송
export const notifyWeb = (data: any) => {
  // sendToWeb은 bridge 객체에서 사용
};
```

### 2. 플러그인 레지스트리에 등록

`lib/bridges/plugin-registry.ts`:

> ⚠️ **주의**: 이 파일은 자동 생성됩니다. 수동 편집하지 마세요!
> `npm run generate:plugins` 명령으로 `constants/plugins.json`에서 생성됩니다.

```typescript
export const MANUAL_PLUGINS: Record<string, () => Promise<any>> = {
  // 기존 플러그인들...
  './my-feature': () => import('./my-feature'),
};
```

### 3. 플러그인 설정에 추가

`npm run config` → 플러그인 탭 → Manual 플러그인 추가

또는 `constants/plugins.json` 직접 수정:

```json
{
  "plugins": {
    "manual": [
      { "path": "./my-feature", "namespace": "myf" }
    ]
  }
}
```

### 4. 웹에서 사용

```javascript
// 네임스페이스:액션 형식으로 호출
const result = await AppBridge.call('myf:doSomething', { data: 'test' });
```

## 설정 구조

`constants/plugins.config.ts`:

```typescript
export const PLUGINS_CONFIG: PluginsConfig = {
  plugins: {
    auto: [
      { name: 'rnww-plugin-camera', namespace: 'cam' },
    ],
    manual: [
      { path: './clipboard', namespace: 'clip' },
    ],
  },
};
```

- `auto.method`: 등록 메서드명 (기본: `registerHandlers`)
- `manual.method`: 등록 메서드명 (기본: `register{PascalCase(namespace)}Handlers`)
