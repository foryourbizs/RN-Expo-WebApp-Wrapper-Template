# Config Editor GUI Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Create a cross-platform GUI tool for editing app configuration (app.json, theme.json, plugins.json)

**Architecture:** CLI + Web approach - `npm run config` starts a local Express server, opens browser automatically

**Tech Stack:** React + Vite + Tailwind CSS + Express

---

## Overview

- **Target Users:** Developers and non-developers
- **Platforms:** Windows, Ubuntu, Mac (via browser)
- **Location:** `tools/config-editor/` within project
- **Execution:** `npm run config`

---

## Project Structure

```
tools/config-editor/
├── package.json              # Independent dependencies
├── server/
│   ├── index.js              # Express server (API + static files)
│   ├── routes/
│   │   ├── config.js         # JSON file read/write API
│   │   ├── plugins.js        # npm search/install/status API
│   │   └── scaffold.js       # Manual plugin folder scan API
│   └── utils/
│       └── npm.js            # npm command execution utility
├── client/                   # React + Vite
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── AppConfig.tsx      # app.json editor
│   │   │   ├── ThemeConfig.tsx    # theme.json editor
│   │   │   └── PluginsConfig.tsx  # plugins.json + npm management
│   │   ├── components/
│   │   └── i18n/
│   │       ├── index.ts      # i18next config
│   │       ├── ko.json       # Korean
│   │       └── en.json       # English
│   └── vite.config.ts
└── README.md

scripts/
└── generate-plugin-registry.js  # plugins.json → plugin-registry.ts
```

---

## Execution Flow

1. `npm run config` → Express server starts (auto-find free port)
2. Server serves Vite dev server (proxy) or built static files
3. Browser opens automatically → `http://localhost:<port>`
4. API reads/writes `constants/*.json` files
5. npm commands executed via `child_process` on server

---

## UI Structure

### Tab-based Single Page

```
┌─────────────────────────────────────────────────────────┐
│  RNWW Config Editor                    [KO ▼] [v1.0.0] │
├─────────────────────────────────────────────────────────┤
│  [App Settings]  [Theme]  [Plugins]  [Build ❋]          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   (Tab content area)                                    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [Save] [Revert]                      Last saved: 3m ago│
└─────────────────────────────────────────────────────────┘
```

- **App Settings**: webview, offline, statusBar, navigationBar, safeArea, splash, debug, security
- **Theme**: light/dark color palette with color picker
- **Plugins**: auto/manual plugin management, npm search/install
- **Build ❋**: Future extension (disabled state)

### Save Behavior

- [Save] button at bottom of each tab
- Unsaved changes shown with • on tab (e.g., `App Settings •`)
- [Revert] restores to last saved state

---

## App Settings Tab

**Accordion group style** - collapsible related settings:

```
┌─────────────────────────────────────────────────────────┐
│ ▼ Webview Settings                                      │
├─────────────────────────────────────────────────────────┤
│   Base URL        [https://example.com/            ]    │
│   User Agent      [webapp-wrapper                  ]    │
│                                                         │
│   ▶ Options (collapsed)                                 │
│   ▶ Performance (collapsed)                             │
├─────────────────────────────────────────────────────────┤
│ ▶ Offline Screen (collapsed)                            │
├─────────────────────────────────────────────────────────┤
│ ▶ Status Bar (collapsed)                                │
├─────────────────────────────────────────────────────────┤
│ ▶ Navigation Bar (collapsed)                            │
├─────────────────────────────────────────────────────────┤
│ ▶ Safe Area (collapsed)                                 │
├─────────────────────────────────────────────────────────┤
│ ▶ Splash Screen (collapsed)                             │
├─────────────────────────────────────────────────────────┤
│ ▶ Security (collapsed)                                  │
└─────────────────────────────────────────────────────────┘
```

**Input Components:**
- Text: standard input
- Number: number input + slider (when range exists)
- Boolean: toggle switch
- Select: dropdown (e.g., `mixedContentMode`)
- Color: color picker
- Array: tag input (e.g., `allowedOrigins`)

Each field has **tooltip** with description (extracted from app-config.ts comments).

---

## Theme Tab

**Light/Dark mode side-by-side comparison:**

```
┌───────────────────────────┬───────────────────────────┐
│      Light Mode           │       Dark Mode           │
├───────────────────────────┼───────────────────────────┤
│ text        [■ #11181C]   │ text        [■ #ECEDEE]   │
│ background  [■ #ffffff]   │ background  [■ #151718]   │
│ tint        [■ #0a7ea4]   │ tint        [■ #ffffff]   │
│ icon        [■ #687076]   │ icon        [■ #9BA1A6]   │
│ tabDefault  [■ #687076]   │ tabDefault  [■ #9BA1A6]   │
│ tabSelected [■ #0a7ea4]   │ tabSelected [■ #ffffff]   │
├───────────────────────────┴───────────────────────────┤
│  [Reset to defaults]                                   │
└───────────────────────────────────────────────────────┘
```

- Click color picker for popup selection
- Direct HEX input supported
- Color box (■) shows selected color preview
- [Reset to defaults] restores theme.ts default values

---

## Plugins Tab

### Two Sections: Auto (npm) / Manual (local)

