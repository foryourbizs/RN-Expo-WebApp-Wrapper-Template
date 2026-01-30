// tools/config-editor/client/src/components/preview/screens/ThemePreview.tsx
import { usePreview } from '../../../contexts/PreviewContext';
import type { ThemeConfig } from '../../../types/config';

interface ThemePreviewProps {
  themeConfig: ThemeConfig | null;
}

const DEFAULT_COLORS = {
  light: {
    text: '#11181C',
    background: '#ffffff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#ffffff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#ffffff',
  },
};

export default function ThemePreview({ themeConfig }: ThemePreviewProps) {
  const { themeMode } = usePreview();

  const colors = themeConfig?.colors?.[themeMode] || {};
  const defaultColors = DEFAULT_COLORS[themeMode];

  const textColor = colors.text || defaultColors.text;
  const backgroundColor = colors.background || defaultColors.background;
  const tintColor = colors.tint || defaultColors.tint;
  const iconColor = colors.icon || defaultColors.icon;
  const tabIconDefault = colors.tabIconDefault || defaultColors.tabIconDefault;
  const tabIconSelected = colors.tabIconSelected || defaultColors.tabIconSelected;

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ backgroundColor }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: iconColor + '30' }}>
        <h1 className="text-lg font-semibold" style={{ color: textColor }}>
          Sample App
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {/* Text Samples */}
        <div className="mb-4">
          <p className="text-sm mb-1" style={{ color: textColor }}>
            This is primary text color
          </p>
          <p className="text-xs" style={{ color: iconColor }}>
            This is secondary text (icon color)
          </p>
        </div>

        {/* Button */}
        <button
          className="w-full py-2 rounded-lg text-sm font-medium text-white mb-4"
          style={{ backgroundColor: tintColor }}
        >
          Primary Button (Tint)
        </button>

        {/* Card */}
        <div
          className="p-3 rounded-lg mb-4"
          style={{ backgroundColor: iconColor + '15' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={iconColor}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-sm font-medium" style={{ color: textColor }}>
              Icon Color Sample
            </span>
          </div>
          <p className="text-xs" style={{ color: iconColor }}>
            Card with icon and text samples
          </p>
        </div>

        {/* Color Swatches */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Text', color: textColor },
            { label: 'Tint', color: tintColor },
            { label: 'Icon', color: iconColor },
          ].map(({ label, color }) => (
            <div key={label} className="text-center">
              <div
                className="w-full h-8 rounded mb-1"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px]" style={{ color: iconColor }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Bar */}
      <div
        className="flex items-center justify-around py-2 border-t"
        style={{ borderColor: iconColor + '30' }}
      >
        {[
          { icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', selected: true },
          { icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', selected: false },
          { icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', selected: false },
        ].map((tab, i) => (
          <div key={i} className="flex flex-col items-center">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke={tab.selected ? tabIconSelected : tabIconDefault}
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            <span
              className="text-[10px] mt-0.5"
              style={{ color: tab.selected ? tabIconSelected : tabIconDefault }}
            >
              {['Home', 'Search', 'Profile'][i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
