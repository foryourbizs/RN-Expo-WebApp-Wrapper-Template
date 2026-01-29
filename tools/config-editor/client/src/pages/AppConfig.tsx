import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '../hooks/useConfig';
import {
  TextInput,
  NumberInput,
  Toggle,
  Select,
  ColorPicker,
  TagInput,
  Accordion
} from '../components/form';
import type { AppConfig } from '../types/config';

interface AppConfigProps {
  onUnsavedChange: (hasChanges: boolean) => void;
}

export default function AppConfigPage({ onUnsavedChange }: AppConfigProps) {
  const { t } = useTranslation();
  const { data, setData, loading, error, saving, saveConfig, revert, hasChanges } =
    useConfig<AppConfig>('app');

  // 변경 사항 알림
  useEffect(() => {
    onUnsavedChange(hasChanges);
  }, [hasChanges, onUnsavedChange]);

  const updateField = useCallback(<T,>(path: string[], value: T) => {
    setData((prevData) => {
      if (!prevData) return prevData;
      const newData = structuredClone(prevData);
      let current: Record<string, unknown> = newData as Record<string, unknown>;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (!current[key] || typeof current[key] !== 'object') {
          current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
      }
      current[path[path.length - 1]] = value;
      return newData;
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
      {/* Webview Settings */}
      <Accordion title={t('app.webview.title')} defaultOpen>
        <TextInput
          label={t('app.webview.baseUrl')}
          value={data.webview?.baseUrl || ''}
          onChange={(v) => updateField(['webview', 'baseUrl'], v)}
          description={t('app.webview.baseUrlDesc')}
        />
        <TextInput
          label={t('app.webview.userAgent')}
          value={data.webview?.userAgent || ''}
          onChange={(v) => updateField(['webview', 'userAgent'], v)}
        />

        <Accordion title={t('app.webview.options')}>
          <Toggle
            label="JavaScript Enabled"
            value={data.webview?.options?.javaScriptEnabled ?? true}
            onChange={(v) => updateField(['webview', 'options', 'javaScriptEnabled'], v)}
          />
          <Toggle
            label="DOM Storage Enabled"
            value={data.webview?.options?.domStorageEnabled ?? true}
            onChange={(v) => updateField(['webview', 'options', 'domStorageEnabled'], v)}
          />
          <Toggle
            label="Third Party Cookies"
            value={data.webview?.options?.thirdPartyCookiesEnabled ?? true}
            onChange={(v) => updateField(['webview', 'options', 'thirdPartyCookiesEnabled'], v)}
          />
          <Toggle
            label="Cache Enabled"
            value={data.webview?.options?.cacheEnabled ?? true}
            onChange={(v) => updateField(['webview', 'options', 'cacheEnabled'], v)}
          />
          <Select
            label="Mixed Content Mode"
            value={data.webview?.options?.mixedContentMode || 'compatibility'}
            onChange={(v) => updateField(['webview', 'options', 'mixedContentMode'], v)}
            options={[
              { value: 'compatibility', label: 'Compatibility' },
              { value: 'never', label: 'Never' },
              { value: 'always', label: 'Always' }
            ]}
          />
        </Accordion>

        <Accordion title={t('app.webview.performance')}>
          <Select
            label="Android Layer Type"
            value={data.webview?.performance?.androidLayerType || 'hardware'}
            onChange={(v) => updateField(['webview', 'performance', 'androidLayerType'], v)}
            options={[
              { value: 'none', label: 'None' },
              { value: 'software', label: 'Software' },
              { value: 'hardware', label: 'Hardware' }
            ]}
          />
          <NumberInput
            label="Text Zoom"
            value={data.webview?.performance?.textZoom ?? 100}
            onChange={(v) => updateField(['webview', 'performance', 'textZoom'], v)}
            min={50}
            max={200}
            showSlider
          />
        </Accordion>
      </Accordion>

      {/* Offline Screen */}
      <Accordion title={t('app.offline.title')}>
        <Toggle
          label={t('app.offline.enabled')}
          value={data.offline?.enabled ?? true}
          onChange={(v) => updateField(['offline', 'enabled'], v)}
        />
        <TextInput
          label={t('app.offline.titleField')}
          value={data.offline?.title || ''}
          onChange={(v) => updateField(['offline', 'title'], v)}
        />
        <TextInput
          label={t('app.offline.message')}
          value={data.offline?.message || ''}
          onChange={(v) => updateField(['offline', 'message'], v)}
        />
        <ColorPicker
          label="Background Color"
          value={data.offline?.backgroundColor || '#ffffff'}
          onChange={(v) => updateField(['offline', 'backgroundColor'], v)}
        />
      </Accordion>

      {/* Status Bar */}
      <Accordion title={t('app.statusBar.title')}>
        <Toggle
          label={t('app.statusBar.visible')}
          value={data.statusBar?.visible ?? true}
          onChange={(v) => updateField(['statusBar', 'visible'], v)}
        />
        <Select
          label={t('app.statusBar.style')}
          value={data.statusBar?.style || 'dark'}
          onChange={(v) => updateField(['statusBar', 'style'], v)}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' }
          ]}
        />
      </Accordion>

      {/* Navigation Bar */}
      <Accordion title={t('app.navigationBar.title')}>
        <Select
          label={t('app.navigationBar.visibility')}
          value={data.navigationBar?.visibility || 'visible'}
          onChange={(v) => updateField(['navigationBar', 'visibility'], v)}
          options={[
            { value: 'visible', label: 'Visible' },
            { value: 'hidden', label: 'Hidden' }
          ]}
        />
        <ColorPicker
          label="Background Color"
          value={data.navigationBar?.backgroundColor || '#ffffff'}
          onChange={(v) => updateField(['navigationBar', 'backgroundColor'], v)}
        />
      </Accordion>

      {/* Safe Area */}
      <Accordion title={t('app.safeArea.title')}>
        <Toggle
          label={t('app.safeArea.enabled')}
          value={data.safeArea?.enabled ?? false}
          onChange={(v) => updateField(['safeArea', 'enabled'], v)}
        />
        <Select
          label={t('app.safeArea.edges')}
          value={data.safeArea?.edges || 'none'}
          onChange={(v) => updateField(['safeArea', 'edges'], v)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'top', label: 'Top' },
            { value: 'bottom', label: 'Bottom' },
            { value: 'none', label: 'None' }
          ]}
        />
      </Accordion>

      {/* Splash Screen */}
      <Accordion title={t('app.splash.title')}>
        <Toggle
          label={t('app.splash.enabled')}
          value={data.splash?.enabled ?? true}
          onChange={(v) => updateField(['splash', 'enabled'], v)}
        />
        <NumberInput
          label={t('app.splash.minDisplayTime')}
          value={data.splash?.minDisplayTime ?? 1000}
          onChange={(v) => updateField(['splash', 'minDisplayTime'], v)}
          min={0}
          max={5000}
          step={100}
        />
        <TextInput
          label={t('app.splash.loadingText')}
          value={data.splash?.loadingText || ''}
          onChange={(v) => updateField(['splash', 'loadingText'], v)}
        />
      </Accordion>

      {/* Security */}
      <Accordion title={t('app.security.title')}>
        <TagInput
          label={t('app.security.allowedOrigins')}
          value={data.security?.allowedOrigins || []}
          onChange={(v) => updateField(['security', 'allowedOrigins'], v)}
          placeholder="https://example.com"
        />
      </Accordion>

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
