@echo off
setlocal enabledelayedexpansion

:MENU
cls
echo ============================================
echo         RNWebWrapper Build Script
echo ============================================
echo.
echo   1. Cloud Build (EAS Cloud)
echo   2. Local Build (Gradle Direct)
echo   3. Clean Gradle Cache
echo   4. Verify Environment
echo   0. Exit
echo.
echo ============================================
echo   * EAS --local is not available on Windows
echo ============================================
set /p choice="Select (0-4): "

if "%choice%"=="1" goto CLOUD_BUILD
if "%choice%"=="2" goto LOCAL_BUILD
if "%choice%"=="3" goto CLEAN
if "%choice%"=="4" goto CHECK_ENV
if "%choice%"=="0" goto END
echo.
echo Invalid selection.
timeout /t 1 >nul
goto MENU

:CHECK_ENV
cls
echo ============================================
echo         Build Environment Verification
echo ============================================
echo.
call :VERIFY_ENVIRONMENT
echo.
pause
goto MENU

:VERIFY_ENVIRONMENT
set ENV_OK=1

:: Check Node.js
echo [1/7] Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [X] Node.js is not installed.
    echo       Install from https://nodejs.org
    set ENV_OK=0
) else (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
    echo   [O] Node.js: !NODE_VER!
)

:: Check npm
echo [2/7] Checking npm...
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [X] npm is not installed.
    set ENV_OK=0
) else (
    for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
    echo   [O] npm: !NPM_VER!
)

:: Check JAVA_HOME
echo [3/7] Checking JAVA_HOME...
if not defined JAVA_HOME (
    echo   [X] JAVA_HOME environment variable is not set.
    echo       Set JAVA_HOME after installing JDK.
    echo       Example: C:\Program Files\Java\jdk-17
    set ENV_OK=0
) else (
    if exist "%JAVA_HOME%\bin\java.exe" (
        echo   [O] JAVA_HOME: %JAVA_HOME%
    ) else (
        echo   [X] JAVA_HOME is incorrectly set: %JAVA_HOME%
        echo       Cannot find java.exe.
        set ENV_OK=0
    )
)

:: Check Java version
echo [4/7] Checking Java version...
where java >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [X] java command not found.
    echo       Add JAVA_HOME\bin to PATH.
    set ENV_OK=0
) else (
    for /f "tokens=3" %%i in ('java -version 2^>^&1 ^| findstr /i "version"') do (
        set JAVA_VER=%%i
        set JAVA_VER=!JAVA_VER:"=!
    )
    :: Extract major version (17.0.9 -> 17, 21.0.1 -> 21, 25.0.2 -> 25)
    for /f "tokens=1 delims=." %%v in ("!JAVA_VER!") do set JAVA_MAJOR=%%v

    :: Version compatibility check (17-21 recommended, 22+ warning)
    if !JAVA_MAJOR! LSS 17 (
        echo   [X] Java: !JAVA_VER! - Version too low
        echo       JDK 17 or higher required.
        set ENV_OK=0
    ) else if !JAVA_MAJOR! GTR 21 (
        echo   [W] Java: !JAVA_VER! - Version too high
        echo       Gradle may not support JDK !JAVA_MAJOR!.
        echo       Recommended: JDK 17 or 21
        echo       Download: https://adoptium.net/temurin/releases/
    ) else (
        echo   [O] Java: !JAVA_VER!
    )
)

:: Check Android SDK
echo [5/7] Checking Android SDK...
set ANDROID_SDK_PATH=

:: Priority 1: Environment variables
if defined ANDROID_HOME set ANDROID_SDK_PATH=!ANDROID_HOME!
if not defined ANDROID_SDK_PATH if defined ANDROID_SDK_ROOT set ANDROID_SDK_PATH=!ANDROID_SDK_ROOT!

