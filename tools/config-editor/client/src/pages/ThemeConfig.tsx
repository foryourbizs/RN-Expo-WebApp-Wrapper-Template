import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeConfig } from '../contexts/ConfigContext';
import { ColorPicker, SaveRevertBar } from '../components/form';

interface ThemeConfigProps {
  onUnsavedChange: (hasChanges: boolean) => void;
}

const DEFAULT_COLORS = {
  light: {
    text: '#11181C',
    background: '#ffffff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4'
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#ffffff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#ffffff'
  }
};

const COLOR_KEYS = ['text', 'background', 'tint', 'icon', 'tabIconDefault', 'tabIconSelected'] as const;
type ColorKey = typeof COLOR_KEYS[number];

export default function ThemeConfigPage({ onUnsavedChange }: ThemeConfigProps) {
  const { t } = useTranslation();
  const { data, setData, loading, error, saving, save: saveConfig, revert, hasChanges } =
    useThemeConfig();

  useEffect(() => {
    onUnsavedChange(hasChanges);
  }, [hasChanges, onUnsavedChange]);

  const updateColor = useCallback((mode: 'light' | 'dark', key: ColorKey, value: string) => {
    setData((prevData) => {
      if (!prevData) return prevData;
      return {
        ...prevData,
        colors: {
          ...prevData.colors,
          [mode]: {
            ...prevData.colors?.[mode],
            [key]: value
          }
        }
      };
    });
  }, [setData]);

  const getColor = useCallback((mode: 'light' | 'dark', key: ColorKey) => {
    return data?.colors?.[mode]?.[key] || DEFAULT_COLORS[mode][key];
  }, [data]);

  const handleReset = useCallback(() => {
    setData((prevData) => {
      if (!prevData) return prevData;
      return {
        ...prevData,
        colors: { light: {}, dark: {} }
      };
    });
  }, [setData]);

  const handleSave = useCallback(async () => {
    if (data) await saveConfig(data);
  }, [data, saveConfig]);

  if (loading) return <div className="p-4 text-sm">{t('common.loading')}</div>;
  if (error) return <div className="p-4 text-sm text-red-500">{error}</div>;
  if (!data) return null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        {/* Light Mode */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <h3 className="text-sm font-medium text-slate-800 mb-3">{t('theme.light')}</h3>
          {COLOR_KEYS.map(key => (
            <ColorPicker
              key={`light-${key}`}
              label={key}
              value={getColor('light', key)}
              onChange={(v) => updateColor('light', key, v)}
            />
          ))}
        </div>

        {/* Dark Mode */}
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
          <h3 className="text-sm font-medium text-white mb-3">{t('theme.dark')}</h3>
          {COLOR_KEYS.map(key => (
            <div key={`dark-${key}`} className="mb-3">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {key}
              </label>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded border border-slate-600"
                  style={{ backgroundColor: getColor('dark', key) }}
                />
                <input
                  type="text"
                  value={getColor('dark', key)}
                  onChange={(e) => updateColor('dark', key, e.target.value)}
                  className="w-24 px-2 py-1 text-xs bg-slate-700 text-white border border-slate-600 rounded font-mono uppercase"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 text-center">
        <button
          onClick={handleReset}
          className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
        >
          {t('theme.reset')}
        </button>
      </div>

      <SaveRevertBar
        hasChanges={hasChanges}
        saving={saving}
        onSave={handleSave}
        onRevert={revert}
      />
    </div>
  );
}
