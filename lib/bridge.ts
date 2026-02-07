/**
 * WebView 브릿지 시스템
 * 웹 ↔ 앱 양방향 통신을 위한 범용 핸들러
 */

import type { WebView } from 'react-native-webview';
import { SecurityEngine } from '@/lib/security';
import { APP_CONFIG } from '@/constants/app-config';

// base64 디코딩 헬퍼
const decodeBase64Data = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  
  // base64 인코딩된 데이터 처리
  if (data.__type === 'base64' && data.data) {
    return {
      type: 'base64',
      data: data.data,
      mimeType: data.mimeType,
      name: data.name,
      size: data.size,
      // 필요시 Buffer로 변환 가능
      toBuffer: () => Buffer.from(data.data, 'base64')
    };
  }

  // 재귀적으로 객체 처리
  const processed: any = Array.isArray(data) ? [] : {};
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      processed[key] = decodeBase64Data(data[key]);
    }
  }
  return processed;
};

// 메시지 타입 정의
export interface BridgeMessage<T = unknown> {
  // 프로토콜: 'app://액션명' 형태
  protocol: string;
  // 액션명 (protocol에서 파싱)
  action: string;
  // 페이로드 데이터
  payload?: T;
  // 요청 ID (응답 매칭용)
  requestId?: string;
  // 타임스탬프
  timestamp?: number;
}

export interface BridgeResponse<T = unknown> {
  requestId: string;
  success: boolean;
  data?: T;
  error?: string;
}

// 핸들러 타입
export type BridgeHandler<T = unknown, R = unknown> = (
  payload: T,
  respond: (data: R) => void
) => void | Promise<void>;

// 핸들러 레지스트리
const handlers: Map<string, BridgeHandler> = new Map();

// WebView 인스턴스 참조
let webViewInstance: WebView | null = null;

/**
 * WebView 인스턴스 설정
 */
export const setBridgeWebView = (webView: WebView | null) => {
  webViewInstance = webView;
};

/**
 * WebView 인스턴스 가져오기
 */
export const getWebViewInstance = () => webViewInstance;

// 핸들러 옵션 타입
export interface HandlerOptions {
  /** 응답 타임아웃 (ms). 설정 시 응답이 없으면 자동 에러 응답 */
  timeout?: number;
  /** 한 번만 실행 후 자동 해제 */
  once?: boolean;
}

/**
 * 핸들러 등록
 * @param action 액션명 (예: 'getDeviceInfo', 'showToast')
 * @param handler 핸들러 함수
 * @param options 핸들러 옵션 (timeout, once)
 */
export const registerHandler = <T = unknown, R = unknown>(
  action: string,
  handler: BridgeHandler<T, R>,
  options?: HandlerOptions
) => {
  const wrappedHandler: BridgeHandler = (payload, respond) => {
    let responded = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // 타임아웃 설정
    if (options?.timeout) {
      timer = setTimeout(() => {
        if (!responded) {
          responded = true;
          respond({ success: false, error: `Handler timeout: ${action}` });
        }
      }, options.timeout);
    }

    // 응답 함수 래핑
    const wrappedRespond = (data: unknown) => {
      if (responded) return;
      responded = true;
      if (timer) clearTimeout(timer);
      respond(data);
    };

    // once 옵션
    if (options?.once) {
      handlers.delete(action);
    }

    handler(payload as T, wrappedRespond as (data: R) => void);
  };

  handlers.set(action, wrappedHandler);
  console.log(`[Bridge] Handler registered: ${action}`, options || '');
};

/**
 * 핸들러 해제
 */
export const unregisterHandler = (action: string) => {
  handlers.delete(action);
  console.log(`[Bridge] Handler unregistered: ${action}`);
};

/**
 * 모든 핸들러 해제
 */
export const clearHandlers = () => {
  handlers.clear();
};

/**
 * 웹에서 온 메시지 처리
 */