:: Priority 2: Read from local.properties
if not defined ANDROID_SDK_PATH if exist "android\local.properties" (
    for /f "tokens=2 delims==" %%i in ('findstr /c:"sdk.dir" "android\local.properties" 2^>nul') do (
        set SDK_DIR_RAW=%%i
        set ANDROID_SDK_PATH=!SDK_DIR_RAW:\:=:!
        set ANDROID_SDK_PATH=!ANDROID_SDK_PATH:\\=\!
    )
)

:: Priority 3: Infer from sdkmanager location
if not defined ANDROID_SDK_PATH (
    where sdkmanager >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        for /f "tokens=*" %%i in ('where sdkmanager') do (
            set SDKMGR_PATH=%%~dpi
            :: Infer SDK root from cmdline-tools\bin\ or cmdline-tools\latest\bin\
            set ANDROID_SDK_PATH=!SDKMGR_PATH!
            if "!ANDROID_SDK_PATH:~-1!"=="\" set ANDROID_SDK_PATH=!ANDROID_SDK_PATH:~0,-1!
            :: Remove bin
            for %%a in ("!ANDROID_SDK_PATH!") do set ANDROID_SDK_PATH=%%~dpa
            if "!ANDROID_SDK_PATH:~-1!"=="\" set ANDROID_SDK_PATH=!ANDROID_SDK_PATH:~0,-1!
            :: Remove cmdline-tools or latest
            for %%a in ("!ANDROID_SDK_PATH!") do set PARENT_DIR=%%~nxa
            if /i "!PARENT_DIR!"=="latest" (
                for %%a in ("!ANDROID_SDK_PATH!") do set ANDROID_SDK_PATH=%%~dpa
                if "!ANDROID_SDK_PATH:~-1!"=="\" set ANDROID_SDK_PATH=!ANDROID_SDK_PATH:~0,-1!
                for %%a in ("!ANDROID_SDK_PATH!") do set ANDROID_SDK_PATH=%%~dpa
                if "!ANDROID_SDK_PATH:~-1!"=="\" set ANDROID_SDK_PATH=!ANDROID_SDK_PATH:~0,-1!
            ) else if /i "!PARENT_DIR!"=="cmdline-tools" (
                for %%a in ("!ANDROID_SDK_PATH!") do set ANDROID_SDK_PATH=%%~dpa
                if "!ANDROID_SDK_PATH:~-1!"=="\" set ANDROID_SDK_PATH=!ANDROID_SDK_PATH:~0,-1!
            )
        )
    )
)

:: Priority 4: Search common install paths
if not defined ANDROID_SDK_PATH (
    if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools" set ANDROID_SDK_PATH=%LOCALAPPDATA%\Android\Sdk
    if not defined ANDROID_SDK_PATH if exist "C:\Android\Sdk\platform-tools" set ANDROID_SDK_PATH=C:\Android\Sdk
    if not defined ANDROID_SDK_PATH if exist "%USERPROFILE%\Android\Sdk\platform-tools" set ANDROID_SDK_PATH=%USERPROFILE%\Android\Sdk
)

:: Validate
if not defined ANDROID_SDK_PATH (
    echo   [X] Cannot find Android SDK.
    echo       Do one of the following:
    echo       1. Set ANDROID_HOME environment variable
    echo       2. Add sdkmanager to PATH
    echo       3. Install SDK to default path: C:\Android\Sdk
    set ENV_OK=0
) else (
    :: Check required components
    set SDK_VALID=1
    if not exist "!ANDROID_SDK_PATH!\platform-tools" (
        echo   [W] platform-tools missing - Install: sdkmanager "platform-tools"
        set SDK_VALID=0
    )

    :: Check platforms folder (OK if at least one exists)
    set HAS_PLATFORM=0
    if exist "!ANDROID_SDK_PATH!\platforms\android-*" set HAS_PLATFORM=1
    for /d %%d in ("!ANDROID_SDK_PATH!\platforms\android-*") do set HAS_PLATFORM=1
    if "!HAS_PLATFORM!"=="0" (
        echo   [W] platforms missing - Install: sdkmanager "platforms;android-34"
        set SDK_VALID=0
    )

    :: Check build-tools
    set HAS_BUILDTOOLS=0
    for /d %%d in ("!ANDROID_SDK_PATH!\build-tools\*") do set HAS_BUILDTOOLS=1
    if "!HAS_BUILDTOOLS!"=="0" (
        echo   [W] build-tools missing - Install: sdkmanager "build-tools;34.0.0"
        set SDK_VALID=0
    )

    if "!SDK_VALID!"=="1" (
        echo   [O] Android SDK: !ANDROID_SDK_PATH!
    ) else (
        echo   [X] Android SDK path: !ANDROID_SDK_PATH!
        echo       Install the missing components above.
        set ENV_OK=0
    )
)

