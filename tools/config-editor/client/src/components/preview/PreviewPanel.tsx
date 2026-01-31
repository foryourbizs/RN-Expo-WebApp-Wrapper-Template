// tools/config-editor/client/src/components/preview/PreviewPanel.tsx
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreview } from '../../contexts/PreviewContext';
import { DEVICE_SIZES, calculateScale } from '../../constants/devices';
import PhoneMockup from './PhoneMockup';
import PreviewControls from './PreviewControls';
import PreviewSettings from './PreviewSettings';
import { SplashPreview, WebViewPreview, OfflinePreview, ThemePreview } from './screens';
import type { AppConfig, ThemeConfig } from '../../types/config';

interface PreviewPanelProps {
  appConfig: AppConfig | null;
  themeConfig: ThemeConfig | null;
  activeTab: string;
}

export default function PreviewPanel({ appConfig, themeConfig, activeTab }: PreviewPanelProps) {
  const { t } = useTranslation();
  const { currentScreen, orientation, deviceSize, themeMode, setCurrentScreen, setIsFullscreen } = usePreview();

  // 탭에 따라 기본 화면 설정
  useEffect(() => {
    switch (activeTab) {
      case 'theme':
        setCurrentScreen('theme');
        break;
      case 'appSettings':
      case 'plugins':
      case 'build':
      default:
        setCurrentScreen('webview');
        break;
    }
  }, [activeTab, setCurrentScreen]);

  const device = DEVICE_SIZES[deviceSize];
  const isLandscape = orientation === 'landscape';
  const mockupWidth = isLandscape ? device.height : device.width;
  const mockupHeight = isLandscape ? device.width : device.height;

  // 컨테이너 크기에 맞게 스케일 계산 (최대 높이 600px 기준)
  const maxHeight = 600;
  const maxWidth = 400;
  const scale = calculateScale(mockupWidth, mockupHeight, maxWidth, maxHeight, orientation);

  const handleDoubleClick = useCallback(() => {
    setIsFullscreen(true);
  }, [setIsFullscreen]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return <SplashPreview appConfig={appConfig} themeConfig={themeConfig} />;
      case 'offline':
        return <OfflinePreview appConfig={appConfig} />;
      case 'theme':
        return <ThemePreview themeConfig={themeConfig} />;
      case 'webview':
      default:
        return <WebViewPreview appConfig={appConfig} />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 border-l border-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-medium text-slate-700">{t('preview.title')}</span>
          {/* Theme Mode Badge */}
          {activeTab === 'theme' && (
            <span className={`
              px-1.5 py-0.5 text-[10px] rounded
              ${themeMode === 'dark' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}
            `}>
              {themeMode === 'dark' ? 'Dark' : 'Light'}
            </span>
          )}
        </div>
        <PreviewSettings />
      </div>

      {/* Controls */}
      <div className="px-4 py-2 border-b border-slate-200 bg-white">
        <PreviewControls showThemeToggle={activeTab === 'theme'} />
      </div>

      {/* Preview Area */}
      <div
        className="flex-1 flex items-center justify-center p-4 overflow-hidden"
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
        >
          <PhoneMockup appConfig={appConfig}>
            {renderScreen()}
          </PhoneMockup>
        </div>
      </div>

      {/* Hint */}
      <div className="px-4 py-2 text-center">
        <span className="text-[10px] text-slate-400">
          {t('preview.doubleClickHint')}
        </span>
      </div>
    </div>
  );
}