export const handleBridgeMessage = (messageData: string): boolean => {
  try {
    const data = JSON.parse(messageData);

    // app:// 프로토콜 체크
    if (!data.protocol || !data.protocol.startsWith('app://')) {
      return false; // 브릿지 메시지가 아님
    }

    // SecurityEngine으로 메시지 검증
    // Note: APP_CONFIG.security is readonly, but SecurityEngine expects mutable Partial<SecurityConfig>
    const securityEngine = SecurityEngine.getInstance(APP_CONFIG.security as unknown as Parameters<typeof SecurityEngine.getInstance>[0]);
    const securityDecision = securityEngine.validateBridgeMessage(data);
    if (!securityDecision.allowed) {
      console.warn('[Bridge] Security validation failed:', securityDecision.reason);
      return false;
    }

    const action = data.protocol.replace('app://', '');
    
    // base64 데이터 디코딩
    const decodedPayload = decodeBase64Data(data.payload);
    
    const message: BridgeMessage = {
      ...data,
      action,
      payload: decodedPayload,
      timestamp: data.timestamp || Date.now(),
    };

    console.log(`[Bridge] Received: ${action}`, message.payload);

    const handler = handlers.get(action);
    if (handler) {
      // 응답 함수 생성
      const respond = (responseData: unknown) => {
        if (message.requestId) {
          sendToWeb('bridgeResponse', {
            requestId: message.requestId,
            success: true,
            data: responseData,
          });
        }
      };

      try {
        handler(message.payload, respond);
      } catch (error) {
        console.error(`[Bridge] Handler error: ${action}`, error);
        if (message.requestId) {
          sendToWeb('bridgeResponse', {
            requestId: message.requestId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } else {
      console.warn(`[Bridge] No handler for action: ${action}`);
      if (message.requestId) {
        sendToWeb('bridgeResponse', {
          requestId: message.requestId,
          success: false,
          error: `Unknown action: ${action}`,
        });
      }
    }

    return true; // 브릿지 메시지 처리됨
  } catch {
    return false; // JSON 파싱 실패 = 브릿지 메시지 아님
  }
};

/**
 * 앱에서 웹으로 메시지 전송
 */
export const sendToWeb = <T = unknown>(action: string, payload?: T) => {
  console.log(`[Bridge] sendToWeb called - action: ${action}, webView: ${webViewInstance ? 'available' : 'NULL'}`);

  if (!webViewInstance) {
    console.error('[Bridge] ⚠️⚠️⚠️ WebView is NULL! Cannot send to web!');
    console.error(`[Bridge] - action: ${action}`);
    console.error(`[Bridge] - payload type: ${typeof payload}`);
    return;
  }

  const message = {
    protocol: `native://${action}`,
    action,
    payload,
    timestamp: Date.now(),
  };

  // JSON.stringify를 한 번만 실행하여 최적화
  const messageJSON = JSON.stringify(message);

  // IIFE로 즉시 실행 후 메모리에서 제거됨
  // 이벤트만 발생시키고 코드는 GC됨
  const script = `(function(){console.log('[Bridge-Inject] Sending message, action: ${action}');var msg=${messageJSON};console.log('[Bridge-Inject] Message object:', msg);var e=new CustomEvent('nativeMessage',{detail:msg});window.dispatchEvent(e);console.log('[Bridge-Inject] Event dispatched');window.onNativeMessage&&window.onNativeMessage(msg)})();true;`;

  webViewInstance.injectJavaScript(script);

  // 로그 출력 조건: base64 데이터나 cameraFrame 같은 대용량 데이터는 로그 제외
  const shouldLog = !action.includes('cameraFrame') &&
    !messageJSON.includes('base64');

  if (shouldLog) {
    console.log(`[Bridge] ✓ Sent to web: ${action}`, payload);
  } else {
    // cameraFrame도 첫 10개는 로그 출력
    if (action.includes('cameraFrame') || action.includes('cameraStream')) {
      console.log(`[Bridge] ✓ Frame sent to web via action: '${action}' (payload size: ${messageJSON.length} bytes)`);
    }
  }
};

/**
 * 웹에서 앱 함수 호출 후 Promise로 응답 대기 (앱에서 웹으로 요청)
 */
export const callWeb = <T = unknown, R = unknown>(
  action: string,
  payload?: T,
  timeout = 10000
): Promise<R> => {
  return new Promise((resolve, reject) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 타임아웃 설정
    const timer = setTimeout(() => {
      reject(new Error(`Request timeout: ${action}`));
    }, timeout);

    // 일회성 응답 핸들러 등록
    const responseHandler = `__response_${requestId}`;
    registerHandler(responseHandler, (response: BridgeResponse<R>) => {
      clearTimeout(timer);
      unregisterHandler(responseHandler);
      if (response.success) {
        resolve(response.data as R);
      } else {
        reject(new Error(response.error || 'Unknown error'));
      }
    });

    // 웹으로 요청 전송
    sendToWeb(action, { ...payload as object, requestId, responseAction: responseHandler });
  });
};

/**
 * 보안 토큰 획득 (SecurityEngine에서)
 */
export const getSecurityToken = () => {
  return SecurityEngine.getInstance(APP_CONFIG.security as unknown as Parameters<typeof SecurityEngine.getInstance>[0]).getSecurityToken();
};

// ============================================================
// Bridge Extension API (플러그인 확장용)
// 기존 코드 수정 없이 외부 WebView(Headless 등) 지원
// ============================================================

/**
 * 외부 WebView 어댑터 인터페이스
 * 플러그인이 구현하여 등록
 */
export interface ExternalWebViewAdapter {
  /** 어댑터 ID (예: 'headless', 'background') */
  id: string;

  /** 이 어댑터로 메시지 전송 */
  sendMessage: (action: string, payload: unknown) => void;

  /** 어댑터가 활성 상태인지 */
  isActive: () => boolean;

  /** 어댑터 정리 */
  destroy?: () => void;
}

/**
 * WebView 타겟 식별자
 */
export type WebViewTarget = 'main' | 'headless' | string;

/**
 * Bridge 확장 API 인터페이스
 */
export interface BridgeExtensionAPI {
  /** 외부 WebView 어댑터 등록 */
  registerWebViewAdapter: (adapter: ExternalWebViewAdapter) => void;

  /** 외부 WebView 어댑터 해제 */
  unregisterWebViewAdapter: (adapterId: string) => void;

  /** 특정 타겟으로 메시지 전송 */
  sendToTarget: (target: WebViewTarget, action: string, payload?: unknown) => void;

  /** 외부 WebView에서 온 메시지 처리 (핸들러 실행) */
  handleExternalMessage: (
    messageData: string,
    responseCallback: (action: string, payload: unknown) => void
  ) => boolean;

  /** 등록된 모든 핸들러 목록 조회 */
  getRegisteredHandlers: () => string[];

  /** 핸들러 존재 여부 확인 */
  hasHandler: (action: string) => boolean;
}

// 외부 WebView 어댑터 저장소
const externalAdapters = new Map<string, ExternalWebViewAdapter>();

/**
 * Bridge 확장 API 구현
 * 플러그인에서 Headless WebView 등 외부 WebView 지원에 사용
 */
export const BridgeExtension: BridgeExtensionAPI = {
  /**
   * 외부 WebView 어댑터 등록
   * 플러그인에서 Headless WebView 등록 시 사용
   */
  registerWebViewAdapter(adapter: ExternalWebViewAdapter): void {
    if (externalAdapters.has(adapter.id)) {
      console.warn(`[Bridge] Adapter '${adapter.id}' already registered, replacing`);
      const existing = externalAdapters.get(adapter.id);
      existing?.destroy?.();
    }
    externalAdapters.set(adapter.id, adapter);
    console.log(`[Bridge] External adapter registered: ${adapter.id}`);
  },

  /**
   * 외부 WebView 어댑터 해제
   */
  unregisterWebViewAdapter(adapterId: string): void {
    const adapter = externalAdapters.get(adapterId);
    if (adapter) {
      adapter.destroy?.();
      externalAdapters.delete(adapterId);
      console.log(`[Bridge] External adapter unregistered: ${adapterId}`);
    }
  },

  /**
   * 특정 타겟으로 메시지 전송
   * - 'main': 기존 sendToWeb() 사용
   * - 'headless' 또는 커스텀 ID: 등록된 어댑터 사용
   */
  sendToTarget(target: WebViewTarget, action: string, payload?: unknown): void {
    if (target === 'main') {
      sendToWeb(action, payload);
      return;
    }

    const adapter = externalAdapters.get(target);
    if (adapter && adapter.isActive()) {
      adapter.sendMessage(action, payload);
    } else {
      console.warn(`[Bridge] Target '${target}' not available`);
    }
  },

  /**
   * 외부 WebView에서 온 메시지를 기존 핸들러로 처리
   * Headless WebView는 앱이 직접 생성한 내부 WebView이므로 보안 검증 불필요
   * (외부 웹 콘텐츠 없음, bridge 스크립트도 앱이 직접 주입)
   */
  handleExternalMessage(
    messageData: string,
    responseCallback: (action: string, payload: unknown) => void
  ): boolean {
    try {
      const data = JSON.parse(messageData);

      // 프로토콜 검증
      if (!data.protocol || !data.protocol.startsWith('app://')) {
        return false;
      }

      // 액션 추출
      const action = data.protocol.replace('app://', '');

      // __console 특수 처리: headless WebView의 console.log 포워딩
      if (action === '__console') {
        const payload = data.payload as { level?: string; message?: string };
        const level = payload?.level || 'log';
        const message = payload?.message || '';
        // ReactNativeJS 로그로 출력 (config editor의 디바이스 로그에 표시됨)
        switch (level) {
          case 'error':
            console.error(message);
            break;
          case 'warn':
            console.warn(message);
            break;
          default:
            console.log(message);
        }
        return true;
      }

      // 외부 WebView(Headless 등)는 앱이 직접 생성/관리하는 내부 WebView
      // 토큰 검증은 수행하되, 실패 시 lockdown을 트리거하지 않음
      // (메인 WebView와 lockdown 상태를 공유하지 않기 위함)
      if (data.__token) {
        const securityEngine = SecurityEngine.getInstance(
          APP_CONFIG.security as unknown as Parameters<typeof SecurityEngine.getInstance>[0]
        );
        const expectedToken = securityEngine.getSecurityToken();
        if (data.__token !== expectedToken) {
          console.warn('[Bridge] External message token mismatch (no lockdown)');
          return false;
        }
      }

      const decodedPayload = decodeBase64Data(data.payload);

      console.log(`[Bridge] External message: ${action}`);

      // 핸들러 조회
      const handler = handlers.get(action);
      if (!handler) {
        console.warn(`[Bridge] No handler for external action: ${action}`);
        if (data.requestId) {
          responseCallback('bridgeResponse', {
            requestId: data.requestId,
            success: false,
            error: `Unknown action: ${action}`,
          });
        }
        return false;
      }

      // 응답 함수 생성 (외부 WebView로 응답)
      const respond = (responseData: unknown) => {
        if (data.requestId) {
          responseCallback('bridgeResponse', {
            requestId: data.requestId,
            success: true,
            data: responseData,
          });
        }
      };

      try {
        const result = handler(decodedPayload, respond);
        // Promise 처리
        if (result instanceof Promise) {
          result.catch((error: Error) => {
            console.error(`[Bridge] External handler error: ${action}`, error);
            if (data.requestId) {
              responseCallback('bridgeResponse', {
                requestId: data.requestId,
                success: false,
                error: error.message,
              });
            }
          });
        }
      } catch (error) {
        console.error(`[Bridge] External handler error: ${action}`, error);
        if (data.requestId) {
          responseCallback('bridgeResponse', {
            requestId: data.requestId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return true;
    } catch {
      return false;
    }
  },

  /**
   * 등록된 핸들러 목록 조회
   */
  getRegisteredHandlers(): string[] {
    return Array.from(handlers.keys());
  },

  /**
   * 핸들러 존재 여부 확인
   */
  hasHandler(action: string): boolean {
    return handlers.has(action);
  },
};