:: Check local.properties
echo [6/7] Checking local.properties...
if exist "android\local.properties" (
    findstr /c:"sdk.dir" "android\local.properties" >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        for /f "tokens=2 delims==" %%i in ('findstr /c:"sdk.dir" "android\local.properties"') do (
            set SDK_DIR=%%i
            set SDK_DIR=!SDK_DIR:\:=:!
            set SDK_DIR=!SDK_DIR:\\=\!
        )
        echo   [O] local.properties: sdk.dir is set
    ) else (
        echo   [W] sdk.dir not found in local.properties.
        echo       May be auto-generated during prebuild.
    )
) else (
    echo   [-] android/local.properties not found - Created during prebuild
)

:: Check Release Keystore (optional)
echo [7/7] Checking Release Keystore...
set KEYSTORE_FOUND=0
if exist "android\app\release.keystore" set KEYSTORE_FOUND=1
if exist "android\app\my-release-key.keystore" set KEYSTORE_FOUND=1
if exist "android\keystores\release.keystore" set KEYSTORE_FOUND=1

if "!KEYSTORE_FOUND!"=="1" (
    echo   [O] Release Keystore found
) else (
    echo   [-] Release Keystore not found - Debug build only
    echo       Keystore required for release builds.
    echo       Create: keytool -genkey -v -keystore release.keystore -alias my-key -keyalg RSA -keysize 2048 -validity 10000
)

:: Check ADB connection (optional)
echo.
echo [Extra] Checking ADB devices...
where adb >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [-] adb command not found.
    echo       Add ANDROID_SDK/platform-tools to PATH.
) else (
    for /f "tokens=*" %%i in ('adb devices 2^>^&1 ^| findstr /v "List" ^| findstr /v "^$"') do (
        set ADB_DEVICE=%%i
    )
    if defined ADB_DEVICE (
        echo   [O] Connected device: !ADB_DEVICE!
    ) else (
        echo   [-] No Android device connected
    )
)

echo.
echo ============================================
if "!ENV_OK!"=="0" (
    echo [Result] Required environment setup incomplete.
    echo          Check [X] items above.
    echo ============================================
    exit /b 1
) else (
    echo [Result] Build environment is ready.
    echo.
    echo  Legend:
    echo   [O] = OK
    echo   [X] = Required - Build not possible
    echo   [W] = Warning - Build possible but check needed
    echo   [-] = Optional - Not required
    echo ============================================
    exit /b 0
)

:CLOUD_BUILD
cls
echo ============================================
echo         Cloud Build Profile Selection
echo ============================================
echo.
echo   1. development (Dev build)
echo   2. preview (Test APK)
echo   3. production (Release AAB)
echo   0. Back
echo.
set /p profile="Select (0-3): "

if "%profile%"=="1" set BUILD_PROFILE=development
if "%profile%"=="2" set BUILD_PROFILE=preview
if "%profile%"=="3" set BUILD_PROFILE=production
if "%profile%"=="0" goto MENU

if not defined BUILD_PROFILE (
    echo Invalid selection.
    timeout /t 1 >nul
    goto CLOUD_BUILD
)

