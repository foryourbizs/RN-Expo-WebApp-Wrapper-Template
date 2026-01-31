// tools/config-editor/client/src/components/preview/screens/SplashPreview.tsx
// 실제 React Native custom-splash.tsx와 동일한 스타일 적용
import { usePreview } from '../../../contexts/PreviewContext';
import type { AppConfig, ThemeConfig } from '../../../types/config';

interface SplashPreviewProps {
  appConfig: AppConfig | null;
  themeConfig: ThemeConfig | null;
}

export default function SplashPreview({ appConfig, themeConfig: _themeConfig }: SplashPreviewProps) {
  const { themeMode } = usePreview();
  const isDark = themeMode === 'dark';

  const splash = appConfig?.splash;

  const backgroundColor = isDark
    ? (splash?.darkBackgroundColor || '#000000')
    : (splash?.backgroundColor || '#ffffff');

  // 실제 RN과 동일한 색상 사용
  const textColor = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)';
  const spinnerColor = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,122,255,0.9)';

  const loadingText = splash?.loadingText || '';
  const showIndicator = splash?.showLoadingIndicator !== false;
  const logoImage = splash?.logoImage;

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center"
      style={{ backgroundColor }}
    >
      {/* Logo - 실제 RN: 120x120 */}
      {logoImage ? (
        <img
          src={logoImage}
          alt="App Logo"
          className="w-[120px] h-[120px] object-contain mb-6"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}

      {/* Loading Text - 실제 RN: fontSize 14, letterSpacing 0.5 */}
      {loadingText && (
        <p
          className="text-sm mb-6 tracking-wide"
          style={{ color: textColor }}
        >
          {loadingText}
        </p>
      )}

      {/* Arc Spinner - 실제 RN과 동일한 스타일 */}
      {showIndicator && (
        <div className="h-10 flex items-center justify-center">
          <div
            className="w-8 h-8 rounded-full animate-spin"
            style={{
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: `${spinnerColor}15`,
              borderTopColor: spinnerColor,
            }}
          />
        </div>
      )}
    </div>
  );
}
