// tools/config-editor/client/src/components/preview/screens/SplashPreview.tsx
import { usePreview } from '../../../contexts/PreviewContext';
import type { AppConfig, ThemeConfig } from '../../../types/config';

interface SplashPreviewProps {
  appConfig: AppConfig | null;
  themeConfig: ThemeConfig | null;
}

// themeConfig은 향후 theme 색상 사용 시 활용 예정
export default function SplashPreview({ appConfig, themeConfig: _themeConfig }: SplashPreviewProps) {
  const { themeMode } = usePreview();

  const splash = appConfig?.splash;
  const theme = appConfig?.theme;

  const backgroundColor = themeMode === 'dark'
    ? (splash?.darkBackgroundColor || '#000000')
    : (splash?.backgroundColor || '#ffffff');

  const indicatorColor = theme?.loadingIndicatorColor || '#007AFF';
  const loadingText = splash?.loadingText || '';
  const showIndicator = splash?.showLoadingIndicator !== false;
  const logoImage = splash?.logoImage;

  const textColor = themeMode === 'dark' ? '#ffffff' : '#000000';

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center"
      style={{ backgroundColor }}
    >
      {/* Logo */}
      {logoImage ? (
        <img
          src={logoImage}
          alt="App Logo"
          className="w-24 h-24 object-contain mb-4"
          onError={(e) => {
            // 이미지 로드 실패 시 기본 아이콘 표시
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div
          className="w-24 h-24 rounded-2xl mb-4 flex items-center justify-center"
          style={{ backgroundColor: indicatorColor }}
        >
          <span className="text-white text-3xl font-bold">A</span>
        </div>
      )}

      {/* Loading Text */}
      {loadingText && (
        <p
          className="text-sm mb-4"
          style={{ color: textColor }}
        >
          {loadingText}
        </p>
      )}

      {/* Loading Indicator */}
      {showIndicator && (
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: indicatorColor, animationDelay: '0ms' }}
          />
          <div
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: indicatorColor, animationDelay: '150ms' }}
          />
          <div
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: indicatorColor, animationDelay: '300ms' }}
          />
        </div>
      )}
    </div>
  );
}
