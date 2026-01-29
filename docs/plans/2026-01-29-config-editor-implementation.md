# Config Editor GUI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a cross-platform GUI tool for editing app configuration (app.json, theme.json, plugins.json) via browser-based interface

**Architecture:** Express server (API + static files) + React/Vite frontend. `npm run config` starts server and opens browser automatically.

**Tech Stack:** Express, React, Vite, Tailwind CSS, i18next, react-colorful

---

## Phase 1: Project Setup

### Task 1.1: Initialize Server Package

**Files:**
- Create: `tools/config-editor/package.json`
- Create: `tools/config-editor/server/index.js`

**Step 1: Create server package.json**

```json
{
  "name": "rnww-config-editor",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node server/index.js --dev",
    "start": "node server/index.js",
    "build": "cd client && npm run build"
  },
  "dependencies": {
    "express": "^4.21.0",
    "get-port": "^7.1.0",
    "open": "^10.1.0",
    "cors": "^2.8.5"
  }
}
```

**Step 2: Create minimal Express server**

```javascript
// tools/config-editor/server/index.js
import express from 'express';
import getPort from 'get-port';
import open from 'open';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes('--dev');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files in production
if (!isDev) {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const startServer = async () => {
  const port = await getPort({ port: [3000, 3001, 3002, 3003] });
  app.listen(port, () => {
    console.log(`Config Editor running at http://localhost:${port}`);
    if (!isDev) {
      open(`http://localhost:${port}`);
    }
  });
};

startServer();
```

**Step 3: Run to verify server starts**

Run: `cd tools/config-editor && npm install && npm start`
Expected: Server starts, browser opens

**Step 4: Commit**

```bash
git add tools/config-editor/package.json tools/config-editor/server/index.js
git commit -m "feat(config-editor): initialize express server"
```

---

### Task 1.2: Initialize React Client

**Files:**
- Create: `tools/config-editor/client/package.json`
- Create: `tools/config-editor/client/vite.config.ts`
- Create: `tools/config-editor/client/index.html`
- Create: `tools/config-editor/client/src/main.tsx`
- Create: `tools/config-editor/client/src/App.tsx`
- Create: `tools/config-editor/client/tailwind.config.js`
- Create: `tools/config-editor/client/postcss.config.js`
- Create: `tools/config-editor/client/src/index.css`
- Create: `tools/config-editor/client/tsconfig.json`

**Step 1: Create client package.json**

```json
{
  "name": "rnww-config-editor-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-i18next": "^14.1.0",
    "i18next": "^23.11.0",
    "react-colorful": "^5.6.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "typescript": "^5.4.5",
    "vite": "^5.2.0"
  }
}
```

**Step 2: Create vite.config.ts**

```typescript
// tools/config-editor/client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
});
```

**Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RNWW Config Editor</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

**Step 5: Create Tailwind config**

```javascript
// tools/config-editor/client/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**Step 6: Create PostCSS config**

