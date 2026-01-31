// tools/config-editor/client/src/components/preview/screens/WebViewPreview.tsx
import { useState, useEffect, useRef } from 'react';
import { usePreview } from '../../../contexts/PreviewContext';
import type { AppConfig } from '../../../types/config';

interface WebViewPreviewProps {
  appConfig: AppConfig | null;
}

type LoadMode = 'idle' | 'configuring' | 'ready' | 'error';

export default function WebViewPreview({ appConfig }: WebViewPreviewProps) {
  const { settings, themeMode } = usePreview();
  const [loadMode, setLoadMode] = useState<LoadMode>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const configuredUrlRef = useRef<string | null>(null);

  const baseUrl = appConfig?.webview?.baseUrl || '';
  const loadIframe = settings.loadIframe && baseUrl;

  const safeArea = appConfig?.safeArea;
  const safeAreaEnabled = safeArea?.enabled;
  const safeAreaBgColor = themeMode === 'dark'
    ? (safeArea?.darkBackgroundColor || '#000000')
    : (safeArea?.backgroundColor || '#ffffff');

  // 프록시 설정
  useEffect(() => {
    // loadIframe이 꺼지거나 baseUrl이 없으면 idle
    if (!loadIframe || !baseUrl) {
      setLoadMode('idle');
      configuredUrlRef.current = null;
      return;
    }

    // 이미 같은 URL로 설정됐으면 바로 ready (서버 재시작 대응)
    if (configuredUrlRef.current === baseUrl) {
      setLoadMode('ready');
      return;
    }

    let cancelled = false;

    const configure = async () => {
      setLoadMode('configuring');
      setErrorMessage('');

      try {
        console.log('[WebViewPreview] Configuring proxy:', baseUrl);
        const response = await fetch('/api/proxy/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUrl: baseUrl })
        });

        if (cancelled) return;

        if (response.ok) {
          console.log('[WebViewPreview] Proxy configured successfully');
          configuredUrlRef.current = baseUrl;
          setLoadMode('ready');
          setIframeKey(k => k + 1);
        } else {
          const errData = await response.json().catch(() => ({}));
          console.error('[WebViewPreview] Proxy config failed:', errData);
          setLoadMode('error');
          setErrorMessage(errData.error || 'Failed to configure proxy');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[WebViewPreview] Configure error:', err);
        setLoadMode('error');
        setErrorMessage('Network error');
      }
    };

    configure();

    return () => {
      cancelled = true;
    };
  }, [loadIframe, baseUrl]);

  const handleRetry = async () => {
    if (!baseUrl) return;

    setLoadMode('configuring');
    setErrorMessage('');

    try {
      const response = await fetch('/api/proxy/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: baseUrl })
      });

      if (response.ok) {
        configuredUrlRef.current = baseUrl;
        setLoadMode('ready');
        setIframeKey(k => k + 1);
      } else {
        setLoadMode('error');
        setErrorMessage('Failed to configure proxy');
      }
    } catch {
      setLoadMode('error');
      setErrorMessage('Network error');
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
          <p className="text-xs text-slate-500">
            {loadMode === 'idle' ? 'Waiting...' : 'Configuring...'}
          </p>
          <div className="text-[10px] text-slate-400 mt-2 text-center space-y-0.5">
            <p>mode: {loadMode}</p>
            <p>config: {appConfig ? 'loaded' : 'loading'}</p>
            <p>url: {baseUrl || '(empty)'}</p>
            <p>iframe: {settings.loadIframe ? 'on' : 'off'}</p>
          </div>
        </div>
      </div>
    );
  }

  // 준비 완료 - iframe만 표시
  return (
    <iframe
      key={iframeKey}
      src="/preview/"
      className="w-full h-full border-0"
      title="WebView Preview"
    />
  );
}
