# RNWW Config Editor

GUI tool for editing React Native Web Wrapper configuration files.

## Usage

From project root:

```bash
npm run config
```

Or from this directory:

```bash
npm run dev
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

- **Client**: React, Vite, Tailwind CSS, i18next, react-colorful
- **API**: Vite dev server middleware (no separate backend)
