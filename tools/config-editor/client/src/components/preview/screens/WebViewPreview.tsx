// tools/config-editor/client/src/components/preview/screens/WebViewPreview.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePreview } from '../../../contexts/PreviewContext';
import BridgeConsole from '../BridgeConsole';
import type { AppConfig } from '../../../types/config';

interface WebViewPreviewProps {
  appConfig: AppConfig | null;
}

type LoadMode = 'idle' | 'configuring' | 'ready' | 'error';

export default function WebViewPreview({ appConfig }: WebViewPreviewProps) {
  const { settings, themeMode } = usePreview();
  const [loadMode, setLoadMode] = useState<LoadMode>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showBridgeConsole, setShowBridgeConsole] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const baseUrl = appConfig?.webview?.baseUrl || '';
  const loadIframe = settings.loadIframe && baseUrl;

  const safeArea = appConfig?.safeArea;
  const safeAreaEnabled = safeArea?.enabled;
  const safeAreaBgColor = themeMode === 'dark'
    ? (safeArea?.darkBackgroundColor || '#000000')
    : (safeArea?.backgroundColor || '#ffffff');

  // 프록시 설정
  const configureProxy = useCallback(async (targetUrl: string | null) => {
    try {
      const response = await fetch('/api/proxy/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl })
      });

      if (!response.ok) {
        throw new Error('Failed to configure proxy');
      }

      return true;
    } catch (e) {
      console.error('[Preview] Failed to configure proxy:', e);
      return false;
    }
  }, []);

  // loadIframe 변경 시 프록시 설정
  useEffect(() => {
    if (loadIframe && baseUrl) {
      setLoadMode('configuring');
      setErrorMessage('');

      configureProxy(baseUrl).then(success => {
        if (success) {
          setLoadMode('ready');
          setIframeKey(k => k + 1); // iframe 리로드
          console.log('[Preview] Proxy configured for:', baseUrl);
        } else {
          setLoadMode('error');
          setErrorMessage('Failed to configure proxy');
        }
      });
    } else {
      setLoadMode('idle');
      // 프록시 해제
      configureProxy(null);
    }

    return () => {
      // cleanup: 프록시 해제
      configureProxy(null);
    };
  }, [loadIframe, baseUrl, configureProxy]);

  // Bridge 응답 전송
  const sendBridgeResponse = useCallback((requestId: string, response: unknown) => {
    if (!iframeRef.current?.contentWindow) return;

    try {
      iframeRef.current.contentWindow.postMessage({
        type: 'PREVIEW_BRIDGE_RESPONSE',
        message: {
          action: 'bridgeResponse',
          payload: {
            requestId,
            ...(response as Record<string, unknown>)
          }
        }
      }, '*');
    } catch (e) {
      console.error('[Preview] Failed to send response:', e);
    }
  }, []);

  const handleRetry = () => {
    if (baseUrl) {
      setLoadMode('configuring');
      configureProxy(baseUrl).then(success => {
        if (success) {
          setLoadMode('ready');
          setIframeKey(k => k + 1);
        } else {
          setLoadMode('error');
          setErrorMessage('Failed to configure proxy');
        }
      });
    }
  };

  // 플레이스홀더 모드
  if (!loadIframe) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center bg-slate-100"
        style={safeAreaEnabled ? {
          paddingTop: '20px',
          paddingBottom: '20px',
          backgroundColor: safeAreaBgColor
        } : undefined}
      >
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
  if (loadMode === 'error') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100">
        <svg className="w-12 h-12 text-slate-400 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path d="M12 8v4M12 16h.01" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium text-slate-600 mb-1">Failed to load</p>
        <p className="text-xs text-slate-400 mb-3">{errorMessage || 'URL could not be loaded'}</p>
        <button
          onClick={handleRetry}
          className="px-3 py-1.5 text-xs bg-slate-800 text-white rounded hover:bg-slate-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // 설정 중
  if (loadMode === 'configuring' || loadMode === 'idle') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mb-2" />
          <p className="text-xs text-slate-500">Setting up preview...</p>
        </div>
      </div>
    );
  }

  // 준비 완료 - 프록시 URL로 iframe 로드
  return (
    <div className="w-full h-full relative">
      {/* Bridge Status Indicator */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
        <button
          onClick={() => setShowBridgeConsole(!showBridgeConsole)}
          className="px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 bg-green-500/80 text-white"
          title="AppBridge injected via proxy"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          Bridge ✓
        </button>
      </div>

      {/* iframe via proxy */}
      <iframe
        key={iframeKey}
        ref={iframeRef}
        src="/preview/"
        className="w-full h-full border-0"
        title="WebView Preview"
      />

      {/* Bridge Console */}
      {showBridgeConsole && (
        <BridgeConsole onSendResponse={sendBridgeResponse} />
      )}
    </div>
  );
}
