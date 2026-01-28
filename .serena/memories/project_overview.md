# Project Overview

## Purpose
React Native + Expo template for wrapping web applications as native mobile apps. Provides bidirectional Web-to-App communication via a bridge system.

## Tech Stack
- **Framework**: React Native 0.81.5 with Expo SDK 54
- **Language**: TypeScript 5.9.2
- **React**: 19.1.0
- **State Management**: Zustand 5.0.9
- **WebView**: react-native-webview 13.16.0
- **Navigation**: expo-router 6.0.19

## Key Architecture
- Bridge System for Web <-> App bidirectional communication
- `app://actionName` protocol for Web -> App
- `native://actionName` protocol for App -> Web
- Security token validation for messages

## Code Style
- Comments are written in Korean
- TypeScript with strict typing
- Path aliases: `@/` maps to project root

## Key Directories
- `lib/` - Core bridge system
- `lib/bridges/` - Handler implementations by feature
- `components/` - React components
- `stores/` - Zustand stores
- `constants/` - App configuration
- `app/` - Expo Router pages
