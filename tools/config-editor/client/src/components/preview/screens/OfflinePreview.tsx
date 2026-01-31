// tools/config-editor/client/src/components/preview/screens/OfflinePreview.tsx
// 실제 React Native offline-screen.tsx와 동일한 스타일 적용
import { usePreview } from '../../../contexts/PreviewContext';
import type { AppConfig } from '../../../types/config';

interface OfflinePreviewProps {
  appConfig: AppConfig | null;
}

export default function OfflinePreview({ appConfig }: OfflinePreviewProps) {
  const { themeMode } = usePreview();
  const isDark = themeMode === 'dark';

  const offline = appConfig?.offline;

  const backgroundColor = isDark
    ? (offline?.darkBackgroundColor || '#1a1a1a')
    : (offline?.backgroundColor || '#ffffff');

  const title = offline?.title || 'No Connection';
  const message = offline?.message || 'Please check your internet connection';
  const buttonText = offline?.retryButtonText || 'Retry';

  // 실제 RN과 동일한 색상
  const textColor = isDark ? '#ffffff' : '#333333';
  const subTextColor = isDark ? '#aaaaaa' : '#666666';

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center px-10"
      style={{ backgroundColor }}
    >
      {/* 이모지 아이콘 - 실제 RN과 동일 (📡, fontSize 64) */}
      <div className="mb-6">
        <span className="text-6xl">📡</span>
      </div>

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
      <button
        className="px-8 py-3.5 rounded-lg text-base font-semibold text-white"
        style={{ backgroundColor: '#007AFF' }}
      >
        {buttonText}
      </button>
    </div>
  );
}
