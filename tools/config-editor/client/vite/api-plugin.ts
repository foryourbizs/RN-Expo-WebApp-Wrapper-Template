// tools/config-editor/vite/api-plugin.ts
// Vite plugin to handle API routes directly without separate Express server

import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import {
  setupWebSocketServer,
  startPreview,
  stopPreview,
  refreshPreview,
  navigatePreview,
  getPreviewStatus
} from './puppeteer-preview';

const execAsync = promisify(exec);

// ========================================
// Logcat 프로세스 관리자
// ========================================
interface LogcatSession {
  process: ChildProcess;
  device: string;
  logType: string;
  clients: Set<any>; // HTTP response objects
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const logcatSessions = new Map<string, LogcatSession>();
const LOGCAT_CLEANUP_DELAY = 5000; // 5초 후 정리

function getLogcatSessionKey(device: string, logType: string): string {
  return `${device}:${logType}`;
}

function cleanupLogcatSession(key: string) {
  const session = logcatSessions.get(key);
  if (!session) return;

  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
  }

  console.log(`[Logcat] Cleaning up session: ${key}`);
  try {
    session.process.kill();
  } catch (e) {
    // 무시
  }
  logcatSessions.delete(key);
}

function scheduleLogcatCleanup(key: string) {
  const session = logcatSessions.get(key);
  if (!session) return;

  if (session.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
  }

  session.cleanupTimer = setTimeout(() => {
    const currentSession = logcatSessions.get(key);
    if (currentSession && currentSession.clients.size === 0) {
      cleanupLogcatSession(key);
    }
  }, LOGCAT_CLEANUP_DELAY);
}

function cancelLogcatCleanup(key: string) {
  const session = logcatSessions.get(key);
  if (session?.cleanupTimer) {
    clearTimeout(session.cleanupTimer);
    session.cleanupTimer = null;
  }
}

// NDK/SDK 라이선스 에러 패턴
const LICENSE_ERROR_PATTERNS = [
  /License for package .* not accepted/i,
  /Failed to install the following Android SDK packages/i,
  /You have not accepted the license agreements/i,
];

// 라이선스 에러 감지
function detectLicenseError(text: string): boolean {
  return LICENSE_ERROR_PATTERNS.some(pattern => pattern.test(text));
}

// SDK 루트 경로 추정 (잘못된 경로에서 올바른 경로 추정) - acceptSdkLicenses용
function inferSdkRootFromPath(inputPath: string): string {
  const normalizedPath = path.normalize(inputPath).toLowerCase();

  // bin 폴더인 경우 -> 2-3단계 상위로
  if (normalizedPath.endsWith('bin') || normalizedPath.endsWith('bin\\') || normalizedPath.endsWith('bin/')) {
    const parent = path.dirname(inputPath);
    const grandParent = path.dirname(parent);
    // cmdline-tools/bin 또는 cmdline-tools/latest/bin 구조 처리
    if (grandParent.toLowerCase().includes('cmdline-tools')) {
      return path.dirname(grandParent);
    }
    // cmdline-tools/bin 구조
    if (parent.toLowerCase().endsWith('cmdline-tools') || parent.toLowerCase().endsWith('tools')) {
      return path.dirname(parent);
    }
    return grandParent;
  }

  // cmdline-tools 폴더인 경우 -> 1단계 상위로
  if (normalizedPath.endsWith('cmdline-tools') || normalizedPath.endsWith('cmdline-tools\\') || normalizedPath.endsWith('cmdline-tools/')) {
    return path.dirname(inputPath);
  }

  // tools 폴더인 경우 -> 1단계 상위로
  if (normalizedPath.endsWith('tools') || normalizedPath.endsWith('tools\\') || normalizedPath.endsWith('tools/')) {
    return path.dirname(inputPath);
  }

  return inputPath;
}

