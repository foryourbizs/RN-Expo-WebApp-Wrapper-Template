# Preview Panel Design

Config Editor에 실시간 앱 미리보기 기능 추가

## 개요

`npm run config` 웹 설정 페이지에 오른쪽 사이드 패널로 폰 목업을 표시하여, 설정 변경 시 실제 앱이 어떻게 보일지 실시간으로 미리볼 수 있는 기능.

## 핵심 결정사항

| 항목 | 결정 |
|------|------|
| 배치 | 오른쪽 사이드 패널 (설정 65% / 미리보기 35%) |
| 폰 프레임 | 미니멀 (둥근 모서리, 상단 시간/배터리만) |
| 화면 전환 | 현재 탭/아코디언 섹션에 자동 연동 |
| Theme 모드 | 편집 중인 에디터(라이트/다크)에 따라 자동 전환 |
| WebView | 실제 iframe 로드 (설정에서 토글 가능) |
| 컨트롤 | 화면 회전 + 디바이스 크기 조절 |
| 업데이트 | 설정 변경 즉시 반영 |

---

## 1. 전체 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (RNWW Config, Language, Version)                        │
├─────────────────────────────────────────────────────────────────┤
│  Tabs: App | Theme | Plugins | Build                            │
├───────────────────────────────────────┬─────────────────────────┤
│                                       │                         │
│   Settings Form                       │   Preview Panel         │
│   - 스크롤 가능                        │   - 고정 위치           │
│   - 아코디언 섹션들                    │   - 폰 목업             │
│                                       │   - 컨트롤 버튼들       │
│                                       │                         │
├───────────────────────────────────────┴─────────────────────────┤
│  SaveRevertBar (Save | Revert)                                  │
└─────────────────────────────────────────────────────────────────┘
```

**비율:** 설정 폼 65% / Preview 패널 35%

**반응형:** 화면 너비 1024px 미만일 경우 Preview 패널 숨기고, 상단에 "Show Preview" 토글 버튼 표시

---

## 2. 폰 목업 컴포넌트

### 미니멀 프레임 구조

```
┌─────────────────────────────┐
│  9:41        ⚡ 100%  📶   │  ← Status Bar (설정 반영)
├─────────────────────────────┤
│                             │
│                             │
│      화면 콘텐츠 영역        │  ← Splash / WebView / Offline 등
│      (설정에 따라 변경)      │
│                             │
│                             │
├─────────────────────────────┤
│    ◀      ●      ▢         │  ← Navigation Bar (설정 반영)
└─────────────────────────────┘
```

### Status Bar 반영 항목

- `visible`: false면 숨김
- `style`: dark-content / light-content (아이콘 색상)
- `translucent`: true면 콘텐츠 위에 오버레이
- `overlayColor`: 배경색

### Navigation Bar 반영 항목

- `visible`: false면 숨김
- `buttonStyle`: light / dark (버튼 색상)
- `backgroundColor`: 배경색

### 프레임 스타일

- 둥근 모서리: `border-radius: 40px`
- 테두리: `2px solid #374151` (slate-700)
- 그림자: 약간의 drop shadow로 입체감

---

## 3. 화면별 미리보기 콘텐츠

### Splash 화면

- 배경색: `splash.backgroundColor` (라이트/다크 모드별)
- 로고: `splash.logoImage` 경로의 이미지 표시 (없으면 기본 아이콘)
- 로딩 텍스트: `splash.loadingText` 표시
- 로딩 인디케이터: `splash.showIndicator` true면 스피너 표시
- 인디케이터 색상: `theme.loadingIndicatorColor`

### WebView 화면

- iframe 모드: 실제 `webview.baseUrl` 로드
- 플레이스홀더 모드: 회색 배경 + "Your Web App" + URL 텍스트
- Safe Area: `safeArea.enabled`면 상하단 여백 표시, `safeArea.backgroundColor` 반영

### Offline 화면

- 배경색: `offline.backgroundColor` (라이트/다크)
- 제목: `offline.title`
- 메시지: `offline.message`
- 버튼: `offline.retryButtonText`, 버튼 색상 `offline.buttonColor`
- Wi-Fi 끊김 아이콘 표시

### Theme 탭 전용

- 샘플 UI 화면 표시 (텍스트, 버튼, 아이콘, 탭바 등)
- 현재 편집 중인 모드(라이트/다크)의 색상 실시간 반영
- `text`, `background`, `tint`, `icon`, `tabIconDefault`, `tabIconSelected` 모두 시각화

---

## 4. Preview 패널 컨트롤 UI

### 패널 상단 컨트롤 바

```
┌─────────────────────────────────────┐
│  📱 Preview                    ⚙️   │  ← 제목 + 설정 버튼
├─────────────────────────────────────┤
│  [🔄] [📱 Phone ▼] [🌙]            │  ← 컨트롤 버튼들
└─────────────────────────────────────┘
```

### 컨트롤 버튼

1. **회전 토글** `[🔄]` - 세로 ↔ 가로 전환
2. **디바이스 크기** `[📱 Phone ▼]` - 드롭다운 메뉴
   - Small Phone (320 × 568)
   - Phone (375 × 812) - 기본값
   - Large Phone (428 × 926)
   - Tablet (768 × 1024)
3. **다크모드 토글** `[🌙]` - Theme 탭에서만 표시, 라이트 ↔ 다크 전환

### 설정 팝오버 (⚙️ 클릭 시)

- `[ ] iframe 실제 로드` - 체크 해제 시 플레이스홀더
- `[ ] Status Bar 표시` - 미리보기에서 숨기기 옵션
- `[ ] Navigation Bar 표시` - 미리보기에서 숨기기 옵션