```javascript
// tools/config-editor/client/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 7: Create index.css**

```css
/* tools/config-editor/client/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 8: Create main.tsx**

```tsx
// tools/config-editor/client/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 9: Create App.tsx**

```tsx
// tools/config-editor/client/src/App.tsx
export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold">RNWW Config Editor</h1>
      <p className="text-gray-600">Setup complete!</p>
    </div>
  );
}
```

**Step 10: Install and verify**

Run: `cd tools/config-editor/client && npm install && npm run dev`
Expected: Vite dev server starts at http://localhost:5173

**Step 11: Commit**

```bash
git add tools/config-editor/client/
git commit -m "feat(config-editor): initialize react client with vite and tailwind"
```

---

### Task 1.3: Add Root Script

**Files:**
- Modify: `package.json` (root)

**Step 1: Add config script to root package.json**

Add to scripts:
```json
"config": "cd tools/config-editor && npm start",
"config:dev": "cd tools/config-editor && npm run dev"
```

**Step 2: Verify script works**

Run: `npm run config`
Expected: Server starts and browser opens

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add npm run config script"
```

---

## Phase 2: Config API Routes

### Task 2.1: Config File Read/Write API

**Files:**
- Create: `tools/config-editor/server/routes/config.js`
- Modify: `tools/config-editor/server/index.js`

**Step 1: Create config routes**

```javascript
// tools/config-editor/server/routes/config.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const constantsDir = path.resolve(__dirname, '../../../../constants');

const router = express.Router();

// 설정 파일 목록
const CONFIG_FILES = {
  app: 'app.json',
  theme: 'theme.json',
  plugins: 'plugins.json'
};

// GET /api/config/:type - 설정 파일 읽기
router.get('/:type', async (req, res) => {
  const { type } = req.params;
  const filename = CONFIG_FILES[type];

  if (!filename) {
    return res.status(400).json({ error: 'Invalid config type' });
  }

  try {
    const filePath = path.join(constantsDir, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    res.json(JSON.parse(content));
  } catch (error) {
    res.status(500).json({ error: `Failed to read ${filename}` });
  }
});

// PUT /api/config/:type - 설정 파일 저장
router.put('/:type', async (req, res) => {
  const { type } = req.params;
  const filename = CONFIG_FILES[type];

  if (!filename) {
    return res.status(400).json({ error: 'Invalid config type' });
  }

  try {
    const filePath = path.join(constantsDir, filename);
    const content = JSON.stringify(req.body, null, 2) + '\n';
    await fs.writeFile(filePath, content, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: `Failed to write ${filename}` });
  }
});

// GET /api/config/defaults/:type - 기본값 읽기 (TypeScript 파일에서)
router.get('/defaults/:type', async (req, res) => {
  const { type } = req.params;

  // TypeScript 기본값은 클라이언트에서 하드코딩
  // 또는 별도의 defaults.json 파일 생성 필요
  res.status(501).json({ error: 'Not implemented - use client defaults' });
});

export default router;
```

**Step 2: Register routes in server**

```javascript
// tools/config-editor/server/index.js 수정
import configRoutes from './routes/config.js';

// ... (기존 코드)

app.use('/api/config', configRoutes);
```

**Step 3: Test API**

Run: `curl http://localhost:3000/api/config/app`
Expected: Returns app.json content

**Step 4: Commit**

```bash
git add tools/config-editor/server/routes/config.js tools/config-editor/server/index.js
git commit -m "feat(config-editor): add config read/write API"
```

---

### Task 2.2: Plugins API (npm/scan)

**Files:**
- Create: `tools/config-editor/server/routes/plugins.js`
- Create: `tools/config-editor/server/utils/npm.js`
- Modify: `tools/config-editor/server/index.js`

**Step 1: Create npm utility**

```javascript
// tools/config-editor/server/utils/npm.js
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../../..');

// npm search (rnww-plugin-* 패키지)
export async function searchNpmPackages(query) {
  try {
    const { stdout } = await execAsync(
      `npm search ${query} --json`,
      { cwd: projectRoot, timeout: 30000 }
    );
    return JSON.parse(stdout);
  } catch (error) {
    console.error('npm search error:', error);
    return [];
  }
}

// 설치된 패키지 목록
export async function getInstalledPackages() {
  try {
    const { stdout } = await execAsync(
      'npm list --json --depth=0',
      { cwd: projectRoot }
    );
    const data = JSON.parse(stdout);
    return Object.entries(data.dependencies || {}).map(([name, info]) => ({
      name,
      version: info.version
    }));
  } catch (error) {
    // npm list는 peer dep 경고로 exit code 1 반환 가능
    if (error.stdout) {
      try {
        const data = JSON.parse(error.stdout);
        return Object.entries(data.dependencies || {}).map(([name, info]) => ({
          name,
          version: info.version
        }));
      } catch {
        return [];
      }
    }
    return [];
  }
}

// 패키지 설치
export async function installPackage(packageName, version = 'latest') {
  const spec = version === 'latest' ? packageName : `${packageName}@${version}`;
  try {
    await execAsync(`npm install ${spec}`, { cwd: projectRoot, timeout: 120000 });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 패키지 제거
export async function uninstallPackage(packageName) {
  try {
    await execAsync(`npm uninstall ${packageName}`, { cwd: projectRoot, timeout: 60000 });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**Step 2: Create plugins routes**

```javascript
// tools/config-editor/server/routes/plugins.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  searchNpmPackages,
  getInstalledPackages,
  installPackage,
  uninstallPackage
} from '../utils/npm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bridgesDir = path.resolve(__dirname, '../../../../lib/bridges');

const router = express.Router();

// GET /api/plugins/installed - 설치된 npm 패키지 목록
router.get('/installed', async (req, res) => {
  try {
    const packages = await getInstalledPackages();
    // rnww-plugin-* 패키지 우선 정렬
    const sorted = packages.sort((a, b) => {
      const aIsRnww = a.name.startsWith('rnww-plugin-');
      const bIsRnww = b.name.startsWith('rnww-plugin-');
      if (aIsRnww && !bIsRnww) return -1;
      if (!aIsRnww && bIsRnww) return 1;
      return a.name.localeCompare(b.name);
    });
    res.json(sorted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get installed packages' });
  }
});

// GET /api/plugins/search?q=query - npm 패키지 검색
router.get('/search', async (req, res) => {
  const query = req.query.q || 'rnww-plugin';
  try {
    const results = await searchNpmPackages(query);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search packages' });
  }
});

// POST /api/plugins/install - 패키지 설치
router.post('/install', async (req, res) => {
  const { name, version } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Package name required' });
  }

  const result = await installPackage(name, version);
  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// POST /api/plugins/uninstall - 패키지 제거
router.post('/uninstall', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Package name required' });
  }

  const result = await uninstallPackage(name);
  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// GET /api/plugins/scan - lib/bridges 폴더 스캔
router.get('/scan', async (req, res) => {
  try {
    const entries = await fs.readdir(bridgesDir, { withFileTypes: true });
    const folders = entries
      .filter(entry => entry.isDirectory())
      .map(entry => `./${entry.name}`);
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to scan bridges folder' });
  }
});

export default router;
```

**Step 3: Register routes in server**

```javascript
// tools/config-editor/server/index.js에 추가
import pluginsRoutes from './routes/plugins.js';

app.use('/api/plugins', pluginsRoutes);
```

**Step 4: Test APIs**

Run: `curl http://localhost:3000/api/plugins/installed`
Run: `curl http://localhost:3000/api/plugins/scan`
Expected: Returns package list and folder list

**Step 5: Commit**

```bash
git add tools/config-editor/server/routes/plugins.js tools/config-editor/server/utils/npm.js tools/config-editor/server/index.js
git commit -m "feat(config-editor): add plugins API (npm search/install, folder scan)"
```

---

## Phase 3: Client UI Components

### Task 3.1: i18n Setup

**Files:**
- Create: `tools/config-editor/client/src/i18n/index.ts`
- Create: `tools/config-editor/client/src/i18n/ko.json`
- Create: `tools/config-editor/client/src/i18n/en.json`
- Modify: `tools/config-editor/client/src/main.tsx`

**Step 1: Create i18n config**

```typescript
// tools/config-editor/client/src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './ko.json';
import en from './en.json';

const savedLang = localStorage.getItem('rnww-config-lang');
const browserLang = navigator.language.startsWith('ko') ? 'ko' : 'en';

i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en }
  },
  lng: savedLang || browserLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
```

**Step 2: Create Korean translations**

```json
{
  "nav": {
    "appSettings": "앱 설정",
    "theme": "테마",
    "plugins": "플러그인",
    "build": "빌드"
  },
  "app": {
    "webview": {
      "title": "웹뷰 설정",
      "baseUrl": "기본 URL",
      "baseUrlDesc": "앱에서 로드할 웹사이트 URL",
      "userAgent": "User-Agent",
      "options": "옵션",
      "performance": "성능"
    },
    "offline": {
      "title": "오프라인 화면",
      "enabled": "활성화",
      "titleField": "제목",
      "message": "메시지",
      "retryButtonText": "재시도 버튼 텍스트"
    },
    "statusBar": {
      "title": "상태바",
      "visible": "표시",
      "style": "스타일"
    },
    "navigationBar": {
      "title": "네비게이션 바",
      "visibility": "표시 모드"
    },
    "safeArea": {
      "title": "Safe Area",
      "enabled": "활성화",
      "edges": "적용 영역"
    },
    "splash": {
      "title": "스플래시 스크린",
      "enabled": "활성화",
      "minDisplayTime": "최소 표시 시간 (ms)",
      "loadingText": "로딩 텍스트"
    },
    "security": {
      "title": "보안",
      "allowedOrigins": "허용된 Origin"
    }
  },
  "theme": {
    "light": "라이트 모드",
    "dark": "다크 모드",
    "reset": "기본값으로 초기화"
  },
  "plugins": {
    "auto": "Auto 플러그인 (npm)",
    "manual": "Manual 플러그인 (로컬)",
    "installed": "설치됨",
    "notInstalled": "미설치",
    "active": "활성",
    "inactive": "비활성",
    "add": "추가",
    "install": "설치",
    "remove": "제거",
    "deactivate": "비활성화",
    "activate": "활성화",
    "namespace": "네임스페이스",
    "searchPlaceholder": "패키지 검색...",
    "addAutoTitle": "Auto 플러그인 추가",
    "addManualTitle": "Manual 플러그인 추가",
    "installedPackages": "설치된 패키지",
    "npmSearch": "npm 검색",
    "selected": "선택됨",
    "version": "버전",
    "installAndAdd": "설치 후 추가",
    "scanResults": "lib/bridges 폴더 스캔 결과"
  },
  "common": {
    "save": "저장",
    "cancel": "취소",
    "revert": "되돌리기",
    "reset": "초기화",
    "lastSaved": "마지막 저장",
    "unsaved": "저장되지 않음",
    "loading": "로딩 중...",
    "error": "오류",
    "success": "성공"
  }
}
```

**Step 3: Create English translations**

```json
{
  "nav": {
    "appSettings": "App Settings",
    "theme": "Theme",
    "plugins": "Plugins",
    "build": "Build"
  },
  "app": {
    "webview": {
      "title": "Webview Settings",
      "baseUrl": "Base URL",
      "baseUrlDesc": "Website URL to load in app",
      "userAgent": "User-Agent",
      "options": "Options",
      "performance": "Performance"
    },
    "offline": {
      "title": "Offline Screen",
      "enabled": "Enabled",
      "titleField": "Title",
      "message": "Message",
      "retryButtonText": "Retry Button Text"
    },
    "statusBar": {
      "title": "Status Bar",
      "visible": "Visible",
      "style": "Style"
    },
    "navigationBar": {
      "title": "Navigation Bar",
      "visibility": "Visibility Mode"
    },
    "safeArea": {
      "title": "Safe Area",
      "enabled": "Enabled",
      "edges": "Edges"
    },
    "splash": {
      "title": "Splash Screen",
      "enabled": "Enabled",
      "minDisplayTime": "Min Display Time (ms)",
      "loadingText": "Loading Text"
    },
    "security": {
      "title": "Security",
      "allowedOrigins": "Allowed Origins"
    }
  },
  "theme": {
    "light": "Light Mode",
    "dark": "Dark Mode",
    "reset": "Reset to defaults"
  },
  "plugins": {
    "auto": "Auto Plugins (npm)",
    "manual": "Manual Plugins (local)",
    "installed": "Installed",
    "notInstalled": "Not installed",
    "active": "Active",
    "inactive": "Inactive",
    "add": "Add",
    "install": "Install",
    "remove": "Remove",
    "deactivate": "Deactivate",
    "activate": "Activate",
    "namespace": "Namespace",
    "searchPlaceholder": "Search packages...",
    "addAutoTitle": "Add Auto Plugin",
    "addManualTitle": "Add Manual Plugin",
    "installedPackages": "Installed Packages",
    "npmSearch": "npm Search",
    "selected": "Selected",
    "version": "Version",
    "installAndAdd": "Install & Add",
    "scanResults": "lib/bridges folder scan results"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "revert": "Revert",
    "reset": "Reset",
    "lastSaved": "Last saved",
    "unsaved": "Unsaved",
    "loading": "Loading...",
    "error": "Error",
    "success": "Success"
  }
}
```

**Step 4: Import i18n in main.tsx**

```tsx
// tools/config-editor/client/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 5: Verify i18n works**

Run: `cd tools/config-editor/client && npm run dev`
Expected: No errors, translations ready

**Step 6: Commit**

```bash
git add tools/config-editor/client/src/i18n/
git commit -m "feat(config-editor): add i18n with ko/en translations"
```

---

### Task 3.2: Layout and Navigation

**Files:**
- Create: `tools/config-editor/client/src/components/Layout.tsx`
- Create: `tools/config-editor/client/src/components/TabNav.tsx`
- Create: `tools/config-editor/client/src/components/LanguageSelector.tsx`
- Modify: `tools/config-editor/client/src/App.tsx`

**Step 1: Create Layout component**

```tsx
// tools/config-editor/client/src/components/Layout.tsx
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">RNWW Config Editor</h1>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <span className="text-sm text-gray-500">v1.0.0</span>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
```

**Step 2: Create LanguageSelector component**

```tsx
// tools/config-editor/client/src/components/LanguageSelector.tsx
import { useTranslation } from 'react-i18next';

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    localStorage.setItem('rnww-config-lang', lang);
  };

  return (
    <select
      value={i18n.language}
      onChange={handleChange}
      className="text-sm border rounded px-2 py-1 bg-white"
    >
      <option value="ko">한국어</option>
      <option value="en">English</option>
    </select>
  );
}
```

**Step 3: Create TabNav component**

```tsx
// tools/config-editor/client/src/components/TabNav.tsx
import { useTranslation } from 'react-i18next';

interface TabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unsavedTabs: string[];
}

const TABS = ['appSettings', 'theme', 'plugins', 'build'] as const;

export default function TabNav({ activeTab, onTabChange, unsavedTabs }: TabNavProps) {
  const { t } = useTranslation();

  return (
    <div className="flex border-b bg-white rounded-t-lg">
      {TABS.map(tab => {
        const isActive = activeTab === tab;
        const hasUnsaved = unsavedTabs.includes(tab);
        const isDisabled = tab === 'build';

        return (
          <button
            key={tab}
            onClick={() => !isDisabled && onTabChange(tab)}
            disabled={isDisabled}
            className={`
              px-6 py-3 text-sm font-medium border-b-2 transition-colors
              ${isActive
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {t(`nav.${tab}`)}
            {hasUnsaved && <span className="ml-1 text-orange-500">•</span>}
            {isDisabled && <span className="ml-1">❋</span>}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 4: Update App.tsx with layout**

```tsx
// tools/config-editor/client/src/App.tsx
import { useState } from 'react';
import Layout from './components/Layout';
import TabNav from './components/TabNav';

export default function App() {
  const [activeTab, setActiveTab] = useState('appSettings');
  const [unsavedTabs, setUnsavedTabs] = useState<string[]>([]);

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow">
        <TabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          unsavedTabs={unsavedTabs}
        />
        <div className="p-6">
          {activeTab === 'appSettings' && <div>App Settings Tab</div>}
          {activeTab === 'theme' && <div>Theme Tab</div>}
          {activeTab === 'plugins' && <div>Plugins Tab</div>}
          {activeTab === 'build' && <div>Build Tab (Coming Soon)</div>}
        </div>
      </div>
    </Layout>
  );
}
```

**Step 5: Verify UI renders correctly**

Run: `cd tools/config-editor/client && npm run dev`
Expected: Header, language selector, and tabs display correctly

**Step 6: Commit**

```bash
git add tools/config-editor/client/src/components/ tools/config-editor/client/src/App.tsx
git commit -m "feat(config-editor): add layout, navigation tabs, language selector"
```

---

### Task 3.3: Common Form Components

**Files:**
- Create: `tools/config-editor/client/src/components/form/TextInput.tsx`
- Create: `tools/config-editor/client/src/components/form/NumberInput.tsx`
- Create: `tools/config-editor/client/src/components/form/Toggle.tsx`
- Create: `tools/config-editor/client/src/components/form/Select.tsx`
- Create: `tools/config-editor/client/src/components/form/ColorPicker.tsx`
- Create: `tools/config-editor/client/src/components/form/TagInput.tsx`
- Create: `tools/config-editor/client/src/components/form/Accordion.tsx`
- Create: `tools/config-editor/client/src/components/form/index.ts`

**Step 1: Create TextInput**

```tsx
// tools/config-editor/client/src/components/form/TextInput.tsx
interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  placeholder?: string;
}

export default function TextInput({
  label,
  value,
  onChange,
  description,
  placeholder
}: TextInputProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
    </div>
  );
}
```

**Step 2: Create NumberInput**

```tsx
// tools/config-editor/client/src/components/form/NumberInput.tsx
interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  showSlider?: boolean;
}

export default function NumberInput({
  label,
  value,
  onChange,
  description,
  min,
  max,
  step = 1,
  showSlider = false
}: NumberInputProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-24 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        />
        {showSlider && min !== undefined && max !== undefined && (
          <input
            type="range"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            min={min}
            max={max}
            step={step}
            className="flex-1"
          />
        )}
      </div>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
    </div>
  );
}
```

**Step 3: Create Toggle**

```tsx
// tools/config-editor/client/src/components/form/Toggle.tsx
interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}

export default function Toggle({
  label,
  value,
  onChange,
  description
}: ToggleProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${value ? 'bg-blue-500' : 'bg-gray-300'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${value ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}
```

**Step 4: Create Select**

```tsx
// tools/config-editor/client/src/components/form/Select.tsx
interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  description?: string;
}

export default function Select({
  label,
  value,
  onChange,
  options,
  description
}: SelectProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
    </div>
  );
}
```

**Step 5: Create ColorPicker**

```tsx
// tools/config-editor/client/src/components/form/ColorPicker.tsx
import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 rounded border-2 border-gray-300"
          style={{ backgroundColor: value }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 px-3 py-2 border rounded-md font-mono text-sm"
          placeholder="#000000"
        />
      </div>
      {isOpen && (
        <div className="absolute z-10 mt-2">
          <div
            className="fixed inset-0"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative">
            <HexColorPicker color={value} onChange={onChange} />
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 6: Create TagInput**

```tsx
// tools/config-editor/client/src/components/form/TagInput.tsx
import { useState, KeyboardEvent } from 'react';

interface TagInputProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  description?: string;
  placeholder?: string;
}

export default function TagInput({
  label,
  value,
  onChange,
  description,
  placeholder
}: TagInputProps) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!value.includes(input.trim())) {
        onChange([...value, input.trim()]);
      }
      setInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px]">
        {value.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-blue-600"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] outline-none"
        />
      </div>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
    </div>
  );
}
```

**Step 7: Create Accordion**

```tsx
// tools/config-editor/client/src/components/form/Accordion.tsx
import { useState, ReactNode } from 'react';

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg mb-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-t-lg"
      >
        <span className="font-medium text-gray-700">{title}</span>
        <span className="text-gray-500">{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && (
        <div className="px-4 py-4 border-t">
          {children}
        </div>
      )}
    </div>
  );
}
```

**Step 8: Create index export**

```tsx
// tools/config-editor/client/src/components/form/index.ts
export { default as TextInput } from './TextInput';
export { default as NumberInput } from './NumberInput';
export { default as Toggle } from './Toggle';
export { default as Select } from './Select';
export { default as ColorPicker } from './ColorPicker';
export { default as TagInput } from './TagInput';
export { default as Accordion } from './Accordion';
```

**Step 9: Verify components render**

Test in App.tsx temporarily, then remove test code.

**Step 10: Commit**

```bash
git add tools/config-editor/client/src/components/form/
git commit -m "feat(config-editor): add form components (text, number, toggle, select, color, tag, accordion)"
```

---

## Phase 4: Page Components

### Task 4.1: API Hooks

**Files:**
- Create: `tools/config-editor/client/src/hooks/useConfig.ts`
- Create: `tools/config-editor/client/src/hooks/usePlugins.ts`

**Step 1: Create useConfig hook**

```typescript
// tools/config-editor/client/src/hooks/useConfig.ts
import { useState, useEffect, useCallback } from 'react';

type ConfigType = 'app' | 'theme' | 'plugins';

export function useConfig<T>(type: ConfigType) {
  const [data, setData] = useState<T | null>(null);
  const [originalData, setOriginalData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/config/${type}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setOriginalData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = async (newData: T) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/config/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      });
      if (!res.ok) throw new Error('Failed to save');
      setOriginalData(newData);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    setData(originalData);
  };

  const hasChanges = JSON.stringify(data) !== JSON.stringify(originalData);

  return {
    data,
    setData,
    loading,
    error,
    saving,
    saveConfig,
    revert,
    hasChanges,
    refresh: fetchConfig
  };
}
```

**Step 2: Create usePlugins hook**

```typescript
// tools/config-editor/client/src/hooks/usePlugins.ts
import { useState, useCallback } from 'react';

interface InstalledPackage {
  name: string;
  version: string;
}

interface SearchResult {
  name: string;
  version: string;
  description?: string;
}

export function usePlugins() {
  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [scannedFolders, setScannedFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInstalled = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/plugins/installed');
      if (!res.ok) throw new Error('Failed to fetch');
      setInstalledPackages(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const searchPackages = async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/plugins/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to search');
      setSearchResults(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const scanFolders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/plugins/scan');
      if (!res.ok) throw new Error('Failed to scan');
      setScannedFolders(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const installPackage = async (name: string, version?: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/plugins/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, version })
      });
      if (!res.ok) throw new Error('Failed to install');
      await fetchInstalled();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const uninstallPackage = async (name: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/plugins/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('Failed to uninstall');
      await fetchInstalled();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    installedPackages,
    searchResults,
    scannedFolders,
    loading,
    error,
    fetchInstalled,
    searchPackages,
    scanFolders,
    installPackage,
    uninstallPackage
  };
}
```

**Step 3: Commit**

```bash
git add tools/config-editor/client/src/hooks/
git commit -m "feat(config-editor): add API hooks (useConfig, usePlugins)"
```

---

### Task 4.2: AppConfig Page

**Files:**
- Create: `tools/config-editor/client/src/pages/AppConfig.tsx`
- Create: `tools/config-editor/client/src/types/config.ts`

**Step 1: Create config types**

```typescript
// tools/config-editor/client/src/types/config.ts
export interface AppConfig {
  $schema?: string;
  webview?: {
    baseUrl?: string;
    userAgent?: string;
    options?: {
      javaScriptEnabled?: boolean;
      domStorageEnabled?: boolean;
      thirdPartyCookiesEnabled?: boolean;
      mediaPlaybackRequiresUserAction?: boolean;
      mixedContentMode?: 'compatibility' | 'never' | 'always';
      cacheEnabled?: boolean;
      allowsInlineMediaPlayback?: boolean;
      allowsBackForwardNavigationGestures?: boolean;
    };
    performance?: {
      androidLayerType?: 'none' | 'software' | 'hardware';
      overScrollMode?: 'always' | 'content' | 'never';
      textZoom?: number;
      nestedScrollEnabled?: boolean;
      hideScrollIndicators?: boolean;
      allowsFullscreenVideo?: boolean;
      setSupportMultipleWindows?: boolean;
    };
  };
  offline?: {
    enabled?: boolean;
    title?: string;
    message?: string;
    retryButtonText?: string;
    backgroundColor?: string;
    darkBackgroundColor?: string;
    autoReconnect?: boolean;
  };
  statusBar?: {
    visible?: boolean;
    style?: 'auto' | 'light' | 'dark';
    overlapsWebView?: boolean;
    showOverlay?: boolean;
    overlayColor?: string;
    translucent?: boolean;
  };
  navigationBar?: {
    visibility?: 'visible' | 'hidden';
    behavior?: 'overlay-swipe' | 'inset-swipe';
    backgroundColor?: string;
    darkBackgroundColor?: string;
    buttonStyle?: 'light' | 'dark';
  };
  safeArea?: {
    enabled?: boolean;
    edges?: 'all' | 'top' | 'bottom' | 'none';
    backgroundColor?: string;
    darkBackgroundColor?: string;
  };
  splash?: {
    enabled?: boolean;
    minDisplayTime?: number;
    fadeOutDuration?: number;
    backgroundColor?: string;
    darkBackgroundColor?: string;
    logoImage?: string | null;
    loadingText?: string;
    showLoadingIndicator?: boolean;
  };
  security?: {
    allowedOrigins?: string[];
    blockedSchemes?: string[];
    allowedSchemes?: string[];
  };
}

export interface ThemeConfig {
  $schema?: string;
  colors?: {
    light?: {
      text?: string;
      background?: string;
      tint?: string;
      icon?: string;
      tabIconDefault?: string;
      tabIconSelected?: string;
    };
    dark?: {
      text?: string;
      background?: string;
      tint?: string;
      icon?: string;
      tabIconDefault?: string;
      tabIconSelected?: string;
    };
  };
}

export interface PluginsConfig {
  $schema?: string;
  plugins?: {
    auto?: Array<{
      name: string;
      namespace: string;
      method?: string;
      keepModules?: string[];
    }>;
    manual?: Array<{
      path: string;
      namespace: string;
      entry?: string;
      method?: string;
    }>;
  };
}
```

**Step 2: Create AppConfig page**

```tsx
// tools/config-editor/client/src/pages/AppConfig.tsx
import { useTranslation } from 'react-i18next';
import { useConfig } from '../hooks/useConfig';
import {
  TextInput,
  NumberInput,
  Toggle,
  Select,
  ColorPicker,
  TagInput,
  Accordion
} from '../components/form';
import type { AppConfig } from '../types/config';

interface AppConfigProps {
  onUnsavedChange: (hasChanges: boolean) => void;
}

export default function AppConfigPage({ onUnsavedChange }: AppConfigProps) {
  const { t } = useTranslation();
  const { data, setData, loading, error, saving, saveConfig, revert, hasChanges } =
    useConfig<AppConfig>('app');

  // 변경 사항 알림
  if (hasChanges !== undefined) {
    onUnsavedChange(hasChanges);
  }

  if (loading) return <div className="p-4">{t('common.loading')}</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!data) return null;

  const updateField = <T,>(path: string[], value: T) => {
    const newData = { ...data };
    let current: any = newData;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {};
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    setData(newData);
  };

  const handleSave = async () => {
    await saveConfig(data);
  };

  return (
    <div>
      {/* Webview Settings */}
      <Accordion title={t('app.webview.title')} defaultOpen>
        <TextInput
          label={t('app.webview.baseUrl')}
          value={data.webview?.baseUrl || ''}
          onChange={(v) => updateField(['webview', 'baseUrl'], v)}
          description={t('app.webview.baseUrlDesc')}
        />
        <TextInput
          label={t('app.webview.userAgent')}
          value={data.webview?.userAgent || ''}
          onChange={(v) => updateField(['webview', 'userAgent'], v)}
        />

        <Accordion title={t('app.webview.options')}>
          <Toggle
            label="JavaScript Enabled"
            value={data.webview?.options?.javaScriptEnabled ?? true}
            onChange={(v) => updateField(['webview', 'options', 'javaScriptEnabled'], v)}
          />
          <Toggle
            label="DOM Storage Enabled"
            value={data.webview?.options?.domStorageEnabled ?? true}
            onChange={(v) => updateField(['webview', 'options', 'domStorageEnabled'], v)}
          />
          <Toggle
            label="Third Party Cookies"
            value={data.webview?.options?.thirdPartyCookiesEnabled ?? true}
            onChange={(v) => updateField(['webview', 'options', 'thirdPartyCookiesEnabled'], v)}
          />
          <Toggle
            label="Cache Enabled"
            value={data.webview?.options?.cacheEnabled ?? true}
            onChange={(v) => updateField(['webview', 'options', 'cacheEnabled'], v)}
          />
          <Select
            label="Mixed Content Mode"
            value={data.webview?.options?.mixedContentMode || 'compatibility'}
            onChange={(v) => updateField(['webview', 'options', 'mixedContentMode'], v)}
            options={[
              { value: 'compatibility', label: 'Compatibility' },
              { value: 'never', label: 'Never' },
              { value: 'always', label: 'Always' }
            ]}
          />
        </Accordion>

        <Accordion title={t('app.webview.performance')}>
          <Select
            label="Android Layer Type"
            value={data.webview?.performance?.androidLayerType || 'hardware'}
            onChange={(v) => updateField(['webview', 'performance', 'androidLayerType'], v)}
            options={[
              { value: 'none', label: 'None' },
              { value: 'software', label: 'Software' },
              { value: 'hardware', label: 'Hardware' }
            ]}
          />
          <NumberInput
            label="Text Zoom"
            value={data.webview?.performance?.textZoom ?? 100}
            onChange={(v) => updateField(['webview', 'performance', 'textZoom'], v)}
            min={50}
            max={200}
            showSlider
          />
        </Accordion>
      </Accordion>

      {/* Offline Screen */}
      <Accordion title={t('app.offline.title')}>
        <Toggle
          label={t('app.offline.enabled')}
          value={data.offline?.enabled ?? true}
          onChange={(v) => updateField(['offline', 'enabled'], v)}
        />
        <TextInput
          label={t('app.offline.titleField')}
          value={data.offline?.title || ''}
          onChange={(v) => updateField(['offline', 'title'], v)}
        />
        <TextInput
          label={t('app.offline.message')}
          value={data.offline?.message || ''}
          onChange={(v) => updateField(['offline', 'message'], v)}
        />
        <ColorPicker
          label="Background Color"
          value={data.offline?.backgroundColor || '#ffffff'}
          onChange={(v) => updateField(['offline', 'backgroundColor'], v)}
        />
      </Accordion>

      {/* Status Bar */}
      <Accordion title={t('app.statusBar.title')}>
        <Toggle
          label={t('app.statusBar.visible')}
          value={data.statusBar?.visible ?? true}
          onChange={(v) => updateField(['statusBar', 'visible'], v)}
        />
        <Select
          label={t('app.statusBar.style')}
          value={data.statusBar?.style || 'dark'}
          onChange={(v) => updateField(['statusBar', 'style'], v)}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' }
          ]}
        />
      </Accordion>

      {/* Navigation Bar */}
      <Accordion title={t('app.navigationBar.title')}>
        <Select
          label={t('app.navigationBar.visibility')}
          value={data.navigationBar?.visibility || 'visible'}
          onChange={(v) => updateField(['navigationBar', 'visibility'], v)}
          options={[
            { value: 'visible', label: 'Visible' },
            { value: 'hidden', label: 'Hidden' }
          ]}
        />
        <ColorPicker
          label="Background Color"
          value={data.navigationBar?.backgroundColor || '#ffffff'}
          onChange={(v) => updateField(['navigationBar', 'backgroundColor'], v)}
        />
      </Accordion>

      {/* Safe Area */}
      <Accordion title={t('app.safeArea.title')}>
        <Toggle
          label={t('app.safeArea.enabled')}
          value={data.safeArea?.enabled ?? false}
          onChange={(v) => updateField(['safeArea', 'enabled'], v)}
        />
        <Select
          label={t('app.safeArea.edges')}
          value={data.safeArea?.edges || 'none'}
          onChange={(v) => updateField(['safeArea', 'edges'], v)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'top', label: 'Top' },
            { value: 'bottom', label: 'Bottom' },
            { value: 'none', label: 'None' }
          ]}
        />
      </Accordion>

      {/* Splash Screen */}
      <Accordion title={t('app.splash.title')}>
        <Toggle
          label={t('app.splash.enabled')}
          value={data.splash?.enabled ?? true}
          onChange={(v) => updateField(['splash', 'enabled'], v)}
        />
        <NumberInput
          label={t('app.splash.minDisplayTime')}
          value={data.splash?.minDisplayTime ?? 1000}
          onChange={(v) => updateField(['splash', 'minDisplayTime'], v)}
          min={0}
          max={5000}
          step={100}
        />
        <TextInput
          label={t('app.splash.loadingText')}
          value={data.splash?.loadingText || ''}
          onChange={(v) => updateField(['splash', 'loadingText'], v)}
        />
      </Accordion>

      {/* Security */}
      <Accordion title={t('app.security.title')}>
        <TagInput
          label={t('app.security.allowedOrigins')}
          value={data.security?.allowedOrigins || []}
          onChange={(v) => updateField(['security', 'allowedOrigins'], v)}
          placeholder="https://example.com"
        />
      </Accordion>

      {/* Save/Revert Buttons */}
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <div>
          {hasChanges && (
            <span className="text-sm text-orange-500">{t('common.unsaved')}</span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={revert}
            disabled={!hasChanges}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {t('common.revert')}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add tools/config-editor/client/src/pages/AppConfig.tsx tools/config-editor/client/src/types/config.ts
git commit -m "feat(config-editor): add AppConfig page with all settings sections"
```

---

### Task 4.3: ThemeConfig Page

**Files:**
- Create: `tools/config-editor/client/src/pages/ThemeConfig.tsx`

**Step 1: Create ThemeConfig page**

```tsx
// tools/config-editor/client/src/pages/ThemeConfig.tsx
import { useTranslation } from 'react-i18next';
import { useConfig } from '../hooks/useConfig';
import { ColorPicker } from '../components/form';
import type { ThemeConfig } from '../types/config';

interface ThemeConfigProps {
  onUnsavedChange: (hasChanges: boolean) => void;
}

const DEFAULT_COLORS = {
  light: {
    text: '#11181C',
    background: '#ffffff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4'
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#ffffff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#ffffff'
  }
};

const COLOR_KEYS = ['text', 'background', 'tint', 'icon', 'tabIconDefault', 'tabIconSelected'] as const;

export default function ThemeConfigPage({ onUnsavedChange }: ThemeConfigProps) {
  const { t } = useTranslation();
  const { data, setData, loading, error, saving, saveConfig, revert, hasChanges } =
    useConfig<ThemeConfig>('theme');

  if (hasChanges !== undefined) {
    onUnsavedChange(hasChanges);
  }

  if (loading) return <div className="p-4">{t('common.loading')}</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!data) return null;

  const updateColor = (mode: 'light' | 'dark', key: string, value: string) => {
    const newData = {
      ...data,
      colors: {
        ...data.colors,
        [mode]: {
          ...data.colors?.[mode],
          [key]: value
        }
      }
    };
    setData(newData);
  };

  const getColor = (mode: 'light' | 'dark', key: string) => {
    return data.colors?.[mode]?.[key as keyof typeof DEFAULT_COLORS.light] ||
           DEFAULT_COLORS[mode][key as keyof typeof DEFAULT_COLORS.light];
  };

  const handleReset = () => {
    setData({
      $schema: data.$schema,
      colors: { light: {}, dark: {} }
    });
  };

  const handleSave = async () => {
    await saveConfig(data);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-8">
        {/* Light Mode */}
        <div className="p-4 bg-white border rounded-lg">
          <h3 className="text-lg font-medium mb-4">{t('theme.light')}</h3>
          {COLOR_KEYS.map(key => (
            <ColorPicker
              key={`light-${key}`}
              label={key}
              value={getColor('light', key)}
              onChange={(v) => updateColor('light', key, v)}
            />
          ))}
        </div>

        {/* Dark Mode */}
        <div className="p-4 bg-gray-800 border rounded-lg">
          <h3 className="text-lg font-medium mb-4 text-white">{t('theme.dark')}</h3>
          {COLOR_KEYS.map(key => (
            <div key={`dark-${key}`} className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {key}
              </label>
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded border-2 border-gray-600"
                  style={{ backgroundColor: getColor('dark', key) }}
                />
                <input
                  type="text"
                  value={getColor('dark', key)}
                  onChange={(e) => updateColor('dark', key, e.target.value)}
                  className="w-28 px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md font-mono text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reset Button */}
      <div className="mt-4">
        <button
          onClick={handleReset}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {t('theme.reset')}
        </button>
      </div>

      {/* Save/Revert Buttons */}
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <div>
          {hasChanges && (
            <span className="text-sm text-orange-500">{t('common.unsaved')}</span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={revert}
            disabled={!hasChanges}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {t('common.revert')}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add tools/config-editor/client/src/pages/ThemeConfig.tsx
git commit -m "feat(config-editor): add ThemeConfig page with light/dark color pickers"
```

---

### Task 4.4: PluginsConfig Page

**Files:**
- Create: `tools/config-editor/client/src/pages/PluginsConfig.tsx`
- Create: `tools/config-editor/client/src/components/AddAutoPluginModal.tsx`
- Create: `tools/config-editor/client/src/components/AddManualPluginModal.tsx`

**Step 1: Create AddAutoPluginModal**

```tsx
// tools/config-editor/client/src/components/AddAutoPluginModal.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlugins } from '../hooks/usePlugins';

interface AddAutoPluginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, namespace: string, needsInstall: boolean) => void;
  existingPlugins: string[];
}

export default function AddAutoPluginModal({
  isOpen,
  onClose,
  onAdd,
  existingPlugins
}: AddAutoPluginModalProps) {
  const { t } = useTranslation();
  const { installedPackages, searchResults, loading, fetchInstalled, searchPackages } = usePlugins();

  const [searchQuery, setSearchQuery] = useState('rnww-plugin-');
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [namespace, setNamespace] = useState('');
  const [version, setVersion] = useState('latest');

  useEffect(() => {
    if (isOpen) {
      fetchInstalled();
    }
  }, [isOpen, fetchInstalled]);

  useEffect(() => {
    if (selectedPackage) {
      // 자동 네임스페이스 생성
      const ns = selectedPackage
        .replace('rnww-plugin-', '')
        .replace(/-/g, '')
        .slice(0, 6);
      setNamespace(ns);
    }
  }, [selectedPackage]);

  if (!isOpen) return null;

  const handleSearch = () => {
    searchPackages(searchQuery);
  };

  const handleAdd = () => {
    if (selectedPackage && namespace) {
      const isInstalled = installedPackages.some(p => p.name === selectedPackage);
      onAdd(selectedPackage, namespace, !isInstalled);
      onClose();
    }
  };

  const filteredInstalled = installedPackages.filter(
    p => !existingPlugins.includes(p.name)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[600px] max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-medium">{t('plugins.addAutoTitle')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* Installed Packages */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              {t('plugins.installedPackages')}
            </h3>
            <div className="border rounded max-h-40 overflow-y-auto">
              {filteredInstalled.map(pkg => (
                <button
                  key={pkg.name}
                  onClick={() => setSelectedPackage(pkg.name)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex justify-between items-center ${
                    selectedPackage === pkg.name ? 'bg-blue-50' : ''
                  }`}
                >
                  <span>
                    {pkg.name.startsWith('rnww-plugin-') && '⭐ '}
                    {pkg.name} (v{pkg.version})
                  </span>
                  <span className="text-sm text-blue-500">Select</span>
                </button>
              ))}
            </div>
          </div>

          {/* npm Search */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              {t('plugins.npmSearch')}
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('plugins.searchPlaceholder')}
                className="flex-1 px-3 py-2 border rounded-md"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                {loading ? '...' : 'Search'}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border rounded max-h-40 overflow-y-auto">
                {searchResults.map(pkg => (
                  <button
                    key={pkg.name}
                    onClick={() => setSelectedPackage(pkg.name)}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${
                      selectedPackage === pkg.name ? 'bg-blue-50' : ''
                    }`}
                  >
                    {pkg.name.startsWith('rnww-plugin-') && '⭐ '}
                    {pkg.name} (v{pkg.version})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Package */}
          {selectedPackage && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                {t('plugins.selected')}: <strong>{selectedPackage}</strong>
              </p>
              <div className="flex gap-4">
                <div>
                  <label className="block text-sm text-gray-600">{t('plugins.version')}</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-24 px-2 py-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">{t('plugins.namespace')}</label>
                  <input
                    type="text"
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                    className="w-24 px-2 py-1 border rounded text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedPackage || !namespace}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {t('plugins.installAndAdd')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create AddManualPluginModal**

```tsx
// tools/config-editor/client/src/components/AddManualPluginModal.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlugins } from '../hooks/usePlugins';

interface AddManualPluginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (path: string, namespace: string) => void;
  existingPaths: string[];
}

export default function AddManualPluginModal({
  isOpen,
  onClose,
  onAdd,
  existingPaths
}: AddManualPluginModalProps) {
  const { t } = useTranslation();
  const { scannedFolders, loading, scanFolders } = usePlugins();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [namespace, setNamespace] = useState('');

  useEffect(() => {
    if (isOpen) {
      scanFolders();
    }
  }, [isOpen, scanFolders]);

  useEffect(() => {
    if (selectedPath) {
      const ns = selectedPath.replace('./', '').replace(/-/g, '').slice(0, 6);
      setNamespace(ns);
    }
  }, [selectedPath]);

  if (!isOpen) return null;

  const handleAdd = () => {
    if (selectedPath && namespace) {
      onAdd(selectedPath, namespace);
      onClose();
    }
  };

  const availableFolders = scannedFolders.filter(
    folder => !existingPaths.includes(folder)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[500px]">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-medium">{t('plugins.addManualTitle')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="p-4">
          <p className="text-sm text-gray-600 mb-3">{t('plugins.scanResults')}</p>

          {loading ? (
            <div className="text-center py-4">{t('common.loading')}</div>
          ) : availableFolders.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No unregistered folders found
            </div>
          ) : (
            <div className="border rounded max-h-60 overflow-y-auto">
              {availableFolders.map(folder => (
                <button
                  key={folder}
                  onClick={() => setSelectedPath(folder)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${
                    selectedPath === folder ? 'bg-blue-50' : ''
                  }`}
                >
                  {folder}
                </button>
              ))}
            </div>
          )}

          {selectedPath && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                {t('plugins.selected')}: <strong>{selectedPath}</strong>
              </p>
              <div>
                <label className="block text-sm text-gray-600">{t('plugins.namespace')}</label>
                <input
                  type="text"
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  className="w-32 px-2 py-1 border rounded text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedPath || !namespace}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {t('plugins.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create PluginsConfig page**

```tsx
// tools/config-editor/client/src/pages/PluginsConfig.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '../hooks/useConfig';
import { usePlugins } from '../hooks/usePlugins';
import AddAutoPluginModal from '../components/AddAutoPluginModal';
import AddManualPluginModal from '../components/AddManualPluginModal';
import type { PluginsConfig } from '../types/config';

interface PluginsConfigProps {
  onUnsavedChange: (hasChanges: boolean) => void;
}

export default function PluginsConfigPage({ onUnsavedChange }: PluginsConfigProps) {
  const { t } = useTranslation();
  const { data, setData, loading, error, saving, saveConfig, revert, hasChanges } =
    useConfig<PluginsConfig>('plugins');
  const { installedPackages, fetchInstalled, installPackage, uninstallPackage } = usePlugins();

  const [showAutoModal, setShowAutoModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  if (hasChanges !== undefined) {
    onUnsavedChange(hasChanges);
  }

  if (loading) return <div className="p-4">{t('common.loading')}</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!data) return null;

  const autoPlugins = data.plugins?.auto || [];
  const manualPlugins = data.plugins?.manual || [];

  const isInstalled = (name: string) =>
    installedPackages.some(p => p.name === name);

  const handleAddAutoPlugin = async (name: string, namespace: string, needsInstall: boolean) => {
    if (needsInstall) {
      setInstalling(name);
      await installPackage(name);
      setInstalling(null);
    }
    setData({
      ...data,
      plugins: {
        ...data.plugins,
        auto: [...autoPlugins, { name, namespace }]
      }
    });
  };

  const handleAddManualPlugin = (path: string, namespace: string) => {
    setData({
      ...data,
      plugins: {
        ...data.plugins,
        manual: [...manualPlugins, { path, namespace }]
      }
    });
  };

  const handleRemoveAutoPlugin = (index: number) => {
    setData({
      ...data,
      plugins: {
        ...data.plugins,
        auto: autoPlugins.filter((_, i) => i !== index)
      }
    });
  };

  const handleRemoveManualPlugin = (index: number) => {
    setData({
      ...data,
      plugins: {
        ...data.plugins,
        manual: manualPlugins.filter((_, i) => i !== index)
      }
    });
  };

  const handleSave = async () => {
    await saveConfig(data);
  };

  return (
    <div>
      {/* Auto Plugins */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium">{t('plugins.auto')}</h3>
          <button
            onClick={() => setShowAutoModal(true)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + {t('plugins.add')}
          </button>
        </div>
        <div className="border rounded-lg divide-y">
          {autoPlugins.length === 0 ? (
            <div className="p-4 text-gray-500 text-center">No auto plugins</div>
          ) : (
            autoPlugins.map((plugin, index) => {
              const installed = isInstalled(plugin.name);
              return (
                <div key={plugin.name} className="p-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      {plugin.name.startsWith('rnww-plugin-') && '⭐ '}
                      {plugin.name}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      namespace: {plugin.namespace}
                    </span>
                    <div className="mt-1 text-sm">
                      {installed ? (
                        <span className="text-green-600">✅ {t('plugins.installed')}</span>
                      ) : (
                        <span className="text-orange-500">⚠️ {t('plugins.notInstalled')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!installed && (
                      <button
                        onClick={() => installPackage(plugin.name)}
                        disabled={installing === plugin.name}
                        className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                      >
                        {installing === plugin.name ? '...' : t('plugins.install')}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveAutoPlugin(index)}
                      className="px-3 py-1 text-sm text-red-500 border border-red-300 rounded hover:bg-red-50"
                    >
                      {t('plugins.remove')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Manual Plugins */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium">{t('plugins.manual')}</h3>
          <button
            onClick={() => setShowManualModal(true)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + {t('plugins.add')}
          </button>
        </div>
        <div className="border rounded-lg divide-y">
          {manualPlugins.length === 0 ? (
            <div className="p-4 text-gray-500 text-center">No manual plugins</div>
          ) : (
            manualPlugins.map((plugin, index) => (
              <div key={plugin.path} className="p-3 flex items-center justify-between">
                <div>
                  <span className="font-medium">{plugin.path}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    namespace: {plugin.namespace}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveManualPlugin(index)}
                  className="px-3 py-1 text-sm text-red-500 border border-red-300 rounded hover:bg-red-50"
                >
                  {t('plugins.remove')}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Save/Revert Buttons */}
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <div>
          {hasChanges && (
            <span className="text-sm text-orange-500">{t('common.unsaved')}</span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={revert}
            disabled={!hasChanges}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {t('common.revert')}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>

      {/* Modals */}
      <AddAutoPluginModal
        isOpen={showAutoModal}
        onClose={() => setShowAutoModal(false)}
        onAdd={handleAddAutoPlugin}
        existingPlugins={autoPlugins.map(p => p.name)}
      />
      <AddManualPluginModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onAdd={handleAddManualPlugin}
        existingPaths={manualPlugins.map(p => p.path)}
      />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add tools/config-editor/client/src/pages/PluginsConfig.tsx tools/config-editor/client/src/components/AddAutoPluginModal.tsx tools/config-editor/client/src/components/AddManualPluginModal.tsx
git commit -m "feat(config-editor): add PluginsConfig page with add/remove modals"
```

---

### Task 4.5: Integrate Pages into App

**Files:**
- Modify: `tools/config-editor/client/src/App.tsx`

**Step 1: Update App.tsx with all pages**

```tsx
// tools/config-editor/client/src/App.tsx
import { useState, useCallback } from 'react';
import Layout from './components/Layout';
import TabNav from './components/TabNav';
import AppConfigPage from './pages/AppConfig';
import ThemeConfigPage from './pages/ThemeConfig';
import PluginsConfigPage from './pages/PluginsConfig';

export default function App() {
  const [activeTab, setActiveTab] = useState('appSettings');
  const [unsavedTabs, setUnsavedTabs] = useState<string[]>([]);

  const handleUnsavedChange = useCallback((tab: string) => (hasChanges: boolean) => {
    setUnsavedTabs(prev => {
      if (hasChanges && !prev.includes(tab)) {
        return [...prev, tab];
      }
      if (!hasChanges && prev.includes(tab)) {
        return prev.filter(t => t !== tab);
      }
      return prev;
    });
  }, []);

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow">
        <TabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          unsavedTabs={unsavedTabs}
        />
        <div className="p-6">
          {activeTab === 'appSettings' && (
            <AppConfigPage onUnsavedChange={handleUnsavedChange('appSettings')} />
          )}
          {activeTab === 'theme' && (
            <ThemeConfigPage onUnsavedChange={handleUnsavedChange('theme')} />
          )}
          {activeTab === 'plugins' && (
            <PluginsConfigPage onUnsavedChange={handleUnsavedChange('plugins')} />
          )}
          {activeTab === 'build' && (
            <div className="text-center py-12 text-gray-500">
              Build Tab - Coming Soon
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
```

**Step 2: Verify all pages work**

Run: `npm run config:dev`
Expected: All tabs render correctly

**Step 3: Commit**

```bash
git add tools/config-editor/client/src/App.tsx
git commit -m "feat(config-editor): integrate all config pages into app"
```

---

## Phase 5: Plugin Registry Generator

### Task 5.1: Create Generator Script

**Files:**
- Create: `scripts/generate-plugin-registry.js`

**Step 1: Create generator script**

```javascript
// scripts/generate-plugin-registry.js
/**
 * plugins.json을 읽어 plugin-registry.ts를 자동 생성
 * 실행: node scripts/generate-plugin-registry.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_JSON = path.join(__dirname, '../constants/plugins.json');
const REGISTRY_TS = path.join(__dirname, '../lib/bridges/plugin-registry.ts');

async function generate() {
  // Read plugins.json
  const content = await fs.readFile(PLUGINS_JSON, 'utf-8');
  const config = JSON.parse(content);

  const autoPlugins = config.plugins?.auto || [];
  const manualPlugins = config.plugins?.manual || [];

  // Generate TypeScript content
  const output = `// lib/bridges/plugin-registry.ts
/**
 * 플러그인 레지스트리
 * - 동적 import를 위한 매핑 객체
 * - Metro 번들러 호환을 위해 정적 경로 사용
 *
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * Generated from: constants/plugins.json
 * Run: npm run generate:plugins
 */

/** Auto 플러그인 매핑 (npm 패키지) */
export const AUTO_PLUGINS: Record<string, () => Promise<any>> = {
${autoPlugins.map(p => `  '${p.name}': () => import('${p.name}'),`).join('\n')}
};

/** Manual 플러그인 매핑 (로컬 구현) */
export const MANUAL_PLUGINS: Record<string, () => Promise<any>> = {
${manualPlugins.map(p => `  '${p.path}': () => import('${p.path}'),`).join('\n')}
};
`;

  // Write output
  await fs.writeFile(REGISTRY_TS, output, 'utf-8');
  console.log('✅ Generated: lib/bridges/plugin-registry.ts');
}

generate().catch(console.error);
```

**Step 2: Add npm script to root package.json**

Add to scripts:
```json
"generate:plugins": "node scripts/generate-plugin-registry.js"
```

**Step 3: Verify script works**

Run: `npm run generate:plugins`
Expected: plugin-registry.ts is generated

**Step 4: Commit**

```bash
git add scripts/generate-plugin-registry.js package.json
git commit -m "feat: add plugin-registry generator script"
```

---

### Task 5.2: Trigger Generator on Save

**Files:**
- Modify: `tools/config-editor/server/routes/config.js`

**Step 1: Add generator call after plugins.json save**

```javascript
// tools/config-editor/server/routes/config.js 수정
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const projectRoot = path.resolve(__dirname, '../../../..');

// PUT /api/config/:type 수정
router.put('/:type', async (req, res) => {
  const { type } = req.params;
  const filename = CONFIG_FILES[type];

  if (!filename) {
    return res.status(400).json({ error: 'Invalid config type' });
  }

  try {
    const filePath = path.join(constantsDir, filename);
    const content = JSON.stringify(req.body, null, 2) + '\n';
    await fs.writeFile(filePath, content, 'utf-8');

    // plugins.json 저장 시 레지스트리 재생성
    if (type === 'plugins') {
      try {
        await execAsync('npm run generate:plugins', { cwd: projectRoot });
        console.log('Plugin registry regenerated');
      } catch (e) {
        console.error('Failed to regenerate plugin registry:', e);
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: `Failed to write ${filename}` });
  }
});
```

**Step 2: Verify auto-generation works**

1. Run config editor
2. Add/remove a plugin
3. Save plugins config
4. Check plugin-registry.ts is updated

**Step 3: Commit**

```bash
git add tools/config-editor/server/routes/config.js
git commit -m "feat(config-editor): auto-regenerate plugin-registry on plugins.json save"
```

---

## Phase 6: Production Build

### Task 6.1: Build Script Setup

**Files:**
- Modify: `tools/config-editor/package.json`
- Modify: `tools/config-editor/server/index.js`

**Step 1: Update package.json with build scripts**

```json
{
  "scripts": {
    "dev": "node server/index.js --dev",
    "start": "npm run build:client && node server/index.js",
    "build:client": "cd client && npm install && npm run build"
  }
}
```

**Step 2: Update server to serve built files**

Ensure server already handles static files from `client/dist`.

**Step 3: Test production build**

Run: `cd tools/config-editor && npm start`
Expected: Client builds, server starts, browser opens with production build

**Step 4: Commit**

```bash
git add tools/config-editor/package.json
git commit -m "feat(config-editor): add production build setup"
```

---

### Task 6.2: Create README

**Files:**
- Create: `tools/config-editor/README.md`

**Step 1: Create README**

```markdown
# RNWW Config Editor

GUI tool for editing React Native Web Wrapper configuration files.

## Usage

From project root:

```bash
# Production mode (builds client, starts server)
npm run config

# Development mode (requires separate client dev server)
npm run config:dev
# In another terminal:
cd tools/config-editor/client && npm run dev
```

## Features

- **App Settings**: Edit webview, offline, status bar, navigation bar, safe area, splash, security settings
- **Theme**: Light/dark mode color configuration with color pickers
- **Plugins**: Manage auto (npm) and manual (local) plugins

## Configuration Files

- `constants/app.json` - App configuration overrides
- `constants/theme.json` - Theme color overrides
- `constants/plugins.json` - Plugin configuration

## Plugin Registry

When plugins.json is saved, `lib/bridges/plugin-registry.ts` is automatically regenerated.

Manual regeneration:
```bash
npm run generate:plugins
```

## Tech Stack

- **Server**: Express, get-port, open
- **Client**: React, Vite, Tailwind CSS, i18next, react-colorful
```

**Step 2: Commit**

```bash
git add tools/config-editor/README.md
git commit -m "docs(config-editor): add README"
```

---

## Final Task: Integration Test

**Step 1: Full test cycle**

1. Run `npm run config`
2. Edit app settings → Save → Verify `constants/app.json` updated
3. Edit theme colors → Save → Verify `constants/theme.json` updated
4. Add auto plugin → Save → Verify `constants/plugins.json` and `plugin-registry.ts` updated
5. Add manual plugin → Save → Verify changes
6. Test language switching (ko/en)
7. Test unsaved indicator on tabs

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat(config-editor): complete config editor GUI implementation"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1.1-1.3 | Project setup (server, client, scripts) |
| 2 | 2.1-2.2 | API routes (config, plugins) |
| 3 | 3.1-3.3 | UI components (i18n, layout, forms) |
| 4 | 4.1-4.5 | Page components (hooks, app/theme/plugins) |
| 5 | 5.1-5.2 | Plugin registry generator |
| 6 | 6.1-6.2 | Production build and docs |

Total estimated commits: 15+
