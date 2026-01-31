// tools/config-editor/client/vite/puppeteer-preview.ts
// Puppeteer 기반 실시간 preview 시스템

import puppeteer, { Browser, Page, CDPSession } from 'puppeteer';
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

// AppBridge 스크립트 생성 (실제 bridge-client.ts와 동일)
function getAppBridgeScript(): string {
  return `
(function() {
  'use strict';

  // beforeunload 무력화
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

  // Mock 응답
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

interface PreviewSession {
  browser: Browser;
  page: Page;
  cdp: CDPSession;
  clients: Set<WebSocket>;
  url: string;
  viewportWidth: number;
  viewportHeight: number;
  isStreaming: boolean;
}

let session: PreviewSession | null = null;
let wss: WebSocketServer | null = null;

// 마우스 버튼 상태 추적 (눌린 버튼들)
const pressedMouseButtons = new Set<'left' | 'right' | 'middle'>();

// Preview 세션 시작
export async function startPreview(url: string, width = 360, height = 640): Promise<void> {
  console.log('[Puppeteer Preview] Starting preview for:', url);

  // 기존 세션이 있고 같은 URL이면 재사용
  if (session && session.url === url) {
    console.log('[Puppeteer Preview] Reusing existing session');
    // 뷰포트 크기가 다르면 조정
    if (session.viewportWidth !== width || session.viewportHeight !== height) {
      await resizePreview(width, height);
    }
    return;
  }

  // 기존 세션 정리 (클라이언트는 보존)
  let preservedClients = new Set<WebSocket>();
  if (session) {
    preservedClients = await stopPreview(true);
  }

  try {
    // 브라우저 시작
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        `--window-size=${width},${height}`
      ]
    });

    const page = await browser.newPage();

    // 모바일 User-Agent 설정
    await page.setUserAgent(
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    );

    // 뷰포트 설정
    await page.setViewport({
      width,
      height,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });

    // AppBridge 스크립트 주입 (페이지 로드 전)
    await page.evaluateOnNewDocument(getAppBridgeScript());

    // CDP 세션 생성
    const cdp = await page.createCDPSession();

    session = {
      browser,
      page,
      cdp,
      clients: preservedClients,  // 보존된 클라이언트 연결
      url,
      viewportWidth: width,
      viewportHeight: height,
      isStreaming: false
    };

    // 페이지 로드
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('[Puppeteer Preview] Page loaded successfully');

    // Screencast 시작
    await startScreencast();

  } catch (error) {
    console.error('[Puppeteer Preview] Failed to start:', error);
    if (session) {
      await stopPreview();
    }
    // 실패 시 보존된 클라이언트에게 에러 전송
    preservedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'error', message: String(error) }));
      }
    });
    throw error;
  }
}

// CDP 이벤트 핸들러 등록 여부
let screencastHandlerRegistered = false;

// Screencast 시작
async function startScreencast(): Promise<void> {
  if (!session) return;

  // 이미 스트리밍 중이면 스킵
  if (session.isStreaming) {
    console.log('[Puppeteer Preview] Screencast already running');
    return;
  }

  session.isStreaming = true;

  // CDP 이벤트 핸들러 (한 번만 등록)
  if (!screencastHandlerRegistered) {
    screencastHandlerRegistered = true;
    let frameCount = 0;
    session.cdp.on('Page.screencastFrame', async (params) => {
      if (!session) return;

      const { data, sessionId } = params;
      frameCount++;

      // 프레임 ACK
      try {
        await session.cdp.send('Page.screencastFrameAck', { sessionId });
      } catch (e) {
        // 무시 (세션 종료됨)
        return;
      }

      // 첫 프레임 로그
      if (frameCount === 1) {
        console.log(`[Puppeteer Preview] First frame received, sending to ${session.clients.size} clients`);
      }

      // 모든 클라이언트에 프레임 전송
      const message = JSON.stringify({
        type: 'frame',
        data: `data:image/jpeg;base64,${data}`
      });

      session.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    });
  }

  // Screencast 시작
  try {
    await session.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 80,
      maxWidth: session.viewportWidth * 2,
      maxHeight: session.viewportHeight * 2,
      everyNthFrame: 1
    });
    console.log('[Puppeteer Preview] Screencast started');
  } catch (e) {
    console.error('[Puppeteer Preview] Failed to start screencast:', e);
    session.isStreaming = false;
  }
}

// Screencast 중지
async function stopScreencast(): Promise<void> {
  if (!session || !session.isStreaming) return;

  try {
    await session.cdp.send('Page.stopScreencast');
    session.isStreaming = false;
    console.log('[Puppeteer Preview] Screencast stopped');
  } catch (e) {
    // 무시
  }
}

// Preview 중지 (preserveClients: 클라이언트 연결 유지 여부)
export async function stopPreview(preserveClients = false): Promise<Set<WebSocket>> {
  if (!session) return new Set();

  console.log('[Puppeteer Preview] Stopping preview');

  await stopScreencast();

  // CDP 핸들러 등록 상태 리셋
  screencastHandlerRegistered = false;

  // 마우스 버튼 상태 리셋
  pressedMouseButtons.clear();

  // 클라이언트 보존 또는 종료
  const clients = session.clients;
  if (!preserveClients) {
    clients.forEach(client => {
      client.close();
    });
  }

  // 브라우저 종료
  try {
    await session.browser.close();
  } catch (e) {
    // 무시
  }

  session = null;
  return preserveClients ? clients : new Set();
}

// 페이지 새로고침
export async function refreshPreview(): Promise<void> {
  if (!session) return;

  console.log('[Puppeteer Preview] Refreshing page');
  await session.page.reload({ waitUntil: 'domcontentloaded' });
}

// URL 변경
export async function navigatePreview(url: string): Promise<void> {
  if (!session) {
    await startPreview(url);
    return;
  }

  if (session.url === url) return;

  console.log('[Puppeteer Preview] Navigating to:', url);
  session.url = url;
  await session.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
}

// 뷰포트 변경
export async function resizePreview(width: number, height: number): Promise<void> {
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

  // Screencast 재시작
  await stopScreencast();
  await startScreencast();
}

// 마우스 이벤트 처리
export async function handleMouseEvent(
  type: 'mousedown' | 'mouseup' | 'mousemove' | 'click',
  x: number,
  y: number,
  button: 'left' | 'right' | 'middle' = 'left'
): Promise<void> {
  if (!session) return;

  switch (type) {
    case 'click':
      await session.page.mouse.click(x, y, { button });
      break;
    case 'mousedown':
      // 먼저 마우스 위치로 이동 후 버튼 누르기
      await session.page.mouse.move(x, y);
      await session.page.mouse.down({ button });
      pressedMouseButtons.add(button);
      break;
    case 'mouseup':
      // 해당 버튼이 눌린 상태일 때만 up 호출 (Puppeteer 에러 방지)
      if (pressedMouseButtons.has(button)) {
        await session.page.mouse.move(x, y);
        await session.page.mouse.up({ button });
        pressedMouseButtons.delete(button);
      }
      break;
    case 'mousemove':
      await session.page.mouse.move(x, y);
      break;
  }
}

// 키보드 이벤트 처리
export async function handleKeyEvent(
  type: 'keydown' | 'keyup' | 'keypress',
  key: string
): Promise<void> {
  if (!session) return;

  // Puppeteer KeyInput 타입으로 캐스팅
  const keyInput = key as import('puppeteer').KeyInput;

  switch (type) {
    case 'keydown':
      await session.page.keyboard.down(keyInput);
      break;
    case 'keyup':
      await session.page.keyboard.up(keyInput);
      break;
    case 'keypress':
      await session.page.keyboard.press(keyInput);
      break;
  }
}

// 텍스트 입력
export async function typeText(text: string): Promise<void> {
  if (!session) return;
  await session.page.keyboard.type(text);
}

// 스크롤 이벤트 처리
export async function handleScroll(deltaX: number, deltaY: number): Promise<void> {
  if (!session) return;

  await session.page.evaluate((dx, dy) => {
    window.scrollBy(dx, dy);
  }, deltaX, deltaY);
}

// 뒤로가기
export async function goBack(): Promise<boolean> {
  if (!session) return false;

  try {
    await session.page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('[Puppeteer Preview] Navigated back');
    return true;
  } catch (e) {
    console.log('[Puppeteer Preview] Cannot go back');
    return false;
  }
}

// 앞으로가기
export async function goForward(): Promise<boolean> {
  if (!session) return false;

  try {
    await session.page.goForward({ waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('[Puppeteer Preview] Navigated forward');
    return true;
  } catch (e) {
    console.log('[Puppeteer Preview] Cannot go forward');
    return false;
  }
}

// WebSocket 서버 설정
export function setupWebSocketServer(server: any): void {
  if (wss) return;

  wss = new WebSocketServer({ noServer: true });

  // HTTP 서버의 upgrade 이벤트 핸들링
  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url || '';

    if (url === '/ws/preview') {
      wss!.handleUpgrade(request, socket, head, (ws) => {
        wss!.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[Puppeteer Preview] WebSocket client connected');

    if (session) {
      session.clients.add(ws);
    }

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'start':
            // 기존 세션이 있고 같은 URL이면 클라이언트만 추가
            if (session && session.url === message.url) {
              console.log('[Puppeteer Preview] Adding client to existing session');
              session.clients.add(ws);
              // 뷰포트 크기가 다르면 조정
              if (session.viewportWidth !== message.width || session.viewportHeight !== message.height) {
                await resizePreview(message.width, message.height);
              }
            } else {
              await startPreview(message.url, message.width, message.height);
              if (session) {
                session.clients.add(ws);
              }
            }
            ws.send(JSON.stringify({ type: 'started' }));
            break;

          case 'stop':
            await stopPreview();
            ws.send(JSON.stringify({ type: 'stopped' }));
            break;

          case 'refresh':
            await refreshPreview();
            break;

          case 'navigate':
            await navigatePreview(message.url);
            break;

          case 'resize':
            await resizePreview(message.width, message.height);
            break;

          case 'mouse':
            await handleMouseEvent(message.eventType, message.x, message.y, message.button);
            break;

          case 'key':
            await handleKeyEvent(message.eventType, message.key);
            break;

          case 'type':
            await typeText(message.text);
            break;

          case 'scroll':
            await handleScroll(message.deltaX, message.deltaY);
            break;

          case 'back':
            const wentBack = await goBack();
            ws.send(JSON.stringify({ type: 'navigation', success: wentBack, direction: 'back' }));
            break;

          case 'forward':
            const wentForward = await goForward();
            ws.send(JSON.stringify({ type: 'navigation', success: wentForward, direction: 'forward' }));
            break;
        }
      } catch (error) {
        console.error('[Puppeteer Preview] Message handling error:', error);
        ws.send(JSON.stringify({ type: 'error', message: String(error) }));
      }
    });

    ws.on('close', () => {
      console.log('[Puppeteer Preview] WebSocket client disconnected');
      if (session) {
        session.clients.delete(ws);
      }
    });

    ws.on('error', (error) => {
      console.error('[Puppeteer Preview] WebSocket error:', error);
    });
  });

  console.log('[Puppeteer Preview] WebSocket server ready');
}

// 현재 상태 반환
export function getPreviewStatus(): { active: boolean; url: string | null; clients: number } {
  return {
    active: session !== null,
    url: session?.url || null,
    clients: session?.clients.size || 0
  };
}