```
┌─────────────────────────────────────────────────────────┐
│ ▼ Auto Plugins (npm packages)                  [+ Add]  │
├─────────────────────────────────────────────────────────┤
│ │ ⭐ rnww-plugin-camera                    namespace:  │ │
│ │    ✅ Installed (v1.0.3)  ✅ Active       [cam    ]  │ │
│ │                                [Deactivate] [Remove] │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ ⭐ rnww-plugin-gps                       namespace:  │ │
│ │    ⚠️ Not installed        ❌ Inactive    [gps    ]  │ │
│ │                                   [Install] [Remove] │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ▼ Manual Plugins (local implementation)        [+ Add]  │
├─────────────────────────────────────────────────────────┤
│ │ ☑ ./clipboard                            [clip   ]   │ │
│ │ ☑ ./device                               [device ]   │ │
│ │ ☐ ./push           (inactive)            [push   ]   │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

- ⭐ marks `rnww-plugin-*` packages (prioritized display)
- Checkbox for activate/deactivate

### [+ Add] Modal (Auto Plugin)

```
┌─────────────────────────────────────────────────────────┐
│  Add Plugin                                         [X] │
├─────────────────────────────────────────────────────────┤
│  ┌─ Installed Packages ────────────────────────────────┐│
│  │ ⭐ rnww-plugin-camera (v1.0.3)              [Select]││
│  │ ⭐ rnww-plugin-bluetooth (v1.0.2)           [Select]││
│  │    axios (v1.6.0)                           [Select]││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─ npm Search ────────────────────────────────────────┐│
│  │ [rnww-plugin-                    ] [Search]         ││
│  │                                                     ││
│  │ Results:                                            ││
│  │ ⭐ rnww-plugin-nfc (v1.0.0)                 [Select]││
│  │ ⭐ rnww-plugin-biometric (v0.9.2)           [Select]││
│  └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│  Selected: rnww-plugin-nfc                              │
│  Version:  [latest         ▼]  (or direct input)        │
│  Namespace: [nfc        ]                               │
├─────────────────────────────────────────────────────────┤
│              [Cancel]  [Install & Add]                  │
└─────────────────────────────────────────────────────────┘
```

**Flow:**
1. Modal opens with installed packages list first (rnww-plugin-* ⭐ on top)
2. npm search to find new packages
3. [Select] → shown in selection area below
4. Version dropdown (latest, recent versions) or direct input
5. Namespace input
6. [Install & Add] → npm install → update plugins.json

### [+ Add] Modal (Manual Plugin)

```
┌─────────────────────────────────────────────────────────┐
│  Add Manual Plugin                                  [X] │
├─────────────────────────────────────────────────────────┤
│  lib/bridges/ folder scan results:                      │
│                                                         │
│  ☐ ./new-feature      (not registered)                  │
│  ☐ ./experimental     (not registered)                  │
│                                                         │
│  (Already registered plugins not shown)                 │
├─────────────────────────────────────────────────────────┤
│  Selected: ./new-feature                                │
│  Namespace: [newfeat         ]                          │
├─────────────────────────────────────────────────────────┤
│                    [Cancel]  [Add]                      │
└─────────────────────────────────────────────────────────┘
```

**Flow:**
1. Scan `lib/bridges/` folder → show folders not in plugins.json
2. Select → input namespace
3. [Add] → add to plugins.json (active state)

---

## Plugin Registry Auto-Generation

### Problem

Current system requires manual sync between two files:
- `constants/plugins.json` - Plugin list
- `lib/bridges/plugin-registry.ts` - Import statements

### Solution

Auto-generate `plugin-registry.ts` from `plugins.json`:

```
plugins.json  ──(script)──▶  plugin-registry.ts (auto-generated)
     ▲
     │
 GUI edits
```

### Script: `scripts/generate-plugin-registry.js`

```javascript
// Input: plugins.json
{
  "plugins": {
    "auto": [{ "name": "rnww-plugin-camera", "namespace": "cam" }],
    "manual": [{ "path": "./clipboard", "namespace": "clip" }]
  }
}

// Output: plugin-registry.ts
export const AUTO_PLUGINS = {
  'rnww-plugin-camera': () => import('rnww-plugin-camera'),
};
export const MANUAL_PLUGINS = {
  './clipboard': () => import('./clipboard'),
};
```

### Execution Points

1. `npm run config` (GUI) → auto-run on save
2. `npm install` → postinstall hook
3. `npx expo prebuild` → prebuild hook

---

## Internationalization (i18n)

### Structure

```
tools/config-editor/client/src/i18n/
├── index.ts      # i18next configuration
├── ko.json       # Korean
└── en.json       # English
```

### Translation Keys

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
      "baseUrlDesc": "Website URL to load in app"
    }
  },
  "plugins": {
    "auto": "Auto Plugins (npm)",
    "manual": "Manual Plugins (local)",
    "installed": "Installed",
    "notInstalled": "Not installed",
    "add": "Add",
    "install": "Install"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "reset": "Reset to defaults"
  }
}
```

### Language Switching

- `[KO ▼]` dropdown at top right
- Auto-detect browser language (default)
- Selection saved to localStorage

---

## Dependencies

### Server (tools/config-editor/server/)

| Package | Purpose |
|---------|---------|
| express | HTTP server, API |
| get-port | Auto-find free port |
| open | Auto-open browser |
| chokidar | File change detection (optional) |

### Client (tools/config-editor/client/)

| Package | Purpose |
|---------|---------|
| react + react-dom | UI |
| vite | Build/dev server |
| react-i18next | i18n |
| tailwindcss | Styling |
| react-colorful | Color picker (lightweight) |

### Root package.json Scripts

```json
{
  "scripts": {
    "config": "node tools/config-editor/server/index.js",
    "generate:plugins": "node scripts/generate-plugin-registry.js"
  }
}
```

---

## Future Extensions

- **Build Tab**: EAS build trigger, build status monitoring
- **Preview**: Real-time app configuration preview
- **Export/Import**: Configuration backup and restore
