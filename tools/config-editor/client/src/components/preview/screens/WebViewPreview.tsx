// tools/config-editor/client/src/components/preview/screens/WebViewPreview.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePreview } from '../../../contexts/PreviewContext';
import { getPreviewBridgeScript } from '../../../utils/previewBridge';
import BridgeConsole from '../BridgeConsole';
import type { AppConfig } from '../../../types/config';

interface WebViewPreviewProps {
  appConfig: AppConfig | null;
}

type LoadMode = 'idle' | 'fetching' | 'injected' | 'direct' | 'error';

export default function WebViewPreview({ appConfig }: WebViewPreviewProps) {
  const { settings, themeMode } = usePreview();
  const [loadMode, setLoadMode] = useState<LoadMode>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showBridgeConsole, setShowBridgeConsole] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const baseUrl = appConfig?.webview?.baseUrl || '';
  const loadIframe = settings.loadIframe && baseUrl;

  const safeArea = appConfig?.safeArea;
  const safeAreaEnabled = safeArea?.enabled;
  const safeAreaBgColor = themeMode === 'dark'
    ? (safeArea?.darkBackgroundColor || '#000000')
    : (safeArea?.backgroundColor || '#ffffff');

  // HTML에 브릿지 스크립트 주입
  const injectBridgeIntoHtml = useCallback((html: string, originalUrl: string): string => {
    const bridgeScript = `<script>${getPreviewBridgeScript()}</script>`;

    // <base> 태그 추가 (상대 경로 리소스 로드용)
    const baseTag = `<base href="${originalUrl}">`;

    // <head> 태그 찾아서 바로 뒤에 삽입
    const headMatch = html.match(/<head[^>]*>/i);
    if (headMatch) {
      const insertPos = headMatch.index! + headMatch[0].length;
      return html.slice(0, insertPos) + baseTag + bridgeScript + html.slice(insertPos);
    }

    // <head>가 없으면 <html> 바로 뒤에 삽입
    const htmlMatch = html.match(/<html[^>]*>/i);
    if (htmlMatch) {
      const insertPos = htmlMatch.index! + htmlMatch[0].length;
      return html.slice(0, insertPos) + '<head>' + baseTag + bridgeScript + '</head>' + html.slice(insertPos);
    }

    // 둘 다 없으면 맨 앞에 삽입
    return baseTag + bridgeScript + html;
  }, []);

  // URL에서 HTML 가져와서 브릿지 주입
  const fetchAndInject = useCallback(async () => {
    if (!baseUrl) return;

    setLoadMode('fetching');
    setErrorMessage('');

    // 타임아웃 설정
    timeoutRef.current = setTimeout(() => {
      setLoadMode('error');
      setErrorMessage('Request timeout');
    }, 15000);

    try {
      // 프록시 서버를 통해 HTML 가져오기 (CORS 우회)
      // 프록시가 없으면 직접 fetch 시도 (same-origin만 성공)
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(baseUrl)}`;

      let response: Response;
      let html: string;

      try {
        // 먼저 프록시 시도
        response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Proxy failed');
        html = await response.text();
      } catch {
        // 프록시 실패 시 직접 fetch 시도 (same-origin only)
        console.log('[Preview] Proxy not available, trying direct fetch...');
        try {
          response = await fetch(baseUrl, {
            mode: 'cors',
            credentials: 'omit'
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          html = await response.text();
        } catch (e) {
          // CORS 에러 - 직접 iframe 로드로 폴백 (브릿지 없이)
          console.log('[Preview] Direct fetch failed (CORS), falling back to direct iframe load');
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setLoadMode('direct');
          return;
        }
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // HTML에 브릿지 주입
      const injectedHtml = injectBridgeIntoHtml(html, baseUrl);

      // Blob URL 생성
      const blob = new Blob([injectedHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      // 이전 Blob URL 정리
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }

      setBlobUrl(url);
      setLoadMode('injected');
      console.log('[Preview] Bridge injected before page load');
    } catch (e) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('[Preview] Failed to fetch and inject:', e);
      setLoadMode('error');
      setErrorMessage(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [baseUrl, injectBridgeIntoHtml, blobUrl]);

  // loadIframe 변경 시 fetch 시작
  useEffect(() => {
    if (loadIframe) {
      fetchAndInject();
    } else {
      setLoadMode('idle');
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loadIframe, baseUrl]); // fetchAndInject 제외 (의도적)

  // 컴포넌트 언마운트 시 Blob URL 정리
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

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
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    fetchAndInject();
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

  // 로딩 중
  if (loadMode === 'fetching') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mb-2" />
          <p className="text-xs text-slate-500">Loading with AppBridge...</p>
        </div>
      </div>
    );
  }

  // 브릿지 주입 모드 (Blob URL 사용)
  if (loadMode === 'injected' && blobUrl) {
    return (
      <div className="w-full h-full relative">
        {/* Bridge Status Indicator */}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
          <button
            onClick={() => setShowBridgeConsole(!showBridgeConsole)}
            className="px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 bg-green-500/80 text-white"
            title="AppBridge injected before page load"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            Bridge ✓
          </button>
        </div>

        {/* iframe with injected HTML */}
        <iframe
          ref={iframeRef}
          src={blobUrl}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          title="WebView Preview"
        />

        {/* Bridge Console */}
        {showBridgeConsole && (
          <BridgeConsole onSendResponse={sendBridgeResponse} />
        )}
      </div>
    );
  }

  // 직접 로드 모드 (브릿지 없음 - CORS 실패 시 폴백)
  if (loadMode === 'direct') {
    return (
      <div className="w-full h-full relative">
        {/* Bridge Status Indicator */}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
          <button
            onClick={() => setShowBridgeConsole(!showBridgeConsole)}
            className="px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 bg-yellow-500/80 text-white"
            title="AppBridge not injected (cross-origin restriction)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-200" />
            Bridge ✗
          </button>
        </div>

        {/* Direct iframe (no bridge) */}
        <iframe
          ref={iframeRef}
          src={baseUrl}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="WebView Preview"
        />

        {/* Bridge Console (receive only) */}
        {showBridgeConsole && (
          <BridgeConsole />
        )}

        {/* CORS Warning */}
        <div className="absolute bottom-12 left-2 right-2 bg-yellow-100 border border-yellow-300 rounded p-2 text-[10px] text-yellow-800">
          <strong>Cross-origin restriction:</strong> AppBridge cannot be injected.
          The web app will show PC view instead of app view.
        </div>
      </div>
    );
  }

  return null;
}