echo.
echo Starting cloud build: %BUILD_PROFILE%
echo ============================================
call npx eas build --platform android --profile %BUILD_PROFILE%
if %ERRORLEVEL% neq 0 (
    echo.
    echo ============================================
    echo [FAILED] EAS build failed. Error code: %ERRORLEVEL%
    echo ============================================
) else (
    echo.
    echo ============================================
    echo [SUCCESS] EAS build completed.
    echo           Check EAS dashboard for results.
    echo ============================================
)
pause
goto MENU

:LOCAL_BUILD
cls
echo ============================================
echo         Local Build (Gradle Direct)
echo ============================================
echo.

:: Verify environment first
echo Verifying build environment...
echo.
call :VERIFY_ENVIRONMENT
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Please complete environment setup first.
    pause
    goto MENU
)

echo.
echo   1. Debug APK (Dev/Test)
echo   2. Release APK (Distribution)
echo   3. Release AAB (Play Store)
echo   0. Back
echo.
set /p profile="Select (0-3): "

if "%profile%"=="1" goto BUILD_DEBUG
if "%profile%"=="2" goto BUILD_RELEASE_APK
if "%profile%"=="3" goto BUILD_RELEASE_AAB
if "%profile%"=="0" goto MENU
echo Invalid selection.
timeout /t 1 >nul
goto LOCAL_BUILD

:BUILD_DEBUG
set OUTPUT_PATH=android\app\build\outputs\apk\debug\app-debug.apk
set BUILD_TYPE=Debug APK
set GRADLE_TASK=assembleDebug
set NEED_KEYSTORE=0
goto DO_BUILD

:BUILD_RELEASE_APK
set OUTPUT_PATH=android\app\build\outputs\apk\release\app-release.apk
set BUILD_TYPE=Release APK
set GRADLE_TASK=assembleRelease
set NEED_KEYSTORE=1
goto DO_BUILD

:BUILD_RELEASE_AAB
set OUTPUT_PATH=android\app\build\outputs\bundle\release\app-release.aab
set BUILD_TYPE=Release AAB
set GRADLE_TASK=bundleRelease
set NEED_KEYSTORE=1
goto DO_BUILD

:DO_BUILD
echo.
echo Starting %BUILD_TYPE% build...
echo ============================================

:: Release build keystore validation
if "%NEED_KEYSTORE%"=="1" (
    echo.
    echo [Pre-check] Checking Release Keystore...

    set KEYSTORE_PATH=
    if exist "android\app\release.keystore" set KEYSTORE_PATH=android\app\release.keystore
    if exist "android\app\my-release-key.keystore" set KEYSTORE_PATH=android\app\my-release-key.keystore
    if exist "android\keystores\release.keystore" set KEYSTORE_PATH=android\keystores\release.keystore

    if not defined KEYSTORE_PATH (
        echo.
        echo ============================================
        echo  Release Keystore not found.
        echo ============================================
        echo.
        echo   Y = Auto-generate
        echo   N = Manual creation instructions
        echo   C = Cancel, back to menu
        echo.
:ASK_CREATE_KEYSTORE
        set /p CREATE_KEYSTORE="Select [Y/n/c, default=Y]: "
        if "!CREATE_KEYSTORE!"=="" set CREATE_KEYSTORE=Y
        if /i "!CREATE_KEYSTORE!"=="Y" (
            call :CREATE_KEYSTORE_INTERACTIVE
            if !ERRORLEVEL! neq 0 (
                echo [ERROR] Keystore creation failed.
                pause
                goto MENU
            )
            set KEYSTORE_PATH=android\app\release.keystore
        ) else if /i "!CREATE_KEYSTORE!"=="N" (
            echo.
            echo Manual creation:
            echo   keytool -genkey -v -keystore android\app\release.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
            pause
            goto MENU
        ) else if /i "!CREATE_KEYSTORE!"=="C" (
            goto MENU
        ) else (
            echo Invalid input. Choose Y, N, or C.
            goto ASK_CREATE_KEYSTORE
        )
    )
    echo   [O] Keystore: !KEYSTORE_PATH!

    :: Check signing config in gradle.properties
    if exist "android\gradle.properties" (
        findstr /c:"MYAPP_RELEASE_STORE_PASSWORD" "android\gradle.properties" >nul 2>&1
        if !ERRORLEVEL! neq 0 (
            echo   [W] Signing config may be missing in gradle.properties.
            echo       Check MYAPP_RELEASE_* settings if build fails.
        ) else (
            echo   [O] gradle.properties signing config found
        )
    )
)

