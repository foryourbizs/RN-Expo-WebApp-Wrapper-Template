// tools/config-editor/client/src/components/preview/screens/ThemePreview.tsx
// 테마 색상이 실제로 적용되는 네이티브 UI 요소 미리보기

import { usePreview } from '../../../contexts/PreviewContext';
import type { ThemeConfig } from '../../../types/config';

interface ThemePreviewProps {
  themeConfig: ThemeConfig | null;
}

const DEFAULT_COLORS = {
  light: {
    splashBackground: '#ffffff',
    splashText: 'rgba(0,0,0,0.6)',
    splashSpinner: 'rgba(0,122,255,0.9)',
    offlineBackground: '#ffffff',
    offlineText: '#333333',
    offlineSubText: '#666666',
    offlineButton: '#007AFF',
    errorBackground: '#fafafa',
    errorTitle: '#1a1a1a',
    errorMessage: '#666666',
    errorButton: '#007AFF',
    loadingIndicator: '#007AFF',
  },
  dark: {
    splashBackground: '#000000',
    splashText: 'rgba(255,255,255,0.8)',
    splashSpinner: 'rgba(255,255,255,0.9)',
    offlineBackground: '#1a1a1a',
    offlineText: '#ffffff',
    offlineSubText: '#aaaaaa',
    offlineButton: '#007AFF',
    errorBackground: '#1a1a1a',
    errorTitle: '#ffffff',
    errorMessage: '#aaaaaa',
    errorButton: '#007AFF',
    loadingIndicator: '#007AFF',
  },
};

export default function ThemePreview({ themeConfig }: ThemePreviewProps) {
  const { themeMode } = usePreview();

  const colors = themeConfig?.colors?.[themeMode] || {};
  const d = DEFAULT_COLORS[themeMode];

  // 색상 가져오기 헬퍼
  const c = (key: keyof typeof d) => (colors as Record<string, string>)[key] || d[key];

  return (
    <div
      className="w-full h-full flex flex-col overflow-auto"
      style={{ backgroundColor: c('splashBackground') }}
    >
      {/* 스플래시 화면 미리보기 */}
      <div className="p-4 border-b" style={{ borderColor: c('offlineSubText') + '30' }}>
        <h3 className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: c('offlineSubText') }}>
          Splash Screen
        </h3>
        <div
          className="rounded-lg p-6 flex flex-col items-center justify-center"
          style={{ backgroundColor: c('splashBackground') }}
        >
          <p className="text-xs mb-3" style={{ color: c('splashText') }}>Loading...</p>
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{
              borderColor: c('splashSpinner') + '30',
              borderTopColor: c('splashSpinner')
            }}
          />
        </div>
      </div>

      {/* 오프라인 화면 미리보기 */}
      <div className="p-4 border-b" style={{ borderColor: c('offlineSubText') + '30' }}>
        <h3 className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: c('offlineSubText') }}>
          Offline Screen
        </h3>
        <div
          className="rounded-lg p-4 flex flex-col items-center"
          style={{ backgroundColor: c('offlineBackground') }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: c('offlineText') }}>
            No Connection
          </p>
          <p className="text-[10px] mb-3 text-center" style={{ color: c('offlineSubText') }}>
            Please check your internet
          </p>
          <button
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: c('offlineButton') }}
          >
            Retry
          </button>
        </div>
      </div>

      {/* 에러 화면 미리보기 */}
      <div className="p-4 border-b" style={{ borderColor: c('offlineSubText') + '30' }}>
        <h3 className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: c('offlineSubText') }}>
          Error Screen
        </h3>
        <div
          className="rounded-lg p-4 flex flex-col items-center"
          style={{ backgroundColor: c('errorBackground') }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: c('errorTitle') }}>
            페이지를 불러올 수 없습니다
          </p>
          <p className="text-[10px] mb-3 text-center" style={{ color: c('errorMessage') }}>
            알 수 없는 오류가 발생했습니다.
          </p>
          <button
            className="px-4 py-1.5 rounded-xl text-xs font-medium text-white"
            style={{ backgroundColor: c('errorButton') }}
          >
            다시 시도
          </button>
        </div>
      </div>

      {/* 로딩 인디케이터 미리보기 */}
      <div className="p-4">
        <h3 className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: c('offlineSubText') }}>
          Loading Indicator
        </h3>
        <div className="flex items-center justify-center gap-4">
          <div
            className="w-8 h-8 rounded-full border-3 animate-spin"
            style={{
              borderWidth: '3px',
              borderColor: c('loadingIndicator') + '30',
              borderTopColor: c('loadingIndicator')
            }}
          />
          <span className="text-xs" style={{ color: c('offlineSubText') }}>
            {c('loadingIndicator')}
          </span>
        </div>
      </div>
    </div>
  );
}
