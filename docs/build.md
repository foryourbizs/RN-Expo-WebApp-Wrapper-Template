# 빌드

## 웹 UI 빌드 (권장)

```bash
npm run config
```

빌드 탭에서:
1. **환경 확인** - SDK, Java, 라이선스 상태 확인
2. **키스토어 생성** - 릴리스 빌드용 서명 키
3. **빌드 실행** - Debug/Release APK, AAB

## 환경 설정

### Android SDK

1. [Android Studio](https://developer.android.com/studio) 또는 [Command Line Tools](https://developer.android.com/studio#command-tools) 설치
2. `npm run config` → 빌드 탭 → Android SDK Path 설정
3. 환경 확인 버튼으로 검증

### Java

JDK 17 이상 필요
- [Adoptium](https://adoptium.net/) 에서 다운로드
- `npm run config` → 빌드 탭 → Java Home 설정

### SDK 라이선스

환경 확인에서 "SDK Licenses: Not accepted" 표시 시:
- **라이선스 수락** 버튼 클릭 (자동 수락)

또는 수동:
```bash
sdkmanager --licenses
```

## CLI 빌드

### 수동 빌드
```bash
# prebuild
npx expo prebuild --platform android

# Debug APK
cd android && .\gradlew assembleDebug

# Release APK
cd android && .\gradlew assembleRelease

# Release AAB (Play Store)
cd android && .\gradlew bundleRelease
```

### EAS Cloud Build
```bash
# 설정
npx eas build:configure

# 빌드
npx eas build --platform android --profile preview
npx eas build --platform android --profile production
```

## 출력 파일 위치

| 타입 | 경로 |
|------|------|
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Release APK | `android/app/build/outputs/apk/release/app-release.apk` |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab` |

## 키스토어

### 웹 UI에서 생성
`npm run config` → 빌드 탭 → 키스토어 섹션

### 수동 생성
```bash
keytool -genkey -v -keystore release.keystore -alias my-key -keyalg RSA -keysize 2048 -validity 10000
```

### 서명 설정
`android/gradle.properties`:
```properties
MYAPP_RELEASE_STORE_FILE=release.keystore
MYAPP_RELEASE_KEY_ALIAS=my-key
MYAPP_RELEASE_STORE_PASSWORD=password
MYAPP_RELEASE_KEY_PASSWORD=password
```

## 문제 해결

### 라이선스 오류
```
License for package NDK not accepted
```
→ `npm run config` → 빌드 탭 → 라이선스 수락 버튼

### SDK 경로 오류
```
SDK path points to bin folder
```
→ SDK 루트 경로 설정 (bin, cmdline-tools 폴더가 아닌 상위 폴더)

### 빌드 캐시 문제
`npm run config` → 빌드 탭 → Gradle 캐시 정리 또는 전체 초기화
