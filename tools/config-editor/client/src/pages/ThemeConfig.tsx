import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '../hooks/useConfig';
import { ColorPicker, SaveRevertBar } from '../components/form';
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
      {/* Theme Preview */}
      <div className="mb-8 p-6 bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Live Preview</h3>
        <div className="grid grid-cols-2 gap-6">
          {/* Light Mode Preview */}
          <div 
            className="rounded-xl p-4 shadow-lg transition-all duration-300"
            style={{ backgroundColor: getColor('light', 'background') }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <p className="text-sm font-medium mb-2" style={{ color: getColor('light', 'text') }}>Light Mode</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: getColor('light', 'tint') }} />
              <div className="w-6 h-6 rounded" style={{ backgroundColor: getColor('light', 'icon') }} />
            </div>
          </div>
          {/* Dark Mode Preview */}
          <div 
            className="rounded-xl p-4 shadow-lg transition-all duration-300"
            style={{ backgroundColor: getColor('dark', 'background') }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <p className="text-sm font-medium mb-2" style={{ color: getColor('dark', 'text') }}>Dark Mode</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: getColor('dark', 'tint') }} />
              <div className="w-6 h-6 rounded" style={{ backgroundColor: getColor('dark', 'icon') }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Light Mode */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">☀️</span>
            <h3 className="text-lg font-semibold text-slate-800">{t('theme.light')}</h3>
          </div>
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
        <div className="p-6 bg-slate-800 border border-slate-700 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">🌙</span>
            <h3 className="text-lg font-semibold text-white">{t('theme.dark')}</h3>
          </div>
          {COLOR_KEYS.map(key => (
            <div key={`dark-${key}`} className="mb-5">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {key}
              </label>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl border-2 border-slate-600 shadow-sm"
                  style={{ backgroundColor: getColor('dark', key) }}
                />
                <input
                  type="text"
                  value={getColor('dark', key)}
                  onChange={(e) => updateColor('dark', key, e.target.value)}
                  className="w-32 px-4 py-2.5 bg-slate-700 text-white border border-slate-600 rounded-lg 
                    font-mono text-sm uppercase
                    focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500
                    transition-all duration-200 outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reset Button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          🔄 {t('theme.reset')}
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