:: Step 1: Plugin setup
echo.
echo [1/3] Setting up plugins...
call node scripts\setup-plugins.js
if %ERRORLEVEL% neq 0 (
    echo [FAILED] Plugin setup failed.
    pause
    goto MENU
)
echo [DONE] Plugin setup

:: Step 2: Expo prebuild
echo.
echo [2/3] Running Expo prebuild...
call npx expo prebuild --platform android
if %ERRORLEVEL% neq 0 (
    echo [FAILED] Expo prebuild failed.
    pause
    goto MENU
)
echo [DONE] Expo prebuild

:: Step 2.5: Check/create local.properties
if not exist "android\local.properties" (
    echo.
    echo [Extra] Creating local.properties...
    if defined ANDROID_SDK_PATH (
        set SDK_PATH_ESCAPED=!ANDROID_SDK_PATH:\=\\!
        echo sdk.dir=!SDK_PATH_ESCAPED!> "android\local.properties"
        echo [DONE] local.properties created: !ANDROID_SDK_PATH!
    ) else (
        echo [WARNING] Cannot find ANDROID_SDK_PATH.
        echo           Create android/local.properties manually.
    )
) else (
    :: local.properties exists but check if sdk.dir is present
    findstr /c:"sdk.dir" "android\local.properties" >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo.
        echo [Extra] Adding sdk.dir to local.properties...
        if defined ANDROID_SDK_PATH (
            set SDK_PATH_ESCAPED=!ANDROID_SDK_PATH:\=\\!
            echo sdk.dir=!SDK_PATH_ESCAPED!>> "android\local.properties"
            echo [DONE] sdk.dir added
        )
    )
)

:: Step 3: Gradle build
echo.
echo [3/3] Running Gradle build... (%GRADLE_TASK%)
cd android
call .\gradlew %GRADLE_TASK%
set GRADLE_RESULT=%ERRORLEVEL%
cd ..

if %GRADLE_RESULT% neq 0 (
    echo.
    echo ============================================
    echo [FAILED] Gradle build failed. Error code: %GRADLE_RESULT%
    echo ============================================
    echo.
    echo Check the following:
    echo  - JAVA_HOME is set correctly
    echo  - JDK version is 17 or higher
    echo  - android/local.properties file
    echo  - Try gradlew clean and rebuild
    pause
    goto MENU
)

:: Check output
echo.
echo ============================================
if exist "%OUTPUT_PATH%" (
    echo [SUCCESS] %BUILD_TYPE% build complete!
    echo.
    echo  Output: %OUTPUT_PATH%

    :: Get file size
    for %%A in ("%OUTPUT_PATH%") do (
        set FILE_SIZE=%%~zA
        set FILE_DATE=%%~tA
    )

    :: Convert bytes to MB
    set /a FILE_SIZE_MB=!FILE_SIZE! / 1048576
    set /a FILE_SIZE_KB=(!FILE_SIZE! %% 1048576^) / 1024

    echo  File size: !FILE_SIZE_MB!.!FILE_SIZE_KB! MB [!FILE_SIZE! bytes]
    echo  Created: !FILE_DATE!
    echo.
    echo ============================================

    :: Option to open output folder
    echo.
    set /p open_folder="Open output folder? [y/N]: "
    if /i "!open_folder!"=="y" (
        for %%F in ("%OUTPUT_PATH%") do explorer "%%~dpF"
    )
) else (
    echo [FAILED] Build output not found.
    echo.
    echo  Expected path: %OUTPUT_PATH%
    echo.
    echo  Check build logs.
    echo ============================================
)
pause
goto MENU

