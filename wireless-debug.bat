@echo off
setlocal enabledelayedexpansion

:MENU
cls
echo ============================================
echo         ADB Wireless Debugging
echo ============================================
echo.
echo   1. Check device connection status
echo   2. Wireless debugging pairing (first time)
echo   3. Connect wireless debugging
echo   4. Disconnect wireless debugging
echo   5. Enable wireless debugging via USB
echo   6. View device logs
echo   0. Exit
echo.
echo ============================================
echo  * Android 11+ : Settings - Developer Options - Wireless Debugging
echo ============================================
set /p choice="Select [0-6]: "

if "%choice%"=="1" goto STATUS
if "%choice%"=="2" goto PAIR
if "%choice%"=="3" goto CONNECT
if "%choice%"=="4" goto DISCONNECT
if "%choice%"=="5" goto USB_WIRELESS
if "%choice%"=="6" goto LOGCAT
if "%choice%"=="0" goto END
echo Invalid selection.
timeout /t 1 >nul
goto MENU

:STATUS
cls
echo ============================================
echo         Connected Devices
echo ============================================
echo.
adb devices -l
echo.
echo ============================================
pause
goto MENU

:PAIR
cls
echo ============================================
echo         Wireless Debugging Pairing
echo ============================================
echo.
echo  [Prepare] On your Android device:
echo   1. Settings - Developer Options - Wireless Debugging ON
echo   2. Tap "Pair device with pairing code"
echo   3. Check the IP:Port and pairing code
echo.
echo ============================================
echo.
set /p PAIR_ADDR="Pairing IP:Port (e.g. 192.168.0.10:37123): "
if "!PAIR_ADDR!"=="" (
    echo Cancelled.
    pause
    goto MENU
)

echo.
echo Attempting to pair: !PAIR_ADDR!
echo.
adb pair !PAIR_ADDR!
echo.
if %ERRORLEVEL% equ 0 (
    echo ============================================
    echo [SUCCESS] Pairing complete!
    echo           Now select "Connect wireless debugging".
    echo ============================================
) else (
    echo ============================================
    echo [FAILED] Pairing failed.
    echo          Check IP/Port and pairing code.
    echo ============================================
)
pause
goto MENU

:CONNECT
cls
echo ============================================
echo         Wireless Debugging Connect
echo ============================================
echo.
echo  [Check] On your Android device:
echo   Settings - Developer Options - Wireless Debugging
echo   Check "IP address and port"
echo.
echo  * Pairing port and connection port are different!
echo.
echo ============================================
echo.

:: Show recent connections
echo Recently connected wireless devices:
for /f "tokens=1" %%i in ('adb devices ^| findstr /r ":[0-9]*.*device$"') do (
    echo   - %%i
)
echo.

set /p CONNECT_ADDR="IP:Port to connect (e.g. 192.168.0.10:43567): "
if "!CONNECT_ADDR!"=="" (
    echo Cancelled.
    pause
    goto MENU
)

echo.
echo Connecting to: !CONNECT_ADDR!
adb connect !CONNECT_ADDR!
echo.

:: Verify connection
timeout /t 2 >nul
adb devices | findstr "!CONNECT_ADDR!" | findstr "device" >nul
if %ERRORLEVEL% equ 0 (
    echo ============================================
    echo [SUCCESS] Wireless connection complete!
    echo.
    adb -s !CONNECT_ADDR! shell getprop ro.product.model
    echo ============================================
) else (
    echo ============================================
    echo [FAILED] Connection failed.
    echo.
    echo  Check:
    echo   - IP and port are correct
    echo   - Same WiFi network
    echo   - Pairing is complete
    echo   - Wireless debugging is ON
    echo ============================================
)
pause
goto MENU

:DISCONNECT
cls
echo ============================================
echo         Disconnect Wireless Debugging
echo ============================================
echo.
echo Currently connected wireless devices:
echo.
set DEVICE_COUNT=0
for /f "tokens=1" %%i in ('adb devices ^| findstr /r ":[0-9]*.*device$"') do (
    set /a DEVICE_COUNT+=1
    set DEVICE_!DEVICE_COUNT!=%%i
    echo   !DEVICE_COUNT!. %%i
)

