// tools/config-editor/client/src/components/preview/screens/SplashPreview.tsx
// 실제 React Native custom-splash.tsx와 동일한 스타일 적용
import { usePreview } from '../../../contexts/PreviewContext';
import type { AppConfig, ThemeConfig } from '../../../types/config';

interface SplashPreviewProps {
  appConfig: AppConfig | null;
  themeConfig: ThemeConfig | null;
}

const DEFAULT_COLORS = {
  light: {
    splashBackground: '#ffffff',
    splashText: 'rgba(0,0,0,0.6)',
    splashSpinner: 'rgba(0,122,255,0.9)',
  },
  dark: {
    splashBackground: '#000000',
    splashText: 'rgba(255,255,255,0.8)',
    splashSpinner: 'rgba(255,255,255,0.9)',
  },
};

export default function SplashPreview({ appConfig, themeConfig }: SplashPreviewProps) {
  const { themeMode } = usePreview();

  const splash = appConfig?.splash;
  const colors = themeConfig?.colors?.[themeMode] || {};
  const d = DEFAULT_COLORS[themeMode];

  const backgroundColor = (colors as Record<string, string>).splashBackground || d.splashBackground;
  const textColor = (colors as Record<string, string>).splashText || d.splashText;
  const spinnerColor = (colors as Record<string, string>).splashSpinner || d.splashSpinner;

  const mode = splash?.mode ?? 'default';
  const fullscreenImage = splash?.fullscreenImage;
  const loadingText = splash?.loadingText || '';
  const showIndicator = splash?.showLoadingIndicator !== false;
  const logoImage = splash?.logoImage;

  // 이미지 모드: 전체 화면 이미지만 표시
  if (mode === 'image' && fullscreenImage) {
    return (
      <div
        className="w-full h-full"
        style={{ backgroundColor }}
      >
        <img
          src={fullscreenImage}
          alt="Splash"
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }

  // 기본 모드: 로고/텍스트/스피너 표시
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

      {/* Loading Text - 실제 RN: fontSize 14, fontWeight 400, letterSpacing 0.5, mb 24 */}
      {loadingText && (
        <p
          className="text-sm mb-6"
          style={{ color: textColor, letterSpacing: '0.5px' }}
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
