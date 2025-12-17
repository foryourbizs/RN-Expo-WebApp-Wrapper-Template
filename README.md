# 리엑트네이티브 + EXPO + 웹앱 래퍼 템플릿


## 환경 설정
```
constants\app-config.ts 에서 가능
```

## 테마 설정
```
constants\theme.ts 에서 가능
```

## 스플레시 화면
```
components\custom-splash.tsx 에서 구성됨
(환경설정의 영향받음)
```

## 오프라인 화면
```
components\offline-screen.tsx 에서 구성됨
(환경설정의 영향받음)
```


##  브릿지 시스템

```text
웹 → 앱: app://액션명
앱 → 웹: native://액션명
```


### 웹 기준
```javascript
// 앱 환경 체크
if (window.AppBridge?.isApp()) {
  
  // 1. 단방향 전송 (응답 없음)
  AppBridge.send('showToast', { message: '안녕하세요!' });
  AppBridge.send('vibrate');
  
  // 2. 요청 후 응답 대기
  const appInfo = await AppBridge.call('getAppInfo');
  const deviceInfo = await AppBridge.call('getDeviceInfo');
  
  // 3. 앱에서 오는 메시지 수신
  AppBridge.on('customEvent', (payload) => {
    console.log('앱에서 받은 데이터:', payload);
  });
}
```

### 네이티브 구성 기준 (커스텀 핸들러 추가 예시 등)
```javascript
import { registerHandler, sendToWeb } from '@/lib/bridge';

// 핸들러 등록
registerHandler('myCustomAction', (payload, respond) => {
  console.log('받은 데이터:', payload);
  respond({ result: 'success' });
});

// 앱에서 웹으로 메시지 전송
sendToWeb('notification', { title: '알림', body: '내용' });
```


## 빌드
```
윈도우는 build.bat 사용하여 대화형으로 빌드함(편의성 때문)

맥은 모르겠다.. 내가 당장은 확인할 수 없네.
```