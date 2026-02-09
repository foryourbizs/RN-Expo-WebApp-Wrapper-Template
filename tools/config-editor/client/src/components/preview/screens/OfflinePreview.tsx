// tools/config-editor/client/src/components/preview/screens/OfflinePreview.tsx
// 실제 React Native offline-screen.tsx와 동일한 스타일 적용
import { usePreview } from '../../../contexts/PreviewContext';
import type { AppConfig, ThemeConfig } from '../../../types/config';

interface OfflinePreviewProps {
  appConfig: AppConfig | null;
  themeConfig: ThemeConfig | null;
}

const DEFAULT_COLORS = {
  light: {
    offlineBackground: '#ffffff',
    offlineText: '#333333',
    offlineSubText: '#666666',
    offlineButton: '#007AFF',
  },
  dark: {
    offlineBackground: '#1a1a1a',
    offlineText: '#ffffff',
    offlineSubText: '#aaaaaa',
    offlineButton: '#007AFF',
  },
};

export default function OfflinePreview({ appConfig, themeConfig }: OfflinePreviewProps) {
  const { themeMode } = usePreview();

  const offline = appConfig?.offline;
  const colors = themeConfig?.colors?.[themeMode] || {};
  const d = DEFAULT_COLORS[themeMode];

  const backgroundColor = (colors as Record<string, string>).offlineBackground || d.offlineBackground;
  const textColor = (colors as Record<string, string>).offlineText || d.offlineText;
  const subTextColor = (colors as Record<string, string>).offlineSubText || d.offlineSubText;
  const buttonColor = (colors as Record<string, string>).offlineButton || d.offlineButton;

  const title = offline?.title || 'No Connection';
  const message = offline?.message || 'Please check your internet connection';
  const buttonText = offline?.retryButtonText || 'Retry';
  const showRetryButton = offline?.showRetryButton ?? true;

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center px-10"
      style={{ backgroundColor }}
    >
      {/* Title - 실제 RN: fontSize 20, fontWeight bold */}
      <h2
        className="text-xl font-bold mb-3 text-center"
        style={{ color: textColor }}
      >
        {title}
      </h2>

      {/* Message - 실제 RN: fontSize 14, lineHeight 20 */}
      <p
        className="text-sm text-center leading-5 mb-8"
        style={{ color: subTextColor }}
      >
        {message}
      </p>

      {/* Retry Button - 실제 RN: #007AFF, px 32, py 14, borderRadius 8 */}
      {showRetryButton && (
        <button
          className="px-8 py-3.5 rounded-lg text-base font-semibold text-white"
          style={{ backgroundColor: buttonColor }}
        >
          {buttonText}
        </button>
      )}
    </div>
  );
}
