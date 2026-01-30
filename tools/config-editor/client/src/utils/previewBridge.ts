// tools/config-editor/client/src/utils/previewBridge.ts
/**
 * Preview용 AppBridge 스크립트
 * 실제 ReactNativeWebView 대신 window.postMessage로 부모 창과 통신
 */

export const getPreviewBridgeScript = (): string => {
  return `
(function() {
  'use strict';

  // 이미 초기화되었으면 스킵
  if (window.AppBridge) return;

  // Preview 환경 감지
  var isPreview = window.parent !== window;

  // 응답 대기 맵
  var pendingRequests = new Map();

  // Mock ReactNativeWebView - postMessage를 부모 창으로 전달
  window.ReactNativeWebView = {
    postMessage: function(message) {
      if (isPreview) {
        window.parent.postMessage({
          type: 'PREVIEW_BRIDGE_MESSAGE',
          data: JSON.parse(message)
        }, '*');
      }
      console.log('[AppBridge Preview] Message sent:', JSON.parse(message));
    }
  };

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
     */
    send: function(action, payload) {
      processPayload(payload || {}).then(function(processed) {
        var message = {
          protocol: 'app://' + action,
          payload: processed,
          timestamp: Date.now(),
          __token: 'preview-token',
          __nonce: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        };
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }).catch(function(err) {
        console.error('[AppBridge Preview] Failed to process payload:', err);
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
            __token: 'preview-token',
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
              console.error('[AppBridge Preview] Listener error:', e);
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

    // 앱 환경 체크 (Preview에서는 true 반환)
    isApp: function() {
      return true;
    },

    // Preview 환경 체크
    isPreview: function() {
      return true;
    },

    version: '2.1.0-preview'
  };

  // 부모 창에서 온 메시지 수신
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
 * Bridge 메시지 타입
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