if !DEVICE_COUNT! equ 0 (
    echo   No wireless devices connected.
    echo.
    pause
    goto MENU
)

echo.
echo   A. Disconnect all wireless connections
echo   0. Cancel
echo.
set /p DISC_CHOICE="Select: "

if /i "!DISC_CHOICE!"=="0" goto MENU
if /i "!DISC_CHOICE!"=="A" (
    echo.
    echo Disconnecting all wireless connections...
    adb disconnect
    echo [DONE] All wireless connections disconnected.
    pause
    goto MENU
)

:: Handle numeric selection
set /a DISC_NUM=!DISC_CHOICE! 2>nul
if !DISC_NUM! gtr 0 if !DISC_NUM! leq !DEVICE_COUNT! (
    set DISC_DEVICE=!DEVICE_%DISC_NUM%!
    echo.
    echo Disconnecting: !DISC_DEVICE!
    adb disconnect !DISC_DEVICE!
    echo [DONE] Disconnected.
) else (
    echo Invalid selection.
)
pause
goto MENU

:USB_WIRELESS
cls
echo ============================================
echo         Enable Wireless Debugging via USB
echo ============================================
echo.
echo  [Prepare]
echo   1. Connect device with USB cable
echo   2. Allow USB debugging
echo.
echo ============================================
echo.

:: Check USB connection
adb devices | findstr "device$" | findstr /v ":" >nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] No device connected via USB.
    echo         Connect USB cable and allow debugging.
    pause
    goto MENU
)

echo USB connected device:
for /f "tokens=1" %%i in ('adb devices ^| findstr "device$" ^| findstr /v ":"') do (
    set USB_DEVICE=%%i
    echo   - %%i
)
echo.

:: Get device IP address
echo Checking device IP address...
for /f "tokens=9" %%i in ('adb shell ip route ^| findstr "wlan"') do (
    set DEVICE_IP=%%i
)

if not defined DEVICE_IP (
    echo [ERROR] Cannot find device WiFi IP.
    echo         Make sure device is connected to WiFi.
    pause
    goto MENU
)

echo Device IP: !DEVICE_IP!
echo.

:: Enable tcpip mode
set /p TCP_PORT="Wireless debugging port [default=5555]: "
if "!TCP_PORT!"=="" set TCP_PORT=5555

echo.
echo Enabling TCP/IP mode (port: !TCP_PORT!)...
adb tcpip !TCP_PORT!

timeout /t 2 >nul

echo.
echo Attempting wireless connection...
adb connect !DEVICE_IP!:!TCP_PORT!

timeout /t 2 >nul

:: Verify connection
adb devices | findstr "!DEVICE_IP!:!TCP_PORT!" | findstr "device" >nul
if %ERRORLEVEL% equ 0 (
    echo.
    echo ============================================
    echo [SUCCESS] Wireless debugging enabled!
    echo.
    echo  Connection info: !DEVICE_IP!:!TCP_PORT!
    echo.
    echo  You can now disconnect the USB cable.
    echo  Next time connect with: adb connect !DEVICE_IP!:!TCP_PORT!
    echo ============================================
) else (
    echo.
    echo ============================================
    echo [FAILED] Wireless connection failed.
    echo          Check WiFi connection status.
    echo ============================================
)
pause
goto MENU

:LOGCAT
cls
echo ============================================
echo         Device Logs
echo ============================================
echo.

:: Check connected devices
set DEVICE_COUNT=0
set SELECTED_DEVICE=
for /f "skip=1 tokens=1,2" %%a in ('adb devices 2^>nul') do (
    if "%%b"=="device" (
        set /a DEVICE_COUNT+=1
        set DEVICE_!DEVICE_COUNT!=%%a
    )
)

if !DEVICE_COUNT! equ 0 (
    echo [ERROR] No connected devices found.
    echo.
    pause
    goto MENU
)

:: If only one device, auto-select
if !DEVICE_COUNT! equ 1 (
    set SELECTED_DEVICE=!DEVICE_1!
    echo Connected device: !SELECTED_DEVICE!
    goto LOGCAT_MENU
)

