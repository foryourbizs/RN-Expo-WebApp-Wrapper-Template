# UI 설정 검토 결과 및 수정 계획

## 검토 범위
1. 스플래시 스크린 설정
2. Safe Area 설정
3. 상태바(Status Bar) 설정
4. 네비게이션바(Navigation Bar) 설정

---

## 1. 스플래시 스크린 (Splash Screen)

### 현재 상태
- **app.json (Expo 네이티브)**: `splash.backgroundColor: "#ffffff"`, `resizeMode: "contain"`, **이미지 없음**
- **constants/app.json (오버라이드)**: `splash.enabled: false` (커스텀 스플래시 비활성화)
- **app/_layout.tsx**: `CustomSplash` 컴포넌트 관리 + `splashFullyHidden` 상태
- **components/custom-splash.tsx**: `enabled: false`이면 즉시 `return null`

### 발견된 이슈

#### [ISSUE-S1] 심각도: 중간 - `splashFullyHidden`이 영원히 `false`로 남음
- **위치**: `app/_layout.tsx:86-88`, `components/custom-splash.tsx:200-202`
- **문제**: `splash.enabled: false`일 때 `CustomSplash`는 `return null`을 하므로 `onHidden` 콜백이 절대 호출되지 않음
- **결과**: `splashFullyHidden`이 영원히 `false` → `!splashFullyHidden && <CustomSplash .../>` 조건이 계속 true → null을 반환하는 컴포넌트가 영구적으로 마운트됨
- **시각적 영향**: 없음 (null 반환이므로)
- **성능 영향**: 미미하지만 불필요한 리렌더링 발생 가능
- **수정안**: `splash.enabled: false`일 때 `onHidden`을 즉시 호출하거나, `_layout.tsx`에서 `splash.enabled` 체크

#### [ISSUE-S2] 심각도: 낮음 - app.json 네이티브 스플래시에 이미지 미설정
- **위치**: `app.json:41-44`, `app.json:32-35`
- **문제**: `splash.image` 필드가 없어 네이티브 스플래시가 흰색 화면만 표시
- **참고**: 커스텀 스플래시를 사용하려는 의도라면 괜찮지만, 현재 커스텀 스플래시도 비활성화됨
- **수정안**: 네이티브 스플래시에 이미지 추가 또는 커스텀 스플래시 활성화 (사용자 의도 확인 필요)

#### [ISSUE-S3] 심각도: 낮음 - expo-splash-screen 플러그인 미등록
- **위치**: `app.json:45-55`
- **문제**: `plugins` 배열에 `expo-splash-screen`이 없음. Expo SDK 54+에서는 자동 처리되지만, 세밀한 제어가 필요할 경우 플러그인 등록 권장
- **수정안**: 필요시 `plugins`에 추가

---

## 2. Safe Area

### 현재 상태
- **constants/app.json (오버라이드)**: `safeArea.enabled: true`, `edges: "all"`
- **기본값**: `backgroundColor: "#ffffff"`, `darkBackgroundColor: "#000000"`
- **app/index.tsx**: `useSafeAreaInsets()` 훅으로 수동 계산, View 스페이서로 구현
- **SafeAreaProvider**: 명시적 선언 없음 (expo-router가 자동 제공)

### 발견된 이슈

#### [ISSUE-A1] 심각도: 낮음 - SafeAreaProvider 명시적 선언 없음
- **문제**: expo-router가 내부적으로 `SafeAreaProvider`를 제공하므로 동작하지만, 명시적이지 않음
- **영향**: 기능상 문제 없음. expo-router의 동작에 의존하는 암묵적 설계
- **수정안**: 유지 가능 (expo-router 공식 동작)

#### [ISSUE-A2] 심각도: 없음 - SafeArea 로직 자체는 정상
- `getTopInset()`: `overlapsWebView: false` + `safeArea.enabled: true` + `edges: 'all'` → `insets.top` 반환 (정상)
- `getBottomInset()`: `navigationBar.visibility: 'visible'` + `safeArea.enabled: true` + `edges: 'all'` → `insets.bottom` 반환 (정상)
- 상단/하단 스페이서가 올바르게 렌더링됨

---

## 3. 상태바 (Status Bar)

### 현재 상태
- **constants/app.json**: `visible: true`, `style: "auto"`, `translucent: true`, `overlapsWebView: false`
- **app/_layout.tsx:79-83**: `<StatusBar style={auto} hidden={false} translucent={true} />`
- **app.json**: `edgeToEdgeEnabled: false`
- **bridge**: `lib/bridges/status-bar/index.ts` - RN 명령형 API 사용

### 발견된 이슈

#### [ISSUE-B1] 심각도: 낮음 - StatusBar backgroundColor 미설정
- **위치**: `app/_layout.tsx:79-83`
- **문제**: `<StatusBar>` 컴포넌트에 `backgroundColor` prop이 없음
- **실제 영향**: `translucent: true`이므로 상태바는 투명. Safe Area 스페이서의 배경색이 상태바 뒤로 보이므로 시각적으로는 정상
- **수정안**: 현 구조에서는 불필요 (Safe Area 배경색이 대신 담당)

#### [ISSUE-B2] 심각도: 낮음 - 브릿지 핸들러 초기 상태 하드코딩
- **위치**: `lib/bridges/status-bar/index.ts:43`
- **문제**: `savedStatusBarState`의 초기값이 `{ hidden: false, style: 'default' }`로 하드코딩. 실제 앱 설정(`style: 'auto'`)과 불일치
- **영향**: `restore` 호출 시 `auto` 대신 `default` 스타일로 복원됨
- **수정안**: APP_CONFIG에서 초기 상태를 읽어오도록 수정

