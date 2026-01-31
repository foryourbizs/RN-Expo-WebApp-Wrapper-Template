// tools/config-editor/client/src/components/preview/FullscreenModal.tsx
import { useEffect } from 'react';
import { usePreview } from '../../contexts/PreviewContext';
import { DEVICE_SIZES } from '../../constants/devices';
import PhoneMockup from './PhoneMockup';
import PreviewControls from './PreviewControls';
import { SplashPreview, WebViewPreview, OfflinePreview, ThemePreview } from './screens';
import type { AppConfig, ThemeConfig } from '../../types/config';

interface FullscreenModalProps {
  appConfig: AppConfig | null;
  themeConfig: ThemeConfig | null;
  activeTab: string;
}

export default function FullscreenModal({ appConfig, themeConfig, activeTab }: FullscreenModalProps) {
  const { currentScreen, orientation, deviceSize, isFullscreen, setIsFullscreen } = usePreview();

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, setIsFullscreen]);

  if (!isFullscreen) return null;

  const device = DEVICE_SIZES[deviceSize];
  const isLandscape = orientation === 'landscape';
  const mockupWidth = isLandscape ? device.height : device.width;
  const mockupHeight = isLandscape ? device.width : device.height;

  // 화면의 80%까지 확대
  const maxWidth = window.innerWidth * 0.8;
  const maxHeight = window.innerHeight * 0.8;
  const scaleX = maxWidth / mockupWidth;
  const scaleY = maxHeight / mockupHeight;
  const scale = Math.min(scaleX, scaleY, 1.5); // 최대 1.5배

  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return <SplashPreview appConfig={appConfig} themeConfig={themeConfig} />;
      case 'offline':
        return <OfflinePreview appConfig={appConfig} themeConfig={themeConfig} />;
      case 'theme':
        return <ThemePreview themeConfig={themeConfig} />;
      case 'webview':
      default:
        return <WebViewPreview appConfig={appConfig} />;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center"
      onClick={() => setIsFullscreen(false)}
    >
      {/* Controls */}
      <div
        className="mb-4 p-3 bg-white rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <PreviewControls
          showThemeToggle={activeTab === 'theme'}
          showScreenSelector={activeTab === 'theme'}
        />
      </div>

      {/* Phone Mockup */}
      <div
        className="transition-transform duration-200"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
      >
        <PhoneMockup appConfig={appConfig}>
          {renderScreen()}
        </PhoneMockup>
      </div>

      {/* Close hint */}
      <p className="mt-4 text-white/60 text-sm">
        Press ESC or click outside to close
      </p>
    </div>
  );
}
