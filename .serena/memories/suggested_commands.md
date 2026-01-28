# Suggested Commands

## Development
```bash
npx expo start              # Start dev server
npx expo run:android        # Run on Android
npx expo run:ios            # Run on iOS
```

## Linting
```bash
npm run lint                # Run ESLint
```

## Build (Windows)
```bash
.\build.bat                 # Interactive build script
```

## Build (Manual)
```bash
npx expo prebuild --clean
cd android && .\gradlew assembleRelease
```

## EAS Cloud Build
```bash
npx eas build --platform android --profile preview
```

## Package Management
```bash
npm install                 # Install deps (runs postinstall plugin setup)
npm install --legacy-peer-deps  # If peer dep conflicts occur
```

## Testing (to be added)
```bash
npm test                    # Run Jest tests
npm test -- --coverage      # Run with coverage
npm test -- --watch         # Watch mode
```

## Windows-specific
- Use `.\` prefix for batch scripts
- Use PowerShell or Git Bash for better compatibility