---

## 5. UX 편의성 디테일

### 직관적인 컨트롤

- 버튼에 아이콘 + 툴팁 (호버 시 설명 표시)
- 회전 버튼: 클릭할 때마다 폰이 부드럽게 90도 회전 애니메이션
- 디바이스 크기 변경: 부드러운 리사이즈 트랜지션 (200ms)

### 현재 상태 표시

- 활성화된 버튼은 하이라이트 (파란색 배경)
- 현재 보고 있는 화면 이름 표시: "Splash Screen", "WebView", "Offline" 등
- 가로 모드일 때 회전 버튼 아이콘도 회전된 상태로 표시

### 자동 연동 피드백

- 아코디언 섹션 변경 시 미리보기 전환에 페이드 효과 (150ms)
- 현재 연동된 섹션 이름을 Preview 패널에 작게 표시
- Theme 탭에서 에디터 포커스 시 "Light Mode" / "Dark Mode" 뱃지 표시

### 편의 기능

- 폰 목업 더블클릭 → 전체화면 모달로 확대
- 키보드 단축키: `R` 회전, `1-4` 디바이스 크기 선택
- 설정 팝오버는 외부 클릭 시 자동 닫힘

---

## 6. 컴포넌트 구조 및 구현

### 새로 생성할 컴포넌트

```
components/
├── preview/
│   ├── PreviewPanel.tsx        # 메인 패널 컨테이너
│   ├── PhoneMockup.tsx         # 폰 프레임 + Status/Nav Bar
│   ├── PreviewControls.tsx     # 상단 컨트롤 버튼들
│   ├── PreviewSettings.tsx     # 설정 팝오버
│   └── screens/
│       ├── SplashPreview.tsx   # Splash 화면 렌더링
│       ├── WebViewPreview.tsx  # WebView iframe/플레이스홀더
│       ├── OfflinePreview.tsx  # Offline 화면 렌더링
│       └── ThemePreview.tsx    # Theme 샘플 UI 렌더링
```

### 상태 관리 (React Context)

```typescript
interface PreviewState {
  currentScreen: 'splash' | 'webview' | 'offline' | 'theme';
  orientation: 'portrait' | 'landscape';
  deviceSize: 'small' | 'phone' | 'large' | 'tablet';
  themeMode: 'light' | 'dark';
  settings: {
    loadIframe: boolean;
    showStatusBar: boolean;
    showNavBar: boolean;
  };
}
```

### App.tsx 수정

- 기존 단일 컬럼 → 2컬럼 그리드 레이아웃
- PreviewContext Provider 추가
- 아코디언 열림/닫힘 이벤트를 Preview에 전달

---

## 7. 탭/섹션 ↔ 화면 매핑 규칙

### App Settings 탭 (아코디언 기반)

| 열린 섹션 | 미리보기 화면 |
|-----------|---------------|
| Webview | WebView |
| WebView Performance | WebView |
| Offline Screen | Offline |
| Status Bar | WebView (Status Bar 강조) |
| Navigation Bar | WebView (Nav Bar 강조) |
| Safe Area | WebView |
| Theme | WebView |
| Splash Screen | Splash |
| Security | WebView |
| Debug | WebView |

**여러 섹션 열려있을 때:** 가장 최근에 연 섹션 기준

### 다른 탭들

| 탭 | 미리보기 화면 |
|----|---------------|
| Theme | Theme (샘플 UI) |
| Plugins | WebView (플레이스홀더) |
| Build | WebView (플레이스홀더) |

### 강조 표시

- Status Bar 섹션 열면 → 폰 목업의 Status Bar에 점선 테두리 + 살짝 펄스 애니메이션
- Navigation Bar 섹션도 동일하게 강조

---

## 8. 에러 처리 및 엣지 케이스

### iframe 로드 실패

- 로딩 중: 스피너 + "Loading..." 표시
- 타임아웃 (10초): "Failed to load" 메시지 + "Retry" 버튼
- CORS/보안 오류: 자동으로 플레이스홀더 모드로 전환 + 툴팁 안내

### 이미지 로드 실패 (Splash 로고)

- 경로 오류 시 기본 앱 아이콘 표시
- 툴팁: "Logo image not found"

### 반응형 처리

- 1024px 미만: Preview 패널 숨김, 헤더에 "👁 Preview" 토글 버튼
- 토글 클릭 시: 전체 화면 모달로 Preview 표시
- 768px 미만: 디바이스 크기 선택에서 Tablet 옵션 비활성화

### 성능 최적화

- iframe은 탭 전환 시 언마운트하지 않고 `display: none` 처리
- 설정 변경 시 CSS 변수 활용으로 리렌더 최소화
- 이미지 프리로딩 (로고, 오프라인 아이콘)

---

## 구현 체크리스트

- [ ] PreviewContext 및 상태 관리 구현
- [ ] PhoneMockup 컴포넌트 (프레임, Status Bar, Nav Bar)
- [ ] PreviewControls 컴포넌트 (회전, 크기, 설정)
- [ ] SplashPreview 화면
- [ ] WebViewPreview 화면 (iframe + 플레이스홀더)
- [ ] OfflinePreview 화면
- [ ] ThemePreview 화면 (샘플 UI)
- [ ] App.tsx 레이아웃 변경 (2컬럼)
- [ ] 아코디언 연동 로직
- [ ] 반응형 처리 (모바일 모달)
- [ ] 키보드 단축키
- [ ] 전체화면 모달
