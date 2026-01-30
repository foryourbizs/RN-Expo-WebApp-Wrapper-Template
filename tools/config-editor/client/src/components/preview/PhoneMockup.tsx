// tools/config-editor/client/src/components/preview/PhoneMockup.tsx
import { ReactNode, useMemo } from 'react';
import { usePreview } from '../../contexts/PreviewContext';
import { DEVICE_SIZES } from '../../constants/devices';
import type { AppConfig } from '../../types/config';

interface PhoneMockupProps {
  children: ReactNode;
  appConfig: AppConfig | null;
}

export default function PhoneMockup({ children, appConfig }: PhoneMockupProps) {
  const { orientation, deviceSize, settings, highlightTarget, themeMode } = usePreview();

  const device = DEVICE_SIZES[deviceSize];
  const isLandscape = orientation === 'landscape';

  const frameWidth = isLandscape ? device.height : device.width;
  const frameHeight = isLandscape ? device.width : device.height;

  // Status Bar 설정
  const statusBarConfig = appConfig?.statusBar;
  const showStatusBar = settings.showStatusBar && (statusBarConfig?.visible !== false);
  const statusBarStyle = statusBarConfig?.style || 'dark';
  const statusBarOverlay = statusBarConfig?.overlayColor || 'transparent';

  // Navigation Bar 설정
  const navBarConfig = appConfig?.navigationBar;
  const showNavBar = settings.showNavBar && (navBarConfig?.visibility !== 'hidden');
  const navBarBgColor = themeMode === 'dark'
    ? (navBarConfig?.darkBackgroundColor || '#000000')
    : (navBarConfig?.backgroundColor || '#ffffff');
  const navBarButtonStyle = navBarConfig?.buttonStyle || 'dark';

  // 강조 스타일
  const highlightClass = 'ring-2 ring-blue-400 ring-offset-1 animate-pulse';

  const frameStyle = useMemo(() => ({
    width: `${frameWidth}px`,
    height: `${frameHeight}px`,
    transform: isLandscape ? 'rotate(0deg)' : 'rotate(0deg)',
    transition: 'width 200ms, height 200ms',
  }), [frameWidth, frameHeight, isLandscape]);

  return (
    <div
      className="relative bg-slate-900 rounded-[40px] border-2 border-slate-700 shadow-xl overflow-hidden"
      style={frameStyle}
    >
      {/* Status Bar */}
      {showStatusBar && (
        <div
          className={`
            absolute top-0 left-0 right-0 h-11 z-10 flex items-center justify-between px-6
            ${highlightTarget === 'statusBar' ? highlightClass : ''}
          `}
          style={{ backgroundColor: statusBarOverlay }}
        >
          <span className={`text-xs font-medium ${statusBarStyle === 'light' ? 'text-white' : 'text-black'}`}>
            9:41
          </span>
          <div className={`flex items-center gap-1 ${statusBarStyle === 'light' ? 'text-white' : 'text-black'}`}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v18l-8-9 8-9z" />
            </svg>
            <span className="text-xs">100%</span>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 17h20v2H2v-2zm0-4h20v2H2v-2zm0-4h20v2H2V9zm0-4h20v2H2V5z" />
            </svg>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          top: showStatusBar ? '44px' : 0,
          bottom: showNavBar ? '34px' : 0,
        }}
      >
        {children}
      </div>

      {/* Navigation Bar */}
      {showNavBar && (
        <div
          className={`
            absolute bottom-0 left-0 right-0 h-[34px] flex items-center justify-center gap-16
            ${highlightTarget === 'navBar' ? highlightClass : ''}
          `}
          style={{ backgroundColor: navBarBgColor }}
        >
          <button className={`text-lg ${navBarButtonStyle === 'light' ? 'text-white' : 'text-black'}`}>◀</button>
          <button className={`text-lg ${navBarButtonStyle === 'light' ? 'text-white' : 'text-black'}`}>●</button>
          <button className={`text-lg ${navBarButtonStyle === 'light' ? 'text-white' : 'text-black'}`}>▢</button>
        </div>
      )}
    </div>
  );
}