:CLEAN
cls
echo ============================================
echo         Clean Gradle Cache
echo ============================================
echo.

:: Check android folder
if not exist "android" (
    echo [ERROR] android folder not found.
    echo         Run 'npx expo prebuild' first.
    pause
    goto MENU
)

echo Deleting CMake cache...
if exist "android\app\.cxx" (
    rmdir /s /q "android\app\.cxx"
    echo  - android\app\.cxx deleted
) else (
    echo  - android\app\.cxx not found, skipped
)

if exist "android\app\build" (
    rmdir /s /q "android\app\build"
    echo  - android\app\build deleted
) else (
    echo  - android\app\build not found, skipped
)

echo.
echo Stopping Gradle daemon...
cd android
call .\gradlew --stop
if %ERRORLEVEL% neq 0 (
    echo  [WARNING] Failed to stop Gradle daemon, can be ignored
)

echo.
echo Cleaning Gradle cache...
call .\gradlew clean
if %ERRORLEVEL% neq 0 (
    echo  [WARNING] Gradle clean failed
)
cd ..

echo.
echo ============================================
echo [DONE] Cleanup complete.
echo ============================================
pause
goto MENU

:CREATE_KEYSTORE_INTERACTIVE
echo.
echo ============================================
echo         Keystore Auto-Generation
echo ============================================
echo.
echo  * Values will be saved to android/gradle.properties.
echo  * Password must be at least 6 characters.
echo  * Press Enter for default values.
echo.

:: Default values
set KS_ALIAS=my-key-alias
set KS_VALIDITY=10000

:: Password input
echo [1/5] Keystore Password
set /p KS_STORE_PASS="      Password (default: android): "
if "!KS_STORE_PASS!"=="" set KS_STORE_PASS=android
if "!KS_STORE_PASS:~5,1!"=="" (
    echo       [ERROR] Password must be at least 6 characters.
    exit /b 1
)

echo [2/5] Key Password
set /p KS_KEY_PASS="      Password (default: same as keystore): "
if "!KS_KEY_PASS!"=="" set KS_KEY_PASS=!KS_STORE_PASS!

echo [3/5] Key Alias
set /p KS_ALIAS_INPUT="      Alias (default: my-key-alias): "
if not "!KS_ALIAS_INPUT!"=="" set KS_ALIAS=!KS_ALIAS_INPUT!

echo [4/5] Certificate Info (optional, press Enter to skip)
set /p KS_CN="      Name (CN): "
set /p KS_OU="      Org Unit (OU): "
set /p KS_O="      Organization (O): "
set /p KS_L="      City (L): "
set /p KS_ST="      State (ST): "
set /p KS_C="      Country Code (C, e.g. US): "

:: Build DNAME
set KS_DNAME=CN=Unknown, OU=Unknown, O=Unknown, L=Unknown, ST=Unknown, C=US
if not "!KS_CN!"=="" set KS_DNAME=CN=!KS_CN!
if "!KS_CN!"=="" set KS_DNAME=CN=Unknown
if not "!KS_OU!"=="" set KS_DNAME=!KS_DNAME!, OU=!KS_OU!
if "!KS_OU!"=="" set KS_DNAME=!KS_DNAME!, OU=Unknown
if not "!KS_O!"=="" set KS_DNAME=!KS_DNAME!, O=!KS_O!
if "!KS_O!"=="" set KS_DNAME=!KS_DNAME!, O=Unknown
if not "!KS_L!"=="" set KS_DNAME=!KS_DNAME!, L=!KS_L!
if "!KS_L!"=="" set KS_DNAME=!KS_DNAME!, L=Unknown
if not "!KS_ST!"=="" set KS_DNAME=!KS_DNAME!, ST=!KS_ST!
if "!KS_ST!"=="" set KS_DNAME=!KS_DNAME!, ST=Unknown
if not "!KS_C!"=="" set KS_DNAME=!KS_DNAME!, C=!KS_C!
if "!KS_C!"=="" set KS_DNAME=!KS_DNAME!, C=US

