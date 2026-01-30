# React Native + EXPO + WebApp Wrapper Template

A template for wrapping web applications as native mobile apps using React Native and Expo.

> **Note:** Code comments in this project are written in Korean.


## 📖 Documentation

Select your language:

| Language | Link |
|----------|------|
| 🇺🇸 English | [docs/en.md](docs/en.md) |
| 🇰🇷 한국어 | [docs/ko.md](docs/ko.md) |
| 🇨🇳 简体中文 | [docs/zh.md](docs/zh.md) |
| 🇯🇵 日本語 | [docs/ja.md](docs/ja.md) |


---


## ✨ Features

- 📱 **WebView Wrapper** - Wrap any web application as a native app
- 🌉 **Bridge System** - Bidirectional communication between Web ↔ App
- 📱 **Cross Platform** - Android & iOS support
- 🎨 **Custom Splash Screen** - Configurable splash screen
- 📡 **Offline Support** - Custom offline screen
- 🛠️ **Built-in Handlers** - Toast, vibration, clipboard, and more
- 📷 **Camera Integration** - Camera streaming & photo capture (Android only)
- ⚙️ **Web Config Editor** - Configure everything via web UI (`npm run config`)


---


## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/foryourbizs/RN-Expo-WebApp-Wrapper-Template.git
cd RN-Expo-WebApp-Wrapper-Template
npm install
```

### 2. Configure

**Option A: Web UI (Recommended)**
```bash
npm run config
```
Opens a web-based configuration editor where you can set up all app settings, plugins, themes, and build options.

**Option B: Manual Edit**

Edit `constants/app.json`:

```json
{
  "webview": {
    "baseUrl": "https://your-webapp-url.com"
  }
}
```

### 3. Run

```bash
# Development
npx expo start

# Android
npx expo run:android

# iOS
npx expo run:ios
```


---


## Build

### Web UI (Recommended)
```bash
npm run config
```
Navigate to the **Build** tab to:
- Check build environment (SDK, Java, licenses)
- Generate release keystore
- Run local or cloud builds

### Command Line

**Windows**
```bash
.\build.bat
```

**EAS Cloud Build**
```bash
npx eas build --platform android --profile preview
```


---



## Contributors

<a href="https://github.com/taxi-tabby">
  <img src="https://github.com/taxi-tabby.png" width="50" height="50" alt="taxi-tabby" style="border-radius: 50%;" />
</a>

<!-- Add contributors here -->
<!-- Example: -->
<!-- <a href="https://github.com/username"><img src="https://github.com/username.png" width="50" height="50" alt="username" /></a> -->


