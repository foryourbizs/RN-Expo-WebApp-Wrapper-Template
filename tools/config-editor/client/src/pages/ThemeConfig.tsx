import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeConfig } from '../contexts/ConfigContext';
import { ColorPicker, SaveRevertBar } from '../components/form';

interface ThemeConfigProps {
  onUnsavedChange: (hasChanges: boolean) => void;
}

// 기본 색상값
const DEFAULT_COLORS = {
  light: {
    splashBackground: '#ffffff',
    splashText: 'rgba(0,0,0,0.6)',
    splashSpinner: 'rgba(0,122,255,0.9)',
    offlineBackground: '#ffffff',
    offlineText: '#333333',
    offlineSubText: '#666666',
    offlineButton: '#007AFF',
    errorBackground: '#fafafa',
    errorTitle: '#1a1a1a',
    errorMessage: '#666666',
    errorButton: '#007AFF',
    loadingIndicator: '#007AFF',
  },
  dark: {
    splashBackground: '#000000',
    splashText: 'rgba(255,255,255,0.8)',
    splashSpinner: 'rgba(255,255,255,0.9)',
    offlineBackground: '#1a1a1a',
    offlineText: '#ffffff',
    offlineSubText: '#aaaaaa',
    offlineButton: '#007AFF',
    errorBackground: '#1a1a1a',
    errorTitle: '#ffffff',
    errorMessage: '#aaaaaa',
    errorButton: '#007AFF',
    loadingIndicator: '#007AFF',
  },
};

type ColorKey = keyof typeof DEFAULT_COLORS.light;

// 화면별 색상 그룹
const COLOR_GROUPS = [
  {
    id: 'splash',
    keys: ['splashBackground', 'splashText', 'splashSpinner'] as ColorKey[],
  },
  {
    id: 'offline',
    keys: ['offlineBackground', 'offlineText', 'offlineSubText', 'offlineButton'] as ColorKey[],
  },
  {
    id: 'error',
    keys: ['errorBackground', 'errorTitle', 'errorMessage', 'errorButton'] as ColorKey[],
  },
  {
    id: 'loading',
    keys: ['loadingIndicator'] as ColorKey[],
  },
];

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
    return (data?.colors?.[mode] as Record<string, string>)?.[key] || DEFAULT_COLORS[mode][key];
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
      {/* 설명 문구 */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-700">
          {t('theme.description')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Light Mode */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-800 px-1">{t('theme.light')}</h3>

          {COLOR_GROUPS.map(group => (
            <div key={`light-${group.id}`} className="p-3 bg-white border border-slate-200 rounded-lg">
              <h4 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
                {t(`theme.group.${group.id}`)}
              </h4>
              {group.keys.map(key => (
                <ColorPicker
                  key={`light-${key}`}
                  label={t(`theme.${key}`)}
                  value={getColor('light', key)}
                  onChange={(v) => updateColor('light', key, v)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Dark Mode */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white px-1">{t('theme.dark')}</h3>

          {COLOR_GROUPS.map(group => (
            <div key={`dark-${group.id}`} className="p-3 bg-slate-800 border border-slate-700 rounded-lg">
              <h4 className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                {t(`theme.group.${group.id}`)}
              </h4>
              {group.keys.map(key => (
                <div key={`dark-${key}`} className="mb-2 last:mb-0">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {t(`theme.${key}`)}
                  </label>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded border border-slate-600 flex-shrink-0"
                      style={{ backgroundColor: getColor('dark', key) }}
                    />
                    <input
                      type="text"
                      value={getColor('dark', key)}
                      onChange={(e) => updateColor('dark', key, e.target.value)}
                      className="flex-1 px-2 py-1 text-xs bg-slate-700 text-white border border-slate-600 rounded font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 text-center">
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