#### [ISSUE-B3] 심각도: 참고 - edgeToEdgeEnabled: false + translucent: true 조합
- **위치**: `app.json:30`, `constants/app.json:29`
- **설명**: `edgeToEdgeEnabled: false`는 기존 Android 레이아웃 모델 사용. `translucent: true`로 런타임에 상태바 투명화 달성. 이 조합은 유효하지만, Expo SDK 54+에서 `edgeToEdgeEnabled: true`가 권장되는 추세
- **수정안**: 현재는 정상 동작. 향후 edge-to-edge 마이그레이션 고려 가능

---

## 4. 네비게이션바 (Navigation Bar)

### 현재 상태
- **constants/app.json**: `visibility: "visible"`, `buttonStyle: "light"`, `backgroundColor: "#ffffff"`, `behavior: "overlay-swipe"`
- **app/_layout.tsx:31-61**: 초기 설정 시 `setPositionAsync`, `setVisibilityAsync`, `setBackgroundColorAsync`, `setButtonStyleAsync` 호출
- **bridge**: `lib/bridges/navigation-bar/index.ts` - 동적 제어

### 발견된 이슈

#### [ISSUE-N1] 심각도: 중간 - buttonStyle: "light" + backgroundColor: "#ffffff" 충돌
- **위치**: `constants/app.json:34-36`
- **문제**: 라이트 모드에서 흰색 배경(`#ffffff`)에 밝은 버튼(`light`)이 겹쳐 네비게이션 버튼이 거의 보이지 않음
- **영향**: Android에서 하단 네비게이션 바의 뒤로가기/홈/최근앱 버튼이 흰색 배경 위에 밝은 색으로 표시되어 사용성 저하
- **수정안**: `buttonStyle: "dark"` (기본값)으로 변경하거나, 라이트 모드 배경색을 어둡게 변경

#### [ISSUE-N2] 심각도: 중간 - 브릿지 핸들러에서 setPositionAsync 누락
- **위치**: `lib/bridges/navigation-bar/index.ts:67-71`
- **문제**: `set` 핸들러에서 `visible: false` 설정 시 `setPositionAsync('absolute')` 호출 없음. `_layout.tsx`의 초기 설정에서는 hidden일 때 `setPositionAsync('absolute')`를 호출하여 콘텐츠가 네비게이션바 영역까지 확장되도록 함
- **영향**: 브릿지를 통해 네비게이션바를 숨기면, 콘텐츠가 하단까지 확장되지 않고 빈 공간이 남을 수 있음
- **수정안**: `set` 핸들러에 `setPositionAsync` 호출 추가 (hidden → absolute, visible → relative)

#### [ISSUE-N3] 심각도: 중간 - restore 핸들러에서 setPositionAsync 누락
- **위치**: `lib/bridges/navigation-bar/index.ts:98-111`
- **문제**: `restore` 핸들러에서도 `setPositionAsync` 호출 없음. hidden → visible 복원 시 position이 absolute로 남을 수 있음
- **수정안**: `restore` 핸들러에 `setPositionAsync` 호출 추가

---

## 영역 간 충돌/상호작용 분석

### 정상 동작하는 조합
| 설정 조합 | 상태 |
|-----------|------|
| SafeArea top + StatusBar (non-overlapping) | 정상 - 스페이서가 상태바 높이만큼 추가됨 |
| SafeArea bottom + NavigationBar (visible) | 정상 - 스페이서가 네비게이션바 높이만큼 추가됨 |
| StatusBar translucent + SafeArea 배경색 | 정상 - 투명 상태바 뒤에 스페이서 배경색 표시 |
| 다크모드 색상 전환 | 정상 - colorScheme 변경 시 네비게이션바/SafeArea 색상 모두 업데이트 |

### 주의 필요한 조합
| 설정 조합 | 문제 |
|-----------|------|
| NavigationBar buttonStyle: light + backgroundColor: #ffffff | 버튼 가시성 저하 |
| StatusBar bridge restore + 실제 앱 설정 | 초기값 불일치 |
| NavigationBar bridge hide + position | 레이아웃 갭 가능 |

---

## 수정 우선순위

### P1 - 반드시 수정 (기능 영향)
1. **[ISSUE-N1]** 네비게이션바 buttonStyle/backgroundColor 충돌 → `buttonStyle: "dark"`으로 변경
2. **[ISSUE-N2]** 브릿지 네비게이션바 set 핸들러 `setPositionAsync` 누락 → 추가
3. **[ISSUE-N3]** 브릿지 네비게이션바 restore 핸들러 `setPositionAsync` 누락 → 추가

### P2 - 권장 수정 (코드 품질)
4. **[ISSUE-S1]** CustomSplash 비활성화 시 `onHidden` 미호출 → 즉시 호출하도록 수정
5. **[ISSUE-B2]** 상태바 브릿지 초기 상태 하드코딩 → APP_CONFIG에서 읽기

### P3 - 선택 수정 (개선)
6. **[ISSUE-S2]** 네이티브 스플래시 이미지 미설정 (사용자 의도 확인 필요)
7. **[ISSUE-S3]** expo-splash-screen 플러그인 미등록 (필요시)
8. **[ISSUE-B3]** edgeToEdgeEnabled 마이그레이션 (향후 과제)
