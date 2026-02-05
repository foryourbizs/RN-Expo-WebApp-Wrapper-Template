/**
 * 웹에서 사용할 브릿지 클라이언트 코드
 * 이 코드를 웹사이트에 포함시키거나 injectedJavaScript로 주입
 */

/**
 * 브릿지 클라이언트 스크립트 생성
 * @param securityToken - SecurityEngine에서 전달받은 보안 토큰
 *                        반드시 SecurityEngine.getInstance().getSecurityToken()으로 획득한 토큰 사용
 */
export const getBridgeClientScript = (securityToken: string): string => {
  if (!securityToken || typeof securityToken !== 'string') {
    throw new Error('[BridgeClient] Security token is required');
  }

  return `
(function() {
  'use strict';

  // ========================================
  // NOTE: L1 Security Boundary (eval/Function 무력화, Object.prototype 동결 등)는
  // SecurityEngine.createWebViewHandlers().injectedJavaScriptBeforeContentLoaded
  // 통해 별도로 적용됨
  // ========================================

  // ========================================
  // beforeunload 경고창 무력화 (보조)
  // 메인 차단은 네이티브 Android WebChromeClient.onJsBeforeUnload에서 처리
  // 이 코드는 iOS 등 다른 플랫폼을 위한 폴백
  // ========================================

  try {
    // returnValue 설정 무력화 - 확인창 트리거 방지
    Object.defineProperty(BeforeUnloadEvent.prototype, 'returnValue', {
      get: function() { return ''; },
      set: function() { /* 무시 */ },
      configurable: true
    });
  } catch(e) {}
  
  // ========================================
  // Headless WebView Console 포워딩
  // chromium WebChromeClient가 없는 headless WebView에서 console.log를 캡처
  // ========================================

  (function() {
    // 메인 WebView에서는 스킵 (chromium이 이미 캡처함)
    if (document.body && document.body.innerHTML.length > 500) return;

    var originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };

    function forwardToNative(level, args) {
      try {
        if (window.ReactNativeWebView) {
          var message = '[HEADLESS:' + level.toUpperCase() + '] ' +
            Array.prototype.slice.call(args).map(function(a) {
              return typeof a === 'object' ? JSON.stringify(a) : String(a);
            }).join(' ');
          // 네이티브로 직접 로그 전송 (app://__console 프로토콜)
          window.ReactNativeWebView.postMessage(JSON.stringify({
            protocol: 'app://__console',
            payload: { level: level, message: message },
            timestamp: Date.now()
          }));
        }
      } catch(e) {}
      // 원본 호출
      originalConsole[level].apply(console, args);
    }

    console.log = function() { forwardToNative('log', arguments); };
    console.warn = function() { forwardToNative('warn', arguments); };
    console.error = function() { forwardToNative('error', arguments); };
    console.info = function() { forwardToNative('info', arguments); };
  })();

  // ========================================
  // AppBridge 초기화
  // ========================================

  // 이미 초기화되었으면 스킵
  if (window.AppBridge) return;

  // 토큰을 Symbol 키로 은닉 (외부에서 접근 불가)
  var _t = (function(){
    var s = Symbol('_');
    var o = {};
    o[s] = '${securityToken}';
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

  // 앱 브릿지 객체
  window.AppBridge = {
    /**
     * 앱으로 메시지 전송 (응답 없음)
     * @param {string} action - 액션명
     * @param {object} payload - 데이터 (Blob/File 지원)
     */
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

    /**
     * 앱으로 메시지 전송 후 응답 대기
     * @param {string} action - 액션명
     * @param {object} payload - 데이터 (Blob/File 지원)
     * @param {number} timeout - 타임아웃 (ms)
     * @returns {Promise}
     */
    call: function(action, payload, timeout) {
      timeout = timeout || 10000;
      var self = this;
      
      return processPayload(payload || {}).then(function(processed) {
        return new Promise(function(resolve, reject) {
          var requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          
          // 타임아웃 설정
          var timer = setTimeout(function() {
            pendingRequests.delete(requestId);
            reject(new Error('Request timeout: ' + action));
          }, timeout);

          // 응답 대기 등록
          pendingRequests.set(requestId, {
            resolve: resolve,
            reject: reject,
            timer: timer
          });

          // 요청 전송
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

    /**
     * 앱에서 온 메시지 리스너 등록
     * @param {string} action - 액션명 또는 '*' (모든 메시지)
     * @param {function} callback - 콜백 함수
     */
    on: function(action, callback) {
      if (!this._listeners) this._listeners = {};
      if (!this._listeners[action]) this._listeners[action] = [];
      this._listeners[action].push(callback);
    },

    /**
     * 한 번만 메시지 수신 후 자동 해제
     * @param {string} action - 액션명
     * @param {function} callback - 콜백 함수
     */
    once: function(action, callback) {
      var self = this;
      var wrapper = function(payload, message) {
        self.off(action, wrapper);
        callback(payload, message);
      };
      this.on(action, wrapper);
    },

    /**
     * 특정 액션 메시지를 타임아웃까지 대기 (Promise)
     * @param {string} action - 액션명
     * @param {number} timeout - 타임아웃 (ms, 기본 10초)
     * @returns {Promise}
     */
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

    /**
     * 리스너 해제
     */
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

    /**
     * 내부: 앱 응답 처리
     */
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

    /**
     * 내부: 앱 메시지 처리
     */
    _handleMessage: function(message) {
      console.log('[AppBridge] _handleMessage called', message);
      console.log('[AppBridge] message.action:', message.action);
      console.log('[AppBridge] _listeners:', this._listeners);
      
      // 응답 메시지 처리
      if (message.action === 'bridgeResponse') {
        this._handleResponse(message.payload);
        return;
      }

      // 리스너 호출
      if (this._listeners) {
        // 특정 액션 리스너
        if (this._listeners[message.action]) {
          console.log('[AppBridge] Found ' + this._listeners[message.action].length + ' listener(s) for: ' + message.action);
          this._listeners[message.action].forEach(function(cb) {
            try { 
              console.log('[AppBridge] Calling listener for: ' + message.action);
              cb(message.payload, message); 
            } catch(e) { 
              console.error('[AppBridge] Listener error:', e); 
            }
          });
        } else {
          console.log('[AppBridge] No listeners for action: ' + message.action);
        }
        // 와일드카드 리스너
        if (this._listeners['*']) {
          this._listeners['*'].forEach(function(cb) {
            try { cb(message.payload, message); } catch(e) { console.error(e); }
          });
        }
      } else {
        console.log('[AppBridge] No _listeners object!');
      }
    },

    // 앱 환경 체크
    isApp: function() {
      return !!window.ReactNativeWebView;
    },

    // 버전 (getToken 제거됨 - 보안상 외부에서 토큰 접근 불가)
    version: '2.1.0'
  };

  // 앱에서 온 메시지 수신 리스너
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

  // 초기화 정보 로깅 (headless WebView 디버깅용)
  var isHeadless = !document.body || document.body.innerHTML.length < 500;
  console.log('[AppBridge] Initialized - isHeadless:', isHeadless, ', ReactNativeWebView:', !!window.ReactNativeWebView);
})();
true;
`;
};
