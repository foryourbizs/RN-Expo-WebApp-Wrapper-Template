import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '../hooks/useConfig';
import { ColorPicker } from '../components/form';
import type { ThemeConfig } from '../types/config';

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
  const { data, setData, loading, error, saving, saveConfig, revert, hasChanges } =
    useConfig<ThemeConfig>('theme');

  // 변경 사항 알림 - useEffect로 처리
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

  if (loading) return <div className="p-4">{t('common.loading')}</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!data) return null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-8">
        {/* Light Mode */}
        <div className="p-4 bg-white border rounded-lg">
          <h3 className="text-lg font-medium mb-4">{t('theme.light')}</h3>
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
        <div className="p-4 bg-gray-800 border rounded-lg">
          <h3 className="text-lg font-medium mb-4 text-white">{t('theme.dark')}</h3>
          {COLOR_KEYS.map(key => (
            <div key={`dark-${key}`} className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {key}
              </label>
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded border-2 border-gray-600"
                  style={{ backgroundColor: getColor('dark', key) }}
                />
                <input
                  type="text"
                  value={getColor('dark', key)}
                  onChange={(e) => updateColor('dark', key, e.target.value)}
                  className="w-28 px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md font-mono text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reset Button */}
      <div className="mt-4">
        <button
          onClick={handleReset}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {t('theme.reset')}
        </button>
      </div>

      {/* Save/Revert Buttons */}
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <div>
          {hasChanges && (
            <span className="text-sm text-orange-500">{t('common.unsaved')}</span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={revert}
            disabled={!hasChanges}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {t('common.revert')}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
