// tools/config-editor/client/src/components/preview/PreviewControls.tsx
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreview, PreviewScreen } from '../../contexts/PreviewContext';
import { usePreviewNavigation } from '../../contexts/PreviewNavigationContext';
import { DEVICE_SIZES, DeviceSizeKey } from '../../constants/devices';

interface PreviewControlsProps {
  showThemeToggle?: boolean;
  showScreenSelector?: boolean;
}

export default function PreviewControls({ showThemeToggle = false, showScreenSelector = false }: PreviewControlsProps) {
  const { t } = useTranslation();
  const {
    currentScreen,
    orientation,
    deviceSize,
    themeMode,
    setCurrentScreen,
    toggleOrientation,
    setDeviceSize,
    toggleThemeMode,
  } = usePreview();
  const { handlers, isConnected } = usePreviewNavigation();

  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [showScreenMenu, setShowScreenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const screenMenuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowDeviceMenu(false);
      }
      if (screenMenuRef.current && !screenMenuRef.current.contains(e.target as Node)) {
        setShowScreenMenu(false);
      }
    };

    if (showDeviceMenu || showScreenMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDeviceMenu, showScreenMenu]);

  const screenLabels: Record<PreviewScreen, string> = {
    splash: 'Splash',
    webview: 'WebView',
    offline: 'Offline',
    theme: 'Theme',
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 네비게이션 버튼 - 항상 표시 */}
      <button
        onClick={() => handlers?.goBack()}
        className="p-1.5 rounded text-slate-600 hover:bg-slate-200 transition-colors"
        title={t('preview.back')}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={() => handlers?.goForward()}
        className="p-1.5 rounded text-slate-600 hover:bg-slate-200 transition-colors"
        title={t('preview.forward')}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
      <button
        onClick={() => handlers?.refresh()}
        className="p-1.5 rounded text-slate-600 hover:bg-slate-200 transition-colors"
        title={t('preview.refresh')}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
      <div className="w-px h-4 bg-slate-200 mx-1" />

      {/* 화면 선택 */}
      {showScreenSelector ? (
        <div className="relative" ref={screenMenuRef}>
          <button
            onClick={() => setShowScreenMenu(!showScreenMenu)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 rounded hover:bg-slate-200 transition-colors"
          >
            <span>{screenLabels[currentScreen]}</span>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showScreenMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-[100px]">
              {(['splash', 'offline', 'theme'] as PreviewScreen[]).map((screen) => (
                <button
                  key={screen}
                  onClick={() => {
                    setCurrentScreen(screen);
                    setShowScreenMenu(false);
                  }}
                  className={`
                    w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 transition-colors
                    ${currentScreen === screen ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}
                  `}
                >
                  {screenLabels[screen]}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <span className="text-xs text-slate-500 mr-2">
          {screenLabels[currentScreen]}
        </span>
      )}

      {/* 회전 토글 */}
      <button
        onClick={toggleOrientation}
        className={`
          p-1.5 rounded hover:bg-slate-200 transition-colors
          ${orientation === 'landscape' ? 'bg-blue-100 text-blue-600' : 'text-slate-600'}
        `}
        title={t('preview.rotate')}
      >
        <svg
          className={`w-4 h-4 transition-transform ${orientation === 'landscape' ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* 디바이스 크기 선택 */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowDeviceMenu(!showDeviceMenu)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 rounded hover:bg-slate-200 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round" />
          </svg>
          <span>{DEVICE_SIZES[deviceSize].label}</span>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDeviceMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
            {(Object.keys(DEVICE_SIZES) as DeviceSizeKey[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setDeviceSize(key);
                  setShowDeviceMenu(false);
                }}
                className={`
                  w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 transition-colors
                  ${deviceSize === key ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}
                `}
              >
                {DEVICE_SIZES[key].label}
                <span className="text-slate-400 ml-1">
                  ({DEVICE_SIZES[key].width}×{DEVICE_SIZES[key].height})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 다크모드 토글 (Theme 탭에서만) */}
      {showThemeToggle && (
        <button
          onClick={toggleThemeMode}
          className={`
            p-1.5 rounded hover:bg-slate-200 transition-colors
            ${themeMode === 'dark' ? 'bg-slate-800 text-yellow-400' : 'text-slate-600'}
          `}
          title={themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {themeMode === 'dark' ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