// SDK 라이선스 자동 수락
async function acceptSdkLicenses(sdkPath?: string): Promise<{ success: boolean; message: string }> {
  // SDK 경로 결정 및 루트 추정
  let inputPath = sdkPath || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
    (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk') : '');

  if (!inputPath) {
    return { success: false, message: 'Android SDK path not found' };
  }

  // 잘못된 경로 패턴 자동 수정 (bin 또는 cmdline-tools 직접 지정 시)
  const sdkRoot = inferSdkRootFromPath(inputPath);

  const sdkmanagerName = process.platform === 'win32' ? 'sdkmanager.bat' : 'sdkmanager';

  // sdkmanager 경로 찾기 (다양한 SDK 구조 지원)
  const sdkmanagerPaths = [
    // 표준 SDK 구조: cmdline-tools/latest/bin
    path.join(sdkRoot, 'cmdline-tools', 'latest', 'bin', sdkmanagerName),
    // 이전 버전 SDK 구조: cmdline-tools/bin
    path.join(sdkRoot, 'cmdline-tools', 'bin', sdkmanagerName),
    // 레거시 SDK 구조: tools/bin
    path.join(sdkRoot, 'tools', 'bin', sdkmanagerName),
    // 입력 경로가 bin 폴더인 경우
    path.join(inputPath, sdkmanagerName),
    // 입력 경로가 cmdline-tools 폴더인 경우
    path.join(inputPath, 'bin', sdkmanagerName),
  ];

  let sdkmanagerPath: string | null = null;
  for (const p of sdkmanagerPaths) {
    if (fsSync.existsSync(p)) {
      sdkmanagerPath = p;
      break;
    }
  }

  if (!sdkmanagerPath) {
    return { success: false, message: `sdkmanager not found. Searched paths:\n${sdkmanagerPaths.slice(0, 3).join('\n')}` };
  }

  try {
    if (process.platform === 'win32') {
      // Windows: PowerShell 사용하여 yes 입력 파이프
      // --sdk_root 파라미터를 사용하여 라이선스를 올바른 위치에 저장
      const psCommand = `powershell -Command "& { 1..20 | ForEach-Object { 'y' } | & '${sdkmanagerPath.replace(/'/g, "''")}' --sdk_root='${sdkRoot.replace(/'/g, "''")}' --licenses }"`;
      await execAsync(psCommand, {
        timeout: 180000,
        env: { ...process.env, ANDROID_HOME: sdkRoot, ANDROID_SDK_ROOT: sdkRoot }
      });
    } else {
      // Unix: yes 명령어 사용
      await execAsync(`yes | "${sdkmanagerPath}" --sdk_root="${sdkRoot}" --licenses`, {
        timeout: 180000,
        env: { ...process.env, ANDROID_HOME: sdkRoot, ANDROID_SDK_ROOT: sdkRoot }
      });
    }

    return { success: true, message: 'SDK licenses accepted successfully' };
  } catch (error: any) {
    // sdkmanager가 exit code 1을 반환해도 라이선스는 수락됐을 수 있음
    if (error.stdout?.includes('accepted') || error.stderr?.includes('accepted') ||
        error.stdout?.includes('All SDK package licenses accepted') ||
        error.stderr?.includes('All SDK package licenses accepted')) {
      return { success: true, message: 'SDK licenses accepted' };
    }
    // 이미 모든 라이선스가 수락된 경우
    if (error.stdout?.includes('licenses not accepted') === false &&
        error.stderr?.includes('licenses not accepted') === false) {
      return { success: true, message: 'SDK licenses already accepted' };
    }
    return { success: false, message: `Failed to accept licenses: ${error.message}` };
  }
}

// Build process management
interface BuildProcess {
  process: ChildProcess;
  output: Array<{ type: string; text: string; timestamp: number }>;
  finished: boolean;
}

const buildProcesses: Map<string, BuildProcess> = new Map();

// Preview proxy state
let proxyTargetUrl: string | null = null;
let proxyTargetOrigin: string | null = null;

// Preview AppBridge script (injected into HTML)
// targetOrigin is passed to handle full URL rewriting
const getPreviewBridgeScript = (targetOrigin: string): string => {
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

    // 이미 /preview/로 시작하면 스킵
    if (url.startsWith('/preview/') || url.startsWith('/preview?')) return url;

    // data:, blob:, javascript: 등은 스킵
    if (/^(data|blob|javascript|about|mailto):/i.test(url)) return url;

    // 타겟 오리진의 전체 URL이면 리라이트
    if (url.startsWith(TARGET_ORIGIN + '/')) {
      return '/preview' + url.slice(TARGET_ORIGIN.length);
    }
    if (url === TARGET_ORIGIN) {
      return '/preview/';
    }

    // 프로토콜 상대 URL (//example.com/...) - 타겟 도메인이면 리라이트
    if (url.startsWith('//')) {
      var targetHost = TARGET_ORIGIN.replace(/^https?:/, '');
      if (url.startsWith(targetHost + '/') || url === targetHost) {
        return '/preview' + url.slice(targetHost.length);
      }
      return url; // 다른 도메인은 그대로
    }

    // 절대 경로 (/)로 시작하면 /preview 붙이기
    if (url.startsWith('/')) {
      return '/preview' + url;
    }

    // 상대 경로는 그대로 (브라우저가 base 태그 기준으로 처리)
    return url;
  }

  // fetch 오버라이드
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

  // XMLHttpRequest 오버라이드
  var originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    var newUrl = rewriteUrl(url);
    return originalXHROpen.call(this, method, newUrl, async !== false, user, password);
  };

  // EventSource 오버라이드 (SSE)
  if (window.EventSource) {
    var OriginalEventSource = window.EventSource;
    window.EventSource = function(url, config) {
      return new OriginalEventSource(rewriteUrl(url), config);
    };
    window.EventSource.prototype = OriginalEventSource.prototype;
  }

  // WebSocket은 ws:// 프로토콜이라 리라이트 불가, 그대로 둠

  // Dynamic script/link/img 생성 시 src/href 리라이트
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

      // src 프로퍼티도 오버라이드
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

  // import() 동적 임포트는 네이티브라 오버라이드 어려움
  // 대신 서버에서 JS 파일 내 import 경로를 리라이트해야 함

  // ========================================
  // URL/Location Spoofing for SPA Routers
  // ========================================

  (function() {
    var previewPrefix = '/preview';
    var originalPathname = window.location.pathname;
    var originalHref = window.location.href;

    console.log('[Preview] Original URL:', originalHref);
    console.log('[Preview] Original pathname:', originalPathname);

    // /preview로 시작하면 URL 변경
    if (originalPathname === previewPrefix || originalPathname.startsWith(previewPrefix + '/')) {
      var spoofedPath = originalPathname.slice(previewPrefix.length) || '/';
      var newUrl = spoofedPath + window.location.search + window.location.hash;

      console.log('[Preview] Spoofing to:', newUrl);

      // history.replaceState로 URL 변경
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
  // beforeunload 경고창 완전 무력화
  // (폼 데이터 입력 중 페이지 이탈 시 경고창 방지)
  // ========================================

  // 1. window.onbeforeunload 속성 무력화
  Object.defineProperty(window, 'onbeforeunload', {
    get: function() { return null; },
    set: function() { return; },
    configurable: false
  });

  // 2. addEventListener로 등록되는 beforeunload 이벤트 차단
  var originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'beforeunload') {
      return;
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  // 3. 이미 등록된 beforeunload 이벤트 무력화
  window.addEventListener('beforeunload', function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    delete e.returnValue;
    return undefined;
  }, true);

  // ========================================
  // AppBridge for Preview (실제 앱과 100% 동일한 구현)
  // ========================================

  if (window.AppBridge) return;

  // 토큰을 Symbol 키로 은닉 (외부에서 접근 불가)
  var _t = (function(){
    var s = Symbol('_');
    var o = {};
    o[s] = 'preview-security-token';
    return function(){ return o[s]; };
  })();

  // 응답 대기 맵
  var pendingRequests = new Map();

  // 파일/바이너리 데이터를 base64로 변환
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

  // 재귀적으로 모든 Blob/File 처리
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

  // Preview용 mock 응답 생성 (다양한 action 지원)
  var mockResponses = {
    // 앱/시스템 정보
    'getAppInfo': { appName: 'Preview App', version: '1.0.0', platform: 'preview', isApp: true },
    'getDeviceInfo': { platform: 'android', model: 'Preview Device', osVersion: '13', isPreview: true, isApp: true },
    'getSystemInfo': { platform: 'android', isApp: true, isPreview: true, version: '1.0.0' },
    'getPlatform': { platform: 'android', isApp: true },
    'getVersion': { version: '1.0.0' },

    // 권한
    'checkPermission': { granted: true },
    'requestPermission': { granted: true },
    'hasPermission': { granted: true, result: true },

    // 인증/사용자
    'getToken': { token: 'preview-mock-token' },
    'getFcmToken': { token: 'preview-fcm-token' },
    'getPushToken': { token: 'preview-push-token' },
    'getUserInfo': { isLoggedIn: false },
    'getUser': { isLoggedIn: false },
    'isLoggedIn': { loggedIn: false, isLoggedIn: false },

    // 설정/환경
    'getSettings': { theme: 'light' },
    'getConfig': { debug: false },
    'getEnv': { env: 'preview' },

    // UI/레이아웃
    'getSafeArea': { top: 24, bottom: 34, left: 0, right: 0 },
    'getStatusBarHeight': { height: 24 },
    'getNavigationBarHeight': { height: 48 },
    'getInsets': { top: 24, bottom: 34, left: 0, right: 0 },
    'getScreenInfo': { width: 360, height: 800, scale: 3 },

    // 네트워크/연결
    'getNetworkStatus': { connected: true, type: 'wifi' },
    'isOnline': { online: true, connected: true },

    // 스토리지
    'getItem': { value: null },
    'setItem': { success: true },
    'removeItem': { success: true },

    // 액션
    'haptic': { success: true },
    'vibrate': { success: true },
    'share': { success: true },
    'openUrl': { success: true },
    'openBrowser': { success: true },
    'copyToClipboard': { success: true },
    'showToast': { success: true },
    'hideKeyboard': { success: true },

    // 기본 응답 (알 수 없는 action에 대해)
    '_default': { success: true, isPreview: true, isApp: true }
  };

  // ReactNativeWebView mock - 실제 앱과 동일한 방식으로 응답 전달
  window.ReactNativeWebView = {
    postMessage: function(messageStr) {
      var parsed = JSON.parse(messageStr);
      console.log('[AppBridge Preview] postMessage:', parsed);

      // requestId가 있으면 call() 호출 -> mock 응답 반환
      if (parsed.requestId) {
        var action = parsed.protocol.replace('app://', '');
        var mockData = mockResponses[action] || mockResponses['_default'];

        // 실제 앱처럼 약간의 딜레이 후 nativeMessage 이벤트로 응답
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

      // parent frame에도 알림 (디버깅용)
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'PREVIEW_BRIDGE_MESSAGE', data: parsed }, '*');
      }
    }
  };

  // 앱 브릿지 객체 (실제 bridge-client.ts와 동일한 구조)
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

  // 앱에서 온 메시지 수신 리스너 (실제 앱과 동일)
  window.addEventListener('nativeMessage', function(e) {
    console.log('[AppBridge] nativeMessage event received', e.detail);
    window.AppBridge._handleMessage(e.detail);
  });

  // 전역 콜백 (호환성)
  window.onNativeMessage = function(message) {
    window.AppBridge._handleMessage(message);
  };

  // 초기화 완료 이벤트
  window.dispatchEvent(new CustomEvent('AppBridgeReady'));
  console.log('[AppBridge Preview] Initialized (matching real app implementation)');
})();
</script>`;
};

// Project root (where package.json is)
const projectRoot = path.resolve(__dirname, '../../../..');
const constantsDir = path.join(projectRoot, 'constants');
const bridgesDir = path.join(projectRoot, 'lib/bridges');

// Config files
const CONFIG_FILES: Record<string, string> = {
  app: 'app.json',
  theme: 'theme.json',
  plugins: 'plugins.json',
  'build-env': 'build-env.json'
};

// Validation
const NPM_PACKAGE_REGEX = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const SAFE_SEARCH_REGEX = /^[a-zA-Z0-9@/_-]+$/;

function isValidPackageName(name: string): boolean {
  return typeof name === 'string' &&
    name.length > 0 &&
    name.length <= 214 &&
    NPM_PACKAGE_REGEX.test(name);
}

function isValidSearchQuery(query: string): boolean {
  return typeof query === 'string' &&
    query.length > 0 &&
    query.length <= 100 &&
    SAFE_SEARCH_REGEX.test(query);
}

// npm utilities
async function searchNpmPackages(query: string) {
  if (!isValidSearchQuery(query)) {
    console.log('[api-plugin] Invalid search query:', query);
    return [];
  }
  try {
    console.log('[api-plugin] Searching npm for:', query);
    const { stdout } = await execAsync(`npm search "${query}" --json`, {
      cwd: projectRoot,
      timeout: 60000
    });
    const results = JSON.parse(stdout);
    console.log('[api-plugin] Search results count:', results.length);
    return results;
  } catch (error) {
    console.error('[api-plugin] npm search error:', error);
    return [];
  }
}

async function getInstalledPackages() {
  try {
    const { stdout } = await execAsync('npm list --json --depth=0', {
      cwd: projectRoot
    });
    const data = JSON.parse(stdout);
    return Object.entries(data.dependencies || {}).map(([name, info]: [string, any]) => ({
      name,
      version: info.version
    }));
  } catch (error: any) {
    // npm list는 peer dep 경고로 exit code 1 반환 가능
    if (error.stdout) {
      try {
        const data = JSON.parse(error.stdout);
        return Object.entries(data.dependencies || {}).map(([name, info]: [string, any]) => ({
          name,
          version: info.version
        }));
      } catch {
        return [];
      }
    }
    console.error('[api-plugin] npm list error:', error.message);
    return [];
  }
}

async function installPackage(packageName: string, version = 'latest') {
  if (!isValidPackageName(packageName)) {
    return { success: false, error: 'Invalid package name' };
  }
  const spec = version === 'latest' ? packageName : `${packageName}@${version}`;
  try {
    await execAsync(`npm install ${spec}`, { cwd: projectRoot, timeout: 120000 });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function uninstallPackage(packageName: string) {
  if (!isValidPackageName(packageName)) {
    return { success: false, error: 'Invalid package name' };
  }
  try {
    await execAsync(`npm uninstall ${packageName}`, { cwd: projectRoot, timeout: 60000 });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function regeneratePluginRegistry() {
  try {
    await execAsync('npm run generate:plugins', { cwd: projectRoot });
    console.log('[api-plugin] Plugin registry regenerated');
  } catch (e) {
    console.error('[api-plugin] Failed to regenerate plugin registry:', e);
  }
}

// 네임스페이스 충돌 검사
function validatePluginNamespaces(config: any): { valid: boolean; conflicts: Array<{ namespace: string; plugins: string[] }> } {
  const allPlugins = [
    ...(config.plugins?.auto || []).map((p: any) => ({ ...p, id: p.name, type: 'auto' })),
    ...(config.plugins?.manual || []).map((p: any) => ({ ...p, id: p.path, type: 'manual' }))
  ];

  const namespaceMap = new Map<string, string[]>();

  allPlugins.forEach((plugin: any) => {
    const ns = plugin.namespace;
    const id = plugin.id;
    if (ns) {
      if (!namespaceMap.has(ns)) {
        namespaceMap.set(ns, []);
      }
      namespaceMap.get(ns)!.push(id);
    }
  });

  const conflicts: Array<{ namespace: string; plugins: string[] }> = [];
  namespaceMap.forEach((plugins, namespace) => {
    if (plugins.length > 1) {
      conflicts.push({ namespace, plugins });
    }
  });

  return { valid: conflicts.length === 0, conflicts };
}

// Helper to read request body
async function readBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

// Helper to send JSON response
function sendJson(res: any, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

// ========== Build Environment ==========

interface BuildEnvConfig {
  android?: {
    sdkPath?: string;
    javaHome?: string;
  };
  ios?: {
    xcodeSelectPath?: string;
  };
}

async function loadBuildEnv(): Promise<BuildEnvConfig> {
  try {
    const content = await fs.readFile(path.join(constantsDir, 'build-env.json'), 'utf-8');
    const data = JSON.parse(content);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { $schema, ...config } = data;
    return config;
  } catch {
    return {};
  }
}

async function saveBuildEnv(config: BuildEnvConfig): Promise<void> {
  const data = {
    $schema: './schemas/build-env.schema.json',
    ...config
  };
  await fs.writeFile(
    path.join(constantsDir, 'build-env.json'),
    JSON.stringify(data, null, 2) + '\n',
    'utf-8'
  );
}

// local.properties 업데이트
async function updateLocalProperties(sdkPath: string): Promise<void> {
  const localPropsPath = path.join(projectRoot, 'android', 'local.properties');
  // 경로를 gradle 형식으로 변환 (백슬래시 이스케이프)
  const escapedPath = sdkPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
  const content = `sdk.dir=${escapedPath}\n`;
  await fs.writeFile(localPropsPath, content, 'utf-8');
}

// SDK 경로 유효성 검사 - 잘못된 경로 패턴 감지
function validateSdkPath(sdkPath: string): { valid: boolean; issue?: string; suggestion?: string } {
  const normalizedPath = path.normalize(sdkPath).toLowerCase();

  // cmdline-tools/bin 또는 tools/bin을 직접 가리키는 경우
  if (normalizedPath.endsWith('bin') || normalizedPath.endsWith('bin\\') || normalizedPath.endsWith('bin/')) {
    const parentDir = path.dirname(sdkPath);
    const grandParentDir = path.dirname(parentDir);
    return {
      valid: false,
      issue: 'SDK path points to bin folder',
      suggestion: `Use SDK root instead: ${grandParentDir}`
    };
  }

  // cmdline-tools 폴더를 직접 가리키는 경우
  if (normalizedPath.endsWith('cmdline-tools') || normalizedPath.endsWith('cmdline-tools\\') || normalizedPath.endsWith('cmdline-tools/')) {
    const parentDir = path.dirname(sdkPath);
    return {
      valid: false,
      issue: 'SDK path points to cmdline-tools folder',
      suggestion: `Use SDK root instead: ${parentDir}`
    };
  }

  // tools 폴더를 직접 가리키는 경우
  if (normalizedPath.endsWith('tools') || normalizedPath.endsWith('tools\\') || normalizedPath.endsWith('tools/')) {
    const parentDir = path.dirname(sdkPath);
    return {
      valid: false,
      issue: 'SDK path points to tools folder',
      suggestion: `Use SDK root instead: ${parentDir}`
    };
  }

  return { valid: true };
}

// SDK 라이선스 상태 확인
async function checkSdkLicenses(sdkPath: string): Promise<{ accepted: boolean; missing: string[] }> {
  const licensesDir = path.join(sdkPath, 'licenses');

  if (!fsSync.existsSync(licensesDir)) {
    return { accepted: false, missing: ['licenses folder not found'] };
  }

  // 필수 라이선스 파일 목록
  const requiredLicenses = ['android-sdk-license'];
  const missing: string[] = [];

  for (const license of requiredLicenses) {
    const licensePath = path.join(licensesDir, license);
    if (!fsSync.existsSync(licensePath)) {
      missing.push(license);
    }
  }

  return { accepted: missing.length === 0, missing };
}

// SDK 루트 경로 추정 (잘못된 경로에서 올바른 경로 추정)
function inferSdkRoot(inputPath: string): string {
  const normalizedPath = path.normalize(inputPath).toLowerCase();

  // bin 폴더인 경우 -> 2-3단계 상위로
  if (normalizedPath.endsWith('bin') || normalizedPath.endsWith('bin\\') || normalizedPath.endsWith('bin/')) {
    const parent = path.dirname(inputPath);
    const grandParent = path.dirname(parent);
    // cmdline-tools/bin 또는 cmdline-tools/latest/bin 구조 처리
    if (grandParent.toLowerCase().includes('cmdline-tools')) {
      return path.dirname(grandParent);
    }
    return grandParent;
  }

  // cmdline-tools 폴더인 경우 -> 1단계 상위로
  if (normalizedPath.endsWith('cmdline-tools') || normalizedPath.endsWith('cmdline-tools\\') || normalizedPath.endsWith('cmdline-tools/')) {
    return path.dirname(inputPath);
  }

  return inputPath;
}

async function checkBuildEnvironment(): Promise<Array<{ name: string; status: string; message: string; detail?: string; guidance?: string }>> {
  const checks: Array<{ name: string; status: string; message: string; detail?: string; guidance?: string }> = [];
  const buildEnv = await loadBuildEnv();

  // 1. Node.js
  try {
    const { stdout } = await execAsync('node -v');
    checks.push({ name: 'Node.js', status: 'ok', message: stdout.trim() });
  } catch {
    checks.push({
      name: 'Node.js',
      status: 'error',
      message: 'Not installed',
      guidance: 'Install Node.js from https://nodejs.org/'
    });
  }

  // 2. npm
  try {
    const { stdout } = await execAsync('npm -v');
    checks.push({ name: 'npm', status: 'ok', message: `v${stdout.trim()}` });
  } catch {
    checks.push({
      name: 'npm',
      status: 'error',
      message: 'Not installed',
      guidance: 'npm is included with Node.js installation'
    });
  }

  // 3. Java - build-env.json의 javaHome 우선 사용
  const javaHome = buildEnv.android?.javaHome || process.env.JAVA_HOME;
  if (javaHome) {
    try {
      const javaCmd = path.join(javaHome, 'bin', 'java');
      const { stderr } = await execAsync(`"${javaCmd}" -version`);
      const match = stderr.match(/version "([^"]+)"/);
      const version = match ? match[1] : 'Unknown';
      const major = parseInt(version.split('.')[0]);
      if (major >= 17 && major <= 21) {
        checks.push({ name: 'Java', status: 'ok', message: version });
      } else if (major > 21) {
        checks.push({ name: 'Java', status: 'warning', message: version, detail: 'JDK 17-21 recommended' });
      } else {
        checks.push({
          name: 'Java',
          status: 'error',
          message: version,
          detail: 'JDK 17+ required',
          guidance: 'Install JDK 17 or higher from https://adoptium.net/'
        });
      }
    } catch {
      // fallback to system java
      try {
        const { stderr } = await execAsync('java -version');
        const match = stderr.match(/version "([^"]+)"/);
        const version = match ? match[1] : 'Unknown';
        checks.push({ name: 'Java', status: 'ok', message: version });
      } catch {
        checks.push({
          name: 'Java',
          status: 'error',
          message: 'Not installed',
          detail: 'JDK 17+ required',
          guidance: 'Install JDK 17 from https://adoptium.net/'
        });
      }
    }
  } else {
    try {
      const { stderr } = await execAsync('java -version');
      const match = stderr.match(/version "([^"]+)"/);
      const version = match ? match[1] : 'Unknown';
      checks.push({ name: 'Java', status: 'ok', message: version });
    } catch {
      checks.push({
        name: 'Java',
        status: 'error',
        message: 'Not installed',
        detail: 'JDK 17+ required',
        guidance: 'Install JDK 17 from https://adoptium.net/'
      });
    }
  }

  // 4. JAVA_HOME
  if (buildEnv.android?.javaHome) {
    checks.push({ name: 'JAVA_HOME', status: 'ok', message: buildEnv.android.javaHome, detail: '(config)' });
  } else if (process.env.JAVA_HOME) {
    checks.push({ name: 'JAVA_HOME', status: 'ok', message: process.env.JAVA_HOME });
  } else {
    checks.push({
      name: 'JAVA_HOME',
      status: 'warning',
      message: 'Not set',
      guidance: 'Set Java Home path in Environment Settings above'
    });
  }

  // 5. Android SDK - build-env.json의 sdkPath 우선 사용
  const androidHome = buildEnv.android?.sdkPath || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (androidHome) {
    // 먼저 경로 유효성 검사
    const pathValidation = validateSdkPath(androidHome);

    if (!pathValidation.valid) {
      // 잘못된 경로 패턴 감지
      const inferredRoot = inferSdkRoot(androidHome);
      checks.push({
        name: 'Android SDK',
        status: 'error',
        message: pathValidation.issue || 'Invalid SDK path',
        detail: androidHome,
        guidance: pathValidation.suggestion || `SDK root should contain cmdline-tools, licenses folders. Try: ${inferredRoot}`
      });
    } else if (fsSync.existsSync(path.join(androidHome, 'cmdline-tools')) ||
               fsSync.existsSync(path.join(androidHome, 'tools')) ||
               fsSync.existsSync(path.join(androidHome, 'licenses'))) {
      // cmdline-tools, tools, 또는 licenses 폴더가 있으면 유효한 SDK로 인정
      const source = buildEnv.android?.sdkPath ? '(config)' : undefined;
      const hasPlatformTools = fsSync.existsSync(path.join(androidHome, 'platform-tools'));

      checks.push({
        name: 'Android SDK',
        status: 'ok',
        message: androidHome,
        detail: source
      });

      // platform-tools는 info 레벨로 표시 (빌드에는 필요 없음)
      if (!hasPlatformTools) {
        checks.push({
          name: 'Platform Tools',
          status: 'info',
          message: 'Not installed',
          detail: 'Optional - needed for adb (device debugging)',
          guidance: 'Run: sdkmanager "platform-tools" if you need adb'
        });
      }

      // 라이선스 확인
      const licenseCheck = await checkSdkLicenses(androidHome);
      if (!licenseCheck.accepted) {
        checks.push({
          name: 'SDK Licenses',
          status: 'error',
          message: 'Not accepted',
          detail: licenseCheck.missing.join(', '),
          guidance: `Run: sdkmanager --licenses`
        });
      } else {
        checks.push({ name: 'SDK Licenses', status: 'ok', message: 'Accepted' });
      }
    } else {
      // 경로는 있지만 SDK 구조가 아님
      checks.push({
        name: 'Android SDK',
        status: 'error',
        message: 'Invalid SDK structure',
        detail: androidHome,
        guidance: 'The path should be the SDK root containing cmdline-tools or tools folder. Download Android SDK from https://developer.android.com/studio'
      });
    }
  } else {
    checks.push({
      name: 'Android SDK',
      status: 'error',
      message: 'Not found',
      detail: 'Set ANDROID_HOME or configure in settings',
      guidance: 'Set Android SDK Path in Environment Settings above, or set ANDROID_HOME environment variable'
    });
  }

  // 6. EAS CLI
  try {
    const { stdout } = await execAsync('npx eas --version');
    checks.push({ name: 'EAS CLI', status: 'ok', message: stdout.trim() });
  } catch {
    checks.push({
      name: 'EAS CLI',
      status: 'info',
      message: 'Not installed',
      detail: 'Required for cloud builds',
      guidance: 'Run: npm install -g eas-cli'
    });
  }

  // 7. android folder
  const androidFolderExists = fsSync.existsSync(path.join(projectRoot, 'android'));
  if (androidFolderExists) {
    checks.push({ name: 'Android Project', status: 'ok', message: 'Found' });
  } else {
    checks.push({
      name: 'Android Project',
      status: 'info',
      message: 'Not found',
      detail: 'Run expo prebuild first',
      guidance: 'Run: npx expo prebuild --platform android'
    });
  }

  // 8. Package Name Mismatch Check
  if (androidFolderExists) {
    try {
      // app.json에서 expected package 읽기
      const appJsonPath = path.join(projectRoot, 'app.json');
      const appJson = JSON.parse(fsSync.readFileSync(appJsonPath, 'utf-8'));
      const expectedPackage = appJson.expo?.android?.package;

      if (expectedPackage) {
        // build.gradle에서 실제 namespace/applicationId 확인
        const buildGradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');
        let actualPackage: string | null = null;

        if (fsSync.existsSync(buildGradlePath)) {
          const buildGradleContent = fsSync.readFileSync(buildGradlePath, 'utf-8');
          // namespace 또는 applicationId 찾기
          const namespaceMatch = buildGradleContent.match(/namespace\s*[=:]\s*["']([^"']+)["']/);
          const appIdMatch = buildGradleContent.match(/applicationId\s*[=:]\s*["']([^"']+)["']/);
          actualPackage = namespaceMatch?.[1] || appIdMatch?.[1] || null;
        }

        // 또는 src/main/java 폴더 구조에서 패키지 확인
        if (!actualPackage) {
          const javaDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'java');
          if (fsSync.existsSync(javaDir)) {
            // 첫 번째로 발견되는 MainApplication 또는 MainActivity의 패키지 추출
            const findPackageInDir = (dir: string, prefix = ''): string | null => {
              const entries = fsSync.readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.isDirectory()) {
                  const newPrefix = prefix ? `${prefix}.${entry.name}` : entry.name;
                  const result = findPackageInDir(path.join(dir, entry.name), newPrefix);
                  if (result) return result;
                } else if (entry.name === 'MainApplication.kt' || entry.name === 'MainApplication.java' ||
                           entry.name === 'MainActivity.kt' || entry.name === 'MainActivity.java') {
                  return prefix;
                }
              }
              return null;
            };
            actualPackage = findPackageInDir(javaDir);
          }
        }

        if (actualPackage && actualPackage !== expectedPackage) {
          checks.push({
            name: 'Package Name',
            status: 'error',
            message: 'Mismatch detected',
            detail: `app.json: ${expectedPackage} ↔ android: ${actualPackage}`,
            guidance: 'Run "전체 초기화 (Deep Clean)" or "npx expo prebuild --clean" to regenerate android folder with correct package name'
          });
        } else if (actualPackage) {
          checks.push({ name: 'Package Name', status: 'ok', message: expectedPackage });
        }
      }
    } catch (e) {
      // 패키지 확인 실패 시 무시 (필수 체크 아님)
      console.log('[api-plugin] Package name check failed:', e);
    }
  }

  // 9. Keystore
  const keystorePaths = [
    path.join(projectRoot, 'android', 'app', 'release.keystore'),
    path.join(projectRoot, 'android', 'app', 'my-release-key.keystore'),
    path.join(projectRoot, 'android', 'keystores', 'release.keystore')
  ];
  const hasKeystore = keystorePaths.some(p => fsSync.existsSync(p));
  if (hasKeystore) {
    checks.push({ name: 'Release Keystore', status: 'ok', message: 'Found' });
  } else {
    checks.push({
      name: 'Release Keystore',
      status: 'info',
      message: 'Not found',
      detail: 'Required for release builds',
      guidance: 'Generate a keystore in the Keystore section below'
    });
  }

  return checks;
}

function startBuildProcess(type: string, profile: string, buildId: string, retryCount = 0): BuildProcess {
  const output: Array<{ type: string; text: string; timestamp: number }> = [];
  let cmd: string;
  let args: string[];
  let licenseErrorDetected = false;
  let allOutputText = ''; // 전체 출력을 누적하여 라이선스 에러 감지

  if (type === 'cloud') {
    // EAS Cloud Build
    cmd = 'npx';
    args = ['eas', 'build', '--platform', 'android', '--profile', profile, '--non-interactive'];
    output.push({ type: 'info', text: `Starting EAS cloud build (${profile})...`, timestamp: Date.now() });
  } else if (type === 'expo-dev') {
    // Expo Development Build (npx expo run:android)
    cmd = process.platform === 'win32' ? 'cmd' : 'sh';
    const devScript = process.platform === 'win32'
      ? `node scripts\\setup-plugins.js && npx expo run:android --no-install`
      : `node scripts/setup-plugins.js && npx expo run:android --no-install`;
    args = process.platform === 'win32' ? ['/c', devScript] : ['-c', devScript];
    output.push({ type: 'info', text: 'Starting Expo development build...', timestamp: Date.now() });
    output.push({ type: 'info', text: 'Building development client APK...', timestamp: Date.now() });
  } else {
    // Local Build - need to run prebuild first, then gradle
    const gradleTask = profile === 'debug' ? 'assembleDebug' :
                       profile === 'release-apk' ? 'assembleRelease' :
                       'bundleRelease';

    // Create a batch script to run the full build sequence
    cmd = process.platform === 'win32' ? 'cmd' : 'sh';
    const buildScript = process.platform === 'win32'
      ? `node scripts\\setup-plugins.js && npx expo prebuild --platform android && cd android && .\\gradlew ${gradleTask}`
      : `node scripts/setup-plugins.js && npx expo prebuild --platform android && cd android && ./gradlew ${gradleTask}`;
    args = process.platform === 'win32' ? ['/c', buildScript] : ['-c', buildScript];

    output.push({ type: 'info', text: `Starting local build (${profile})...`, timestamp: Date.now() });
    output.push({ type: 'info', text: `Gradle task: ${gradleTask}`, timestamp: Date.now() });
  }

  const proc = spawn(cmd, args, {
    cwd: projectRoot,
    shell: false,
    env: { ...process.env, FORCE_COLOR: '0' }
  });

  const buildProcess: BuildProcess = { process: proc, output, finished: false };

  const checkAndHandleLicenseError = (text: string) => {
    allOutputText += text + '\n';
    if (!licenseErrorDetected && detectLicenseError(allOutputText)) {
      licenseErrorDetected = true;
    }
  };

  proc.stdout?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) {
      output.push({ type: 'stdout', text, timestamp: Date.now() });
      checkAndHandleLicenseError(text);
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) {
      output.push({ type: 'stderr', text, timestamp: Date.now() });
      checkAndHandleLicenseError(text);
    }
  });

  proc.on('close', async (code) => {
    // 라이선스 에러가 감지되고 재시도 횟수가 남아있으면 자동 수정 후 재빌드
    if (code !== 0 && licenseErrorDetected && retryCount < 2) {
      output.push({ type: 'info', text: '⚠️ SDK/NDK license issue detected. Attempting automatic fix...', timestamp: Date.now() });

      // build-env.json에서 SDK 경로 가져오기
      const buildEnv = await loadBuildEnv();
      const sdkPath = buildEnv.android?.sdkPath;

      output.push({ type: 'info', text: 'Accepting SDK licenses...', timestamp: Date.now() });
      const licenseResult = await acceptSdkLicenses(sdkPath);

      if (licenseResult.success) {
        output.push({ type: 'success', text: `✓ ${licenseResult.message}`, timestamp: Date.now() });
        output.push({ type: 'info', text: '🔄 Restarting build...', timestamp: Date.now() });

        // 새 빌드 프로세스 시작 (재시도 횟수 증가)
        const newBuildProcess = startBuildProcess(type, profile, buildId, retryCount + 1);

        // 기존 buildProcess 객체를 새 프로세스로 업데이트
        buildProcess.process = newBuildProcess.process;

        // 새 프로세스의 출력을 기존 output 배열에 연결
        const originalOutput = newBuildProcess.output;
        const pollInterval = setInterval(() => {
          while (originalOutput.length > 0) {
            output.push(originalOutput.shift()!);
          }
          if (newBuildProcess.finished) {
            clearInterval(pollInterval);
            buildProcess.finished = true;
          }
        }, 100);
      } else {
        output.push({ type: 'error', text: `✗ ${licenseResult.message}`, timestamp: Date.now() });
        output.push({ type: 'info', text: 'Manual fix required: Run "sdkmanager --licenses" in your Android SDK directory', timestamp: Date.now() });
        buildProcess.finished = true;
        output.push({ type: 'error', text: `Build failed with exit code ${code}`, timestamp: Date.now() });
      }
      return;
    }

    buildProcess.finished = true;
    if (code === 0) {
      output.push({ type: 'success', text: 'Build completed successfully!', timestamp: Date.now() });

      // Show output path for local builds
      if (type === 'local') {
        const outputPath = profile === 'debug'
          ? 'android/app/build/outputs/apk/debug/app-debug.apk'
          : profile === 'release-apk'
          ? 'android/app/build/outputs/apk/release/app-release.apk'
          : 'android/app/build/outputs/bundle/release/app-release.aab';
        output.push({ type: 'info', text: `Output: ${outputPath}`, timestamp: Date.now() });
      }
    } else {
      output.push({ type: 'error', text: `Build failed with exit code ${code}`, timestamp: Date.now() });
    }
  });

  proc.on('error', (err) => {
    buildProcess.finished = true;
    output.push({ type: 'error', text: `Process error: ${err.message}`, timestamp: Date.now() });
  });

  return buildProcess;
}

async function cleanDirectories(): Promise<string[]> {
  const dirsToClean = [
    path.join(projectRoot, 'android', 'app', '.cxx'),
    path.join(projectRoot, 'android', 'app', 'build'),
    path.join(projectRoot, 'android', '.gradle'),
    path.join(projectRoot, 'android', 'build'),
  ];

  const cleaned: string[] = [];

  for (const dir of dirsToClean) {
    if (fsSync.existsSync(dir)) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
        cleaned.push(path.basename(dir));
      } catch (e) {
        // 삭제 실패해도 계속 진행
      }
    }
  }

  return cleaned;
}

function startCleanProcess(buildId: string): BuildProcess {
  const output: Array<{ type: string; text: string; timestamp: number }> = [];
  output.push({ type: 'info', text: 'Cleaning build cache...', timestamp: Date.now() });

  const buildProcess: BuildProcess = {
    process: null as any,
    output,
    finished: false
  };

  // 비동기로 디렉토리 삭제 후 gradlew clean 실행
  (async () => {
    try {
      // 1. 먼저 문제가 되는 디렉토리들 삭제
      output.push({ type: 'info', text: 'Removing .cxx and build directories...', timestamp: Date.now() });
      const cleaned = await cleanDirectories();
      if (cleaned.length > 0) {
        output.push({ type: 'stdout', text: `Deleted: ${cleaned.join(', ')}`, timestamp: Date.now() });
      }

      // 2. Gradle daemon 중지 및 clean 실행
      output.push({ type: 'info', text: 'Stopping Gradle daemon...', timestamp: Date.now() });

      const cmd = process.platform === 'win32' ? 'cmd' : 'sh';
      const cleanScript = process.platform === 'win32'
        ? 'cd android && .\\gradlew --stop'
        : 'cd android && ./gradlew --stop';
      const args = process.platform === 'win32' ? ['/c', cleanScript] : ['-c', cleanScript];

      const proc = spawn(cmd, args, {
        cwd: projectRoot,
        shell: false,
        env: { ...process.env, FORCE_COLOR: '0' }
      });

      buildProcess.process = proc;

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          output.push({ type: 'stdout', text, timestamp: Date.now() });
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          output.push({ type: 'stderr', text, timestamp: Date.now() });
        }
      });

      proc.on('close', (code) => {
        buildProcess.finished = true;
        if (code === 0) {
          output.push({ type: 'success', text: 'Cache cleaned successfully!', timestamp: Date.now() });
          output.push({ type: 'info', text: 'Run a build to regenerate native code.', timestamp: Date.now() });
        } else {
          // Gradle stop이 실패해도 디렉토리는 삭제됐으므로 성공으로 처리
          output.push({ type: 'success', text: 'Build directories cleaned. Gradle daemon may need manual stop.', timestamp: Date.now() });
        }
      });

      proc.on('error', (err) => {
        buildProcess.finished = true;
        output.push({ type: 'error', text: `Process error: ${err.message}`, timestamp: Date.now() });
      });

    } catch (err: any) {
      buildProcess.finished = true;
      output.push({ type: 'error', text: `Clean error: ${err.message}`, timestamp: Date.now() });
    }
  })();

  return buildProcess;
}

function startDeepCleanProcess(buildId: string): BuildProcess {
  const output: Array<{ type: string; text: string; timestamp: number }> = [];
  output.push({ type: 'info', text: 'Starting deep clean...', timestamp: Date.now() });

  const buildProcess: BuildProcess = {
    process: null as any,
    output,
    finished: false
  };

  (async () => {
    try {
      // 1. Gradle daemon 중지
      output.push({ type: 'info', text: 'Stopping Gradle daemon...', timestamp: Date.now() });
      try {
        await execAsync(
          process.platform === 'win32'
            ? 'cd android && .\\gradlew --stop'
            : 'cd android && ./gradlew --stop',
          { cwd: projectRoot, timeout: 30000 }
        );
        output.push({ type: 'stdout', text: 'Gradle daemon stopped', timestamp: Date.now() });
      } catch {
        output.push({ type: 'stdout', text: 'Gradle daemon stop skipped (may not be running)', timestamp: Date.now() });
      }

      // 2. android 폴더 삭제
      const androidDir = path.join(projectRoot, 'android');
      if (fsSync.existsSync(androidDir)) {
        output.push({ type: 'info', text: 'Removing android folder...', timestamp: Date.now() });
        await fs.rm(androidDir, { recursive: true, force: true });
        output.push({ type: 'stdout', text: 'android folder deleted', timestamp: Date.now() });
      }

      // 3. expo prebuild 실행
      output.push({ type: 'info', text: 'Running expo prebuild...', timestamp: Date.now() });

      const cmd = process.platform === 'win32' ? 'cmd' : 'sh';
      const prebuildScript = 'npx expo prebuild --platform android';
      const args = process.platform === 'win32' ? ['/c', prebuildScript] : ['-c', prebuildScript];

      const proc = spawn(cmd, args, {
        cwd: projectRoot,
        shell: false,
        env: { ...process.env, FORCE_COLOR: '0' }
      });

      buildProcess.process = proc;

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          output.push({ type: 'stdout', text, timestamp: Date.now() });
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          output.push({ type: 'stderr', text, timestamp: Date.now() });
        }
      });

      proc.on('close', async (code) => {
        if (code === 0) {
          // 4. local.properties 복원 (build-env.json에서)
          try {
            const buildEnv = await loadBuildEnv();
            if (buildEnv.android?.sdkPath) {
              await updateLocalProperties(buildEnv.android.sdkPath);
              output.push({ type: 'stdout', text: 'local.properties restored', timestamp: Date.now() });
            }
          } catch {
            output.push({ type: 'stderr', text: 'Warning: Could not restore local.properties', timestamp: Date.now() });
          }

          output.push({ type: 'success', text: 'Deep clean completed!', timestamp: Date.now() });
        } else {
          output.push({ type: 'error', text: `Prebuild failed with exit code ${code}`, timestamp: Date.now() });
        }
        buildProcess.finished = true;
      });

      proc.on('error', (err) => {
        buildProcess.finished = true;
        output.push({ type: 'error', text: `Process error: ${err.message}`, timestamp: Date.now() });
      });

    } catch (err: any) {
      buildProcess.finished = true;
      output.push({ type: 'error', text: `Deep clean error: ${err.message}`, timestamp: Date.now() });
    }
  })();

  return buildProcess;
}

export function apiPlugin(): Plugin {
  return {
    name: 'config-editor-api',
    configureServer(server: ViteDevServer) {
      // Puppeteer Preview WebSocket 서버 설정
      server.httpServer?.once('listening', () => {
        if (server.httpServer) {
          setupWebSocketServer(server.httpServer);
          console.log('[api-plugin] Puppeteer Preview WebSocket server initialized');
        }
      });

      // AppBridge Test Page - for debugging
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/preview-test') {
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

  ${getPreviewBridgeScript(proxyTargetOrigin || 'http://localhost')}

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
        log('✓ ReactNativeWebView exists');
      } else {
        addTest('ReactNativeWebView exists', 'fail');
        log('✗ ReactNativeWebView missing');
      }

      // Test 2: AppBridge exists
      if (window.AppBridge) {
        addTest('AppBridge exists', 'pass');
        log('✓ AppBridge exists');
      } else {
        addTest('AppBridge exists', 'fail');
        log('✗ AppBridge missing');
      }

      // Test 3: AppBridge.isApp()
      if (window.AppBridge && window.AppBridge.isApp()) {
        addTest('AppBridge.isApp()', 'pass', 'returns true');
        log('✓ AppBridge.isApp() = true');
      } else {
        addTest('AppBridge.isApp()', 'fail', 'returns false');
        log('✗ AppBridge.isApp() = false');
      }

      // Test 4: AppBridge.call()
      if (window.AppBridge && window.AppBridge.call) {
        addTest('AppBridge.call() - testing...', 'pending');
        log('Testing AppBridge.call()...');

        window.AppBridge.call('getSystemInfo').then(function(result) {
          log('✓ AppBridge.call() response: ' + JSON.stringify(result));
          // Update test status
          var tests = document.querySelectorAll('.test.pending');
          tests.forEach(function(t) {
            if (t.innerHTML.includes('AppBridge.call()')) {
              t.className = 'test pass';
              t.innerHTML = '<strong>AppBridge.call()</strong>: pass - ' + JSON.stringify(result);
            }
          });
        }).catch(function(err) {
          log('✗ AppBridge.call() error: ' + err.message);
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
        log('✗ AppBridge not available');
        return;
      }
      window.AppBridge.call(action).then(function(result) {
        log('✓ Response: ' + JSON.stringify(result));
      }).catch(function(err) {
        log('✗ Error: ' + err.message);
      });
    }
  </script>
</body>
</html>`;

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(testHtml);
      });

      // Preview reverse proxy middleware
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Only handle /preview/* routes
        if (!url.startsWith('/preview/') && url !== '/preview') {
          return next();
        }

        if (!proxyTargetUrl || !proxyTargetOrigin) {
          // 프록시 미설정 시 에러 페이지 반환 (자동 새로고침 없음)
          console.log('[Preview Proxy] No target configured, returning error page');
          res.statusCode = 503;
          res.setHeader('Content-Type', 'text/html');
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
    <div class="icon">⚠️</div>
    <div>Preview proxy not configured</div>
    <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">Check that baseUrl is set in app config</div>
  </div>
</body>
</html>`);
          return;
        }

        try {
          // Extract path after /preview
          const proxyPath = url.replace(/^\/preview\/?/, '/');
          const targetUrl = new URL(proxyPath, proxyTargetOrigin).href;

          console.log('[Preview Proxy]', req.method, url, '->', targetUrl);

          // Forward headers (except host)
          const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Accept': req.headers.accept || '*/*',
            'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity', // Don't accept compressed to allow modification
          };

          // Forward cookies if present
          if (req.headers.cookie) {
            headers['Cookie'] = req.headers.cookie;
          }

          if (req.headers.referer) {
            // Rewrite referer to target origin
            headers['Referer'] = proxyTargetOrigin;
          }

          // Forward Next.js RSC headers (critical for App Router)
          const nextHeaders = [
            'rsc',
            'next-router-state-tree',
            'next-router-prefetch',
            'next-router-segment-prefetch',
            'next-url'
          ];
          for (const h of nextHeaders) {
            const value = req.headers[h];
            if (value) {
              headers[h] = Array.isArray(value) ? value[0] : value;
              console.log('[Preview Proxy] Forwarding header:', h, '=', headers[h]);
            }
          }

          const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            redirect: 'follow' // Follow redirects automatically
          });

          // 응답 헤더 전체 로깅 (디버깅용)
          const respHeaders: Record<string, string> = {};
          response.headers.forEach((v, k) => { respHeaders[k] = v; });
          console.log('[Preview Proxy] Response:', response.status, JSON.stringify(respHeaders, null, 2));

          // Copy status
          res.statusCode = response.status;

          const contentType = response.headers.get('content-type') || 'application/octet-stream';
          res.setHeader('Content-Type', contentType);

          // Copy safe headers, strip security headers that block iframe/scripts
          const safeHeaders = ['content-language', 'cache-control', 'expires', 'last-modified', 'etag'];
          for (const header of safeHeaders) {
            const value = response.headers.get(header);
            if (value) res.setHeader(header, value);
          }

          // Set permissive headers for iframe preview
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');
          // Remove X-Frame-Options to allow iframe embedding
          // Don't set CSP - let the page work without restrictions

          // Get response body
          const body = await response.arrayBuffer();
          let content = Buffer.from(body);

          // Helper to rewrite URLs in content
          const originEscaped = proxyTargetOrigin!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const rewriteUrlsInText = (text: string): string => {
            // Full origin URLs
            text = text.replace(
              new RegExp(`(["'])(${originEscaped})(/[^"']*)(["'])`, 'g'),
              '$1/preview$3$4'
            );
            // Protocol-relative URLs for same host
            const hostPattern = proxyTargetOrigin!.replace(/^https?:/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            text = text.replace(
              new RegExp(`(["'])(${hostPattern})(/[^"']*)(["'])`, 'g'),
              '$1/preview$3$4'
            );
            return text;
          };

          // Process HTML responses
          if (contentType.includes('text/html')) {
            let html = content.toString('utf-8');
            console.log('[Preview Proxy] Processing HTML:', html.length, 'chars');

            // Remove existing CSP meta tags
            html = html.replace(/<meta[^>]*http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');

            // Inject bridge script and base tag at the beginning of <head>
            const bridgeScript = getPreviewBridgeScript(proxyTargetOrigin!);
            const baseTag = `<base href="/preview/">`;
            const headMatch = html.match(/<head[^>]*>/i);
            if (headMatch && headMatch.index !== undefined) {
              const insertPos = headMatch.index + headMatch[0].length;
              html = html.slice(0, insertPos) + baseTag + bridgeScript + html.slice(insertPos);
            } else {
              html = baseTag + bridgeScript + html;
            }

            // Rewrite URLs in HTML attributes
            // 1. Full origin URLs
            html = html.replace(
              new RegExp(`(href|src|action|srcset)=["'](${originEscaped})(/[^"']*)["']`, 'gi'),
              '$1="/preview$3"'
            );
            // 2. Root-relative URLs (starting with /) - but not //protocol URLs
            html = html.replace(
              /(href|src|action)=["'](?!\/\/)(\/[^"']*?)["']/gi,
              '$1="/preview$2"'
            );
            // 3. srcset with root-relative URLs
            html = html.replace(
              /srcset=["']([^"']+)["']/gi,
              (match, srcset) => {
                const rewritten = srcset.replace(/(?:^|,\s*)(\/[^\s,]+)/g, (m: string, path: string) => {
                  return m.replace(path, '/preview' + path);
                });
                return `srcset="${rewritten}"`;
              }
            );

            // 4. Next.js __NEXT_DATA__ 스크립트 수정 (URL 경로 정보)
            // /preview를 제거하여 Next.js 라우터가 올바른 경로로 인식하도록
            html = html.replace(
              /(<script\s+id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/gi,
              (match, openTag, jsonContent, closeTag) => {
                try {
                  // JSON 파싱 후 URL 관련 필드 수정
                  const data = JSON.parse(jsonContent);

                  // page 필드 수정
                  if (data.page && data.page.startsWith('/preview')) {
                    data.page = data.page.replace(/^\/preview/, '') || '/';
                  }

                  // query에서 경로 관련 정보 수정
                  if (data.query) {
                    for (const key of Object.keys(data.query)) {
                      if (typeof data.query[key] === 'string' && data.query[key].startsWith('/preview')) {
                        data.query[key] = data.query[key].replace(/^\/preview/, '') || '/';
                      }
                    }
                  }

                  // buildId는 그대로 유지
                  // assetPrefix 처리
                  if (data.assetPrefix && data.assetPrefix.startsWith('/preview')) {
                    data.assetPrefix = data.assetPrefix.replace(/^\/preview/, '');
                  }

                  console.log('[Preview Proxy] Modified __NEXT_DATA__ page:', data.page);
                  return openTag + JSON.stringify(data) + closeTag;
                } catch (e) {
                  console.warn('[Preview Proxy] Failed to parse __NEXT_DATA__:', e);
                  return match;
                }
              }
            );

            content = Buffer.from(html, 'utf-8');
          }
          // RSC 응답은 수정하지 않음 (text/x-component 또는 RSC 헤더가 있는 경우)
          else if (contentType.includes('text/x-component') || req.headers['rsc']) {
            console.log('[Preview Proxy] RSC response - not modifying');
            // RSC 응답은 그대로 전달
          }
          // Process JavaScript responses
          else if (contentType.includes('javascript') || contentType.includes('application/json')) {
            let js = content.toString('utf-8');

            // Rewrite URLs in JS/JSON strings
            js = rewriteUrlsInText(js);

            // Also rewrite root-relative paths that look like resource URLs
            // Be careful not to break code - only rewrite obvious URL patterns
            js = js.replace(
              /["'](\/(?:_next|static|assets|api|images|fonts|css|js)\/[^"']+)["']/g,
              '"/preview$1"'
            );

            content = Buffer.from(js, 'utf-8');
          }
          // Process CSS responses
          else if (contentType.includes('text/css')) {
            let css = content.toString('utf-8');

            // Rewrite url() references
            css = css.replace(
              /url\(["']?(\/[^)"']+)["']?\)/gi,
              'url("/preview$1")'
            );
            // Rewrite full origin URLs
            css = rewriteUrlsInText(css);

            content = Buffer.from(css, 'utf-8');
          }

          // Update Content-Length after modifications
          res.setHeader('Content-Length', content.length);

          res.end(content);
        } catch (error: any) {
          console.error('[Preview Proxy] Error:', error.message);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Proxy error: ' + error.message);
        }
      });

      // API routes middleware
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Only handle /api routes
        if (!url.startsWith('/api/')) {
          return next();
        }

        try {
          // GET /api/config/:type
          const configGetMatch = url.match(/^\/api\/config\/(app|theme|plugins|build-env)$/);
          if (configGetMatch && req.method === 'GET') {
            const type = configGetMatch[1];
            const filename = CONFIG_FILES[type];
            const filePath = path.join(constantsDir, filename);

            try {
              const content = await fs.readFile(filePath, 'utf-8');
              sendJson(res, 200, JSON.parse(content));
            } catch {
              sendJson(res, 500, { error: `Failed to read ${filename}` });
            }
            return;
          }

          // GET /api/config/expo - Expo app.json (프로젝트 루트)
          if (url === '/api/config/expo' && req.method === 'GET') {
            const filePath = path.join(projectRoot, 'app.json');
            try {
              const content = await fs.readFile(filePath, 'utf-8');
              sendJson(res, 200, JSON.parse(content));
            } catch {
              sendJson(res, 500, { error: 'Failed to read app.json' });
            }
            return;
          }

          // PUT /api/config/expo - Expo app.json (프로젝트 루트)
          if (url === '/api/config/expo' && req.method === 'PUT') {
            const filePath = path.join(projectRoot, 'app.json');
            const body = await readBody(req);

            if (!body || typeof body !== 'object' || Array.isArray(body)) {
              sendJson(res, 400, { error: 'Request body must be a valid JSON object' });
              return;
            }

            try {
              const content = JSON.stringify(body, null, 2) + '\n';
              await fs.writeFile(filePath, content, 'utf-8');
              sendJson(res, 200, { success: true, data: body });
            } catch {
              sendJson(res, 500, { error: 'Failed to write app.json' });
            }
            return;
          }

          // PUT /api/config/:type
          if (configGetMatch && req.method === 'PUT') {
            const type = configGetMatch[1];
            const filename = CONFIG_FILES[type];
            const filePath = path.join(constantsDir, filename);
            const body = await readBody(req);

            if (!body || typeof body !== 'object' || Array.isArray(body)) {
              sendJson(res, 400, { error: 'Request body must be a valid JSON object' });
              return;
            }

            // plugins 저장 시 네임스페이스 충돌 검사
            if (type === 'plugins') {
              const validation = validatePluginNamespaces(body);
              if (!validation.valid) {
                sendJson(res, 400, {
                  error: 'Namespace conflict detected',
                  conflicts: validation.conflicts
                });
                return;
              }
            }

            try {
              // build-env 저장 시 SDK 경로 자동 수정
              if (type === 'build-env' && body.android?.sdkPath) {
                const originalPath = body.android.sdkPath;
                const pathValidation = validateSdkPath(originalPath);

                if (!pathValidation.valid) {
                  // 잘못된 경로 자동 수정
                  const correctedPath = inferSdkRoot(originalPath);
                  body.android.sdkPath = correctedPath;
                  console.log(`[api-plugin] SDK path auto-corrected: ${originalPath} -> ${correctedPath}`);
                }
              }

              const content = JSON.stringify(body, null, 2) + '\n';
              await fs.writeFile(filePath, content, 'utf-8');

              if (type === 'plugins') {
                await regeneratePluginRegistry();
              }

              // build-env 저장 시 local.properties도 업데이트
              if (type === 'build-env' && body.android?.sdkPath) {
                try {
                  await updateLocalProperties(body.android.sdkPath);
                } catch (e) {
                  console.log('[api-plugin] Could not update local.properties:', e);
                }
              }

              // 경로가 수정된 경우 수정된 데이터 반환
              sendJson(res, 200, { success: true, data: body });
            } catch {
              sendJson(res, 500, { error: `Failed to write ${filename}` });
            }
            return;
          }

          // GET /api/plugins/installed
          if (url === '/api/plugins/installed' && req.method === 'GET') {
            console.log('[api-plugin] Fetching installed packages...');
            const packages = await getInstalledPackages();
            console.log('[api-plugin] Found', packages.length, 'installed packages');
            // rnww-plugin-* 만 필터링
            const rnwwPlugins = packages.filter(p => p.name.startsWith('rnww-plugin-'));
            console.log('[api-plugin] RNWW plugins:', rnwwPlugins.map(p => p.name));
            const sorted = packages.sort((a, b) => {
              const aIsRnww = a.name.startsWith('rnww-plugin-');
              const bIsRnww = b.name.startsWith('rnww-plugin-');
              if (aIsRnww && !bIsRnww) return -1;
              if (!aIsRnww && bIsRnww) return 1;
              return a.name.localeCompare(b.name);
            });
            sendJson(res, 200, sorted);
            return;
          }

          // GET /api/plugins/search?q=query
          if (url.startsWith('/api/plugins/search') && req.method === 'GET') {
            console.log('[api-plugin] Search request URL:', url);
            const urlObj = new URL(url, 'http://localhost');
            const query = urlObj.searchParams.get('q') || 'rnww-plugin';
            console.log('[api-plugin] Parsed query:', query);

            if (!isValidSearchQuery(query)) {
              console.log('[api-plugin] Query validation failed');
              sendJson(res, 400, { error: 'Invalid search query' });
              return;
            }

            const results = await searchNpmPackages(query);
            console.log('[api-plugin] Returning', results.length, 'results');
            sendJson(res, 200, results);
            return;
          }

          // POST /api/plugins/install
          if (url === '/api/plugins/install' && req.method === 'POST') {
            const { name, version } = await readBody(req);

            if (!name || !isValidPackageName(name)) {
              sendJson(res, 400, { error: 'Invalid package name' });
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

          // POST /api/plugins/uninstall
          if (url === '/api/plugins/uninstall' && req.method === 'POST') {
            const { name } = await readBody(req);

            if (!name || !isValidPackageName(name)) {
              sendJson(res, 400, { error: 'Invalid package name' });
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

          // GET /api/plugins/scan
          if (url === '/api/plugins/scan' && req.method === 'GET') {
            try {
              const entries = await fs.readdir(bridgesDir, { withFileTypes: true });
              const folders = entries
                .filter(entry => entry.isDirectory())
                .map(entry => `./${entry.name}`);
              sendJson(res, 200, folders);
            } catch {
              sendJson(res, 500, { error: 'Failed to scan bridges folder' });
            }
            return;
          }

          // POST /api/plugins/validate - 네임스페이스 충돌 검사
          if (url === '/api/plugins/validate' && req.method === 'POST') {
            const body = await readBody(req);
            const validation = validatePluginNamespaces(body);
            sendJson(res, 200, validation);
            return;
          }

          // ========== Build API ==========

          // GET /api/build/env-check - Environment verification
          if (url === '/api/build/env-check' && req.method === 'GET') {
            const checks = await checkBuildEnvironment();
            sendJson(res, 200, { checks });
            return;
          }

          // POST /api/build/accept-licenses - Accept SDK licenses
          if (url === '/api/build/accept-licenses' && req.method === 'POST') {
            try {
              const buildEnv = await loadBuildEnv();
              const sdkPath = buildEnv.android?.sdkPath;
              const result = await acceptSdkLicenses(sdkPath);

              if (result.success) {
                sendJson(res, 200, { success: true, message: result.message });
              } else {
                sendJson(res, 500, { error: result.message });
              }
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // POST /api/build/start - Start build
          if (url === '/api/build/start' && req.method === 'POST') {
            const { type, profile } = await readBody(req);
            const buildId = `build-${Date.now()}`;

            try {
              const buildProcess = startBuildProcess(type, profile, buildId);
              buildProcesses.set(buildId, buildProcess);
              sendJson(res, 200, { buildId });
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // GET /api/build/output/:id - Get build output
          const outputMatch = url.match(/^\/api\/build\/output\/([a-z0-9-]+)$/);
          if (outputMatch && req.method === 'GET') {
            const buildId = outputMatch[1];
            const build = buildProcesses.get(buildId);

            if (!build) {
              sendJson(res, 404, { error: 'Build not found' });
              return;
            }

            // Get new lines since last fetch
            const lines = build.output.splice(0, build.output.length);
            sendJson(res, 200, { lines, finished: build.finished });

            // Clean up finished builds after some time
            if (build.finished) {
              setTimeout(() => buildProcesses.delete(buildId), 60000);
            }
            return;
          }

          // POST /api/build/cancel/:id - Cancel build
          const cancelMatch = url.match(/^\/api\/build\/cancel\/([a-z0-9-]+)$/);
          if (cancelMatch && req.method === 'POST') {
            const buildId = cancelMatch[1];
            const build = buildProcesses.get(buildId);

            if (build && !build.finished) {
              build.process.kill();
              build.finished = true;
              build.output.push({ type: 'info', text: 'Build cancelled by user', timestamp: Date.now() });
            }
            sendJson(res, 200, { success: true });
            return;
          }

          // POST /api/build/clean - Clean Gradle cache
          if (url === '/api/build/clean' && req.method === 'POST') {
            const buildId = `clean-${Date.now()}`;

            try {
              const buildProcess = startCleanProcess(buildId);
              buildProcesses.set(buildId, buildProcess);
              sendJson(res, 200, { buildId });
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // POST /api/build/deep-clean - Delete android folder and run prebuild
          if (url === '/api/build/deep-clean' && req.method === 'POST') {
            const buildId = `deepclean-${Date.now()}`;

            try {
              const buildProcess = startDeepCleanProcess(buildId);
              buildProcesses.set(buildId, buildProcess);
              sendJson(res, 200, { buildId });
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // GET /api/build/keystore - Check keystore status
          if (url === '/api/build/keystore' && req.method === 'GET') {
            const keystorePaths = [
              path.join(projectRoot, 'android', 'app', 'release.keystore'),
              path.join(projectRoot, 'android', 'app', 'my-release-key.keystore'),
              path.join(projectRoot, 'android', 'keystores', 'release.keystore')
            ];

            let foundPath: string | null = null;
            for (const p of keystorePaths) {
              if (fsSync.existsSync(p)) {
                foundPath = p;
                break;
              }
            }

            // Check gradle.properties for signing config
            let hasSigningConfig = false;
            const gradlePropsPath = path.join(projectRoot, 'android', 'gradle.properties');
            if (fsSync.existsSync(gradlePropsPath)) {
              const content = fsSync.readFileSync(gradlePropsPath, 'utf-8');
              hasSigningConfig = content.includes('MYAPP_RELEASE_STORE_PASSWORD');
            }

            sendJson(res, 200, {
              exists: !!foundPath,
              path: foundPath,
              hasSigningConfig
            });
            return;
          }

          // POST /api/build/open-folder - Open folder in file explorer
          if (url === '/api/build/open-folder' && req.method === 'POST') {
            const { filePath } = await readBody(req);

            if (!filePath) {
              sendJson(res, 400, { error: 'filePath is required' });
              return;
            }

            // 상대 경로를 절대 경로로 변환
            const absolutePath = path.isAbsolute(filePath)
              ? filePath
              : path.join(projectRoot, filePath);

            // 파일이면 상위 폴더, 폴더면 그대로
            let folderPath = absolutePath;
            if (fsSync.existsSync(absolutePath) && fsSync.statSync(absolutePath).isFile()) {
              folderPath = path.dirname(absolutePath);
            }

            if (!fsSync.existsSync(folderPath)) {
              sendJson(res, 404, { error: 'Folder not found' });
              return;
            }

            try {
              // 플랫폼별 파일 탐색기 열기
              const cmd = process.platform === 'win32'
                ? `explorer "${folderPath}"`
                : process.platform === 'darwin'
                ? `open "${folderPath}"`
                : `xdg-open "${folderPath}"`;

              await execAsync(cmd);
              sendJson(res, 200, { success: true });
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // GET /api/build/download - Download build output file
          if (url.startsWith('/api/build/download') && req.method === 'GET') {
            const urlObj = new URL(url, 'http://localhost');
            const filePath = urlObj.searchParams.get('path');

            if (!filePath) {
              sendJson(res, 400, { error: 'path parameter is required' });
              return;
            }

            // 상대 경로를 절대 경로로 변환
            const absolutePath = path.isAbsolute(filePath)
              ? filePath
              : path.join(projectRoot, filePath);

            // 보안: projectRoot 내부인지 확인
            const normalizedPath = path.normalize(absolutePath);
            if (!normalizedPath.startsWith(projectRoot)) {
              sendJson(res, 403, { error: 'Access denied' });
              return;
            }

            if (!fsSync.existsSync(absolutePath)) {
              sendJson(res, 404, { error: 'File not found' });
              return;
            }

            const stat = fsSync.statSync(absolutePath);
            const filename = path.basename(absolutePath);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', stat.size);

            const stream = fsSync.createReadStream(absolutePath);
            stream.pipe(res);
            return;
          }

          // GET /api/build/output-info - Get info about build output files
          if (url === '/api/build/output-info' && req.method === 'GET') {
            const outputs: Array<{ type: string; path: string; exists: boolean; size?: number; modified?: number }> = [];

            const outputPaths = [
              { type: 'Debug APK', path: 'android/app/build/outputs/apk/debug/app-debug.apk' },
              { type: 'Release APK', path: 'android/app/build/outputs/apk/release/app-release.apk' },
              { type: 'Release AAB', path: 'android/app/build/outputs/bundle/release/app-release.aab' }
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

          // POST /api/build/keystore - Generate keystore
          if (url === '/api/build/keystore' && req.method === 'POST') {
            const { alias, storePassword, keyPassword, validity, dname } = await readBody(req);

            // Validate
            if (!alias || !storePassword || storePassword.length < 6) {
              sendJson(res, 400, { error: 'Invalid parameters. Alias required, password must be at least 6 characters.' });
              return;
            }

            const androidAppDir = path.join(projectRoot, 'android', 'app');
            if (!fsSync.existsSync(androidAppDir)) {
              sendJson(res, 400, { error: 'android/app folder not found. Run expo prebuild first.' });
              return;
            }

            const keystorePath = path.join(androidAppDir, 'release.keystore');
            const finalKeyPassword = keyPassword || storePassword;
            const finalValidity = validity || 10000;
            const finalDname = dname || 'CN=Unknown, OU=Unknown, O=Unknown, L=Unknown, ST=Unknown, C=US';

            try {
              // Generate keystore using keytool
              const keytoolCmd = `keytool -genkey -v -keystore "${keystorePath}" -alias "${alias}" -keyalg RSA -keysize 2048 -validity ${finalValidity} -storepass "${storePassword}" -keypass "${finalKeyPassword}" -dname "${finalDname}"`;

              await execAsync(keytoolCmd, { cwd: projectRoot, timeout: 30000 });

              // Update gradle.properties
              const gradlePropsPath = path.join(projectRoot, 'android', 'gradle.properties');
              let gradleProps = '';
              if (fsSync.existsSync(gradlePropsPath)) {
                gradleProps = fsSync.readFileSync(gradlePropsPath, 'utf-8');
                // Remove existing MYAPP_RELEASE settings
                gradleProps = gradleProps.split('\n')
                  .filter(line => !line.startsWith('MYAPP_RELEASE_'))
                  .join('\n');
              }

              // Add new settings
              const signingConfig = `
# Release Keystore settings (auto-generated)
MYAPP_RELEASE_STORE_FILE=release.keystore
MYAPP_RELEASE_KEY_ALIAS=${alias}
MYAPP_RELEASE_STORE_PASSWORD=${storePassword}
MYAPP_RELEASE_KEY_PASSWORD=${finalKeyPassword}
`;
              gradleProps = gradleProps.trimEnd() + '\n' + signingConfig;
              fsSync.writeFileSync(gradlePropsPath, gradleProps, 'utf-8');

              sendJson(res, 200, {
                success: true,
                path: keystorePath,
                message: 'Keystore created and gradle.properties updated'
              });
            } catch (error: any) {
              sendJson(res, 500, { error: `Keystore generation failed: ${error.message}` });
            }
            return;
          }

          // GET /api/proxy/config - Get current proxy target URL
          if (url === '/api/proxy/config' && req.method === 'GET') {
            sendJson(res, 200, { targetUrl: proxyTargetUrl });
            return;
          }

          // GET /api/proxy/diagnose - Diagnose proxy issues
          if (url === '/api/proxy/diagnose' && req.method === 'GET') {
            if (!proxyTargetUrl || !proxyTargetOrigin) {
              sendJson(res, 200, {
                status: 'not_configured',
                message: 'Proxy target URL not set'
              });
              return;
            }

            try {
              console.log('[Diagnose] Testing connection to:', proxyTargetUrl);
              const testResponse = await fetch(proxyTargetUrl, {
                method: 'GET',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
                  'Accept': 'text/html',
                  'Accept-Encoding': 'identity'
                },
                redirect: 'follow'
              });

              const headers: Record<string, string> = {};
              testResponse.headers.forEach((v, k) => { headers[k] = v; });

              const body = await testResponse.text();
              const bodyPreview = body.slice(0, 500);

              // 문제 분석
              const issues: string[] = [];

              if (headers['content-security-policy']) {
                issues.push('CSP header present - may block scripts');
              }
              if (headers['x-frame-options']) {
                issues.push('X-Frame-Options present - may block iframe');
              }
              if (!body.includes('<html') && !body.includes('<HTML')) {
                issues.push('Response may not be HTML');
              }
              if (body.includes('<!DOCTYPE html>') && body.length < 1000) {
                issues.push('Very short HTML - might be error page or redirect');
              }

              sendJson(res, 200, {
                status: 'ok',
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
            } catch (error: any) {
              sendJson(res, 200, {
                status: 'error',
                targetUrl: proxyTargetUrl,
                error: error.message
              });
            }
            return;
          }

          // POST /api/proxy/config - Set proxy target URL
          if (url === '/api/proxy/config' && req.method === 'POST') {
            const { targetUrl } = await readBody(req);
            console.log('[api-plugin] Proxy config request:', targetUrl);
            if (targetUrl) {
              try {
                const parsed = new URL(targetUrl);
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                  sendJson(res, 400, { error: 'Only http/https URLs allowed' });
                  return;
                }
                proxyTargetUrl = targetUrl;
                proxyTargetOrigin = parsed.origin;
                console.log('[api-plugin] ✓ Proxy configured:', proxyTargetUrl, '(origin:', proxyTargetOrigin, ')');
                sendJson(res, 200, { success: true, targetUrl: proxyTargetUrl });
              } catch {
                sendJson(res, 400, { error: 'Invalid URL' });
              }
            } else {
              proxyTargetUrl = null;
              proxyTargetOrigin = null;
              console.log('[api-plugin] Proxy cleared');
              sendJson(res, 200, { success: true, targetUrl: null });
            }
            return;
          }

          // ========== ADB API ==========

          // GET /api/adb/check - ADB 환경 확인
          if (url === '/api/adb/check' && req.method === 'GET') {
            try {
              const { stdout } = await execAsync('adb version', { timeout: 5000 });
              const versionMatch = stdout.match(/Android Debug Bridge version ([\d.]+)/);
              sendJson(res, 200, {
                adbAvailable: true,
                adbVersion: versionMatch ? versionMatch[1] : 'unknown'
              });
            } catch (error: any) {
              sendJson(res, 200, {
                adbAvailable: false,
                error: error.message || 'ADB not found'
              });
            }
            return;
          }

          // GET /api/adb/devices - 연결된 디바이스 목록
          if (url === '/api/adb/devices' && req.method === 'GET') {
            try {
              const { stdout } = await execAsync('adb devices -l', { timeout: 10000 });
              const lines = stdout.split('\n').filter(l => l.trim() && !l.startsWith('List of'));
              const devices = lines.map(line => {
                const parts = line.trim().split(/\s+/);
                const id = parts[0];
                const status = parts[1] as 'device' | 'offline' | 'unauthorized' | 'no permissions';
                const isWireless = id.includes(':');

                // 추가 정보 파싱
                const info: Record<string, string> = {};
                for (let i = 2; i < parts.length; i++) {
                  const [key, value] = parts[i].split(':');
                  if (key && value) {
                    info[key] = value;
                  }
                }

                return {
                  id,
                  status,
                  isWireless,
                  model: info['model'],
                  product: info['product'],
                  device: info['device']
                };
              }).filter(d => d.id);

              sendJson(res, 200, { devices });
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // POST /api/adb/pair - 무선 디버깅 페어링
          if (url === '/api/adb/pair' && req.method === 'POST') {
            const { address, code } = await readBody(req);

            if (!address) {
              sendJson(res, 400, { error: 'Address is required' });
              return;
            }

            try {
              // adb pair는 stdin으로 코드를 받으므로 spawn 사용
              const pairProcess = spawn('adb', ['pair', address], {
                stdio: ['pipe', 'pipe', 'pipe']
              });

              let stdout = '';
              let stderr = '';

              pairProcess.stdout.on('data', (data) => { stdout += data.toString(); });
              pairProcess.stderr.on('data', (data) => { stderr += data.toString(); });

              // 페어링 코드 입력 (프롬프트 대기 후)
              if (code) {
                setTimeout(() => {
                  pairProcess.stdin.write(code + '\n');
                  pairProcess.stdin.end();
                }, 500);
              }

              const exitCode = await new Promise<number>((resolve) => {
                pairProcess.on('close', resolve);
                // 타임아웃
                setTimeout(() => {
                  pairProcess.kill();
                  resolve(-1);
                }, 30000);
              });

              const output = stdout + stderr;
              if (exitCode === 0 || output.toLowerCase().includes('success')) {
                sendJson(res, 200, { success: true });
              } else {
                sendJson(res, 200, { success: false, error: output.trim() || 'Pairing failed' });
              }
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // POST /api/adb/connect - 무선 디버깅 연결
          if (url === '/api/adb/connect' && req.method === 'POST') {
            const { address } = await readBody(req);

            if (!address) {
              sendJson(res, 400, { error: 'Address is required' });
              return;
            }

            try {
              const { stdout, stderr } = await execAsync(`adb connect ${address}`, { timeout: 15000 });
              const output = stdout + stderr;

              if (output.includes('connected') && !output.includes('cannot')) {
                // 디바이스 모델 가져오기
                let device = address;
                try {
                  const { stdout: modelOut } = await execAsync(`adb -s ${address} shell getprop ro.product.model`, { timeout: 5000 });
                  device = modelOut.trim() || address;
                } catch { /* ignore */ }

                sendJson(res, 200, { success: true, device });
              } else {
                sendJson(res, 200, { success: false, error: output.trim() || 'Connection failed' });
              }
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // POST /api/adb/disconnect - 무선 디버깅 연결 해제
          if (url === '/api/adb/disconnect' && req.method === 'POST') {
            const { address } = await readBody(req);

            try {
              const cmd = address ? `adb disconnect ${address}` : 'adb disconnect';
              await execAsync(cmd, { timeout: 10000 });
              sendJson(res, 200, { success: true });
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // POST /api/adb/tcpip - USB를 통한 무선 디버깅 활성화
          if (url === '/api/adb/tcpip' && req.method === 'POST') {
            const { port = '5555' } = await readBody(req);

            try {
              // USB 디바이스 확인
              const { stdout: devicesOut } = await execAsync('adb devices', { timeout: 5000 });
              const usbDevices = devicesOut.split('\n')
                .filter(l => l.includes('device') && !l.includes(':') && !l.startsWith('List'));

              if (usbDevices.length === 0) {
                sendJson(res, 200, { success: false, error: 'No USB device connected' });
                return;
              }

              // 디바이스 IP 가져오기
              const { stdout: ipOut } = await execAsync('adb shell ip route', { timeout: 5000 });
              const ipMatch = ipOut.match(/wlan.*src\s+(\d+\.\d+\.\d+\.\d+)/);
              let deviceIp = '';
              if (ipMatch) {
                deviceIp = ipMatch[1];
              } else {
                // 대체 방법
                const { stdout: ipOut2 } = await execAsync('adb shell "ip addr show wlan0 | grep inet"', { timeout: 5000 });
                const ipMatch2 = ipOut2.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
                if (ipMatch2) {
                  deviceIp = ipMatch2[1];
                }
              }

              if (!deviceIp) {
                sendJson(res, 200, { success: false, error: 'Cannot find device WiFi IP' });
                return;
              }

              // TCP/IP 모드 활성화
              await execAsync(`adb tcpip ${port}`, { timeout: 10000 });

              // 잠시 대기 후 연결
              await new Promise(r => setTimeout(r, 2000));

              const address = `${deviceIp}:${port}`;
              const { stdout: connectOut } = await execAsync(`adb connect ${address}`, { timeout: 10000 });

              if (connectOut.includes('connected')) {
                sendJson(res, 200, { success: true, address });
              } else {
                sendJson(res, 200, { success: false, error: connectOut.trim() || 'Connection failed', address });
              }
            } catch (error: any) {
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // GET /api/adb/logcat - 디바이스 로그 스트리밍 (세션 재사용)
          if (url.startsWith('/api/adb/logcat') && req.method === 'GET') {
            const urlObj = new URL(url, 'http://localhost');
            const device = urlObj.searchParams.get('device');
            const logType = urlObj.searchParams.get('type') || 'native';

            if (!device) {
              sendJson(res, 400, { error: 'device parameter is required' });
              return;
            }

            const sessionKey = getLogcatSessionKey(device, logType);

            // 스트리밍 응답 설정
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Transfer-Encoding', 'chunked');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Content-Type-Options', 'nosniff');

            // 기존 세션이 있으면 재사용
            let session = logcatSessions.get(sessionKey);
            if (session) {
              console.log(`[Logcat] Reusing existing session: ${sessionKey}`);
              cancelLogcatCleanup(sessionKey);
              session.clients.add(res);

              // 클라이언트 연결 해제 처리
              const removeClient = () => {
                session?.clients.delete(res);
                if (session?.clients.size === 0) {
                  scheduleLogcatCleanup(sessionKey);
                }
              };
              req.on('close', removeClient);
              req.on('aborted', removeClient);
              return;
            }

            // 로그 필터 설정
            // WebView console.log는 다양한 태그로 출력됨:
            // - chromium: 대부분의 WebView console 메시지 (I/chromium: [INFO:CONSOLE...])
            // - Console: 일부 기기에서 사용
            // - WebViewConsole: react-native-webview 특정
            // 참고: webviewDebuggingEnabled={true} 필요
            let filter = '';
            switch (logType) {
              case 'native':
                filter = 'ReactNative:V ReactNativeJS:V expo:V ExpoModulesCore:V *:S';
                break;
              case 'webview':
                // chromium 태그만 필터 (CONSOLE 메시지 포함)
                filter = 'chromium:I *:S';
                break;
              case 'all':
                filter = 'ReactNative:V ReactNativeJS:V expo:V ExpoModulesCore:V chromium:I *:S';
                break;
            }

            try {
              // 로그 버퍼 클리어
              await execAsync(`adb -s ${device} logcat -c`, { timeout: 5000 }).catch(() => {});

              // Windows에서는 shell 옵션 필요
              const isWindows = process.platform === 'win32';
              const cmd = `adb -s ${device} logcat -v time ${filter}`;

              console.log('[Logcat] Starting new session:', sessionKey);

              const logcatProcess = isWindows
                ? spawn('cmd', ['/c', cmd], { stdio: ['ignore', 'pipe', 'pipe'] })
                : spawn('adb', ['-s', device, 'logcat', '-v', 'time', ...filter.split(' ')], { stdio: ['ignore', 'pipe', 'pipe'] });

              // 새 세션 생성
              session = {
                process: logcatProcess,
                device,
                logType,
                clients: new Set([res]),
                cleanupTimer: null
              };
              logcatSessions.set(sessionKey, session);

              logcatProcess.stdout.on('data', (data) => {
                const currentSession = logcatSessions.get(sessionKey);
                if (!currentSession) return;

                // 모든 클라이언트에 데이터 전송
                currentSession.clients.forEach(client => {
                  if (!client.writableEnded) {
                    client.write(data);
                  }
                });
              });

              logcatProcess.stderr.on('data', (data) => {
                const currentSession = logcatSessions.get(sessionKey);
                if (!currentSession) return;

                currentSession.clients.forEach(client => {
                  if (!client.writableEnded) {
                    client.write(data);
                  }
                });
              });

              logcatProcess.on('error', (err) => {
                console.error('[Logcat] Process error:', err);
                cleanupLogcatSession(sessionKey);
              });

              logcatProcess.on('close', (code) => {
                console.log(`[Logcat] Process closed with code: ${code}`);
                const currentSession = logcatSessions.get(sessionKey);
                if (currentSession) {
                  currentSession.clients.forEach(client => {
                    if (!client.writableEnded) {
                      client.end();
                    }
                  });
                  logcatSessions.delete(sessionKey);
                }
              });

              // 클라이언트 연결 해제 처리
              const removeClient = () => {
                const currentSession = logcatSessions.get(sessionKey);
                if (currentSession) {
                  currentSession.clients.delete(res);
                  if (currentSession.clients.size === 0) {
                    scheduleLogcatCleanup(sessionKey);
                  }
                }
              };
              req.on('close', removeClient);
              req.on('aborted', removeClient);

            } catch (error: any) {
              console.error('[Logcat] Error:', error);
              sendJson(res, 500, { error: error.message });
            }
            return;
          }

          // Not found
          sendJson(res, 404, { error: 'Not found' });

        } catch (error) {
          console.error('API error:', error);
          sendJson(res, 500, { error: 'Internal server error' });
        }
      });
    }
  };
}