:: Multiple devices - show selection menu
echo Multiple devices found. Select one:
echo.
for /L %%i in (1,1,!DEVICE_COUNT!) do (
    echo   %%i. !DEVICE_%%i!
)
echo.
set /p DEV_CHOICE="Select device [1-!DEVICE_COUNT!]: "

:: Validate selection
set /a DEV_NUM=!DEV_CHOICE! 2>nul
if !DEV_NUM! lss 1 (
    echo Invalid selection.
    timeout /t 1 >nul
    goto LOGCAT
)
if !DEV_NUM! gtr !DEVICE_COUNT! (
    echo Invalid selection.
    timeout /t 1 >nul
    goto LOGCAT
)

set SELECTED_DEVICE=!DEVICE_%DEV_NUM%!
echo.
echo Selected: !SELECTED_DEVICE!

:LOGCAT_MENU
echo.
echo ============================================
echo   1. Native logs (React Native)
echo   2. WebView console logs (JavaScript)
echo   3. All logs
echo   0. Back to menu
echo.
echo ============================================
echo  * Press Ctrl+C to stop viewing logs
echo ============================================
echo.
set /p LOG_CHOICE="Select [0-3]: "

if "!LOG_CHOICE!"=="0" goto MENU
if "!LOG_CHOICE!"=="1" goto LOG_NATIVE
if "!LOG_CHOICE!"=="2" goto LOG_WEBVIEW
if "!LOG_CHOICE!"=="3" goto LOG_ALL
echo Invalid selection.
timeout /t 1 >nul
goto LOGCAT_MENU

:LOG_NATIVE
cls
echo ============================================
echo  [Native Logs] React Native / Expo
echo  Device: !SELECTED_DEVICE!
echo ============================================
echo.
set /p CLEAR_LOG="Clear log buffer? [Y/n]: "
if /i "!CLEAR_LOG!"=="n" goto LOG_NATIVE_START
adb -s !SELECTED_DEVICE! logcat -c
echo Log buffer cleared.
:LOG_NATIVE_START
echo.
echo Press Ctrl+C to stop
echo ============================================
adb -s !SELECTED_DEVICE! logcat -v time ReactNative:V ReactNativeJS:V expo:V ExpoModulesCore:V *:S
pause
goto LOGCAT_MENU

:LOG_WEBVIEW
cls
echo ============================================
echo  [WebView Logs] JavaScript console.log
echo  Device: !SELECTED_DEVICE!
echo ============================================
echo.
set /p CLEAR_LOG="Clear log buffer? [Y/n]: "
if /i "!CLEAR_LOG!"=="n" goto LOG_WEBVIEW_START
adb -s !SELECTED_DEVICE! logcat -c
echo Log buffer cleared.
:LOG_WEBVIEW_START
echo.
echo Press Ctrl+C to stop
echo  Tags: chromium, SBrowser, WebView, Console
echo ============================================
adb -s !SELECTED_DEVICE! logcat -v time chromium:V SBrowser:V SBrowserConsole:V WebViewConsole:V cr_console:V *:S
pause
goto LOGCAT_MENU

:LOG_ALL
cls
echo ============================================
echo  [All Logs] Native + WebView
echo  Device: !SELECTED_DEVICE!
echo ============================================
echo.
set /p CLEAR_LOG="Clear log buffer? [Y/n]: "
if /i "!CLEAR_LOG!"=="n" goto LOG_ALL_START
adb -s !SELECTED_DEVICE! logcat -c
echo Log buffer cleared.
:LOG_ALL_START
echo.
echo Press Ctrl+C to stop
echo  [Native] ReactNative*, expo
echo  [WebView] chromium, SBrowser, WebView, Console
echo ============================================
adb -s !SELECTED_DEVICE! logcat -v time ReactNative:V ReactNativeJS:V expo:V chromium:V SBrowser:V SBrowserConsole:V WebViewConsole:V cr_console:V *:S
pause
goto LOGCAT_MENU

:END
echo.
echo Exiting.
exit /b 0