echo.
echo [5/5] Confirm
echo      Path: android\app\release.keystore
echo      Alias: !KS_ALIAS!
echo      Validity: !KS_VALIDITY! days (~27 years)
echo      DNAME: !KS_DNAME!
echo.
:ASK_CONFIRM_CREATE
set /p CONFIRM_CREATE="      Proceed? (Y/n, default=Y): "
if "!CONFIRM_CREATE!"=="" set CONFIRM_CREATE=Y
if /i "!CONFIRM_CREATE!"=="Y" goto DO_CREATE_KEYSTORE
if /i "!CONFIRM_CREATE!"=="N" (
    echo      Creation cancelled.
    exit /b 1
)
echo      Enter Y or N.
goto ASK_CONFIRM_CREATE
:DO_CREATE_KEYSTORE

:: Check android\app folder
if not exist "android\app" (
    echo.
    echo [ERROR] android\app folder not found.
    echo        Run 'npx expo prebuild' first.
    exit /b 1
)

:: Run keytool
echo.
echo Creating keystore...
keytool -genkey -v -keystore "android\app\release.keystore" -alias "!KS_ALIAS!" -keyalg RSA -keysize 2048 -validity !KS_VALIDITY! -storepass "!KS_STORE_PASS!" -keypass "!KS_KEY_PASS!" -dname "!KS_DNAME!"

if !ERRORLEVEL! neq 0 (
    echo.
    echo [ERROR] keytool execution failed
    echo        Check if JAVA_HOME/bin is in PATH.
    exit /b 1
)

echo.
echo [O] Keystore created: android\app\release.keystore

:: Update gradle.properties
echo.
echo Updating gradle.properties...

:: Remove existing settings and add new ones
if exist "android\gradle.properties" (
    :: Backup existing and remove MYAPP_RELEASE settings
    findstr /v "MYAPP_RELEASE_" "android\gradle.properties" > "android\gradle.properties.tmp"
    move /y "android\gradle.properties.tmp" "android\gradle.properties" >nul
)

:: Add settings
echo.>> "android\gradle.properties"
echo # Release Keystore settings (auto-generated)>> "android\gradle.properties"
echo MYAPP_RELEASE_STORE_FILE=release.keystore>> "android\gradle.properties"
echo MYAPP_RELEASE_KEY_ALIAS=!KS_ALIAS!>> "android\gradle.properties"
echo MYAPP_RELEASE_STORE_PASSWORD=!KS_STORE_PASS!>> "android\gradle.properties"
echo MYAPP_RELEASE_KEY_PASSWORD=!KS_KEY_PASS!>> "android\gradle.properties"

echo [O] gradle.properties updated

:: build.gradle instructions
echo.
echo ============================================
echo [IMPORTANT] Check android/app/build.gradle
echo ============================================
echo.
echo  signingConfigs should have this configuration:
echo.
echo  signingConfigs {
echo      release {
echo          storeFile file(MYAPP_RELEASE_STORE_FILE)
echo          storePassword MYAPP_RELEASE_STORE_PASSWORD
echo          keyAlias MYAPP_RELEASE_KEY_ALIAS
echo          keyPassword MYAPP_RELEASE_KEY_PASSWORD
echo      }
echo  }
echo.
echo  buildTypes {
echo      release {
echo          signingConfig signingConfigs.release
echo          ...
echo      }
echo  }
echo.
echo ============================================
pause
exit /b 0

:END
echo.
echo Exiting.
exit /b 0
