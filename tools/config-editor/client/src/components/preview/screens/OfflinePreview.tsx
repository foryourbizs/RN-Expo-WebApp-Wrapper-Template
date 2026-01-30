// tools/config-editor/client/src/components/preview/screens/OfflinePreview.tsx
import { usePreview } from '../../../contexts/PreviewContext';
import type { AppConfig } from '../../../types/config';

interface OfflinePreviewProps {
  appConfig: AppConfig | null;
}

export default function OfflinePreview({ appConfig }: OfflinePreviewProps) {
  const { themeMode } = usePreview();

  const offline = appConfig?.offline;

  const backgroundColor = themeMode === 'dark'
    ? (offline?.darkBackgroundColor || '#1a1a1a')
    : (offline?.backgroundColor || '#ffffff');

  const title = offline?.title || 'No Connection';
  const message = offline?.message || 'Please check your internet connection';
  const buttonText = offline?.retryButtonText || 'Retry';

  const textColor = themeMode === 'dark' ? '#ffffff' : '#000000';
  const subTextColor = themeMode === 'dark' ? '#9ca3af' : '#6b7280';

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center px-8"
      style={{ backgroundColor }}
    >
      {/* Wi-Fi Off Icon */}
      <svg
        className="w-16 h-16 mb-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke={subTextColor}
        strokeWidth="1.5"
      >
        <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9z" />
        <path d="M5 13l2 2c2.76-2.76 7.24-2.76 10 0l2-2C14.14 8.14 9.87 8.14 5 13z" />
        <path d="M9 17l3 3 3-3c-1.65-1.66-4.34-1.66-6 0z" />
        <line x1="2" y1="2" x2="22" y2="22" strokeLinecap="round" />
      </svg>

      {/* Title */}
      <h2
        className="text-lg font-semibold mb-2 text-center"
        style={{ color: textColor }}
      >
        {title}
      </h2>

      {/* Message */}
      <p
        className="text-sm text-center mb-6"
        style={{ color: subTextColor }}
      >
        {message}
      </p>

      {/* Retry Button */}
      <button
        className="px-6 py-2 rounded-lg text-sm font-medium text-white"
        style={{ backgroundColor: '#3b82f6' }}
      >
        {buttonText}
      </button>
    </div>
  );
}
