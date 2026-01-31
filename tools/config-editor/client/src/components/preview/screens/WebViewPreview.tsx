// tools/config-editor/client/src/components/preview/screens/WebViewPreview.tsx
// Puppeteer 기반 실시간 preview

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePreview } from '../../../contexts/PreviewContext';
import type { AppConfig } from '../../../types/config';

interface WebViewPreviewProps {
  appConfig: AppConfig | null;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export default function WebViewPreview({ appConfig }: WebViewPreviewProps) {
  const { settings, deviceSize } = usePreview();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [frameData, setFrameData] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentUrlRef = useRef<string | null>(null);

  const baseUrl = appConfig?.webview?.baseUrl || '';
  const shouldConnect = settings.loadIframe && baseUrl;

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
    if (!shouldConnect || !baseUrl) {
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

    // 이미 같은 URL로 연결 중이면 스킵
    if (wsRef.current && currentUrlRef.current === baseUrl && connectionState === 'connected') {
      return;
    }

    // 기존 연결 종료
    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnectionState('connecting');
    setErrorMessage('');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/preview`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebViewPreview] WebSocket connected');
      currentUrlRef.current = baseUrl;

      // Preview 시작 요청
      ws.send(JSON.stringify({
        type: 'start',
        url: baseUrl,
        width: viewport.width,
        height: viewport.height
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'started':
            console.log('[WebViewPreview] Preview started');
            setConnectionState('connected');
            break;

          case 'frame':
            setFrameData(message.data);
            if (connectionState !== 'connected') {
              setConnectionState('connected');
            }
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
      if (connectionState !== 'error') {
        setConnectionState('disconnected');
      }
    };

    return () => {
      ws.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldConnect, baseUrl]); // viewport 변경은 resize useEffect에서 처리

  // URL 변경 시 navigate
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && currentUrlRef.current !== baseUrl && baseUrl) {
      console.log('[WebViewPreview] Navigating to:', baseUrl);
      currentUrlRef.current = baseUrl;
      wsRef.current.send(JSON.stringify({
        type: 'navigate',
        url: baseUrl
      }));
    }
  }, [baseUrl]);

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

  // 마우스 이벤트 핸들러
  const handleMouseEvent = useCallback((e: React.MouseEvent<HTMLDivElement>, eventType: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = viewport.width / rect.width;
    const scaleY = viewport.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

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

  // 플레이스홀더 모드 (loadIframe이 꺼져있거나 baseUrl이 없음)
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
        <p className="text-sm font-medium text-slate-600">Your Web App</p>
        {baseUrl && (
          <p className="text-xs text-slate-400 mt-1 px-4 text-center truncate max-w-full">
            {baseUrl}
          </p>
        )}
      </div>
    );
  }

  // 에러 상태
  if (connectionState === 'error') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100">
        <svg className="w-12 h-12 text-red-400 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path d="M12 8v4M12 16h.01" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium text-slate-600 mb-1">Failed to load preview</p>
        <p className="text-xs text-slate-400 mb-3">{errorMessage || 'Connection failed'}</p>
        <button
          onClick={handleReconnect}
          className="px-3 py-1.5 text-xs bg-slate-800 text-white rounded hover:bg-slate-700"
        >
          Retry
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
    <div className="w-full h-full flex flex-col bg-white">
      {/* Preview 화면 */}
      <div
        ref={containerRef}
        className="flex-1 cursor-pointer overflow-hidden"
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

      {/* 네비게이션 버튼들 - 하단 고정 */}
      <div className="flex-shrink-0 flex justify-center items-center gap-2 py-2 bg-slate-50 border-t border-slate-200">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          title="Back"
        >
          <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={handleForward}
          className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          title="Forward"
        >
          <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <button
          onClick={handleRefresh}
          className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          title="Refresh"
        >
          <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
