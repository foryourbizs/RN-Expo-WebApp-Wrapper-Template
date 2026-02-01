// vite.config.ts
import { defineConfig } from "file:///E:/Projects/RN-Expo-WebApp-Wrapper-Template/tools/config-editor/client/node_modules/vite/dist/node/index.js";
import react from "file:///E:/Projects/RN-Expo-WebApp-Wrapper-Template/tools/config-editor/client/node_modules/@vitejs/plugin-react/dist/index.js";

// vite/api-plugin.ts
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { exec, spawn } from "child_process";
import { promisify } from "util";

// vite/puppeteer-preview.ts
import puppeteer from "file:///E:/Projects/RN-Expo-WebApp-Wrapper-Template/tools/config-editor/client/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js";
import { WebSocket, WebSocketServer } from "file:///E:/Projects/RN-Expo-WebApp-Wrapper-Template/tools/config-editor/client/node_modules/ws/wrapper.mjs";
function getAppBridgeScript() {
  return `
(function() {
  'use strict';

  // beforeunload \uBB34\uB825\uD654
  Object.defineProperty(window, 'onbeforeunload', {
    get: function() { return null; },
    set: function() { return; },
    configurable: false
  });

  var originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'beforeunload') return;
    return originalAddEventListener.call(this, type, listener, options);
  };

  if (window.AppBridge) return;

  var _t = (function(){
    var s = Symbol('_');
    var o = {};
    o[s] = 'puppeteer-preview-token';
    return function(){ return o[s]; };
  })();

  var pendingRequests = new Map();

  // Mock \uC751\uB2F5
  var mockResponses = {
    'getAppInfo': { appName: 'Preview App', version: '1.0.0', platform: 'preview', isApp: true },
    'getDeviceInfo': { platform: 'android', model: 'Preview Device', osVersion: '13', isPreview: true, isApp: true },
    'getSystemInfo': { platform: 'android', isApp: true, isPreview: true, version: '1.0.0' },
    'getPlatform': { platform: 'android', isApp: true },
    'checkPermission': { granted: true },
    'requestPermission': { granted: true },
    'getToken': { token: 'preview-mock-token' },
    'getUserInfo': { isLoggedIn: false },
    'getSettings': { theme: 'light' },
    'getSafeArea': { top: 24, bottom: 34, left: 0, right: 0 },
    'getStatusBarHeight': { height: 24 },
    'getNavigationBarHeight': { height: 48 },
    'getNetworkStatus': { connected: true, type: 'wifi' },
    'isOnline': { online: true, connected: true },
    '_default': { success: true, isPreview: true, isApp: true }
  };

  window.ReactNativeWebView = {
    postMessage: function(messageStr) {
      var parsed = JSON.parse(messageStr);
      console.log('[AppBridge Preview] postMessage:', parsed);

      if (parsed.requestId) {
        var action = parsed.protocol.replace('app://', '');
        var mockData = mockResponses[action] || mockResponses['_default'];

        setTimeout(function() {
          var response = {
            action: 'bridgeResponse',
            payload: {
              requestId: parsed.requestId,
              success: true,
              data: mockData
            }
          };
          window.dispatchEvent(new CustomEvent('nativeMessage', { detail: response }));
        }, 30);
      }
    }
  };

  window.AppBridge = {
    send: function(action, payload) {
      var message = {
        protocol: 'app://' + action,
        payload: payload || {},
        timestamp: Date.now(),
        __token: _t(),
        __nonce: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
      };
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    },

    call: function(action, payload, timeout) {
      timeout = timeout || 10000;
      return new Promise(function(resolve, reject) {
        var requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        var timer = setTimeout(function() {
          pendingRequests.delete(requestId);
          reject(new Error('Request timeout: ' + action));
        }, timeout);

        pendingRequests.set(requestId, { resolve: resolve, reject: reject, timer: timer });

        var message = {
          protocol: 'app://' + action,
          payload: payload || {},
          requestId: requestId,
          timestamp: Date.now(),
          __token: _t(),
          __nonce: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        };
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      });
    },

    on: function(action, callback) {
      if (!this._listeners) this._listeners = {};
      if (!this._listeners[action]) this._listeners[action] = [];
      this._listeners[action].push(callback);
    },

    once: function(action, callback) {
      var self = this;
      var wrapper = function(payload, message) {
        self.off(action, wrapper);
        callback(payload, message);
      };
      this.on(action, wrapper);
    },

    off: function(action, callback) {
      if (!this._listeners || !this._listeners[action]) return;
      if (callback) {
        this._listeners[action] = this._listeners[action].filter(function(cb) { return cb !== callback; });
      } else {
        delete this._listeners[action];
      }
    },

    waitFor: function(action, timeout) {
      var self = this;
      timeout = timeout || 10000;
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          self.off(action, handler);
          reject(new Error('Timeout waiting for: ' + action));
        }, timeout);
        var handler = function(payload, message) {
          clearTimeout(timer);
          self.off(action, handler);
          resolve({ payload: payload, message: message });
        };
        self.on(action, handler);
      });
    },

    _handleResponse: function(response) {
      var pending = pendingRequests.get(response.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(response.requestId);
        if (response.success) {
          pending.resolve(response.data);
        } else {
          pending.reject(new Error(response.error || 'Unknown error'));
        }
      }
    },

    _handleMessage: function(message) {
      if (message.action === 'bridgeResponse') {
        this._handleResponse(message.payload);
        return;
      }
      if (this._listeners) {
        if (this._listeners[message.action]) {
          this._listeners[message.action].forEach(function(cb) {
            try { cb(message.payload, message); } catch(e) { console.error(e); }
          });
        }
        if (this._listeners['*']) {
          this._listeners['*'].forEach(function(cb) {
            try { cb(message.payload, message); } catch(e) {}
          });
        }
      }
    },

    isApp: function() { return true; },
    isPreview: function() { return true; },
    version: '2.1.0'
  };

  window.addEventListener('nativeMessage', function(e) {
    window.AppBridge._handleMessage(e.detail);
  });

  window.onNativeMessage = function(message) {
    window.AppBridge._handleMessage(message);
  };

  window.dispatchEvent(new CustomEvent('AppBridgeReady'));
  console.log('[AppBridge] Initialized (Puppeteer Preview)');
})();
`;
}
var session = null;
var wss = null;
var pressedMouseButtons = /* @__PURE__ */ new Set();
var sessionCleanupTimer = null;
var SESSION_CLEANUP_DELAY = 3e4;
function scheduleSessionCleanup() {
  if (sessionCleanupTimer) {
    clearTimeout(sessionCleanupTimer);
  }
  sessionCleanupTimer = setTimeout(async () => {
    if (session && session.clients.size === 0) {
      console.log("[Puppeteer Preview] No clients connected, closing session");
      await stopPreview();
    }
  }, SESSION_CLEANUP_DELAY);
}
function cancelSessionCleanup() {
  if (sessionCleanupTimer) {
    clearTimeout(sessionCleanupTimer);
    sessionCleanupTimer = null;
  }
}
async function startPreview(url, width = 360, height = 640) {
  console.log("[Puppeteer Preview] Starting preview for:", url);
  if (session && session.url === url) {
    console.log("[Puppeteer Preview] Reusing existing session");
    if (session.viewportWidth !== width || session.viewportHeight !== height) {
      await resizePreview(width, height);
    }
    return;
  }
  let preservedClients = /* @__PURE__ */ new Set();
  if (session) {
    preservedClients = await stopPreview(true);
  }
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        `--window-size=${width},${height}`
      ]
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    );
    await page.setViewport({
      width,
      height,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    await page.evaluateOnNewDocument(getAppBridgeScript());
    const cdp = await page.createCDPSession();
    session = {
      browser,
      page,
      cdp,
      clients: preservedClients,
      // 보존된 클라이언트 연결
      url,
      viewportWidth: width,
      viewportHeight: height,
      isStreaming: false
    };
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 3e4 });
    console.log("[Puppeteer Preview] Page loaded successfully");
    await startScreencast();
  } catch (error) {
    console.error("[Puppeteer Preview] Failed to start:", error);
    if (session) {
      await stopPreview();
    }
    preservedClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "error", message: String(error) }));
      }
    });
    throw error;
  }
}
var screencastHandlerRegistered = false;
async function startScreencast() {
  if (!session) return;
  if (session.isStreaming) {
    console.log("[Puppeteer Preview] Screencast already running");
    return;
  }
  pressedMouseButtons.clear();
  session.isStreaming = true;
  if (!screencastHandlerRegistered) {
    screencastHandlerRegistered = true;
    let frameCount = 0;
    session.cdp.on("Page.screencastFrame", async (params) => {
      if (!session) return;
      const { data, sessionId } = params;
      frameCount++;
      try {
        await session.cdp.send("Page.screencastFrameAck", { sessionId });
      } catch (e) {
        return;
      }
      if (frameCount === 1) {
        console.log(`[Puppeteer Preview] First frame received, sending to ${session.clients.size} clients`);
      }
      const message = JSON.stringify({
        type: "frame",
        data: `data:image/jpeg;base64,${data}`
      });
      session.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    });
  }
  try {
    await session.cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 80,
      maxWidth: session.viewportWidth * 2,
      maxHeight: session.viewportHeight * 2,
      everyNthFrame: 1
    });
    console.log("[Puppeteer Preview] Screencast started");
  } catch (e) {
    console.error("[Puppeteer Preview] Failed to start screencast:", e);
    session.isStreaming = false;
  }
}
async function stopScreencast() {
  if (!session || !session.isStreaming) return;
  try {
    await session.cdp.send("Page.stopScreencast");
    session.isStreaming = false;
    console.log("[Puppeteer Preview] Screencast stopped");
  } catch (e) {
  }
}
async function stopPreview(preserveClients = false) {
  if (!session) return /* @__PURE__ */ new Set();
  console.log("[Puppeteer Preview] Stopping preview");
  cancelSessionCleanup();
  await stopScreencast();
  screencastHandlerRegistered = false;
  pressedMouseButtons.clear();
  const clients = session.clients;
  if (!preserveClients) {
    clients.forEach((client) => {
      client.close();
    });
  }
  try {
    await session.browser.close();
  } catch (e) {
  }
  session = null;
  return preserveClients ? clients : /* @__PURE__ */ new Set();
}
async function refreshPreview() {
  if (!session) return;
  console.log("[Puppeteer Preview] Refreshing page");
  await session.page.reload({ waitUntil: "domcontentloaded" });
}
async function navigatePreview(url) {
  if (!session) {
    await startPreview(url);
    return;
  }
  if (session.url === url) return;
  console.log("[Puppeteer Preview] Navigating to:", url);
  session.url = url;
  await session.page.goto(url, { waitUntil: "domcontentloaded", timeout: 3e4 });
}
async function resizePreview(width, height) {
  if (!session) return;
  session.viewportWidth = width;
  session.viewportHeight = height;
  await session.page.setViewport({
    width,
    height,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  await stopScreencast();
  await startScreencast();
}
async function handleMouseEvent(type, x, y, button = "left") {
  if (!session) return;
  try {
    switch (type) {
      case "click":
        if (pressedMouseButtons.has(button)) {
          try {
            await session.page.mouse.up({ button });
          } catch {
          }
          pressedMouseButtons.delete(button);
        }
        await session.page.mouse.click(x, y, { button });
        break;
      case "mousedown":
        if (pressedMouseButtons.has(button)) {
          try {
            await session.page.mouse.up({ button });
          } catch {
          }
          pressedMouseButtons.delete(button);
        }
        await session.page.mouse.move(x, y);
        await session.page.mouse.down({ button });
        pressedMouseButtons.add(button);
        break;
      case "mouseup":
        await session.page.mouse.move(x, y);
        if (pressedMouseButtons.has(button)) {
          await session.page.mouse.up({ button });
          pressedMouseButtons.delete(button);
        }
        break;
      case "mousemove":
        await session.page.mouse.move(x, y);
        break;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("is not pressed") || errorMsg.includes("is already pressed")) {
      pressedMouseButtons.clear();
    } else {
      throw error;
    }
  }
}
async function handleKeyEvent(type, key) {
  if (!session) return;
  const keyInput = key;
  switch (type) {
    case "keydown":
      await session.page.keyboard.down(keyInput);
      break;
    case "keyup":
      await session.page.keyboard.up(keyInput);
      break;
    case "keypress":
      await session.page.keyboard.press(keyInput);
      break;
  }
}
async function typeText(text) {
  if (!session) return;
  await session.page.keyboard.type(text);
}
async function handleScroll(deltaX, deltaY) {
  if (!session) return;
  await session.page.evaluate((dx, dy) => {
    window.scrollBy(dx, dy);
  }, deltaX, deltaY);
}
async function goBack() {
  if (!session) return false;
  try {
    await session.page.goBack({ waitUntil: "domcontentloaded", timeout: 1e4 });
    console.log("[Puppeteer Preview] Navigated back");
    return true;
  } catch (e) {
    console.log("[Puppeteer Preview] Cannot go back");
    return false;
  }
}
async function goForward() {
  if (!session) return false;
  try {
    await session.page.goForward({ waitUntil: "domcontentloaded", timeout: 1e4 });
    console.log("[Puppeteer Preview] Navigated forward");
    return true;
  } catch (e) {
    console.log("[Puppeteer Preview] Cannot go forward");
    return false;
  }
}
function setupWebSocketServer(server) {
  if (wss) return;
  wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const url = request.url || "";
    if (url === "/ws/preview") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });
  wss.on("connection", (ws) => {
    console.log("[Puppeteer Preview] WebSocket client connected");
    cancelSessionCleanup();
    if (session) {
      session.clients.add(ws);
    }
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        switch (message.type) {
          case "start":
            if (session && session.url === message.url) {
              console.log("[Puppeteer Preview] Adding client to existing session");
              session.clients.add(ws);
              if (session.viewportWidth !== message.width || session.viewportHeight !== message.height) {
                await resizePreview(message.width, message.height);
              }
            } else {
              await startPreview(message.url, message.width, message.height);
              if (session) {
                session.clients.add(ws);
              }
            }
            ws.send(JSON.stringify({ type: "started" }));
            break;
          case "stop":
            await stopPreview();
            ws.send(JSON.stringify({ type: "stopped" }));
            break;
          case "refresh":
            await refreshPreview();
            break;
          case "navigate":
            await navigatePreview(message.url);
            break;
          case "resize":
            await resizePreview(message.width, message.height);
            break;
          case "mouse":
            await handleMouseEvent(message.eventType, message.x, message.y, message.button);
            break;
          case "key":
            await handleKeyEvent(message.eventType, message.key);
            break;
          case "type":
            await typeText(message.text);
            break;
          case "scroll":
            await handleScroll(message.deltaX, message.deltaY);
            break;
          case "back":
            const wentBack = await goBack();
            ws.send(JSON.stringify({ type: "navigation", success: wentBack, direction: "back" }));
            break;
          case "forward":
            const wentForward = await goForward();
            ws.send(JSON.stringify({ type: "navigation", success: wentForward, direction: "forward" }));
            break;
        }
      } catch (error) {
        console.error("[Puppeteer Preview] Message handling error:", error);
        ws.send(JSON.stringify({ type: "error", message: String(error) }));
      }
    });
    ws.on("close", () => {
      console.log("[Puppeteer Preview] WebSocket client disconnected");
      if (session) {
        session.clients.delete(ws);
        if (session.clients.size === 0) {
          scheduleSessionCleanup();
        }
      }
    });
    ws.on("error", (error) => {
      console.error("[Puppeteer Preview] WebSocket error:", error);
    });
  });
  console.log("[Puppeteer Preview] WebSocket server ready");
}

// vite/api-plugin.ts
var __vite_injected_original_dirname = "E:\\Projects\\RN-Expo-WebApp-Wrapper-Template\\tools\\config-editor\\client\\vite";
var execAsync = promisify(exec);
var logcatSessions = /* @__PURE__ */ new Map();
var LOGCAT_CLEANUP_DELAY = 5e3;
function getLogcatSessionKey(device, logType) {
  return `${device}:${logType}`;
}
function cleanupLogcatSession(key) {
  const session2 = logcatSessions.get(key);
  if (!session2) return;
  if (session2.cleanupTimer) {
    clearTimeout(session2.cleanupTimer);
  }
  console.log(`[Logcat] Cleaning up session: ${key}`);
  try {
    session2.process.kill();
  } catch (e) {
  }
  logcatSessions.delete(key);
}
function scheduleLogcatCleanup(key) {
  const session2 = logcatSessions.get(key);
  if (!session2) return;
  if (session2.cleanupTimer) {
    clearTimeout(session2.cleanupTimer);
  }
  session2.cleanupTimer = setTimeout(() => {
    const currentSession = logcatSessions.get(key);
    if (currentSession && currentSession.clients.size === 0) {
      cleanupLogcatSession(key);
    }
  }, LOGCAT_CLEANUP_DELAY);
}
function cancelLogcatCleanup(key) {
  const session2 = logcatSessions.get(key);
  if (session2?.cleanupTimer) {
    clearTimeout(session2.cleanupTimer);
    session2.cleanupTimer = null;
  }
}
var LICENSE_ERROR_PATTERNS = [
  /License for package .* not accepted/i,
  /Failed to install the following Android SDK packages/i,
  /You have not accepted the license agreements/i
];
function detectLicenseError(text) {
  return LICENSE_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}
function inferSdkRootFromPath(inputPath) {
  const normalizedPath = path.normalize(inputPath).toLowerCase();
  if (normalizedPath.endsWith("bin") || normalizedPath.endsWith("bin\\") || normalizedPath.endsWith("bin/")) {
    const parent = path.dirname(inputPath);
    const grandParent = path.dirname(parent);
    if (grandParent.toLowerCase().includes("cmdline-tools")) {
      return path.dirname(grandParent);
    }
    if (parent.toLowerCase().endsWith("cmdline-tools") || parent.toLowerCase().endsWith("tools")) {
      return path.dirname(parent);
    }
    return grandParent;
  }
  if (normalizedPath.endsWith("cmdline-tools") || normalizedPath.endsWith("cmdline-tools\\") || normalizedPath.endsWith("cmdline-tools/")) {
    return path.dirname(inputPath);
  }
  if (normalizedPath.endsWith("tools") || normalizedPath.endsWith("tools\\") || normalizedPath.endsWith("tools/")) {
    return path.dirname(inputPath);
  }
  return inputPath;
}
async function acceptSdkLicenses(sdkPath) {
  let inputPath = sdkPath || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.platform === "win32" ? path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk") : "");
  if (!inputPath) {
    return { success: false, message: "Android SDK path not found" };
  }
  const sdkRoot = inferSdkRootFromPath(inputPath);
  const sdkmanagerName = process.platform === "win32" ? "sdkmanager.bat" : "sdkmanager";
  const sdkmanagerPaths = [
    // 표준 SDK 구조: cmdline-tools/latest/bin
    path.join(sdkRoot, "cmdline-tools", "latest", "bin", sdkmanagerName),
    // 이전 버전 SDK 구조: cmdline-tools/bin
    path.join(sdkRoot, "cmdline-tools", "bin", sdkmanagerName),
    // 레거시 SDK 구조: tools/bin
    path.join(sdkRoot, "tools", "bin", sdkmanagerName),
    // 입력 경로가 bin 폴더인 경우
    path.join(inputPath, sdkmanagerName),
    // 입력 경로가 cmdline-tools 폴더인 경우
    path.join(inputPath, "bin", sdkmanagerName)
  ];
  let sdkmanagerPath = null;
  for (const p of sdkmanagerPaths) {
    if (fsSync.existsSync(p)) {
      sdkmanagerPath = p;
      break;
    }
  }
  if (!sdkmanagerPath) {
    return { success: false, message: `sdkmanager not found. Searched paths:
${sdkmanagerPaths.slice(0, 3).join("\n")}` };
  }
  try {
    if (process.platform === "win32") {
      const psCommand = `powershell -Command "& { 1..20 | ForEach-Object { 'y' } | & '${sdkmanagerPath.replace(/'/g, "''")}' --sdk_root='${sdkRoot.replace(/'/g, "''")}' --licenses }"`;
      await execAsync(psCommand, {
        timeout: 18e4,
        env: { ...process.env, ANDROID_HOME: sdkRoot, ANDROID_SDK_ROOT: sdkRoot }
      });
    } else {
      await execAsync(`yes | "${sdkmanagerPath}" --sdk_root="${sdkRoot}" --licenses`, {
        timeout: 18e4,
        env: { ...process.env, ANDROID_HOME: sdkRoot, ANDROID_SDK_ROOT: sdkRoot }
      });
    }
    return { success: true, message: "SDK licenses accepted successfully" };
  } catch (error) {
    if (error.stdout?.includes("accepted") || error.stderr?.includes("accepted") || error.stdout?.includes("All SDK package licenses accepted") || error.stderr?.includes("All SDK package licenses accepted")) {
      return { success: true, message: "SDK licenses accepted" };
    }
    if (error.stdout?.includes("licenses not accepted") === false && error.stderr?.includes("licenses not accepted") === false) {
      return { success: true, message: "SDK licenses already accepted" };
    }
    return { success: false, message: `Failed to accept licenses: ${error.message}` };
  }
}
var buildProcesses = /* @__PURE__ */ new Map();
var proxyTargetUrl = null;
var proxyTargetOrigin = null;
var getPreviewBridgeScript = (targetOrigin) => {
  return `
<script>
(function() {
  'use strict';

  var TARGET_ORIGIN = ${JSON.stringify(targetOrigin)};

  // ========================================
  // Comprehensive URL Rewriting for Preview Proxy
  // ========================================

  function rewriteUrl(url) {
    if (typeof url !== 'string') return url;

    // \uC774\uBBF8 /preview/\uB85C \uC2DC\uC791\uD558\uBA74 \uC2A4\uD0B5
    if (url.startsWith('/preview/') || url.startsWith('/preview?')) return url;

    // data:, blob:, javascript: \uB4F1\uC740 \uC2A4\uD0B5
    if (/^(data|blob|javascript|about|mailto):/i.test(url)) return url;

    // \uD0C0\uAC9F \uC624\uB9AC\uC9C4\uC758 \uC804\uCCB4 URL\uC774\uBA74 \uB9AC\uB77C\uC774\uD2B8
    if (url.startsWith(TARGET_ORIGIN + '/')) {
      return '/preview' + url.slice(TARGET_ORIGIN.length);
    }
    if (url === TARGET_ORIGIN) {
      return '/preview/';
    }

    // \uD504\uB85C\uD1A0\uCF5C \uC0C1\uB300 URL (//example.com/...) - \uD0C0\uAC9F \uB3C4\uBA54\uC778\uC774\uBA74 \uB9AC\uB77C\uC774\uD2B8
    if (url.startsWith('//')) {
      var targetHost = TARGET_ORIGIN.replace(/^https?:/, '');
      if (url.startsWith(targetHost + '/') || url === targetHost) {
        return '/preview' + url.slice(targetHost.length);
      }
      return url; // \uB2E4\uB978 \uB3C4\uBA54\uC778\uC740 \uADF8\uB300\uB85C
    }

    // \uC808\uB300 \uACBD\uB85C (/)\uB85C \uC2DC\uC791\uD558\uBA74 /preview \uBD99\uC774\uAE30
    if (url.startsWith('/')) {
      return '/preview' + url;
    }

    // \uC0C1\uB300 \uACBD\uB85C\uB294 \uADF8\uB300\uB85C (\uBE0C\uB77C\uC6B0\uC800\uAC00 base \uD0DC\uADF8 \uAE30\uC900\uC73C\uB85C \uCC98\uB9AC)
    return url;
  }

  // fetch \uC624\uBC84\uB77C\uC774\uB4DC
  var originalFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string') {
      input = rewriteUrl(input);
    } else if (input instanceof Request) {
      var newUrl = rewriteUrl(input.url);
      if (newUrl !== input.url) {
        input = new Request(newUrl, input);
      }
    }
    return originalFetch.call(this, input, init);
  };

  // XMLHttpRequest \uC624\uBC84\uB77C\uC774\uB4DC
  var originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    var newUrl = rewriteUrl(url);
    return originalXHROpen.call(this, method, newUrl, async !== false, user, password);
  };

  // EventSource \uC624\uBC84\uB77C\uC774\uB4DC (SSE)
  if (window.EventSource) {
    var OriginalEventSource = window.EventSource;
    window.EventSource = function(url, config) {
      return new OriginalEventSource(rewriteUrl(url), config);
    };
    window.EventSource.prototype = OriginalEventSource.prototype;
  }

  // WebSocket\uC740 ws:// \uD504\uB85C\uD1A0\uCF5C\uC774\uB77C \uB9AC\uB77C\uC774\uD2B8 \uBD88\uAC00, \uADF8\uB300\uB85C \uB460

  // Dynamic script/link/img \uC0DD\uC131 \uC2DC src/href \uB9AC\uB77C\uC774\uD2B8
  var originalCreateElement = document.createElement.bind(document);
  document.createElement = function(tagName, options) {
    var el = originalCreateElement(tagName, options);
    var tag = tagName.toLowerCase();

    if (tag === 'script' || tag === 'img' || tag === 'iframe' || tag === 'video' || tag === 'audio' || tag === 'source') {
      var originalSetAttribute = el.setAttribute.bind(el);
      el.setAttribute = function(name, value) {
        if (name === 'src' && typeof value === 'string') {
          value = rewriteUrl(value);
        }
        return originalSetAttribute(name, value);
      };

      // src \uD504\uB85C\uD37C\uD2F0\uB3C4 \uC624\uBC84\uB77C\uC774\uB4DC
      var srcDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'src') ||
                          Object.getOwnPropertyDescriptor(el.__proto__, 'src');
      if (srcDescriptor && srcDescriptor.set) {
        Object.defineProperty(el, 'src', {
          get: srcDescriptor.get,
          set: function(value) {
            srcDescriptor.set.call(this, rewriteUrl(value));
          },
          configurable: true
        });
      }
    }

    if (tag === 'link' || tag === 'a') {
      var originalSetAttribute2 = el.setAttribute.bind(el);
      el.setAttribute = function(name, value) {
        if (name === 'href' && typeof value === 'string') {
          value = rewriteUrl(value);
        }
        return originalSetAttribute2(name, value);
      };
    }

    return el;
  };

  // import() \uB3D9\uC801 \uC784\uD3EC\uD2B8\uB294 \uB124\uC774\uD2F0\uBE0C\uB77C \uC624\uBC84\uB77C\uC774\uB4DC \uC5B4\uB824\uC6C0
  // \uB300\uC2E0 \uC11C\uBC84\uC5D0\uC11C JS \uD30C\uC77C \uB0B4 import \uACBD\uB85C\uB97C \uB9AC\uB77C\uC774\uD2B8\uD574\uC57C \uD568

  // ========================================
  // URL/Location Spoofing for SPA Routers
  // ========================================

  (function() {
    var previewPrefix = '/preview';
    var originalPathname = window.location.pathname;
    var originalHref = window.location.href;

    console.log('[Preview] Original URL:', originalHref);
    console.log('[Preview] Original pathname:', originalPathname);

    // /preview\uB85C \uC2DC\uC791\uD558\uBA74 URL \uBCC0\uACBD
    if (originalPathname === previewPrefix || originalPathname.startsWith(previewPrefix + '/')) {
      var spoofedPath = originalPathname.slice(previewPrefix.length) || '/';
      var newUrl = spoofedPath + window.location.search + window.location.hash;

      console.log('[Preview] Spoofing to:', newUrl);

      // history.replaceState\uB85C URL \uBCC0\uACBD
      try {
        window.history.replaceState(window.history.state, '', newUrl);
        console.log('[Preview] After replaceState, location.pathname:', window.location.pathname);
        console.log('[Preview] After replaceState, location.href:', window.location.href);
      } catch(e) {
        console.error('[Preview] replaceState failed:', e);
      }
    }
  })();

  console.log('[Preview] URL rewriting enabled for:', TARGET_ORIGIN);

  // ========================================
  // beforeunload \uACBD\uACE0\uCC3D \uC644\uC804 \uBB34\uB825\uD654
  // (\uD3FC \uB370\uC774\uD130 \uC785\uB825 \uC911 \uD398\uC774\uC9C0 \uC774\uD0C8 \uC2DC \uACBD\uACE0\uCC3D \uBC29\uC9C0)
  // ========================================

  // 1. window.onbeforeunload \uC18D\uC131 \uBB34\uB825\uD654
  Object.defineProperty(window, 'onbeforeunload', {
    get: function() { return null; },
    set: function() { return; },
    configurable: false
  });

  // 2. addEventListener\uB85C \uB4F1\uB85D\uB418\uB294 beforeunload \uC774\uBCA4\uD2B8 \uCC28\uB2E8
  var originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'beforeunload') {
      return;
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  // 3. \uC774\uBBF8 \uB4F1\uB85D\uB41C beforeunload \uC774\uBCA4\uD2B8 \uBB34\uB825\uD654
  window.addEventListener('beforeunload', function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    delete e.returnValue;
    return undefined;
  }, true);

  // ========================================
  // AppBridge for Preview (\uC2E4\uC81C \uC571\uACFC 100% \uB3D9\uC77C\uD55C \uAD6C\uD604)
  // ========================================

  if (window.AppBridge) return;

  // \uD1A0\uD070\uC744 Symbol \uD0A4\uB85C \uC740\uB2C9 (\uC678\uBD80\uC5D0\uC11C \uC811\uADFC \uBD88\uAC00)
  var _t = (function(){
    var s = Symbol('_');
    var o = {};
    o[s] = 'preview-security-token';
    return function(){ return o[s]; };
  })();

  // \uC751\uB2F5 \uB300\uAE30 \uB9F5
  var pendingRequests = new Map();

  // \uD30C\uC77C/\uBC14\uC774\uB108\uB9AC \uB370\uC774\uD130\uB97C base64\uB85C \uBCC0\uD658
  function toBase64(data) {
    if (data instanceof Blob || data instanceof File) {
      return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onloadend = function() {
          resolve({
            __type: 'base64',
            data: reader.result.split(',')[1],
            mimeType: data.type,
            name: data.name || 'file',
            size: data.size
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(data);
      });
    }
    return Promise.resolve(data);
  }

  // \uC7AC\uADC0\uC801\uC73C\uB85C \uBAA8\uB4E0 Blob/File \uCC98\uB9AC
  function processPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return Promise.resolve(payload);
    }

    var promises = [];
    var keys = [];

    for (var key in payload) {
      if (payload.hasOwnProperty(key)) {
        var value = payload[key];
        if (value instanceof Blob || value instanceof File) {
          keys.push(key);
          promises.push(toBase64(value));
        }
      }
    }

    if (promises.length === 0) {
      return Promise.resolve(payload);
    }

    return Promise.all(promises).then(function(results) {
      var processed = Object.assign({}, payload);
      for (var i = 0; i < keys.length; i++) {
        processed[keys[i]] = results[i];
      }
      return processed;
    });
  }

  // Preview\uC6A9 mock \uC751\uB2F5 \uC0DD\uC131 (\uB2E4\uC591\uD55C action \uC9C0\uC6D0)
  var mockResponses = {
    // \uC571/\uC2DC\uC2A4\uD15C \uC815\uBCF4
    'getAppInfo': { appName: 'Preview App', version: '1.0.0', platform: 'preview', isApp: true },
    'getDeviceInfo': { platform: 'android', model: 'Preview Device', osVersion: '13', isPreview: true, isApp: true },
    'getSystemInfo': { platform: 'android', isApp: true, isPreview: true, version: '1.0.0' },
    'getPlatform': { platform: 'android', isApp: true },
    'getVersion': { version: '1.0.0' },

    // \uAD8C\uD55C
    'checkPermission': { granted: true },
    'requestPermission': { granted: true },
    'hasPermission': { granted: true, result: true },

    // \uC778\uC99D/\uC0AC\uC6A9\uC790
    'getToken': { token: 'preview-mock-token' },
    'getFcmToken': { token: 'preview-fcm-token' },
    'getPushToken': { token: 'preview-push-token' },
    'getUserInfo': { isLoggedIn: false },
    'getUser': { isLoggedIn: false },
    'isLoggedIn': { loggedIn: false, isLoggedIn: false },

    // \uC124\uC815/\uD658\uACBD
    'getSettings': { theme: 'light' },
    'getConfig': { debug: false },
    'getEnv': { env: 'preview' },

    // UI/\uB808\uC774\uC544\uC6C3
    'getSafeArea': { top: 24, bottom: 34, left: 0, right: 0 },
    'getStatusBarHeight': { height: 24 },
    'getNavigationBarHeight': { height: 48 },
    'getInsets': { top: 24, bottom: 34, left: 0, right: 0 },
    'getScreenInfo': { width: 360, height: 800, scale: 3 },

    // \uB124\uD2B8\uC6CC\uD06C/\uC5F0\uACB0
    'getNetworkStatus': { connected: true, type: 'wifi' },
    'isOnline': { online: true, connected: true },

    // \uC2A4\uD1A0\uB9AC\uC9C0
    'getItem': { value: null },
    'setItem': { success: true },
    'removeItem': { success: true },

    // \uC561\uC158
    'haptic': { success: true },
    'vibrate': { success: true },
    'share': { success: true },
    'openUrl': { success: true },
    'openBrowser': { success: true },
    'copyToClipboard': { success: true },
    'showToast': { success: true },
    'hideKeyboard': { success: true },

    // \uAE30\uBCF8 \uC751\uB2F5 (\uC54C \uC218 \uC5C6\uB294 action\uC5D0 \uB300\uD574)
    '_default': { success: true, isPreview: true, isApp: true }
  };

  // ReactNativeWebView mock - \uC2E4\uC81C \uC571\uACFC \uB3D9\uC77C\uD55C \uBC29\uC2DD\uC73C\uB85C \uC751\uB2F5 \uC804\uB2EC
  window.ReactNativeWebView = {
    postMessage: function(messageStr) {
      var parsed = JSON.parse(messageStr);
      console.log('[AppBridge Preview] postMessage:', parsed);

      // requestId\uAC00 \uC788\uC73C\uBA74 call() \uD638\uCD9C -> mock \uC751\uB2F5 \uBC18\uD658
      if (parsed.requestId) {
        var action = parsed.protocol.replace('app://', '');
        var mockData = mockResponses[action] || mockResponses['_default'];

        // \uC2E4\uC81C \uC571\uCC98\uB7FC \uC57D\uAC04\uC758 \uB51C\uB808\uC774 \uD6C4 nativeMessage \uC774\uBCA4\uD2B8\uB85C \uC751\uB2F5
        setTimeout(function() {
          var response = {
            action: 'bridgeResponse',
            payload: {
              requestId: parsed.requestId,
              success: true,
              data: mockData
            }
          };
          console.log('[AppBridge Preview] Sending mock response via nativeMessage:', response);
          window.dispatchEvent(new CustomEvent('nativeMessage', { detail: response }));
        }, 50);
      }

      // parent frame\uC5D0\uB3C4 \uC54C\uB9BC (\uB514\uBC84\uAE45\uC6A9)
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'PREVIEW_BRIDGE_MESSAGE', data: parsed }, '*');
      }
    }
  };

  // \uC571 \uBE0C\uB9BF\uC9C0 \uAC1D\uCCB4 (\uC2E4\uC81C bridge-client.ts\uC640 \uB3D9\uC77C\uD55C \uAD6C\uC870)
  window.AppBridge = {
    send: function(action, payload) {
      processPayload(payload || {}).then(function(processed) {
        var message = {
          protocol: 'app://' + action,
          payload: processed,
          timestamp: Date.now(),
          __token: _t(),
          __nonce: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        };
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }).catch(function(err) {
        console.error('[AppBridge] Failed to process payload:', err);
      });
    },

    call: function(action, payload, timeout) {
      timeout = timeout || 10000;

      return processPayload(payload || {}).then(function(processed) {
        return new Promise(function(resolve, reject) {
          var requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

          var timer = setTimeout(function() {
            pendingRequests.delete(requestId);
            reject(new Error('Request timeout: ' + action));
          }, timeout);

          pendingRequests.set(requestId, {
            resolve: resolve,
            reject: reject,
            timer: timer
          });

          var message = {
            protocol: 'app://' + action,
            payload: processed,
            requestId: requestId,
            timestamp: Date.now(),
            __token: _t(),
            __nonce: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
          };
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        });
      });
    },

    on: function(action, callback) {
      if (!this._listeners) this._listeners = {};
      if (!this._listeners[action]) this._listeners[action] = [];
      this._listeners[action].push(callback);
    },

    once: function(action, callback) {
      var self = this;
      var wrapper = function(payload, message) {
        self.off(action, wrapper);
        callback(payload, message);
      };
      this.on(action, wrapper);
    },

    waitFor: function(action, timeout) {
      var self = this;
      timeout = timeout || 10000;

      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          self.off(action, handler);
          reject(new Error('Timeout waiting for: ' + action));
        }, timeout);

        var handler = function(payload, message) {
          clearTimeout(timer);
          self.off(action, handler);
          resolve({ payload: payload, message: message });
        };

        self.on(action, handler);
      });
    },

    off: function(action, callback) {
      if (!this._listeners || !this._listeners[action]) return;
      if (callback) {
        this._listeners[action] = this._listeners[action].filter(function(cb) {
          return cb !== callback;
        });
      } else {
        delete this._listeners[action];
      }
    },

    _handleResponse: function(response) {
      var pending = pendingRequests.get(response.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(response.requestId);
        if (response.success) {
          pending.resolve(response.data);
        } else {
          pending.reject(new Error(response.error || 'Unknown error'));
        }
      }
    },

    _handleMessage: function(message) {
      console.log('[AppBridge] _handleMessage called', message);

      if (message.action === 'bridgeResponse') {
        this._handleResponse(message.payload);
        return;
      }

      if (this._listeners) {
        if (this._listeners[message.action]) {
          console.log('[AppBridge] Found ' + this._listeners[message.action].length + ' listener(s) for: ' + message.action);
          this._listeners[message.action].forEach(function(cb) {
            try {
              cb(message.payload, message);
            } catch(e) {
              console.error('[AppBridge] Listener error:', e);
            }
          });
        }
        if (this._listeners['*']) {
          this._listeners['*'].forEach(function(cb) {
            try { cb(message.payload, message); } catch(e) { console.error(e); }
          });
        }
      }
    },

    isApp: function() {
      return !!window.ReactNativeWebView;
    },

    isPreview: function() {
      return true;
    },

    version: '2.1.0'
  };

  // \uC571\uC5D0\uC11C \uC628 \uBA54\uC2DC\uC9C0 \uC218\uC2E0 \uB9AC\uC2A4\uB108 (\uC2E4\uC81C \uC571\uACFC \uB3D9\uC77C)
  window.addEventListener('nativeMessage', function(e) {
    console.log('[AppBridge] nativeMessage event received', e.detail);
    window.AppBridge._handleMessage(e.detail);
  });

  // \uC804\uC5ED \uCF5C\uBC31 (\uD638\uD658\uC131)
  window.onNativeMessage = function(message) {
    window.AppBridge._handleMessage(message);
  };

  // \uCD08\uAE30\uD654 \uC644\uB8CC \uC774\uBCA4\uD2B8
  window.dispatchEvent(new CustomEvent('AppBridgeReady'));
  console.log('[AppBridge Preview] Initialized (matching real app implementation)');
})();
</script>`;
};
var projectRoot = path.resolve(__vite_injected_original_dirname, "../../../..");
var constantsDir = path.join(projectRoot, "constants");
var bridgesDir = path.join(projectRoot, "lib/bridges");
var CONFIG_FILES = {
  app: "app.json",
  theme: "theme.json",
  plugins: "plugins.json",
  "build-env": "build-env.json"
};
var NPM_PACKAGE_REGEX = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
var SAFE_SEARCH_REGEX = /^[a-zA-Z0-9@/_-]+$/;
function isValidPackageName(name) {
  return typeof name === "string" && name.length > 0 && name.length <= 214 && NPM_PACKAGE_REGEX.test(name);
}
function isValidSearchQuery(query) {
  return typeof query === "string" && query.length > 0 && query.length <= 100 && SAFE_SEARCH_REGEX.test(query);
}
async function searchNpmPackages(query) {
  if (!isValidSearchQuery(query)) {
    console.log("[api-plugin] Invalid search query:", query);
    return [];
  }
  try {
    console.log("[api-plugin] Searching npm for:", query);
    const { stdout } = await execAsync(`npm search "${query}" --json`, {
      cwd: projectRoot,
      timeout: 6e4
    });
    const results = JSON.parse(stdout);
    console.log("[api-plugin] Search results count:", results.length);
    return results;
  } catch (error) {
    console.error("[api-plugin] npm search error:", error);
    return [];
  }
}
async function getInstalledPackages() {
  try {
    const { stdout } = await execAsync("npm list --json --depth=0", {
      cwd: projectRoot
    });
    const data = JSON.parse(stdout);
    return Object.entries(data.dependencies || {}).map(([name, info]) => ({
      name,
      version: info.version
    }));
  } catch (error) {
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
    console.error("[api-plugin] npm list error:", error.message);
    return [];
  }
}
async function installPackage(packageName, version = "latest") {
  if (!isValidPackageName(packageName)) {
    return { success: false, error: "Invalid package name" };
  }
  const spec = version === "latest" ? packageName : `${packageName}@${version}`;
  try {
    await execAsync(`npm install ${spec}`, { cwd: projectRoot, timeout: 12e4 });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function uninstallPackage(packageName) {
  if (!isValidPackageName(packageName)) {
    return { success: false, error: "Invalid package name" };
  }
  try {
    await execAsync(`npm uninstall ${packageName}`, { cwd: projectRoot, timeout: 6e4 });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
async function regeneratePluginRegistry() {
  try {
    await execAsync("npm run generate:plugins", { cwd: projectRoot });
    console.log("[api-plugin] Plugin registry regenerated");
  } catch (e) {
    console.error("[api-plugin] Failed to regenerate plugin registry:", e);
  }
}
function validatePluginNamespaces(config) {
  const allPlugins = [
    ...(config.plugins?.auto || []).map((p) => ({ ...p, id: p.name, type: "auto" })),
    ...(config.plugins?.manual || []).map((p) => ({ ...p, id: p.path, type: "manual" }))
  ];
  const namespaceMap = /* @__PURE__ */ new Map();
  allPlugins.forEach((plugin) => {
    const ns = plugin.namespace;
    const id = plugin.id;
    if (ns) {
      if (!namespaceMap.has(ns)) {
        namespaceMap.set(ns, []);
      }
      namespaceMap.get(ns).push(id);
    }
  });
  const conflicts = [];
  namespaceMap.forEach((plugins, namespace) => {
    if (plugins.length > 1) {
      conflicts.push({ namespace, plugins });
    }
  });
  return { valid: conflicts.length === 0, conflicts };
}
async function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}
function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}
async function loadBuildEnv() {
  try {
    const content = await fs.readFile(path.join(constantsDir, "build-env.json"), "utf-8");
    const data = JSON.parse(content);
    const { $schema, ...config } = data;
    return config;
  } catch {
    return {};
  }
}
async function updateLocalProperties(sdkPath) {
  const localPropsPath = path.join(projectRoot, "android", "local.properties");
  const escapedPath = sdkPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
  const content = `sdk.dir=${escapedPath}
`;
  await fs.writeFile(localPropsPath, content, "utf-8");
}
function validateSdkPath(sdkPath) {
  const normalizedPath = path.normalize(sdkPath).toLowerCase();
  if (normalizedPath.endsWith("bin") || normalizedPath.endsWith("bin\\") || normalizedPath.endsWith("bin/")) {
    const parentDir = path.dirname(sdkPath);
    const grandParentDir = path.dirname(parentDir);
    return {
      valid: false,
      issue: "SDK path points to bin folder",
      suggestion: `Use SDK root instead: ${grandParentDir}`
    };
  }
  if (normalizedPath.endsWith("cmdline-tools") || normalizedPath.endsWith("cmdline-tools\\") || normalizedPath.endsWith("cmdline-tools/")) {
    const parentDir = path.dirname(sdkPath);
    return {
      valid: false,
      issue: "SDK path points to cmdline-tools folder",
      suggestion: `Use SDK root instead: ${parentDir}`
    };
  }
  if (normalizedPath.endsWith("tools") || normalizedPath.endsWith("tools\\") || normalizedPath.endsWith("tools/")) {
    const parentDir = path.dirname(sdkPath);
    return {
      valid: false,
      issue: "SDK path points to tools folder",
      suggestion: `Use SDK root instead: ${parentDir}`
    };
  }
  return { valid: true };
}
async function checkSdkLicenses(sdkPath) {
  const licensesDir = path.join(sdkPath, "licenses");
  if (!fsSync.existsSync(licensesDir)) {
    return { accepted: false, missing: ["licenses folder not found"] };
  }
  const requiredLicenses = ["android-sdk-license"];
  const missing = [];
  for (const license of requiredLicenses) {
    const licensePath = path.join(licensesDir, license);
    if (!fsSync.existsSync(licensePath)) {
      missing.push(license);
    }
  }
  return { accepted: missing.length === 0, missing };
}
function inferSdkRoot(inputPath) {
  const normalizedPath = path.normalize(inputPath).toLowerCase();
  if (normalizedPath.endsWith("bin") || normalizedPath.endsWith("bin\\") || normalizedPath.endsWith("bin/")) {
    const parent = path.dirname(inputPath);
    const grandParent = path.dirname(parent);
    if (grandParent.toLowerCase().includes("cmdline-tools")) {
      return path.dirname(grandParent);
    }
    return grandParent;
  }
  if (normalizedPath.endsWith("cmdline-tools") || normalizedPath.endsWith("cmdline-tools\\") || normalizedPath.endsWith("cmdline-tools/")) {
    return path.dirname(inputPath);
  }
  return inputPath;
}
async function checkBuildEnvironment() {
  const checks = [];
  const buildEnv = await loadBuildEnv();
  try {
    const { stdout } = await execAsync("node -v");
    checks.push({ name: "Node.js", status: "ok", message: stdout.trim() });
  } catch {
    checks.push({
      name: "Node.js",
      status: "error",
      message: "Not installed",
      guidance: "Install Node.js from https://nodejs.org/"
    });
  }
  try {
    const { stdout } = await execAsync("npm -v");
    checks.push({ name: "npm", status: "ok", message: `v${stdout.trim()}` });
  } catch {
    checks.push({
      name: "npm",
      status: "error",
      message: "Not installed",
      guidance: "npm is included with Node.js installation"
    });
  }
  const javaHome = buildEnv.android?.javaHome || process.env.JAVA_HOME;
  if (javaHome) {
    try {
      const javaCmd = path.join(javaHome, "bin", "java");
      const { stderr } = await execAsync(`"${javaCmd}" -version`);
      const match = stderr.match(/version "([^"]+)"/);
      const version = match ? match[1] : "Unknown";
      const major = parseInt(version.split(".")[0]);
      if (major >= 17 && major <= 21) {
        checks.push({ name: "Java", status: "ok", message: version });
      } else if (major > 21) {
        checks.push({ name: "Java", status: "warning", message: version, detail: "JDK 17-21 recommended" });
      } else {
        checks.push({
          name: "Java",
          status: "error",
          message: version,
          detail: "JDK 17+ required",
          guidance: "Install JDK 17 or higher from https://adoptium.net/"
        });
      }
    } catch {
      try {
        const { stderr } = await execAsync("java -version");
        const match = stderr.match(/version "([^"]+)"/);
        const version = match ? match[1] : "Unknown";
        checks.push({ name: "Java", status: "ok", message: version });
      } catch {
        checks.push({
          name: "Java",
          status: "error",
          message: "Not installed",
          detail: "JDK 17+ required",
          guidance: "Install JDK 17 from https://adoptium.net/"
        });
      }
    }
  } else {
    try {
      const { stderr } = await execAsync("java -version");
      const match = stderr.match(/version "([^"]+)"/);
      const version = match ? match[1] : "Unknown";
      checks.push({ name: "Java", status: "ok", message: version });
    } catch {
      checks.push({
        name: "Java",
        status: "error",
        message: "Not installed",
        detail: "JDK 17+ required",
        guidance: "Install JDK 17 from https://adoptium.net/"
      });
    }
  }
  if (buildEnv.android?.javaHome) {
    checks.push({ name: "JAVA_HOME", status: "ok", message: buildEnv.android.javaHome, detail: "(config)" });
  } else if (process.env.JAVA_HOME) {
    checks.push({ name: "JAVA_HOME", status: "ok", message: process.env.JAVA_HOME });
  } else {
    checks.push({
      name: "JAVA_HOME",
      status: "warning",
      message: "Not set",
      guidance: "Set Java Home path in Environment Settings above"
    });
  }
  const androidHome = buildEnv.android?.sdkPath || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (androidHome) {
    const pathValidation = validateSdkPath(androidHome);
    if (!pathValidation.valid) {
      const inferredRoot = inferSdkRoot(androidHome);
      checks.push({
        name: "Android SDK",
        status: "error",
        message: pathValidation.issue || "Invalid SDK path",
        detail: androidHome,
        guidance: pathValidation.suggestion || `SDK root should contain cmdline-tools, licenses folders. Try: ${inferredRoot}`
      });
    } else if (fsSync.existsSync(path.join(androidHome, "cmdline-tools")) || fsSync.existsSync(path.join(androidHome, "tools")) || fsSync.existsSync(path.join(androidHome, "licenses"))) {
      const source = buildEnv.android?.sdkPath ? "(config)" : void 0;
      const hasPlatformTools = fsSync.existsSync(path.join(androidHome, "platform-tools"));
      checks.push({
        name: "Android SDK",
        status: "ok",
        message: androidHome,
        detail: source
      });
      if (!hasPlatformTools) {
        checks.push({
          name: "Platform Tools",
          status: "info",
          message: "Not installed",
          detail: "Optional - needed for adb (device debugging)",
          guidance: 'Run: sdkmanager "platform-tools" if you need adb'
        });
      }
      const licenseCheck = await checkSdkLicenses(androidHome);
      if (!licenseCheck.accepted) {
        checks.push({
          name: "SDK Licenses",
          status: "error",
          message: "Not accepted",
          detail: licenseCheck.missing.join(", "),
          guidance: `Run: sdkmanager --licenses`
        });
      } else {
        checks.push({ name: "SDK Licenses", status: "ok", message: "Accepted" });
      }
    } else {
      checks.push({
        name: "Android SDK",
        status: "error",
        message: "Invalid SDK structure",
        detail: androidHome,
        guidance: "The path should be the SDK root containing cmdline-tools or tools folder. Download Android SDK from https://developer.android.com/studio"
      });
    }
  } else {
    checks.push({
      name: "Android SDK",
      status: "error",
      message: "Not found",
      detail: "Set ANDROID_HOME or configure in settings",
      guidance: "Set Android SDK Path in Environment Settings above, or set ANDROID_HOME environment variable"
    });
  }
  try {
    const { stdout } = await execAsync("npx eas --version");
    checks.push({ name: "EAS CLI", status: "ok", message: stdout.trim() });
  } catch {
    checks.push({
      name: "EAS CLI",
      status: "info",
      message: "Not installed",
      detail: "Required for cloud builds",
      guidance: "Run: npm install -g eas-cli"
    });
  }
  if (fsSync.existsSync(path.join(projectRoot, "android"))) {
    checks.push({ name: "Android Project", status: "ok", message: "Found" });
  } else {
    checks.push({
      name: "Android Project",
      status: "info",
      message: "Not found",
      detail: "Run expo prebuild first",
      guidance: "Run: npx expo prebuild --platform android"
    });
  }
  const keystorePaths = [
    path.join(projectRoot, "android", "app", "release.keystore"),
    path.join(projectRoot, "android", "app", "my-release-key.keystore"),
    path.join(projectRoot, "android", "keystores", "release.keystore")
  ];
  const hasKeystore = keystorePaths.some((p) => fsSync.existsSync(p));
  if (hasKeystore) {
    checks.push({ name: "Release Keystore", status: "ok", message: "Found" });
  } else {
    checks.push({
      name: "Release Keystore",
      status: "info",
      message: "Not found",
      detail: "Required for release builds",
      guidance: "Generate a keystore in the Keystore section below"
    });
  }
  return checks;
}
function startBuildProcess(type, profile, buildId, retryCount = 0) {
  const output = [];
  let cmd;
  let args;
  let licenseErrorDetected = false;
  let allOutputText = "";
  if (type === "cloud") {
    cmd = "npx";
    args = ["eas", "build", "--platform", "android", "--profile", profile, "--non-interactive"];
    output.push({ type: "info", text: `Starting EAS cloud build (${profile})...`, timestamp: Date.now() });
  } else if (type === "expo-dev") {
    cmd = process.platform === "win32" ? "cmd" : "sh";
    const devScript = process.platform === "win32" ? `node scripts\\setup-plugins.js && npx expo run:android --no-install` : `node scripts/setup-plugins.js && npx expo run:android --no-install`;
    args = process.platform === "win32" ? ["/c", devScript] : ["-c", devScript];
    output.push({ type: "info", text: "Starting Expo development build...", timestamp: Date.now() });
    output.push({ type: "info", text: "Building development client APK...", timestamp: Date.now() });
  } else {
    const gradleTask = profile === "debug" ? "assembleDebug" : profile === "release-apk" ? "assembleRelease" : "bundleRelease";
    cmd = process.platform === "win32" ? "cmd" : "sh";
    const buildScript = process.platform === "win32" ? `node scripts\\setup-plugins.js && npx expo prebuild --platform android && cd android && .\\gradlew ${gradleTask}` : `node scripts/setup-plugins.js && npx expo prebuild --platform android && cd android && ./gradlew ${gradleTask}`;
    args = process.platform === "win32" ? ["/c", buildScript] : ["-c", buildScript];
    output.push({ type: "info", text: `Starting local build (${profile})...`, timestamp: Date.now() });
    output.push({ type: "info", text: `Gradle task: ${gradleTask}`, timestamp: Date.now() });
  }
  const proc = spawn(cmd, args, {
    cwd: projectRoot,
    shell: false,
    env: { ...process.env, FORCE_COLOR: "0" }
  });
  const buildProcess = { process: proc, output, finished: false };
  const checkAndHandleLicenseError = (text) => {
    allOutputText += text + "\n";
    if (!licenseErrorDetected && detectLicenseError(allOutputText)) {
      licenseErrorDetected = true;
    }
  };
  proc.stdout?.on("data", (data) => {
    const text = data.toString().trim();
    if (text) {
      output.push({ type: "stdout", text, timestamp: Date.now() });
      checkAndHandleLicenseError(text);
    }
  });
  proc.stderr?.on("data", (data) => {
    const text = data.toString().trim();
    if (text) {
      output.push({ type: "stderr", text, timestamp: Date.now() });
      checkAndHandleLicenseError(text);
    }
  });
  proc.on("close", async (code) => {
    if (code !== 0 && licenseErrorDetected && retryCount < 2) {
      output.push({ type: "info", text: "\u26A0\uFE0F SDK/NDK license issue detected. Attempting automatic fix...", timestamp: Date.now() });
      const buildEnv = await loadBuildEnv();
      const sdkPath = buildEnv.android?.sdkPath;
      output.push({ type: "info", text: "Accepting SDK licenses...", timestamp: Date.now() });
      const licenseResult = await acceptSdkLicenses(sdkPath);
      if (licenseResult.success) {
        output.push({ type: "success", text: `\u2713 ${licenseResult.message}`, timestamp: Date.now() });
        output.push({ type: "info", text: "\u{1F504} Restarting build...", timestamp: Date.now() });
        const newBuildProcess = startBuildProcess(type, profile, buildId, retryCount + 1);
        buildProcess.process = newBuildProcess.process;
        const originalOutput = newBuildProcess.output;
        const pollInterval = setInterval(() => {
          while (originalOutput.length > 0) {
            output.push(originalOutput.shift());
          }
          if (newBuildProcess.finished) {
            clearInterval(pollInterval);
            buildProcess.finished = true;
          }
        }, 100);
      } else {
        output.push({ type: "error", text: `\u2717 ${licenseResult.message}`, timestamp: Date.now() });
        output.push({ type: "info", text: 'Manual fix required: Run "sdkmanager --licenses" in your Android SDK directory', timestamp: Date.now() });
        buildProcess.finished = true;
        output.push({ type: "error", text: `Build failed with exit code ${code}`, timestamp: Date.now() });
      }
      return;
    }
    buildProcess.finished = true;
    if (code === 0) {
      output.push({ type: "success", text: "Build completed successfully!", timestamp: Date.now() });
      if (type === "local") {
        const outputPath = profile === "debug" ? "android/app/build/outputs/apk/debug/app-debug.apk" : profile === "release-apk" ? "android/app/build/outputs/apk/release/app-release.apk" : "android/app/build/outputs/bundle/release/app-release.aab";
        output.push({ type: "info", text: `Output: ${outputPath}`, timestamp: Date.now() });
      }
    } else {
      output.push({ type: "error", text: `Build failed with exit code ${code}`, timestamp: Date.now() });
    }
  });
  proc.on("error", (err) => {
    buildProcess.finished = true;
    output.push({ type: "error", text: `Process error: ${err.message}`, timestamp: Date.now() });
  });
  return buildProcess;
}
async function cleanDirectories() {
  const dirsToClean = [
    path.join(projectRoot, "android", "app", ".cxx"),
    path.join(projectRoot, "android", "app", "build"),
    path.join(projectRoot, "android", ".gradle"),
    path.join(projectRoot, "android", "build")
  ];
  const cleaned = [];
  for (const dir of dirsToClean) {
    if (fsSync.existsSync(dir)) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
        cleaned.push(path.basename(dir));
      } catch (e) {
      }
    }
  }
  return cleaned;
}
function startCleanProcess(buildId) {
  const output = [];
  output.push({ type: "info", text: "Cleaning build cache...", timestamp: Date.now() });
  const buildProcess = {
    process: null,
    output,
    finished: false
  };
  (async () => {
    try {
      output.push({ type: "info", text: "Removing .cxx and build directories...", timestamp: Date.now() });
      const cleaned = await cleanDirectories();
      if (cleaned.length > 0) {
        output.push({ type: "stdout", text: `Deleted: ${cleaned.join(", ")}`, timestamp: Date.now() });
      }
      output.push({ type: "info", text: "Stopping Gradle daemon...", timestamp: Date.now() });
      const cmd = process.platform === "win32" ? "cmd" : "sh";
      const cleanScript = process.platform === "win32" ? "cd android && .\\gradlew --stop" : "cd android && ./gradlew --stop";
      const args = process.platform === "win32" ? ["/c", cleanScript] : ["-c", cleanScript];
      const proc = spawn(cmd, args, {
        cwd: projectRoot,
        shell: false,
        env: { ...process.env, FORCE_COLOR: "0" }
      });
      buildProcess.process = proc;
      proc.stdout?.on("data", (data) => {
        const text = data.toString().trim();
        if (text) {
          output.push({ type: "stdout", text, timestamp: Date.now() });
        }
      });
      proc.stderr?.on("data", (data) => {
        const text = data.toString().trim();
        if (text) {
          output.push({ type: "stderr", text, timestamp: Date.now() });
        }
      });
      proc.on("close", (code) => {
        buildProcess.finished = true;
        if (code === 0) {
          output.push({ type: "success", text: "Cache cleaned successfully!", timestamp: Date.now() });
          output.push({ type: "info", text: "Run a build to regenerate native code.", timestamp: Date.now() });
        } else {
          output.push({ type: "success", text: "Build directories cleaned. Gradle daemon may need manual stop.", timestamp: Date.now() });
        }
      });
      proc.on("error", (err) => {
        buildProcess.finished = true;
        output.push({ type: "error", text: `Process error: ${err.message}`, timestamp: Date.now() });
      });
    } catch (err) {
      buildProcess.finished = true;
      output.push({ type: "error", text: `Clean error: ${err.message}`, timestamp: Date.now() });
    }
  })();
  return buildProcess;
}
function startDeepCleanProcess(buildId) {
  const output = [];
  output.push({ type: "info", text: "Starting deep clean...", timestamp: Date.now() });
  const buildProcess = {
    process: null,
    output,
    finished: false
  };
  (async () => {
    try {
      output.push({ type: "info", text: "Stopping Gradle daemon...", timestamp: Date.now() });
      try {
        await execAsync(
          process.platform === "win32" ? "cd android && .\\gradlew --stop" : "cd android && ./gradlew --stop",
          { cwd: projectRoot, timeout: 3e4 }
        );
        output.push({ type: "stdout", text: "Gradle daemon stopped", timestamp: Date.now() });
      } catch {
        output.push({ type: "stdout", text: "Gradle daemon stop skipped (may not be running)", timestamp: Date.now() });
      }
      const androidDir = path.join(projectRoot, "android");
      if (fsSync.existsSync(androidDir)) {
        output.push({ type: "info", text: "Removing android folder...", timestamp: Date.now() });
        await fs.rm(androidDir, { recursive: true, force: true });
        output.push({ type: "stdout", text: "android folder deleted", timestamp: Date.now() });
      }
      output.push({ type: "info", text: "Running expo prebuild...", timestamp: Date.now() });
      const cmd = process.platform === "win32" ? "cmd" : "sh";
      const prebuildScript = "npx expo prebuild --platform android";
      const args = process.platform === "win32" ? ["/c", prebuildScript] : ["-c", prebuildScript];
      const proc = spawn(cmd, args, {
        cwd: projectRoot,
        shell: false,
        env: { ...process.env, FORCE_COLOR: "0" }
      });
      buildProcess.process = proc;
      proc.stdout?.on("data", (data) => {
        const text = data.toString().trim();
        if (text) {
          output.push({ type: "stdout", text, timestamp: Date.now() });
        }
      });
      proc.stderr?.on("data", (data) => {
        const text = data.toString().trim();
        if (text) {
          output.push({ type: "stderr", text, timestamp: Date.now() });
        }
      });
      proc.on("close", async (code) => {
        if (code === 0) {
          try {
            const buildEnv = await loadBuildEnv();
            if (buildEnv.android?.sdkPath) {
              await updateLocalProperties(buildEnv.android.sdkPath);
              output.push({ type: "stdout", text: "local.properties restored", timestamp: Date.now() });
            }
          } catch {
            output.push({ type: "stderr", text: "Warning: Could not restore local.properties", timestamp: Date.now() });
          }
          output.push({ type: "success", text: "Deep clean completed!", timestamp: Date.now() });
        } else {
          output.push({ type: "error", text: `Prebuild failed with exit code ${code}`, timestamp: Date.now() });
        }
        buildProcess.finished = true;
      });
      proc.on("error", (err) => {
        buildProcess.finished = true;
        output.push({ type: "error", text: `Process error: ${err.message}`, timestamp: Date.now() });
      });
    } catch (err) {
      buildProcess.finished = true;
      output.push({ type: "error", text: `Deep clean error: ${err.message}`, timestamp: Date.now() });
    }
  })();
  return buildProcess;
}
function apiPlugin() {
  return {
    name: "config-editor-api",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        if (server.httpServer) {
          setupWebSocketServer(server.httpServer);
          console.log("[api-plugin] Puppeteer Preview WebSocket server initialized");
        }
      });
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/preview-test") {
          return next();
        }
        const testHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AppBridge Test</title>
  <style>
    body { font-family: system-ui; padding: 20px; background: #f8fafc; }
    .test { margin: 10px 0; padding: 10px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; }
    .pass { border-color: #22c55e; background: #f0fdf4; }
    .fail { border-color: #ef4444; background: #fef2f2; }
    .pending { border-color: #f59e0b; background: #fffbeb; }
    button { padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 4px; }
    button:hover { background: #2563eb; }
    pre { background: #1e293b; color: #e2e8f0; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
    h1 { color: #1e293b; }
    .log { max-height: 300px; overflow-y: auto; }
  </style>
</head>
<body>
  <h1>AppBridge Test Page</h1>

  <div id="tests"></div>

  <h2>Manual Tests</h2>
  <button onclick="testCall('getSystemInfo')">call('getSystemInfo')</button>
  <button onclick="testCall('getDeviceInfo')">call('getDeviceInfo')</button>
  <button onclick="testCall('getAppInfo')">call('getAppInfo')</button>
  <button onclick="testCall('unknownAction')">call('unknownAction')</button>

  <h2>Console Log</h2>
  <pre id="log" class="log"></pre>

  ${getPreviewBridgeScript(proxyTargetOrigin || "http://localhost")}

  <script>
    var logEl = document.getElementById('log');
    var testsEl = document.getElementById('tests');

    function log(msg) {
      var time = new Date().toLocaleTimeString();
      logEl.textContent = '[' + time + '] ' + msg + '\\n' + logEl.textContent;
      console.log(msg);
    }

    function addTest(name, status, detail) {
      var div = document.createElement('div');
      div.className = 'test ' + status;
      div.innerHTML = '<strong>' + name + '</strong>: ' + status + (detail ? ' - ' + detail : '');
      testsEl.appendChild(div);
    }

    // Auto tests
    window.addEventListener('load', function() {
      log('Page loaded, starting tests...');

      // Test 1: ReactNativeWebView exists
      if (window.ReactNativeWebView) {
        addTest('ReactNativeWebView exists', 'pass');
        log('\u2713 ReactNativeWebView exists');
      } else {
        addTest('ReactNativeWebView exists', 'fail');
        log('\u2717 ReactNativeWebView missing');
      }

      // Test 2: AppBridge exists
      if (window.AppBridge) {
        addTest('AppBridge exists', 'pass');
        log('\u2713 AppBridge exists');
      } else {
        addTest('AppBridge exists', 'fail');
        log('\u2717 AppBridge missing');
      }

      // Test 3: AppBridge.isApp()
      if (window.AppBridge && window.AppBridge.isApp()) {
        addTest('AppBridge.isApp()', 'pass', 'returns true');
        log('\u2713 AppBridge.isApp() = true');
      } else {
        addTest('AppBridge.isApp()', 'fail', 'returns false');
        log('\u2717 AppBridge.isApp() = false');
      }

      // Test 4: AppBridge.call()
      if (window.AppBridge && window.AppBridge.call) {
        addTest('AppBridge.call() - testing...', 'pending');
        log('Testing AppBridge.call()...');

        window.AppBridge.call('getSystemInfo').then(function(result) {
          log('\u2713 AppBridge.call() response: ' + JSON.stringify(result));
          // Update test status
          var tests = document.querySelectorAll('.test.pending');
          tests.forEach(function(t) {
            if (t.innerHTML.includes('AppBridge.call()')) {
              t.className = 'test pass';
              t.innerHTML = '<strong>AppBridge.call()</strong>: pass - ' + JSON.stringify(result);
            }
          });
        }).catch(function(err) {
          log('\u2717 AppBridge.call() error: ' + err.message);
          var tests = document.querySelectorAll('.test.pending');
          tests.forEach(function(t) {
            if (t.innerHTML.includes('AppBridge.call()')) {
              t.className = 'test fail';
              t.innerHTML = '<strong>AppBridge.call()</strong>: fail - ' + err.message;
            }
          });
        });
      }
    });

    function testCall(action) {
      log('Calling AppBridge.call("' + action + '")...');
      if (!window.AppBridge) {
        log('\u2717 AppBridge not available');
        return;
      }
      window.AppBridge.call(action).then(function(result) {
        log('\u2713 Response: ' + JSON.stringify(result));
      }).catch(function(err) {
        log('\u2717 Error: ' + err.message);
      });
    }
  </script>
</body>
</html>`;
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html");
        res.end(testHtml);
      });
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        if (!url.startsWith("/preview/") && url !== "/preview") {
          return next();
        }
        if (!proxyTargetUrl || !proxyTargetOrigin) {
          console.log("[Preview Proxy] No target configured, returning error page");
          res.statusCode = 503;
          res.setHeader("Content-Type", "text/html");
          res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui; background: #fef2f2; }
    .error { text-align: center; color: #dc2626; }
    .icon { font-size: 48px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="error">
    <div class="icon">\u26A0\uFE0F</div>
    <div>Preview proxy not configured</div>
    <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">Check that baseUrl is set in app config</div>
  </div>
</body>
</html>`);
          return;
        }
        try {
          const proxyPath = url.replace(/^\/preview\/?/, "/");
          const targetUrl = new URL(proxyPath, proxyTargetOrigin).href;
          console.log("[Preview Proxy]", req.method, url, "->", targetUrl);
          const headers = {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            "Accept": req.headers.accept || "*/*",
            "Accept-Language": req.headers["accept-language"] || "en-US,en;q=0.9",
            "Accept-Encoding": "identity"
            // Don't accept compressed to allow modification
          };
          if (req.headers.cookie) {
            headers["Cookie"] = req.headers.cookie;
          }
          if (req.headers.referer) {
            headers["Referer"] = proxyTargetOrigin;
          }
          const nextHeaders = [
            "rsc",
            "next-router-state-tree",
            "next-router-prefetch",
            "next-router-segment-prefetch",
            "next-url"
          ];
          for (const h of nextHeaders) {
            const value = req.headers[h];
            if (value) {
              headers[h] = Array.isArray(value) ? value[0] : value;
              console.log("[Preview Proxy] Forwarding header:", h, "=", headers[h]);
            }
          }
          const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            redirect: "follow"
            // Follow redirects automatically
          });
          const respHeaders = {};
          response.headers.forEach((v, k) => {
            respHeaders[k] = v;
          });
          console.log("[Preview Proxy] Response:", response.status, JSON.stringify(respHeaders, null, 2));
          res.statusCode = response.status;
          const contentType = response.headers.get("content-type") || "application/octet-stream";
          res.setHeader("Content-Type", contentType);
          const safeHeaders = ["content-language", "cache-control", "expires", "last-modified", "etag"];
          for (const header of safeHeaders) {
            const value = response.headers.get(header);
            if (value) res.setHeader(header, value);
          }
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "*");
          const body = await response.arrayBuffer();
          let content = Buffer.from(body);
          const originEscaped = proxyTargetOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const rewriteUrlsInText = (text) => {
            text = text.replace(
              new RegExp(`(["'])(${originEscaped})(/[^"']*)(["'])`, "g"),
              "$1/preview$3$4"
            );
            const hostPattern = proxyTargetOrigin.replace(/^https?:/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            text = text.replace(
              new RegExp(`(["'])(${hostPattern})(/[^"']*)(["'])`, "g"),
              "$1/preview$3$4"
            );
            return text;
          };
          if (contentType.includes("text/html")) {
            let html = content.toString("utf-8");
            console.log("[Preview Proxy] Processing HTML:", html.length, "chars");
            html = html.replace(/<meta[^>]*http-equiv=["']?content-security-policy["']?[^>]*>/gi, "");
            const bridgeScript = getPreviewBridgeScript(proxyTargetOrigin);
            const baseTag = `<base href="/preview/">`;
            const headMatch = html.match(/<head[^>]*>/i);
            if (headMatch && headMatch.index !== void 0) {
              const insertPos = headMatch.index + headMatch[0].length;
              html = html.slice(0, insertPos) + baseTag + bridgeScript + html.slice(insertPos);
            } else {
              html = baseTag + bridgeScript + html;
            }
            html = html.replace(
              new RegExp(`(href|src|action|srcset)=["'](${originEscaped})(/[^"']*)["']`, "gi"),
              '$1="/preview$3"'
            );
            html = html.replace(
              /(href|src|action)=["'](?!\/\/)(\/[^"']*?)["']/gi,
              '$1="/preview$2"'
            );
            html = html.replace(
              /srcset=["']([^"']+)["']/gi,
              (match, srcset) => {
                const rewritten = srcset.replace(/(?:^|,\s*)(\/[^\s,]+)/g, (m, path2) => {
                  return m.replace(path2, "/preview" + path2);
                });
                return `srcset="${rewritten}"`;
              }
            );
            html = html.replace(
              /(<script\s+id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/gi,
              (match, openTag, jsonContent, closeTag) => {
                try {
                  const data = JSON.parse(jsonContent);
                  if (data.page && data.page.startsWith("/preview")) {
                    data.page = data.page.replace(/^\/preview/, "") || "/";
                  }
                  if (data.query) {
                    for (const key of Object.keys(data.query)) {
                      if (typeof data.query[key] === "string" && data.query[key].startsWith("/preview")) {
                        data.query[key] = data.query[key].replace(/^\/preview/, "") || "/";
                      }
                    }
                  }
                  if (data.assetPrefix && data.assetPrefix.startsWith("/preview")) {
                    data.assetPrefix = data.assetPrefix.replace(/^\/preview/, "");
                  }
                  console.log("[Preview Proxy] Modified __NEXT_DATA__ page:", data.page);
                  return openTag + JSON.stringify(data) + closeTag;
                } catch (e) {
                  console.warn("[Preview Proxy] Failed to parse __NEXT_DATA__:", e);
                  return match;
                }
              }
            );
            content = Buffer.from(html, "utf-8");
          } else if (contentType.includes("text/x-component") || req.headers["rsc"]) {
            console.log("[Preview Proxy] RSC response - not modifying");
          } else if (contentType.includes("javascript") || contentType.includes("application/json")) {
            let js = content.toString("utf-8");
            js = rewriteUrlsInText(js);
            js = js.replace(
              /["'](\/(?:_next|static|assets|api|images|fonts|css|js)\/[^"']+)["']/g,
              '"/preview$1"'
            );
            content = Buffer.from(js, "utf-8");
          } else if (contentType.includes("text/css")) {
            let css = content.toString("utf-8");
            css = css.replace(
              /url\(["']?(\/[^)"']+)["']?\)/gi,
              'url("/preview$1")'
            );
            css = rewriteUrlsInText(css);
            content = Buffer.from(css, "utf-8");
          }
          res.setHeader("Content-Length", content.length);
          res.end(content);
        } catch (error) {
          console.error("[Preview Proxy] Error:", error.message);
          res.statusCode = 502;
          res.setHeader("Content-Type", "text/plain");
          res.end("Proxy error: " + error.message);
        }
      });
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        if (!url.startsWith("/api/")) {
          return next();
        }
        try {
          const configGetMatch = url.match(/^\/api\/config\/(app|theme|plugins|build-env)$/);
          if (configGetMatch && req.method === "GET") {
            const type = configGetMatch[1];
            const filename = CONFIG_FILES[type];
            const filePath = path.join(constantsDir, filename);
            try {
              const content = await fs.readFile(filePath, "utf-8");
              sendJson(res, 200, JSON.parse(content));
            } catch {
              sendJson(res, 500, { error: `Failed to read ${filename}` });
            }
            return;
          }
          if (configGetMatch && req.method === "PUT") {
            const type = configGetMatch[1];
            const filename = CONFIG_FILES[type];
            const filePath = path.join(constantsDir, filename);
            const body = await readBody(req);
            if (!body || typeof body !== "object" || Array.isArray(body)) {
              sendJson(res, 400, { error: "Request body must be a valid JSON object" });
              return;
            }
            if (type === "plugins") {
              const validation = validatePluginNamespaces(body);
              if (!validation.valid) {
                sendJson(res, 400, {
                  error: "Namespace conflict detected",
                  conflicts: validation.conflicts
                });
                return;
              }
            }
            try {
              if (type === "build-env" && body.android?.sdkPath) {
                const originalPath = body.android.sdkPath;
                const pathValidation = validateSdkPath(originalPath);
                if (!pathValidation.valid) {
                  const correctedPath = inferSdkRoot(originalPath);
                  body.android.sdkPath = correctedPath;
                  console.log(`[api-plugin] SDK path auto-corrected: ${originalPath} -> ${correctedPath}`);
                }
              }
              const content = JSON.stringify(body, null, 2) + "\n";
              await fs.writeFile(filePath, content, "utf-8");
              if (type === "plugins") {
                await regeneratePluginRegistry();
              }
              if (type === "build-env" && body.android?.sdkPath) {
                try {
                  await updateLocalProperties(body.android.sdkPath);
                } catch (e) {
                  console.log("[api-plugin] Could not update local.properties:", e);
                }
              }
              sendJson(res, 200, { success: true, data: body });
            } catch {
              sendJson(res, 500, { error: `Failed to write ${filename}` });
            }
            return;
          }
          if (url === "/api/plugins/installed" && req.method === "GET") {
            console.log("[api-plugin] Fetching installed packages...");
            const packages = await getInstalledPackages();
            console.log("[api-plugin] Found", packages.length, "installed packages");
            const rnwwPlugins = packages.filter((p) => p.name.startsWith("rnww-plugin-"));
            console.log("[api-plugin] RNWW plugins:", rnwwPlugins.map((p) => p.name));
            const sorted = packages.sort((a, b) => {
              const aIsRnww = a.name.startsWith("rnww-plugin-");
              const bIsRnww = b.name.startsWith("rnww-plugin-");
              if (aIsRnww && !bIsRnww) return -1;
              if (!aIsRnww && bIsRnww) return 1;
              return a.name.localeCompare(b.name);
            });
            sendJson(res, 200, sorted);
            return;
          }
          if (url.startsWith("/api/plugins/search") && req.method === "GET") {
            console.log("[api-plugin] Search request URL:", url);
            const urlObj = new URL(url, "http://localhost");
            const query = urlObj.searchParams.get("q") || "rnww-plugin";
            console.log("[api-plugin] Parsed query:", query);
            if (!isValidSearchQuery(query)) {
              console.log("[api-plugin] Query validation failed");
              sendJson(res, 400, { error: "Invalid search query" });
              return;
            }
            const results = await searchNpmPackages(query);
            console.log("[api-plugin] Returning", results.length, "results");
            sendJson(res, 200, results);
            return;
          }
          if (url === "/api/plugins/install" && req.method === "POST") {
            const { name, version } = await readBody(req);
            if (!name || !isValidPackageName(name)) {
              sendJson(res, 400, { error: "Invalid package name" });
              return;
            }
            const result = await installPackage(name, version);
            if (result.success) {
              sendJson(res, 200, { success: true });
            } else {
              sendJson(res, 500, { error: result.error });
            }
            return;
          }
          if (url === "/api/plugins/uninstall" && req.method === "POST") {
            const { name } = await readBody(req);
            if (!name || !isValidPackageName(name)) {
              sendJson(res, 400, { error: "Invalid package name" });
              return;
            }
            const result = await uninstallPackage(name);
            if (result.success) {
              sendJson(res, 200, { success: true });
            } else {
              sendJson(res, 500, { error: result.error });
            }
            return;
          }
          if (url === "/api/plugins/scan" && req.method === "GET") {
            try {
              const entries = await fs.readdir(bridgesDir, { withFileTypes: true });
              const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => `./${entry.name}`);
              sendJson(res, 200, folders);
            } catch {
              sendJson(res, 500, { error: "Failed to scan bridges folder" });
            }
            return;
          }
          if (url === "/api/plugins/validate" && req.method === "POST") {
            const body = await readBody(req);
            const validation = validatePluginNamespaces(body);
            sendJson(res, 200, validation);
            return;
          }
          if (url === "/api/build/env-check" && req.method === "GET") {
            const checks = await checkBuildEnvironment();
            sendJson(res, 200, { checks });
            return;
          }
          if (url === "/api/build/accept-licenses" && req.method === "POST") {
            try {
              const buildEnv = await loadBuildEnv();
              const sdkPath = buildEnv.android?.sdkPath;
              const result = await acceptSdkLicenses(sdkPath);
              if (result.success) {
                sendJson(res, 200, { success: true, message: result.message });
              } else {
                sendJson(res, 500, { error: result.message });
              }
            } catch (error) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }
          if (url === "/api/build/start" && req.method === "POST") {
            const { type, profile } = await readBody(req);
            const buildId = `build-${Date.now()}`;
            try {
              const buildProcess = startBuildProcess(type, profile, buildId);
              buildProcesses.set(buildId, buildProcess);
              sendJson(res, 200, { buildId });
            } catch (error) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }
          const outputMatch = url.match(/^\/api\/build\/output\/([a-z0-9-]+)$/);
          if (outputMatch && req.method === "GET") {
            const buildId = outputMatch[1];
            const build = buildProcesses.get(buildId);
            if (!build) {
              sendJson(res, 404, { error: "Build not found" });
              return;
            }
            const lines = build.output.splice(0, build.output.length);
            sendJson(res, 200, { lines, finished: build.finished });
            if (build.finished) {
              setTimeout(() => buildProcesses.delete(buildId), 6e4);
            }
            return;
          }
          const cancelMatch = url.match(/^\/api\/build\/cancel\/([a-z0-9-]+)$/);
          if (cancelMatch && req.method === "POST") {
            const buildId = cancelMatch[1];
            const build = buildProcesses.get(buildId);
            if (build && !build.finished) {
              build.process.kill();
              build.finished = true;
              build.output.push({ type: "info", text: "Build cancelled by user", timestamp: Date.now() });
            }
            sendJson(res, 200, { success: true });
            return;
          }
          if (url === "/api/build/clean" && req.method === "POST") {
            const buildId = `clean-${Date.now()}`;
            try {
              const buildProcess = startCleanProcess(buildId);
              buildProcesses.set(buildId, buildProcess);
              sendJson(res, 200, { buildId });
            } catch (error) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }
          if (url === "/api/build/deep-clean" && req.method === "POST") {
            const buildId = `deepclean-${Date.now()}`;
            try {
              const buildProcess = startDeepCleanProcess(buildId);
              buildProcesses.set(buildId, buildProcess);
              sendJson(res, 200, { buildId });
            } catch (error) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }
          if (url === "/api/build/keystore" && req.method === "GET") {
            const keystorePaths = [
              path.join(projectRoot, "android", "app", "release.keystore"),
              path.join(projectRoot, "android", "app", "my-release-key.keystore"),
              path.join(projectRoot, "android", "keystores", "release.keystore")
            ];
            let foundPath = null;
            for (const p of keystorePaths) {
              if (fsSync.existsSync(p)) {
                foundPath = p;
                break;
              }
            }
            let hasSigningConfig = false;
            const gradlePropsPath = path.join(projectRoot, "android", "gradle.properties");
            if (fsSync.existsSync(gradlePropsPath)) {
              const content = fsSync.readFileSync(gradlePropsPath, "utf-8");
              hasSigningConfig = content.includes("MYAPP_RELEASE_STORE_PASSWORD");
            }
            sendJson(res, 200, {
              exists: !!foundPath,
              path: foundPath,
              hasSigningConfig
            });
            return;
          }
          if (url === "/api/build/open-folder" && req.method === "POST") {
            const { filePath } = await readBody(req);
            if (!filePath) {
              sendJson(res, 400, { error: "filePath is required" });
              return;
            }
            const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
            let folderPath = absolutePath;
            if (fsSync.existsSync(absolutePath) && fsSync.statSync(absolutePath).isFile()) {
              folderPath = path.dirname(absolutePath);
            }
            if (!fsSync.existsSync(folderPath)) {
              sendJson(res, 404, { error: "Folder not found" });
              return;
            }
            try {
              const cmd = process.platform === "win32" ? `explorer "${folderPath}"` : process.platform === "darwin" ? `open "${folderPath}"` : `xdg-open "${folderPath}"`;
              await execAsync(cmd);
              sendJson(res, 200, { success: true });
            } catch (error) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }
          if (url.startsWith("/api/build/download") && req.method === "GET") {
            const urlObj = new URL(url, "http://localhost");
            const filePath = urlObj.searchParams.get("path");
            if (!filePath) {
              sendJson(res, 400, { error: "path parameter is required" });
              return;
            }
            const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
            const normalizedPath = path.normalize(absolutePath);
            if (!normalizedPath.startsWith(projectRoot)) {
              sendJson(res, 403, { error: "Access denied" });
              return;
            }
            if (!fsSync.existsSync(absolutePath)) {
              sendJson(res, 404, { error: "File not found" });
              return;
            }
            const stat = fsSync.statSync(absolutePath);
            const filename = path.basename(absolutePath);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.setHeader("Content-Length", stat.size);
            const stream = fsSync.createReadStream(absolutePath);
            stream.pipe(res);
            return;
          }
          if (url === "/api/build/output-info" && req.method === "GET") {
            const outputs = [];
            const outputPaths = [
              { type: "Debug APK", path: "android/app/build/outputs/apk/debug/app-debug.apk" },
              { type: "Release APK", path: "android/app/build/outputs/apk/release/app-release.apk" },
              { type: "Release AAB", path: "android/app/build/outputs/bundle/release/app-release.aab" }
            ];
            for (const item of outputPaths) {
              const absolutePath = path.join(projectRoot, item.path);
              if (fsSync.existsSync(absolutePath)) {
                const stat = fsSync.statSync(absolutePath);
                outputs.push({
                  type: item.type,
                  path: item.path,
                  exists: true,
                  size: stat.size,
                  modified: stat.mtimeMs
                });
              } else {
                outputs.push({
                  type: item.type,
                  path: item.path,
                  exists: false
                });
              }
            }
            sendJson(res, 200, { outputs });
            return;
          }
          if (url === "/api/build/keystore" && req.method === "POST") {
            const { alias, storePassword, keyPassword, validity, dname } = await readBody(req);
            if (!alias || !storePassword || storePassword.length < 6) {
              sendJson(res, 400, { error: "Invalid parameters. Alias required, password must be at least 6 characters." });
              return;
            }
            const androidAppDir = path.join(projectRoot, "android", "app");
            if (!fsSync.existsSync(androidAppDir)) {
              sendJson(res, 400, { error: "android/app folder not found. Run expo prebuild first." });
              return;
            }
            const keystorePath = path.join(androidAppDir, "release.keystore");
            const finalKeyPassword = keyPassword || storePassword;
            const finalValidity = validity || 1e4;
            const finalDname = dname || "CN=Unknown, OU=Unknown, O=Unknown, L=Unknown, ST=Unknown, C=US";
            try {
              const keytoolCmd = `keytool -genkey -v -keystore "${keystorePath}" -alias "${alias}" -keyalg RSA -keysize 2048 -validity ${finalValidity} -storepass "${storePassword}" -keypass "${finalKeyPassword}" -dname "${finalDname}"`;
              await execAsync(keytoolCmd, { cwd: projectRoot, timeout: 3e4 });
              const gradlePropsPath = path.join(projectRoot, "android", "gradle.properties");
              let gradleProps = "";
              if (fsSync.existsSync(gradlePropsPath)) {
                gradleProps = fsSync.readFileSync(gradlePropsPath, "utf-8");
                gradleProps = gradleProps.split("\n").filter((line) => !line.startsWith("MYAPP_RELEASE_")).join("\n");
              }
              const signingConfig = `
# Release Keystore settings (auto-generated)
MYAPP_RELEASE_STORE_FILE=release.keystore
MYAPP_RELEASE_KEY_ALIAS=${alias}
MYAPP_RELEASE_STORE_PASSWORD=${storePassword}
MYAPP_RELEASE_KEY_PASSWORD=${finalKeyPassword}
`;
              gradleProps = gradleProps.trimEnd() + "\n" + signingConfig;
              fsSync.writeFileSync(gradlePropsPath, gradleProps, "utf-8");
              sendJson(res, 200, {
                success: true,
                path: keystorePath,
                message: "Keystore created and gradle.properties updated"
              });
            } catch (error) {
              sendJson(res, 500, { error: `Keystore generation failed: ${error.message}` });
            }
            return;
          }
          if (url === "/api/proxy/config" && req.method === "GET") {
            sendJson(res, 200, { targetUrl: proxyTargetUrl });
            return;
          }
          if (url === "/api/proxy/diagnose" && req.method === "GET") {
            if (!proxyTargetUrl || !proxyTargetOrigin) {
              sendJson(res, 200, {
                status: "not_configured",
                message: "Proxy target URL not set"
              });
              return;
            }
            try {
              console.log("[Diagnose] Testing connection to:", proxyTargetUrl);
              const testResponse = await fetch(proxyTargetUrl, {
                method: "GET",
                headers: {
                  "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36",
                  "Accept": "text/html",
                  "Accept-Encoding": "identity"
                },
                redirect: "follow"
              });
              const headers = {};
              testResponse.headers.forEach((v, k) => {
                headers[k] = v;
              });
              const body = await testResponse.text();
              const bodyPreview = body.slice(0, 500);
              const issues = [];
              if (headers["content-security-policy"]) {
                issues.push("CSP header present - may block scripts");
              }
              if (headers["x-frame-options"]) {
                issues.push("X-Frame-Options present - may block iframe");
              }
              if (!body.includes("<html") && !body.includes("<HTML")) {
                issues.push("Response may not be HTML");
              }
              if (body.includes("<!DOCTYPE html>") && body.length < 1e3) {
                issues.push("Very short HTML - might be error page or redirect");
              }
              sendJson(res, 200, {
                status: "ok",
                targetUrl: proxyTargetUrl,
                targetOrigin: proxyTargetOrigin,
                response: {
                  status: testResponse.status,
                  statusText: testResponse.statusText,
                  headers,
                  bodyLength: body.length,
                  bodyPreview,
                  issues
                }
              });
            } catch (error) {
              sendJson(res, 200, {
                status: "error",
                targetUrl: proxyTargetUrl,
                error: error.message
              });
            }
            return;
          }
          if (url === "/api/proxy/config" && req.method === "POST") {
            const { targetUrl } = await readBody(req);
            console.log("[api-plugin] Proxy config request:", targetUrl);
            if (targetUrl) {
              try {
                const parsed = new URL(targetUrl);
                if (!["http:", "https:"].includes(parsed.protocol)) {
                  sendJson(res, 400, { error: "Only http/https URLs allowed" });
                  return;
                }
                proxyTargetUrl = targetUrl;
                proxyTargetOrigin = parsed.origin;
                console.log("[api-plugin] \u2713 Proxy configured:", proxyTargetUrl, "(origin:", proxyTargetOrigin, ")");
                sendJson(res, 200, { success: true, targetUrl: proxyTargetUrl });
              } catch {
                sendJson(res, 400, { error: "Invalid URL" });
              }
            } else {
              proxyTargetUrl = null;
              proxyTargetOrigin = null;
              console.log("[api-plugin] Proxy cleared");
              sendJson(res, 200, { success: true, targetUrl: null });
            }
            return;
          }
          if (url === "/api/adb/check" && req.method === "GET") {
            try {
              const { stdout } = await execAsync("adb version", { timeout: 5e3 });
              const versionMatch = stdout.match(/Android Debug Bridge version ([\d.]+)/);
              sendJson(res, 200, {
                adbAvailable: true,
                adbVersion: versionMatch ? versionMatch[1] : "unknown"
              });
            } catch (error) {
              sendJson(res, 200, {
                adbAvailable: false,
                error: error.message || "ADB not found"
              });
            }
            return;
          }
          if (url === "/api/adb/devices" && req.method === "GET") {
            try {
              const { stdout } = await execAsync("adb devices -l", { timeout: 1e4 });
              const lines = stdout.split("\n").filter((l) => l.trim() && !l.startsWith("List of"));
              const devices = lines.map((line) => {
                const parts = line.trim().split(/\s+/);
                const id = parts[0];
                const status = parts[1];
                const isWireless = id.includes(":");
                const info = {};
                for (let i = 2; i < parts.length; i++) {
                  const [key, value] = parts[i].split(":");
                  if (key && value) {
                    info[key] = value;
                  }
                }
                return {
                  id,
                  status,
                  isWireless,
                  model: info["model"],
                  product: info["product"],
                  device: info["device"]
                };
              }).filter((d) => d.id);
              sendJson(res, 200, { devices });
            } catch (error) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }
          if (url === "/api/adb/pair" && req.method === "POST") {
            const { address, code } = await readBody(req);
            if (!address) {
              sendJson(res, 400, { error: "Address is required" });
              return;
            }
            try {
              const pairProcess = spawn("adb", ["pair", address], {
                stdio: ["pipe", "pipe", "pipe"]
              });
              let stdout = "";
              let stderr = "";
              pairProcess.stdout.on("data", (data) => {
                stdout += data.toString();
              });
              pairProcess.stderr.on("data", (data) => {
                stderr += data.toString();
              });
              if (code) {
                setTimeout(() => {
                  pairProcess.stdin.write(code + "\n");
                  pairProcess.stdin.end();
                }, 500);
              }
              const exitCode = await new Promise((resolve) => {
                pairProcess.on("close", resolve);
                setTimeout(() => {
                  pairProcess.kill();
                  resolve(-1);
                }, 3e4);
              });
              const output = stdout + stderr;
              if (exitCode === 0 || output.toLowerCase().includes("success")) {
                sendJson(res, 200, { success: true });
              } else {
                sendJson(res, 200, { success: false, error: output.trim() || "Pairing failed" });
              }
            } catch (error) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }
          if (url === "/api/adb/connect" && req.method === "POST") {
            const { address } = await readBody(req);
            if (!address) {
              sendJson(res, 400, { error: "Address is required" });
              return;
            }
            try {
              const { stdout, stderr } = await execAsync(`adb connect ${address}`, { timeout: 15e3 });
              const output = stdout + stderr;
              if (output.includes("connected") && !output.includes("cannot")) {
                let device = address;
                try {
                  const { stdout: modelOut } = await execAsync(`adb -s ${address} shell getprop ro.product.model`, { timeout: 5e3 });
                  device = modelOut.trim() || address;
                } catch {
                }
                sendJson(res, 200, { success: true, device });
              } else {
                sendJson(res, 200, { success: false, error: output.trim() || "Connection failed" });
              }
            } catch (error) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }
          if (url === "/api/adb/disconnect" && req.method === "POST") {
            const { address } = await readBody(req);
            try {
              const cmd = address ? `adb disconnect ${address}` : "adb disconnect";
              await execAsync(cmd, { timeout: 1e4 });
              sendJson(res, 200, { success: true });
            } catch (error) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }
          if (url === "/api/adb/tcpip" && req.method === "POST") {
            const { port = "5555" } = await readBody(req);
            try {
              const { stdout: devicesOut } = await execAsync("adb devices", { timeout: 5e3 });
              const usbDevices = devicesOut.split("\n").filter((l) => l.includes("device") && !l.includes(":") && !l.startsWith("List"));
              if (usbDevices.length === 0) {
                sendJson(res, 200, { success: false, error: "No USB device connected" });
                return;
              }
              const { stdout: ipOut } = await execAsync("adb shell ip route", { timeout: 5e3 });
              const ipMatch = ipOut.match(/wlan.*src\s+(\d+\.\d+\.\d+\.\d+)/);
              let deviceIp = "";
              if (ipMatch) {
                deviceIp = ipMatch[1];
              } else {
                const { stdout: ipOut2 } = await execAsync('adb shell "ip addr show wlan0 | grep inet"', { timeout: 5e3 });
                const ipMatch2 = ipOut2.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
                if (ipMatch2) {
                  deviceIp = ipMatch2[1];
                }
              }
              if (!deviceIp) {
                sendJson(res, 200, { success: false, error: "Cannot find device WiFi IP" });
                return;
              }
              await execAsync(`adb tcpip ${port}`, { timeout: 1e4 });
              await new Promise((r) => setTimeout(r, 2e3));
              const address = `${deviceIp}:${port}`;
              const { stdout: connectOut } = await execAsync(`adb connect ${address}`, { timeout: 1e4 });
              if (connectOut.includes("connected")) {
                sendJson(res, 200, { success: true, address });
              } else {
                sendJson(res, 200, { success: false, error: connectOut.trim() || "Connection failed", address });
              }
            } catch (error) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }
          if (url.startsWith("/api/adb/logcat") && req.method === "GET") {
            const urlObj = new URL(url, "http://localhost");
            const device = urlObj.searchParams.get("device");
            const logType = urlObj.searchParams.get("type") || "native";
            if (!device) {
              sendJson(res, 400, { error: "device parameter is required" });
              return;
            }
            const sessionKey = getLogcatSessionKey(device, logType);
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader("Transfer-Encoding", "chunked");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.setHeader("X-Content-Type-Options", "nosniff");
            let session2 = logcatSessions.get(sessionKey);
            if (session2) {
              console.log(`[Logcat] Reusing existing session: ${sessionKey}`);
              cancelLogcatCleanup(sessionKey);
              session2.clients.add(res);
              const removeClient = () => {
                session2?.clients.delete(res);
                if (session2?.clients.size === 0) {
                  scheduleLogcatCleanup(sessionKey);
                }
              };
              req.on("close", removeClient);
              req.on("aborted", removeClient);
              return;
            }
            let filter = "";
            switch (logType) {
              case "native":
                filter = "ReactNative:V ReactNativeJS:V expo:V ExpoModulesCore:V *:S";
                break;
              case "webview":
                filter = "chromium:V SBrowser:V SBrowserConsole:V WebViewConsole:V cr_console:V *:S";
                break;
              case "all":
                filter = "ReactNative:V ReactNativeJS:V expo:V chromium:V SBrowser:V SBrowserConsole:V WebViewConsole:V cr_console:V *:S";
                break;
            }
            try {
              await execAsync(`adb -s ${device} logcat -c`, { timeout: 5e3 }).catch(() => {
              });
              const isWindows = process.platform === "win32";
              const cmd = `adb -s ${device} logcat -v time ${filter}`;
              console.log("[Logcat] Starting new session:", sessionKey);
              const logcatProcess = isWindows ? spawn("cmd", ["/c", cmd], { stdio: ["ignore", "pipe", "pipe"] }) : spawn("adb", ["-s", device, "logcat", "-v", "time", ...filter.split(" ")], { stdio: ["ignore", "pipe", "pipe"] });
              session2 = {
                process: logcatProcess,
                device,
                logType,
                clients: /* @__PURE__ */ new Set([res]),
                cleanupTimer: null
              };
              logcatSessions.set(sessionKey, session2);
              logcatProcess.stdout.on("data", (data) => {
                const currentSession = logcatSessions.get(sessionKey);
                if (!currentSession) return;
                currentSession.clients.forEach((client) => {
                  if (!client.writableEnded) {
                    client.write(data);
                  }
                });
              });
              logcatProcess.stderr.on("data", (data) => {
                const currentSession = logcatSessions.get(sessionKey);
                if (!currentSession) return;
                currentSession.clients.forEach((client) => {
                  if (!client.writableEnded) {
                    client.write(data);
                  }
                });
              });
              logcatProcess.on("error", (err) => {
                console.error("[Logcat] Process error:", err);
                cleanupLogcatSession(sessionKey);
              });
              logcatProcess.on("close", (code) => {
                console.log(`[Logcat] Process closed with code: ${code}`);
                const currentSession = logcatSessions.get(sessionKey);
                if (currentSession) {
                  currentSession.clients.forEach((client) => {
                    if (!client.writableEnded) {
                      client.end();
                    }
                  });
                  logcatSessions.delete(sessionKey);
                }
              });
              const removeClient = () => {
                const currentSession = logcatSessions.get(sessionKey);
                if (currentSession) {
                  currentSession.clients.delete(res);
                  if (currentSession.clients.size === 0) {
                    scheduleLogcatCleanup(sessionKey);
                  }
                }
              };
              req.on("close", removeClient);
              req.on("aborted", removeClient);
            } catch (error) {
              console.error("[Logcat] Error:", error);
              sendJson(res, 500, { error: error.message });
            }
            return;
          }
          sendJson(res, 404, { error: "Not found" });
        } catch (error) {
          console.error("API error:", error);
          sendJson(res, 500, { error: "Internal server error" });
        }
      });
    }
  };
}

// vite.config.ts
var vite_config_default = defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    port: 5173,
    host: true,
    // IPv4 + IPv6 모두 바인딩
    open: true
  },
  preview: {
    port: 5173,
    host: true,
    open: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAidml0ZS9hcGktcGx1Z2luLnRzIiwgInZpdGUvcHVwcGV0ZWVyLXByZXZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxQcm9qZWN0c1xcXFxSTi1FeHBvLVdlYkFwcC1XcmFwcGVyLVRlbXBsYXRlXFxcXHRvb2xzXFxcXGNvbmZpZy1lZGl0b3JcXFxcY2xpZW50XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJFOlxcXFxQcm9qZWN0c1xcXFxSTi1FeHBvLVdlYkFwcC1XcmFwcGVyLVRlbXBsYXRlXFxcXHRvb2xzXFxcXGNvbmZpZy1lZGl0b3JcXFxcY2xpZW50XFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9FOi9Qcm9qZWN0cy9STi1FeHBvLVdlYkFwcC1XcmFwcGVyLVRlbXBsYXRlL3Rvb2xzL2NvbmZpZy1lZGl0b3IvY2xpZW50L3ZpdGUuY29uZmlnLnRzXCI7Ly8gdG9vbHMvY29uZmlnLWVkaXRvci9jbGllbnQvdml0ZS5jb25maWcudHNcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCB7IGFwaVBsdWdpbiB9IGZyb20gJy4vdml0ZS9hcGktcGx1Z2luJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCksIGFwaVBsdWdpbigpXSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBob3N0OiB0cnVlLCAgLy8gSVB2NCArIElQdjYgXHVCQUE4XHVCNDUwIFx1QkMxNFx1Qzc3OFx1QjUyOVxuICAgIG9wZW46IHRydWVcbiAgfSxcbiAgcHJldmlldzoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgaG9zdDogdHJ1ZSxcbiAgICBvcGVuOiB0cnVlXG4gIH1cbn0pO1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxQcm9qZWN0c1xcXFxSTi1FeHBvLVdlYkFwcC1XcmFwcGVyLVRlbXBsYXRlXFxcXHRvb2xzXFxcXGNvbmZpZy1lZGl0b3JcXFxcY2xpZW50XFxcXHZpdGVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkU6XFxcXFByb2plY3RzXFxcXFJOLUV4cG8tV2ViQXBwLVdyYXBwZXItVGVtcGxhdGVcXFxcdG9vbHNcXFxcY29uZmlnLWVkaXRvclxcXFxjbGllbnRcXFxcdml0ZVxcXFxhcGktcGx1Z2luLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9FOi9Qcm9qZWN0cy9STi1FeHBvLVdlYkFwcC1XcmFwcGVyLVRlbXBsYXRlL3Rvb2xzL2NvbmZpZy1lZGl0b3IvY2xpZW50L3ZpdGUvYXBpLXBsdWdpbi50c1wiOy8vIHRvb2xzL2NvbmZpZy1lZGl0b3Ivdml0ZS9hcGktcGx1Z2luLnRzXHJcbi8vIFZpdGUgcGx1Z2luIHRvIGhhbmRsZSBBUEkgcm91dGVzIGRpcmVjdGx5IHdpdGhvdXQgc2VwYXJhdGUgRXhwcmVzcyBzZXJ2ZXJcclxuXHJcbmltcG9ydCB0eXBlIHsgUGx1Z2luLCBWaXRlRGV2U2VydmVyIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCBmcyBmcm9tICdmcy9wcm9taXNlcyc7XHJcbmltcG9ydCBmc1N5bmMgZnJvbSAnZnMnO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgZXhlYywgc3Bhd24sIENoaWxkUHJvY2VzcyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xyXG5pbXBvcnQgeyBwcm9taXNpZnkgfSBmcm9tICd1dGlsJztcclxuaW1wb3J0IHtcclxuICBzZXR1cFdlYlNvY2tldFNlcnZlcixcclxuICBzdGFydFByZXZpZXcsXHJcbiAgc3RvcFByZXZpZXcsXHJcbiAgcmVmcmVzaFByZXZpZXcsXHJcbiAgbmF2aWdhdGVQcmV2aWV3LFxyXG4gIGdldFByZXZpZXdTdGF0dXNcclxufSBmcm9tICcuL3B1cHBldGVlci1wcmV2aWV3JztcclxuXHJcbmNvbnN0IGV4ZWNBc3luYyA9IHByb21pc2lmeShleGVjKTtcclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gTG9nY2F0IFx1RDUwNFx1Qjg1Q1x1QzEzOFx1QzJBNCBcdUFEMDBcdUI5QUNcdUM3OTBcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5pbnRlcmZhY2UgTG9nY2F0U2Vzc2lvbiB7XHJcbiAgcHJvY2VzczogQ2hpbGRQcm9jZXNzO1xyXG4gIGRldmljZTogc3RyaW5nO1xyXG4gIGxvZ1R5cGU6IHN0cmluZztcclxuICBjbGllbnRzOiBTZXQ8YW55PjsgLy8gSFRUUCByZXNwb25zZSBvYmplY3RzXHJcbiAgY2xlYW51cFRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGw7XHJcbn1cclxuXHJcbmNvbnN0IGxvZ2NhdFNlc3Npb25zID0gbmV3IE1hcDxzdHJpbmcsIExvZ2NhdFNlc3Npb24+KCk7XHJcbmNvbnN0IExPR0NBVF9DTEVBTlVQX0RFTEFZID0gNTAwMDsgLy8gNVx1Q0QwOCBcdUQ2QzQgXHVDODE1XHVCOUFDXHJcblxyXG5mdW5jdGlvbiBnZXRMb2djYXRTZXNzaW9uS2V5KGRldmljZTogc3RyaW5nLCBsb2dUeXBlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIHJldHVybiBgJHtkZXZpY2V9OiR7bG9nVHlwZX1gO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjbGVhbnVwTG9nY2F0U2Vzc2lvbihrZXk6IHN0cmluZykge1xyXG4gIGNvbnN0IHNlc3Npb24gPSBsb2djYXRTZXNzaW9ucy5nZXQoa2V5KTtcclxuICBpZiAoIXNlc3Npb24pIHJldHVybjtcclxuXHJcbiAgaWYgKHNlc3Npb24uY2xlYW51cFRpbWVyKSB7XHJcbiAgICBjbGVhclRpbWVvdXQoc2Vzc2lvbi5jbGVhbnVwVGltZXIpO1xyXG4gIH1cclxuXHJcbiAgY29uc29sZS5sb2coYFtMb2djYXRdIENsZWFuaW5nIHVwIHNlc3Npb246ICR7a2V5fWApO1xyXG4gIHRyeSB7XHJcbiAgICBzZXNzaW9uLnByb2Nlc3Mua2lsbCgpO1xyXG4gIH0gY2F0Y2ggKGUpIHtcclxuICAgIC8vIFx1QkIzNFx1QzJEQ1xyXG4gIH1cclxuICBsb2djYXRTZXNzaW9ucy5kZWxldGUoa2V5KTtcclxufVxyXG5cclxuZnVuY3Rpb24gc2NoZWR1bGVMb2djYXRDbGVhbnVwKGtleTogc3RyaW5nKSB7XHJcbiAgY29uc3Qgc2Vzc2lvbiA9IGxvZ2NhdFNlc3Npb25zLmdldChrZXkpO1xyXG4gIGlmICghc2Vzc2lvbikgcmV0dXJuO1xyXG5cclxuICBpZiAoc2Vzc2lvbi5jbGVhbnVwVGltZXIpIHtcclxuICAgIGNsZWFyVGltZW91dChzZXNzaW9uLmNsZWFudXBUaW1lcik7XHJcbiAgfVxyXG5cclxuICBzZXNzaW9uLmNsZWFudXBUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgY29uc3QgY3VycmVudFNlc3Npb24gPSBsb2djYXRTZXNzaW9ucy5nZXQoa2V5KTtcclxuICAgIGlmIChjdXJyZW50U2Vzc2lvbiAmJiBjdXJyZW50U2Vzc2lvbi5jbGllbnRzLnNpemUgPT09IDApIHtcclxuICAgICAgY2xlYW51cExvZ2NhdFNlc3Npb24oa2V5KTtcclxuICAgIH1cclxuICB9LCBMT0dDQVRfQ0xFQU5VUF9ERUxBWSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNhbmNlbExvZ2NhdENsZWFudXAoa2V5OiBzdHJpbmcpIHtcclxuICBjb25zdCBzZXNzaW9uID0gbG9nY2F0U2Vzc2lvbnMuZ2V0KGtleSk7XHJcbiAgaWYgKHNlc3Npb24/LmNsZWFudXBUaW1lcikge1xyXG4gICAgY2xlYXJUaW1lb3V0KHNlc3Npb24uY2xlYW51cFRpbWVyKTtcclxuICAgIHNlc3Npb24uY2xlYW51cFRpbWVyID0gbnVsbDtcclxuICB9XHJcbn1cclxuXHJcbi8vIE5ESy9TREsgXHVCNzdDXHVDNzc0XHVDMTIwXHVDMkE0IFx1QzVEMFx1QjdFQyBcdUQzMjhcdUQxMzRcclxuY29uc3QgTElDRU5TRV9FUlJPUl9QQVRURVJOUyA9IFtcclxuICAvTGljZW5zZSBmb3IgcGFja2FnZSAuKiBub3QgYWNjZXB0ZWQvaSxcclxuICAvRmFpbGVkIHRvIGluc3RhbGwgdGhlIGZvbGxvd2luZyBBbmRyb2lkIFNESyBwYWNrYWdlcy9pLFxyXG4gIC9Zb3UgaGF2ZSBub3QgYWNjZXB0ZWQgdGhlIGxpY2Vuc2UgYWdyZWVtZW50cy9pLFxyXG5dO1xyXG5cclxuLy8gXHVCNzdDXHVDNzc0XHVDMTIwXHVDMkE0IFx1QzVEMFx1QjdFQyBcdUFDMTBcdUM5QzBcclxuZnVuY3Rpb24gZGV0ZWN0TGljZW5zZUVycm9yKHRleHQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gIHJldHVybiBMSUNFTlNFX0VSUk9SX1BBVFRFUk5TLnNvbWUocGF0dGVybiA9PiBwYXR0ZXJuLnRlc3QodGV4dCkpO1xyXG59XHJcblxyXG4vLyBTREsgXHVCOEU4XHVEMkI4IFx1QUNCRFx1Qjg1QyBcdUNEOTRcdUM4MTUgKFx1Qzc5OFx1QkFCQlx1QjQxQyBcdUFDQkRcdUI4NUNcdUM1RDBcdUMxMUMgXHVDNjJDXHVCQzE0XHVCOTc4IFx1QUNCRFx1Qjg1QyBcdUNEOTRcdUM4MTUpIC0gYWNjZXB0U2RrTGljZW5zZXNcdUM2QTlcclxuZnVuY3Rpb24gaW5mZXJTZGtSb290RnJvbVBhdGgoaW5wdXRQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGNvbnN0IG5vcm1hbGl6ZWRQYXRoID0gcGF0aC5ub3JtYWxpemUoaW5wdXRQYXRoKS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuICAvLyBiaW4gXHVEM0Y0XHVCMzU0XHVDNzc4IFx1QUNCRFx1QzZCMCAtPiAyLTNcdUIyRThcdUFDQzQgXHVDMEMxXHVDNzA0XHVCODVDXHJcbiAgaWYgKG5vcm1hbGl6ZWRQYXRoLmVuZHNXaXRoKCdiaW4nKSB8fCBub3JtYWxpemVkUGF0aC5lbmRzV2l0aCgnYmluXFxcXCcpIHx8IG5vcm1hbGl6ZWRQYXRoLmVuZHNXaXRoKCdiaW4vJykpIHtcclxuICAgIGNvbnN0IHBhcmVudCA9IHBhdGguZGlybmFtZShpbnB1dFBhdGgpO1xyXG4gICAgY29uc3QgZ3JhbmRQYXJlbnQgPSBwYXRoLmRpcm5hbWUocGFyZW50KTtcclxuICAgIC8vIGNtZGxpbmUtdG9vbHMvYmluIFx1QjYxMFx1QjI5NCBjbWRsaW5lLXRvb2xzL2xhdGVzdC9iaW4gXHVBRDZDXHVDODcwIFx1Q0M5OFx1QjlBQ1xyXG4gICAgaWYgKGdyYW5kUGFyZW50LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2NtZGxpbmUtdG9vbHMnKSkge1xyXG4gICAgICByZXR1cm4gcGF0aC5kaXJuYW1lKGdyYW5kUGFyZW50KTtcclxuICAgIH1cclxuICAgIC8vIGNtZGxpbmUtdG9vbHMvYmluIFx1QUQ2Q1x1Qzg3MFxyXG4gICAgaWYgKHBhcmVudC50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKCdjbWRsaW5lLXRvb2xzJykgfHwgcGFyZW50LnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoJ3Rvb2xzJykpIHtcclxuICAgICAgcmV0dXJuIHBhdGguZGlybmFtZShwYXJlbnQpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGdyYW5kUGFyZW50O1xyXG4gIH1cclxuXHJcbiAgLy8gY21kbGluZS10b29scyBcdUQzRjRcdUIzNTRcdUM3NzggXHVBQ0JEXHVDNkIwIC0+IDFcdUIyRThcdUFDQzQgXHVDMEMxXHVDNzA0XHVCODVDXHJcbiAgaWYgKG5vcm1hbGl6ZWRQYXRoLmVuZHNXaXRoKCdjbWRsaW5lLXRvb2xzJykgfHwgbm9ybWFsaXplZFBhdGguZW5kc1dpdGgoJ2NtZGxpbmUtdG9vbHNcXFxcJykgfHwgbm9ybWFsaXplZFBhdGguZW5kc1dpdGgoJ2NtZGxpbmUtdG9vbHMvJykpIHtcclxuICAgIHJldHVybiBwYXRoLmRpcm5hbWUoaW5wdXRQYXRoKTtcclxuICB9XHJcblxyXG4gIC8vIHRvb2xzIFx1RDNGNFx1QjM1NFx1Qzc3OCBcdUFDQkRcdUM2QjAgLT4gMVx1QjJFOFx1QUNDNCBcdUMwQzFcdUM3MDRcdUI4NUNcclxuICBpZiAobm9ybWFsaXplZFBhdGguZW5kc1dpdGgoJ3Rvb2xzJykgfHwgbm9ybWFsaXplZFBhdGguZW5kc1dpdGgoJ3Rvb2xzXFxcXCcpIHx8IG5vcm1hbGl6ZWRQYXRoLmVuZHNXaXRoKCd0b29scy8nKSkge1xyXG4gICAgcmV0dXJuIHBhdGguZGlybmFtZShpbnB1dFBhdGgpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGlucHV0UGF0aDtcclxufVxyXG5cclxuLy8gU0RLIFx1Qjc3Q1x1Qzc3NFx1QzEyMFx1QzJBNCBcdUM3OTBcdUIzRDkgXHVDMjE4XHVCNzdEXHJcbmFzeW5jIGZ1bmN0aW9uIGFjY2VwdFNka0xpY2Vuc2VzKHNka1BhdGg/OiBzdHJpbmcpOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZTogc3RyaW5nIH0+IHtcclxuICAvLyBTREsgXHVBQ0JEXHVCODVDIFx1QUNCMFx1QzgxNSBcdUJDMEYgXHVCOEU4XHVEMkI4IFx1Q0Q5NFx1QzgxNVxyXG4gIGxldCBpbnB1dFBhdGggPSBzZGtQYXRoIHx8IHByb2Nlc3MuZW52LkFORFJPSURfSE9NRSB8fCBwcm9jZXNzLmVudi5BTkRST0lEX1NES19ST09UIHx8XHJcbiAgICAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/IHBhdGguam9pbihwcm9jZXNzLmVudi5MT0NBTEFQUERBVEEgfHwgJycsICdBbmRyb2lkJywgJ1NkaycpIDogJycpO1xyXG5cclxuICBpZiAoIWlucHV0UGF0aCkge1xyXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdBbmRyb2lkIFNESyBwYXRoIG5vdCBmb3VuZCcgfTtcclxuICB9XHJcblxyXG4gIC8vIFx1Qzc5OFx1QkFCQlx1QjQxQyBcdUFDQkRcdUI4NUMgXHVEMzI4XHVEMTM0IFx1Qzc5MFx1QjNEOSBcdUMyMThcdUM4MTUgKGJpbiBcdUI2MTBcdUIyOTQgY21kbGluZS10b29scyBcdUM5QzFcdUM4MTEgXHVDOUMwXHVDODE1IFx1QzJEQylcclxuICBjb25zdCBzZGtSb290ID0gaW5mZXJTZGtSb290RnJvbVBhdGgoaW5wdXRQYXRoKTtcclxuXHJcbiAgY29uc3Qgc2RrbWFuYWdlck5hbWUgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInID8gJ3Nka21hbmFnZXIuYmF0JyA6ICdzZGttYW5hZ2VyJztcclxuXHJcbiAgLy8gc2RrbWFuYWdlciBcdUFDQkRcdUI4NUMgXHVDQzNFXHVBRTMwIChcdUIyRTRcdUM1OTFcdUQ1NUMgU0RLIFx1QUQ2Q1x1Qzg3MCBcdUM5QzBcdUM2RDApXHJcbiAgY29uc3Qgc2RrbWFuYWdlclBhdGhzID0gW1xyXG4gICAgLy8gXHVENDVDXHVDOTAwIFNESyBcdUFENkNcdUM4NzA6IGNtZGxpbmUtdG9vbHMvbGF0ZXN0L2JpblxyXG4gICAgcGF0aC5qb2luKHNka1Jvb3QsICdjbWRsaW5lLXRvb2xzJywgJ2xhdGVzdCcsICdiaW4nLCBzZGttYW5hZ2VyTmFtZSksXHJcbiAgICAvLyBcdUM3NzRcdUM4MDQgXHVCQzg0XHVDODA0IFNESyBcdUFENkNcdUM4NzA6IGNtZGxpbmUtdG9vbHMvYmluXHJcbiAgICBwYXRoLmpvaW4oc2RrUm9vdCwgJ2NtZGxpbmUtdG9vbHMnLCAnYmluJywgc2RrbWFuYWdlck5hbWUpLFxyXG4gICAgLy8gXHVCODA4XHVBQzcwXHVDMkRDIFNESyBcdUFENkNcdUM4NzA6IHRvb2xzL2JpblxyXG4gICAgcGF0aC5qb2luKHNka1Jvb3QsICd0b29scycsICdiaW4nLCBzZGttYW5hZ2VyTmFtZSksXHJcbiAgICAvLyBcdUM3ODVcdUI4MjUgXHVBQ0JEXHVCODVDXHVBQzAwIGJpbiBcdUQzRjRcdUIzNTRcdUM3NzggXHVBQ0JEXHVDNkIwXHJcbiAgICBwYXRoLmpvaW4oaW5wdXRQYXRoLCBzZGttYW5hZ2VyTmFtZSksXHJcbiAgICAvLyBcdUM3ODVcdUI4MjUgXHVBQ0JEXHVCODVDXHVBQzAwIGNtZGxpbmUtdG9vbHMgXHVEM0Y0XHVCMzU0XHVDNzc4IFx1QUNCRFx1QzZCMFxyXG4gICAgcGF0aC5qb2luKGlucHV0UGF0aCwgJ2JpbicsIHNka21hbmFnZXJOYW1lKSxcclxuICBdO1xyXG5cclxuICBsZXQgc2RrbWFuYWdlclBhdGg6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIGZvciAoY29uc3QgcCBvZiBzZGttYW5hZ2VyUGF0aHMpIHtcclxuICAgIGlmIChmc1N5bmMuZXhpc3RzU3luYyhwKSkge1xyXG4gICAgICBzZGttYW5hZ2VyUGF0aCA9IHA7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgaWYgKCFzZGttYW5hZ2VyUGF0aCkge1xyXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IGBzZGttYW5hZ2VyIG5vdCBmb3VuZC4gU2VhcmNoZWQgcGF0aHM6XFxuJHtzZGttYW5hZ2VyUGF0aHMuc2xpY2UoMCwgMykuam9pbignXFxuJyl9YCB9O1xyXG4gIH1cclxuXHJcbiAgdHJ5IHtcclxuICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XHJcbiAgICAgIC8vIFdpbmRvd3M6IFBvd2VyU2hlbGwgXHVDMEFDXHVDNkE5XHVENTU4XHVDNUVDIHllcyBcdUM3ODVcdUI4MjUgXHVEMzBDXHVDNzc0XHVENTA0XHJcbiAgICAgIC8vIC0tc2RrX3Jvb3QgXHVEMzBDXHVCNzdDXHVCQkY4XHVEMTMwXHVCOTdDIFx1QzBBQ1x1QzZBOVx1RDU1OFx1QzVFQyBcdUI3N0NcdUM3NzRcdUMxMjBcdUMyQTRcdUI5N0MgXHVDNjJDXHVCQzE0XHVCOTc4IFx1QzcwNFx1Q0U1OFx1QzVEMCBcdUM4MDBcdUM3QTVcclxuICAgICAgY29uc3QgcHNDb21tYW5kID0gYHBvd2Vyc2hlbGwgLUNvbW1hbmQgXCImIHsgMS4uMjAgfCBGb3JFYWNoLU9iamVjdCB7ICd5JyB9IHwgJiAnJHtzZGttYW5hZ2VyUGF0aC5yZXBsYWNlKC8nL2csIFwiJydcIil9JyAtLXNka19yb290PScke3Nka1Jvb3QucmVwbGFjZSgvJy9nLCBcIicnXCIpfScgLS1saWNlbnNlcyB9XCJgO1xyXG4gICAgICBhd2FpdCBleGVjQXN5bmMocHNDb21tYW5kLCB7XHJcbiAgICAgICAgdGltZW91dDogMTgwMDAwLFxyXG4gICAgICAgIGVudjogeyAuLi5wcm9jZXNzLmVudiwgQU5EUk9JRF9IT01FOiBzZGtSb290LCBBTkRST0lEX1NES19ST09UOiBzZGtSb290IH1cclxuICAgICAgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyBVbml4OiB5ZXMgXHVCQTg1XHVCODM5XHVDNUI0IFx1QzBBQ1x1QzZBOVxyXG4gICAgICBhd2FpdCBleGVjQXN5bmMoYHllcyB8IFwiJHtzZGttYW5hZ2VyUGF0aH1cIiAtLXNka19yb290PVwiJHtzZGtSb290fVwiIC0tbGljZW5zZXNgLCB7XHJcbiAgICAgICAgdGltZW91dDogMTgwMDAwLFxyXG4gICAgICAgIGVudjogeyAuLi5wcm9jZXNzLmVudiwgQU5EUk9JRF9IT01FOiBzZGtSb290LCBBTkRST0lEX1NES19ST09UOiBzZGtSb290IH1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogJ1NESyBsaWNlbnNlcyBhY2NlcHRlZCBzdWNjZXNzZnVsbHknIH07XHJcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgLy8gc2RrbWFuYWdlclx1QUMwMCBleGl0IGNvZGUgMVx1Qzc0NCBcdUJDMThcdUQ2NThcdUQ1NzRcdUIzQzQgXHVCNzdDXHVDNzc0XHVDMTIwXHVDMkE0XHVCMjk0IFx1QzIxOFx1Qjc3RFx1QjQxMFx1Qzc0NCBcdUMyMTggXHVDNzg4XHVDNzRDXHJcbiAgICBpZiAoZXJyb3Iuc3Rkb3V0Py5pbmNsdWRlcygnYWNjZXB0ZWQnKSB8fCBlcnJvci5zdGRlcnI/LmluY2x1ZGVzKCdhY2NlcHRlZCcpIHx8XHJcbiAgICAgICAgZXJyb3Iuc3Rkb3V0Py5pbmNsdWRlcygnQWxsIFNESyBwYWNrYWdlIGxpY2Vuc2VzIGFjY2VwdGVkJykgfHxcclxuICAgICAgICBlcnJvci5zdGRlcnI/LmluY2x1ZGVzKCdBbGwgU0RLIHBhY2thZ2UgbGljZW5zZXMgYWNjZXB0ZWQnKSkge1xyXG4gICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiAnU0RLIGxpY2Vuc2VzIGFjY2VwdGVkJyB9O1xyXG4gICAgfVxyXG4gICAgLy8gXHVDNzc0XHVCQkY4IFx1QkFBOFx1QjRFMCBcdUI3N0NcdUM3NzRcdUMxMjBcdUMyQTRcdUFDMDAgXHVDMjE4XHVCNzdEXHVCNDFDIFx1QUNCRFx1QzZCMFxyXG4gICAgaWYgKGVycm9yLnN0ZG91dD8uaW5jbHVkZXMoJ2xpY2Vuc2VzIG5vdCBhY2NlcHRlZCcpID09PSBmYWxzZSAmJlxyXG4gICAgICAgIGVycm9yLnN0ZGVycj8uaW5jbHVkZXMoJ2xpY2Vuc2VzIG5vdCBhY2NlcHRlZCcpID09PSBmYWxzZSkge1xyXG4gICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiAnU0RLIGxpY2Vuc2VzIGFscmVhZHkgYWNjZXB0ZWQnIH07XHJcbiAgICB9XHJcbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogYEZhaWxlZCB0byBhY2NlcHQgbGljZW5zZXM6ICR7ZXJyb3IubWVzc2FnZX1gIH07XHJcbiAgfVxyXG59XHJcblxyXG4vLyBCdWlsZCBwcm9jZXNzIG1hbmFnZW1lbnRcclxuaW50ZXJmYWNlIEJ1aWxkUHJvY2VzcyB7XHJcbiAgcHJvY2VzczogQ2hpbGRQcm9jZXNzO1xyXG4gIG91dHB1dDogQXJyYXk8eyB0eXBlOiBzdHJpbmc7IHRleHQ6IHN0cmluZzsgdGltZXN0YW1wOiBudW1iZXIgfT47XHJcbiAgZmluaXNoZWQ6IGJvb2xlYW47XHJcbn1cclxuXHJcbmNvbnN0IGJ1aWxkUHJvY2Vzc2VzOiBNYXA8c3RyaW5nLCBCdWlsZFByb2Nlc3M+ID0gbmV3IE1hcCgpO1xyXG5cclxuLy8gUHJldmlldyBwcm94eSBzdGF0ZVxyXG5sZXQgcHJveHlUYXJnZXRVcmw6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG5sZXQgcHJveHlUYXJnZXRPcmlnaW46IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG5cclxuLy8gUHJldmlldyBBcHBCcmlkZ2Ugc2NyaXB0IChpbmplY3RlZCBpbnRvIEhUTUwpXHJcbi8vIHRhcmdldE9yaWdpbiBpcyBwYXNzZWQgdG8gaGFuZGxlIGZ1bGwgVVJMIHJld3JpdGluZ1xyXG5jb25zdCBnZXRQcmV2aWV3QnJpZGdlU2NyaXB0ID0gKHRhcmdldE9yaWdpbjogc3RyaW5nKTogc3RyaW5nID0+IHtcclxuICByZXR1cm4gYFxyXG48c2NyaXB0PlxyXG4oZnVuY3Rpb24oKSB7XHJcbiAgJ3VzZSBzdHJpY3QnO1xyXG5cclxuICB2YXIgVEFSR0VUX09SSUdJTiA9ICR7SlNPTi5zdHJpbmdpZnkodGFyZ2V0T3JpZ2luKX07XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAvLyBDb21wcmVoZW5zaXZlIFVSTCBSZXdyaXRpbmcgZm9yIFByZXZpZXcgUHJveHlcclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIGZ1bmN0aW9uIHJld3JpdGVVcmwodXJsKSB7XHJcbiAgICBpZiAodHlwZW9mIHVybCAhPT0gJ3N0cmluZycpIHJldHVybiB1cmw7XHJcblxyXG4gICAgLy8gXHVDNzc0XHVCQkY4IC9wcmV2aWV3L1x1Qjg1QyBcdUMyRENcdUM3OTFcdUQ1NThcdUJBNzQgXHVDMkE0XHVEMEI1XHJcbiAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJy9wcmV2aWV3LycpIHx8IHVybC5zdGFydHNXaXRoKCcvcHJldmlldz8nKSkgcmV0dXJuIHVybDtcclxuXHJcbiAgICAvLyBkYXRhOiwgYmxvYjosIGphdmFzY3JpcHQ6IFx1QjRGMVx1Qzc0MCBcdUMyQTRcdUQwQjVcclxuICAgIGlmICgvXihkYXRhfGJsb2J8amF2YXNjcmlwdHxhYm91dHxtYWlsdG8pOi9pLnRlc3QodXJsKSkgcmV0dXJuIHVybDtcclxuXHJcbiAgICAvLyBcdUQwQzBcdUFDOUYgXHVDNjI0XHVCOUFDXHVDOUM0XHVDNzU4IFx1QzgwNFx1Q0NCNCBVUkxcdUM3NzRcdUJBNzQgXHVCOUFDXHVCNzdDXHVDNzc0XHVEMkI4XHJcbiAgICBpZiAodXJsLnN0YXJ0c1dpdGgoVEFSR0VUX09SSUdJTiArICcvJykpIHtcclxuICAgICAgcmV0dXJuICcvcHJldmlldycgKyB1cmwuc2xpY2UoVEFSR0VUX09SSUdJTi5sZW5ndGgpO1xyXG4gICAgfVxyXG4gICAgaWYgKHVybCA9PT0gVEFSR0VUX09SSUdJTikge1xyXG4gICAgICByZXR1cm4gJy9wcmV2aWV3Lyc7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gXHVENTA0XHVCODVDXHVEMUEwXHVDRjVDIFx1QzBDMVx1QjMwMCBVUkwgKC8vZXhhbXBsZS5jb20vLi4uKSAtIFx1RDBDMFx1QUM5RiBcdUIzQzRcdUJBNTRcdUM3NzhcdUM3NzRcdUJBNzQgXHVCOUFDXHVCNzdDXHVDNzc0XHVEMkI4XHJcbiAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJy8vJykpIHtcclxuICAgICAgdmFyIHRhcmdldEhvc3QgPSBUQVJHRVRfT1JJR0lOLnJlcGxhY2UoL15odHRwcz86LywgJycpO1xyXG4gICAgICBpZiAodXJsLnN0YXJ0c1dpdGgodGFyZ2V0SG9zdCArICcvJykgfHwgdXJsID09PSB0YXJnZXRIb3N0KSB7XHJcbiAgICAgICAgcmV0dXJuICcvcHJldmlldycgKyB1cmwuc2xpY2UodGFyZ2V0SG9zdC5sZW5ndGgpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB1cmw7IC8vIFx1QjJFNFx1Qjk3OCBcdUIzQzRcdUJBNTRcdUM3NzhcdUM3NDAgXHVBREY4XHVCMzAwXHVCODVDXHJcbiAgICB9XHJcblxyXG4gICAgLy8gXHVDODA4XHVCMzAwIFx1QUNCRFx1Qjg1QyAoLylcdUI4NUMgXHVDMkRDXHVDNzkxXHVENTU4XHVCQTc0IC9wcmV2aWV3IFx1QkQ5OVx1Qzc3NFx1QUUzMFxyXG4gICAgaWYgKHVybC5zdGFydHNXaXRoKCcvJykpIHtcclxuICAgICAgcmV0dXJuICcvcHJldmlldycgKyB1cmw7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gXHVDMEMxXHVCMzAwIFx1QUNCRFx1Qjg1Q1x1QjI5NCBcdUFERjhcdUIzMDBcdUI4NUMgKFx1QkUwQ1x1Qjc3Q1x1QzZCMFx1QzgwMFx1QUMwMCBiYXNlIFx1RDBEQ1x1QURGOCBcdUFFMzBcdUM5MDBcdUM3M0NcdUI4NUMgXHVDQzk4XHVCOUFDKVxyXG4gICAgcmV0dXJuIHVybDtcclxuICB9XHJcblxyXG4gIC8vIGZldGNoIFx1QzYyNFx1QkM4NFx1Qjc3Q1x1Qzc3NFx1QjREQ1xyXG4gIHZhciBvcmlnaW5hbEZldGNoID0gd2luZG93LmZldGNoO1xyXG4gIHdpbmRvdy5mZXRjaCA9IGZ1bmN0aW9uKGlucHV0LCBpbml0KSB7XHJcbiAgICBpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xyXG4gICAgICBpbnB1dCA9IHJld3JpdGVVcmwoaW5wdXQpO1xyXG4gICAgfSBlbHNlIGlmIChpbnB1dCBpbnN0YW5jZW9mIFJlcXVlc3QpIHtcclxuICAgICAgdmFyIG5ld1VybCA9IHJld3JpdGVVcmwoaW5wdXQudXJsKTtcclxuICAgICAgaWYgKG5ld1VybCAhPT0gaW5wdXQudXJsKSB7XHJcbiAgICAgICAgaW5wdXQgPSBuZXcgUmVxdWVzdChuZXdVcmwsIGlucHV0KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG9yaWdpbmFsRmV0Y2guY2FsbCh0aGlzLCBpbnB1dCwgaW5pdCk7XHJcbiAgfTtcclxuXHJcbiAgLy8gWE1MSHR0cFJlcXVlc3QgXHVDNjI0XHVCQzg0XHVCNzdDXHVDNzc0XHVCNERDXHJcbiAgdmFyIG9yaWdpbmFsWEhST3BlbiA9IFhNTEh0dHBSZXF1ZXN0LnByb3RvdHlwZS5vcGVuO1xyXG4gIFhNTEh0dHBSZXF1ZXN0LnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24obWV0aG9kLCB1cmwsIGFzeW5jLCB1c2VyLCBwYXNzd29yZCkge1xyXG4gICAgdmFyIG5ld1VybCA9IHJld3JpdGVVcmwodXJsKTtcclxuICAgIHJldHVybiBvcmlnaW5hbFhIUk9wZW4uY2FsbCh0aGlzLCBtZXRob2QsIG5ld1VybCwgYXN5bmMgIT09IGZhbHNlLCB1c2VyLCBwYXNzd29yZCk7XHJcbiAgfTtcclxuXHJcbiAgLy8gRXZlbnRTb3VyY2UgXHVDNjI0XHVCQzg0XHVCNzdDXHVDNzc0XHVCNERDIChTU0UpXHJcbiAgaWYgKHdpbmRvdy5FdmVudFNvdXJjZSkge1xyXG4gICAgdmFyIE9yaWdpbmFsRXZlbnRTb3VyY2UgPSB3aW5kb3cuRXZlbnRTb3VyY2U7XHJcbiAgICB3aW5kb3cuRXZlbnRTb3VyY2UgPSBmdW5jdGlvbih1cmwsIGNvbmZpZykge1xyXG4gICAgICByZXR1cm4gbmV3IE9yaWdpbmFsRXZlbnRTb3VyY2UocmV3cml0ZVVybCh1cmwpLCBjb25maWcpO1xyXG4gICAgfTtcclxuICAgIHdpbmRvdy5FdmVudFNvdXJjZS5wcm90b3R5cGUgPSBPcmlnaW5hbEV2ZW50U291cmNlLnByb3RvdHlwZTtcclxuICB9XHJcblxyXG4gIC8vIFdlYlNvY2tldFx1Qzc0MCB3czovLyBcdUQ1MDRcdUI4NUNcdUQxQTBcdUNGNUNcdUM3NzRcdUI3N0MgXHVCOUFDXHVCNzdDXHVDNzc0XHVEMkI4IFx1QkQ4OFx1QUMwMCwgXHVBREY4XHVCMzAwXHVCODVDIFx1QjQ2MFxyXG5cclxuICAvLyBEeW5hbWljIHNjcmlwdC9saW5rL2ltZyBcdUMwRERcdUMxMzEgXHVDMkRDIHNyYy9ocmVmIFx1QjlBQ1x1Qjc3Q1x1Qzc3NFx1RDJCOFxyXG4gIHZhciBvcmlnaW5hbENyZWF0ZUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50LmJpbmQoZG9jdW1lbnQpO1xyXG4gIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQgPSBmdW5jdGlvbih0YWdOYW1lLCBvcHRpb25zKSB7XHJcbiAgICB2YXIgZWwgPSBvcmlnaW5hbENyZWF0ZUVsZW1lbnQodGFnTmFtZSwgb3B0aW9ucyk7XHJcbiAgICB2YXIgdGFnID0gdGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuICAgIGlmICh0YWcgPT09ICdzY3JpcHQnIHx8IHRhZyA9PT0gJ2ltZycgfHwgdGFnID09PSAnaWZyYW1lJyB8fCB0YWcgPT09ICd2aWRlbycgfHwgdGFnID09PSAnYXVkaW8nIHx8IHRhZyA9PT0gJ3NvdXJjZScpIHtcclxuICAgICAgdmFyIG9yaWdpbmFsU2V0QXR0cmlidXRlID0gZWwuc2V0QXR0cmlidXRlLmJpbmQoZWwpO1xyXG4gICAgICBlbC5zZXRBdHRyaWJ1dGUgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xyXG4gICAgICAgIGlmIChuYW1lID09PSAnc3JjJyAmJiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICB2YWx1ZSA9IHJld3JpdGVVcmwodmFsdWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gb3JpZ2luYWxTZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xyXG4gICAgICB9O1xyXG5cclxuICAgICAgLy8gc3JjIFx1RDUwNFx1Qjg1Q1x1RDM3Q1x1RDJGMFx1QjNDNCBcdUM2MjRcdUJDODRcdUI3N0NcdUM3NzRcdUI0RENcclxuICAgICAgdmFyIHNyY0Rlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKEhUTUxFbGVtZW50LnByb3RvdHlwZSwgJ3NyYycpIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihlbC5fX3Byb3RvX18sICdzcmMnKTtcclxuICAgICAgaWYgKHNyY0Rlc2NyaXB0b3IgJiYgc3JjRGVzY3JpcHRvci5zZXQpIHtcclxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZWwsICdzcmMnLCB7XHJcbiAgICAgICAgICBnZXQ6IHNyY0Rlc2NyaXB0b3IuZ2V0LFxyXG4gICAgICAgICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICAgICAgICBzcmNEZXNjcmlwdG9yLnNldC5jYWxsKHRoaXMsIHJld3JpdGVVcmwodmFsdWUpKTtcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWVcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0YWcgPT09ICdsaW5rJyB8fCB0YWcgPT09ICdhJykge1xyXG4gICAgICB2YXIgb3JpZ2luYWxTZXRBdHRyaWJ1dGUyID0gZWwuc2V0QXR0cmlidXRlLmJpbmQoZWwpO1xyXG4gICAgICBlbC5zZXRBdHRyaWJ1dGUgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xyXG4gICAgICAgIGlmIChuYW1lID09PSAnaHJlZicgJiYgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgdmFsdWUgPSByZXdyaXRlVXJsKHZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsU2V0QXR0cmlidXRlMihuYW1lLCB2YWx1ZSk7XHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGVsO1xyXG4gIH07XHJcblxyXG4gIC8vIGltcG9ydCgpIFx1QjNEOVx1QzgwMSBcdUM3ODRcdUQzRUNcdUQyQjhcdUIyOTQgXHVCMTI0XHVDNzc0XHVEMkYwXHVCRTBDXHVCNzdDIFx1QzYyNFx1QkM4NFx1Qjc3Q1x1Qzc3NFx1QjREQyBcdUM1QjRcdUI4MjRcdUM2QzBcclxuICAvLyBcdUIzMDBcdUMyRTAgXHVDMTFDXHVCQzg0XHVDNUQwXHVDMTFDIEpTIFx1RDMwQ1x1Qzc3QyBcdUIwQjQgaW1wb3J0IFx1QUNCRFx1Qjg1Q1x1Qjk3QyBcdUI5QUNcdUI3N0NcdUM3NzRcdUQyQjhcdUQ1NzRcdUM1N0MgXHVENTY4XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAvLyBVUkwvTG9jYXRpb24gU3Bvb2ZpbmcgZm9yIFNQQSBSb3V0ZXJzXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAoZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgcHJldmlld1ByZWZpeCA9ICcvcHJldmlldyc7XHJcbiAgICB2YXIgb3JpZ2luYWxQYXRobmFtZSA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZTtcclxuICAgIHZhciBvcmlnaW5hbEhyZWYgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcclxuXHJcbiAgICBjb25zb2xlLmxvZygnW1ByZXZpZXddIE9yaWdpbmFsIFVSTDonLCBvcmlnaW5hbEhyZWYpO1xyXG4gICAgY29uc29sZS5sb2coJ1tQcmV2aWV3XSBPcmlnaW5hbCBwYXRobmFtZTonLCBvcmlnaW5hbFBhdGhuYW1lKTtcclxuXHJcbiAgICAvLyAvcHJldmlld1x1Qjg1QyBcdUMyRENcdUM3OTFcdUQ1NThcdUJBNzQgVVJMIFx1QkNDMFx1QUNCRFxyXG4gICAgaWYgKG9yaWdpbmFsUGF0aG5hbWUgPT09IHByZXZpZXdQcmVmaXggfHwgb3JpZ2luYWxQYXRobmFtZS5zdGFydHNXaXRoKHByZXZpZXdQcmVmaXggKyAnLycpKSB7XHJcbiAgICAgIHZhciBzcG9vZmVkUGF0aCA9IG9yaWdpbmFsUGF0aG5hbWUuc2xpY2UocHJldmlld1ByZWZpeC5sZW5ndGgpIHx8ICcvJztcclxuICAgICAgdmFyIG5ld1VybCA9IHNwb29mZWRQYXRoICsgd2luZG93LmxvY2F0aW9uLnNlYXJjaCArIHdpbmRvdy5sb2NhdGlvbi5oYXNoO1xyXG5cclxuICAgICAgY29uc29sZS5sb2coJ1tQcmV2aWV3XSBTcG9vZmluZyB0bzonLCBuZXdVcmwpO1xyXG5cclxuICAgICAgLy8gaGlzdG9yeS5yZXBsYWNlU3RhdGVcdUI4NUMgVVJMIFx1QkNDMFx1QUNCRFxyXG4gICAgICB0cnkge1xyXG4gICAgICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSh3aW5kb3cuaGlzdG9yeS5zdGF0ZSwgJycsIG5ld1VybCk7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1tQcmV2aWV3XSBBZnRlciByZXBsYWNlU3RhdGUsIGxvY2F0aW9uLnBhdGhuYW1lOicsIHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZSk7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1tQcmV2aWV3XSBBZnRlciByZXBsYWNlU3RhdGUsIGxvY2F0aW9uLmhyZWY6Jywgd2luZG93LmxvY2F0aW9uLmhyZWYpO1xyXG4gICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdbUHJldmlld10gcmVwbGFjZVN0YXRlIGZhaWxlZDonLCBlKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0pKCk7XHJcblxyXG4gIGNvbnNvbGUubG9nKCdbUHJldmlld10gVVJMIHJld3JpdGluZyBlbmFibGVkIGZvcjonLCBUQVJHRVRfT1JJR0lOKTtcclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gIC8vIGJlZm9yZXVubG9hZCBcdUFDQkRcdUFDRTBcdUNDM0QgXHVDNjQ0XHVDODA0IFx1QkIzNFx1QjgyNVx1RDY1NFxyXG4gIC8vIChcdUQzRkMgXHVCMzcwXHVDNzc0XHVEMTMwIFx1Qzc4NVx1QjgyNSBcdUM5MTEgXHVEMzk4XHVDNzc0XHVDOUMwIFx1Qzc3NFx1RDBDOCBcdUMyREMgXHVBQ0JEXHVBQ0UwXHVDQzNEIFx1QkMyOVx1QzlDMClcclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8vIDEuIHdpbmRvdy5vbmJlZm9yZXVubG9hZCBcdUMxOERcdUMxMzEgXHVCQjM0XHVCODI1XHVENjU0XHJcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHdpbmRvdywgJ29uYmVmb3JldW5sb2FkJywge1xyXG4gICAgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG51bGw7IH0sXHJcbiAgICBzZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm47IH0sXHJcbiAgICBjb25maWd1cmFibGU6IGZhbHNlXHJcbiAgfSk7XHJcblxyXG4gIC8vIDIuIGFkZEV2ZW50TGlzdGVuZXJcdUI4NUMgXHVCNEYxXHVCODVEXHVCNDE4XHVCMjk0IGJlZm9yZXVubG9hZCBcdUM3NzRcdUJDQTRcdUQyQjggXHVDQzI4XHVCMkU4XHJcbiAgdmFyIG9yaWdpbmFsQWRkRXZlbnRMaXN0ZW5lciA9IEV2ZW50VGFyZ2V0LnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyO1xyXG4gIEV2ZW50VGFyZ2V0LnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIsIG9wdGlvbnMpIHtcclxuICAgIGlmICh0eXBlID09PSAnYmVmb3JldW5sb2FkJykge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICByZXR1cm4gb3JpZ2luYWxBZGRFdmVudExpc3RlbmVyLmNhbGwodGhpcywgdHlwZSwgbGlzdGVuZXIsIG9wdGlvbnMpO1xyXG4gIH07XHJcblxyXG4gIC8vIDMuIFx1Qzc3NFx1QkJGOCBcdUI0RjFcdUI4NURcdUI0MUMgYmVmb3JldW5sb2FkIFx1Qzc3NFx1QkNBNFx1RDJCOCBcdUJCMzRcdUI4MjVcdUQ2NTRcclxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JldW5sb2FkJywgZnVuY3Rpb24oZSkge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbiAgICBkZWxldGUgZS5yZXR1cm5WYWx1ZTtcclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfSwgdHJ1ZSk7XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAvLyBBcHBCcmlkZ2UgZm9yIFByZXZpZXcgKFx1QzJFNFx1QzgxQyBcdUM1NzFcdUFDRkMgMTAwJSBcdUIzRDlcdUM3N0NcdUQ1NUMgXHVBRDZDXHVENjA0KVxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgaWYgKHdpbmRvdy5BcHBCcmlkZ2UpIHJldHVybjtcclxuXHJcbiAgLy8gXHVEMUEwXHVEMDcwXHVDNzQ0IFN5bWJvbCBcdUQwQTRcdUI4NUMgXHVDNzQwXHVCMkM5IChcdUM2NzhcdUJEODBcdUM1RDBcdUMxMUMgXHVDODExXHVBREZDIFx1QkQ4OFx1QUMwMClcclxuICB2YXIgX3QgPSAoZnVuY3Rpb24oKXtcclxuICAgIHZhciBzID0gU3ltYm9sKCdfJyk7XHJcbiAgICB2YXIgbyA9IHt9O1xyXG4gICAgb1tzXSA9ICdwcmV2aWV3LXNlY3VyaXR5LXRva2VuJztcclxuICAgIHJldHVybiBmdW5jdGlvbigpeyByZXR1cm4gb1tzXTsgfTtcclxuICB9KSgpO1xyXG5cclxuICAvLyBcdUM3NTFcdUIyRjUgXHVCMzAwXHVBRTMwIFx1QjlGNVxyXG4gIHZhciBwZW5kaW5nUmVxdWVzdHMgPSBuZXcgTWFwKCk7XHJcblxyXG4gIC8vIFx1RDMwQ1x1Qzc3Qy9cdUJDMTRcdUM3NzRcdUIxMDhcdUI5QUMgXHVCMzcwXHVDNzc0XHVEMTMwXHVCOTdDIGJhc2U2NFx1Qjg1QyBcdUJDQzBcdUQ2NThcclxuICBmdW5jdGlvbiB0b0Jhc2U2NChkYXRhKSB7XHJcbiAgICBpZiAoZGF0YSBpbnN0YW5jZW9mIEJsb2IgfHwgZGF0YSBpbnN0YW5jZW9mIEZpbGUpIHtcclxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xyXG4gICAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgIHJlc29sdmUoe1xyXG4gICAgICAgICAgICBfX3R5cGU6ICdiYXNlNjQnLFxyXG4gICAgICAgICAgICBkYXRhOiByZWFkZXIucmVzdWx0LnNwbGl0KCcsJylbMV0sXHJcbiAgICAgICAgICAgIG1pbWVUeXBlOiBkYXRhLnR5cGUsXHJcbiAgICAgICAgICAgIG5hbWU6IGRhdGEubmFtZSB8fCAnZmlsZScsXHJcbiAgICAgICAgICAgIHNpemU6IGRhdGEuc2l6ZVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICByZWFkZXIub25lcnJvciA9IHJlamVjdDtcclxuICAgICAgICByZWFkZXIucmVhZEFzRGF0YVVSTChkYXRhKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLy8gXHVDN0FDXHVBREMwXHVDODAxXHVDNzNDXHVCODVDIFx1QkFBOFx1QjRFMCBCbG9iL0ZpbGUgXHVDQzk4XHVCOUFDXHJcbiAgZnVuY3Rpb24gcHJvY2Vzc1BheWxvYWQocGF5bG9hZCkge1xyXG4gICAgaWYgKCFwYXlsb2FkIHx8IHR5cGVvZiBwYXlsb2FkICE9PSAnb2JqZWN0Jykge1xyXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHBheWxvYWQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwcm9taXNlcyA9IFtdO1xyXG4gICAgdmFyIGtleXMgPSBbXTtcclxuXHJcbiAgICBmb3IgKHZhciBrZXkgaW4gcGF5bG9hZCkge1xyXG4gICAgICBpZiAocGF5bG9hZC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcbiAgICAgICAgdmFyIHZhbHVlID0gcGF5bG9hZFtrZXldO1xyXG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEJsb2IgfHwgdmFsdWUgaW5zdGFuY2VvZiBGaWxlKSB7XHJcbiAgICAgICAgICBrZXlzLnB1c2goa2V5KTtcclxuICAgICAgICAgIHByb21pc2VzLnB1c2godG9CYXNlNjQodmFsdWUpKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAocHJvbWlzZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocGF5bG9hZCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uKHJlc3VsdHMpIHtcclxuICAgICAgdmFyIHByb2Nlc3NlZCA9IE9iamVjdC5hc3NpZ24oe30sIHBheWxvYWQpO1xyXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBwcm9jZXNzZWRba2V5c1tpXV0gPSByZXN1bHRzW2ldO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBwcm9jZXNzZWQ7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIFByZXZpZXdcdUM2QTkgbW9jayBcdUM3NTFcdUIyRjUgXHVDMEREXHVDMTMxIChcdUIyRTRcdUM1OTFcdUQ1NUMgYWN0aW9uIFx1QzlDMFx1QzZEMClcclxuICB2YXIgbW9ja1Jlc3BvbnNlcyA9IHtcclxuICAgIC8vIFx1QzU3MS9cdUMyRENcdUMyQTRcdUQxNUMgXHVDODE1XHVCQ0Y0XHJcbiAgICAnZ2V0QXBwSW5mbyc6IHsgYXBwTmFtZTogJ1ByZXZpZXcgQXBwJywgdmVyc2lvbjogJzEuMC4wJywgcGxhdGZvcm06ICdwcmV2aWV3JywgaXNBcHA6IHRydWUgfSxcclxuICAgICdnZXREZXZpY2VJbmZvJzogeyBwbGF0Zm9ybTogJ2FuZHJvaWQnLCBtb2RlbDogJ1ByZXZpZXcgRGV2aWNlJywgb3NWZXJzaW9uOiAnMTMnLCBpc1ByZXZpZXc6IHRydWUsIGlzQXBwOiB0cnVlIH0sXHJcbiAgICAnZ2V0U3lzdGVtSW5mbyc6IHsgcGxhdGZvcm06ICdhbmRyb2lkJywgaXNBcHA6IHRydWUsIGlzUHJldmlldzogdHJ1ZSwgdmVyc2lvbjogJzEuMC4wJyB9LFxyXG4gICAgJ2dldFBsYXRmb3JtJzogeyBwbGF0Zm9ybTogJ2FuZHJvaWQnLCBpc0FwcDogdHJ1ZSB9LFxyXG4gICAgJ2dldFZlcnNpb24nOiB7IHZlcnNpb246ICcxLjAuMCcgfSxcclxuXHJcbiAgICAvLyBcdUFEOENcdUQ1NUNcclxuICAgICdjaGVja1Blcm1pc3Npb24nOiB7IGdyYW50ZWQ6IHRydWUgfSxcclxuICAgICdyZXF1ZXN0UGVybWlzc2lvbic6IHsgZ3JhbnRlZDogdHJ1ZSB9LFxyXG4gICAgJ2hhc1Blcm1pc3Npb24nOiB7IGdyYW50ZWQ6IHRydWUsIHJlc3VsdDogdHJ1ZSB9LFxyXG5cclxuICAgIC8vIFx1Qzc3OFx1Qzk5RC9cdUMwQUNcdUM2QTlcdUM3OTBcclxuICAgICdnZXRUb2tlbic6IHsgdG9rZW46ICdwcmV2aWV3LW1vY2stdG9rZW4nIH0sXHJcbiAgICAnZ2V0RmNtVG9rZW4nOiB7IHRva2VuOiAncHJldmlldy1mY20tdG9rZW4nIH0sXHJcbiAgICAnZ2V0UHVzaFRva2VuJzogeyB0b2tlbjogJ3ByZXZpZXctcHVzaC10b2tlbicgfSxcclxuICAgICdnZXRVc2VySW5mbyc6IHsgaXNMb2dnZWRJbjogZmFsc2UgfSxcclxuICAgICdnZXRVc2VyJzogeyBpc0xvZ2dlZEluOiBmYWxzZSB9LFxyXG4gICAgJ2lzTG9nZ2VkSW4nOiB7IGxvZ2dlZEluOiBmYWxzZSwgaXNMb2dnZWRJbjogZmFsc2UgfSxcclxuXHJcbiAgICAvLyBcdUMxMjRcdUM4MTUvXHVENjU4XHVBQ0JEXHJcbiAgICAnZ2V0U2V0dGluZ3MnOiB7IHRoZW1lOiAnbGlnaHQnIH0sXHJcbiAgICAnZ2V0Q29uZmlnJzogeyBkZWJ1ZzogZmFsc2UgfSxcclxuICAgICdnZXRFbnYnOiB7IGVudjogJ3ByZXZpZXcnIH0sXHJcblxyXG4gICAgLy8gVUkvXHVCODA4XHVDNzc0XHVDNTQ0XHVDNkMzXHJcbiAgICAnZ2V0U2FmZUFyZWEnOiB7IHRvcDogMjQsIGJvdHRvbTogMzQsIGxlZnQ6IDAsIHJpZ2h0OiAwIH0sXHJcbiAgICAnZ2V0U3RhdHVzQmFySGVpZ2h0JzogeyBoZWlnaHQ6IDI0IH0sXHJcbiAgICAnZ2V0TmF2aWdhdGlvbkJhckhlaWdodCc6IHsgaGVpZ2h0OiA0OCB9LFxyXG4gICAgJ2dldEluc2V0cyc6IHsgdG9wOiAyNCwgYm90dG9tOiAzNCwgbGVmdDogMCwgcmlnaHQ6IDAgfSxcclxuICAgICdnZXRTY3JlZW5JbmZvJzogeyB3aWR0aDogMzYwLCBoZWlnaHQ6IDgwMCwgc2NhbGU6IDMgfSxcclxuXHJcbiAgICAvLyBcdUIxMjRcdUQyQjhcdUM2Q0NcdUQwNkMvXHVDNUYwXHVBQ0IwXHJcbiAgICAnZ2V0TmV0d29ya1N0YXR1cyc6IHsgY29ubmVjdGVkOiB0cnVlLCB0eXBlOiAnd2lmaScgfSxcclxuICAgICdpc09ubGluZSc6IHsgb25saW5lOiB0cnVlLCBjb25uZWN0ZWQ6IHRydWUgfSxcclxuXHJcbiAgICAvLyBcdUMyQTRcdUQxQTBcdUI5QUNcdUM5QzBcclxuICAgICdnZXRJdGVtJzogeyB2YWx1ZTogbnVsbCB9LFxyXG4gICAgJ3NldEl0ZW0nOiB7IHN1Y2Nlc3M6IHRydWUgfSxcclxuICAgICdyZW1vdmVJdGVtJzogeyBzdWNjZXNzOiB0cnVlIH0sXHJcblxyXG4gICAgLy8gXHVDNTYxXHVDMTU4XHJcbiAgICAnaGFwdGljJzogeyBzdWNjZXNzOiB0cnVlIH0sXHJcbiAgICAndmlicmF0ZSc6IHsgc3VjY2VzczogdHJ1ZSB9LFxyXG4gICAgJ3NoYXJlJzogeyBzdWNjZXNzOiB0cnVlIH0sXHJcbiAgICAnb3BlblVybCc6IHsgc3VjY2VzczogdHJ1ZSB9LFxyXG4gICAgJ29wZW5Ccm93c2VyJzogeyBzdWNjZXNzOiB0cnVlIH0sXHJcbiAgICAnY29weVRvQ2xpcGJvYXJkJzogeyBzdWNjZXNzOiB0cnVlIH0sXHJcbiAgICAnc2hvd1RvYXN0JzogeyBzdWNjZXNzOiB0cnVlIH0sXHJcbiAgICAnaGlkZUtleWJvYXJkJzogeyBzdWNjZXNzOiB0cnVlIH0sXHJcblxyXG4gICAgLy8gXHVBRTMwXHVCQ0Y4IFx1Qzc1MVx1QjJGNSAoXHVDNTRDIFx1QzIxOCBcdUM1QzZcdUIyOTQgYWN0aW9uXHVDNUQwIFx1QjMwMFx1RDU3NClcclxuICAgICdfZGVmYXVsdCc6IHsgc3VjY2VzczogdHJ1ZSwgaXNQcmV2aWV3OiB0cnVlLCBpc0FwcDogdHJ1ZSB9XHJcbiAgfTtcclxuXHJcbiAgLy8gUmVhY3ROYXRpdmVXZWJWaWV3IG1vY2sgLSBcdUMyRTRcdUM4MUMgXHVDNTcxXHVBQ0ZDIFx1QjNEOVx1Qzc3Q1x1RDU1QyBcdUJDMjlcdUMyRERcdUM3M0NcdUI4NUMgXHVDNzUxXHVCMkY1IFx1QzgwNFx1QjJFQ1xyXG4gIHdpbmRvdy5SZWFjdE5hdGl2ZVdlYlZpZXcgPSB7XHJcbiAgICBwb3N0TWVzc2FnZTogZnVuY3Rpb24obWVzc2FnZVN0cikge1xyXG4gICAgICB2YXIgcGFyc2VkID0gSlNPTi5wYXJzZShtZXNzYWdlU3RyKTtcclxuICAgICAgY29uc29sZS5sb2coJ1tBcHBCcmlkZ2UgUHJldmlld10gcG9zdE1lc3NhZ2U6JywgcGFyc2VkKTtcclxuXHJcbiAgICAgIC8vIHJlcXVlc3RJZFx1QUMwMCBcdUM3ODhcdUM3M0NcdUJBNzQgY2FsbCgpIFx1RDYzOFx1Q0Q5QyAtPiBtb2NrIFx1Qzc1MVx1QjJGNSBcdUJDMThcdUQ2NThcclxuICAgICAgaWYgKHBhcnNlZC5yZXF1ZXN0SWQpIHtcclxuICAgICAgICB2YXIgYWN0aW9uID0gcGFyc2VkLnByb3RvY29sLnJlcGxhY2UoJ2FwcDovLycsICcnKTtcclxuICAgICAgICB2YXIgbW9ja0RhdGEgPSBtb2NrUmVzcG9uc2VzW2FjdGlvbl0gfHwgbW9ja1Jlc3BvbnNlc1snX2RlZmF1bHQnXTtcclxuXHJcbiAgICAgICAgLy8gXHVDMkU0XHVDODFDIFx1QzU3MVx1Q0M5OFx1QjdGQyBcdUM1N0RcdUFDMDRcdUM3NTggXHVCNTFDXHVCODA4XHVDNzc0IFx1RDZDNCBuYXRpdmVNZXNzYWdlIFx1Qzc3NFx1QkNBNFx1RDJCOFx1Qjg1QyBcdUM3NTFcdUIyRjVcclxuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgdmFyIHJlc3BvbnNlID0ge1xyXG4gICAgICAgICAgICBhY3Rpb246ICdicmlkZ2VSZXNwb25zZScsXHJcbiAgICAgICAgICAgIHBheWxvYWQ6IHtcclxuICAgICAgICAgICAgICByZXF1ZXN0SWQ6IHBhcnNlZC5yZXF1ZXN0SWQsXHJcbiAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICBkYXRhOiBtb2NrRGF0YVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgICAgY29uc29sZS5sb2coJ1tBcHBCcmlkZ2UgUHJldmlld10gU2VuZGluZyBtb2NrIHJlc3BvbnNlIHZpYSBuYXRpdmVNZXNzYWdlOicsIHJlc3BvbnNlKTtcclxuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgnbmF0aXZlTWVzc2FnZScsIHsgZGV0YWlsOiByZXNwb25zZSB9KSk7XHJcbiAgICAgICAgfSwgNTApO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBwYXJlbnQgZnJhbWVcdUM1RDBcdUIzQzQgXHVDNTRDXHVCOUJDIChcdUI1MTRcdUJDODRcdUFFNDVcdUM2QTkpXHJcbiAgICAgIGlmICh3aW5kb3cucGFyZW50ICE9PSB3aW5kb3cpIHtcclxuICAgICAgICB3aW5kb3cucGFyZW50LnBvc3RNZXNzYWdlKHsgdHlwZTogJ1BSRVZJRVdfQlJJREdFX01FU1NBR0UnLCBkYXRhOiBwYXJzZWQgfSwgJyonKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIC8vIFx1QzU3MSBcdUJFMENcdUI5QkZcdUM5QzAgXHVBQzFEXHVDQ0I0IChcdUMyRTRcdUM4MUMgYnJpZGdlLWNsaWVudC50c1x1QzY0MCBcdUIzRDlcdUM3N0NcdUQ1NUMgXHVBRDZDXHVDODcwKVxyXG4gIHdpbmRvdy5BcHBCcmlkZ2UgPSB7XHJcbiAgICBzZW5kOiBmdW5jdGlvbihhY3Rpb24sIHBheWxvYWQpIHtcclxuICAgICAgcHJvY2Vzc1BheWxvYWQocGF5bG9hZCB8fCB7fSkudGhlbihmdW5jdGlvbihwcm9jZXNzZWQpIHtcclxuICAgICAgICB2YXIgbWVzc2FnZSA9IHtcclxuICAgICAgICAgIHByb3RvY29sOiAnYXBwOi8vJyArIGFjdGlvbixcclxuICAgICAgICAgIHBheWxvYWQ6IHByb2Nlc3NlZCxcclxuICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcclxuICAgICAgICAgIF9fdG9rZW46IF90KCksXHJcbiAgICAgICAgICBfX25vbmNlOiBEYXRlLm5vdygpICsgJy0nICsgTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyKDIsIDkpXHJcbiAgICAgICAgfTtcclxuICAgICAgICB3aW5kb3cuUmVhY3ROYXRpdmVXZWJWaWV3LnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKTtcclxuICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcignW0FwcEJyaWRnZV0gRmFpbGVkIHRvIHByb2Nlc3MgcGF5bG9hZDonLCBlcnIpO1xyXG4gICAgICB9KTtcclxuICAgIH0sXHJcblxyXG4gICAgY2FsbDogZnVuY3Rpb24oYWN0aW9uLCBwYXlsb2FkLCB0aW1lb3V0KSB7XHJcbiAgICAgIHRpbWVvdXQgPSB0aW1lb3V0IHx8IDEwMDAwO1xyXG5cclxuICAgICAgcmV0dXJuIHByb2Nlc3NQYXlsb2FkKHBheWxvYWQgfHwge30pLnRoZW4oZnVuY3Rpb24ocHJvY2Vzc2VkKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgICAgdmFyIHJlcXVlc3RJZCA9IERhdGUubm93KCkgKyAnLScgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHIoMiwgOSk7XHJcblxyXG4gICAgICAgICAgdmFyIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcGVuZGluZ1JlcXVlc3RzLmRlbGV0ZShyZXF1ZXN0SWQpO1xyXG4gICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdSZXF1ZXN0IHRpbWVvdXQ6ICcgKyBhY3Rpb24pKTtcclxuICAgICAgICAgIH0sIHRpbWVvdXQpO1xyXG5cclxuICAgICAgICAgIHBlbmRpbmdSZXF1ZXN0cy5zZXQocmVxdWVzdElkLCB7XHJcbiAgICAgICAgICAgIHJlc29sdmU6IHJlc29sdmUsXHJcbiAgICAgICAgICAgIHJlamVjdDogcmVqZWN0LFxyXG4gICAgICAgICAgICB0aW1lcjogdGltZXJcclxuICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgIHZhciBtZXNzYWdlID0ge1xyXG4gICAgICAgICAgICBwcm90b2NvbDogJ2FwcDovLycgKyBhY3Rpb24sXHJcbiAgICAgICAgICAgIHBheWxvYWQ6IHByb2Nlc3NlZCxcclxuICAgICAgICAgICAgcmVxdWVzdElkOiByZXF1ZXN0SWQsXHJcbiAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcclxuICAgICAgICAgICAgX190b2tlbjogX3QoKSxcclxuICAgICAgICAgICAgX19ub25jZTogRGF0ZS5ub3coKSArICctJyArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA5KVxyXG4gICAgICAgICAgfTtcclxuICAgICAgICAgIHdpbmRvdy5SZWFjdE5hdGl2ZVdlYlZpZXcucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9KTtcclxuICAgIH0sXHJcblxyXG4gICAgb246IGZ1bmN0aW9uKGFjdGlvbiwgY2FsbGJhY2spIHtcclxuICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMpIHRoaXMuX2xpc3RlbmVycyA9IHt9O1xyXG4gICAgICBpZiAoIXRoaXMuX2xpc3RlbmVyc1thY3Rpb25dKSB0aGlzLl9saXN0ZW5lcnNbYWN0aW9uXSA9IFtdO1xyXG4gICAgICB0aGlzLl9saXN0ZW5lcnNbYWN0aW9uXS5wdXNoKGNhbGxiYWNrKTtcclxuICAgIH0sXHJcblxyXG4gICAgb25jZTogZnVuY3Rpb24oYWN0aW9uLCBjYWxsYmFjaykge1xyXG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICAgIHZhciB3cmFwcGVyID0gZnVuY3Rpb24ocGF5bG9hZCwgbWVzc2FnZSkge1xyXG4gICAgICAgIHNlbGYub2ZmKGFjdGlvbiwgd3JhcHBlcik7XHJcbiAgICAgICAgY2FsbGJhY2socGF5bG9hZCwgbWVzc2FnZSk7XHJcbiAgICAgIH07XHJcbiAgICAgIHRoaXMub24oYWN0aW9uLCB3cmFwcGVyKTtcclxuICAgIH0sXHJcblxyXG4gICAgd2FpdEZvcjogZnVuY3Rpb24oYWN0aW9uLCB0aW1lb3V0KSB7XHJcbiAgICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgICAgdGltZW91dCA9IHRpbWVvdXQgfHwgMTAwMDA7XHJcblxyXG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgdmFyIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICAgIHNlbGYub2ZmKGFjdGlvbiwgaGFuZGxlcik7XHJcbiAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdUaW1lb3V0IHdhaXRpbmcgZm9yOiAnICsgYWN0aW9uKSk7XHJcbiAgICAgICAgfSwgdGltZW91dCk7XHJcblxyXG4gICAgICAgIHZhciBoYW5kbGVyID0gZnVuY3Rpb24ocGF5bG9hZCwgbWVzc2FnZSkge1xyXG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcclxuICAgICAgICAgIHNlbGYub2ZmKGFjdGlvbiwgaGFuZGxlcik7XHJcbiAgICAgICAgICByZXNvbHZlKHsgcGF5bG9hZDogcGF5bG9hZCwgbWVzc2FnZTogbWVzc2FnZSB9KTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBzZWxmLm9uKGFjdGlvbiwgaGFuZGxlcik7XHJcbiAgICAgIH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICBvZmY6IGZ1bmN0aW9uKGFjdGlvbiwgY2FsbGJhY2spIHtcclxuICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgIXRoaXMuX2xpc3RlbmVyc1thY3Rpb25dKSByZXR1cm47XHJcbiAgICAgIGlmIChjYWxsYmFjaykge1xyXG4gICAgICAgIHRoaXMuX2xpc3RlbmVyc1thY3Rpb25dID0gdGhpcy5fbGlzdGVuZXJzW2FjdGlvbl0uZmlsdGVyKGZ1bmN0aW9uKGNiKSB7XHJcbiAgICAgICAgICByZXR1cm4gY2IgIT09IGNhbGxiYWNrO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9saXN0ZW5lcnNbYWN0aW9uXTtcclxuICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBfaGFuZGxlUmVzcG9uc2U6IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcbiAgICAgIHZhciBwZW5kaW5nID0gcGVuZGluZ1JlcXVlc3RzLmdldChyZXNwb25zZS5yZXF1ZXN0SWQpO1xyXG4gICAgICBpZiAocGVuZGluZykge1xyXG4gICAgICAgIGNsZWFyVGltZW91dChwZW5kaW5nLnRpbWVyKTtcclxuICAgICAgICBwZW5kaW5nUmVxdWVzdHMuZGVsZXRlKHJlc3BvbnNlLnJlcXVlc3RJZCk7XHJcbiAgICAgICAgaWYgKHJlc3BvbnNlLnN1Y2Nlc3MpIHtcclxuICAgICAgICAgIHBlbmRpbmcucmVzb2x2ZShyZXNwb25zZS5kYXRhKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcGVuZGluZy5yZWplY3QobmV3IEVycm9yKHJlc3BvbnNlLmVycm9yIHx8ICdVbmtub3duIGVycm9yJykpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBfaGFuZGxlTWVzc2FnZTogZnVuY3Rpb24obWVzc2FnZSkge1xyXG4gICAgICBjb25zb2xlLmxvZygnW0FwcEJyaWRnZV0gX2hhbmRsZU1lc3NhZ2UgY2FsbGVkJywgbWVzc2FnZSk7XHJcblxyXG4gICAgICBpZiAobWVzc2FnZS5hY3Rpb24gPT09ICdicmlkZ2VSZXNwb25zZScpIHtcclxuICAgICAgICB0aGlzLl9oYW5kbGVSZXNwb25zZShtZXNzYWdlLnBheWxvYWQpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHRoaXMuX2xpc3RlbmVycykge1xyXG4gICAgICAgIGlmICh0aGlzLl9saXN0ZW5lcnNbbWVzc2FnZS5hY3Rpb25dKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZygnW0FwcEJyaWRnZV0gRm91bmQgJyArIHRoaXMuX2xpc3RlbmVyc1ttZXNzYWdlLmFjdGlvbl0ubGVuZ3RoICsgJyBsaXN0ZW5lcihzKSBmb3I6ICcgKyBtZXNzYWdlLmFjdGlvbik7XHJcbiAgICAgICAgICB0aGlzLl9saXN0ZW5lcnNbbWVzc2FnZS5hY3Rpb25dLmZvckVhY2goZnVuY3Rpb24oY2IpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBjYihtZXNzYWdlLnBheWxvYWQsIG1lc3NhZ2UpO1xyXG4gICAgICAgICAgICB9IGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbQXBwQnJpZGdlXSBMaXN0ZW5lciBlcnJvcjonLCBlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLl9saXN0ZW5lcnNbJyonXSkge1xyXG4gICAgICAgICAgdGhpcy5fbGlzdGVuZXJzWycqJ10uZm9yRWFjaChmdW5jdGlvbihjYikge1xyXG4gICAgICAgICAgICB0cnkgeyBjYihtZXNzYWdlLnBheWxvYWQsIG1lc3NhZ2UpOyB9IGNhdGNoKGUpIHsgY29uc29sZS5lcnJvcihlKTsgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIGlzQXBwOiBmdW5jdGlvbigpIHtcclxuICAgICAgcmV0dXJuICEhd2luZG93LlJlYWN0TmF0aXZlV2ViVmlldztcclxuICAgIH0sXHJcblxyXG4gICAgaXNQcmV2aWV3OiBmdW5jdGlvbigpIHtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9LFxyXG5cclxuICAgIHZlcnNpb246ICcyLjEuMCdcclxuICB9O1xyXG5cclxuICAvLyBcdUM1NzFcdUM1RDBcdUMxMUMgXHVDNjI4IFx1QkE1NFx1QzJEQ1x1QzlDMCBcdUMyMThcdUMyRTAgXHVCOUFDXHVDMkE0XHVCMTA4IChcdUMyRTRcdUM4MUMgXHVDNTcxXHVBQ0ZDIFx1QjNEOVx1Qzc3QylcclxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbmF0aXZlTWVzc2FnZScsIGZ1bmN0aW9uKGUpIHtcclxuICAgIGNvbnNvbGUubG9nKCdbQXBwQnJpZGdlXSBuYXRpdmVNZXNzYWdlIGV2ZW50IHJlY2VpdmVkJywgZS5kZXRhaWwpO1xyXG4gICAgd2luZG93LkFwcEJyaWRnZS5faGFuZGxlTWVzc2FnZShlLmRldGFpbCk7XHJcbiAgfSk7XHJcblxyXG4gIC8vIFx1QzgwNFx1QzVFRCBcdUNGNUNcdUJDMzEgKFx1RDYzOFx1RDY1OFx1QzEzMSlcclxuICB3aW5kb3cub25OYXRpdmVNZXNzYWdlID0gZnVuY3Rpb24obWVzc2FnZSkge1xyXG4gICAgd2luZG93LkFwcEJyaWRnZS5faGFuZGxlTWVzc2FnZShtZXNzYWdlKTtcclxuICB9O1xyXG5cclxuICAvLyBcdUNEMDhcdUFFMzBcdUQ2NTQgXHVDNjQ0XHVCOENDIFx1Qzc3NFx1QkNBNFx1RDJCOFxyXG4gIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgnQXBwQnJpZGdlUmVhZHknKSk7XHJcbiAgY29uc29sZS5sb2coJ1tBcHBCcmlkZ2UgUHJldmlld10gSW5pdGlhbGl6ZWQgKG1hdGNoaW5nIHJlYWwgYXBwIGltcGxlbWVudGF0aW9uKScpO1xyXG59KSgpO1xyXG48L3NjcmlwdD5gO1xyXG59O1xyXG5cclxuLy8gUHJvamVjdCByb290ICh3aGVyZSBwYWNrYWdlLmpzb24gaXMpXHJcbmNvbnN0IHByb2plY3RSb290ID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uLy4uLy4uJyk7XHJcbmNvbnN0IGNvbnN0YW50c0RpciA9IHBhdGguam9pbihwcm9qZWN0Um9vdCwgJ2NvbnN0YW50cycpO1xyXG5jb25zdCBicmlkZ2VzRGlyID0gcGF0aC5qb2luKHByb2plY3RSb290LCAnbGliL2JyaWRnZXMnKTtcclxuXHJcbi8vIENvbmZpZyBmaWxlc1xyXG5jb25zdCBDT05GSUdfRklMRVM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XHJcbiAgYXBwOiAnYXBwLmpzb24nLFxyXG4gIHRoZW1lOiAndGhlbWUuanNvbicsXHJcbiAgcGx1Z2luczogJ3BsdWdpbnMuanNvbicsXHJcbiAgJ2J1aWxkLWVudic6ICdidWlsZC1lbnYuanNvbidcclxufTtcclxuXHJcbi8vIFZhbGlkYXRpb25cclxuY29uc3QgTlBNX1BBQ0tBR0VfUkVHRVggPSAvXihAW2EtejAtOS1+XVthLXowLTktLl9+XSpcXC8pP1thLXowLTktfl1bYS16MC05LS5ffl0qJC87XHJcbmNvbnN0IFNBRkVfU0VBUkNIX1JFR0VYID0gL15bYS16QS1aMC05QC9fLV0rJC87XHJcblxyXG5mdW5jdGlvbiBpc1ZhbGlkUGFja2FnZU5hbWUobmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgcmV0dXJuIHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJyAmJlxyXG4gICAgbmFtZS5sZW5ndGggPiAwICYmXHJcbiAgICBuYW1lLmxlbmd0aCA8PSAyMTQgJiZcclxuICAgIE5QTV9QQUNLQUdFX1JFR0VYLnRlc3QobmFtZSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGlzVmFsaWRTZWFyY2hRdWVyeShxdWVyeTogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgcmV0dXJuIHR5cGVvZiBxdWVyeSA9PT0gJ3N0cmluZycgJiZcclxuICAgIHF1ZXJ5Lmxlbmd0aCA+IDAgJiZcclxuICAgIHF1ZXJ5Lmxlbmd0aCA8PSAxMDAgJiZcclxuICAgIFNBRkVfU0VBUkNIX1JFR0VYLnRlc3QocXVlcnkpO1xyXG59XHJcblxyXG4vLyBucG0gdXRpbGl0aWVzXHJcbmFzeW5jIGZ1bmN0aW9uIHNlYXJjaE5wbVBhY2thZ2VzKHF1ZXJ5OiBzdHJpbmcpIHtcclxuICBpZiAoIWlzVmFsaWRTZWFyY2hRdWVyeShxdWVyeSkpIHtcclxuICAgIGNvbnNvbGUubG9nKCdbYXBpLXBsdWdpbl0gSW52YWxpZCBzZWFyY2ggcXVlcnk6JywgcXVlcnkpO1xyXG4gICAgcmV0dXJuIFtdO1xyXG4gIH1cclxuICB0cnkge1xyXG4gICAgY29uc29sZS5sb2coJ1thcGktcGx1Z2luXSBTZWFyY2hpbmcgbnBtIGZvcjonLCBxdWVyeSk7XHJcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGBucG0gc2VhcmNoIFwiJHtxdWVyeX1cIiAtLWpzb25gLCB7XHJcbiAgICAgIGN3ZDogcHJvamVjdFJvb3QsXHJcbiAgICAgIHRpbWVvdXQ6IDYwMDAwXHJcbiAgICB9KTtcclxuICAgIGNvbnN0IHJlc3VsdHMgPSBKU09OLnBhcnNlKHN0ZG91dCk7XHJcbiAgICBjb25zb2xlLmxvZygnW2FwaS1wbHVnaW5dIFNlYXJjaCByZXN1bHRzIGNvdW50OicsIHJlc3VsdHMubGVuZ3RoKTtcclxuICAgIHJldHVybiByZXN1bHRzO1xyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICBjb25zb2xlLmVycm9yKCdbYXBpLXBsdWdpbl0gbnBtIHNlYXJjaCBlcnJvcjonLCBlcnJvcik7XHJcbiAgICByZXR1cm4gW107XHJcbiAgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRJbnN0YWxsZWRQYWNrYWdlcygpIHtcclxuICB0cnkge1xyXG4gICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnbnBtIGxpc3QgLS1qc29uIC0tZGVwdGg9MCcsIHtcclxuICAgICAgY3dkOiBwcm9qZWN0Um9vdFxyXG4gICAgfSk7XHJcbiAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShzdGRvdXQpO1xyXG4gICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKGRhdGEuZGVwZW5kZW5jaWVzIHx8IHt9KS5tYXAoKFtuYW1lLCBpbmZvXTogW3N0cmluZywgYW55XSkgPT4gKHtcclxuICAgICAgbmFtZSxcclxuICAgICAgdmVyc2lvbjogaW5mby52ZXJzaW9uXHJcbiAgICB9KSk7XHJcbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgLy8gbnBtIGxpc3RcdUIyOTQgcGVlciBkZXAgXHVBQ0JEXHVBQ0UwXHVCODVDIGV4aXQgY29kZSAxIFx1QkMxOFx1RDY1OCBcdUFDMDBcdUIyQTVcclxuICAgIGlmIChlcnJvci5zdGRvdXQpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShlcnJvci5zdGRvdXQpO1xyXG4gICAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhkYXRhLmRlcGVuZGVuY2llcyB8fCB7fSkubWFwKChbbmFtZSwgaW5mb106IFtzdHJpbmcsIGFueV0pID0+ICh7XHJcbiAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgdmVyc2lvbjogaW5mby52ZXJzaW9uXHJcbiAgICAgICAgfSkpO1xyXG4gICAgICB9IGNhdGNoIHtcclxuICAgICAgICByZXR1cm4gW107XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGNvbnNvbGUuZXJyb3IoJ1thcGktcGx1Z2luXSBucG0gbGlzdCBlcnJvcjonLCBlcnJvci5tZXNzYWdlKTtcclxuICAgIHJldHVybiBbXTtcclxuICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGluc3RhbGxQYWNrYWdlKHBhY2thZ2VOYW1lOiBzdHJpbmcsIHZlcnNpb24gPSAnbGF0ZXN0Jykge1xyXG4gIGlmICghaXNWYWxpZFBhY2thZ2VOYW1lKHBhY2thZ2VOYW1lKSkge1xyXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnSW52YWxpZCBwYWNrYWdlIG5hbWUnIH07XHJcbiAgfVxyXG4gIGNvbnN0IHNwZWMgPSB2ZXJzaW9uID09PSAnbGF0ZXN0JyA/IHBhY2thZ2VOYW1lIDogYCR7cGFja2FnZU5hbWV9QCR7dmVyc2lvbn1gO1xyXG4gIHRyeSB7XHJcbiAgICBhd2FpdCBleGVjQXN5bmMoYG5wbSBpbnN0YWxsICR7c3BlY31gLCB7IGN3ZDogcHJvamVjdFJvb3QsIHRpbWVvdXQ6IDEyMDAwMCB9KTtcclxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcclxuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcclxuICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHVuaW5zdGFsbFBhY2thZ2UocGFja2FnZU5hbWU6IHN0cmluZykge1xyXG4gIGlmICghaXNWYWxpZFBhY2thZ2VOYW1lKHBhY2thZ2VOYW1lKSkge1xyXG4gICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnSW52YWxpZCBwYWNrYWdlIG5hbWUnIH07XHJcbiAgfVxyXG4gIHRyeSB7XHJcbiAgICBhd2FpdCBleGVjQXN5bmMoYG5wbSB1bmluc3RhbGwgJHtwYWNrYWdlTmFtZX1gLCB7IGN3ZDogcHJvamVjdFJvb3QsIHRpbWVvdXQ6IDYwMDAwIH0pO1xyXG4gICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xyXG4gIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xyXG4gIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gcmVnZW5lcmF0ZVBsdWdpblJlZ2lzdHJ5KCkge1xyXG4gIHRyeSB7XHJcbiAgICBhd2FpdCBleGVjQXN5bmMoJ25wbSBydW4gZ2VuZXJhdGU6cGx1Z2lucycsIHsgY3dkOiBwcm9qZWN0Um9vdCB9KTtcclxuICAgIGNvbnNvbGUubG9nKCdbYXBpLXBsdWdpbl0gUGx1Z2luIHJlZ2lzdHJ5IHJlZ2VuZXJhdGVkJyk7XHJcbiAgfSBjYXRjaCAoZSkge1xyXG4gICAgY29uc29sZS5lcnJvcignW2FwaS1wbHVnaW5dIEZhaWxlZCB0byByZWdlbmVyYXRlIHBsdWdpbiByZWdpc3RyeTonLCBlKTtcclxuICB9XHJcbn1cclxuXHJcbi8vIFx1QjEyNFx1Qzc4NFx1QzJBNFx1RDM5OFx1Qzc3NFx1QzJBNCBcdUNEQTlcdUIzQ0MgXHVBQzgwXHVDMEFDXHJcbmZ1bmN0aW9uIHZhbGlkYXRlUGx1Z2luTmFtZXNwYWNlcyhjb25maWc6IGFueSk6IHsgdmFsaWQ6IGJvb2xlYW47IGNvbmZsaWN0czogQXJyYXk8eyBuYW1lc3BhY2U6IHN0cmluZzsgcGx1Z2luczogc3RyaW5nW10gfT4gfSB7XHJcbiAgY29uc3QgYWxsUGx1Z2lucyA9IFtcclxuICAgIC4uLihjb25maWcucGx1Z2lucz8uYXV0byB8fCBbXSkubWFwKChwOiBhbnkpID0+ICh7IC4uLnAsIGlkOiBwLm5hbWUsIHR5cGU6ICdhdXRvJyB9KSksXHJcbiAgICAuLi4oY29uZmlnLnBsdWdpbnM/Lm1hbnVhbCB8fCBbXSkubWFwKChwOiBhbnkpID0+ICh7IC4uLnAsIGlkOiBwLnBhdGgsIHR5cGU6ICdtYW51YWwnIH0pKVxyXG4gIF07XHJcblxyXG4gIGNvbnN0IG5hbWVzcGFjZU1hcCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXT4oKTtcclxuXHJcbiAgYWxsUGx1Z2lucy5mb3JFYWNoKChwbHVnaW46IGFueSkgPT4ge1xyXG4gICAgY29uc3QgbnMgPSBwbHVnaW4ubmFtZXNwYWNlO1xyXG4gICAgY29uc3QgaWQgPSBwbHVnaW4uaWQ7XHJcbiAgICBpZiAobnMpIHtcclxuICAgICAgaWYgKCFuYW1lc3BhY2VNYXAuaGFzKG5zKSkge1xyXG4gICAgICAgIG5hbWVzcGFjZU1hcC5zZXQobnMsIFtdKTtcclxuICAgICAgfVxyXG4gICAgICBuYW1lc3BhY2VNYXAuZ2V0KG5zKSEucHVzaChpZCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IGNvbmZsaWN0czogQXJyYXk8eyBuYW1lc3BhY2U6IHN0cmluZzsgcGx1Z2luczogc3RyaW5nW10gfT4gPSBbXTtcclxuICBuYW1lc3BhY2VNYXAuZm9yRWFjaCgocGx1Z2lucywgbmFtZXNwYWNlKSA9PiB7XHJcbiAgICBpZiAocGx1Z2lucy5sZW5ndGggPiAxKSB7XHJcbiAgICAgIGNvbmZsaWN0cy5wdXNoKHsgbmFtZXNwYWNlLCBwbHVnaW5zIH0pO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICByZXR1cm4geyB2YWxpZDogY29uZmxpY3RzLmxlbmd0aCA9PT0gMCwgY29uZmxpY3RzIH07XHJcbn1cclxuXHJcbi8vIEhlbHBlciB0byByZWFkIHJlcXVlc3QgYm9keVxyXG5hc3luYyBmdW5jdGlvbiByZWFkQm9keShyZXE6IGFueSk6IFByb21pc2U8YW55PiB7XHJcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XHJcbiAgICBsZXQgYm9keSA9ICcnO1xyXG4gICAgcmVxLm9uKCdkYXRhJywgKGNodW5rOiBCdWZmZXIpID0+IHsgYm9keSArPSBjaHVuay50b1N0cmluZygpOyB9KTtcclxuICAgIHJlcS5vbignZW5kJywgKCkgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIHJlc29sdmUoSlNPTi5wYXJzZShib2R5KSk7XHJcbiAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIHJlc29sdmUoe30pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9KTtcclxufVxyXG5cclxuLy8gSGVscGVyIHRvIHNlbmQgSlNPTiByZXNwb25zZVxyXG5mdW5jdGlvbiBzZW5kSnNvbihyZXM6IGFueSwgc3RhdHVzOiBudW1iZXIsIGRhdGE6IGFueSkge1xyXG4gIHJlcy5zdGF0dXNDb2RlID0gc3RhdHVzO1xyXG4gIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XHJcbiAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShkYXRhKSk7XHJcbn1cclxuXHJcbi8vID09PT09PT09PT0gQnVpbGQgRW52aXJvbm1lbnQgPT09PT09PT09PVxyXG5cclxuaW50ZXJmYWNlIEJ1aWxkRW52Q29uZmlnIHtcclxuICBhbmRyb2lkPzoge1xyXG4gICAgc2RrUGF0aD86IHN0cmluZztcclxuICAgIGphdmFIb21lPzogc3RyaW5nO1xyXG4gIH07XHJcbiAgaW9zPzoge1xyXG4gICAgeGNvZGVTZWxlY3RQYXRoPzogc3RyaW5nO1xyXG4gIH07XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGxvYWRCdWlsZEVudigpOiBQcm9taXNlPEJ1aWxkRW52Q29uZmlnPiB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShwYXRoLmpvaW4oY29uc3RhbnRzRGlyLCAnYnVpbGQtZW52Lmpzb24nKSwgJ3V0Zi04Jyk7XHJcbiAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShjb250ZW50KTtcclxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnNcclxuICAgIGNvbnN0IHsgJHNjaGVtYSwgLi4uY29uZmlnIH0gPSBkYXRhO1xyXG4gICAgcmV0dXJuIGNvbmZpZztcclxuICB9IGNhdGNoIHtcclxuICAgIHJldHVybiB7fTtcclxuICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHNhdmVCdWlsZEVudihjb25maWc6IEJ1aWxkRW52Q29uZmlnKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgY29uc3QgZGF0YSA9IHtcclxuICAgICRzY2hlbWE6ICcuL3NjaGVtYXMvYnVpbGQtZW52LnNjaGVtYS5qc29uJyxcclxuICAgIC4uLmNvbmZpZ1xyXG4gIH07XHJcbiAgYXdhaXQgZnMud3JpdGVGaWxlKFxyXG4gICAgcGF0aC5qb2luKGNvbnN0YW50c0RpciwgJ2J1aWxkLWVudi5qc29uJyksXHJcbiAgICBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSArICdcXG4nLFxyXG4gICAgJ3V0Zi04J1xyXG4gICk7XHJcbn1cclxuXHJcbi8vIGxvY2FsLnByb3BlcnRpZXMgXHVDNUM1XHVCMzcwXHVDNzc0XHVEMkI4XHJcbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUxvY2FsUHJvcGVydGllcyhzZGtQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICBjb25zdCBsb2NhbFByb3BzUGF0aCA9IHBhdGguam9pbihwcm9qZWN0Um9vdCwgJ2FuZHJvaWQnLCAnbG9jYWwucHJvcGVydGllcycpO1xyXG4gIC8vIFx1QUNCRFx1Qjg1Q1x1Qjk3QyBncmFkbGUgXHVENjE1XHVDMkREXHVDNzNDXHVCODVDIFx1QkNDMFx1RDY1OCAoXHVCQzMxXHVDMkFDXHVCNzk4XHVDMkRDIFx1Qzc3NFx1QzJBNFx1Q0YwMFx1Qzc3NFx1RDUwNClcclxuICBjb25zdCBlc2NhcGVkUGF0aCA9IHNka1BhdGgucmVwbGFjZSgvXFxcXC9nLCAnXFxcXFxcXFwnKS5yZXBsYWNlKC86L2csICdcXFxcOicpO1xyXG4gIGNvbnN0IGNvbnRlbnQgPSBgc2RrLmRpcj0ke2VzY2FwZWRQYXRofVxcbmA7XHJcbiAgYXdhaXQgZnMud3JpdGVGaWxlKGxvY2FsUHJvcHNQYXRoLCBjb250ZW50LCAndXRmLTgnKTtcclxufVxyXG5cclxuLy8gU0RLIFx1QUNCRFx1Qjg1QyBcdUM3MjBcdUQ2QThcdUMxMzEgXHVBQzgwXHVDMEFDIC0gXHVDNzk4XHVCQUJCXHVCNDFDIFx1QUNCRFx1Qjg1QyBcdUQzMjhcdUQxMzQgXHVBQzEwXHVDOUMwXHJcbmZ1bmN0aW9uIHZhbGlkYXRlU2RrUGF0aChzZGtQYXRoOiBzdHJpbmcpOiB7IHZhbGlkOiBib29sZWFuOyBpc3N1ZT86IHN0cmluZzsgc3VnZ2VzdGlvbj86IHN0cmluZyB9IHtcclxuICBjb25zdCBub3JtYWxpemVkUGF0aCA9IHBhdGgubm9ybWFsaXplKHNka1BhdGgpLnRvTG93ZXJDYXNlKCk7XHJcblxyXG4gIC8vIGNtZGxpbmUtdG9vbHMvYmluIFx1QjYxMFx1QjI5NCB0b29scy9iaW5cdUM3NDQgXHVDOUMxXHVDODExIFx1QUMwMFx1QjlBQ1x1RDBBNFx1QjI5NCBcdUFDQkRcdUM2QjBcclxuICBpZiAobm9ybWFsaXplZFBhdGguZW5kc1dpdGgoJ2JpbicpIHx8IG5vcm1hbGl6ZWRQYXRoLmVuZHNXaXRoKCdiaW5cXFxcJykgfHwgbm9ybWFsaXplZFBhdGguZW5kc1dpdGgoJ2Jpbi8nKSkge1xyXG4gICAgY29uc3QgcGFyZW50RGlyID0gcGF0aC5kaXJuYW1lKHNka1BhdGgpO1xyXG4gICAgY29uc3QgZ3JhbmRQYXJlbnREaXIgPSBwYXRoLmRpcm5hbWUocGFyZW50RGlyKTtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHZhbGlkOiBmYWxzZSxcclxuICAgICAgaXNzdWU6ICdTREsgcGF0aCBwb2ludHMgdG8gYmluIGZvbGRlcicsXHJcbiAgICAgIHN1Z2dlc3Rpb246IGBVc2UgU0RLIHJvb3QgaW5zdGVhZDogJHtncmFuZFBhcmVudERpcn1gXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLy8gY21kbGluZS10b29scyBcdUQzRjRcdUIzNTRcdUI5N0MgXHVDOUMxXHVDODExIFx1QUMwMFx1QjlBQ1x1RDBBNFx1QjI5NCBcdUFDQkRcdUM2QjBcclxuICBpZiAobm9ybWFsaXplZFBhdGguZW5kc1dpdGgoJ2NtZGxpbmUtdG9vbHMnKSB8fCBub3JtYWxpemVkUGF0aC5lbmRzV2l0aCgnY21kbGluZS10b29sc1xcXFwnKSB8fCBub3JtYWxpemVkUGF0aC5lbmRzV2l0aCgnY21kbGluZS10b29scy8nKSkge1xyXG4gICAgY29uc3QgcGFyZW50RGlyID0gcGF0aC5kaXJuYW1lKHNka1BhdGgpO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgdmFsaWQ6IGZhbHNlLFxyXG4gICAgICBpc3N1ZTogJ1NESyBwYXRoIHBvaW50cyB0byBjbWRsaW5lLXRvb2xzIGZvbGRlcicsXHJcbiAgICAgIHN1Z2dlc3Rpb246IGBVc2UgU0RLIHJvb3QgaW5zdGVhZDogJHtwYXJlbnREaXJ9YFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8vIHRvb2xzIFx1RDNGNFx1QjM1NFx1Qjk3QyBcdUM5QzFcdUM4MTEgXHVBQzAwXHVCOUFDXHVEMEE0XHVCMjk0IFx1QUNCRFx1QzZCMFxyXG4gIGlmIChub3JtYWxpemVkUGF0aC5lbmRzV2l0aCgndG9vbHMnKSB8fCBub3JtYWxpemVkUGF0aC5lbmRzV2l0aCgndG9vbHNcXFxcJykgfHwgbm9ybWFsaXplZFBhdGguZW5kc1dpdGgoJ3Rvb2xzLycpKSB7XHJcbiAgICBjb25zdCBwYXJlbnREaXIgPSBwYXRoLmRpcm5hbWUoc2RrUGF0aCk7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICB2YWxpZDogZmFsc2UsXHJcbiAgICAgIGlzc3VlOiAnU0RLIHBhdGggcG9pbnRzIHRvIHRvb2xzIGZvbGRlcicsXHJcbiAgICAgIHN1Z2dlc3Rpb246IGBVc2UgU0RLIHJvb3QgaW5zdGVhZDogJHtwYXJlbnREaXJ9YFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHJldHVybiB7IHZhbGlkOiB0cnVlIH07XHJcbn1cclxuXHJcbi8vIFNESyBcdUI3N0NcdUM3NzRcdUMxMjBcdUMyQTQgXHVDMEMxXHVEMERDIFx1RDY1NVx1Qzc3OFxyXG5hc3luYyBmdW5jdGlvbiBjaGVja1Nka0xpY2Vuc2VzKHNka1BhdGg6IHN0cmluZyk6IFByb21pc2U8eyBhY2NlcHRlZDogYm9vbGVhbjsgbWlzc2luZzogc3RyaW5nW10gfT4ge1xyXG4gIGNvbnN0IGxpY2Vuc2VzRGlyID0gcGF0aC5qb2luKHNka1BhdGgsICdsaWNlbnNlcycpO1xyXG5cclxuICBpZiAoIWZzU3luYy5leGlzdHNTeW5jKGxpY2Vuc2VzRGlyKSkge1xyXG4gICAgcmV0dXJuIHsgYWNjZXB0ZWQ6IGZhbHNlLCBtaXNzaW5nOiBbJ2xpY2Vuc2VzIGZvbGRlciBub3QgZm91bmQnXSB9O1xyXG4gIH1cclxuXHJcbiAgLy8gXHVENTQ0XHVDMjE4IFx1Qjc3Q1x1Qzc3NFx1QzEyMFx1QzJBNCBcdUQzMENcdUM3N0MgXHVCQUE5XHVCODVEXHJcbiAgY29uc3QgcmVxdWlyZWRMaWNlbnNlcyA9IFsnYW5kcm9pZC1zZGstbGljZW5zZSddO1xyXG4gIGNvbnN0IG1pc3Npbmc6IHN0cmluZ1tdID0gW107XHJcblxyXG4gIGZvciAoY29uc3QgbGljZW5zZSBvZiByZXF1aXJlZExpY2Vuc2VzKSB7XHJcbiAgICBjb25zdCBsaWNlbnNlUGF0aCA9IHBhdGguam9pbihsaWNlbnNlc0RpciwgbGljZW5zZSk7XHJcbiAgICBpZiAoIWZzU3luYy5leGlzdHNTeW5jKGxpY2Vuc2VQYXRoKSkge1xyXG4gICAgICBtaXNzaW5nLnB1c2gobGljZW5zZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4geyBhY2NlcHRlZDogbWlzc2luZy5sZW5ndGggPT09IDAsIG1pc3NpbmcgfTtcclxufVxyXG5cclxuLy8gU0RLIFx1QjhFOFx1RDJCOCBcdUFDQkRcdUI4NUMgXHVDRDk0XHVDODE1IChcdUM3OThcdUJBQkJcdUI0MUMgXHVBQ0JEXHVCODVDXHVDNUQwXHVDMTFDIFx1QzYyQ1x1QkMxNFx1Qjk3OCBcdUFDQkRcdUI4NUMgXHVDRDk0XHVDODE1KVxyXG5mdW5jdGlvbiBpbmZlclNka1Jvb3QoaW5wdXRQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGNvbnN0IG5vcm1hbGl6ZWRQYXRoID0gcGF0aC5ub3JtYWxpemUoaW5wdXRQYXRoKS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuICAvLyBiaW4gXHVEM0Y0XHVCMzU0XHVDNzc4IFx1QUNCRFx1QzZCMCAtPiAyLTNcdUIyRThcdUFDQzQgXHVDMEMxXHVDNzA0XHVCODVDXHJcbiAgaWYgKG5vcm1hbGl6ZWRQYXRoLmVuZHNXaXRoKCdiaW4nKSB8fCBub3JtYWxpemVkUGF0aC5lbmRzV2l0aCgnYmluXFxcXCcpIHx8IG5vcm1hbGl6ZWRQYXRoLmVuZHNXaXRoKCdiaW4vJykpIHtcclxuICAgIGNvbnN0IHBhcmVudCA9IHBhdGguZGlybmFtZShpbnB1dFBhdGgpO1xyXG4gICAgY29uc3QgZ3JhbmRQYXJlbnQgPSBwYXRoLmRpcm5hbWUocGFyZW50KTtcclxuICAgIC8vIGNtZGxpbmUtdG9vbHMvYmluIFx1QjYxMFx1QjI5NCBjbWRsaW5lLXRvb2xzL2xhdGVzdC9iaW4gXHVBRDZDXHVDODcwIFx1Q0M5OFx1QjlBQ1xyXG4gICAgaWYgKGdyYW5kUGFyZW50LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2NtZGxpbmUtdG9vbHMnKSkge1xyXG4gICAgICByZXR1cm4gcGF0aC5kaXJuYW1lKGdyYW5kUGFyZW50KTtcclxuICAgIH1cclxuICAgIHJldHVybiBncmFuZFBhcmVudDtcclxuICB9XHJcblxyXG4gIC8vIGNtZGxpbmUtdG9vbHMgXHVEM0Y0XHVCMzU0XHVDNzc4IFx1QUNCRFx1QzZCMCAtPiAxXHVCMkU4XHVBQ0M0IFx1QzBDMVx1QzcwNFx1Qjg1Q1xyXG4gIGlmIChub3JtYWxpemVkUGF0aC5lbmRzV2l0aCgnY21kbGluZS10b29scycpIHx8IG5vcm1hbGl6ZWRQYXRoLmVuZHNXaXRoKCdjbWRsaW5lLXRvb2xzXFxcXCcpIHx8IG5vcm1hbGl6ZWRQYXRoLmVuZHNXaXRoKCdjbWRsaW5lLXRvb2xzLycpKSB7XHJcbiAgICByZXR1cm4gcGF0aC5kaXJuYW1lKGlucHV0UGF0aCk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gaW5wdXRQYXRoO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBjaGVja0J1aWxkRW52aXJvbm1lbnQoKTogUHJvbWlzZTxBcnJheTx7IG5hbWU6IHN0cmluZzsgc3RhdHVzOiBzdHJpbmc7IG1lc3NhZ2U6IHN0cmluZzsgZGV0YWlsPzogc3RyaW5nOyBndWlkYW5jZT86IHN0cmluZyB9Pj4ge1xyXG4gIGNvbnN0IGNoZWNrczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHN0YXR1czogc3RyaW5nOyBtZXNzYWdlOiBzdHJpbmc7IGRldGFpbD86IHN0cmluZzsgZ3VpZGFuY2U/OiBzdHJpbmcgfT4gPSBbXTtcclxuICBjb25zdCBidWlsZEVudiA9IGF3YWl0IGxvYWRCdWlsZEVudigpO1xyXG5cclxuICAvLyAxLiBOb2RlLmpzXHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ25vZGUgLXYnKTtcclxuICAgIGNoZWNrcy5wdXNoKHsgbmFtZTogJ05vZGUuanMnLCBzdGF0dXM6ICdvaycsIG1lc3NhZ2U6IHN0ZG91dC50cmltKCkgfSk7XHJcbiAgfSBjYXRjaCB7XHJcbiAgICBjaGVja3MucHVzaCh7XHJcbiAgICAgIG5hbWU6ICdOb2RlLmpzJyxcclxuICAgICAgc3RhdHVzOiAnZXJyb3InLFxyXG4gICAgICBtZXNzYWdlOiAnTm90IGluc3RhbGxlZCcsXHJcbiAgICAgIGd1aWRhbmNlOiAnSW5zdGFsbCBOb2RlLmpzIGZyb20gaHR0cHM6Ly9ub2RlanMub3JnLydcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8gMi4gbnBtXHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjQXN5bmMoJ25wbSAtdicpO1xyXG4gICAgY2hlY2tzLnB1c2goeyBuYW1lOiAnbnBtJywgc3RhdHVzOiAnb2snLCBtZXNzYWdlOiBgdiR7c3Rkb3V0LnRyaW0oKX1gIH0pO1xyXG4gIH0gY2F0Y2gge1xyXG4gICAgY2hlY2tzLnB1c2goe1xyXG4gICAgICBuYW1lOiAnbnBtJyxcclxuICAgICAgc3RhdHVzOiAnZXJyb3InLFxyXG4gICAgICBtZXNzYWdlOiAnTm90IGluc3RhbGxlZCcsXHJcbiAgICAgIGd1aWRhbmNlOiAnbnBtIGlzIGluY2x1ZGVkIHdpdGggTm9kZS5qcyBpbnN0YWxsYXRpb24nXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIDMuIEphdmEgLSBidWlsZC1lbnYuanNvblx1Qzc1OCBqYXZhSG9tZSBcdUM2QjBcdUMxMjAgXHVDMEFDXHVDNkE5XHJcbiAgY29uc3QgamF2YUhvbWUgPSBidWlsZEVudi5hbmRyb2lkPy5qYXZhSG9tZSB8fCBwcm9jZXNzLmVudi5KQVZBX0hPTUU7XHJcbiAgaWYgKGphdmFIb21lKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBqYXZhQ21kID0gcGF0aC5qb2luKGphdmFIb21lLCAnYmluJywgJ2phdmEnKTtcclxuICAgICAgY29uc3QgeyBzdGRlcnIgfSA9IGF3YWl0IGV4ZWNBc3luYyhgXCIke2phdmFDbWR9XCIgLXZlcnNpb25gKTtcclxuICAgICAgY29uc3QgbWF0Y2ggPSBzdGRlcnIubWF0Y2goL3ZlcnNpb24gXCIoW15cIl0rKVwiLyk7XHJcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBtYXRjaCA/IG1hdGNoWzFdIDogJ1Vua25vd24nO1xyXG4gICAgICBjb25zdCBtYWpvciA9IHBhcnNlSW50KHZlcnNpb24uc3BsaXQoJy4nKVswXSk7XHJcbiAgICAgIGlmIChtYWpvciA+PSAxNyAmJiBtYWpvciA8PSAyMSkge1xyXG4gICAgICAgIGNoZWNrcy5wdXNoKHsgbmFtZTogJ0phdmEnLCBzdGF0dXM6ICdvaycsIG1lc3NhZ2U6IHZlcnNpb24gfSk7XHJcbiAgICAgIH0gZWxzZSBpZiAobWFqb3IgPiAyMSkge1xyXG4gICAgICAgIGNoZWNrcy5wdXNoKHsgbmFtZTogJ0phdmEnLCBzdGF0dXM6ICd3YXJuaW5nJywgbWVzc2FnZTogdmVyc2lvbiwgZGV0YWlsOiAnSkRLIDE3LTIxIHJlY29tbWVuZGVkJyB9KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjaGVja3MucHVzaCh7XHJcbiAgICAgICAgICBuYW1lOiAnSmF2YScsXHJcbiAgICAgICAgICBzdGF0dXM6ICdlcnJvcicsXHJcbiAgICAgICAgICBtZXNzYWdlOiB2ZXJzaW9uLFxyXG4gICAgICAgICAgZGV0YWlsOiAnSkRLIDE3KyByZXF1aXJlZCcsXHJcbiAgICAgICAgICBndWlkYW5jZTogJ0luc3RhbGwgSkRLIDE3IG9yIGhpZ2hlciBmcm9tIGh0dHBzOi8vYWRvcHRpdW0ubmV0LydcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCB7XHJcbiAgICAgIC8vIGZhbGxiYWNrIHRvIHN5c3RlbSBqYXZhXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgeyBzdGRlcnIgfSA9IGF3YWl0IGV4ZWNBc3luYygnamF2YSAtdmVyc2lvbicpO1xyXG4gICAgICAgIGNvbnN0IG1hdGNoID0gc3RkZXJyLm1hdGNoKC92ZXJzaW9uIFwiKFteXCJdKylcIi8pO1xyXG4gICAgICAgIGNvbnN0IHZlcnNpb24gPSBtYXRjaCA/IG1hdGNoWzFdIDogJ1Vua25vd24nO1xyXG4gICAgICAgIGNoZWNrcy5wdXNoKHsgbmFtZTogJ0phdmEnLCBzdGF0dXM6ICdvaycsIG1lc3NhZ2U6IHZlcnNpb24gfSk7XHJcbiAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIGNoZWNrcy5wdXNoKHtcclxuICAgICAgICAgIG5hbWU6ICdKYXZhJyxcclxuICAgICAgICAgIHN0YXR1czogJ2Vycm9yJyxcclxuICAgICAgICAgIG1lc3NhZ2U6ICdOb3QgaW5zdGFsbGVkJyxcclxuICAgICAgICAgIGRldGFpbDogJ0pESyAxNysgcmVxdWlyZWQnLFxyXG4gICAgICAgICAgZ3VpZGFuY2U6ICdJbnN0YWxsIEpESyAxNyBmcm9tIGh0dHBzOi8vYWRvcHRpdW0ubmV0LydcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0gZWxzZSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCB7IHN0ZGVyciB9ID0gYXdhaXQgZXhlY0FzeW5jKCdqYXZhIC12ZXJzaW9uJyk7XHJcbiAgICAgIGNvbnN0IG1hdGNoID0gc3RkZXJyLm1hdGNoKC92ZXJzaW9uIFwiKFteXCJdKylcIi8pO1xyXG4gICAgICBjb25zdCB2ZXJzaW9uID0gbWF0Y2ggPyBtYXRjaFsxXSA6ICdVbmtub3duJztcclxuICAgICAgY2hlY2tzLnB1c2goeyBuYW1lOiAnSmF2YScsIHN0YXR1czogJ29rJywgbWVzc2FnZTogdmVyc2lvbiB9KTtcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICBjaGVja3MucHVzaCh7XHJcbiAgICAgICAgbmFtZTogJ0phdmEnLFxyXG4gICAgICAgIHN0YXR1czogJ2Vycm9yJyxcclxuICAgICAgICBtZXNzYWdlOiAnTm90IGluc3RhbGxlZCcsXHJcbiAgICAgICAgZGV0YWlsOiAnSkRLIDE3KyByZXF1aXJlZCcsXHJcbiAgICAgICAgZ3VpZGFuY2U6ICdJbnN0YWxsIEpESyAxNyBmcm9tIGh0dHBzOi8vYWRvcHRpdW0ubmV0LydcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyA0LiBKQVZBX0hPTUVcclxuICBpZiAoYnVpbGRFbnYuYW5kcm9pZD8uamF2YUhvbWUpIHtcclxuICAgIGNoZWNrcy5wdXNoKHsgbmFtZTogJ0pBVkFfSE9NRScsIHN0YXR1czogJ29rJywgbWVzc2FnZTogYnVpbGRFbnYuYW5kcm9pZC5qYXZhSG9tZSwgZGV0YWlsOiAnKGNvbmZpZyknIH0pO1xyXG4gIH0gZWxzZSBpZiAocHJvY2Vzcy5lbnYuSkFWQV9IT01FKSB7XHJcbiAgICBjaGVja3MucHVzaCh7IG5hbWU6ICdKQVZBX0hPTUUnLCBzdGF0dXM6ICdvaycsIG1lc3NhZ2U6IHByb2Nlc3MuZW52LkpBVkFfSE9NRSB9KTtcclxuICB9IGVsc2Uge1xyXG4gICAgY2hlY2tzLnB1c2goe1xyXG4gICAgICBuYW1lOiAnSkFWQV9IT01FJyxcclxuICAgICAgc3RhdHVzOiAnd2FybmluZycsXHJcbiAgICAgIG1lc3NhZ2U6ICdOb3Qgc2V0JyxcclxuICAgICAgZ3VpZGFuY2U6ICdTZXQgSmF2YSBIb21lIHBhdGggaW4gRW52aXJvbm1lbnQgU2V0dGluZ3MgYWJvdmUnXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIDUuIEFuZHJvaWQgU0RLIC0gYnVpbGQtZW52Lmpzb25cdUM3NTggc2RrUGF0aCBcdUM2QjBcdUMxMjAgXHVDMEFDXHVDNkE5XHJcbiAgY29uc3QgYW5kcm9pZEhvbWUgPSBidWlsZEVudi5hbmRyb2lkPy5zZGtQYXRoIHx8IHByb2Nlc3MuZW52LkFORFJPSURfSE9NRSB8fCBwcm9jZXNzLmVudi5BTkRST0lEX1NES19ST09UO1xyXG4gIGlmIChhbmRyb2lkSG9tZSkge1xyXG4gICAgLy8gXHVCQTNDXHVDODAwIFx1QUNCRFx1Qjg1QyBcdUM3MjBcdUQ2QThcdUMxMzEgXHVBQzgwXHVDMEFDXHJcbiAgICBjb25zdCBwYXRoVmFsaWRhdGlvbiA9IHZhbGlkYXRlU2RrUGF0aChhbmRyb2lkSG9tZSk7XHJcblxyXG4gICAgaWYgKCFwYXRoVmFsaWRhdGlvbi52YWxpZCkge1xyXG4gICAgICAvLyBcdUM3OThcdUJBQkJcdUI0MUMgXHVBQ0JEXHVCODVDIFx1RDMyOFx1RDEzNCBcdUFDMTBcdUM5QzBcclxuICAgICAgY29uc3QgaW5mZXJyZWRSb290ID0gaW5mZXJTZGtSb290KGFuZHJvaWRIb21lKTtcclxuICAgICAgY2hlY2tzLnB1c2goe1xyXG4gICAgICAgIG5hbWU6ICdBbmRyb2lkIFNESycsXHJcbiAgICAgICAgc3RhdHVzOiAnZXJyb3InLFxyXG4gICAgICAgIG1lc3NhZ2U6IHBhdGhWYWxpZGF0aW9uLmlzc3VlIHx8ICdJbnZhbGlkIFNESyBwYXRoJyxcclxuICAgICAgICBkZXRhaWw6IGFuZHJvaWRIb21lLFxyXG4gICAgICAgIGd1aWRhbmNlOiBwYXRoVmFsaWRhdGlvbi5zdWdnZXN0aW9uIHx8IGBTREsgcm9vdCBzaG91bGQgY29udGFpbiBjbWRsaW5lLXRvb2xzLCBsaWNlbnNlcyBmb2xkZXJzLiBUcnk6ICR7aW5mZXJyZWRSb290fWBcclxuICAgICAgfSk7XHJcbiAgICB9IGVsc2UgaWYgKGZzU3luYy5leGlzdHNTeW5jKHBhdGguam9pbihhbmRyb2lkSG9tZSwgJ2NtZGxpbmUtdG9vbHMnKSkgfHxcclxuICAgICAgICAgICAgICAgZnNTeW5jLmV4aXN0c1N5bmMocGF0aC5qb2luKGFuZHJvaWRIb21lLCAndG9vbHMnKSkgfHxcclxuICAgICAgICAgICAgICAgZnNTeW5jLmV4aXN0c1N5bmMocGF0aC5qb2luKGFuZHJvaWRIb21lLCAnbGljZW5zZXMnKSkpIHtcclxuICAgICAgLy8gY21kbGluZS10b29scywgdG9vbHMsIFx1QjYxMFx1QjI5NCBsaWNlbnNlcyBcdUQzRjRcdUIzNTRcdUFDMDAgXHVDNzg4XHVDNzNDXHVCQTc0IFx1QzcyMFx1RDZBOFx1RDU1QyBTREtcdUI4NUMgXHVDNzc4XHVDODE1XHJcbiAgICAgIGNvbnN0IHNvdXJjZSA9IGJ1aWxkRW52LmFuZHJvaWQ/LnNka1BhdGggPyAnKGNvbmZpZyknIDogdW5kZWZpbmVkO1xyXG4gICAgICBjb25zdCBoYXNQbGF0Zm9ybVRvb2xzID0gZnNTeW5jLmV4aXN0c1N5bmMocGF0aC5qb2luKGFuZHJvaWRIb21lLCAncGxhdGZvcm0tdG9vbHMnKSk7XHJcblxyXG4gICAgICBjaGVja3MucHVzaCh7XHJcbiAgICAgICAgbmFtZTogJ0FuZHJvaWQgU0RLJyxcclxuICAgICAgICBzdGF0dXM6ICdvaycsXHJcbiAgICAgICAgbWVzc2FnZTogYW5kcm9pZEhvbWUsXHJcbiAgICAgICAgZGV0YWlsOiBzb3VyY2VcclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBwbGF0Zm9ybS10b29sc1x1QjI5NCBpbmZvIFx1QjgwOFx1QkNBOFx1Qjg1QyBcdUQ0NUNcdUMyREMgKFx1QkU0Q1x1QjREQ1x1QzVEMFx1QjI5NCBcdUQ1NDRcdUM2OTQgXHVDNUM2XHVDNzRDKVxyXG4gICAgICBpZiAoIWhhc1BsYXRmb3JtVG9vbHMpIHtcclxuICAgICAgICBjaGVja3MucHVzaCh7XHJcbiAgICAgICAgICBuYW1lOiAnUGxhdGZvcm0gVG9vbHMnLFxyXG4gICAgICAgICAgc3RhdHVzOiAnaW5mbycsXHJcbiAgICAgICAgICBtZXNzYWdlOiAnTm90IGluc3RhbGxlZCcsXHJcbiAgICAgICAgICBkZXRhaWw6ICdPcHRpb25hbCAtIG5lZWRlZCBmb3IgYWRiIChkZXZpY2UgZGVidWdnaW5nKScsXHJcbiAgICAgICAgICBndWlkYW5jZTogJ1J1bjogc2RrbWFuYWdlciBcInBsYXRmb3JtLXRvb2xzXCIgaWYgeW91IG5lZWQgYWRiJ1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBcdUI3N0NcdUM3NzRcdUMxMjBcdUMyQTQgXHVENjU1XHVDNzc4XHJcbiAgICAgIGNvbnN0IGxpY2Vuc2VDaGVjayA9IGF3YWl0IGNoZWNrU2RrTGljZW5zZXMoYW5kcm9pZEhvbWUpO1xyXG4gICAgICBpZiAoIWxpY2Vuc2VDaGVjay5hY2NlcHRlZCkge1xyXG4gICAgICAgIGNoZWNrcy5wdXNoKHtcclxuICAgICAgICAgIG5hbWU6ICdTREsgTGljZW5zZXMnLFxyXG4gICAgICAgICAgc3RhdHVzOiAnZXJyb3InLFxyXG4gICAgICAgICAgbWVzc2FnZTogJ05vdCBhY2NlcHRlZCcsXHJcbiAgICAgICAgICBkZXRhaWw6IGxpY2Vuc2VDaGVjay5taXNzaW5nLmpvaW4oJywgJyksXHJcbiAgICAgICAgICBndWlkYW5jZTogYFJ1bjogc2RrbWFuYWdlciAtLWxpY2Vuc2VzYFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNoZWNrcy5wdXNoKHsgbmFtZTogJ1NESyBMaWNlbnNlcycsIHN0YXR1czogJ29rJywgbWVzc2FnZTogJ0FjY2VwdGVkJyB9KTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gXHVBQ0JEXHVCODVDXHVCMjk0IFx1Qzc4OFx1QzlDMFx1QjlDQyBTREsgXHVBRDZDXHVDODcwXHVBQzAwIFx1QzU0NFx1QjJEOFxyXG4gICAgICBjaGVja3MucHVzaCh7XHJcbiAgICAgICAgbmFtZTogJ0FuZHJvaWQgU0RLJyxcclxuICAgICAgICBzdGF0dXM6ICdlcnJvcicsXHJcbiAgICAgICAgbWVzc2FnZTogJ0ludmFsaWQgU0RLIHN0cnVjdHVyZScsXHJcbiAgICAgICAgZGV0YWlsOiBhbmRyb2lkSG9tZSxcclxuICAgICAgICBndWlkYW5jZTogJ1RoZSBwYXRoIHNob3VsZCBiZSB0aGUgU0RLIHJvb3QgY29udGFpbmluZyBjbWRsaW5lLXRvb2xzIG9yIHRvb2xzIGZvbGRlci4gRG93bmxvYWQgQW5kcm9pZCBTREsgZnJvbSBodHRwczovL2RldmVsb3Blci5hbmRyb2lkLmNvbS9zdHVkaW8nXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH0gZWxzZSB7XHJcbiAgICBjaGVja3MucHVzaCh7XHJcbiAgICAgIG5hbWU6ICdBbmRyb2lkIFNESycsXHJcbiAgICAgIHN0YXR1czogJ2Vycm9yJyxcclxuICAgICAgbWVzc2FnZTogJ05vdCBmb3VuZCcsXHJcbiAgICAgIGRldGFpbDogJ1NldCBBTkRST0lEX0hPTUUgb3IgY29uZmlndXJlIGluIHNldHRpbmdzJyxcclxuICAgICAgZ3VpZGFuY2U6ICdTZXQgQW5kcm9pZCBTREsgUGF0aCBpbiBFbnZpcm9ubWVudCBTZXR0aW5ncyBhYm92ZSwgb3Igc2V0IEFORFJPSURfSE9NRSBlbnZpcm9ubWVudCB2YXJpYWJsZSdcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8gNi4gRUFTIENMSVxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCducHggZWFzIC0tdmVyc2lvbicpO1xyXG4gICAgY2hlY2tzLnB1c2goeyBuYW1lOiAnRUFTIENMSScsIHN0YXR1czogJ29rJywgbWVzc2FnZTogc3Rkb3V0LnRyaW0oKSB9KTtcclxuICB9IGNhdGNoIHtcclxuICAgIGNoZWNrcy5wdXNoKHtcclxuICAgICAgbmFtZTogJ0VBUyBDTEknLFxyXG4gICAgICBzdGF0dXM6ICdpbmZvJyxcclxuICAgICAgbWVzc2FnZTogJ05vdCBpbnN0YWxsZWQnLFxyXG4gICAgICBkZXRhaWw6ICdSZXF1aXJlZCBmb3IgY2xvdWQgYnVpbGRzJyxcclxuICAgICAgZ3VpZGFuY2U6ICdSdW46IG5wbSBpbnN0YWxsIC1nIGVhcy1jbGknXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIDcuIGFuZHJvaWQgZm9sZGVyXHJcbiAgaWYgKGZzU3luYy5leGlzdHNTeW5jKHBhdGguam9pbihwcm9qZWN0Um9vdCwgJ2FuZHJvaWQnKSkpIHtcclxuICAgIGNoZWNrcy5wdXNoKHsgbmFtZTogJ0FuZHJvaWQgUHJvamVjdCcsIHN0YXR1czogJ29rJywgbWVzc2FnZTogJ0ZvdW5kJyB9KTtcclxuICB9IGVsc2Uge1xyXG4gICAgY2hlY2tzLnB1c2goe1xyXG4gICAgICBuYW1lOiAnQW5kcm9pZCBQcm9qZWN0JyxcclxuICAgICAgc3RhdHVzOiAnaW5mbycsXHJcbiAgICAgIG1lc3NhZ2U6ICdOb3QgZm91bmQnLFxyXG4gICAgICBkZXRhaWw6ICdSdW4gZXhwbyBwcmVidWlsZCBmaXJzdCcsXHJcbiAgICAgIGd1aWRhbmNlOiAnUnVuOiBucHggZXhwbyBwcmVidWlsZCAtLXBsYXRmb3JtIGFuZHJvaWQnXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIDguIEtleXN0b3JlXHJcbiAgY29uc3Qga2V5c3RvcmVQYXRocyA9IFtcclxuICAgIHBhdGguam9pbihwcm9qZWN0Um9vdCwgJ2FuZHJvaWQnLCAnYXBwJywgJ3JlbGVhc2Uua2V5c3RvcmUnKSxcclxuICAgIHBhdGguam9pbihwcm9qZWN0Um9vdCwgJ2FuZHJvaWQnLCAnYXBwJywgJ215LXJlbGVhc2Uta2V5LmtleXN0b3JlJyksXHJcbiAgICBwYXRoLmpvaW4ocHJvamVjdFJvb3QsICdhbmRyb2lkJywgJ2tleXN0b3JlcycsICdyZWxlYXNlLmtleXN0b3JlJylcclxuICBdO1xyXG4gIGNvbnN0IGhhc0tleXN0b3JlID0ga2V5c3RvcmVQYXRocy5zb21lKHAgPT4gZnNTeW5jLmV4aXN0c1N5bmMocCkpO1xyXG4gIGlmIChoYXNLZXlzdG9yZSkge1xyXG4gICAgY2hlY2tzLnB1c2goeyBuYW1lOiAnUmVsZWFzZSBLZXlzdG9yZScsIHN0YXR1czogJ29rJywgbWVzc2FnZTogJ0ZvdW5kJyB9KTtcclxuICB9IGVsc2Uge1xyXG4gICAgY2hlY2tzLnB1c2goe1xyXG4gICAgICBuYW1lOiAnUmVsZWFzZSBLZXlzdG9yZScsXHJcbiAgICAgIHN0YXR1czogJ2luZm8nLFxyXG4gICAgICBtZXNzYWdlOiAnTm90IGZvdW5kJyxcclxuICAgICAgZGV0YWlsOiAnUmVxdWlyZWQgZm9yIHJlbGVhc2UgYnVpbGRzJyxcclxuICAgICAgZ3VpZGFuY2U6ICdHZW5lcmF0ZSBhIGtleXN0b3JlIGluIHRoZSBLZXlzdG9yZSBzZWN0aW9uIGJlbG93J1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gY2hlY2tzO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzdGFydEJ1aWxkUHJvY2Vzcyh0eXBlOiBzdHJpbmcsIHByb2ZpbGU6IHN0cmluZywgYnVpbGRJZDogc3RyaW5nLCByZXRyeUNvdW50ID0gMCk6IEJ1aWxkUHJvY2VzcyB7XHJcbiAgY29uc3Qgb3V0cHV0OiBBcnJheTx7IHR5cGU6IHN0cmluZzsgdGV4dDogc3RyaW5nOyB0aW1lc3RhbXA6IG51bWJlciB9PiA9IFtdO1xyXG4gIGxldCBjbWQ6IHN0cmluZztcclxuICBsZXQgYXJnczogc3RyaW5nW107XHJcbiAgbGV0IGxpY2Vuc2VFcnJvckRldGVjdGVkID0gZmFsc2U7XHJcbiAgbGV0IGFsbE91dHB1dFRleHQgPSAnJzsgLy8gXHVDODA0XHVDQ0I0IFx1Q0Q5Q1x1QjgyNVx1Qzc0NCBcdUIyMDRcdUM4MDFcdUQ1NThcdUM1RUMgXHVCNzdDXHVDNzc0XHVDMTIwXHVDMkE0IFx1QzVEMFx1QjdFQyBcdUFDMTBcdUM5QzBcclxuXHJcbiAgaWYgKHR5cGUgPT09ICdjbG91ZCcpIHtcclxuICAgIC8vIEVBUyBDbG91ZCBCdWlsZFxyXG4gICAgY21kID0gJ25weCc7XHJcbiAgICBhcmdzID0gWydlYXMnLCAnYnVpbGQnLCAnLS1wbGF0Zm9ybScsICdhbmRyb2lkJywgJy0tcHJvZmlsZScsIHByb2ZpbGUsICctLW5vbi1pbnRlcmFjdGl2ZSddO1xyXG4gICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnaW5mbycsIHRleHQ6IGBTdGFydGluZyBFQVMgY2xvdWQgYnVpbGQgKCR7cHJvZmlsZX0pLi4uYCwgdGltZXN0YW1wOiBEYXRlLm5vdygpIH0pO1xyXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2V4cG8tZGV2Jykge1xyXG4gICAgLy8gRXhwbyBEZXZlbG9wbWVudCBCdWlsZCAobnB4IGV4cG8gcnVuOmFuZHJvaWQpXHJcbiAgICBjbWQgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInID8gJ2NtZCcgOiAnc2gnO1xyXG4gICAgY29uc3QgZGV2U2NyaXB0ID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJ1xyXG4gICAgICA/IGBub2RlIHNjcmlwdHNcXFxcc2V0dXAtcGx1Z2lucy5qcyAmJiBucHggZXhwbyBydW46YW5kcm9pZCAtLW5vLWluc3RhbGxgXHJcbiAgICAgIDogYG5vZGUgc2NyaXB0cy9zZXR1cC1wbHVnaW5zLmpzICYmIG5weCBleHBvIHJ1bjphbmRyb2lkIC0tbm8taW5zdGFsbGA7XHJcbiAgICBhcmdzID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/IFsnL2MnLCBkZXZTY3JpcHRdIDogWyctYycsIGRldlNjcmlwdF07XHJcbiAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdpbmZvJywgdGV4dDogJ1N0YXJ0aW5nIEV4cG8gZGV2ZWxvcG1lbnQgYnVpbGQuLi4nLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcbiAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdpbmZvJywgdGV4dDogJ0J1aWxkaW5nIGRldmVsb3BtZW50IGNsaWVudCBBUEsuLi4nLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcbiAgfSBlbHNlIHtcclxuICAgIC8vIExvY2FsIEJ1aWxkIC0gbmVlZCB0byBydW4gcHJlYnVpbGQgZmlyc3QsIHRoZW4gZ3JhZGxlXHJcbiAgICBjb25zdCBncmFkbGVUYXNrID0gcHJvZmlsZSA9PT0gJ2RlYnVnJyA/ICdhc3NlbWJsZURlYnVnJyA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgcHJvZmlsZSA9PT0gJ3JlbGVhc2UtYXBrJyA/ICdhc3NlbWJsZVJlbGVhc2UnIDpcclxuICAgICAgICAgICAgICAgICAgICAgICAnYnVuZGxlUmVsZWFzZSc7XHJcblxyXG4gICAgLy8gQ3JlYXRlIGEgYmF0Y2ggc2NyaXB0IHRvIHJ1biB0aGUgZnVsbCBidWlsZCBzZXF1ZW5jZVxyXG4gICAgY21kID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/ICdjbWQnIDogJ3NoJztcclxuICAgIGNvbnN0IGJ1aWxkU2NyaXB0ID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJ1xyXG4gICAgICA/IGBub2RlIHNjcmlwdHNcXFxcc2V0dXAtcGx1Z2lucy5qcyAmJiBucHggZXhwbyBwcmVidWlsZCAtLXBsYXRmb3JtIGFuZHJvaWQgJiYgY2QgYW5kcm9pZCAmJiAuXFxcXGdyYWRsZXcgJHtncmFkbGVUYXNrfWBcclxuICAgICAgOiBgbm9kZSBzY3JpcHRzL3NldHVwLXBsdWdpbnMuanMgJiYgbnB4IGV4cG8gcHJlYnVpbGQgLS1wbGF0Zm9ybSBhbmRyb2lkICYmIGNkIGFuZHJvaWQgJiYgLi9ncmFkbGV3ICR7Z3JhZGxlVGFza31gO1xyXG4gICAgYXJncyA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicgPyBbJy9jJywgYnVpbGRTY3JpcHRdIDogWyctYycsIGJ1aWxkU2NyaXB0XTtcclxuXHJcbiAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdpbmZvJywgdGV4dDogYFN0YXJ0aW5nIGxvY2FsIGJ1aWxkICgke3Byb2ZpbGV9KS4uLmAsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgIG91dHB1dC5wdXNoKHsgdHlwZTogJ2luZm8nLCB0ZXh0OiBgR3JhZGxlIHRhc2s6ICR7Z3JhZGxlVGFza31gLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcbiAgfVxyXG5cclxuICBjb25zdCBwcm9jID0gc3Bhd24oY21kLCBhcmdzLCB7XHJcbiAgICBjd2Q6IHByb2plY3RSb290LFxyXG4gICAgc2hlbGw6IGZhbHNlLFxyXG4gICAgZW52OiB7IC4uLnByb2Nlc3MuZW52LCBGT1JDRV9DT0xPUjogJzAnIH1cclxuICB9KTtcclxuXHJcbiAgY29uc3QgYnVpbGRQcm9jZXNzOiBCdWlsZFByb2Nlc3MgPSB7IHByb2Nlc3M6IHByb2MsIG91dHB1dCwgZmluaXNoZWQ6IGZhbHNlIH07XHJcblxyXG4gIGNvbnN0IGNoZWNrQW5kSGFuZGxlTGljZW5zZUVycm9yID0gKHRleHQ6IHN0cmluZykgPT4ge1xyXG4gICAgYWxsT3V0cHV0VGV4dCArPSB0ZXh0ICsgJ1xcbic7XHJcbiAgICBpZiAoIWxpY2Vuc2VFcnJvckRldGVjdGVkICYmIGRldGVjdExpY2Vuc2VFcnJvcihhbGxPdXRwdXRUZXh0KSkge1xyXG4gICAgICBsaWNlbnNlRXJyb3JEZXRlY3RlZCA9IHRydWU7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgcHJvYy5zdGRvdXQ/Lm9uKCdkYXRhJywgKGRhdGE6IEJ1ZmZlcikgPT4ge1xyXG4gICAgY29uc3QgdGV4dCA9IGRhdGEudG9TdHJpbmcoKS50cmltKCk7XHJcbiAgICBpZiAodGV4dCkge1xyXG4gICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdzdGRvdXQnLCB0ZXh0LCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcbiAgICAgIGNoZWNrQW5kSGFuZGxlTGljZW5zZUVycm9yKHRleHQpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICBwcm9jLnN0ZGVycj8ub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB7XHJcbiAgICBjb25zdCB0ZXh0ID0gZGF0YS50b1N0cmluZygpLnRyaW0oKTtcclxuICAgIGlmICh0ZXh0KSB7XHJcbiAgICAgIG91dHB1dC5wdXNoKHsgdHlwZTogJ3N0ZGVycicsIHRleHQsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgICAgY2hlY2tBbmRIYW5kbGVMaWNlbnNlRXJyb3IodGV4dCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIHByb2Mub24oJ2Nsb3NlJywgYXN5bmMgKGNvZGUpID0+IHtcclxuICAgIC8vIFx1Qjc3Q1x1Qzc3NFx1QzEyMFx1QzJBNCBcdUM1RDBcdUI3RUNcdUFDMDAgXHVBQzEwXHVDOUMwXHVCNDE4XHVBQ0UwIFx1QzdBQ1x1QzJEQ1x1QjNDNCBcdUQ2OUZcdUMyMThcdUFDMDAgXHVCMEE4XHVDNTQ0XHVDNzg4XHVDNzNDXHVCQTc0IFx1Qzc5MFx1QjNEOSBcdUMyMThcdUM4MTUgXHVENkM0IFx1QzdBQ1x1QkU0Q1x1QjREQ1xyXG4gICAgaWYgKGNvZGUgIT09IDAgJiYgbGljZW5zZUVycm9yRGV0ZWN0ZWQgJiYgcmV0cnlDb3VudCA8IDIpIHtcclxuICAgICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnaW5mbycsIHRleHQ6ICdcdTI2QTBcdUZFMEYgU0RLL05ESyBsaWNlbnNlIGlzc3VlIGRldGVjdGVkLiBBdHRlbXB0aW5nIGF1dG9tYXRpYyBmaXguLi4nLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcblxyXG4gICAgICAvLyBidWlsZC1lbnYuanNvblx1QzVEMFx1QzExQyBTREsgXHVBQ0JEXHVCODVDIFx1QUMwMFx1QzgzOFx1QzYyNFx1QUUzMFxyXG4gICAgICBjb25zdCBidWlsZEVudiA9IGF3YWl0IGxvYWRCdWlsZEVudigpO1xyXG4gICAgICBjb25zdCBzZGtQYXRoID0gYnVpbGRFbnYuYW5kcm9pZD8uc2RrUGF0aDtcclxuXHJcbiAgICAgIG91dHB1dC5wdXNoKHsgdHlwZTogJ2luZm8nLCB0ZXh0OiAnQWNjZXB0aW5nIFNESyBsaWNlbnNlcy4uLicsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgICAgY29uc3QgbGljZW5zZVJlc3VsdCA9IGF3YWl0IGFjY2VwdFNka0xpY2Vuc2VzKHNka1BhdGgpO1xyXG5cclxuICAgICAgaWYgKGxpY2Vuc2VSZXN1bHQuc3VjY2Vzcykge1xyXG4gICAgICAgIG91dHB1dC5wdXNoKHsgdHlwZTogJ3N1Y2Nlc3MnLCB0ZXh0OiBgXHUyNzEzICR7bGljZW5zZVJlc3VsdC5tZXNzYWdlfWAsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdpbmZvJywgdGV4dDogJ1x1RDgzRFx1REQwNCBSZXN0YXJ0aW5nIGJ1aWxkLi4uJywgdGltZXN0YW1wOiBEYXRlLm5vdygpIH0pO1xyXG5cclxuICAgICAgICAvLyBcdUMwQzggXHVCRTRDXHVCNERDIFx1RDUwNFx1Qjg1Q1x1QzEzOFx1QzJBNCBcdUMyRENcdUM3OTEgKFx1QzdBQ1x1QzJEQ1x1QjNDNCBcdUQ2OUZcdUMyMTggXHVDOTlEXHVBQzAwKVxyXG4gICAgICAgIGNvbnN0IG5ld0J1aWxkUHJvY2VzcyA9IHN0YXJ0QnVpbGRQcm9jZXNzKHR5cGUsIHByb2ZpbGUsIGJ1aWxkSWQsIHJldHJ5Q291bnQgKyAxKTtcclxuXHJcbiAgICAgICAgLy8gXHVBRTMwXHVDODc0IGJ1aWxkUHJvY2VzcyBcdUFDMURcdUNDQjRcdUI5N0MgXHVDMEM4IFx1RDUwNFx1Qjg1Q1x1QzEzOFx1QzJBNFx1Qjg1QyBcdUM1QzVcdUIzNzBcdUM3NzRcdUQyQjhcclxuICAgICAgICBidWlsZFByb2Nlc3MucHJvY2VzcyA9IG5ld0J1aWxkUHJvY2Vzcy5wcm9jZXNzO1xyXG5cclxuICAgICAgICAvLyBcdUMwQzggXHVENTA0XHVCODVDXHVDMTM4XHVDMkE0XHVDNzU4IFx1Q0Q5Q1x1QjgyNVx1Qzc0NCBcdUFFMzBcdUM4NzQgb3V0cHV0IFx1QkMzMFx1QzVGNFx1QzVEMCBcdUM1RjBcdUFDQjBcclxuICAgICAgICBjb25zdCBvcmlnaW5hbE91dHB1dCA9IG5ld0J1aWxkUHJvY2Vzcy5vdXRwdXQ7XHJcbiAgICAgICAgY29uc3QgcG9sbEludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xyXG4gICAgICAgICAgd2hpbGUgKG9yaWdpbmFsT3V0cHV0Lmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgb3V0cHV0LnB1c2gob3JpZ2luYWxPdXRwdXQuc2hpZnQoKSEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYgKG5ld0J1aWxkUHJvY2Vzcy5maW5pc2hlZCkge1xyXG4gICAgICAgICAgICBjbGVhckludGVydmFsKHBvbGxJbnRlcnZhbCk7XHJcbiAgICAgICAgICAgIGJ1aWxkUHJvY2Vzcy5maW5pc2hlZCA9IHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSwgMTAwKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdlcnJvcicsIHRleHQ6IGBcdTI3MTcgJHtsaWNlbnNlUmVzdWx0Lm1lc3NhZ2V9YCwgdGltZXN0YW1wOiBEYXRlLm5vdygpIH0pO1xyXG4gICAgICAgIG91dHB1dC5wdXNoKHsgdHlwZTogJ2luZm8nLCB0ZXh0OiAnTWFudWFsIGZpeCByZXF1aXJlZDogUnVuIFwic2RrbWFuYWdlciAtLWxpY2Vuc2VzXCIgaW4geW91ciBBbmRyb2lkIFNESyBkaXJlY3RvcnknLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcbiAgICAgICAgYnVpbGRQcm9jZXNzLmZpbmlzaGVkID0gdHJ1ZTtcclxuICAgICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdlcnJvcicsIHRleHQ6IGBCdWlsZCBmYWlsZWQgd2l0aCBleGl0IGNvZGUgJHtjb2RlfWAsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgYnVpbGRQcm9jZXNzLmZpbmlzaGVkID0gdHJ1ZTtcclxuICAgIGlmIChjb2RlID09PSAwKSB7XHJcbiAgICAgIG91dHB1dC5wdXNoKHsgdHlwZTogJ3N1Y2Nlc3MnLCB0ZXh0OiAnQnVpbGQgY29tcGxldGVkIHN1Y2Nlc3NmdWxseSEnLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcblxyXG4gICAgICAvLyBTaG93IG91dHB1dCBwYXRoIGZvciBsb2NhbCBidWlsZHNcclxuICAgICAgaWYgKHR5cGUgPT09ICdsb2NhbCcpIHtcclxuICAgICAgICBjb25zdCBvdXRwdXRQYXRoID0gcHJvZmlsZSA9PT0gJ2RlYnVnJ1xyXG4gICAgICAgICAgPyAnYW5kcm9pZC9hcHAvYnVpbGQvb3V0cHV0cy9hcGsvZGVidWcvYXBwLWRlYnVnLmFwaydcclxuICAgICAgICAgIDogcHJvZmlsZSA9PT0gJ3JlbGVhc2UtYXBrJ1xyXG4gICAgICAgICAgPyAnYW5kcm9pZC9hcHAvYnVpbGQvb3V0cHV0cy9hcGsvcmVsZWFzZS9hcHAtcmVsZWFzZS5hcGsnXHJcbiAgICAgICAgICA6ICdhbmRyb2lkL2FwcC9idWlsZC9vdXRwdXRzL2J1bmRsZS9yZWxlYXNlL2FwcC1yZWxlYXNlLmFhYic7XHJcbiAgICAgICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnaW5mbycsIHRleHQ6IGBPdXRwdXQ6ICR7b3V0cHV0UGF0aH1gLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIG91dHB1dC5wdXNoKHsgdHlwZTogJ2Vycm9yJywgdGV4dDogYEJ1aWxkIGZhaWxlZCB3aXRoIGV4aXQgY29kZSAke2NvZGV9YCwgdGltZXN0YW1wOiBEYXRlLm5vdygpIH0pO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICBwcm9jLm9uKCdlcnJvcicsIChlcnIpID0+IHtcclxuICAgIGJ1aWxkUHJvY2Vzcy5maW5pc2hlZCA9IHRydWU7XHJcbiAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdlcnJvcicsIHRleHQ6IGBQcm9jZXNzIGVycm9yOiAke2Vyci5tZXNzYWdlfWAsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICB9KTtcclxuXHJcbiAgcmV0dXJuIGJ1aWxkUHJvY2VzcztcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gY2xlYW5EaXJlY3RvcmllcygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XHJcbiAgY29uc3QgZGlyc1RvQ2xlYW4gPSBbXHJcbiAgICBwYXRoLmpvaW4ocHJvamVjdFJvb3QsICdhbmRyb2lkJywgJ2FwcCcsICcuY3h4JyksXHJcbiAgICBwYXRoLmpvaW4ocHJvamVjdFJvb3QsICdhbmRyb2lkJywgJ2FwcCcsICdidWlsZCcpLFxyXG4gICAgcGF0aC5qb2luKHByb2plY3RSb290LCAnYW5kcm9pZCcsICcuZ3JhZGxlJyksXHJcbiAgICBwYXRoLmpvaW4ocHJvamVjdFJvb3QsICdhbmRyb2lkJywgJ2J1aWxkJyksXHJcbiAgXTtcclxuXHJcbiAgY29uc3QgY2xlYW5lZDogc3RyaW5nW10gPSBbXTtcclxuXHJcbiAgZm9yIChjb25zdCBkaXIgb2YgZGlyc1RvQ2xlYW4pIHtcclxuICAgIGlmIChmc1N5bmMuZXhpc3RzU3luYyhkaXIpKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgYXdhaXQgZnMucm0oZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSk7XHJcbiAgICAgICAgY2xlYW5lZC5wdXNoKHBhdGguYmFzZW5hbWUoZGlyKSk7XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAvLyBcdUMwQURcdUM4MUMgXHVDMkU0XHVEMzI4XHVENTc0XHVCM0M0IFx1QUNDNFx1QzE4RCBcdUM5QzRcdUQ1ODlcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGNsZWFuZWQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN0YXJ0Q2xlYW5Qcm9jZXNzKGJ1aWxkSWQ6IHN0cmluZyk6IEJ1aWxkUHJvY2VzcyB7XHJcbiAgY29uc3Qgb3V0cHV0OiBBcnJheTx7IHR5cGU6IHN0cmluZzsgdGV4dDogc3RyaW5nOyB0aW1lc3RhbXA6IG51bWJlciB9PiA9IFtdO1xyXG4gIG91dHB1dC5wdXNoKHsgdHlwZTogJ2luZm8nLCB0ZXh0OiAnQ2xlYW5pbmcgYnVpbGQgY2FjaGUuLi4nLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcblxyXG4gIGNvbnN0IGJ1aWxkUHJvY2VzczogQnVpbGRQcm9jZXNzID0ge1xyXG4gICAgcHJvY2VzczogbnVsbCBhcyBhbnksXHJcbiAgICBvdXRwdXQsXHJcbiAgICBmaW5pc2hlZDogZmFsc2VcclxuICB9O1xyXG5cclxuICAvLyBcdUJFNDRcdUIzRDlcdUFFMzBcdUI4NUMgXHVCNTE0XHVCODA5XHVEMUEwXHVCOUFDIFx1QzBBRFx1QzgxQyBcdUQ2QzQgZ3JhZGxldyBjbGVhbiBcdUMyRTRcdUQ1ODlcclxuICAoYXN5bmMgKCkgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gMS4gXHVCQTNDXHVDODAwIFx1QkIzOFx1QzgxQ1x1QUMwMCBcdUI0MThcdUIyOTQgXHVCNTE0XHVCODA5XHVEMUEwXHVCOUFDXHVCNEU0IFx1QzBBRFx1QzgxQ1xyXG4gICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdpbmZvJywgdGV4dDogJ1JlbW92aW5nIC5jeHggYW5kIGJ1aWxkIGRpcmVjdG9yaWVzLi4uJywgdGltZXN0YW1wOiBEYXRlLm5vdygpIH0pO1xyXG4gICAgICBjb25zdCBjbGVhbmVkID0gYXdhaXQgY2xlYW5EaXJlY3RvcmllcygpO1xyXG4gICAgICBpZiAoY2xlYW5lZC5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnc3Rkb3V0JywgdGV4dDogYERlbGV0ZWQ6ICR7Y2xlYW5lZC5qb2luKCcsICcpfWAsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gMi4gR3JhZGxlIGRhZW1vbiBcdUM5MTFcdUM5QzAgXHVCQzBGIGNsZWFuIFx1QzJFNFx1RDU4OVxyXG4gICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdpbmZvJywgdGV4dDogJ1N0b3BwaW5nIEdyYWRsZSBkYWVtb24uLi4nLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcblxyXG4gICAgICBjb25zdCBjbWQgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInID8gJ2NtZCcgOiAnc2gnO1xyXG4gICAgICBjb25zdCBjbGVhblNjcmlwdCA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMidcclxuICAgICAgICA/ICdjZCBhbmRyb2lkICYmIC5cXFxcZ3JhZGxldyAtLXN0b3AnXHJcbiAgICAgICAgOiAnY2QgYW5kcm9pZCAmJiAuL2dyYWRsZXcgLS1zdG9wJztcclxuICAgICAgY29uc3QgYXJncyA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicgPyBbJy9jJywgY2xlYW5TY3JpcHRdIDogWyctYycsIGNsZWFuU2NyaXB0XTtcclxuXHJcbiAgICAgIGNvbnN0IHByb2MgPSBzcGF3bihjbWQsIGFyZ3MsIHtcclxuICAgICAgICBjd2Q6IHByb2plY3RSb290LFxyXG4gICAgICAgIHNoZWxsOiBmYWxzZSxcclxuICAgICAgICBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYsIEZPUkNFX0NPTE9SOiAnMCcgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGJ1aWxkUHJvY2Vzcy5wcm9jZXNzID0gcHJvYztcclxuXHJcbiAgICAgIHByb2Muc3Rkb3V0Py5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcclxuICAgICAgICBjb25zdCB0ZXh0ID0gZGF0YS50b1N0cmluZygpLnRyaW0oKTtcclxuICAgICAgICBpZiAodGV4dCkge1xyXG4gICAgICAgICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnc3Rkb3V0JywgdGV4dCwgdGltZXN0YW1wOiBEYXRlLm5vdygpIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICBwcm9jLnN0ZGVycj8ub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB7XHJcbiAgICAgICAgY29uc3QgdGV4dCA9IGRhdGEudG9TdHJpbmcoKS50cmltKCk7XHJcbiAgICAgICAgaWYgKHRleHQpIHtcclxuICAgICAgICAgIG91dHB1dC5wdXNoKHsgdHlwZTogJ3N0ZGVycicsIHRleHQsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgcHJvYy5vbignY2xvc2UnLCAoY29kZSkgPT4ge1xyXG4gICAgICAgIGJ1aWxkUHJvY2Vzcy5maW5pc2hlZCA9IHRydWU7XHJcbiAgICAgICAgaWYgKGNvZGUgPT09IDApIHtcclxuICAgICAgICAgIG91dHB1dC5wdXNoKHsgdHlwZTogJ3N1Y2Nlc3MnLCB0ZXh0OiAnQ2FjaGUgY2xlYW5lZCBzdWNjZXNzZnVsbHkhJywgdGltZXN0YW1wOiBEYXRlLm5vdygpIH0pO1xyXG4gICAgICAgICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnaW5mbycsIHRleHQ6ICdSdW4gYSBidWlsZCB0byByZWdlbmVyYXRlIG5hdGl2ZSBjb2RlLicsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgLy8gR3JhZGxlIHN0b3BcdUM3NzQgXHVDMkU0XHVEMzI4XHVENTc0XHVCM0M0IFx1QjUxNFx1QjgwOVx1RDFBMFx1QjlBQ1x1QjI5NCBcdUMwQURcdUM4MUNcdUI0MTBcdUM3M0NcdUJCQzBcdUI4NUMgXHVDMTMxXHVBQ0Y1XHVDNzNDXHVCODVDIFx1Q0M5OFx1QjlBQ1xyXG4gICAgICAgICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnc3VjY2VzcycsIHRleHQ6ICdCdWlsZCBkaXJlY3RvcmllcyBjbGVhbmVkLiBHcmFkbGUgZGFlbW9uIG1heSBuZWVkIG1hbnVhbCBzdG9wLicsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgcHJvYy5vbignZXJyb3InLCAoZXJyKSA9PiB7XHJcbiAgICAgICAgYnVpbGRQcm9jZXNzLmZpbmlzaGVkID0gdHJ1ZTtcclxuICAgICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdlcnJvcicsIHRleHQ6IGBQcm9jZXNzIGVycm9yOiAke2Vyci5tZXNzYWdlfWAsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgYnVpbGRQcm9jZXNzLmZpbmlzaGVkID0gdHJ1ZTtcclxuICAgICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnZXJyb3InLCB0ZXh0OiBgQ2xlYW4gZXJyb3I6ICR7ZXJyLm1lc3NhZ2V9YCwgdGltZXN0YW1wOiBEYXRlLm5vdygpIH0pO1xyXG4gICAgfVxyXG4gIH0pKCk7XHJcblxyXG4gIHJldHVybiBidWlsZFByb2Nlc3M7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN0YXJ0RGVlcENsZWFuUHJvY2VzcyhidWlsZElkOiBzdHJpbmcpOiBCdWlsZFByb2Nlc3Mge1xyXG4gIGNvbnN0IG91dHB1dDogQXJyYXk8eyB0eXBlOiBzdHJpbmc7IHRleHQ6IHN0cmluZzsgdGltZXN0YW1wOiBudW1iZXIgfT4gPSBbXTtcclxuICBvdXRwdXQucHVzaCh7IHR5cGU6ICdpbmZvJywgdGV4dDogJ1N0YXJ0aW5nIGRlZXAgY2xlYW4uLi4nLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcblxyXG4gIGNvbnN0IGJ1aWxkUHJvY2VzczogQnVpbGRQcm9jZXNzID0ge1xyXG4gICAgcHJvY2VzczogbnVsbCBhcyBhbnksXHJcbiAgICBvdXRwdXQsXHJcbiAgICBmaW5pc2hlZDogZmFsc2VcclxuICB9O1xyXG5cclxuICAoYXN5bmMgKCkgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gMS4gR3JhZGxlIGRhZW1vbiBcdUM5MTFcdUM5QzBcclxuICAgICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnaW5mbycsIHRleHQ6ICdTdG9wcGluZyBHcmFkbGUgZGFlbW9uLi4uJywgdGltZXN0YW1wOiBEYXRlLm5vdygpIH0pO1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGF3YWl0IGV4ZWNBc3luYyhcclxuICAgICAgICAgIHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMidcclxuICAgICAgICAgICAgPyAnY2QgYW5kcm9pZCAmJiAuXFxcXGdyYWRsZXcgLS1zdG9wJ1xyXG4gICAgICAgICAgICA6ICdjZCBhbmRyb2lkICYmIC4vZ3JhZGxldyAtLXN0b3AnLFxyXG4gICAgICAgICAgeyBjd2Q6IHByb2plY3RSb290LCB0aW1lb3V0OiAzMDAwMCB9XHJcbiAgICAgICAgKTtcclxuICAgICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdzdGRvdXQnLCB0ZXh0OiAnR3JhZGxlIGRhZW1vbiBzdG9wcGVkJywgdGltZXN0YW1wOiBEYXRlLm5vdygpIH0pO1xyXG4gICAgICB9IGNhdGNoIHtcclxuICAgICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdzdGRvdXQnLCB0ZXh0OiAnR3JhZGxlIGRhZW1vbiBzdG9wIHNraXBwZWQgKG1heSBub3QgYmUgcnVubmluZyknLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIDIuIGFuZHJvaWQgXHVEM0Y0XHVCMzU0IFx1QzBBRFx1QzgxQ1xyXG4gICAgICBjb25zdCBhbmRyb2lkRGlyID0gcGF0aC5qb2luKHByb2plY3RSb290LCAnYW5kcm9pZCcpO1xyXG4gICAgICBpZiAoZnNTeW5jLmV4aXN0c1N5bmMoYW5kcm9pZERpcikpIHtcclxuICAgICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdpbmZvJywgdGV4dDogJ1JlbW92aW5nIGFuZHJvaWQgZm9sZGVyLi4uJywgdGltZXN0YW1wOiBEYXRlLm5vdygpIH0pO1xyXG4gICAgICAgIGF3YWl0IGZzLnJtKGFuZHJvaWREaXIsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KTtcclxuICAgICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdzdGRvdXQnLCB0ZXh0OiAnYW5kcm9pZCBmb2xkZXIgZGVsZXRlZCcsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gMy4gZXhwbyBwcmVidWlsZCBcdUMyRTRcdUQ1ODlcclxuICAgICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnaW5mbycsIHRleHQ6ICdSdW5uaW5nIGV4cG8gcHJlYnVpbGQuLi4nLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcblxyXG4gICAgICBjb25zdCBjbWQgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInID8gJ2NtZCcgOiAnc2gnO1xyXG4gICAgICBjb25zdCBwcmVidWlsZFNjcmlwdCA9ICducHggZXhwbyBwcmVidWlsZCAtLXBsYXRmb3JtIGFuZHJvaWQnO1xyXG4gICAgICBjb25zdCBhcmdzID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/IFsnL2MnLCBwcmVidWlsZFNjcmlwdF0gOiBbJy1jJywgcHJlYnVpbGRTY3JpcHRdO1xyXG5cclxuICAgICAgY29uc3QgcHJvYyA9IHNwYXduKGNtZCwgYXJncywge1xyXG4gICAgICAgIGN3ZDogcHJvamVjdFJvb3QsXHJcbiAgICAgICAgc2hlbGw6IGZhbHNlLFxyXG4gICAgICAgIGVudjogeyAuLi5wcm9jZXNzLmVudiwgRk9SQ0VfQ09MT1I6ICcwJyB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgYnVpbGRQcm9jZXNzLnByb2Nlc3MgPSBwcm9jO1xyXG5cclxuICAgICAgcHJvYy5zdGRvdXQ/Lm9uKCdkYXRhJywgKGRhdGE6IEJ1ZmZlcikgPT4ge1xyXG4gICAgICAgIGNvbnN0IHRleHQgPSBkYXRhLnRvU3RyaW5nKCkudHJpbSgpO1xyXG4gICAgICAgIGlmICh0ZXh0KSB7XHJcbiAgICAgICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdzdGRvdXQnLCB0ZXh0LCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHByb2Muc3RkZXJyPy5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcclxuICAgICAgICBjb25zdCB0ZXh0ID0gZGF0YS50b1N0cmluZygpLnRyaW0oKTtcclxuICAgICAgICBpZiAodGV4dCkge1xyXG4gICAgICAgICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnc3RkZXJyJywgdGV4dCwgdGltZXN0YW1wOiBEYXRlLm5vdygpIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICBwcm9jLm9uKCdjbG9zZScsIGFzeW5jIChjb2RlKSA9PiB7XHJcbiAgICAgICAgaWYgKGNvZGUgPT09IDApIHtcclxuICAgICAgICAgIC8vIDQuIGxvY2FsLnByb3BlcnRpZXMgXHVCQ0Y1XHVDNkQwIChidWlsZC1lbnYuanNvblx1QzVEMFx1QzExQylcclxuICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkRW52ID0gYXdhaXQgbG9hZEJ1aWxkRW52KCk7XHJcbiAgICAgICAgICAgIGlmIChidWlsZEVudi5hbmRyb2lkPy5zZGtQYXRoKSB7XHJcbiAgICAgICAgICAgICAgYXdhaXQgdXBkYXRlTG9jYWxQcm9wZXJ0aWVzKGJ1aWxkRW52LmFuZHJvaWQuc2RrUGF0aCk7XHJcbiAgICAgICAgICAgICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnc3Rkb3V0JywgdGV4dDogJ2xvY2FsLnByb3BlcnRpZXMgcmVzdG9yZWQnLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdzdGRlcnInLCB0ZXh0OiAnV2FybmluZzogQ291bGQgbm90IHJlc3RvcmUgbG9jYWwucHJvcGVydGllcycsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdzdWNjZXNzJywgdGV4dDogJ0RlZXAgY2xlYW4gY29tcGxldGVkIScsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnZXJyb3InLCB0ZXh0OiBgUHJlYnVpbGQgZmFpbGVkIHdpdGggZXhpdCBjb2RlICR7Y29kZX1gLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJ1aWxkUHJvY2Vzcy5maW5pc2hlZCA9IHRydWU7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgcHJvYy5vbignZXJyb3InLCAoZXJyKSA9PiB7XHJcbiAgICAgICAgYnVpbGRQcm9jZXNzLmZpbmlzaGVkID0gdHJ1ZTtcclxuICAgICAgICBvdXRwdXQucHVzaCh7IHR5cGU6ICdlcnJvcicsIHRleHQ6IGBQcm9jZXNzIGVycm9yOiAke2Vyci5tZXNzYWdlfWAsIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9KTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgYnVpbGRQcm9jZXNzLmZpbmlzaGVkID0gdHJ1ZTtcclxuICAgICAgb3V0cHV0LnB1c2goeyB0eXBlOiAnZXJyb3InLCB0ZXh0OiBgRGVlcCBjbGVhbiBlcnJvcjogJHtlcnIubWVzc2FnZX1gLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcbiAgICB9XHJcbiAgfSkoKTtcclxuXHJcbiAgcmV0dXJuIGJ1aWxkUHJvY2VzcztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGFwaVBsdWdpbigpOiBQbHVnaW4ge1xyXG4gIHJldHVybiB7XHJcbiAgICBuYW1lOiAnY29uZmlnLWVkaXRvci1hcGknLFxyXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcjogVml0ZURldlNlcnZlcikge1xyXG4gICAgICAvLyBQdXBwZXRlZXIgUHJldmlldyBXZWJTb2NrZXQgXHVDMTFDXHVCQzg0IFx1QzEyNFx1QzgxNVxyXG4gICAgICBzZXJ2ZXIuaHR0cFNlcnZlcj8ub25jZSgnbGlzdGVuaW5nJywgKCkgPT4ge1xyXG4gICAgICAgIGlmIChzZXJ2ZXIuaHR0cFNlcnZlcikge1xyXG4gICAgICAgICAgc2V0dXBXZWJTb2NrZXRTZXJ2ZXIoc2VydmVyLmh0dHBTZXJ2ZXIpO1xyXG4gICAgICAgICAgY29uc29sZS5sb2coJ1thcGktcGx1Z2luXSBQdXBwZXRlZXIgUHJldmlldyBXZWJTb2NrZXQgc2VydmVyIGluaXRpYWxpemVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIEFwcEJyaWRnZSBUZXN0IFBhZ2UgLSBmb3IgZGVidWdnaW5nXHJcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XHJcbiAgICAgICAgaWYgKHJlcS51cmwgIT09ICcvcHJldmlldy10ZXN0Jykge1xyXG4gICAgICAgICAgcmV0dXJuIG5leHQoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHRlc3RIdG1sID0gYDwhRE9DVFlQRSBodG1sPlxyXG48aHRtbD5cclxuPGhlYWQ+XHJcbiAgPG1ldGEgY2hhcnNldD1cInV0Zi04XCI+XHJcbiAgPHRpdGxlPkFwcEJyaWRnZSBUZXN0PC90aXRsZT5cclxuICA8c3R5bGU+XHJcbiAgICBib2R5IHsgZm9udC1mYW1pbHk6IHN5c3RlbS11aTsgcGFkZGluZzogMjBweDsgYmFja2dyb3VuZDogI2Y4ZmFmYzsgfVxyXG4gICAgLnRlc3QgeyBtYXJnaW46IDEwcHggMDsgcGFkZGluZzogMTBweDsgYmFja2dyb3VuZDogd2hpdGU7IGJvcmRlci1yYWRpdXM6IDhweDsgYm9yZGVyOiAxcHggc29saWQgI2UyZThmMDsgfVxyXG4gICAgLnBhc3MgeyBib3JkZXItY29sb3I6ICMyMmM1NWU7IGJhY2tncm91bmQ6ICNmMGZkZjQ7IH1cclxuICAgIC5mYWlsIHsgYm9yZGVyLWNvbG9yOiAjZWY0NDQ0OyBiYWNrZ3JvdW5kOiAjZmVmMmYyOyB9XHJcbiAgICAucGVuZGluZyB7IGJvcmRlci1jb2xvcjogI2Y1OWUwYjsgYmFja2dyb3VuZDogI2ZmZmJlYjsgfVxyXG4gICAgYnV0dG9uIHsgcGFkZGluZzogOHB4IDE2cHg7IGJhY2tncm91bmQ6ICMzYjgyZjY7IGNvbG9yOiB3aGl0ZTsgYm9yZGVyOiBub25lOyBib3JkZXItcmFkaXVzOiA0cHg7IGN1cnNvcjogcG9pbnRlcjsgbWFyZ2luOiA0cHg7IH1cclxuICAgIGJ1dHRvbjpob3ZlciB7IGJhY2tncm91bmQ6ICMyNTYzZWI7IH1cclxuICAgIHByZSB7IGJhY2tncm91bmQ6ICMxZTI5M2I7IGNvbG9yOiAjZTJlOGYwOyBwYWRkaW5nOiAxMHB4OyBib3JkZXItcmFkaXVzOiA0cHg7IG92ZXJmbG93LXg6IGF1dG87IGZvbnQtc2l6ZTogMTJweDsgfVxyXG4gICAgaDEgeyBjb2xvcjogIzFlMjkzYjsgfVxyXG4gICAgLmxvZyB7IG1heC1oZWlnaHQ6IDMwMHB4OyBvdmVyZmxvdy15OiBhdXRvOyB9XHJcbiAgPC9zdHlsZT5cclxuPC9oZWFkPlxyXG48Ym9keT5cclxuICA8aDE+QXBwQnJpZGdlIFRlc3QgUGFnZTwvaDE+XHJcblxyXG4gIDxkaXYgaWQ9XCJ0ZXN0c1wiPjwvZGl2PlxyXG5cclxuICA8aDI+TWFudWFsIFRlc3RzPC9oMj5cclxuICA8YnV0dG9uIG9uY2xpY2s9XCJ0ZXN0Q2FsbCgnZ2V0U3lzdGVtSW5mbycpXCI+Y2FsbCgnZ2V0U3lzdGVtSW5mbycpPC9idXR0b24+XHJcbiAgPGJ1dHRvbiBvbmNsaWNrPVwidGVzdENhbGwoJ2dldERldmljZUluZm8nKVwiPmNhbGwoJ2dldERldmljZUluZm8nKTwvYnV0dG9uPlxyXG4gIDxidXR0b24gb25jbGljaz1cInRlc3RDYWxsKCdnZXRBcHBJbmZvJylcIj5jYWxsKCdnZXRBcHBJbmZvJyk8L2J1dHRvbj5cclxuICA8YnV0dG9uIG9uY2xpY2s9XCJ0ZXN0Q2FsbCgndW5rbm93bkFjdGlvbicpXCI+Y2FsbCgndW5rbm93bkFjdGlvbicpPC9idXR0b24+XHJcblxyXG4gIDxoMj5Db25zb2xlIExvZzwvaDI+XHJcbiAgPHByZSBpZD1cImxvZ1wiIGNsYXNzPVwibG9nXCI+PC9wcmU+XHJcblxyXG4gICR7Z2V0UHJldmlld0JyaWRnZVNjcmlwdChwcm94eVRhcmdldE9yaWdpbiB8fCAnaHR0cDovL2xvY2FsaG9zdCcpfVxyXG5cclxuICA8c2NyaXB0PlxyXG4gICAgdmFyIGxvZ0VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZycpO1xyXG4gICAgdmFyIHRlc3RzRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGVzdHMnKTtcclxuXHJcbiAgICBmdW5jdGlvbiBsb2cobXNnKSB7XHJcbiAgICAgIHZhciB0aW1lID0gbmV3IERhdGUoKS50b0xvY2FsZVRpbWVTdHJpbmcoKTtcclxuICAgICAgbG9nRWwudGV4dENvbnRlbnQgPSAnWycgKyB0aW1lICsgJ10gJyArIG1zZyArICdcXFxcbicgKyBsb2dFbC50ZXh0Q29udGVudDtcclxuICAgICAgY29uc29sZS5sb2cobXNnKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBhZGRUZXN0KG5hbWUsIHN0YXR1cywgZGV0YWlsKSB7XHJcbiAgICAgIHZhciBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgZGl2LmNsYXNzTmFtZSA9ICd0ZXN0ICcgKyBzdGF0dXM7XHJcbiAgICAgIGRpdi5pbm5lckhUTUwgPSAnPHN0cm9uZz4nICsgbmFtZSArICc8L3N0cm9uZz46ICcgKyBzdGF0dXMgKyAoZGV0YWlsID8gJyAtICcgKyBkZXRhaWwgOiAnJyk7XHJcbiAgICAgIHRlc3RzRWwuYXBwZW5kQ2hpbGQoZGl2KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBBdXRvIHRlc3RzXHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgICBsb2coJ1BhZ2UgbG9hZGVkLCBzdGFydGluZyB0ZXN0cy4uLicpO1xyXG5cclxuICAgICAgLy8gVGVzdCAxOiBSZWFjdE5hdGl2ZVdlYlZpZXcgZXhpc3RzXHJcbiAgICAgIGlmICh3aW5kb3cuUmVhY3ROYXRpdmVXZWJWaWV3KSB7XHJcbiAgICAgICAgYWRkVGVzdCgnUmVhY3ROYXRpdmVXZWJWaWV3IGV4aXN0cycsICdwYXNzJyk7XHJcbiAgICAgICAgbG9nKCdcdTI3MTMgUmVhY3ROYXRpdmVXZWJWaWV3IGV4aXN0cycpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGFkZFRlc3QoJ1JlYWN0TmF0aXZlV2ViVmlldyBleGlzdHMnLCAnZmFpbCcpO1xyXG4gICAgICAgIGxvZygnXHUyNzE3IFJlYWN0TmF0aXZlV2ViVmlldyBtaXNzaW5nJyk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIFRlc3QgMjogQXBwQnJpZGdlIGV4aXN0c1xyXG4gICAgICBpZiAod2luZG93LkFwcEJyaWRnZSkge1xyXG4gICAgICAgIGFkZFRlc3QoJ0FwcEJyaWRnZSBleGlzdHMnLCAncGFzcycpO1xyXG4gICAgICAgIGxvZygnXHUyNzEzIEFwcEJyaWRnZSBleGlzdHMnKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBhZGRUZXN0KCdBcHBCcmlkZ2UgZXhpc3RzJywgJ2ZhaWwnKTtcclxuICAgICAgICBsb2coJ1x1MjcxNyBBcHBCcmlkZ2UgbWlzc2luZycpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBUZXN0IDM6IEFwcEJyaWRnZS5pc0FwcCgpXHJcbiAgICAgIGlmICh3aW5kb3cuQXBwQnJpZGdlICYmIHdpbmRvdy5BcHBCcmlkZ2UuaXNBcHAoKSkge1xyXG4gICAgICAgIGFkZFRlc3QoJ0FwcEJyaWRnZS5pc0FwcCgpJywgJ3Bhc3MnLCAncmV0dXJucyB0cnVlJyk7XHJcbiAgICAgICAgbG9nKCdcdTI3MTMgQXBwQnJpZGdlLmlzQXBwKCkgPSB0cnVlJyk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYWRkVGVzdCgnQXBwQnJpZGdlLmlzQXBwKCknLCAnZmFpbCcsICdyZXR1cm5zIGZhbHNlJyk7XHJcbiAgICAgICAgbG9nKCdcdTI3MTcgQXBwQnJpZGdlLmlzQXBwKCkgPSBmYWxzZScpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBUZXN0IDQ6IEFwcEJyaWRnZS5jYWxsKClcclxuICAgICAgaWYgKHdpbmRvdy5BcHBCcmlkZ2UgJiYgd2luZG93LkFwcEJyaWRnZS5jYWxsKSB7XHJcbiAgICAgICAgYWRkVGVzdCgnQXBwQnJpZGdlLmNhbGwoKSAtIHRlc3RpbmcuLi4nLCAncGVuZGluZycpO1xyXG4gICAgICAgIGxvZygnVGVzdGluZyBBcHBCcmlkZ2UuY2FsbCgpLi4uJyk7XHJcblxyXG4gICAgICAgIHdpbmRvdy5BcHBCcmlkZ2UuY2FsbCgnZ2V0U3lzdGVtSW5mbycpLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XHJcbiAgICAgICAgICBsb2coJ1x1MjcxMyBBcHBCcmlkZ2UuY2FsbCgpIHJlc3BvbnNlOiAnICsgSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XHJcbiAgICAgICAgICAvLyBVcGRhdGUgdGVzdCBzdGF0dXNcclxuICAgICAgICAgIHZhciB0ZXN0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy50ZXN0LnBlbmRpbmcnKTtcclxuICAgICAgICAgIHRlc3RzLmZvckVhY2goZnVuY3Rpb24odCkge1xyXG4gICAgICAgICAgICBpZiAodC5pbm5lckhUTUwuaW5jbHVkZXMoJ0FwcEJyaWRnZS5jYWxsKCknKSkge1xyXG4gICAgICAgICAgICAgIHQuY2xhc3NOYW1lID0gJ3Rlc3QgcGFzcyc7XHJcbiAgICAgICAgICAgICAgdC5pbm5lckhUTUwgPSAnPHN0cm9uZz5BcHBCcmlkZ2UuY2FsbCgpPC9zdHJvbmc+OiBwYXNzIC0gJyArIEpTT04uc3RyaW5naWZ5KHJlc3VsdCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xyXG4gICAgICAgICAgbG9nKCdcdTI3MTcgQXBwQnJpZGdlLmNhbGwoKSBlcnJvcjogJyArIGVyci5tZXNzYWdlKTtcclxuICAgICAgICAgIHZhciB0ZXN0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy50ZXN0LnBlbmRpbmcnKTtcclxuICAgICAgICAgIHRlc3RzLmZvckVhY2goZnVuY3Rpb24odCkge1xyXG4gICAgICAgICAgICBpZiAodC5pbm5lckhUTUwuaW5jbHVkZXMoJ0FwcEJyaWRnZS5jYWxsKCknKSkge1xyXG4gICAgICAgICAgICAgIHQuY2xhc3NOYW1lID0gJ3Rlc3QgZmFpbCc7XHJcbiAgICAgICAgICAgICAgdC5pbm5lckhUTUwgPSAnPHN0cm9uZz5BcHBCcmlkZ2UuY2FsbCgpPC9zdHJvbmc+OiBmYWlsIC0gJyArIGVyci5tZXNzYWdlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgZnVuY3Rpb24gdGVzdENhbGwoYWN0aW9uKSB7XHJcbiAgICAgIGxvZygnQ2FsbGluZyBBcHBCcmlkZ2UuY2FsbChcIicgKyBhY3Rpb24gKyAnXCIpLi4uJyk7XHJcbiAgICAgIGlmICghd2luZG93LkFwcEJyaWRnZSkge1xyXG4gICAgICAgIGxvZygnXHUyNzE3IEFwcEJyaWRnZSBub3QgYXZhaWxhYmxlJyk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIHdpbmRvdy5BcHBCcmlkZ2UuY2FsbChhY3Rpb24pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XHJcbiAgICAgICAgbG9nKCdcdTI3MTMgUmVzcG9uc2U6ICcgKyBKU09OLnN0cmluZ2lmeShyZXN1bHQpKTtcclxuICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XHJcbiAgICAgICAgbG9nKCdcdTI3MTcgRXJyb3I6ICcgKyBlcnIubWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIDwvc2NyaXB0PlxyXG48L2JvZHk+XHJcbjwvaHRtbD5gO1xyXG5cclxuICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcclxuICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAndGV4dC9odG1sJyk7XHJcbiAgICAgICAgcmVzLmVuZCh0ZXN0SHRtbCk7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgLy8gUHJldmlldyByZXZlcnNlIHByb3h5IG1pZGRsZXdhcmVcclxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShhc3luYyAocmVxLCByZXMsIG5leHQpID0+IHtcclxuICAgICAgICBjb25zdCB1cmwgPSByZXEudXJsIHx8ICcnO1xyXG5cclxuICAgICAgICAvLyBPbmx5IGhhbmRsZSAvcHJldmlldy8qIHJvdXRlc1xyXG4gICAgICAgIGlmICghdXJsLnN0YXJ0c1dpdGgoJy9wcmV2aWV3LycpICYmIHVybCAhPT0gJy9wcmV2aWV3Jykge1xyXG4gICAgICAgICAgcmV0dXJuIG5leHQoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghcHJveHlUYXJnZXRVcmwgfHwgIXByb3h5VGFyZ2V0T3JpZ2luKSB7XHJcbiAgICAgICAgICAvLyBcdUQ1MDRcdUI4NURcdUMyREMgXHVCQkY4XHVDMTI0XHVDODE1IFx1QzJEQyBcdUM1RDBcdUI3RUMgXHVEMzk4XHVDNzc0XHVDOUMwIFx1QkMxOFx1RDY1OCAoXHVDNzkwXHVCM0Q5IFx1QzBDOFx1Qjg1Q1x1QUNFMFx1Q0U2OCBcdUM1QzZcdUM3NEMpXHJcbiAgICAgICAgICBjb25zb2xlLmxvZygnW1ByZXZpZXcgUHJveHldIE5vIHRhcmdldCBjb25maWd1cmVkLCByZXR1cm5pbmcgZXJyb3IgcGFnZScpO1xyXG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDM7XHJcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAndGV4dC9odG1sJyk7XHJcbiAgICAgICAgICByZXMuZW5kKGA8IURPQ1RZUEUgaHRtbD5cclxuPGh0bWw+XHJcbjxoZWFkPlxyXG4gIDxtZXRhIGNoYXJzZXQ9XCJ1dGYtOFwiPlxyXG4gIDxzdHlsZT5cclxuICAgIGJvZHkgeyBtYXJnaW46IDA7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IGp1c3RpZnktY29udGVudDogY2VudGVyOyBoZWlnaHQ6IDEwMHZoOyBmb250LWZhbWlseTogc3lzdGVtLXVpOyBiYWNrZ3JvdW5kOiAjZmVmMmYyOyB9XHJcbiAgICAuZXJyb3IgeyB0ZXh0LWFsaWduOiBjZW50ZXI7IGNvbG9yOiAjZGMyNjI2OyB9XHJcbiAgICAuaWNvbiB7IGZvbnQtc2l6ZTogNDhweDsgbWFyZ2luLWJvdHRvbTogMTZweDsgfVxyXG4gIDwvc3R5bGU+XHJcbjwvaGVhZD5cclxuPGJvZHk+XHJcbiAgPGRpdiBjbGFzcz1cImVycm9yXCI+XHJcbiAgICA8ZGl2IGNsYXNzPVwiaWNvblwiPlx1MjZBMFx1RkUwRjwvZGl2PlxyXG4gICAgPGRpdj5QcmV2aWV3IHByb3h5IG5vdCBjb25maWd1cmVkPC9kaXY+XHJcbiAgICA8ZGl2IHN0eWxlPVwiZm9udC1zaXplOiAxMnB4OyBjb2xvcjogIzZiNzI4MDsgbWFyZ2luLXRvcDogOHB4O1wiPkNoZWNrIHRoYXQgYmFzZVVybCBpcyBzZXQgaW4gYXBwIGNvbmZpZzwvZGl2PlxyXG4gIDwvZGl2PlxyXG48L2JvZHk+XHJcbjwvaHRtbD5gKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAvLyBFeHRyYWN0IHBhdGggYWZ0ZXIgL3ByZXZpZXdcclxuICAgICAgICAgIGNvbnN0IHByb3h5UGF0aCA9IHVybC5yZXBsYWNlKC9eXFwvcHJldmlld1xcLz8vLCAnLycpO1xyXG4gICAgICAgICAgY29uc3QgdGFyZ2V0VXJsID0gbmV3IFVSTChwcm94eVBhdGgsIHByb3h5VGFyZ2V0T3JpZ2luKS5ocmVmO1xyXG5cclxuICAgICAgICAgIGNvbnNvbGUubG9nKCdbUHJldmlldyBQcm94eV0nLCByZXEubWV0aG9kLCB1cmwsICctPicsIHRhcmdldFVybCk7XHJcblxyXG4gICAgICAgICAgLy8gRm9yd2FyZCBoZWFkZXJzIChleGNlcHQgaG9zdClcclxuICAgICAgICAgIGNvbnN0IGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XHJcbiAgICAgICAgICAgICdVc2VyLUFnZW50JzogJ01vemlsbGEvNS4wIChMaW51eDsgQW5kcm9pZCAxMzsgUGl4ZWwgNykgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzEyMC4wLjAuMCBNb2JpbGUgU2FmYXJpLzUzNy4zNicsXHJcbiAgICAgICAgICAgICdBY2NlcHQnOiByZXEuaGVhZGVycy5hY2NlcHQgfHwgJyovKicsXHJcbiAgICAgICAgICAgICdBY2NlcHQtTGFuZ3VhZ2UnOiByZXEuaGVhZGVyc1snYWNjZXB0LWxhbmd1YWdlJ10gfHwgJ2VuLVVTLGVuO3E9MC45JyxcclxuICAgICAgICAgICAgJ0FjY2VwdC1FbmNvZGluZyc6ICdpZGVudGl0eScsIC8vIERvbid0IGFjY2VwdCBjb21wcmVzc2VkIHRvIGFsbG93IG1vZGlmaWNhdGlvblxyXG4gICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAvLyBGb3J3YXJkIGNvb2tpZXMgaWYgcHJlc2VudFxyXG4gICAgICAgICAgaWYgKHJlcS5oZWFkZXJzLmNvb2tpZSkge1xyXG4gICAgICAgICAgICBoZWFkZXJzWydDb29raWUnXSA9IHJlcS5oZWFkZXJzLmNvb2tpZTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBpZiAocmVxLmhlYWRlcnMucmVmZXJlcikge1xyXG4gICAgICAgICAgICAvLyBSZXdyaXRlIHJlZmVyZXIgdG8gdGFyZ2V0IG9yaWdpblxyXG4gICAgICAgICAgICBoZWFkZXJzWydSZWZlcmVyJ10gPSBwcm94eVRhcmdldE9yaWdpbjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBGb3J3YXJkIE5leHQuanMgUlNDIGhlYWRlcnMgKGNyaXRpY2FsIGZvciBBcHAgUm91dGVyKVxyXG4gICAgICAgICAgY29uc3QgbmV4dEhlYWRlcnMgPSBbXHJcbiAgICAgICAgICAgICdyc2MnLFxyXG4gICAgICAgICAgICAnbmV4dC1yb3V0ZXItc3RhdGUtdHJlZScsXHJcbiAgICAgICAgICAgICduZXh0LXJvdXRlci1wcmVmZXRjaCcsXHJcbiAgICAgICAgICAgICduZXh0LXJvdXRlci1zZWdtZW50LXByZWZldGNoJyxcclxuICAgICAgICAgICAgJ25leHQtdXJsJ1xyXG4gICAgICAgICAgXTtcclxuICAgICAgICAgIGZvciAoY29uc3QgaCBvZiBuZXh0SGVhZGVycykge1xyXG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IHJlcS5oZWFkZXJzW2hdO1xyXG4gICAgICAgICAgICBpZiAodmFsdWUpIHtcclxuICAgICAgICAgICAgICBoZWFkZXJzW2hdID0gQXJyYXkuaXNBcnJheSh2YWx1ZSkgPyB2YWx1ZVswXSA6IHZhbHVlO1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbUHJldmlldyBQcm94eV0gRm9yd2FyZGluZyBoZWFkZXI6JywgaCwgJz0nLCBoZWFkZXJzW2hdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godGFyZ2V0VXJsLCB7XHJcbiAgICAgICAgICAgIG1ldGhvZDogcmVxLm1ldGhvZCxcclxuICAgICAgICAgICAgaGVhZGVycyxcclxuICAgICAgICAgICAgcmVkaXJlY3Q6ICdmb2xsb3cnIC8vIEZvbGxvdyByZWRpcmVjdHMgYXV0b21hdGljYWxseVxyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgLy8gXHVDNzUxXHVCMkY1IFx1RDVFNFx1QjM1NCBcdUM4MDRcdUNDQjQgXHVCODVDXHVBRTQ1IChcdUI1MTRcdUJDODRcdUFFNDVcdUM2QTkpXHJcbiAgICAgICAgICBjb25zdCByZXNwSGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xyXG4gICAgICAgICAgcmVzcG9uc2UuaGVhZGVycy5mb3JFYWNoKCh2LCBrKSA9PiB7IHJlc3BIZWFkZXJzW2tdID0gdjsgfSk7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZygnW1ByZXZpZXcgUHJveHldIFJlc3BvbnNlOicsIHJlc3BvbnNlLnN0YXR1cywgSlNPTi5zdHJpbmdpZnkocmVzcEhlYWRlcnMsIG51bGwsIDIpKTtcclxuXHJcbiAgICAgICAgICAvLyBDb3B5IHN0YXR1c1xyXG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSByZXNwb25zZS5zdGF0dXM7XHJcblxyXG4gICAgICAgICAgY29uc3QgY29udGVudFR5cGUgPSByZXNwb25zZS5oZWFkZXJzLmdldCgnY29udGVudC10eXBlJykgfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbSc7XHJcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCBjb250ZW50VHlwZSk7XHJcblxyXG4gICAgICAgICAgLy8gQ29weSBzYWZlIGhlYWRlcnMsIHN0cmlwIHNlY3VyaXR5IGhlYWRlcnMgdGhhdCBibG9jayBpZnJhbWUvc2NyaXB0c1xyXG4gICAgICAgICAgY29uc3Qgc2FmZUhlYWRlcnMgPSBbJ2NvbnRlbnQtbGFuZ3VhZ2UnLCAnY2FjaGUtY29udHJvbCcsICdleHBpcmVzJywgJ2xhc3QtbW9kaWZpZWQnLCAnZXRhZyddO1xyXG4gICAgICAgICAgZm9yIChjb25zdCBoZWFkZXIgb2Ygc2FmZUhlYWRlcnMpIHtcclxuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSByZXNwb25zZS5oZWFkZXJzLmdldChoZWFkZXIpO1xyXG4gICAgICAgICAgICBpZiAodmFsdWUpIHJlcy5zZXRIZWFkZXIoaGVhZGVyLCB2YWx1ZSk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gU2V0IHBlcm1pc3NpdmUgaGVhZGVycyBmb3IgaWZyYW1lIHByZXZpZXdcclxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsICcqJyk7XHJcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJywgJ0dFVCwgUE9TVCwgT1BUSU9OUycpO1xyXG4gICAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycycsICcqJyk7XHJcbiAgICAgICAgICAvLyBSZW1vdmUgWC1GcmFtZS1PcHRpb25zIHRvIGFsbG93IGlmcmFtZSBlbWJlZGRpbmdcclxuICAgICAgICAgIC8vIERvbid0IHNldCBDU1AgLSBsZXQgdGhlIHBhZ2Ugd29yayB3aXRob3V0IHJlc3RyaWN0aW9uc1xyXG5cclxuICAgICAgICAgIC8vIEdldCByZXNwb25zZSBib2R5XHJcbiAgICAgICAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVzcG9uc2UuYXJyYXlCdWZmZXIoKTtcclxuICAgICAgICAgIGxldCBjb250ZW50ID0gQnVmZmVyLmZyb20oYm9keSk7XHJcblxyXG4gICAgICAgICAgLy8gSGVscGVyIHRvIHJld3JpdGUgVVJMcyBpbiBjb250ZW50XHJcbiAgICAgICAgICBjb25zdCBvcmlnaW5Fc2NhcGVkID0gcHJveHlUYXJnZXRPcmlnaW4hLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJyk7XHJcbiAgICAgICAgICBjb25zdCByZXdyaXRlVXJsc0luVGV4dCA9ICh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xyXG4gICAgICAgICAgICAvLyBGdWxsIG9yaWdpbiBVUkxzXHJcbiAgICAgICAgICAgIHRleHQgPSB0ZXh0LnJlcGxhY2UoXHJcbiAgICAgICAgICAgICAgbmV3IFJlZ0V4cChgKFtcIiddKSgke29yaWdpbkVzY2FwZWR9KSgvW15cIiddKikoW1wiJ10pYCwgJ2cnKSxcclxuICAgICAgICAgICAgICAnJDEvcHJldmlldyQzJDQnXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIC8vIFByb3RvY29sLXJlbGF0aXZlIFVSTHMgZm9yIHNhbWUgaG9zdFxyXG4gICAgICAgICAgICBjb25zdCBob3N0UGF0dGVybiA9IHByb3h5VGFyZ2V0T3JpZ2luIS5yZXBsYWNlKC9eaHR0cHM/Oi8sICcnKS5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgJ1xcXFwkJicpO1xyXG4gICAgICAgICAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKFxyXG4gICAgICAgICAgICAgIG5ldyBSZWdFeHAoYChbXCInXSkoJHtob3N0UGF0dGVybn0pKC9bXlwiJ10qKShbXCInXSlgLCAnZycpLFxyXG4gICAgICAgICAgICAgICckMS9wcmV2aWV3JDMkNCdcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRleHQ7XHJcbiAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgIC8vIFByb2Nlc3MgSFRNTCByZXNwb25zZXNcclxuICAgICAgICAgIGlmIChjb250ZW50VHlwZS5pbmNsdWRlcygndGV4dC9odG1sJykpIHtcclxuICAgICAgICAgICAgbGV0IGh0bWwgPSBjb250ZW50LnRvU3RyaW5nKCd1dGYtOCcpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW1ByZXZpZXcgUHJveHldIFByb2Nlc3NpbmcgSFRNTDonLCBodG1sLmxlbmd0aCwgJ2NoYXJzJyk7XHJcblxyXG4gICAgICAgICAgICAvLyBSZW1vdmUgZXhpc3RpbmcgQ1NQIG1ldGEgdGFnc1xyXG4gICAgICAgICAgICBodG1sID0gaHRtbC5yZXBsYWNlKC88bWV0YVtePl0qaHR0cC1lcXVpdj1bXCInXT9jb250ZW50LXNlY3VyaXR5LXBvbGljeVtcIiddP1tePl0qPi9naSwgJycpO1xyXG5cclxuICAgICAgICAgICAgLy8gSW5qZWN0IGJyaWRnZSBzY3JpcHQgYW5kIGJhc2UgdGFnIGF0IHRoZSBiZWdpbm5pbmcgb2YgPGhlYWQ+XHJcbiAgICAgICAgICAgIGNvbnN0IGJyaWRnZVNjcmlwdCA9IGdldFByZXZpZXdCcmlkZ2VTY3JpcHQocHJveHlUYXJnZXRPcmlnaW4hKTtcclxuICAgICAgICAgICAgY29uc3QgYmFzZVRhZyA9IGA8YmFzZSBocmVmPVwiL3ByZXZpZXcvXCI+YDtcclxuICAgICAgICAgICAgY29uc3QgaGVhZE1hdGNoID0gaHRtbC5tYXRjaCgvPGhlYWRbXj5dKj4vaSk7XHJcbiAgICAgICAgICAgIGlmIChoZWFkTWF0Y2ggJiYgaGVhZE1hdGNoLmluZGV4ICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICBjb25zdCBpbnNlcnRQb3MgPSBoZWFkTWF0Y2guaW5kZXggKyBoZWFkTWF0Y2hbMF0ubGVuZ3RoO1xyXG4gICAgICAgICAgICAgIGh0bWwgPSBodG1sLnNsaWNlKDAsIGluc2VydFBvcykgKyBiYXNlVGFnICsgYnJpZGdlU2NyaXB0ICsgaHRtbC5zbGljZShpbnNlcnRQb3MpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIGh0bWwgPSBiYXNlVGFnICsgYnJpZGdlU2NyaXB0ICsgaHRtbDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gUmV3cml0ZSBVUkxzIGluIEhUTUwgYXR0cmlidXRlc1xyXG4gICAgICAgICAgICAvLyAxLiBGdWxsIG9yaWdpbiBVUkxzXHJcbiAgICAgICAgICAgIGh0bWwgPSBodG1sLnJlcGxhY2UoXHJcbiAgICAgICAgICAgICAgbmV3IFJlZ0V4cChgKGhyZWZ8c3JjfGFjdGlvbnxzcmNzZXQpPVtcIiddKCR7b3JpZ2luRXNjYXBlZH0pKC9bXlwiJ10qKVtcIiddYCwgJ2dpJyksXHJcbiAgICAgICAgICAgICAgJyQxPVwiL3ByZXZpZXckM1wiJ1xyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAvLyAyLiBSb290LXJlbGF0aXZlIFVSTHMgKHN0YXJ0aW5nIHdpdGggLykgLSBidXQgbm90IC8vcHJvdG9jb2wgVVJMc1xyXG4gICAgICAgICAgICBodG1sID0gaHRtbC5yZXBsYWNlKFxyXG4gICAgICAgICAgICAgIC8oaHJlZnxzcmN8YWN0aW9uKT1bXCInXSg/IVxcL1xcLykoXFwvW15cIiddKj8pW1wiJ10vZ2ksXHJcbiAgICAgICAgICAgICAgJyQxPVwiL3ByZXZpZXckMlwiJ1xyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAvLyAzLiBzcmNzZXQgd2l0aCByb290LXJlbGF0aXZlIFVSTHNcclxuICAgICAgICAgICAgaHRtbCA9IGh0bWwucmVwbGFjZShcclxuICAgICAgICAgICAgICAvc3Jjc2V0PVtcIiddKFteXCInXSspW1wiJ10vZ2ksXHJcbiAgICAgICAgICAgICAgKG1hdGNoLCBzcmNzZXQpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJld3JpdHRlbiA9IHNyY3NldC5yZXBsYWNlKC8oPzpefCxcXHMqKShcXC9bXlxccyxdKykvZywgKG06IHN0cmluZywgcGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgIHJldHVybiBtLnJlcGxhY2UocGF0aCwgJy9wcmV2aWV3JyArIHBhdGgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYHNyY3NldD1cIiR7cmV3cml0dGVufVwiYDtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAvLyA0LiBOZXh0LmpzIF9fTkVYVF9EQVRBX18gXHVDMkE0XHVEMDZDXHVCOUJEXHVEMkI4IFx1QzIxOFx1QzgxNSAoVVJMIFx1QUNCRFx1Qjg1QyBcdUM4MTVcdUJDRjQpXHJcbiAgICAgICAgICAgIC8vIC9wcmV2aWV3XHVCOTdDIFx1QzgxQ1x1QUM3MFx1RDU1OFx1QzVFQyBOZXh0LmpzIFx1Qjc3Q1x1QzZCMFx1RDEzMFx1QUMwMCBcdUM2MkNcdUJDMTRcdUI5NzggXHVBQ0JEXHVCODVDXHVCODVDIFx1Qzc3OFx1QzJERFx1RDU1OFx1QjNDNFx1Qjg1RFxyXG4gICAgICAgICAgICBodG1sID0gaHRtbC5yZXBsYWNlKFxyXG4gICAgICAgICAgICAgIC8oPHNjcmlwdFxccytpZD1cIl9fTkVYVF9EQVRBX19cIltePl0qPikoW1xcc1xcU10qPykoPFxcL3NjcmlwdD4pL2dpLFxyXG4gICAgICAgICAgICAgIChtYXRjaCwgb3BlblRhZywganNvbkNvbnRlbnQsIGNsb3NlVGFnKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAvLyBKU09OIFx1RDMwQ1x1QzJGMSBcdUQ2QzQgVVJMIFx1QUQwMFx1QjgyOCBcdUQ1NDRcdUI0REMgXHVDMjE4XHVDODE1XHJcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGpzb25Db250ZW50KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgIC8vIHBhZ2UgXHVENTQ0XHVCNERDIFx1QzIxOFx1QzgxNVxyXG4gICAgICAgICAgICAgICAgICBpZiAoZGF0YS5wYWdlICYmIGRhdGEucGFnZS5zdGFydHNXaXRoKCcvcHJldmlldycpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5wYWdlID0gZGF0YS5wYWdlLnJlcGxhY2UoL15cXC9wcmV2aWV3LywgJycpIHx8ICcvJztcclxuICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgLy8gcXVlcnlcdUM1RDBcdUMxMUMgXHVBQ0JEXHVCODVDIFx1QUQwMFx1QjgyOCBcdUM4MTVcdUJDRjQgXHVDMjE4XHVDODE1XHJcbiAgICAgICAgICAgICAgICAgIGlmIChkYXRhLnF1ZXJ5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoZGF0YS5xdWVyeSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZGF0YS5xdWVyeVtrZXldID09PSAnc3RyaW5nJyAmJiBkYXRhLnF1ZXJ5W2tleV0uc3RhcnRzV2l0aCgnL3ByZXZpZXcnKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhLnF1ZXJ5W2tleV0gPSBkYXRhLnF1ZXJ5W2tleV0ucmVwbGFjZSgvXlxcL3ByZXZpZXcvLCAnJykgfHwgJy8nO1xyXG4gICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgLy8gYnVpbGRJZFx1QjI5NCBcdUFERjhcdUIzMDBcdUI4NUMgXHVDNzIwXHVDOUMwXHJcbiAgICAgICAgICAgICAgICAgIC8vIGFzc2V0UHJlZml4IFx1Q0M5OFx1QjlBQ1xyXG4gICAgICAgICAgICAgICAgICBpZiAoZGF0YS5hc3NldFByZWZpeCAmJiBkYXRhLmFzc2V0UHJlZml4LnN0YXJ0c1dpdGgoJy9wcmV2aWV3JykpIHtcclxuICAgICAgICAgICAgICAgICAgICBkYXRhLmFzc2V0UHJlZml4ID0gZGF0YS5hc3NldFByZWZpeC5yZXBsYWNlKC9eXFwvcHJldmlldy8sICcnKTtcclxuICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tQcmV2aWV3IFByb3h5XSBNb2RpZmllZCBfX05FWFRfREFUQV9fIHBhZ2U6JywgZGF0YS5wYWdlKTtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIG9wZW5UYWcgKyBKU09OLnN0cmluZ2lmeShkYXRhKSArIGNsb3NlVGFnO1xyXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1tQcmV2aWV3IFByb3h5XSBGYWlsZWQgdG8gcGFyc2UgX19ORVhUX0RBVEFfXzonLCBlKTtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIG1hdGNoO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnRlbnQgPSBCdWZmZXIuZnJvbShodG1sLCAndXRmLTgnKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIC8vIFJTQyBcdUM3NTFcdUIyRjVcdUM3NDAgXHVDMjE4XHVDODE1XHVENTU4XHVDOUMwIFx1QzU0QVx1Qzc0QyAodGV4dC94LWNvbXBvbmVudCBcdUI2MTBcdUIyOTQgUlNDIFx1RDVFNFx1QjM1NFx1QUMwMCBcdUM3ODhcdUIyOTQgXHVBQ0JEXHVDNkIwKVxyXG4gICAgICAgICAgZWxzZSBpZiAoY29udGVudFR5cGUuaW5jbHVkZXMoJ3RleHQveC1jb21wb25lbnQnKSB8fCByZXEuaGVhZGVyc1sncnNjJ10pIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tQcmV2aWV3IFByb3h5XSBSU0MgcmVzcG9uc2UgLSBub3QgbW9kaWZ5aW5nJyk7XHJcbiAgICAgICAgICAgIC8vIFJTQyBcdUM3NTFcdUIyRjVcdUM3NDAgXHVBREY4XHVCMzAwXHVCODVDIFx1QzgwNFx1QjJFQ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgLy8gUHJvY2VzcyBKYXZhU2NyaXB0IHJlc3BvbnNlc1xyXG4gICAgICAgICAgZWxzZSBpZiAoY29udGVudFR5cGUuaW5jbHVkZXMoJ2phdmFzY3JpcHQnKSB8fCBjb250ZW50VHlwZS5pbmNsdWRlcygnYXBwbGljYXRpb24vanNvbicpKSB7XHJcbiAgICAgICAgICAgIGxldCBqcyA9IGNvbnRlbnQudG9TdHJpbmcoJ3V0Zi04Jyk7XHJcblxyXG4gICAgICAgICAgICAvLyBSZXdyaXRlIFVSTHMgaW4gSlMvSlNPTiBzdHJpbmdzXHJcbiAgICAgICAgICAgIGpzID0gcmV3cml0ZVVybHNJblRleHQoanMpO1xyXG5cclxuICAgICAgICAgICAgLy8gQWxzbyByZXdyaXRlIHJvb3QtcmVsYXRpdmUgcGF0aHMgdGhhdCBsb29rIGxpa2UgcmVzb3VyY2UgVVJMc1xyXG4gICAgICAgICAgICAvLyBCZSBjYXJlZnVsIG5vdCB0byBicmVhayBjb2RlIC0gb25seSByZXdyaXRlIG9idmlvdXMgVVJMIHBhdHRlcm5zXHJcbiAgICAgICAgICAgIGpzID0ganMucmVwbGFjZShcclxuICAgICAgICAgICAgICAvW1wiJ10oXFwvKD86X25leHR8c3RhdGljfGFzc2V0c3xhcGl8aW1hZ2VzfGZvbnRzfGNzc3xqcylcXC9bXlwiJ10rKVtcIiddL2csXHJcbiAgICAgICAgICAgICAgJ1wiL3ByZXZpZXckMVwiJ1xyXG4gICAgICAgICAgICApO1xyXG5cclxuICAgICAgICAgICAgY29udGVudCA9IEJ1ZmZlci5mcm9tKGpzLCAndXRmLTgnKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIC8vIFByb2Nlc3MgQ1NTIHJlc3BvbnNlc1xyXG4gICAgICAgICAgZWxzZSBpZiAoY29udGVudFR5cGUuaW5jbHVkZXMoJ3RleHQvY3NzJykpIHtcclxuICAgICAgICAgICAgbGV0IGNzcyA9IGNvbnRlbnQudG9TdHJpbmcoJ3V0Zi04Jyk7XHJcblxyXG4gICAgICAgICAgICAvLyBSZXdyaXRlIHVybCgpIHJlZmVyZW5jZXNcclxuICAgICAgICAgICAgY3NzID0gY3NzLnJlcGxhY2UoXHJcbiAgICAgICAgICAgICAgL3VybFxcKFtcIiddPyhcXC9bXilcIiddKylbXCInXT9cXCkvZ2ksXHJcbiAgICAgICAgICAgICAgJ3VybChcIi9wcmV2aWV3JDFcIiknXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIC8vIFJld3JpdGUgZnVsbCBvcmlnaW4gVVJMc1xyXG4gICAgICAgICAgICBjc3MgPSByZXdyaXRlVXJsc0luVGV4dChjc3MpO1xyXG5cclxuICAgICAgICAgICAgY29udGVudCA9IEJ1ZmZlci5mcm9tKGNzcywgJ3V0Zi04Jyk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gVXBkYXRlIENvbnRlbnQtTGVuZ3RoIGFmdGVyIG1vZGlmaWNhdGlvbnNcclxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtTGVuZ3RoJywgY29udGVudC5sZW5ndGgpO1xyXG5cclxuICAgICAgICAgIHJlcy5lbmQoY29udGVudCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcignW1ByZXZpZXcgUHJveHldIEVycm9yOicsIGVycm9yLm1lc3NhZ2UpO1xyXG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDI7XHJcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAndGV4dC9wbGFpbicpO1xyXG4gICAgICAgICAgcmVzLmVuZCgnUHJveHkgZXJyb3I6ICcgKyBlcnJvci5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgLy8gQVBJIHJvdXRlcyBtaWRkbGV3YXJlXHJcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XHJcbiAgICAgICAgY29uc3QgdXJsID0gcmVxLnVybCB8fCAnJztcclxuXHJcbiAgICAgICAgLy8gT25seSBoYW5kbGUgL2FwaSByb3V0ZXNcclxuICAgICAgICBpZiAoIXVybC5zdGFydHNXaXRoKCcvYXBpLycpKSB7XHJcbiAgICAgICAgICByZXR1cm4gbmV4dCgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIC8vIEdFVCAvYXBpL2NvbmZpZy86dHlwZVxyXG4gICAgICAgICAgY29uc3QgY29uZmlnR2V0TWF0Y2ggPSB1cmwubWF0Y2goL15cXC9hcGlcXC9jb25maWdcXC8oYXBwfHRoZW1lfHBsdWdpbnN8YnVpbGQtZW52KSQvKTtcclxuICAgICAgICAgIGlmIChjb25maWdHZXRNYXRjaCAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xyXG4gICAgICAgICAgICBjb25zdCB0eXBlID0gY29uZmlnR2V0TWF0Y2hbMV07XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gQ09ORklHX0ZJTEVTW3R5cGVdO1xyXG4gICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihjb25zdGFudHNEaXIsIGZpbGVuYW1lKTtcclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKGZpbGVQYXRoLCAndXRmLTgnKTtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgSlNPTi5wYXJzZShjb250ZW50KSk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgNTAwLCB7IGVycm9yOiBgRmFpbGVkIHRvIHJlYWQgJHtmaWxlbmFtZX1gIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBQVVQgL2FwaS9jb25maWcvOnR5cGVcclxuICAgICAgICAgIGlmIChjb25maWdHZXRNYXRjaCAmJiByZXEubWV0aG9kID09PSAnUFVUJykge1xyXG4gICAgICAgICAgICBjb25zdCB0eXBlID0gY29uZmlnR2V0TWF0Y2hbMV07XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lID0gQ09ORklHX0ZJTEVTW3R5cGVdO1xyXG4gICAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihjb25zdGFudHNEaXIsIGZpbGVuYW1lKTtcclxuICAgICAgICAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRCb2R5KHJlcSk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIWJvZHkgfHwgdHlwZW9mIGJvZHkgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkoYm9keSkpIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDQwMCwgeyBlcnJvcjogJ1JlcXVlc3QgYm9keSBtdXN0IGJlIGEgdmFsaWQgSlNPTiBvYmplY3QnIH0pO1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gcGx1Z2lucyBcdUM4MDBcdUM3QTUgXHVDMkRDIFx1QjEyNFx1Qzc4NFx1QzJBNFx1RDM5OFx1Qzc3NFx1QzJBNCBcdUNEQTlcdUIzQ0MgXHVBQzgwXHVDMEFDXHJcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAncGx1Z2lucycpIHtcclxuICAgICAgICAgICAgICBjb25zdCB2YWxpZGF0aW9uID0gdmFsaWRhdGVQbHVnaW5OYW1lc3BhY2VzKGJvZHkpO1xyXG4gICAgICAgICAgICAgIGlmICghdmFsaWRhdGlvbi52YWxpZCkge1xyXG4gICAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCA0MDAsIHtcclxuICAgICAgICAgICAgICAgICAgZXJyb3I6ICdOYW1lc3BhY2UgY29uZmxpY3QgZGV0ZWN0ZWQnLFxyXG4gICAgICAgICAgICAgICAgICBjb25mbGljdHM6IHZhbGlkYXRpb24uY29uZmxpY3RzXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgLy8gYnVpbGQtZW52IFx1QzgwMFx1QzdBNSBcdUMyREMgU0RLIFx1QUNCRFx1Qjg1QyBcdUM3OTBcdUIzRDkgXHVDMjE4XHVDODE1XHJcbiAgICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdidWlsZC1lbnYnICYmIGJvZHkuYW5kcm9pZD8uc2RrUGF0aCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxQYXRoID0gYm9keS5hbmRyb2lkLnNka1BhdGg7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoVmFsaWRhdGlvbiA9IHZhbGlkYXRlU2RrUGF0aChvcmlnaW5hbFBhdGgpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICghcGF0aFZhbGlkYXRpb24udmFsaWQpIHtcclxuICAgICAgICAgICAgICAgICAgLy8gXHVDNzk4XHVCQUJCXHVCNDFDIFx1QUNCRFx1Qjg1QyBcdUM3OTBcdUIzRDkgXHVDMjE4XHVDODE1XHJcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGNvcnJlY3RlZFBhdGggPSBpbmZlclNka1Jvb3Qob3JpZ2luYWxQYXRoKTtcclxuICAgICAgICAgICAgICAgICAgYm9keS5hbmRyb2lkLnNka1BhdGggPSBjb3JyZWN0ZWRQYXRoO1xyXG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW2FwaS1wbHVnaW5dIFNESyBwYXRoIGF1dG8tY29ycmVjdGVkOiAke29yaWdpbmFsUGF0aH0gLT4gJHtjb3JyZWN0ZWRQYXRofWApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IEpTT04uc3RyaW5naWZ5KGJvZHksIG51bGwsIDIpICsgJ1xcbic7XHJcbiAgICAgICAgICAgICAgYXdhaXQgZnMud3JpdGVGaWxlKGZpbGVQYXRoLCBjb250ZW50LCAndXRmLTgnKTtcclxuXHJcbiAgICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdwbHVnaW5zJykge1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgcmVnZW5lcmF0ZVBsdWdpblJlZ2lzdHJ5KCk7XHJcbiAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAvLyBidWlsZC1lbnYgXHVDODAwXHVDN0E1IFx1QzJEQyBsb2NhbC5wcm9wZXJ0aWVzXHVCM0M0IFx1QzVDNVx1QjM3MFx1Qzc3NFx1RDJCOFxyXG4gICAgICAgICAgICAgIGlmICh0eXBlID09PSAnYnVpbGQtZW52JyAmJiBib2R5LmFuZHJvaWQ/LnNka1BhdGgpIHtcclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgIGF3YWl0IHVwZGF0ZUxvY2FsUHJvcGVydGllcyhib2R5LmFuZHJvaWQuc2RrUGF0aCk7XHJcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbYXBpLXBsdWdpbl0gQ291bGQgbm90IHVwZGF0ZSBsb2NhbC5wcm9wZXJ0aWVzOicsIGUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgLy8gXHVBQ0JEXHVCODVDXHVBQzAwIFx1QzIxOFx1QzgxNVx1QjQxQyBcdUFDQkRcdUM2QjAgXHVDMjE4XHVDODE1XHVCNDFDIFx1QjM3MFx1Qzc3NFx1RDEzMCBcdUJDMThcdUQ2NThcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyBzdWNjZXNzOiB0cnVlLCBkYXRhOiBib2R5IH0pO1xyXG4gICAgICAgICAgICB9IGNhdGNoIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDUwMCwgeyBlcnJvcjogYEZhaWxlZCB0byB3cml0ZSAke2ZpbGVuYW1lfWAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIEdFVCAvYXBpL3BsdWdpbnMvaW5zdGFsbGVkXHJcbiAgICAgICAgICBpZiAodXJsID09PSAnL2FwaS9wbHVnaW5zL2luc3RhbGxlZCcgJiYgcmVxLm1ldGhvZCA9PT0gJ0dFVCcpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1thcGktcGx1Z2luXSBGZXRjaGluZyBpbnN0YWxsZWQgcGFja2FnZXMuLi4nKTtcclxuICAgICAgICAgICAgY29uc3QgcGFja2FnZXMgPSBhd2FpdCBnZXRJbnN0YWxsZWRQYWNrYWdlcygpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW2FwaS1wbHVnaW5dIEZvdW5kJywgcGFja2FnZXMubGVuZ3RoLCAnaW5zdGFsbGVkIHBhY2thZ2VzJyk7XHJcbiAgICAgICAgICAgIC8vIHJud3ctcGx1Z2luLSogXHVCOUNDIFx1RDU0NFx1RDEzMFx1QjlDMVxyXG4gICAgICAgICAgICBjb25zdCBybnd3UGx1Z2lucyA9IHBhY2thZ2VzLmZpbHRlcihwID0+IHAubmFtZS5zdGFydHNXaXRoKCdybnd3LXBsdWdpbi0nKSk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbYXBpLXBsdWdpbl0gUk5XVyBwbHVnaW5zOicsIHJud3dQbHVnaW5zLm1hcChwID0+IHAubmFtZSkpO1xyXG4gICAgICAgICAgICBjb25zdCBzb3J0ZWQgPSBwYWNrYWdlcy5zb3J0KChhLCBiKSA9PiB7XHJcbiAgICAgICAgICAgICAgY29uc3QgYUlzUm53dyA9IGEubmFtZS5zdGFydHNXaXRoKCdybnd3LXBsdWdpbi0nKTtcclxuICAgICAgICAgICAgICBjb25zdCBiSXNSbnd3ID0gYi5uYW1lLnN0YXJ0c1dpdGgoJ3Jud3ctcGx1Z2luLScpO1xyXG4gICAgICAgICAgICAgIGlmIChhSXNSbnd3ICYmICFiSXNSbnd3KSByZXR1cm4gLTE7XHJcbiAgICAgICAgICAgICAgaWYgKCFhSXNSbnd3ICYmIGJJc1Jud3cpIHJldHVybiAxO1xyXG4gICAgICAgICAgICAgIHJldHVybiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHNvcnRlZCk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBHRVQgL2FwaS9wbHVnaW5zL3NlYXJjaD9xPXF1ZXJ5XHJcbiAgICAgICAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJy9hcGkvcGx1Z2lucy9zZWFyY2gnKSAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW2FwaS1wbHVnaW5dIFNlYXJjaCByZXF1ZXN0IFVSTDonLCB1cmwpO1xyXG4gICAgICAgICAgICBjb25zdCB1cmxPYmogPSBuZXcgVVJMKHVybCwgJ2h0dHA6Ly9sb2NhbGhvc3QnKTtcclxuICAgICAgICAgICAgY29uc3QgcXVlcnkgPSB1cmxPYmouc2VhcmNoUGFyYW1zLmdldCgncScpIHx8ICdybnd3LXBsdWdpbic7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbYXBpLXBsdWdpbl0gUGFyc2VkIHF1ZXJ5OicsIHF1ZXJ5KTtcclxuXHJcbiAgICAgICAgICAgIGlmICghaXNWYWxpZFNlYXJjaFF1ZXJ5KHF1ZXJ5KSkge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbYXBpLXBsdWdpbl0gUXVlcnkgdmFsaWRhdGlvbiBmYWlsZWQnKTtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDQwMCwgeyBlcnJvcjogJ0ludmFsaWQgc2VhcmNoIHF1ZXJ5JyB9KTtcclxuICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBzZWFyY2hOcG1QYWNrYWdlcyhxdWVyeSk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbYXBpLXBsdWdpbl0gUmV0dXJuaW5nJywgcmVzdWx0cy5sZW5ndGgsICdyZXN1bHRzJyk7XHJcbiAgICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCByZXN1bHRzKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFBPU1QgL2FwaS9wbHVnaW5zL2luc3RhbGxcclxuICAgICAgICAgIGlmICh1cmwgPT09ICcvYXBpL3BsdWdpbnMvaW5zdGFsbCcgJiYgcmVxLm1ldGhvZCA9PT0gJ1BPU1QnKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHsgbmFtZSwgdmVyc2lvbiB9ID0gYXdhaXQgcmVhZEJvZHkocmVxKTtcclxuXHJcbiAgICAgICAgICAgIGlmICghbmFtZSB8fCAhaXNWYWxpZFBhY2thZ2VOYW1lKG5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCA0MDAsIHsgZXJyb3I6ICdJbnZhbGlkIHBhY2thZ2UgbmFtZScgfSk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBpbnN0YWxsUGFja2FnZShuYW1lLCB2ZXJzaW9uKTtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHsgc3VjY2VzczogdHJ1ZSB9KTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDUwMCwgeyBlcnJvcjogcmVzdWx0LmVycm9yIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBQT1NUIC9hcGkvcGx1Z2lucy91bmluc3RhbGxcclxuICAgICAgICAgIGlmICh1cmwgPT09ICcvYXBpL3BsdWdpbnMvdW5pbnN0YWxsJyAmJiByZXEubWV0aG9kID09PSAnUE9TVCcpIHtcclxuICAgICAgICAgICAgY29uc3QgeyBuYW1lIH0gPSBhd2FpdCByZWFkQm9keShyZXEpO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFuYW1lIHx8ICFpc1ZhbGlkUGFja2FnZU5hbWUobmFtZSkpIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDQwMCwgeyBlcnJvcjogJ0ludmFsaWQgcGFja2FnZSBuYW1lJyB9KTtcclxuICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHVuaW5zdGFsbFBhY2thZ2UobmFtZSk7XHJcbiAgICAgICAgICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IHN1Y2Nlc3M6IHRydWUgfSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCA1MDAsIHsgZXJyb3I6IHJlc3VsdC5lcnJvciB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gR0VUIC9hcGkvcGx1Z2lucy9zY2FuXHJcbiAgICAgICAgICBpZiAodXJsID09PSAnL2FwaS9wbHVnaW5zL3NjYW4nICYmIHJlcS5tZXRob2QgPT09ICdHRVQnKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgZW50cmllcyA9IGF3YWl0IGZzLnJlYWRkaXIoYnJpZGdlc0RpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pO1xyXG4gICAgICAgICAgICAgIGNvbnN0IGZvbGRlcnMgPSBlbnRyaWVzXHJcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGVudHJ5ID0+IGVudHJ5LmlzRGlyZWN0b3J5KCkpXHJcbiAgICAgICAgICAgICAgICAubWFwKGVudHJ5ID0+IGAuLyR7ZW50cnkubmFtZX1gKTtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgZm9sZGVycyk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgNTAwLCB7IGVycm9yOiAnRmFpbGVkIHRvIHNjYW4gYnJpZGdlcyBmb2xkZXInIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBQT1NUIC9hcGkvcGx1Z2lucy92YWxpZGF0ZSAtIFx1QjEyNFx1Qzc4NFx1QzJBNFx1RDM5OFx1Qzc3NFx1QzJBNCBcdUNEQTlcdUIzQ0MgXHVBQzgwXHVDMEFDXHJcbiAgICAgICAgICBpZiAodXJsID09PSAnL2FwaS9wbHVnaW5zL3ZhbGlkYXRlJyAmJiByZXEubWV0aG9kID09PSAnUE9TVCcpIHtcclxuICAgICAgICAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRCb2R5KHJlcSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHZhbGlkYXRpb24gPSB2YWxpZGF0ZVBsdWdpbk5hbWVzcGFjZXMoYm9keSk7XHJcbiAgICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB2YWxpZGF0aW9uKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vID09PT09PT09PT0gQnVpbGQgQVBJID09PT09PT09PT1cclxuXHJcbiAgICAgICAgICAvLyBHRVQgL2FwaS9idWlsZC9lbnYtY2hlY2sgLSBFbnZpcm9ubWVudCB2ZXJpZmljYXRpb25cclxuICAgICAgICAgIGlmICh1cmwgPT09ICcvYXBpL2J1aWxkL2Vudi1jaGVjaycgJiYgcmVxLm1ldGhvZCA9PT0gJ0dFVCcpIHtcclxuICAgICAgICAgICAgY29uc3QgY2hlY2tzID0gYXdhaXQgY2hlY2tCdWlsZEVudmlyb25tZW50KCk7XHJcbiAgICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IGNoZWNrcyB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFBPU1QgL2FwaS9idWlsZC9hY2NlcHQtbGljZW5zZXMgLSBBY2NlcHQgU0RLIGxpY2Vuc2VzXHJcbiAgICAgICAgICBpZiAodXJsID09PSAnL2FwaS9idWlsZC9hY2NlcHQtbGljZW5zZXMnICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgIGNvbnN0IGJ1aWxkRW52ID0gYXdhaXQgbG9hZEJ1aWxkRW52KCk7XHJcbiAgICAgICAgICAgICAgY29uc3Qgc2RrUGF0aCA9IGJ1aWxkRW52LmFuZHJvaWQ/LnNka1BhdGg7XHJcbiAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYWNjZXB0U2RrTGljZW5zZXMoc2RrUGF0aCk7XHJcblxyXG4gICAgICAgICAgICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogcmVzdWx0Lm1lc3NhZ2UgfSk7XHJcbiAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgNTAwLCB7IGVycm9yOiByZXN1bHQubWVzc2FnZSB9KTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDUwMCwgeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gUE9TVCAvYXBpL2J1aWxkL3N0YXJ0IC0gU3RhcnQgYnVpbGRcclxuICAgICAgICAgIGlmICh1cmwgPT09ICcvYXBpL2J1aWxkL3N0YXJ0JyAmJiByZXEubWV0aG9kID09PSAnUE9TVCcpIHtcclxuICAgICAgICAgICAgY29uc3QgeyB0eXBlLCBwcm9maWxlIH0gPSBhd2FpdCByZWFkQm9keShyZXEpO1xyXG4gICAgICAgICAgICBjb25zdCBidWlsZElkID0gYGJ1aWxkLSR7RGF0ZS5ub3coKX1gO1xyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBjb25zdCBidWlsZFByb2Nlc3MgPSBzdGFydEJ1aWxkUHJvY2Vzcyh0eXBlLCBwcm9maWxlLCBidWlsZElkKTtcclxuICAgICAgICAgICAgICBidWlsZFByb2Nlc3Nlcy5zZXQoYnVpbGRJZCwgYnVpbGRQcm9jZXNzKTtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyBidWlsZElkIH0pO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCA1MDAsIHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIEdFVCAvYXBpL2J1aWxkL291dHB1dC86aWQgLSBHZXQgYnVpbGQgb3V0cHV0XHJcbiAgICAgICAgICBjb25zdCBvdXRwdXRNYXRjaCA9IHVybC5tYXRjaCgvXlxcL2FwaVxcL2J1aWxkXFwvb3V0cHV0XFwvKFthLXowLTktXSspJC8pO1xyXG4gICAgICAgICAgaWYgKG91dHB1dE1hdGNoICYmIHJlcS5tZXRob2QgPT09ICdHRVQnKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkSWQgPSBvdXRwdXRNYXRjaFsxXTtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGQgPSBidWlsZFByb2Nlc3Nlcy5nZXQoYnVpbGRJZCk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIWJ1aWxkKSB7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCA0MDQsIHsgZXJyb3I6ICdCdWlsZCBub3QgZm91bmQnIH0pO1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gR2V0IG5ldyBsaW5lcyBzaW5jZSBsYXN0IGZldGNoXHJcbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gYnVpbGQub3V0cHV0LnNwbGljZSgwLCBidWlsZC5vdXRwdXQubGVuZ3RoKTtcclxuICAgICAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHsgbGluZXMsIGZpbmlzaGVkOiBidWlsZC5maW5pc2hlZCB9KTtcclxuXHJcbiAgICAgICAgICAgIC8vIENsZWFuIHVwIGZpbmlzaGVkIGJ1aWxkcyBhZnRlciBzb21lIHRpbWVcclxuICAgICAgICAgICAgaWYgKGJ1aWxkLmZpbmlzaGVkKSB7XHJcbiAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiBidWlsZFByb2Nlc3Nlcy5kZWxldGUoYnVpbGRJZCksIDYwMDAwKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gUE9TVCAvYXBpL2J1aWxkL2NhbmNlbC86aWQgLSBDYW5jZWwgYnVpbGRcclxuICAgICAgICAgIGNvbnN0IGNhbmNlbE1hdGNoID0gdXJsLm1hdGNoKC9eXFwvYXBpXFwvYnVpbGRcXC9jYW5jZWxcXC8oW2EtejAtOS1dKykkLyk7XHJcbiAgICAgICAgICBpZiAoY2FuY2VsTWF0Y2ggJiYgcmVxLm1ldGhvZCA9PT0gJ1BPU1QnKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkSWQgPSBjYW5jZWxNYXRjaFsxXTtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGQgPSBidWlsZFByb2Nlc3Nlcy5nZXQoYnVpbGRJZCk7XHJcblxyXG4gICAgICAgICAgICBpZiAoYnVpbGQgJiYgIWJ1aWxkLmZpbmlzaGVkKSB7XHJcbiAgICAgICAgICAgICAgYnVpbGQucHJvY2Vzcy5raWxsKCk7XHJcbiAgICAgICAgICAgICAgYnVpbGQuZmluaXNoZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgIGJ1aWxkLm91dHB1dC5wdXNoKHsgdHlwZTogJ2luZm8nLCB0ZXh0OiAnQnVpbGQgY2FuY2VsbGVkIGJ5IHVzZXInLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHsgc3VjY2VzczogdHJ1ZSB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFBPU1QgL2FwaS9idWlsZC9jbGVhbiAtIENsZWFuIEdyYWRsZSBjYWNoZVxyXG4gICAgICAgICAgaWYgKHVybCA9PT0gJy9hcGkvYnVpbGQvY2xlYW4nICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xyXG4gICAgICAgICAgICBjb25zdCBidWlsZElkID0gYGNsZWFuLSR7RGF0ZS5ub3coKX1gO1xyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBjb25zdCBidWlsZFByb2Nlc3MgPSBzdGFydENsZWFuUHJvY2VzcyhidWlsZElkKTtcclxuICAgICAgICAgICAgICBidWlsZFByb2Nlc3Nlcy5zZXQoYnVpbGRJZCwgYnVpbGRQcm9jZXNzKTtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyBidWlsZElkIH0pO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCA1MDAsIHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFBPU1QgL2FwaS9idWlsZC9kZWVwLWNsZWFuIC0gRGVsZXRlIGFuZHJvaWQgZm9sZGVyIGFuZCBydW4gcHJlYnVpbGRcclxuICAgICAgICAgIGlmICh1cmwgPT09ICcvYXBpL2J1aWxkL2RlZXAtY2xlYW4nICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xyXG4gICAgICAgICAgICBjb25zdCBidWlsZElkID0gYGRlZXBjbGVhbi0ke0RhdGUubm93KCl9YDtcclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgYnVpbGRQcm9jZXNzID0gc3RhcnREZWVwQ2xlYW5Qcm9jZXNzKGJ1aWxkSWQpO1xyXG4gICAgICAgICAgICAgIGJ1aWxkUHJvY2Vzc2VzLnNldChidWlsZElkLCBidWlsZFByb2Nlc3MpO1xyXG4gICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IGJ1aWxkSWQgfSk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDUwMCwgeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gR0VUIC9hcGkvYnVpbGQva2V5c3RvcmUgLSBDaGVjayBrZXlzdG9yZSBzdGF0dXNcclxuICAgICAgICAgIGlmICh1cmwgPT09ICcvYXBpL2J1aWxkL2tleXN0b3JlJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xyXG4gICAgICAgICAgICBjb25zdCBrZXlzdG9yZVBhdGhzID0gW1xyXG4gICAgICAgICAgICAgIHBhdGguam9pbihwcm9qZWN0Um9vdCwgJ2FuZHJvaWQnLCAnYXBwJywgJ3JlbGVhc2Uua2V5c3RvcmUnKSxcclxuICAgICAgICAgICAgICBwYXRoLmpvaW4ocHJvamVjdFJvb3QsICdhbmRyb2lkJywgJ2FwcCcsICdteS1yZWxlYXNlLWtleS5rZXlzdG9yZScpLFxyXG4gICAgICAgICAgICAgIHBhdGguam9pbihwcm9qZWN0Um9vdCwgJ2FuZHJvaWQnLCAna2V5c3RvcmVzJywgJ3JlbGVhc2Uua2V5c3RvcmUnKVxyXG4gICAgICAgICAgICBdO1xyXG5cclxuICAgICAgICAgICAgbGV0IGZvdW5kUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgcCBvZiBrZXlzdG9yZVBhdGhzKSB7XHJcbiAgICAgICAgICAgICAgaWYgKGZzU3luYy5leGlzdHNTeW5jKHApKSB7XHJcbiAgICAgICAgICAgICAgICBmb3VuZFBhdGggPSBwO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBDaGVjayBncmFkbGUucHJvcGVydGllcyBmb3Igc2lnbmluZyBjb25maWdcclxuICAgICAgICAgICAgbGV0IGhhc1NpZ25pbmdDb25maWcgPSBmYWxzZTtcclxuICAgICAgICAgICAgY29uc3QgZ3JhZGxlUHJvcHNQYXRoID0gcGF0aC5qb2luKHByb2plY3RSb290LCAnYW5kcm9pZCcsICdncmFkbGUucHJvcGVydGllcycpO1xyXG4gICAgICAgICAgICBpZiAoZnNTeW5jLmV4aXN0c1N5bmMoZ3JhZGxlUHJvcHNQYXRoKSkge1xyXG4gICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBmc1N5bmMucmVhZEZpbGVTeW5jKGdyYWRsZVByb3BzUGF0aCwgJ3V0Zi04Jyk7XHJcbiAgICAgICAgICAgICAgaGFzU2lnbmluZ0NvbmZpZyA9IGNvbnRlbnQuaW5jbHVkZXMoJ01ZQVBQX1JFTEVBU0VfU1RPUkVfUEFTU1dPUkQnKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHtcclxuICAgICAgICAgICAgICBleGlzdHM6ICEhZm91bmRQYXRoLFxyXG4gICAgICAgICAgICAgIHBhdGg6IGZvdW5kUGF0aCxcclxuICAgICAgICAgICAgICBoYXNTaWduaW5nQ29uZmlnXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gUE9TVCAvYXBpL2J1aWxkL29wZW4tZm9sZGVyIC0gT3BlbiBmb2xkZXIgaW4gZmlsZSBleHBsb3JlclxyXG4gICAgICAgICAgaWYgKHVybCA9PT0gJy9hcGkvYnVpbGQvb3Blbi1mb2xkZXInICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xyXG4gICAgICAgICAgICBjb25zdCB7IGZpbGVQYXRoIH0gPSBhd2FpdCByZWFkQm9keShyZXEpO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFmaWxlUGF0aCkge1xyXG4gICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgNDAwLCB7IGVycm9yOiAnZmlsZVBhdGggaXMgcmVxdWlyZWQnIH0pO1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gXHVDMEMxXHVCMzAwIFx1QUNCRFx1Qjg1Q1x1Qjk3QyBcdUM4MDhcdUIzMDAgXHVBQ0JEXHVCODVDXHVCODVDIFx1QkNDMFx1RDY1OFxyXG4gICAgICAgICAgICBjb25zdCBhYnNvbHV0ZVBhdGggPSBwYXRoLmlzQWJzb2x1dGUoZmlsZVBhdGgpXHJcbiAgICAgICAgICAgICAgPyBmaWxlUGF0aFxyXG4gICAgICAgICAgICAgIDogcGF0aC5qb2luKHByb2plY3RSb290LCBmaWxlUGF0aCk7XHJcblxyXG4gICAgICAgICAgICAvLyBcdUQzMENcdUM3N0NcdUM3NzRcdUJBNzQgXHVDMEMxXHVDNzA0IFx1RDNGNFx1QjM1NCwgXHVEM0Y0XHVCMzU0XHVCQTc0IFx1QURGOFx1QjMwMFx1Qjg1Q1xyXG4gICAgICAgICAgICBsZXQgZm9sZGVyUGF0aCA9IGFic29sdXRlUGF0aDtcclxuICAgICAgICAgICAgaWYgKGZzU3luYy5leGlzdHNTeW5jKGFic29sdXRlUGF0aCkgJiYgZnNTeW5jLnN0YXRTeW5jKGFic29sdXRlUGF0aCkuaXNGaWxlKCkpIHtcclxuICAgICAgICAgICAgICBmb2xkZXJQYXRoID0gcGF0aC5kaXJuYW1lKGFic29sdXRlUGF0aCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghZnNTeW5jLmV4aXN0c1N5bmMoZm9sZGVyUGF0aCkpIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDQwNCwgeyBlcnJvcjogJ0ZvbGRlciBub3QgZm91bmQnIH0pO1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAvLyBcdUQ1MENcdUI3QUJcdUQzRkNcdUJDQzQgXHVEMzBDXHVDNzdDIFx1RDBEMFx1QzBDOVx1QUUzMCBcdUM1RjRcdUFFMzBcclxuICAgICAgICAgICAgICBjb25zdCBjbWQgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInXHJcbiAgICAgICAgICAgICAgICA/IGBleHBsb3JlciBcIiR7Zm9sZGVyUGF0aH1cImBcclxuICAgICAgICAgICAgICAgIDogcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2RhcndpbidcclxuICAgICAgICAgICAgICAgID8gYG9wZW4gXCIke2ZvbGRlclBhdGh9XCJgXHJcbiAgICAgICAgICAgICAgICA6IGB4ZGctb3BlbiBcIiR7Zm9sZGVyUGF0aH1cImA7XHJcblxyXG4gICAgICAgICAgICAgIGF3YWl0IGV4ZWNBc3luYyhjbWQpO1xyXG4gICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IHN1Y2Nlc3M6IHRydWUgfSk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDUwMCwgeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gR0VUIC9hcGkvYnVpbGQvZG93bmxvYWQgLSBEb3dubG9hZCBidWlsZCBvdXRwdXQgZmlsZVxyXG4gICAgICAgICAgaWYgKHVybC5zdGFydHNXaXRoKCcvYXBpL2J1aWxkL2Rvd25sb2FkJykgJiYgcmVxLm1ldGhvZCA9PT0gJ0dFVCcpIHtcclxuICAgICAgICAgICAgY29uc3QgdXJsT2JqID0gbmV3IFVSTCh1cmwsICdodHRwOi8vbG9jYWxob3N0Jyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gdXJsT2JqLnNlYXJjaFBhcmFtcy5nZXQoJ3BhdGgnKTtcclxuXHJcbiAgICAgICAgICAgIGlmICghZmlsZVBhdGgpIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDQwMCwgeyBlcnJvcjogJ3BhdGggcGFyYW1ldGVyIGlzIHJlcXVpcmVkJyB9KTtcclxuICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIFx1QzBDMVx1QjMwMCBcdUFDQkRcdUI4NUNcdUI5N0MgXHVDODA4XHVCMzAwIFx1QUNCRFx1Qjg1Q1x1Qjg1QyBcdUJDQzBcdUQ2NThcclxuICAgICAgICAgICAgY29uc3QgYWJzb2x1dGVQYXRoID0gcGF0aC5pc0Fic29sdXRlKGZpbGVQYXRoKVxyXG4gICAgICAgICAgICAgID8gZmlsZVBhdGhcclxuICAgICAgICAgICAgICA6IHBhdGguam9pbihwcm9qZWN0Um9vdCwgZmlsZVBhdGgpO1xyXG5cclxuICAgICAgICAgICAgLy8gXHVCQ0Y0XHVDNTQ4OiBwcm9qZWN0Um9vdCBcdUIwQjRcdUJEODBcdUM3NzhcdUM5QzAgXHVENjU1XHVDNzc4XHJcbiAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRQYXRoID0gcGF0aC5ub3JtYWxpemUoYWJzb2x1dGVQYXRoKTtcclxuICAgICAgICAgICAgaWYgKCFub3JtYWxpemVkUGF0aC5zdGFydHNXaXRoKHByb2plY3RSb290KSkge1xyXG4gICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgNDAzLCB7IGVycm9yOiAnQWNjZXNzIGRlbmllZCcgfSk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIWZzU3luYy5leGlzdHNTeW5jKGFic29sdXRlUGF0aCkpIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDQwNCwgeyBlcnJvcjogJ0ZpbGUgbm90IGZvdW5kJyB9KTtcclxuICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmc1N5bmMuc3RhdFN5bmMoYWJzb2x1dGVQYXRoKTtcclxuICAgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSBwYXRoLmJhc2VuYW1lKGFic29sdXRlUGF0aCk7XHJcblxyXG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcclxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScpO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LURpc3Bvc2l0aW9uJywgYGF0dGFjaG1lbnQ7IGZpbGVuYW1lPVwiJHtmaWxlbmFtZX1cImApO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LUxlbmd0aCcsIHN0YXQuc2l6ZSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBzdHJlYW0gPSBmc1N5bmMuY3JlYXRlUmVhZFN0cmVhbShhYnNvbHV0ZVBhdGgpO1xyXG4gICAgICAgICAgICBzdHJlYW0ucGlwZShyZXMpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gR0VUIC9hcGkvYnVpbGQvb3V0cHV0LWluZm8gLSBHZXQgaW5mbyBhYm91dCBidWlsZCBvdXRwdXQgZmlsZXNcclxuICAgICAgICAgIGlmICh1cmwgPT09ICcvYXBpL2J1aWxkL291dHB1dC1pbmZvJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xyXG4gICAgICAgICAgICBjb25zdCBvdXRwdXRzOiBBcnJheTx7IHR5cGU6IHN0cmluZzsgcGF0aDogc3RyaW5nOyBleGlzdHM6IGJvb2xlYW47IHNpemU/OiBudW1iZXI7IG1vZGlmaWVkPzogbnVtYmVyIH0+ID0gW107XHJcblxyXG4gICAgICAgICAgICBjb25zdCBvdXRwdXRQYXRocyA9IFtcclxuICAgICAgICAgICAgICB7IHR5cGU6ICdEZWJ1ZyBBUEsnLCBwYXRoOiAnYW5kcm9pZC9hcHAvYnVpbGQvb3V0cHV0cy9hcGsvZGVidWcvYXBwLWRlYnVnLmFwaycgfSxcclxuICAgICAgICAgICAgICB7IHR5cGU6ICdSZWxlYXNlIEFQSycsIHBhdGg6ICdhbmRyb2lkL2FwcC9idWlsZC9vdXRwdXRzL2Fway9yZWxlYXNlL2FwcC1yZWxlYXNlLmFwaycgfSxcclxuICAgICAgICAgICAgICB7IHR5cGU6ICdSZWxlYXNlIEFBQicsIHBhdGg6ICdhbmRyb2lkL2FwcC9idWlsZC9vdXRwdXRzL2J1bmRsZS9yZWxlYXNlL2FwcC1yZWxlYXNlLmFhYicgfVxyXG4gICAgICAgICAgICBdO1xyXG5cclxuICAgICAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIG91dHB1dFBhdGhzKSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgYWJzb2x1dGVQYXRoID0gcGF0aC5qb2luKHByb2plY3RSb290LCBpdGVtLnBhdGgpO1xyXG4gICAgICAgICAgICAgIGlmIChmc1N5bmMuZXhpc3RzU3luYyhhYnNvbHV0ZVBhdGgpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdGF0ID0gZnNTeW5jLnN0YXRTeW5jKGFic29sdXRlUGF0aCk7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXRzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICB0eXBlOiBpdGVtLnR5cGUsXHJcbiAgICAgICAgICAgICAgICAgIHBhdGg6IGl0ZW0ucGF0aCxcclxuICAgICAgICAgICAgICAgICAgZXhpc3RzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICBzaXplOiBzdGF0LnNpemUsXHJcbiAgICAgICAgICAgICAgICAgIG1vZGlmaWVkOiBzdGF0Lm10aW1lTXNcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBvdXRwdXRzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICB0eXBlOiBpdGVtLnR5cGUsXHJcbiAgICAgICAgICAgICAgICAgIHBhdGg6IGl0ZW0ucGF0aCxcclxuICAgICAgICAgICAgICAgICAgZXhpc3RzOiBmYWxzZVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyBvdXRwdXRzIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gUE9TVCAvYXBpL2J1aWxkL2tleXN0b3JlIC0gR2VuZXJhdGUga2V5c3RvcmVcclxuICAgICAgICAgIGlmICh1cmwgPT09ICcvYXBpL2J1aWxkL2tleXN0b3JlJyAmJiByZXEubWV0aG9kID09PSAnUE9TVCcpIHtcclxuICAgICAgICAgICAgY29uc3QgeyBhbGlhcywgc3RvcmVQYXNzd29yZCwga2V5UGFzc3dvcmQsIHZhbGlkaXR5LCBkbmFtZSB9ID0gYXdhaXQgcmVhZEJvZHkocmVxKTtcclxuXHJcbiAgICAgICAgICAgIC8vIFZhbGlkYXRlXHJcbiAgICAgICAgICAgIGlmICghYWxpYXMgfHwgIXN0b3JlUGFzc3dvcmQgfHwgc3RvcmVQYXNzd29yZC5sZW5ndGggPCA2KSB7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCA0MDAsIHsgZXJyb3I6ICdJbnZhbGlkIHBhcmFtZXRlcnMuIEFsaWFzIHJlcXVpcmVkLCBwYXNzd29yZCBtdXN0IGJlIGF0IGxlYXN0IDYgY2hhcmFjdGVycy4nIH0pO1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgYW5kcm9pZEFwcERpciA9IHBhdGguam9pbihwcm9qZWN0Um9vdCwgJ2FuZHJvaWQnLCAnYXBwJyk7XHJcbiAgICAgICAgICAgIGlmICghZnNTeW5jLmV4aXN0c1N5bmMoYW5kcm9pZEFwcERpcikpIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDQwMCwgeyBlcnJvcjogJ2FuZHJvaWQvYXBwIGZvbGRlciBub3QgZm91bmQuIFJ1biBleHBvIHByZWJ1aWxkIGZpcnN0LicgfSk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBrZXlzdG9yZVBhdGggPSBwYXRoLmpvaW4oYW5kcm9pZEFwcERpciwgJ3JlbGVhc2Uua2V5c3RvcmUnKTtcclxuICAgICAgICAgICAgY29uc3QgZmluYWxLZXlQYXNzd29yZCA9IGtleVBhc3N3b3JkIHx8IHN0b3JlUGFzc3dvcmQ7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbmFsVmFsaWRpdHkgPSB2YWxpZGl0eSB8fCAxMDAwMDtcclxuICAgICAgICAgICAgY29uc3QgZmluYWxEbmFtZSA9IGRuYW1lIHx8ICdDTj1Vbmtub3duLCBPVT1Vbmtub3duLCBPPVVua25vd24sIEw9VW5rbm93biwgU1Q9VW5rbm93biwgQz1VUyc7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgIC8vIEdlbmVyYXRlIGtleXN0b3JlIHVzaW5nIGtleXRvb2xcclxuICAgICAgICAgICAgICBjb25zdCBrZXl0b29sQ21kID0gYGtleXRvb2wgLWdlbmtleSAtdiAta2V5c3RvcmUgXCIke2tleXN0b3JlUGF0aH1cIiAtYWxpYXMgXCIke2FsaWFzfVwiIC1rZXlhbGcgUlNBIC1rZXlzaXplIDIwNDggLXZhbGlkaXR5ICR7ZmluYWxWYWxpZGl0eX0gLXN0b3JlcGFzcyBcIiR7c3RvcmVQYXNzd29yZH1cIiAta2V5cGFzcyBcIiR7ZmluYWxLZXlQYXNzd29yZH1cIiAtZG5hbWUgXCIke2ZpbmFsRG5hbWV9XCJgO1xyXG5cclxuICAgICAgICAgICAgICBhd2FpdCBleGVjQXN5bmMoa2V5dG9vbENtZCwgeyBjd2Q6IHByb2plY3RSb290LCB0aW1lb3V0OiAzMDAwMCB9KTtcclxuXHJcbiAgICAgICAgICAgICAgLy8gVXBkYXRlIGdyYWRsZS5wcm9wZXJ0aWVzXHJcbiAgICAgICAgICAgICAgY29uc3QgZ3JhZGxlUHJvcHNQYXRoID0gcGF0aC5qb2luKHByb2plY3RSb290LCAnYW5kcm9pZCcsICdncmFkbGUucHJvcGVydGllcycpO1xyXG4gICAgICAgICAgICAgIGxldCBncmFkbGVQcm9wcyA9ICcnO1xyXG4gICAgICAgICAgICAgIGlmIChmc1N5bmMuZXhpc3RzU3luYyhncmFkbGVQcm9wc1BhdGgpKSB7XHJcbiAgICAgICAgICAgICAgICBncmFkbGVQcm9wcyA9IGZzU3luYy5yZWFkRmlsZVN5bmMoZ3JhZGxlUHJvcHNQYXRoLCAndXRmLTgnKTtcclxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBleGlzdGluZyBNWUFQUF9SRUxFQVNFIHNldHRpbmdzXHJcbiAgICAgICAgICAgICAgICBncmFkbGVQcm9wcyA9IGdyYWRsZVByb3BzLnNwbGl0KCdcXG4nKVxyXG4gICAgICAgICAgICAgICAgICAuZmlsdGVyKGxpbmUgPT4gIWxpbmUuc3RhcnRzV2l0aCgnTVlBUFBfUkVMRUFTRV8nKSlcclxuICAgICAgICAgICAgICAgICAgLmpvaW4oJ1xcbicpO1xyXG4gICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgLy8gQWRkIG5ldyBzZXR0aW5nc1xyXG4gICAgICAgICAgICAgIGNvbnN0IHNpZ25pbmdDb25maWcgPSBgXHJcbiMgUmVsZWFzZSBLZXlzdG9yZSBzZXR0aW5ncyAoYXV0by1nZW5lcmF0ZWQpXHJcbk1ZQVBQX1JFTEVBU0VfU1RPUkVfRklMRT1yZWxlYXNlLmtleXN0b3JlXHJcbk1ZQVBQX1JFTEVBU0VfS0VZX0FMSUFTPSR7YWxpYXN9XHJcbk1ZQVBQX1JFTEVBU0VfU1RPUkVfUEFTU1dPUkQ9JHtzdG9yZVBhc3N3b3JkfVxyXG5NWUFQUF9SRUxFQVNFX0tFWV9QQVNTV09SRD0ke2ZpbmFsS2V5UGFzc3dvcmR9XHJcbmA7XHJcbiAgICAgICAgICAgICAgZ3JhZGxlUHJvcHMgPSBncmFkbGVQcm9wcy50cmltRW5kKCkgKyAnXFxuJyArIHNpZ25pbmdDb25maWc7XHJcbiAgICAgICAgICAgICAgZnNTeW5jLndyaXRlRmlsZVN5bmMoZ3JhZGxlUHJvcHNQYXRoLCBncmFkbGVQcm9wcywgJ3V0Zi04Jyk7XHJcblxyXG4gICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgcGF0aDoga2V5c3RvcmVQYXRoLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ0tleXN0b3JlIGNyZWF0ZWQgYW5kIGdyYWRsZS5wcm9wZXJ0aWVzIHVwZGF0ZWQnXHJcbiAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDUwMCwgeyBlcnJvcjogYEtleXN0b3JlIGdlbmVyYXRpb24gZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gR0VUIC9hcGkvcHJveHkvY29uZmlnIC0gR2V0IGN1cnJlbnQgcHJveHkgdGFyZ2V0IFVSTFxyXG4gICAgICAgICAgaWYgKHVybCA9PT0gJy9hcGkvcHJveHkvY29uZmlnJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xyXG4gICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyB0YXJnZXRVcmw6IHByb3h5VGFyZ2V0VXJsIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gR0VUIC9hcGkvcHJveHkvZGlhZ25vc2UgLSBEaWFnbm9zZSBwcm94eSBpc3N1ZXNcclxuICAgICAgICAgIGlmICh1cmwgPT09ICcvYXBpL3Byb3h5L2RpYWdub3NlJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xyXG4gICAgICAgICAgICBpZiAoIXByb3h5VGFyZ2V0VXJsIHx8ICFwcm94eVRhcmdldE9yaWdpbikge1xyXG4gICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7XHJcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdub3RfY29uZmlndXJlZCcsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnUHJveHkgdGFyZ2V0IFVSTCBub3Qgc2V0J1xyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW0RpYWdub3NlXSBUZXN0aW5nIGNvbm5lY3Rpb24gdG86JywgcHJveHlUYXJnZXRVcmwpO1xyXG4gICAgICAgICAgICAgIGNvbnN0IHRlc3RSZXNwb25zZSA9IGF3YWl0IGZldGNoKHByb3h5VGFyZ2V0VXJsLCB7XHJcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxyXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICAgICAgICAnVXNlci1BZ2VudCc6ICdNb3ppbGxhLzUuMCAoTGludXg7IEFuZHJvaWQgMTM7IFBpeGVsIDcpIEFwcGxlV2ViS2l0LzUzNy4zNicsXHJcbiAgICAgICAgICAgICAgICAgICdBY2NlcHQnOiAndGV4dC9odG1sJyxcclxuICAgICAgICAgICAgICAgICAgJ0FjY2VwdC1FbmNvZGluZyc6ICdpZGVudGl0eSdcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICByZWRpcmVjdDogJ2ZvbGxvdydcclxuICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgY29uc3QgaGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xyXG4gICAgICAgICAgICAgIHRlc3RSZXNwb25zZS5oZWFkZXJzLmZvckVhY2goKHYsIGspID0+IHsgaGVhZGVyc1trXSA9IHY7IH0pO1xyXG5cclxuICAgICAgICAgICAgICBjb25zdCBib2R5ID0gYXdhaXQgdGVzdFJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgICAgICAgICBjb25zdCBib2R5UHJldmlldyA9IGJvZHkuc2xpY2UoMCwgNTAwKTtcclxuXHJcbiAgICAgICAgICAgICAgLy8gXHVCQjM4XHVDODFDIFx1QkQ4NFx1QzExRFxyXG4gICAgICAgICAgICAgIGNvbnN0IGlzc3Vlczogc3RyaW5nW10gPSBbXTtcclxuXHJcbiAgICAgICAgICAgICAgaWYgKGhlYWRlcnNbJ2NvbnRlbnQtc2VjdXJpdHktcG9saWN5J10pIHtcclxuICAgICAgICAgICAgICAgIGlzc3Vlcy5wdXNoKCdDU1AgaGVhZGVyIHByZXNlbnQgLSBtYXkgYmxvY2sgc2NyaXB0cycpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICBpZiAoaGVhZGVyc1sneC1mcmFtZS1vcHRpb25zJ10pIHtcclxuICAgICAgICAgICAgICAgIGlzc3Vlcy5wdXNoKCdYLUZyYW1lLU9wdGlvbnMgcHJlc2VudCAtIG1heSBibG9jayBpZnJhbWUnKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgaWYgKCFib2R5LmluY2x1ZGVzKCc8aHRtbCcpICYmICFib2R5LmluY2x1ZGVzKCc8SFRNTCcpKSB7XHJcbiAgICAgICAgICAgICAgICBpc3N1ZXMucHVzaCgnUmVzcG9uc2UgbWF5IG5vdCBiZSBIVE1MJyk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIGlmIChib2R5LmluY2x1ZGVzKCc8IURPQ1RZUEUgaHRtbD4nKSAmJiBib2R5Lmxlbmd0aCA8IDEwMDApIHtcclxuICAgICAgICAgICAgICAgIGlzc3Vlcy5wdXNoKCdWZXJ5IHNob3J0IEhUTUwgLSBtaWdodCBiZSBlcnJvciBwYWdlIG9yIHJlZGlyZWN0Jyk7XHJcbiAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzOiAnb2snLFxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0VXJsOiBwcm94eVRhcmdldFVybCxcclxuICAgICAgICAgICAgICAgIHRhcmdldE9yaWdpbjogcHJveHlUYXJnZXRPcmlnaW4sXHJcbiAgICAgICAgICAgICAgICByZXNwb25zZToge1xyXG4gICAgICAgICAgICAgICAgICBzdGF0dXM6IHRlc3RSZXNwb25zZS5zdGF0dXMsXHJcbiAgICAgICAgICAgICAgICAgIHN0YXR1c1RleHQ6IHRlc3RSZXNwb25zZS5zdGF0dXNUZXh0LFxyXG4gICAgICAgICAgICAgICAgICBoZWFkZXJzLFxyXG4gICAgICAgICAgICAgICAgICBib2R5TGVuZ3RoOiBib2R5Lmxlbmd0aCxcclxuICAgICAgICAgICAgICAgICAgYm9keVByZXZpZXcsXHJcbiAgICAgICAgICAgICAgICAgIGlzc3Vlc1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHtcclxuICAgICAgICAgICAgICAgIHN0YXR1czogJ2Vycm9yJyxcclxuICAgICAgICAgICAgICAgIHRhcmdldFVybDogcHJveHlUYXJnZXRVcmwsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjogZXJyb3IubWVzc2FnZVxyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBQT1NUIC9hcGkvcHJveHkvY29uZmlnIC0gU2V0IHByb3h5IHRhcmdldCBVUkxcclxuICAgICAgICAgIGlmICh1cmwgPT09ICcvYXBpL3Byb3h5L2NvbmZpZycgJiYgcmVxLm1ldGhvZCA9PT0gJ1BPU1QnKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHsgdGFyZ2V0VXJsIH0gPSBhd2FpdCByZWFkQm9keShyZXEpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW2FwaS1wbHVnaW5dIFByb3h5IGNvbmZpZyByZXF1ZXN0OicsIHRhcmdldFVybCk7XHJcbiAgICAgICAgICAgIGlmICh0YXJnZXRVcmwpIHtcclxuICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gbmV3IFVSTCh0YXJnZXRVcmwpO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFbJ2h0dHA6JywgJ2h0dHBzOiddLmluY2x1ZGVzKHBhcnNlZC5wcm90b2NvbCkpIHtcclxuICAgICAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCA0MDAsIHsgZXJyb3I6ICdPbmx5IGh0dHAvaHR0cHMgVVJMcyBhbGxvd2VkJyB9KTtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcHJveHlUYXJnZXRVcmwgPSB0YXJnZXRVcmw7XHJcbiAgICAgICAgICAgICAgICBwcm94eVRhcmdldE9yaWdpbiA9IHBhcnNlZC5vcmlnaW47XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW2FwaS1wbHVnaW5dIFx1MjcxMyBQcm94eSBjb25maWd1cmVkOicsIHByb3h5VGFyZ2V0VXJsLCAnKG9yaWdpbjonLCBwcm94eVRhcmdldE9yaWdpbiwgJyknKTtcclxuICAgICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IHN1Y2Nlc3M6IHRydWUsIHRhcmdldFVybDogcHJveHlUYXJnZXRVcmwgfSk7XHJcbiAgICAgICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDQwMCwgeyBlcnJvcjogJ0ludmFsaWQgVVJMJyB9KTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgcHJveHlUYXJnZXRVcmwgPSBudWxsO1xyXG4gICAgICAgICAgICAgIHByb3h5VGFyZ2V0T3JpZ2luID0gbnVsbDtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW2FwaS1wbHVnaW5dIFByb3h5IGNsZWFyZWQnKTtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyBzdWNjZXNzOiB0cnVlLCB0YXJnZXRVcmw6IG51bGwgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vID09PT09PT09PT0gQURCIEFQSSA9PT09PT09PT09XHJcblxyXG4gICAgICAgICAgLy8gR0VUIC9hcGkvYWRiL2NoZWNrIC0gQURCIFx1RDY1OFx1QUNCRCBcdUQ2NTVcdUM3NzhcclxuICAgICAgICAgIGlmICh1cmwgPT09ICcvYXBpL2FkYi9jaGVjaycgJiYgcmVxLm1ldGhvZCA9PT0gJ0dFVCcpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKCdhZGIgdmVyc2lvbicsIHsgdGltZW91dDogNTAwMCB9KTtcclxuICAgICAgICAgICAgICBjb25zdCB2ZXJzaW9uTWF0Y2ggPSBzdGRvdXQubWF0Y2goL0FuZHJvaWQgRGVidWcgQnJpZGdlIHZlcnNpb24gKFtcXGQuXSspLyk7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHtcclxuICAgICAgICAgICAgICAgIGFkYkF2YWlsYWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGFkYlZlcnNpb246IHZlcnNpb25NYXRjaCA/IHZlcnNpb25NYXRjaFsxXSA6ICd1bmtub3duJ1xyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHtcclxuICAgICAgICAgICAgICAgIGFkYkF2YWlsYWJsZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjogZXJyb3IubWVzc2FnZSB8fCAnQURCIG5vdCBmb3VuZCdcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gR0VUIC9hcGkvYWRiL2RldmljZXMgLSBcdUM1RjBcdUFDQjBcdUI0MUMgXHVCNTE0XHVCQzE0XHVDNzc0XHVDMkE0IFx1QkFBOVx1Qjg1RFxyXG4gICAgICAgICAgaWYgKHVybCA9PT0gJy9hcGkvYWRiL2RldmljZXMnICYmIHJlcS5tZXRob2QgPT09ICdHRVQnKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnYWRiIGRldmljZXMgLWwnLCB7IHRpbWVvdXQ6IDEwMDAwIH0pO1xyXG4gICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gc3Rkb3V0LnNwbGl0KCdcXG4nKS5maWx0ZXIobCA9PiBsLnRyaW0oKSAmJiAhbC5zdGFydHNXaXRoKCdMaXN0IG9mJykpO1xyXG4gICAgICAgICAgICAgIGNvbnN0IGRldmljZXMgPSBsaW5lcy5tYXAobGluZSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IGxpbmUudHJpbSgpLnNwbGl0KC9cXHMrLyk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBpZCA9IHBhcnRzWzBdO1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhdHVzID0gcGFydHNbMV0gYXMgJ2RldmljZScgfCAnb2ZmbGluZScgfCAndW5hdXRob3JpemVkJyB8ICdubyBwZXJtaXNzaW9ucyc7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBpc1dpcmVsZXNzID0gaWQuaW5jbHVkZXMoJzonKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBcdUNEOTRcdUFDMDAgXHVDODE1XHVCQ0Y0IFx1RDMwQ1x1QzJGMVxyXG4gICAgICAgICAgICAgICAgY29uc3QgaW5mbzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDI7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICBjb25zdCBba2V5LCB2YWx1ZV0gPSBwYXJ0c1tpXS5zcGxpdCgnOicpO1xyXG4gICAgICAgICAgICAgICAgICBpZiAoa2V5ICYmIHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5mb1trZXldID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICBpZCxcclxuICAgICAgICAgICAgICAgICAgc3RhdHVzLFxyXG4gICAgICAgICAgICAgICAgICBpc1dpcmVsZXNzLFxyXG4gICAgICAgICAgICAgICAgICBtb2RlbDogaW5mb1snbW9kZWwnXSxcclxuICAgICAgICAgICAgICAgICAgcHJvZHVjdDogaW5mb1sncHJvZHVjdCddLFxyXG4gICAgICAgICAgICAgICAgICBkZXZpY2U6IGluZm9bJ2RldmljZSddXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgIH0pLmZpbHRlcihkID0+IGQuaWQpO1xyXG5cclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyBkZXZpY2VzIH0pO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCA1MDAsIHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFBPU1QgL2FwaS9hZGIvcGFpciAtIFx1QkIzNFx1QzEyMCBcdUI1MTRcdUJDODRcdUFFNDUgXHVEMzk4XHVDNUI0XHVCOUMxXHJcbiAgICAgICAgICBpZiAodXJsID09PSAnL2FwaS9hZGIvcGFpcicgJiYgcmVxLm1ldGhvZCA9PT0gJ1BPU1QnKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHsgYWRkcmVzcywgY29kZSB9ID0gYXdhaXQgcmVhZEJvZHkocmVxKTtcclxuXHJcbiAgICAgICAgICAgIGlmICghYWRkcmVzcykge1xyXG4gICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgNDAwLCB7IGVycm9yOiAnQWRkcmVzcyBpcyByZXF1aXJlZCcgfSk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgIC8vIGFkYiBwYWlyXHVCMjk0IHN0ZGluXHVDNzNDXHVCODVDIFx1Q0Y1NFx1QjREQ1x1Qjk3QyBcdUJDMUJcdUM3M0NcdUJCQzBcdUI4NUMgc3Bhd24gXHVDMEFDXHVDNkE5XHJcbiAgICAgICAgICAgICAgY29uc3QgcGFpclByb2Nlc3MgPSBzcGF3bignYWRiJywgWydwYWlyJywgYWRkcmVzc10sIHtcclxuICAgICAgICAgICAgICAgIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdwaXBlJ11cclxuICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgbGV0IHN0ZG91dCA9ICcnO1xyXG4gICAgICAgICAgICAgIGxldCBzdGRlcnIgPSAnJztcclxuXHJcbiAgICAgICAgICAgICAgcGFpclByb2Nlc3Muc3Rkb3V0Lm9uKCdkYXRhJywgKGRhdGEpID0+IHsgc3Rkb3V0ICs9IGRhdGEudG9TdHJpbmcoKTsgfSk7XHJcbiAgICAgICAgICAgICAgcGFpclByb2Nlc3Muc3RkZXJyLm9uKCdkYXRhJywgKGRhdGEpID0+IHsgc3RkZXJyICs9IGRhdGEudG9TdHJpbmcoKTsgfSk7XHJcblxyXG4gICAgICAgICAgICAgIC8vIFx1RDM5OFx1QzVCNFx1QjlDMSBcdUNGNTRcdUI0REMgXHVDNzg1XHVCODI1IChcdUQ1MDRcdUI4NkNcdUQ1MDRcdUQyQjggXHVCMzAwXHVBRTMwIFx1RDZDNClcclxuICAgICAgICAgICAgICBpZiAoY29kZSkge1xyXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgIHBhaXJQcm9jZXNzLnN0ZGluLndyaXRlKGNvZGUgKyAnXFxuJyk7XHJcbiAgICAgICAgICAgICAgICAgIHBhaXJQcm9jZXNzLnN0ZGluLmVuZCgpO1xyXG4gICAgICAgICAgICAgICAgfSwgNTAwKTtcclxuICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgIGNvbnN0IGV4aXRDb2RlID0gYXdhaXQgbmV3IFByb21pc2U8bnVtYmVyPigocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcGFpclByb2Nlc3Mub24oJ2Nsb3NlJywgcmVzb2x2ZSk7XHJcbiAgICAgICAgICAgICAgICAvLyBcdUQwQzBcdUM3ODRcdUM1NDRcdUM2QzNcclxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICBwYWlyUHJvY2Vzcy5raWxsKCk7XHJcbiAgICAgICAgICAgICAgICAgIHJlc29sdmUoLTEpO1xyXG4gICAgICAgICAgICAgICAgfSwgMzAwMDApO1xyXG4gICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICBjb25zdCBvdXRwdXQgPSBzdGRvdXQgKyBzdGRlcnI7XHJcbiAgICAgICAgICAgICAgaWYgKGV4aXRDb2RlID09PSAwIHx8IG91dHB1dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzdWNjZXNzJykpIHtcclxuICAgICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IHN1Y2Nlc3M6IHRydWUgfSk7XHJcbiAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogb3V0cHV0LnRyaW0oKSB8fCAnUGFpcmluZyBmYWlsZWQnIH0pO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgNTAwLCB7IGVycm9yOiBlcnJvci5tZXNzYWdlIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBQT1NUIC9hcGkvYWRiL2Nvbm5lY3QgLSBcdUJCMzRcdUMxMjAgXHVCNTE0XHVCQzg0XHVBRTQ1IFx1QzVGMFx1QUNCMFxyXG4gICAgICAgICAgaWYgKHVybCA9PT0gJy9hcGkvYWRiL2Nvbm5lY3QnICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xyXG4gICAgICAgICAgICBjb25zdCB7IGFkZHJlc3MgfSA9IGF3YWl0IHJlYWRCb2R5KHJlcSk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIWFkZHJlc3MpIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDQwMCwgeyBlcnJvcjogJ0FkZHJlc3MgaXMgcmVxdWlyZWQnIH0pO1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dCwgc3RkZXJyIH0gPSBhd2FpdCBleGVjQXN5bmMoYGFkYiBjb25uZWN0ICR7YWRkcmVzc31gLCB7IHRpbWVvdXQ6IDE1MDAwIH0pO1xyXG4gICAgICAgICAgICAgIGNvbnN0IG91dHB1dCA9IHN0ZG91dCArIHN0ZGVycjtcclxuXHJcbiAgICAgICAgICAgICAgaWYgKG91dHB1dC5pbmNsdWRlcygnY29ubmVjdGVkJykgJiYgIW91dHB1dC5pbmNsdWRlcygnY2Fubm90JykpIHtcclxuICAgICAgICAgICAgICAgIC8vIFx1QjUxNFx1QkMxNFx1Qzc3NFx1QzJBNCBcdUJBQThcdUIzNzggXHVBQzAwXHVDODM4XHVDNjI0XHVBRTMwXHJcbiAgICAgICAgICAgICAgICBsZXQgZGV2aWNlID0gYWRkcmVzcztcclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBtb2RlbE91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGBhZGIgLXMgJHthZGRyZXNzfSBzaGVsbCBnZXRwcm9wIHJvLnByb2R1Y3QubW9kZWxgLCB7IHRpbWVvdXQ6IDUwMDAgfSk7XHJcbiAgICAgICAgICAgICAgICAgIGRldmljZSA9IG1vZGVsT3V0LnRyaW0oKSB8fCBhZGRyZXNzO1xyXG4gICAgICAgICAgICAgICAgfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XHJcblxyXG4gICAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHsgc3VjY2VzczogdHJ1ZSwgZGV2aWNlIH0pO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IG91dHB1dC50cmltKCkgfHwgJ0Nvbm5lY3Rpb24gZmFpbGVkJyB9KTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDUwMCwgeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gUE9TVCAvYXBpL2FkYi9kaXNjb25uZWN0IC0gXHVCQjM0XHVDMTIwIFx1QjUxNFx1QkM4NFx1QUU0NSBcdUM1RjBcdUFDQjAgXHVENTc0XHVDODFDXHJcbiAgICAgICAgICBpZiAodXJsID09PSAnL2FwaS9hZGIvZGlzY29ubmVjdCcgJiYgcmVxLm1ldGhvZCA9PT0gJ1BPU1QnKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHsgYWRkcmVzcyB9ID0gYXdhaXQgcmVhZEJvZHkocmVxKTtcclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgY21kID0gYWRkcmVzcyA/IGBhZGIgZGlzY29ubmVjdCAke2FkZHJlc3N9YCA6ICdhZGIgZGlzY29ubmVjdCc7XHJcbiAgICAgICAgICAgICAgYXdhaXQgZXhlY0FzeW5jKGNtZCwgeyB0aW1lb3V0OiAxMDAwMCB9KTtcclxuICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyBzdWNjZXNzOiB0cnVlIH0pO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCA1MDAsIHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFBPU1QgL2FwaS9hZGIvdGNwaXAgLSBVU0JcdUI5N0MgXHVEMUI1XHVENTVDIFx1QkIzNFx1QzEyMCBcdUI1MTRcdUJDODRcdUFFNDUgXHVENjVDXHVDMTMxXHVENjU0XHJcbiAgICAgICAgICBpZiAodXJsID09PSAnL2FwaS9hZGIvdGNwaXAnICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xyXG4gICAgICAgICAgICBjb25zdCB7IHBvcnQgPSAnNTU1NScgfSA9IGF3YWl0IHJlYWRCb2R5KHJlcSk7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgIC8vIFVTQiBcdUI1MTRcdUJDMTRcdUM3NzRcdUMyQTQgXHVENjU1XHVDNzc4XHJcbiAgICAgICAgICAgICAgY29uc3QgeyBzdGRvdXQ6IGRldmljZXNPdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnYWRiIGRldmljZXMnLCB7IHRpbWVvdXQ6IDUwMDAgfSk7XHJcbiAgICAgICAgICAgICAgY29uc3QgdXNiRGV2aWNlcyA9IGRldmljZXNPdXQuc3BsaXQoJ1xcbicpXHJcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGwgPT4gbC5pbmNsdWRlcygnZGV2aWNlJykgJiYgIWwuaW5jbHVkZXMoJzonKSAmJiAhbC5zdGFydHNXaXRoKCdMaXN0JykpO1xyXG5cclxuICAgICAgICAgICAgICBpZiAodXNiRGV2aWNlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgMjAwLCB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFVTQiBkZXZpY2UgY29ubmVjdGVkJyB9KTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgIC8vIFx1QjUxNFx1QkMxNFx1Qzc3NFx1QzJBNCBJUCBcdUFDMDBcdUM4MzhcdUM2MjRcdUFFMzBcclxuICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogaXBPdXQgfSA9IGF3YWl0IGV4ZWNBc3luYygnYWRiIHNoZWxsIGlwIHJvdXRlJywgeyB0aW1lb3V0OiA1MDAwIH0pO1xyXG4gICAgICAgICAgICAgIGNvbnN0IGlwTWF0Y2ggPSBpcE91dC5tYXRjaCgvd2xhbi4qc3JjXFxzKyhcXGQrXFwuXFxkK1xcLlxcZCtcXC5cXGQrKS8pO1xyXG4gICAgICAgICAgICAgIGxldCBkZXZpY2VJcCA9ICcnO1xyXG4gICAgICAgICAgICAgIGlmIChpcE1hdGNoKSB7XHJcbiAgICAgICAgICAgICAgICBkZXZpY2VJcCA9IGlwTWF0Y2hbMV07XHJcbiAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIFx1QjMwMFx1Q0NCNCBcdUJDMjlcdUJDOTVcclxuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Rkb3V0OiBpcE91dDIgfSA9IGF3YWl0IGV4ZWNBc3luYygnYWRiIHNoZWxsIFwiaXAgYWRkciBzaG93IHdsYW4wIHwgZ3JlcCBpbmV0XCInLCB7IHRpbWVvdXQ6IDUwMDAgfSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBpcE1hdGNoMiA9IGlwT3V0Mi5tYXRjaCgvaW5ldFxccysoXFxkK1xcLlxcZCtcXC5cXGQrXFwuXFxkKykvKTtcclxuICAgICAgICAgICAgICAgIGlmIChpcE1hdGNoMikge1xyXG4gICAgICAgICAgICAgICAgICBkZXZpY2VJcCA9IGlwTWF0Y2gyWzFdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgaWYgKCFkZXZpY2VJcCkge1xyXG4gICAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCAyMDAsIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQ2Fubm90IGZpbmQgZGV2aWNlIFdpRmkgSVAnIH0pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgLy8gVENQL0lQIFx1QkFBOFx1QjREQyBcdUQ2NUNcdUMxMzFcdUQ2NTRcclxuICAgICAgICAgICAgICBhd2FpdCBleGVjQXN5bmMoYGFkYiB0Y3BpcCAke3BvcnR9YCwgeyB0aW1lb3V0OiAxMDAwMCB9KTtcclxuXHJcbiAgICAgICAgICAgICAgLy8gXHVDN0EwXHVDMkRDIFx1QjMwMFx1QUUzMCBcdUQ2QzQgXHVDNUYwXHVBQ0IwXHJcbiAgICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDIwMDApKTtcclxuXHJcbiAgICAgICAgICAgICAgY29uc3QgYWRkcmVzcyA9IGAke2RldmljZUlwfToke3BvcnR9YDtcclxuICAgICAgICAgICAgICBjb25zdCB7IHN0ZG91dDogY29ubmVjdE91dCB9ID0gYXdhaXQgZXhlY0FzeW5jKGBhZGIgY29ubmVjdCAke2FkZHJlc3N9YCwgeyB0aW1lb3V0OiAxMDAwMCB9KTtcclxuXHJcbiAgICAgICAgICAgICAgaWYgKGNvbm5lY3RPdXQuaW5jbHVkZXMoJ2Nvbm5lY3RlZCcpKSB7XHJcbiAgICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyBzdWNjZXNzOiB0cnVlLCBhZGRyZXNzIH0pO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzZW5kSnNvbihyZXMsIDIwMCwgeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGNvbm5lY3RPdXQudHJpbSgpIHx8ICdDb25uZWN0aW9uIGZhaWxlZCcsIGFkZHJlc3MgfSk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCA1MDAsIHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIEdFVCAvYXBpL2FkYi9sb2djYXQgLSBcdUI1MTRcdUJDMTRcdUM3NzRcdUMyQTQgXHVCODVDXHVBREY4IFx1QzJBNFx1RDJCOFx1QjlBQ1x1QkMwRCAoXHVDMTM4XHVDMTU4IFx1QzdBQ1x1QzBBQ1x1QzZBOSlcclxuICAgICAgICAgIGlmICh1cmwuc3RhcnRzV2l0aCgnL2FwaS9hZGIvbG9nY2F0JykgJiYgcmVxLm1ldGhvZCA9PT0gJ0dFVCcpIHtcclxuICAgICAgICAgICAgY29uc3QgdXJsT2JqID0gbmV3IFVSTCh1cmwsICdodHRwOi8vbG9jYWxob3N0Jyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGRldmljZSA9IHVybE9iai5zZWFyY2hQYXJhbXMuZ2V0KCdkZXZpY2UnKTtcclxuICAgICAgICAgICAgY29uc3QgbG9nVHlwZSA9IHVybE9iai5zZWFyY2hQYXJhbXMuZ2V0KCd0eXBlJykgfHwgJ25hdGl2ZSc7XHJcblxyXG4gICAgICAgICAgICBpZiAoIWRldmljZSkge1xyXG4gICAgICAgICAgICAgIHNlbmRKc29uKHJlcywgNDAwLCB7IGVycm9yOiAnZGV2aWNlIHBhcmFtZXRlciBpcyByZXF1aXJlZCcgfSk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBzZXNzaW9uS2V5ID0gZ2V0TG9nY2F0U2Vzc2lvbktleShkZXZpY2UsIGxvZ1R5cGUpO1xyXG5cclxuICAgICAgICAgICAgLy8gXHVDMkE0XHVEMkI4XHVCOUFDXHVCQzBEIFx1Qzc1MVx1QjJGNSBcdUMxMjRcdUM4MTVcclxuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XHJcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICd0ZXh0L3BsYWluOyBjaGFyc2V0PXV0Zi04Jyk7XHJcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ1RyYW5zZmVyLUVuY29kaW5nJywgJ2NodW5rZWQnKTtcclxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsICduby1jYWNoZScpO1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb25uZWN0aW9uJywgJ2tlZXAtYWxpdmUnKTtcclxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignWC1Db250ZW50LVR5cGUtT3B0aW9ucycsICdub3NuaWZmJyk7XHJcblxyXG4gICAgICAgICAgICAvLyBcdUFFMzBcdUM4NzQgXHVDMTM4XHVDMTU4XHVDNzc0IFx1Qzc4OFx1QzczQ1x1QkE3NCBcdUM3QUNcdUMwQUNcdUM2QTlcclxuICAgICAgICAgICAgbGV0IHNlc3Npb24gPSBsb2djYXRTZXNzaW9ucy5nZXQoc2Vzc2lvbktleSk7XHJcbiAgICAgICAgICAgIGlmIChzZXNzaW9uKSB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtMb2djYXRdIFJldXNpbmcgZXhpc3Rpbmcgc2Vzc2lvbjogJHtzZXNzaW9uS2V5fWApO1xyXG4gICAgICAgICAgICAgIGNhbmNlbExvZ2NhdENsZWFudXAoc2Vzc2lvbktleSk7XHJcbiAgICAgICAgICAgICAgc2Vzc2lvbi5jbGllbnRzLmFkZChyZXMpO1xyXG5cclxuICAgICAgICAgICAgICAvLyBcdUQwNzRcdUI3N0NcdUM3NzRcdUM1QjhcdUQyQjggXHVDNUYwXHVBQ0IwIFx1RDU3NFx1QzgxQyBcdUNDOThcdUI5QUNcclxuICAgICAgICAgICAgICBjb25zdCByZW1vdmVDbGllbnQgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBzZXNzaW9uPy5jbGllbnRzLmRlbGV0ZShyZXMpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHNlc3Npb24/LmNsaWVudHMuc2l6ZSA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICBzY2hlZHVsZUxvZ2NhdENsZWFudXAoc2Vzc2lvbktleSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICByZXEub24oJ2Nsb3NlJywgcmVtb3ZlQ2xpZW50KTtcclxuICAgICAgICAgICAgICByZXEub24oJ2Fib3J0ZWQnLCByZW1vdmVDbGllbnQpO1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gXHVCODVDXHVBREY4IFx1RDU0NFx1RDEzMCBcdUMxMjRcdUM4MTVcclxuICAgICAgICAgICAgbGV0IGZpbHRlciA9ICcnO1xyXG4gICAgICAgICAgICBzd2l0Y2ggKGxvZ1R5cGUpIHtcclxuICAgICAgICAgICAgICBjYXNlICduYXRpdmUnOlxyXG4gICAgICAgICAgICAgICAgZmlsdGVyID0gJ1JlYWN0TmF0aXZlOlYgUmVhY3ROYXRpdmVKUzpWIGV4cG86ViBFeHBvTW9kdWxlc0NvcmU6ViAqOlMnO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgY2FzZSAnd2Vidmlldyc6XHJcbiAgICAgICAgICAgICAgICBmaWx0ZXIgPSAnY2hyb21pdW06ViBTQnJvd3NlcjpWIFNCcm93c2VyQ29uc29sZTpWIFdlYlZpZXdDb25zb2xlOlYgY3JfY29uc29sZTpWICo6Uyc7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICBjYXNlICdhbGwnOlxyXG4gICAgICAgICAgICAgICAgZmlsdGVyID0gJ1JlYWN0TmF0aXZlOlYgUmVhY3ROYXRpdmVKUzpWIGV4cG86ViBjaHJvbWl1bTpWIFNCcm93c2VyOlYgU0Jyb3dzZXJDb25zb2xlOlYgV2ViVmlld0NvbnNvbGU6ViBjcl9jb25zb2xlOlYgKjpTJztcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgIC8vIFx1Qjg1Q1x1QURGOCBcdUJDODRcdUQzN0MgXHVEMDc0XHVCOUFDXHVDNUI0XHJcbiAgICAgICAgICAgICAgYXdhaXQgZXhlY0FzeW5jKGBhZGIgLXMgJHtkZXZpY2V9IGxvZ2NhdCAtY2AsIHsgdGltZW91dDogNTAwMCB9KS5jYXRjaCgoKSA9PiB7fSk7XHJcblxyXG4gICAgICAgICAgICAgIC8vIFdpbmRvd3NcdUM1RDBcdUMxMUNcdUIyOTQgc2hlbGwgXHVDNjM1XHVDMTU4IFx1RDU0NFx1QzY5NFxyXG4gICAgICAgICAgICAgIGNvbnN0IGlzV2luZG93cyA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMic7XHJcbiAgICAgICAgICAgICAgY29uc3QgY21kID0gYGFkYiAtcyAke2RldmljZX0gbG9nY2F0IC12IHRpbWUgJHtmaWx0ZXJ9YDtcclxuXHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tMb2djYXRdIFN0YXJ0aW5nIG5ldyBzZXNzaW9uOicsIHNlc3Npb25LZXkpO1xyXG5cclxuICAgICAgICAgICAgICBjb25zdCBsb2djYXRQcm9jZXNzID0gaXNXaW5kb3dzXHJcbiAgICAgICAgICAgICAgICA/IHNwYXduKCdjbWQnLCBbJy9jJywgY21kXSwgeyBzdGRpbzogWydpZ25vcmUnLCAncGlwZScsICdwaXBlJ10gfSlcclxuICAgICAgICAgICAgICAgIDogc3Bhd24oJ2FkYicsIFsnLXMnLCBkZXZpY2UsICdsb2djYXQnLCAnLXYnLCAndGltZScsIC4uLmZpbHRlci5zcGxpdCgnICcpXSwgeyBzdGRpbzogWydpZ25vcmUnLCAncGlwZScsICdwaXBlJ10gfSk7XHJcblxyXG4gICAgICAgICAgICAgIC8vIFx1QzBDOCBcdUMxMzhcdUMxNTggXHVDMEREXHVDMTMxXHJcbiAgICAgICAgICAgICAgc2Vzc2lvbiA9IHtcclxuICAgICAgICAgICAgICAgIHByb2Nlc3M6IGxvZ2NhdFByb2Nlc3MsXHJcbiAgICAgICAgICAgICAgICBkZXZpY2UsXHJcbiAgICAgICAgICAgICAgICBsb2dUeXBlLFxyXG4gICAgICAgICAgICAgICAgY2xpZW50czogbmV3IFNldChbcmVzXSksXHJcbiAgICAgICAgICAgICAgICBjbGVhbnVwVGltZXI6IG51bGxcclxuICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgIGxvZ2NhdFNlc3Npb25zLnNldChzZXNzaW9uS2V5LCBzZXNzaW9uKTtcclxuXHJcbiAgICAgICAgICAgICAgbG9nY2F0UHJvY2Vzcy5zdGRvdXQub24oJ2RhdGEnLCAoZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY3VycmVudFNlc3Npb24gPSBsb2djYXRTZXNzaW9ucy5nZXQoc2Vzc2lvbktleSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWN1cnJlbnRTZXNzaW9uKSByZXR1cm47XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gXHVCQUE4XHVCNEUwIFx1RDA3NFx1Qjc3Q1x1Qzc3NFx1QzVCOFx1RDJCOFx1QzVEMCBcdUIzNzBcdUM3NzRcdUQxMzAgXHVDODA0XHVDMUExXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50U2Vzc2lvbi5jbGllbnRzLmZvckVhY2goY2xpZW50ID0+IHtcclxuICAgICAgICAgICAgICAgICAgaWYgKCFjbGllbnQud3JpdGFibGVFbmRlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNsaWVudC53cml0ZShkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgIGxvZ2NhdFByb2Nlc3Muc3RkZXJyLm9uKCdkYXRhJywgKGRhdGEpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRTZXNzaW9uID0gbG9nY2F0U2Vzc2lvbnMuZ2V0KHNlc3Npb25LZXkpO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFjdXJyZW50U2Vzc2lvbikgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgICAgIGN1cnJlbnRTZXNzaW9uLmNsaWVudHMuZm9yRWFjaChjbGllbnQgPT4ge1xyXG4gICAgICAgICAgICAgICAgICBpZiAoIWNsaWVudC53cml0YWJsZUVuZGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xpZW50LndyaXRlKGRhdGEpO1xyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgbG9nY2F0UHJvY2Vzcy5vbignZXJyb3InLCAoZXJyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbTG9nY2F0XSBQcm9jZXNzIGVycm9yOicsIGVycik7XHJcbiAgICAgICAgICAgICAgICBjbGVhbnVwTG9nY2F0U2Vzc2lvbihzZXNzaW9uS2V5KTtcclxuICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgbG9nY2F0UHJvY2Vzcy5vbignY2xvc2UnLCAoY29kZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtMb2djYXRdIFByb2Nlc3MgY2xvc2VkIHdpdGggY29kZTogJHtjb2RlfWApO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY3VycmVudFNlc3Npb24gPSBsb2djYXRTZXNzaW9ucy5nZXQoc2Vzc2lvbktleSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFNlc3Npb24pIHtcclxuICAgICAgICAgICAgICAgICAgY3VycmVudFNlc3Npb24uY2xpZW50cy5mb3JFYWNoKGNsaWVudCA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjbGllbnQud3JpdGFibGVFbmRlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgY2xpZW50LmVuZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgIGxvZ2NhdFNlc3Npb25zLmRlbGV0ZShzZXNzaW9uS2V5KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgLy8gXHVEMDc0XHVCNzdDXHVDNzc0XHVDNUI4XHVEMkI4IFx1QzVGMFx1QUNCMCBcdUQ1NzRcdUM4MUMgXHVDQzk4XHVCOUFDXHJcbiAgICAgICAgICAgICAgY29uc3QgcmVtb3ZlQ2xpZW50ID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY3VycmVudFNlc3Npb24gPSBsb2djYXRTZXNzaW9ucy5nZXQoc2Vzc2lvbktleSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFNlc3Npb24pIHtcclxuICAgICAgICAgICAgICAgICAgY3VycmVudFNlc3Npb24uY2xpZW50cy5kZWxldGUocmVzKTtcclxuICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRTZXNzaW9uLmNsaWVudHMuc2l6ZSA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHNjaGVkdWxlTG9nY2F0Q2xlYW51cChzZXNzaW9uS2V5KTtcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgcmVxLm9uKCdjbG9zZScsIHJlbW92ZUNsaWVudCk7XHJcbiAgICAgICAgICAgICAgcmVxLm9uKCdhYm9ydGVkJywgcmVtb3ZlQ2xpZW50KTtcclxuXHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbTG9nY2F0XSBFcnJvcjonLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgc2VuZEpzb24ocmVzLCA1MDAsIHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIE5vdCBmb3VuZFxyXG4gICAgICAgICAgc2VuZEpzb24ocmVzLCA0MDQsIHsgZXJyb3I6ICdOb3QgZm91bmQnIH0pO1xyXG5cclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcignQVBJIGVycm9yOicsIGVycm9yKTtcclxuICAgICAgICAgIHNlbmRKc29uKHJlcywgNTAwLCB7IGVycm9yOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yJyB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH07XHJcbn1cclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxQcm9qZWN0c1xcXFxSTi1FeHBvLVdlYkFwcC1XcmFwcGVyLVRlbXBsYXRlXFxcXHRvb2xzXFxcXGNvbmZpZy1lZGl0b3JcXFxcY2xpZW50XFxcXHZpdGVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkU6XFxcXFByb2plY3RzXFxcXFJOLUV4cG8tV2ViQXBwLVdyYXBwZXItVGVtcGxhdGVcXFxcdG9vbHNcXFxcY29uZmlnLWVkaXRvclxcXFxjbGllbnRcXFxcdml0ZVxcXFxwdXBwZXRlZXItcHJldmlldy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRTovUHJvamVjdHMvUk4tRXhwby1XZWJBcHAtV3JhcHBlci1UZW1wbGF0ZS90b29scy9jb25maWctZWRpdG9yL2NsaWVudC92aXRlL3B1cHBldGVlci1wcmV2aWV3LnRzXCI7Ly8gdG9vbHMvY29uZmlnLWVkaXRvci9jbGllbnQvdml0ZS9wdXBwZXRlZXItcHJldmlldy50c1xyXG4vLyBQdXBwZXRlZXIgXHVBRTMwXHVCQzE4IFx1QzJFNFx1QzJEQ1x1QUMwNCBwcmV2aWV3IFx1QzJEQ1x1QzJBNFx1RDE1Q1xyXG5cclxuaW1wb3J0IHB1cHBldGVlciwgeyBCcm93c2VyLCBQYWdlLCBDRFBTZXNzaW9uIH0gZnJvbSAncHVwcGV0ZWVyJztcclxuaW1wb3J0IHsgV2ViU29ja2V0LCBXZWJTb2NrZXRTZXJ2ZXIgfSBmcm9tICd3cyc7XHJcbmltcG9ydCB0eXBlIHsgSW5jb21pbmdNZXNzYWdlIH0gZnJvbSAnaHR0cCc7XHJcbmltcG9ydCB0eXBlIHsgRHVwbGV4IH0gZnJvbSAnc3RyZWFtJztcclxuXHJcbi8vIEFwcEJyaWRnZSBcdUMyQTRcdUQwNkNcdUI5QkRcdUQyQjggXHVDMEREXHVDMTMxIChcdUMyRTRcdUM4MUMgYnJpZGdlLWNsaWVudC50c1x1QzY0MCBcdUIzRDlcdUM3N0MpXHJcbmZ1bmN0aW9uIGdldEFwcEJyaWRnZVNjcmlwdCgpOiBzdHJpbmcge1xyXG4gIHJldHVybiBgXHJcbihmdW5jdGlvbigpIHtcclxuICAndXNlIHN0cmljdCc7XHJcblxyXG4gIC8vIGJlZm9yZXVubG9hZCBcdUJCMzRcdUI4MjVcdUQ2NTRcclxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkod2luZG93LCAnb25iZWZvcmV1bmxvYWQnLCB7XHJcbiAgICBnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gbnVsbDsgfSxcclxuICAgIHNldDogZnVuY3Rpb24oKSB7IHJldHVybjsgfSxcclxuICAgIGNvbmZpZ3VyYWJsZTogZmFsc2VcclxuICB9KTtcclxuXHJcbiAgdmFyIG9yaWdpbmFsQWRkRXZlbnRMaXN0ZW5lciA9IEV2ZW50VGFyZ2V0LnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyO1xyXG4gIEV2ZW50VGFyZ2V0LnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIsIG9wdGlvbnMpIHtcclxuICAgIGlmICh0eXBlID09PSAnYmVmb3JldW5sb2FkJykgcmV0dXJuO1xyXG4gICAgcmV0dXJuIG9yaWdpbmFsQWRkRXZlbnRMaXN0ZW5lci5jYWxsKHRoaXMsIHR5cGUsIGxpc3RlbmVyLCBvcHRpb25zKTtcclxuICB9O1xyXG5cclxuICBpZiAod2luZG93LkFwcEJyaWRnZSkgcmV0dXJuO1xyXG5cclxuICB2YXIgX3QgPSAoZnVuY3Rpb24oKXtcclxuICAgIHZhciBzID0gU3ltYm9sKCdfJyk7XHJcbiAgICB2YXIgbyA9IHt9O1xyXG4gICAgb1tzXSA9ICdwdXBwZXRlZXItcHJldmlldy10b2tlbic7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24oKXsgcmV0dXJuIG9bc107IH07XHJcbiAgfSkoKTtcclxuXHJcbiAgdmFyIHBlbmRpbmdSZXF1ZXN0cyA9IG5ldyBNYXAoKTtcclxuXHJcbiAgLy8gTW9jayBcdUM3NTFcdUIyRjVcclxuICB2YXIgbW9ja1Jlc3BvbnNlcyA9IHtcclxuICAgICdnZXRBcHBJbmZvJzogeyBhcHBOYW1lOiAnUHJldmlldyBBcHAnLCB2ZXJzaW9uOiAnMS4wLjAnLCBwbGF0Zm9ybTogJ3ByZXZpZXcnLCBpc0FwcDogdHJ1ZSB9LFxyXG4gICAgJ2dldERldmljZUluZm8nOiB7IHBsYXRmb3JtOiAnYW5kcm9pZCcsIG1vZGVsOiAnUHJldmlldyBEZXZpY2UnLCBvc1ZlcnNpb246ICcxMycsIGlzUHJldmlldzogdHJ1ZSwgaXNBcHA6IHRydWUgfSxcclxuICAgICdnZXRTeXN0ZW1JbmZvJzogeyBwbGF0Zm9ybTogJ2FuZHJvaWQnLCBpc0FwcDogdHJ1ZSwgaXNQcmV2aWV3OiB0cnVlLCB2ZXJzaW9uOiAnMS4wLjAnIH0sXHJcbiAgICAnZ2V0UGxhdGZvcm0nOiB7IHBsYXRmb3JtOiAnYW5kcm9pZCcsIGlzQXBwOiB0cnVlIH0sXHJcbiAgICAnY2hlY2tQZXJtaXNzaW9uJzogeyBncmFudGVkOiB0cnVlIH0sXHJcbiAgICAncmVxdWVzdFBlcm1pc3Npb24nOiB7IGdyYW50ZWQ6IHRydWUgfSxcclxuICAgICdnZXRUb2tlbic6IHsgdG9rZW46ICdwcmV2aWV3LW1vY2stdG9rZW4nIH0sXHJcbiAgICAnZ2V0VXNlckluZm8nOiB7IGlzTG9nZ2VkSW46IGZhbHNlIH0sXHJcbiAgICAnZ2V0U2V0dGluZ3MnOiB7IHRoZW1lOiAnbGlnaHQnIH0sXHJcbiAgICAnZ2V0U2FmZUFyZWEnOiB7IHRvcDogMjQsIGJvdHRvbTogMzQsIGxlZnQ6IDAsIHJpZ2h0OiAwIH0sXHJcbiAgICAnZ2V0U3RhdHVzQmFySGVpZ2h0JzogeyBoZWlnaHQ6IDI0IH0sXHJcbiAgICAnZ2V0TmF2aWdhdGlvbkJhckhlaWdodCc6IHsgaGVpZ2h0OiA0OCB9LFxyXG4gICAgJ2dldE5ldHdvcmtTdGF0dXMnOiB7IGNvbm5lY3RlZDogdHJ1ZSwgdHlwZTogJ3dpZmknIH0sXHJcbiAgICAnaXNPbmxpbmUnOiB7IG9ubGluZTogdHJ1ZSwgY29ubmVjdGVkOiB0cnVlIH0sXHJcbiAgICAnX2RlZmF1bHQnOiB7IHN1Y2Nlc3M6IHRydWUsIGlzUHJldmlldzogdHJ1ZSwgaXNBcHA6IHRydWUgfVxyXG4gIH07XHJcblxyXG4gIHdpbmRvdy5SZWFjdE5hdGl2ZVdlYlZpZXcgPSB7XHJcbiAgICBwb3N0TWVzc2FnZTogZnVuY3Rpb24obWVzc2FnZVN0cikge1xyXG4gICAgICB2YXIgcGFyc2VkID0gSlNPTi5wYXJzZShtZXNzYWdlU3RyKTtcclxuICAgICAgY29uc29sZS5sb2coJ1tBcHBCcmlkZ2UgUHJldmlld10gcG9zdE1lc3NhZ2U6JywgcGFyc2VkKTtcclxuXHJcbiAgICAgIGlmIChwYXJzZWQucmVxdWVzdElkKSB7XHJcbiAgICAgICAgdmFyIGFjdGlvbiA9IHBhcnNlZC5wcm90b2NvbC5yZXBsYWNlKCdhcHA6Ly8nLCAnJyk7XHJcbiAgICAgICAgdmFyIG1vY2tEYXRhID0gbW9ja1Jlc3BvbnNlc1thY3Rpb25dIHx8IG1vY2tSZXNwb25zZXNbJ19kZWZhdWx0J107XHJcblxyXG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICB2YXIgcmVzcG9uc2UgPSB7XHJcbiAgICAgICAgICAgIGFjdGlvbjogJ2JyaWRnZVJlc3BvbnNlJyxcclxuICAgICAgICAgICAgcGF5bG9hZDoge1xyXG4gICAgICAgICAgICAgIHJlcXVlc3RJZDogcGFyc2VkLnJlcXVlc3RJZCxcclxuICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgIGRhdGE6IG1vY2tEYXRhXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH07XHJcbiAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ25hdGl2ZU1lc3NhZ2UnLCB7IGRldGFpbDogcmVzcG9uc2UgfSkpO1xyXG4gICAgICAgIH0sIDMwKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIHdpbmRvdy5BcHBCcmlkZ2UgPSB7XHJcbiAgICBzZW5kOiBmdW5jdGlvbihhY3Rpb24sIHBheWxvYWQpIHtcclxuICAgICAgdmFyIG1lc3NhZ2UgPSB7XHJcbiAgICAgICAgcHJvdG9jb2w6ICdhcHA6Ly8nICsgYWN0aW9uLFxyXG4gICAgICAgIHBheWxvYWQ6IHBheWxvYWQgfHwge30sXHJcbiAgICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxyXG4gICAgICAgIF9fdG9rZW46IF90KCksXHJcbiAgICAgICAgX19ub25jZTogRGF0ZS5ub3coKSArICctJyArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA5KVxyXG4gICAgICB9O1xyXG4gICAgICB3aW5kb3cuUmVhY3ROYXRpdmVXZWJWaWV3LnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKTtcclxuICAgIH0sXHJcblxyXG4gICAgY2FsbDogZnVuY3Rpb24oYWN0aW9uLCBwYXlsb2FkLCB0aW1lb3V0KSB7XHJcbiAgICAgIHRpbWVvdXQgPSB0aW1lb3V0IHx8IDEwMDAwO1xyXG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgdmFyIHJlcXVlc3RJZCA9IERhdGUubm93KCkgKyAnLScgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHIoMiwgOSk7XHJcblxyXG4gICAgICAgIHZhciB0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBwZW5kaW5nUmVxdWVzdHMuZGVsZXRlKHJlcXVlc3RJZCk7XHJcbiAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdSZXF1ZXN0IHRpbWVvdXQ6ICcgKyBhY3Rpb24pKTtcclxuICAgICAgICB9LCB0aW1lb3V0KTtcclxuXHJcbiAgICAgICAgcGVuZGluZ1JlcXVlc3RzLnNldChyZXF1ZXN0SWQsIHsgcmVzb2x2ZTogcmVzb2x2ZSwgcmVqZWN0OiByZWplY3QsIHRpbWVyOiB0aW1lciB9KTtcclxuXHJcbiAgICAgICAgdmFyIG1lc3NhZ2UgPSB7XHJcbiAgICAgICAgICBwcm90b2NvbDogJ2FwcDovLycgKyBhY3Rpb24sXHJcbiAgICAgICAgICBwYXlsb2FkOiBwYXlsb2FkIHx8IHt9LFxyXG4gICAgICAgICAgcmVxdWVzdElkOiByZXF1ZXN0SWQsXHJcbiAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXHJcbiAgICAgICAgICBfX3Rva2VuOiBfdCgpLFxyXG4gICAgICAgICAgX19ub25jZTogRGF0ZS5ub3coKSArICctJyArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA5KVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgd2luZG93LlJlYWN0TmF0aXZlV2ViVmlldy5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShtZXNzYWdlKSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICBvbjogZnVuY3Rpb24oYWN0aW9uLCBjYWxsYmFjaykge1xyXG4gICAgICBpZiAoIXRoaXMuX2xpc3RlbmVycykgdGhpcy5fbGlzdGVuZXJzID0ge307XHJcbiAgICAgIGlmICghdGhpcy5fbGlzdGVuZXJzW2FjdGlvbl0pIHRoaXMuX2xpc3RlbmVyc1thY3Rpb25dID0gW107XHJcbiAgICAgIHRoaXMuX2xpc3RlbmVyc1thY3Rpb25dLnB1c2goY2FsbGJhY2spO1xyXG4gICAgfSxcclxuXHJcbiAgICBvbmNlOiBmdW5jdGlvbihhY3Rpb24sIGNhbGxiYWNrKSB7XHJcbiAgICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgICAgdmFyIHdyYXBwZXIgPSBmdW5jdGlvbihwYXlsb2FkLCBtZXNzYWdlKSB7XHJcbiAgICAgICAgc2VsZi5vZmYoYWN0aW9uLCB3cmFwcGVyKTtcclxuICAgICAgICBjYWxsYmFjayhwYXlsb2FkLCBtZXNzYWdlKTtcclxuICAgICAgfTtcclxuICAgICAgdGhpcy5vbihhY3Rpb24sIHdyYXBwZXIpO1xyXG4gICAgfSxcclxuXHJcbiAgICBvZmY6IGZ1bmN0aW9uKGFjdGlvbiwgY2FsbGJhY2spIHtcclxuICAgICAgaWYgKCF0aGlzLl9saXN0ZW5lcnMgfHwgIXRoaXMuX2xpc3RlbmVyc1thY3Rpb25dKSByZXR1cm47XHJcbiAgICAgIGlmIChjYWxsYmFjaykge1xyXG4gICAgICAgIHRoaXMuX2xpc3RlbmVyc1thY3Rpb25dID0gdGhpcy5fbGlzdGVuZXJzW2FjdGlvbl0uZmlsdGVyKGZ1bmN0aW9uKGNiKSB7IHJldHVybiBjYiAhPT0gY2FsbGJhY2s7IH0pO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9saXN0ZW5lcnNbYWN0aW9uXTtcclxuICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICB3YWl0Rm9yOiBmdW5jdGlvbihhY3Rpb24sIHRpbWVvdXQpIHtcclxuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gICAgICB0aW1lb3V0ID0gdGltZW91dCB8fCAxMDAwMDtcclxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIHZhciB0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICBzZWxmLm9mZihhY3Rpb24sIGhhbmRsZXIpO1xyXG4gICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignVGltZW91dCB3YWl0aW5nIGZvcjogJyArIGFjdGlvbikpO1xyXG4gICAgICAgIH0sIHRpbWVvdXQpO1xyXG4gICAgICAgIHZhciBoYW5kbGVyID0gZnVuY3Rpb24ocGF5bG9hZCwgbWVzc2FnZSkge1xyXG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcclxuICAgICAgICAgIHNlbGYub2ZmKGFjdGlvbiwgaGFuZGxlcik7XHJcbiAgICAgICAgICByZXNvbHZlKHsgcGF5bG9hZDogcGF5bG9hZCwgbWVzc2FnZTogbWVzc2FnZSB9KTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHNlbGYub24oYWN0aW9uLCBoYW5kbGVyKTtcclxuICAgICAgfSk7XHJcbiAgICB9LFxyXG5cclxuICAgIF9oYW5kbGVSZXNwb25zZTogZnVuY3Rpb24ocmVzcG9uc2UpIHtcclxuICAgICAgdmFyIHBlbmRpbmcgPSBwZW5kaW5nUmVxdWVzdHMuZ2V0KHJlc3BvbnNlLnJlcXVlc3RJZCk7XHJcbiAgICAgIGlmIChwZW5kaW5nKSB7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KHBlbmRpbmcudGltZXIpO1xyXG4gICAgICAgIHBlbmRpbmdSZXF1ZXN0cy5kZWxldGUocmVzcG9uc2UucmVxdWVzdElkKTtcclxuICAgICAgICBpZiAocmVzcG9uc2Uuc3VjY2Vzcykge1xyXG4gICAgICAgICAgcGVuZGluZy5yZXNvbHZlKHJlc3BvbnNlLmRhdGEpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBwZW5kaW5nLnJlamVjdChuZXcgRXJyb3IocmVzcG9uc2UuZXJyb3IgfHwgJ1Vua25vd24gZXJyb3InKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIF9oYW5kbGVNZXNzYWdlOiBmdW5jdGlvbihtZXNzYWdlKSB7XHJcbiAgICAgIGlmIChtZXNzYWdlLmFjdGlvbiA9PT0gJ2JyaWRnZVJlc3BvbnNlJykge1xyXG4gICAgICAgIHRoaXMuX2hhbmRsZVJlc3BvbnNlKG1lc3NhZ2UucGF5bG9hZCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGlmICh0aGlzLl9saXN0ZW5lcnMpIHtcclxuICAgICAgICBpZiAodGhpcy5fbGlzdGVuZXJzW21lc3NhZ2UuYWN0aW9uXSkge1xyXG4gICAgICAgICAgdGhpcy5fbGlzdGVuZXJzW21lc3NhZ2UuYWN0aW9uXS5mb3JFYWNoKGZ1bmN0aW9uKGNiKSB7XHJcbiAgICAgICAgICAgIHRyeSB7IGNiKG1lc3NhZ2UucGF5bG9hZCwgbWVzc2FnZSk7IH0gY2F0Y2goZSkgeyBjb25zb2xlLmVycm9yKGUpOyB9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuX2xpc3RlbmVyc1snKiddKSB7XHJcbiAgICAgICAgICB0aGlzLl9saXN0ZW5lcnNbJyonXS5mb3JFYWNoKGZ1bmN0aW9uKGNiKSB7XHJcbiAgICAgICAgICAgIHRyeSB7IGNiKG1lc3NhZ2UucGF5bG9hZCwgbWVzc2FnZSk7IH0gY2F0Y2goZSkge31cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBpc0FwcDogZnVuY3Rpb24oKSB7IHJldHVybiB0cnVlOyB9LFxyXG4gICAgaXNQcmV2aWV3OiBmdW5jdGlvbigpIHsgcmV0dXJuIHRydWU7IH0sXHJcbiAgICB2ZXJzaW9uOiAnMi4xLjAnXHJcbiAgfTtcclxuXHJcbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ25hdGl2ZU1lc3NhZ2UnLCBmdW5jdGlvbihlKSB7XHJcbiAgICB3aW5kb3cuQXBwQnJpZGdlLl9oYW5kbGVNZXNzYWdlKGUuZGV0YWlsKTtcclxuICB9KTtcclxuXHJcbiAgd2luZG93Lm9uTmF0aXZlTWVzc2FnZSA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcclxuICAgIHdpbmRvdy5BcHBCcmlkZ2UuX2hhbmRsZU1lc3NhZ2UobWVzc2FnZSk7XHJcbiAgfTtcclxuXHJcbiAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCdBcHBCcmlkZ2VSZWFkeScpKTtcclxuICBjb25zb2xlLmxvZygnW0FwcEJyaWRnZV0gSW5pdGlhbGl6ZWQgKFB1cHBldGVlciBQcmV2aWV3KScpO1xyXG59KSgpO1xyXG5gO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgUHJldmlld1Nlc3Npb24ge1xyXG4gIGJyb3dzZXI6IEJyb3dzZXI7XHJcbiAgcGFnZTogUGFnZTtcclxuICBjZHA6IENEUFNlc3Npb247XHJcbiAgY2xpZW50czogU2V0PFdlYlNvY2tldD47XHJcbiAgdXJsOiBzdHJpbmc7XHJcbiAgdmlld3BvcnRXaWR0aDogbnVtYmVyO1xyXG4gIHZpZXdwb3J0SGVpZ2h0OiBudW1iZXI7XHJcbiAgaXNTdHJlYW1pbmc6IGJvb2xlYW47XHJcbn1cclxuXHJcbmxldCBzZXNzaW9uOiBQcmV2aWV3U2Vzc2lvbiB8IG51bGwgPSBudWxsO1xyXG5sZXQgd3NzOiBXZWJTb2NrZXRTZXJ2ZXIgfCBudWxsID0gbnVsbDtcclxuXHJcbi8vIFx1QjlDOFx1QzZCMFx1QzJBNCBcdUJDODRcdUQyQkMgXHVDMEMxXHVEMERDIFx1Q0Q5NFx1QzgwMSAoXHVCMjBDXHVCOUIwIFx1QkM4NFx1RDJCQ1x1QjRFNClcclxuY29uc3QgcHJlc3NlZE1vdXNlQnV0dG9ucyA9IG5ldyBTZXQ8J2xlZnQnIHwgJ3JpZ2h0JyB8ICdtaWRkbGUnPigpO1xyXG5cclxuLy8gXHVDMTM4XHVDMTU4IFx1Qzc5MFx1QjNEOSBcdUM4ODVcdUI4Q0MgXHVEMEMwXHVDNzc0XHVCQTM4IChcdUQwNzRcdUI3N0NcdUM3NzRcdUM1QjhcdUQyQjggXHVDNUM2XHVDNzNDXHVCQTc0IDMwXHVDRDA4IFx1RDZDNCBcdUM4ODVcdUI4Q0MpXHJcbmxldCBzZXNzaW9uQ2xlYW51cFRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGwgPSBudWxsO1xyXG5jb25zdCBTRVNTSU9OX0NMRUFOVVBfREVMQVkgPSAzMDAwMDsgLy8gMzBcdUNEMDhcclxuXHJcbmZ1bmN0aW9uIHNjaGVkdWxlU2Vzc2lvbkNsZWFudXAoKSB7XHJcbiAgaWYgKHNlc3Npb25DbGVhbnVwVGltZXIpIHtcclxuICAgIGNsZWFyVGltZW91dChzZXNzaW9uQ2xlYW51cFRpbWVyKTtcclxuICB9XHJcbiAgc2Vzc2lvbkNsZWFudXBUaW1lciA9IHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKHNlc3Npb24gJiYgc2Vzc2lvbi5jbGllbnRzLnNpemUgPT09IDApIHtcclxuICAgICAgY29uc29sZS5sb2coJ1tQdXBwZXRlZXIgUHJldmlld10gTm8gY2xpZW50cyBjb25uZWN0ZWQsIGNsb3Npbmcgc2Vzc2lvbicpO1xyXG4gICAgICBhd2FpdCBzdG9wUHJldmlldygpO1xyXG4gICAgfVxyXG4gIH0sIFNFU1NJT05fQ0xFQU5VUF9ERUxBWSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNhbmNlbFNlc3Npb25DbGVhbnVwKCkge1xyXG4gIGlmIChzZXNzaW9uQ2xlYW51cFRpbWVyKSB7XHJcbiAgICBjbGVhclRpbWVvdXQoc2Vzc2lvbkNsZWFudXBUaW1lcik7XHJcbiAgICBzZXNzaW9uQ2xlYW51cFRpbWVyID0gbnVsbDtcclxuICB9XHJcbn1cclxuXHJcbi8vIFByZXZpZXcgXHVDMTM4XHVDMTU4IFx1QzJEQ1x1Qzc5MVxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RhcnRQcmV2aWV3KHVybDogc3RyaW5nLCB3aWR0aCA9IDM2MCwgaGVpZ2h0ID0gNjQwKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgY29uc29sZS5sb2coJ1tQdXBwZXRlZXIgUHJldmlld10gU3RhcnRpbmcgcHJldmlldyBmb3I6JywgdXJsKTtcclxuXHJcbiAgLy8gXHVBRTMwXHVDODc0IFx1QzEzOFx1QzE1OFx1Qzc3NCBcdUM3ODhcdUFDRTAgXHVBQzE5XHVDNzQwIFVSTFx1Qzc3NFx1QkE3NCBcdUM3QUNcdUMwQUNcdUM2QTlcclxuICBpZiAoc2Vzc2lvbiAmJiBzZXNzaW9uLnVybCA9PT0gdXJsKSB7XHJcbiAgICBjb25zb2xlLmxvZygnW1B1cHBldGVlciBQcmV2aWV3XSBSZXVzaW5nIGV4aXN0aW5nIHNlc3Npb24nKTtcclxuICAgIC8vIFx1QkRGMFx1RDNFQ1x1RDJCOCBcdUQwNkNcdUFFMzBcdUFDMDAgXHVCMkU0XHVCOTc0XHVCQTc0IFx1Qzg3MFx1QzgxNVxyXG4gICAgaWYgKHNlc3Npb24udmlld3BvcnRXaWR0aCAhPT0gd2lkdGggfHwgc2Vzc2lvbi52aWV3cG9ydEhlaWdodCAhPT0gaGVpZ2h0KSB7XHJcbiAgICAgIGF3YWl0IHJlc2l6ZVByZXZpZXcod2lkdGgsIGhlaWdodCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICAvLyBcdUFFMzBcdUM4NzQgXHVDMTM4XHVDMTU4IFx1QzgxNVx1QjlBQyAoXHVEMDc0XHVCNzdDXHVDNzc0XHVDNUI4XHVEMkI4XHVCMjk0IFx1QkNGNFx1Qzg3NClcclxuICBsZXQgcHJlc2VydmVkQ2xpZW50cyA9IG5ldyBTZXQ8V2ViU29ja2V0PigpO1xyXG4gIGlmIChzZXNzaW9uKSB7XHJcbiAgICBwcmVzZXJ2ZWRDbGllbnRzID0gYXdhaXQgc3RvcFByZXZpZXcodHJ1ZSk7XHJcbiAgfVxyXG5cclxuICB0cnkge1xyXG4gICAgLy8gXHVCRTBDXHVCNzdDXHVDNkIwXHVDODAwIFx1QzJEQ1x1Qzc5MVxyXG4gICAgY29uc3QgYnJvd3NlciA9IGF3YWl0IHB1cHBldGVlci5sYXVuY2goe1xyXG4gICAgICBoZWFkbGVzczogdHJ1ZSxcclxuICAgICAgYXJnczogW1xyXG4gICAgICAgICctLW5vLXNhbmRib3gnLFxyXG4gICAgICAgICctLWRpc2FibGUtc2V0dWlkLXNhbmRib3gnLFxyXG4gICAgICAgICctLWRpc2FibGUtd2ViLXNlY3VyaXR5JyxcclxuICAgICAgICAnLS1kaXNhYmxlLWZlYXR1cmVzPUlzb2xhdGVPcmlnaW5zLHNpdGUtcGVyLXByb2Nlc3MnLFxyXG4gICAgICAgIGAtLXdpbmRvdy1zaXplPSR7d2lkdGh9LCR7aGVpZ2h0fWBcclxuICAgICAgXVxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgcGFnZSA9IGF3YWl0IGJyb3dzZXIubmV3UGFnZSgpO1xyXG5cclxuICAgIC8vIFx1QkFBOFx1QkMxNFx1Qzc3QyBVc2VyLUFnZW50IFx1QzEyNFx1QzgxNVxyXG4gICAgYXdhaXQgcGFnZS5zZXRVc2VyQWdlbnQoXHJcbiAgICAgICdNb3ppbGxhLzUuMCAoTGludXg7IEFuZHJvaWQgMTM7IFBpeGVsIDcpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xMjAuMC4wLjAgTW9iaWxlIFNhZmFyaS81MzcuMzYnXHJcbiAgICApO1xyXG5cclxuICAgIC8vIFx1QkRGMFx1RDNFQ1x1RDJCOCBcdUMxMjRcdUM4MTVcclxuICAgIGF3YWl0IHBhZ2Uuc2V0Vmlld3BvcnQoe1xyXG4gICAgICB3aWR0aCxcclxuICAgICAgaGVpZ2h0LFxyXG4gICAgICBkZXZpY2VTY2FsZUZhY3RvcjogMixcclxuICAgICAgaXNNb2JpbGU6IHRydWUsXHJcbiAgICAgIGhhc1RvdWNoOiB0cnVlXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBcHBCcmlkZ2UgXHVDMkE0XHVEMDZDXHVCOUJEXHVEMkI4IFx1QzhGQ1x1Qzc4NSAoXHVEMzk4XHVDNzc0XHVDOUMwIFx1Qjg1Q1x1QjREQyBcdUM4MDQpXHJcbiAgICBhd2FpdCBwYWdlLmV2YWx1YXRlT25OZXdEb2N1bWVudChnZXRBcHBCcmlkZ2VTY3JpcHQoKSk7XHJcblxyXG4gICAgLy8gQ0RQIFx1QzEzOFx1QzE1OCBcdUMwRERcdUMxMzFcclxuICAgIGNvbnN0IGNkcCA9IGF3YWl0IHBhZ2UuY3JlYXRlQ0RQU2Vzc2lvbigpO1xyXG5cclxuICAgIHNlc3Npb24gPSB7XHJcbiAgICAgIGJyb3dzZXIsXHJcbiAgICAgIHBhZ2UsXHJcbiAgICAgIGNkcCxcclxuICAgICAgY2xpZW50czogcHJlc2VydmVkQ2xpZW50cywgIC8vIFx1QkNGNFx1Qzg3NFx1QjQxQyBcdUQwNzRcdUI3N0NcdUM3NzRcdUM1QjhcdUQyQjggXHVDNUYwXHVBQ0IwXHJcbiAgICAgIHVybCxcclxuICAgICAgdmlld3BvcnRXaWR0aDogd2lkdGgsXHJcbiAgICAgIHZpZXdwb3J0SGVpZ2h0OiBoZWlnaHQsXHJcbiAgICAgIGlzU3RyZWFtaW5nOiBmYWxzZVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBcdUQzOThcdUM3NzRcdUM5QzAgXHVCODVDXHVCNERDXHJcbiAgICBhd2FpdCBwYWdlLmdvdG8odXJsLCB7IHdhaXRVbnRpbDogJ2RvbWNvbnRlbnRsb2FkZWQnLCB0aW1lb3V0OiAzMDAwMCB9KTtcclxuXHJcbiAgICBjb25zb2xlLmxvZygnW1B1cHBldGVlciBQcmV2aWV3XSBQYWdlIGxvYWRlZCBzdWNjZXNzZnVsbHknKTtcclxuXHJcbiAgICAvLyBTY3JlZW5jYXN0IFx1QzJEQ1x1Qzc5MVxyXG4gICAgYXdhaXQgc3RhcnRTY3JlZW5jYXN0KCk7XHJcblxyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICBjb25zb2xlLmVycm9yKCdbUHVwcGV0ZWVyIFByZXZpZXddIEZhaWxlZCB0byBzdGFydDonLCBlcnJvcik7XHJcbiAgICBpZiAoc2Vzc2lvbikge1xyXG4gICAgICBhd2FpdCBzdG9wUHJldmlldygpO1xyXG4gICAgfVxyXG4gICAgLy8gXHVDMkU0XHVEMzI4IFx1QzJEQyBcdUJDRjRcdUM4NzRcdUI0MUMgXHVEMDc0XHVCNzdDXHVDNzc0XHVDNUI4XHVEMkI4XHVDNUQwXHVBQzhDIFx1QzVEMFx1QjdFQyBcdUM4MDRcdUMxQTFcclxuICAgIHByZXNlcnZlZENsaWVudHMuZm9yRWFjaChjbGllbnQgPT4ge1xyXG4gICAgICBpZiAoY2xpZW50LnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5PUEVOKSB7XHJcbiAgICAgICAgY2xpZW50LnNlbmQoSlNPTi5zdHJpbmdpZnkoeyB0eXBlOiAnZXJyb3InLCBtZXNzYWdlOiBTdHJpbmcoZXJyb3IpIH0pKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICB0aHJvdyBlcnJvcjtcclxuICB9XHJcbn1cclxuXHJcbi8vIENEUCBcdUM3NzRcdUJDQTRcdUQyQjggXHVENTc4XHVCNEU0XHVCN0VDIFx1QjRGMVx1Qjg1RCBcdUM1RUNcdUJEODBcclxubGV0IHNjcmVlbmNhc3RIYW5kbGVyUmVnaXN0ZXJlZCA9IGZhbHNlO1xyXG5cclxuLy8gU2NyZWVuY2FzdCBcdUMyRENcdUM3OTFcclxuYXN5bmMgZnVuY3Rpb24gc3RhcnRTY3JlZW5jYXN0KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gIGlmICghc2Vzc2lvbikgcmV0dXJuO1xyXG5cclxuICAvLyBcdUM3NzRcdUJCRjggXHVDMkE0XHVEMkI4XHVCOUFDXHVCQzBEIFx1QzkxMVx1Qzc3NFx1QkE3NCBcdUMyQTRcdUQwQjVcclxuICBpZiAoc2Vzc2lvbi5pc1N0cmVhbWluZykge1xyXG4gICAgY29uc29sZS5sb2coJ1tQdXBwZXRlZXIgUHJldmlld10gU2NyZWVuY2FzdCBhbHJlYWR5IHJ1bm5pbmcnKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIC8vIFNjcmVlbmNhc3QgXHVDMkRDXHVDNzkxIFx1QzJEQyBcdUI5QzhcdUM2QjBcdUMyQTQgXHVDMEMxXHVEMERDIFx1Q0QwOFx1QUUzMFx1RDY1NCAoXHVDN0FDXHVDNUYwXHVBQ0IwIFx1QzJEQyBcdUMwQzFcdUQwREMgXHVCRDg4XHVDNzdDXHVDRTU4IFx1QkMyOVx1QzlDMClcclxuICBwcmVzc2VkTW91c2VCdXR0b25zLmNsZWFyKCk7XHJcblxyXG4gIHNlc3Npb24uaXNTdHJlYW1pbmcgPSB0cnVlO1xyXG5cclxuICAvLyBDRFAgXHVDNzc0XHVCQ0E0XHVEMkI4IFx1RDU3OFx1QjRFNFx1QjdFQyAoXHVENTVDIFx1QkM4OFx1QjlDQyBcdUI0RjFcdUI4NUQpXHJcbiAgaWYgKCFzY3JlZW5jYXN0SGFuZGxlclJlZ2lzdGVyZWQpIHtcclxuICAgIHNjcmVlbmNhc3RIYW5kbGVyUmVnaXN0ZXJlZCA9IHRydWU7XHJcbiAgICBsZXQgZnJhbWVDb3VudCA9IDA7XHJcbiAgICBzZXNzaW9uLmNkcC5vbignUGFnZS5zY3JlZW5jYXN0RnJhbWUnLCBhc3luYyAocGFyYW1zKSA9PiB7XHJcbiAgICAgIGlmICghc2Vzc2lvbikgcmV0dXJuO1xyXG5cclxuICAgICAgY29uc3QgeyBkYXRhLCBzZXNzaW9uSWQgfSA9IHBhcmFtcztcclxuICAgICAgZnJhbWVDb3VudCsrO1xyXG5cclxuICAgICAgLy8gXHVENTA0XHVCODA4XHVDNzg0IEFDS1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGF3YWl0IHNlc3Npb24uY2RwLnNlbmQoJ1BhZ2Uuc2NyZWVuY2FzdEZyYW1lQWNrJywgeyBzZXNzaW9uSWQgfSk7XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAvLyBcdUJCMzRcdUMyREMgKFx1QzEzOFx1QzE1OCBcdUM4ODVcdUI4Q0NcdUI0MjgpXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBcdUNDQUIgXHVENTA0XHVCODA4XHVDNzg0IFx1Qjg1Q1x1QURGOFxyXG4gICAgICBpZiAoZnJhbWVDb3VudCA9PT0gMSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBbUHVwcGV0ZWVyIFByZXZpZXddIEZpcnN0IGZyYW1lIHJlY2VpdmVkLCBzZW5kaW5nIHRvICR7c2Vzc2lvbi5jbGllbnRzLnNpemV9IGNsaWVudHNgKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gXHVCQUE4XHVCNEUwIFx1RDA3NFx1Qjc3Q1x1Qzc3NFx1QzVCOFx1RDJCOFx1QzVEMCBcdUQ1MDRcdUI4MDhcdUM3ODQgXHVDODA0XHVDMUExXHJcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgdHlwZTogJ2ZyYW1lJyxcclxuICAgICAgICBkYXRhOiBgZGF0YTppbWFnZS9qcGVnO2Jhc2U2NCwke2RhdGF9YFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHNlc3Npb24uY2xpZW50cy5mb3JFYWNoKGNsaWVudCA9PiB7XHJcbiAgICAgICAgaWYgKGNsaWVudC5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuT1BFTikge1xyXG4gICAgICAgICAgY2xpZW50LnNlbmQobWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8gU2NyZWVuY2FzdCBcdUMyRENcdUM3OTFcclxuICB0cnkge1xyXG4gICAgYXdhaXQgc2Vzc2lvbi5jZHAuc2VuZCgnUGFnZS5zdGFydFNjcmVlbmNhc3QnLCB7XHJcbiAgICAgIGZvcm1hdDogJ2pwZWcnLFxyXG4gICAgICBxdWFsaXR5OiA4MCxcclxuICAgICAgbWF4V2lkdGg6IHNlc3Npb24udmlld3BvcnRXaWR0aCAqIDIsXHJcbiAgICAgIG1heEhlaWdodDogc2Vzc2lvbi52aWV3cG9ydEhlaWdodCAqIDIsXHJcbiAgICAgIGV2ZXJ5TnRoRnJhbWU6IDFcclxuICAgIH0pO1xyXG4gICAgY29uc29sZS5sb2coJ1tQdXBwZXRlZXIgUHJldmlld10gU2NyZWVuY2FzdCBzdGFydGVkJyk7XHJcbiAgfSBjYXRjaCAoZSkge1xyXG4gICAgY29uc29sZS5lcnJvcignW1B1cHBldGVlciBQcmV2aWV3XSBGYWlsZWQgdG8gc3RhcnQgc2NyZWVuY2FzdDonLCBlKTtcclxuICAgIHNlc3Npb24uaXNTdHJlYW1pbmcgPSBmYWxzZTtcclxuICB9XHJcbn1cclxuXHJcbi8vIFNjcmVlbmNhc3QgXHVDOTExXHVDOUMwXHJcbmFzeW5jIGZ1bmN0aW9uIHN0b3BTY3JlZW5jYXN0KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gIGlmICghc2Vzc2lvbiB8fCAhc2Vzc2lvbi5pc1N0cmVhbWluZykgcmV0dXJuO1xyXG5cclxuICB0cnkge1xyXG4gICAgYXdhaXQgc2Vzc2lvbi5jZHAuc2VuZCgnUGFnZS5zdG9wU2NyZWVuY2FzdCcpO1xyXG4gICAgc2Vzc2lvbi5pc1N0cmVhbWluZyA9IGZhbHNlO1xyXG4gICAgY29uc29sZS5sb2coJ1tQdXBwZXRlZXIgUHJldmlld10gU2NyZWVuY2FzdCBzdG9wcGVkJyk7XHJcbiAgfSBjYXRjaCAoZSkge1xyXG4gICAgLy8gXHVCQjM0XHVDMkRDXHJcbiAgfVxyXG59XHJcblxyXG4vLyBQcmV2aWV3IFx1QzkxMVx1QzlDMCAocHJlc2VydmVDbGllbnRzOiBcdUQwNzRcdUI3N0NcdUM3NzRcdUM1QjhcdUQyQjggXHVDNUYwXHVBQ0IwIFx1QzcyMFx1QzlDMCBcdUM1RUNcdUJEODApXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzdG9wUHJldmlldyhwcmVzZXJ2ZUNsaWVudHMgPSBmYWxzZSk6IFByb21pc2U8U2V0PFdlYlNvY2tldD4+IHtcclxuICBpZiAoIXNlc3Npb24pIHJldHVybiBuZXcgU2V0KCk7XHJcblxyXG4gIGNvbnNvbGUubG9nKCdbUHVwcGV0ZWVyIFByZXZpZXddIFN0b3BwaW5nIHByZXZpZXcnKTtcclxuXHJcbiAgLy8gXHVDODE1XHVCOUFDIFx1RDBDMFx1Qzc3NFx1QkEzOCBcdUNERThcdUMxOENcclxuICBjYW5jZWxTZXNzaW9uQ2xlYW51cCgpO1xyXG5cclxuICBhd2FpdCBzdG9wU2NyZWVuY2FzdCgpO1xyXG5cclxuICAvLyBDRFAgXHVENTc4XHVCNEU0XHVCN0VDIFx1QjRGMVx1Qjg1RCBcdUMwQzFcdUQwREMgXHVCOUFDXHVDMTRCXHJcbiAgc2NyZWVuY2FzdEhhbmRsZXJSZWdpc3RlcmVkID0gZmFsc2U7XHJcblxyXG4gIC8vIFx1QjlDOFx1QzZCMFx1QzJBNCBcdUJDODRcdUQyQkMgXHVDMEMxXHVEMERDIFx1QjlBQ1x1QzE0QlxyXG4gIHByZXNzZWRNb3VzZUJ1dHRvbnMuY2xlYXIoKTtcclxuXHJcbiAgLy8gXHVEMDc0XHVCNzdDXHVDNzc0XHVDNUI4XHVEMkI4IFx1QkNGNFx1Qzg3NCBcdUI2MTBcdUIyOTQgXHVDODg1XHVCOENDXHJcbiAgY29uc3QgY2xpZW50cyA9IHNlc3Npb24uY2xpZW50cztcclxuICBpZiAoIXByZXNlcnZlQ2xpZW50cykge1xyXG4gICAgY2xpZW50cy5mb3JFYWNoKGNsaWVudCA9PiB7XHJcbiAgICAgIGNsaWVudC5jbG9zZSgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyBcdUJFMENcdUI3N0NcdUM2QjBcdUM4MDAgXHVDODg1XHVCOENDXHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IHNlc3Npb24uYnJvd3Nlci5jbG9zZSgpO1xyXG4gIH0gY2F0Y2ggKGUpIHtcclxuICAgIC8vIFx1QkIzNFx1QzJEQ1xyXG4gIH1cclxuXHJcbiAgc2Vzc2lvbiA9IG51bGw7XHJcbiAgcmV0dXJuIHByZXNlcnZlQ2xpZW50cyA/IGNsaWVudHMgOiBuZXcgU2V0KCk7XHJcbn1cclxuXHJcbi8vIFx1RDM5OFx1Qzc3NFx1QzlDMCBcdUMwQzhcdUI4NUNcdUFDRTBcdUNFNjhcclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlZnJlc2hQcmV2aWV3KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gIGlmICghc2Vzc2lvbikgcmV0dXJuO1xyXG5cclxuICBjb25zb2xlLmxvZygnW1B1cHBldGVlciBQcmV2aWV3XSBSZWZyZXNoaW5nIHBhZ2UnKTtcclxuICBhd2FpdCBzZXNzaW9uLnBhZ2UucmVsb2FkKHsgd2FpdFVudGlsOiAnZG9tY29udGVudGxvYWRlZCcgfSk7XHJcbn1cclxuXHJcbi8vIFVSTCBcdUJDQzBcdUFDQkRcclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG5hdmlnYXRlUHJldmlldyh1cmw6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gIGlmICghc2Vzc2lvbikge1xyXG4gICAgYXdhaXQgc3RhcnRQcmV2aWV3KHVybCk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBpZiAoc2Vzc2lvbi51cmwgPT09IHVybCkgcmV0dXJuO1xyXG5cclxuICBjb25zb2xlLmxvZygnW1B1cHBldGVlciBQcmV2aWV3XSBOYXZpZ2F0aW5nIHRvOicsIHVybCk7XHJcbiAgc2Vzc2lvbi51cmwgPSB1cmw7XHJcbiAgYXdhaXQgc2Vzc2lvbi5wYWdlLmdvdG8odXJsLCB7IHdhaXRVbnRpbDogJ2RvbWNvbnRlbnRsb2FkZWQnLCB0aW1lb3V0OiAzMDAwMCB9KTtcclxufVxyXG5cclxuLy8gXHVCREYwXHVEM0VDXHVEMkI4IFx1QkNDMFx1QUNCRFxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzaXplUHJldmlldyh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xyXG4gIGlmICghc2Vzc2lvbikgcmV0dXJuO1xyXG5cclxuICBzZXNzaW9uLnZpZXdwb3J0V2lkdGggPSB3aWR0aDtcclxuICBzZXNzaW9uLnZpZXdwb3J0SGVpZ2h0ID0gaGVpZ2h0O1xyXG5cclxuICBhd2FpdCBzZXNzaW9uLnBhZ2Uuc2V0Vmlld3BvcnQoe1xyXG4gICAgd2lkdGgsXHJcbiAgICBoZWlnaHQsXHJcbiAgICBkZXZpY2VTY2FsZUZhY3RvcjogMixcclxuICAgIGlzTW9iaWxlOiB0cnVlLFxyXG4gICAgaGFzVG91Y2g6IHRydWVcclxuICB9KTtcclxuXHJcbiAgLy8gU2NyZWVuY2FzdCBcdUM3QUNcdUMyRENcdUM3OTFcclxuICBhd2FpdCBzdG9wU2NyZWVuY2FzdCgpO1xyXG4gIGF3YWl0IHN0YXJ0U2NyZWVuY2FzdCgpO1xyXG59XHJcblxyXG4vLyBcdUI5QzhcdUM2QjBcdUMyQTQgXHVDNzc0XHVCQ0E0XHVEMkI4IFx1Q0M5OFx1QjlBQ1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlTW91c2VFdmVudChcclxuICB0eXBlOiAnbW91c2Vkb3duJyB8ICdtb3VzZXVwJyB8ICdtb3VzZW1vdmUnIHwgJ2NsaWNrJyxcclxuICB4OiBudW1iZXIsXHJcbiAgeTogbnVtYmVyLFxyXG4gIGJ1dHRvbjogJ2xlZnQnIHwgJ3JpZ2h0JyB8ICdtaWRkbGUnID0gJ2xlZnQnXHJcbik6IFByb21pc2U8dm9pZD4ge1xyXG4gIGlmICghc2Vzc2lvbikgcmV0dXJuO1xyXG5cclxuICB0cnkge1xyXG4gICAgc3dpdGNoICh0eXBlKSB7XHJcbiAgICAgIGNhc2UgJ2NsaWNrJzpcclxuICAgICAgICAvLyBjbGljayBcdUM4MDRcdUM1RDAgXHVCQzg0XHVEMkJDXHVDNzc0IFx1QjIwQ1x1QjlCMCBcdUMwQzFcdUQwRENcdUJBNzQgXHVCQTNDXHVDODAwIFx1RDU3NFx1QzgxQyAoUHVwcGV0ZWVyIFx1QjBCNFx1QkQ4MCBcdUMwQzFcdUQwREMgXHVCM0Q5XHVBRTMwXHVENjU0KVxyXG4gICAgICAgIGlmIChwcmVzc2VkTW91c2VCdXR0b25zLmhhcyhidXR0b24pKSB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBzZXNzaW9uLnBhZ2UubW91c2UudXAoeyBidXR0b24gfSk7XHJcbiAgICAgICAgICB9IGNhdGNoIHtcclxuICAgICAgICAgICAgLy8gXHVDNzc0XHVCQkY4IFx1RDU3NFx1QzgxQ1x1QjQxQyBcdUMwQzFcdUQwRENcdUJBNzQgXHVCQjM0XHVDMkRDXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBwcmVzc2VkTW91c2VCdXR0b25zLmRlbGV0ZShidXR0b24pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBhd2FpdCBzZXNzaW9uLnBhZ2UubW91c2UuY2xpY2soeCwgeSwgeyBidXR0b24gfSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgJ21vdXNlZG93bic6XHJcbiAgICAgICAgLy8gXHVDNzc0XHVCQkY4IFx1QjIwQ1x1QjlCMCBcdUMwQzFcdUQwRENcdUJBNzQgXHVCQTNDXHVDODAwIFx1RDU3NFx1QzgxQyBcdUQ2QzQgXHVCMkU0XHVDMkRDIFx1QjIwNFx1Qjk3NFx1QUUzMFxyXG4gICAgICAgIGlmIChwcmVzc2VkTW91c2VCdXR0b25zLmhhcyhidXR0b24pKSB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBzZXNzaW9uLnBhZ2UubW91c2UudXAoeyBidXR0b24gfSk7XHJcbiAgICAgICAgICB9IGNhdGNoIHtcclxuICAgICAgICAgICAgLy8gXHVDNzc0XHVCQkY4IFx1RDU3NFx1QzgxQ1x1QjQxQyBcdUMwQzFcdUQwRENcdUJBNzQgXHVCQjM0XHVDMkRDXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBwcmVzc2VkTW91c2VCdXR0b25zLmRlbGV0ZShidXR0b24pO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBcdUJBM0NcdUM4MDAgXHVCOUM4XHVDNkIwXHVDMkE0IFx1QzcwNFx1Q0U1OFx1Qjg1QyBcdUM3NzRcdUIzRDkgXHVENkM0IFx1QkM4NFx1RDJCQyBcdUIyMDRcdUI5NzRcdUFFMzBcclxuICAgICAgICBhd2FpdCBzZXNzaW9uLnBhZ2UubW91c2UubW92ZSh4LCB5KTtcclxuICAgICAgICBhd2FpdCBzZXNzaW9uLnBhZ2UubW91c2UuZG93bih7IGJ1dHRvbiB9KTtcclxuICAgICAgICBwcmVzc2VkTW91c2VCdXR0b25zLmFkZChidXR0b24pO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdtb3VzZXVwJzpcclxuICAgICAgICAvLyBcdUQ1NzRcdUIyRjkgXHVCQzg0XHVEMkJDXHVDNzc0IFx1QjIwQ1x1QjlCMCBcdUMwQzFcdUQwRENcdUM3N0MgXHVCNTRDXHVCOUNDIHVwIFx1RDYzOFx1Q0Q5QyAoUHVwcGV0ZWVyIFx1QzVEMFx1QjdFQyBcdUJDMjlcdUM5QzApXHJcbiAgICAgICAgYXdhaXQgc2Vzc2lvbi5wYWdlLm1vdXNlLm1vdmUoeCwgeSk7XHJcbiAgICAgICAgaWYgKHByZXNzZWRNb3VzZUJ1dHRvbnMuaGFzKGJ1dHRvbikpIHtcclxuICAgICAgICAgIGF3YWl0IHNlc3Npb24ucGFnZS5tb3VzZS51cCh7IGJ1dHRvbiB9KTtcclxuICAgICAgICAgIHByZXNzZWRNb3VzZUJ1dHRvbnMuZGVsZXRlKGJ1dHRvbik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdtb3VzZW1vdmUnOlxyXG4gICAgICAgIGF3YWl0IHNlc3Npb24ucGFnZS5tb3VzZS5tb3ZlKHgsIHkpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAvLyBQdXBwZXRlZXIgXHVCOUM4XHVDNkIwXHVDMkE0IFx1QzBDMVx1RDBEQyBcdUM1RDBcdUI3RUMgXHVDMkRDIFx1QzBDMVx1RDBEQyBcdUI5QUNcdUMxNEJcclxuICAgIGNvbnN0IGVycm9yTXNnID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xyXG4gICAgaWYgKGVycm9yTXNnLmluY2x1ZGVzKCdpcyBub3QgcHJlc3NlZCcpIHx8IGVycm9yTXNnLmluY2x1ZGVzKCdpcyBhbHJlYWR5IHByZXNzZWQnKSkge1xyXG4gICAgICAvLyBcdUMwQzFcdUQwREMgXHVCRDg4XHVDNzdDXHVDRTU4IC0gXHVCQUE4XHVCNEUwIFx1QkM4NFx1RDJCQyBcdUMwQzFcdUQwREMgXHVDRDA4XHVBRTMwXHVENjU0XHJcbiAgICAgIHByZXNzZWRNb3VzZUJ1dHRvbnMuY2xlYXIoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIFx1QjJFNFx1Qjk3OCBcdUM1RDBcdUI3RUNcdUIyOTQgXHVCMkU0XHVDMkRDIHRocm93XHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuLy8gXHVEMEE0XHVCQ0Y0XHVCNERDIFx1Qzc3NFx1QkNBNFx1RDJCOCBcdUNDOThcdUI5QUNcclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZUtleUV2ZW50KFxyXG4gIHR5cGU6ICdrZXlkb3duJyB8ICdrZXl1cCcgfCAna2V5cHJlc3MnLFxyXG4gIGtleTogc3RyaW5nXHJcbik6IFByb21pc2U8dm9pZD4ge1xyXG4gIGlmICghc2Vzc2lvbikgcmV0dXJuO1xyXG5cclxuICAvLyBQdXBwZXRlZXIgS2V5SW5wdXQgXHVEMEMwXHVDNzg1XHVDNzNDXHVCODVDIFx1Q0U5MFx1QzJBNFx1RDMwNVxyXG4gIGNvbnN0IGtleUlucHV0ID0ga2V5IGFzIGltcG9ydCgncHVwcGV0ZWVyJykuS2V5SW5wdXQ7XHJcblxyXG4gIHN3aXRjaCAodHlwZSkge1xyXG4gICAgY2FzZSAna2V5ZG93bic6XHJcbiAgICAgIGF3YWl0IHNlc3Npb24ucGFnZS5rZXlib2FyZC5kb3duKGtleUlucHV0KTtcclxuICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdrZXl1cCc6XHJcbiAgICAgIGF3YWl0IHNlc3Npb24ucGFnZS5rZXlib2FyZC51cChrZXlJbnB1dCk7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgY2FzZSAna2V5cHJlc3MnOlxyXG4gICAgICBhd2FpdCBzZXNzaW9uLnBhZ2Uua2V5Ym9hcmQucHJlc3Moa2V5SW5wdXQpO1xyXG4gICAgICBicmVhaztcclxuICB9XHJcbn1cclxuXHJcbi8vIFx1RDE0RFx1QzJBNFx1RDJCOCBcdUM3ODVcdUI4MjVcclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHR5cGVUZXh0KHRleHQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gIGlmICghc2Vzc2lvbikgcmV0dXJuO1xyXG4gIGF3YWl0IHNlc3Npb24ucGFnZS5rZXlib2FyZC50eXBlKHRleHQpO1xyXG59XHJcblxyXG4vLyBcdUMyQTRcdUQwNkNcdUI4NjQgXHVDNzc0XHVCQ0E0XHVEMkI4IFx1Q0M5OFx1QjlBQ1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlU2Nyb2xsKGRlbHRhWDogbnVtYmVyLCBkZWx0YVk6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xyXG4gIGlmICghc2Vzc2lvbikgcmV0dXJuO1xyXG5cclxuICBhd2FpdCBzZXNzaW9uLnBhZ2UuZXZhbHVhdGUoKGR4LCBkeSkgPT4ge1xyXG4gICAgd2luZG93LnNjcm9sbEJ5KGR4LCBkeSk7XHJcbiAgfSwgZGVsdGFYLCBkZWx0YVkpO1xyXG59XHJcblxyXG4vLyBcdUI0QTRcdUI4NUNcdUFDMDBcdUFFMzBcclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdvQmFjaygpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICBpZiAoIXNlc3Npb24pIHJldHVybiBmYWxzZTtcclxuXHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IHNlc3Npb24ucGFnZS5nb0JhY2soeyB3YWl0VW50aWw6ICdkb21jb250ZW50bG9hZGVkJywgdGltZW91dDogMTAwMDAgfSk7XHJcbiAgICBjb25zb2xlLmxvZygnW1B1cHBldGVlciBQcmV2aWV3XSBOYXZpZ2F0ZWQgYmFjaycpO1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfSBjYXRjaCAoZSkge1xyXG4gICAgY29uc29sZS5sb2coJ1tQdXBwZXRlZXIgUHJldmlld10gQ2Fubm90IGdvIGJhY2snKTtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcbn1cclxuXHJcbi8vIFx1QzU1RVx1QzczQ1x1Qjg1Q1x1QUMwMFx1QUUzMFxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ29Gb3J3YXJkKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG4gIGlmICghc2Vzc2lvbikgcmV0dXJuIGZhbHNlO1xyXG5cclxuICB0cnkge1xyXG4gICAgYXdhaXQgc2Vzc2lvbi5wYWdlLmdvRm9yd2FyZCh7IHdhaXRVbnRpbDogJ2RvbWNvbnRlbnRsb2FkZWQnLCB0aW1lb3V0OiAxMDAwMCB9KTtcclxuICAgIGNvbnNvbGUubG9nKCdbUHVwcGV0ZWVyIFByZXZpZXddIE5hdmlnYXRlZCBmb3J3YXJkJyk7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9IGNhdGNoIChlKSB7XHJcbiAgICBjb25zb2xlLmxvZygnW1B1cHBldGVlciBQcmV2aWV3XSBDYW5ub3QgZ28gZm9yd2FyZCcpO1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxufVxyXG5cclxuLy8gV2ViU29ja2V0IFx1QzExQ1x1QkM4NCBcdUMxMjRcdUM4MTVcclxuZXhwb3J0IGZ1bmN0aW9uIHNldHVwV2ViU29ja2V0U2VydmVyKHNlcnZlcjogYW55KTogdm9pZCB7XHJcbiAgaWYgKHdzcykgcmV0dXJuO1xyXG5cclxuICB3c3MgPSBuZXcgV2ViU29ja2V0U2VydmVyKHsgbm9TZXJ2ZXI6IHRydWUgfSk7XHJcblxyXG4gIC8vIEhUVFAgXHVDMTFDXHVCQzg0XHVDNzU4IHVwZ3JhZGUgXHVDNzc0XHVCQ0E0XHVEMkI4IFx1RDU3OFx1QjRFNFx1QjlDMVxyXG4gIHNlcnZlci5vbigndXBncmFkZScsIChyZXF1ZXN0OiBJbmNvbWluZ01lc3NhZ2UsIHNvY2tldDogRHVwbGV4LCBoZWFkOiBCdWZmZXIpID0+IHtcclxuICAgIGNvbnN0IHVybCA9IHJlcXVlc3QudXJsIHx8ICcnO1xyXG5cclxuICAgIGlmICh1cmwgPT09ICcvd3MvcHJldmlldycpIHtcclxuICAgICAgd3NzIS5oYW5kbGVVcGdyYWRlKHJlcXVlc3QsIHNvY2tldCwgaGVhZCwgKHdzKSA9PiB7XHJcbiAgICAgICAgd3NzIS5lbWl0KCdjb25uZWN0aW9uJywgd3MsIHJlcXVlc3QpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgd3NzLm9uKCdjb25uZWN0aW9uJywgKHdzOiBXZWJTb2NrZXQpID0+IHtcclxuICAgIGNvbnNvbGUubG9nKCdbUHVwcGV0ZWVyIFByZXZpZXddIFdlYlNvY2tldCBjbGllbnQgY29ubmVjdGVkJyk7XHJcblxyXG4gICAgLy8gXHVDMEM4IFx1RDA3NFx1Qjc3Q1x1Qzc3NFx1QzVCOFx1RDJCOCBcdUM1RjBcdUFDQjAgXHVDMkRDIFx1QzgxNVx1QjlBQyBcdUQwQzBcdUM3NzRcdUJBMzggXHVDREU4XHVDMThDXHJcbiAgICBjYW5jZWxTZXNzaW9uQ2xlYW51cCgpO1xyXG5cclxuICAgIGlmIChzZXNzaW9uKSB7XHJcbiAgICAgIHNlc3Npb24uY2xpZW50cy5hZGQod3MpO1xyXG4gICAgfVxyXG5cclxuICAgIHdzLm9uKCdtZXNzYWdlJywgYXN5bmMgKGRhdGE6IEJ1ZmZlcikgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBKU09OLnBhcnNlKGRhdGEudG9TdHJpbmcoKSk7XHJcblxyXG4gICAgICAgIHN3aXRjaCAobWVzc2FnZS50eXBlKSB7XHJcbiAgICAgICAgICBjYXNlICdzdGFydCc6XHJcbiAgICAgICAgICAgIC8vIFx1QUUzMFx1Qzg3NCBcdUMxMzhcdUMxNThcdUM3NzQgXHVDNzg4XHVBQ0UwIFx1QUMxOVx1Qzc0MCBVUkxcdUM3NzRcdUJBNzQgXHVEMDc0XHVCNzdDXHVDNzc0XHVDNUI4XHVEMkI4XHVCOUNDIFx1Q0Q5NFx1QUMwMFxyXG4gICAgICAgICAgICBpZiAoc2Vzc2lvbiAmJiBzZXNzaW9uLnVybCA9PT0gbWVzc2FnZS51cmwpIHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW1B1cHBldGVlciBQcmV2aWV3XSBBZGRpbmcgY2xpZW50IHRvIGV4aXN0aW5nIHNlc3Npb24nKTtcclxuICAgICAgICAgICAgICBzZXNzaW9uLmNsaWVudHMuYWRkKHdzKTtcclxuICAgICAgICAgICAgICAvLyBcdUJERjBcdUQzRUNcdUQyQjggXHVEMDZDXHVBRTMwXHVBQzAwIFx1QjJFNFx1Qjk3NFx1QkE3NCBcdUM4NzBcdUM4MTVcclxuICAgICAgICAgICAgICBpZiAoc2Vzc2lvbi52aWV3cG9ydFdpZHRoICE9PSBtZXNzYWdlLndpZHRoIHx8IHNlc3Npb24udmlld3BvcnRIZWlnaHQgIT09IG1lc3NhZ2UuaGVpZ2h0KSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCByZXNpemVQcmV2aWV3KG1lc3NhZ2Uud2lkdGgsIG1lc3NhZ2UuaGVpZ2h0KTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgYXdhaXQgc3RhcnRQcmV2aWV3KG1lc3NhZ2UudXJsLCBtZXNzYWdlLndpZHRoLCBtZXNzYWdlLmhlaWdodCk7XHJcbiAgICAgICAgICAgICAgaWYgKHNlc3Npb24pIHtcclxuICAgICAgICAgICAgICAgIHNlc3Npb24uY2xpZW50cy5hZGQod3MpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB3cy5zZW5kKEpTT04uc3RyaW5naWZ5KHsgdHlwZTogJ3N0YXJ0ZWQnIH0pKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgY2FzZSAnc3RvcCc6XHJcbiAgICAgICAgICAgIGF3YWl0IHN0b3BQcmV2aWV3KCk7XHJcbiAgICAgICAgICAgIHdzLnNlbmQoSlNPTi5zdHJpbmdpZnkoeyB0eXBlOiAnc3RvcHBlZCcgfSkpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICBjYXNlICdyZWZyZXNoJzpcclxuICAgICAgICAgICAgYXdhaXQgcmVmcmVzaFByZXZpZXcoKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgY2FzZSAnbmF2aWdhdGUnOlxyXG4gICAgICAgICAgICBhd2FpdCBuYXZpZ2F0ZVByZXZpZXcobWVzc2FnZS51cmwpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICBjYXNlICdyZXNpemUnOlxyXG4gICAgICAgICAgICBhd2FpdCByZXNpemVQcmV2aWV3KG1lc3NhZ2Uud2lkdGgsIG1lc3NhZ2UuaGVpZ2h0KTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgY2FzZSAnbW91c2UnOlxyXG4gICAgICAgICAgICBhd2FpdCBoYW5kbGVNb3VzZUV2ZW50KG1lc3NhZ2UuZXZlbnRUeXBlLCBtZXNzYWdlLngsIG1lc3NhZ2UueSwgbWVzc2FnZS5idXR0b24pO1xyXG4gICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICBjYXNlICdrZXknOlxyXG4gICAgICAgICAgICBhd2FpdCBoYW5kbGVLZXlFdmVudChtZXNzYWdlLmV2ZW50VHlwZSwgbWVzc2FnZS5rZXkpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICBjYXNlICd0eXBlJzpcclxuICAgICAgICAgICAgYXdhaXQgdHlwZVRleHQobWVzc2FnZS50ZXh0KTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgY2FzZSAnc2Nyb2xsJzpcclxuICAgICAgICAgICAgYXdhaXQgaGFuZGxlU2Nyb2xsKG1lc3NhZ2UuZGVsdGFYLCBtZXNzYWdlLmRlbHRhWSk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgIGNhc2UgJ2JhY2snOlxyXG4gICAgICAgICAgICBjb25zdCB3ZW50QmFjayA9IGF3YWl0IGdvQmFjaygpO1xyXG4gICAgICAgICAgICB3cy5zZW5kKEpTT04uc3RyaW5naWZ5KHsgdHlwZTogJ25hdmlnYXRpb24nLCBzdWNjZXNzOiB3ZW50QmFjaywgZGlyZWN0aW9uOiAnYmFjaycgfSkpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuXHJcbiAgICAgICAgICBjYXNlICdmb3J3YXJkJzpcclxuICAgICAgICAgICAgY29uc3Qgd2VudEZvcndhcmQgPSBhd2FpdCBnb0ZvcndhcmQoKTtcclxuICAgICAgICAgICAgd3Muc2VuZChKU09OLnN0cmluZ2lmeSh7IHR5cGU6ICduYXZpZ2F0aW9uJywgc3VjY2Vzczogd2VudEZvcndhcmQsIGRpcmVjdGlvbjogJ2ZvcndhcmQnIH0pKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQdXBwZXRlZXIgUHJldmlld10gTWVzc2FnZSBoYW5kbGluZyBlcnJvcjonLCBlcnJvcik7XHJcbiAgICAgICAgd3Muc2VuZChKU09OLnN0cmluZ2lmeSh7IHR5cGU6ICdlcnJvcicsIG1lc3NhZ2U6IFN0cmluZyhlcnJvcikgfSkpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICB3cy5vbignY2xvc2UnLCAoKSA9PiB7XHJcbiAgICAgIGNvbnNvbGUubG9nKCdbUHVwcGV0ZWVyIFByZXZpZXddIFdlYlNvY2tldCBjbGllbnQgZGlzY29ubmVjdGVkJyk7XHJcbiAgICAgIGlmIChzZXNzaW9uKSB7XHJcbiAgICAgICAgc2Vzc2lvbi5jbGllbnRzLmRlbGV0ZSh3cyk7XHJcbiAgICAgICAgLy8gXHVEMDc0XHVCNzdDXHVDNzc0XHVDNUI4XHVEMkI4XHVBQzAwIFx1QzVDNlx1QzczQ1x1QkE3NCBcdUMxMzhcdUMxNTggXHVDODE1XHVCOUFDIFx1QzYwOFx1QzU3RFxyXG4gICAgICAgIGlmIChzZXNzaW9uLmNsaWVudHMuc2l6ZSA9PT0gMCkge1xyXG4gICAgICAgICAgc2NoZWR1bGVTZXNzaW9uQ2xlYW51cCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgd3Mub24oJ2Vycm9yJywgKGVycm9yKSA9PiB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tQdXBwZXRlZXIgUHJldmlld10gV2ViU29ja2V0IGVycm9yOicsIGVycm9yKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBjb25zb2xlLmxvZygnW1B1cHBldGVlciBQcmV2aWV3XSBXZWJTb2NrZXQgc2VydmVyIHJlYWR5Jyk7XHJcbn1cclxuXHJcbi8vIFx1RDYwNFx1QzdBQyBcdUMwQzFcdUQwREMgXHVCQzE4XHVENjU4XHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRQcmV2aWV3U3RhdHVzKCk6IHsgYWN0aXZlOiBib29sZWFuOyB1cmw6IHN0cmluZyB8IG51bGw7IGNsaWVudHM6IG51bWJlciB9IHtcclxuICByZXR1cm4ge1xyXG4gICAgYWN0aXZlOiBzZXNzaW9uICE9PSBudWxsLFxyXG4gICAgdXJsOiBzZXNzaW9uPy51cmwgfHwgbnVsbCxcclxuICAgIGNsaWVudHM6IHNlc3Npb24/LmNsaWVudHMuc2l6ZSB8fCAwXHJcbiAgfTtcclxufVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQ0EsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxXQUFXOzs7QUNFbEIsT0FBTyxRQUFRO0FBQ2YsT0FBTyxZQUFZO0FBQ25CLE9BQU8sVUFBVTtBQUNqQixTQUFTLE1BQU0sYUFBMkI7QUFDMUMsU0FBUyxpQkFBaUI7OztBQ0wxQixPQUFPLGVBQThDO0FBQ3JELFNBQVMsV0FBVyx1QkFBdUI7QUFLM0MsU0FBUyxxQkFBNkI7QUFDcEMsU0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtB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O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFB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O0FBQ3ZDLHNCQUFJLENBQUMsT0FBTyxlQUFlO0FBQ3pCLDJCQUFPLE1BQU0sSUFBSTtBQUFBLGtCQUNuQjtBQUFBLGdCQUNGLENBQUM7QUFBQSxjQUNILENBQUM7QUFFRCw0QkFBYyxHQUFHLFNBQVMsQ0FBQyxRQUFRO0FBQ2pDLHdCQUFRLE1BQU0sMkJBQTJCLEdBQUc7QUFDNUMscUNBQXFCLFVBQVU7QUFBQSxjQUNqQyxDQUFDO0FBRUQsNEJBQWMsR0FBRyxTQUFTLENBQUMsU0FBUztBQUNsQyx3QkFBUSxJQUFJLHNDQUFzQyxJQUFJLEVBQUU7QUFDeEQsc0JBQU0saUJBQWlCLGVBQWUsSUFBSSxVQUFVO0FBQ3BELG9CQUFJLGdCQUFnQjtBQUNsQixpQ0FBZSxRQUFRLFFBQVEsWUFBVTtBQUN2Qyx3QkFBSSxDQUFDLE9BQU8sZUFBZTtBQUN6Qiw2QkFBTyxJQUFJO0FBQUEsb0JBQ2I7QUFBQSxrQkFDRixDQUFDO0FBQ0QsaUNBQWUsT0FBTyxVQUFVO0FBQUEsZ0JBQ2xDO0FBQUEsY0FDRixDQUFDO0FBR0Qsb0JBQU0sZUFBZSxNQUFNO0FBQ3pCLHNCQUFNLGlCQUFpQixlQUFlLElBQUksVUFBVTtBQUNwRCxvQkFBSSxnQkFBZ0I7QUFDbEIsaUNBQWUsUUFBUSxPQUFPLEdBQUc7QUFDakMsc0JBQUksZUFBZSxRQUFRLFNBQVMsR0FBRztBQUNyQywwQ0FBc0IsVUFBVTtBQUFBLGtCQUNsQztBQUFBLGdCQUNGO0FBQUEsY0FDRjtBQUNBLGtCQUFJLEdBQUcsU0FBUyxZQUFZO0FBQzVCLGtCQUFJLEdBQUcsV0FBVyxZQUFZO0FBQUEsWUFFaEMsU0FBUyxPQUFZO0FBQ25CLHNCQUFRLE1BQU0sbUJBQW1CLEtBQUs7QUFDdEMsdUJBQVMsS0FBSyxLQUFLLEVBQUUsT0FBTyxNQUFNLFFBQVEsQ0FBQztBQUFBLFlBQzdDO0FBQ0E7QUFBQSxVQUNGO0FBR0EsbUJBQVMsS0FBSyxLQUFLLEVBQUUsT0FBTyxZQUFZLENBQUM7QUFBQSxRQUUzQyxTQUFTLE9BQU87QUFDZCxrQkFBUSxNQUFNLGNBQWMsS0FBSztBQUNqQyxtQkFBUyxLQUFLLEtBQUssRUFBRSxPQUFPLHdCQUF3QixDQUFDO0FBQUEsUUFDdkQ7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUNGOzs7QURoM0ZBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDO0FBQUEsRUFDOUIsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJzZXNzaW9uIiwgInBhdGgiLCAic2Vzc2lvbiJdCn0K
