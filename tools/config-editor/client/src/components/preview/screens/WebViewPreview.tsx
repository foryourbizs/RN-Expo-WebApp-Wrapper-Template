// tools/config-editor/client/src/components/preview/screens/WebViewPreview.tsx
// Puppeteer 기반 실시간 preview

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePreview } from '../../../contexts/PreviewContext';
import { usePreviewNavigation } from '../../../contexts/PreviewNavigationContext';
import type { AppConfig } from '../../../types/config';

// URL 유효성 검사 (기본적인 형식 체크)
function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    // 프로토콜과 호스트네임이 있어야 함
    if (!parsed.protocol || !parsed.hostname) return false;
    // 호스트네임에 도메인이 있어야 함 (최소 TLD)
    if (!parsed.hostname.includes('.')) return false;
    // 호스트네임이 점으로 끝나면 안됨
    if (parsed.hostname.endsWith('.')) return false;
    return true;
  } catch {
    return false;
  }
}

interface WebViewPreviewProps {
  appConfig: AppConfig | null;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export default function WebViewPreview({ appConfig }: WebViewPreviewProps) {
  const { settings, deviceSize, previewUrl, applyPreviewUrl } = usePreview();
  const { setHandlers, setIsConnected } = usePreviewNavigation();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [frameData, setFrameData] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentUrlRef = useRef<string | null>(null);

  const configUrl = appConfig?.webview?.baseUrl || '';

  // previewUrl이 없으면 초기 로드 시 configUrl 사용
  const effectiveUrl = previewUrl || configUrl;

  // 처음 마운트 시 유효한 URL이면 자동으로 previewUrl 설정
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && configUrl && isValidUrl(configUrl) && !previewUrl) {
      initializedRef.current = true;
      applyPreviewUrl(configUrl);
    }
  }, [configUrl, previewUrl, applyPreviewUrl]);

  const shouldConnect = settings.loadIframe && effectiveUrl && isValidUrl(effectiveUrl);

  // 디바이스 크기에 따른 뷰포트
  const viewportSizes: Record<string, { width: number; height: number }> = {
    small: { width: 320, height: 568 },
    phone: { width: 360, height: 640 },
    large: { width: 390, height: 844 },
    tablet: { width: 768, height: 1024 }
  };
  const viewport = viewportSizes[deviceSize] || viewportSizes.phone;

  // WebSocket 연결 및 관리
  useEffect(() => {
    if (!shouldConnect || !effectiveUrl) {
      // 연결 해제
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnectionState('disconnected');
      setFrameData(null);
      currentUrlRef.current = null;
      return;
    }

    // 이미 같은 URL로 연결 중이거나 연결됨이면 스킵
    if (currentUrlRef.current === effectiveUrl && wsRef.current) {
      const state = wsRef.current.readyState;
      if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) {
        console.log('[WebViewPreview] Already connected/connecting to same URL, skipping');
        return;
      }
    }

    // URL이 변경되면 기존 프레임 클리어
    if (currentUrlRef.current && currentUrlRef.current !== effectiveUrl) {
      console.log('[WebViewPreview] URL changed to:', effectiveUrl);
      setFrameData(null);
    }

    // 기존 연결 종료 (서버가 세션 관리)
    if (wsRef.current) {
      const state = wsRef.current.readyState;
      if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    currentUrlRef.current = effectiveUrl;
    setConnectionState('connecting');
    setErrorMessage('');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/preview`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebViewPreview] WebSocket connected, starting preview for:', effectiveUrl);

      // Preview 시작 요청
      ws.send(JSON.stringify({
        type: 'start',
        url: effectiveUrl,
        width: viewport.width,
        height: viewport.height
      }));
    };

    let receivedFirstFrame = false;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'started':
            console.log('[WebViewPreview] Preview started, waiting for frames...');
            setConnectionState('connected');
            break;

          case 'frame':
            // 첫 프레임 수신 로그
            if (!receivedFirstFrame) {
              receivedFirstFrame = true;
              console.log('[WebViewPreview] First frame received');
            }
            setFrameData(message.data);
            // 항상 connected 상태로 설정 (stale closure 문제 방지)
            setConnectionState('connected');
            break;

          case 'error':
            console.error('[WebViewPreview] Error:', message.message);
            setErrorMessage(message.message);
            setConnectionState('error');
            break;

          case 'stopped':
            setConnectionState('disconnected');
            setFrameData(null);
            break;
        }
      } catch (e) {
        console.error('[WebViewPreview] Message parse error:', e);
      }
    };

    ws.onerror = (event) => {
      console.error('[WebViewPreview] WebSocket error:', event);
      setConnectionState('error');
      setErrorMessage('WebSocket connection failed');
    };

    ws.onclose = () => {
      console.log('[WebViewPreview] WebSocket closed');
      // 에러 상태가 아닐 때만 disconnected로 변경
      // (cleanup에 의한 close일 수 있으므로 조건부 처리)
    };

    return () => {
      // Cleanup: WebSocket 종료
      // wsRef를 null로 설정하지 않음 - 재연결 시 상태 체크를 위해
      ws.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldConnect, effectiveUrl]); // viewport 변경은 resize useEffect에서 처리

  // 뷰포트 변경 시 resize
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && connectionState === 'connected') {
      wsRef.current.send(JSON.stringify({
        type: 'resize',
        width: viewport.width,
        height: viewport.height
      }));
    }
  }, [viewport.width, viewport.height, connectionState]);

  // 마우스 이벤트 핸들러 (object-contain 레터박스 고려)
  const handleMouseEvent = useCallback((e: React.MouseEvent<HTMLDivElement>, eventType: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    // object-contain으로 인해 실제 이미지가 표시되는 크기와 위치 계산
    const imageAspect = viewport.width / viewport.height;
    const containerAspect = containerWidth / containerHeight;

    let displayedWidth: number;
    let displayedHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (containerAspect > imageAspect) {
      // 컨테이너가 더 넓음 - 이미지는 높이에 맞춰지고 좌우에 여백
      displayedHeight = containerHeight;
      displayedWidth = containerHeight * imageAspect;
      offsetX = (containerWidth - displayedWidth) / 2;
      offsetY = 0;
    } else {
      // 컨테이너가 더 높음 - 이미지는 너비에 맞춰지고 상하에 여백
      displayedWidth = containerWidth;
      displayedHeight = containerWidth / imageAspect;
      offsetX = 0;
      offsetY = (containerHeight - displayedHeight) / 2;
    }

    // 클릭 위치를 이미지 영역 기준으로 변환
    const clickX = e.clientX - rect.left - offsetX;
    const clickY = e.clientY - rect.top - offsetY;

    // 이미지 영역 밖 클릭은 무시
    if (clickX < 0 || clickX > displayedWidth || clickY < 0 || clickY > displayedHeight) {
      return;
    }

    // 뷰포트 좌표로 스케일 변환
    const x = Math.round((clickX / displayedWidth) * viewport.width);
    const y = Math.round((clickY / displayedHeight) * viewport.height);

    wsRef.current.send(JSON.stringify({
      type: 'mouse',
      eventType,
      x,
      y,
      button: e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle'
    }));
  }, [viewport.width, viewport.height]);

  // 스크롤 이벤트 핸들러
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    e.preventDefault();
    wsRef.current.send(JSON.stringify({
      type: 'scroll',
      deltaX: e.deltaX,
      deltaY: e.deltaY
    }));
  }, []);

  // 새로고침
  const handleRefresh = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'refresh' }));
  }, []);

  // 뒤로가기
  const handleBack = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'back' }));
  }, []);

  // 앞으로가기
  const handleForward = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'forward' }));
  }, []);

  // 재연결
  const handleReconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    currentUrlRef.current = null;
    setConnectionState('disconnected');
    // useEffect가 다시 연결을 시도함
  }, []);

  // 네비게이션 핸들러를 컨텍스트에 등록
  useEffect(() => {
    const isConnected = connectionState === 'connected';
    setIsConnected(isConnected);

    if (isConnected) {
      setHandlers({
        goBack: handleBack,
        goForward: handleForward,
        refresh: handleRefresh,
      });
    } else {
      setHandlers(null);
    }

    return () => {
      setHandlers(null);
      setIsConnected(false);
    };
  }, [connectionState, handleBack, handleForward, handleRefresh, setHandlers, setIsConnected]);

  // URL 상태 체크
  const urlInvalid = configUrl && !isValidUrl(configUrl);
  const urlPending = configUrl !== effectiveUrl && configUrl.length > 0 && isValidUrl(configUrl);

  // 플레이스홀더 모드 (loadIframe이 꺼져있거나 URL이 없거나 유효하지 않음)
  if (!shouldConnect) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100">
        <div className="w-16 h-16 rounded-xl bg-slate-300 mb-3 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
            <path d="M21 15l-5-5L5 21" strokeWidth="2" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-600">
          {urlInvalid ? '유효한 URL을 입력하세요' : urlPending ? '반영 버튼을 눌러주세요' : 'Your Web App'}
        </p>
        {configUrl && (
          <p className={`text-xs mt-1 px-4 text-center truncate max-w-full ${urlInvalid ? 'text-red-400' : 'text-slate-400'}`}>
            {configUrl}
          </p>
        )}
      </div>
    );
  }

  // 에러 상태
  if (connectionState === 'error') {
    // 에러 메시지에서 원인 추출
    const isNetworkError = errorMessage?.includes('ERR_NAME_NOT_RESOLVED') ||
                           errorMessage?.includes('ERR_CONNECTION') ||
                           errorMessage?.includes('net::');

    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 px-4">
        <svg className="w-12 h-12 text-red-400 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path d="M12 8v4M12 16h.01" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium text-slate-600 mb-1">
          {isNetworkError ? 'URL을 찾을 수 없습니다' : 'Failed to load preview'}
        </p>
        <p className="text-xs text-slate-400 mb-2 text-center break-all max-w-full">
          {effectiveUrl}
        </p>
        <p className="text-[10px] text-slate-400 mb-3">
          {isNetworkError ? 'URL이 올바른지 확인해주세요' : (errorMessage || 'Connection failed')}
        </p>
        <button
          onClick={handleReconnect}
          className="px-3 py-1.5 text-xs bg-slate-800 text-white rounded hover:bg-slate-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 연결 중
  if (connectionState === 'connecting' || connectionState === 'disconnected') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mb-2" />
          <p className="text-xs text-slate-500">
            {connectionState === 'connecting' ? 'Starting preview...' : 'Connecting...'}
          </p>
        </div>
      </div>
    );
  }

  // 연결됨 - 프레임 표시
  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-pointer overflow-hidden bg-white"
      onClick={(e) => handleMouseEvent(e, 'click')}
      onMouseDown={(e) => handleMouseEvent(e, 'mousedown')}
      onMouseUp={(e) => handleMouseEvent(e, 'mouseup')}
      onMouseMove={(e) => handleMouseEvent(e, 'mousemove')}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {frameData ? (
        <img
          src={frameData}
          alt="Preview"
          className="w-full h-full object-contain"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
