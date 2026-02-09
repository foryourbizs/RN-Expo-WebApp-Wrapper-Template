// tools/config-editor/client/src/components/preview/screens/ErrorPreview.tsx
// 실제 React Native webview-container.tsx 에러 화면과 동일한 스타일 적용
import { useState } from 'react';
import { usePreview } from '../../../contexts/PreviewContext';
import type { AppConfig, ThemeConfig } from '../../../types/config';

interface ErrorPreviewProps {
  appConfig: AppConfig | null;
  themeConfig: ThemeConfig | null;
}

const DEFAULT_COLORS = {
  light: {
    errorBackground: '#fafafa',
    errorTitle: '#1a1a1a',
    errorMessage: '#666666',
    errorButton: '#007AFF',
  },
  dark: {
    errorBackground: '#1a1a1a',
    errorTitle: '#ffffff',
    errorMessage: '#aaaaaa',
    errorButton: '#007AFF',
  },
};

// 실제 webview-container.tsx의 getErrorInfo와 동일한 에러 타입 정의
const ERROR_TYPES = [
  {
    id: 'dns',
    label: 'DNS',
    title: '서버를 찾을 수 없습니다',
    message: '웹사이트 주소가 올바른지 확인해주세요.\n인터넷 연결 상태도 확인해보세요.',
    detail: 'URL: https://example.com',
  },
  {
    id: 'connection',
    label: '연결 거부',
    title: '서버에 연결할 수 없습니다',
    message: '서버가 응답하지 않습니다.\n잠시 후 다시 시도해주세요.',
    detail: 'URL: https://example.com',
  },
  {
    id: 'timeout',
    label: '타임아웃',
    title: '연결 시간 초과',
    message: '서버 응답이 너무 느립니다.\n네트워크 상태를 확인해주세요.',
    detail: 'URL: https://example.com',
  },
  {
    id: 'offline',
    label: '오프라인',
    title: '인터넷 연결 없음',
    message: 'Wi-Fi 또는 모바일 데이터 연결을\n확인해주세요.',
    detail: '',
  },
  {
    id: 'ssl',
    label: 'SSL',
    title: '보안 연결 실패',
    message: '안전한 연결을 설정할 수 없습니다.\n사이트 인증서에 문제가 있을 수 있습니다.',
    detail: 'URL: https://example.com',
  },
  {
    id: '403',
    label: '403',
    title: '페이지를 찾을 수 없습니다 (403)',
    message: '요청한 페이지가 존재하지 않거나\n접근 권한이 없습니다.',
    detail: 'URL: https://example.com/admin',
  },
  {
    id: '404',
    label: '404',
    title: '페이지를 찾을 수 없습니다 (404)',
    message: '요청한 페이지가 존재하지 않거나\n접근 권한이 없습니다.',
    detail: 'URL: https://example.com/missing',
  },
  {
    id: '500',
    label: '500',
    title: '서버 오류 (500)',
    message: '서버에 문제가 발생했습니다.\n잠시 후 다시 시도해주세요.',
    detail: 'URL: https://example.com/api',
  },
  {
    id: 'default',
    label: '기타',
    title: '페이지를 불러올 수 없습니다',
    message: '알 수 없는 오류가 발생했습니다.',
    detail: '코드: -1',
  },
];

export default function ErrorPreview({ appConfig, themeConfig }: ErrorPreviewProps) {
  const { themeMode } = usePreview();
  const [selectedError, setSelectedError] = useState(0);

  const colors = themeConfig?.colors?.[themeMode] || {};
  const d = DEFAULT_COLORS[themeMode];

  const backgroundColor = (colors as Record<string, string>).errorBackground || d.errorBackground;
  const titleColor = (colors as Record<string, string>).errorTitle || d.errorTitle;
  const messageColor = (colors as Record<string, string>).errorMessage || d.errorMessage;
  const buttonColor = (colors as Record<string, string>).errorButton || d.errorButton;

  const err = ERROR_TYPES[selectedError];
  const showRetryButton = appConfig?.error?.showRetryButton ?? true;
  const retryButtonText = appConfig?.error?.retryButtonText || '다시 시도';

  return (
    <div className="w-full h-full flex flex-col" style={{ backgroundColor }}>
      {/* 에러 타입 선택 탭 */}
      <div
        className="flex overflow-x-auto gap-0.5 px-2 py-1.5 border-b shrink-0"
        style={{ borderColor: messageColor + '30', backgroundColor: backgroundColor }}
      >
        {ERROR_TYPES.map((e, idx) => (
          <button
            key={e.id}
            onClick={() => setSelectedError(idx)}
            className={`
              px-2 py-1 text-[10px] rounded whitespace-nowrap transition-colors
              ${selectedError === idx
                ? 'font-medium'
                : 'opacity-60 hover:opacity-80'
              }
            `}
            style={{
              color: selectedError === idx ? buttonColor : messageColor,
              backgroundColor: selectedError === idx ? buttonColor + '15' : 'transparent',
            }}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* 에러 화면 - 실제 webview-container.tsx errorContainer와 동일 */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Title - 실제 RN: fontSize 20, fontWeight 600, mb 12 */}
        <h2
          className="text-xl font-semibold mb-3 text-center"
          style={{ color: titleColor }}
        >
          {err.title}
        </h2>

        {/* Message - 실제 RN: fontSize 15, lineHeight 22, mb 16 */}
        <p
          className="text-[15px] text-center leading-[22px] mb-4 whitespace-pre-line"
          style={{ color: messageColor }}
        >
          {err.message}
        </p>

        {/* Detail - 실제 RN: fontSize 11, fontFamily monospace, mb 24, px 20 */}
        {err.detail && (
          <p
            className="text-[11px] text-center font-mono mb-6 px-5"
            style={{ color: messageColor }}
          >
            {err.detail}
          </p>
        )}

        {/* Button - 실제 RN: borderRadius 12, px 32, py 14, mt 8 */}
        {showRetryButton && (
          <button
            className="px-8 py-3.5 rounded-xl text-base font-semibold text-white mt-2"
            style={{ backgroundColor: buttonColor }}
          >
            {retryButtonText}
          </button>
        )}
      </div>
    </div>
  );
}
