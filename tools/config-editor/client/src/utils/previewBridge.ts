// tools/config-editor/client/src/utils/previewBridge.ts
/**
 * Preview용 AppBridge 스크립트
 * 실제 lib/bridge-client.ts 기반으로 작성
 * ReactNativeWebView 대신 window.postMessage로 부모 창과 통신
 */

/**
 * 실제 브릿지 스크립트 생성 (lib/bridge-client.ts와 동일한 구조)
 * Preview 환경에서는 보안 토큰 대신 'preview-token' 사용
 */
export const getPreviewBridgeScript = (): string => {
  // 실제 bridge-client.ts의 코드를 기반으로 preview 환경에 맞게 수정
  return `
(function() {
  'use strict';

  // ========================================
  // Preview 환경 감지
  // ========================================
  var isPreview = window.parent !== window;

  // ========================================
  // beforeunload 경고창 완전 무력화
  // (실제 bridge-client.ts와 동일)
  // ========================================

  Object.defineProperty(window, 'onbeforeunload', {
    get: function() { return null; },
    set: function() { return; },
    configurable: false
  });

  var originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'beforeunload') {
      return;
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  window.addEventListener('beforeunload', function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    delete e.returnValue;
    return undefined;
  }, true);

  // ========================================
  // AppBridge 초기화
  // ========================================

  if (window.AppBridge) return;

  // Preview 환경에서는 고정 토큰 사용
  var _t = (function(){
    var s = Symbol('_');
    var o = {};
    o[s] = 'preview-token';
    return function(){ return o[s]; };
  })();

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

  // ========================================
  // Mock ReactNativeWebView - Preview용
  // 실제 앱에서는 ReactNativeWebView.postMessage를 사용하지만
  // Preview에서는 부모 창으로 메시지 전달
  // ========================================
  window.ReactNativeWebView = {
    postMessage: function(message) {
      var parsed = JSON.parse(message);
      if (isPreview) {
        window.parent.postMessage({
          type: 'PREVIEW_BRIDGE_MESSAGE',
          data: parsed
        }, '*');
      }
      console.log('[AppBridge Preview] Message sent:', parsed);
    }
  };

  // ========================================
  // AppBridge 객체 (실제 bridge-client.ts와 동일한 API)
  // ========================================
  window.AppBridge = {
    /**
     * 앱으로 메시지 전송 (응답 없음)
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
     */
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

    /**
     * 앱에서 온 메시지 리스너 등록
     */
    on: function(action, callback) {
      if (!this._listeners) this._listeners = {};
      if (!this._listeners[action]) this._listeners[action] = [];
      this._listeners[action].push(callback);
    },

    /**
     * 한 번만 메시지 수신 후 자동 해제
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
     * 특정 액션 메시지를 타임아웃까지 대기
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
      console.log('[AppBridge Preview] Message received:', message);

      if (message.action === 'bridgeResponse') {
        this._handleResponse(message.payload);
        return;
      }

      if (this._listeners) {
        if (this._listeners[message.action]) {
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

    // 앱 환경 체크 (Preview에서는 true)
    isApp: function() {
      return !!window.ReactNativeWebView;
    },

    // Preview 환경 체크
    isPreview: function() {
      return true;
    },

    version: '2.1.0-preview'
  };

  // ========================================
  // 부모 창에서 온 메시지 수신 (Preview 전용)
  // ========================================
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'PREVIEW_BRIDGE_RESPONSE') {
      window.AppBridge._handleMessage(e.data.message);
    }
  });

  // nativeMessage 이벤트 리스너 (호환성)
  window.addEventListener('nativeMessage', function(e) {
    window.AppBridge._handleMessage(e.detail);
  });

  // 전역 콜백 (호환성)
  window.onNativeMessage = function(message) {
    window.AppBridge._handleMessage(message);
  };

  // 초기화 완료 이벤트
  window.dispatchEvent(new CustomEvent('AppBridgeReady'));
  console.log('[AppBridge Preview] Initialized - Preview Mode');
})();
true;
`;
};

/**
 * Bridge 메시지 타입 (실제 bridge-client.ts와 동일)
 */
export interface BridgeMessage {
  protocol: string;
  payload: Record<string, unknown>;
  requestId?: string;
  timestamp: number;
  __token: string;
  __nonce: string;
}

/**
 * Preview Bridge 이벤트 데이터
 */
export interface PreviewBridgeEvent {
  type: 'PREVIEW_BRIDGE_MESSAGE';
  data: BridgeMessage;
}
