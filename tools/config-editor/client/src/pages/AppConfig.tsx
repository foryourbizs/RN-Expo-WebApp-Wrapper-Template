import { useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../contexts/ConfigContext';
import { usePreview } from '../contexts/PreviewContext';
import { useAccordionSync } from '../hooks/useAccordionSync';
import {
  TextInput,
  NumberInput,
  Toggle,
  Select,
  ColorPicker,
  TagInput,
  Accordion,
  SaveRevertBar
} from '../components/form';

interface AppConfigProps {
  onUnsavedChange: (hasChanges: boolean) => void;
}

export default function AppConfigPage({ onUnsavedChange }: AppConfigProps) {
  const { t } = useTranslation();
  const { data, setData, loading, error, saving, save: saveConfig, revert, hasChanges } =
    useAppConfig();
  const { previewUrl, applyPreviewUrl } = usePreview();
  const { handleAccordionToggle } = useAccordionSync();

  // 현재 입력된 URL과 적용된 URL이 다른지 확인
  const currentBaseUrl = data?.webview?.baseUrl || '';
  const urlNeedsApply = useMemo(() => {
    if (!currentBaseUrl) return false;
    try {
      new URL(currentBaseUrl);
      return currentBaseUrl !== previewUrl;
    } catch {
      return false;
    }
  }, [currentBaseUrl, previewUrl]);

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
      <Accordion
        title={t('app.webview.title')}
        defaultOpen
        sectionId="webview"
        onToggle={(isOpen) => handleAccordionToggle('webview', isOpen)}
      >
        <TextInput
          label={t('app.webview.baseUrl')}
          value={data.webview?.baseUrl || ''}
          onChange={(v) => updateField(['webview', 'baseUrl'], v)}
          description={t('app.webview.baseUrlDesc')}
          action={
            <button
              onClick={() => applyPreviewUrl(currentBaseUrl)}
              disabled={!urlNeedsApply}
              className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                urlNeedsApply
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {t('preview.apply', '반영')}
            </button>
          }
        />
        <TextInput
          label={t('app.webview.userAgent')}
          value={data.webview?.userAgent || ''}
          onChange={(v) => updateField(['webview', 'userAgent'], v)}
          description={t('app.webview.userAgentDesc')}
        />

        <Accordion
          title={t('app.webview.options')}
          sectionId="webview-options"
          onToggle={(isOpen) => handleAccordionToggle('webview-options', isOpen)}
        >
          <Toggle
            label={t('app.webview.javaScriptEnabled')}
            value={data.webview?.options?.javaScriptEnabled ?? true}
            onChange={(v) => updateField(['webview', 'options', 'javaScriptEnabled'], v)}
            description={t('app.webview.javaScriptEnabledDesc')}
          />
          <Toggle
            label={t('app.webview.domStorageEnabled')}
            value={data.webview?.options?.domStorageEnabled ?? true}
            onChange={(v) => updateField(['webview', 'options', 'domStorageEnabled'], v)}
            description={t('app.webview.domStorageEnabledDesc')}
          />
          <Toggle
            label={t('app.webview.thirdPartyCookiesEnabled')}
            value={data.webview?.options?.thirdPartyCookiesEnabled ?? true}
            onChange={(v) => updateField(['webview', 'options', 'thirdPartyCookiesEnabled'], v)}
            description={t('app.webview.thirdPartyCookiesEnabledDesc')}
          />
          <Toggle
            label={t('app.webview.cacheEnabled')}
            value={data.webview?.options?.cacheEnabled ?? true}
            onChange={(v) => updateField(['webview', 'options', 'cacheEnabled'], v)}
            description={t('app.webview.cacheEnabledDesc')}
          />
          <Toggle
            label={t('app.webview.mediaPlaybackRequiresUserAction')}
            value={data.webview?.options?.mediaPlaybackRequiresUserAction ?? true}
            onChange={(v) => updateField(['webview', 'options', 'mediaPlaybackRequiresUserAction'], v)}
            description={t('app.webview.mediaPlaybackRequiresUserActionDesc')}
          />
          <Toggle
            label={t('app.webview.allowsInlineMediaPlayback')}
            value={data.webview?.options?.allowsInlineMediaPlayback ?? true}
            onChange={(v) => updateField(['webview', 'options', 'allowsInlineMediaPlayback'], v)}
            description={t('app.webview.allowsInlineMediaPlaybackDesc')}
          />
          <Toggle
            label={t('app.webview.allowsBackForwardNavigationGestures')}
            value={data.webview?.options?.allowsBackForwardNavigationGestures ?? true}
            onChange={(v) => updateField(['webview', 'options', 'allowsBackForwardNavigationGestures'], v)}
            description={t('app.webview.allowsBackForwardNavigationGesturesDesc')}
          />
          <Select
            label={t('app.webview.mixedContentMode')}
            value={data.webview?.options?.mixedContentMode || 'compatibility'}
            onChange={(v) => updateField(['webview', 'options', 'mixedContentMode'], v)}
            description={t('app.webview.mixedContentModeDesc')}
            options={[
              { value: 'compatibility', label: 'Compatibility' },
              { value: 'never', label: 'Never' },
              { value: 'always', label: 'Always' }
            ]}
          />
        </Accordion>

        <Accordion
          title={t('app.webview.performance')}
          sectionId="webview-performance"
          onToggle={(isOpen) => handleAccordionToggle('webview-performance', isOpen)}
        >
          <Select
            label={t('app.webview.androidLayerType')}
            value={data.webview?.performance?.androidLayerType || 'hardware'}
            onChange={(v) => updateField(['webview', 'performance', 'androidLayerType'], v)}
            description={t('app.webview.androidLayerTypeDesc')}
            options={[
              { value: 'none', label: 'None' },
              { value: 'software', label: 'Software' },
              { value: 'hardware', label: 'Hardware' }
            ]}
          />
          <Select
            label={t('app.webview.overScrollMode')}
            value={data.webview?.performance?.overScrollMode || 'never'}
            onChange={(v) => updateField(['webview', 'performance', 'overScrollMode'], v)}
            description={t('app.webview.overScrollModeDesc')}
            options={[
              { value: 'always', label: 'Always' },
              { value: 'content', label: 'Content' },
              { value: 'never', label: 'Never' }
            ]}
          />
          <NumberInput
            label={t('app.webview.textZoom')}
            value={data.webview?.performance?.textZoom ?? 100}
            onChange={(v) => updateField(['webview', 'performance', 'textZoom'], v)}
            description={t('app.webview.textZoomDesc')}
            min={50}
            max={200}
            showSlider
          />
          <Toggle
            label={t('app.webview.nestedScrollEnabled')}
            value={data.webview?.performance?.nestedScrollEnabled ?? false}
            onChange={(v) => updateField(['webview', 'performance', 'nestedScrollEnabled'], v)}
            description={t('app.webview.nestedScrollEnabledDesc')}
          />
          <Toggle
            label={t('app.webview.hideScrollIndicators')}
            value={data.webview?.performance?.hideScrollIndicators ?? true}
            onChange={(v) => updateField(['webview', 'performance', 'hideScrollIndicators'], v)}
            description={t('app.webview.hideScrollIndicatorsDesc')}
          />
          <Toggle
            label={t('app.webview.allowsFullscreenVideo')}
            value={data.webview?.performance?.allowsFullscreenVideo ?? true}
            onChange={(v) => updateField(['webview', 'performance', 'allowsFullscreenVideo'], v)}
            description={t('app.webview.allowsFullscreenVideoDesc')}
          />
          <Toggle
            label={t('app.webview.setSupportMultipleWindows')}
            value={data.webview?.performance?.setSupportMultipleWindows ?? false}
            onChange={(v) => updateField(['webview', 'performance', 'setSupportMultipleWindows'], v)}
            description={t('app.webview.setSupportMultipleWindowsDesc')}
          />
        </Accordion>
      </Accordion>

      {/* Offline Screen */}
      <Accordion
        title={t('app.offline.title')}
        sectionId="offline"
        onToggle={(isOpen) => handleAccordionToggle('offline', isOpen)}
      >
        <Toggle
          label={t('app.offline.enabled')}
          value={data.offline?.enabled ?? true}
          onChange={(v) => updateField(['offline', 'enabled'], v)}
          description={t('app.offline.enabledDesc')}
        />
        <TextInput
          label={t('app.offline.titleField')}
          value={data.offline?.title || ''}
          onChange={(v) => updateField(['offline', 'title'], v)}
          description={t('app.offline.titleFieldDesc')}
        />
        <TextInput
          label={t('app.offline.message')}
          value={data.offline?.message || ''}
          onChange={(v) => updateField(['offline', 'message'], v)}
          description={t('app.offline.messageDesc')}
        />
        <TextInput
          label={t('app.offline.retryButtonText')}
          value={data.offline?.retryButtonText || ''}
          onChange={(v) => updateField(['offline', 'retryButtonText'], v)}
          description={t('app.offline.retryButtonTextDesc')}
        />
        <Toggle
          label={t('app.offline.autoReconnect')}
          value={data.offline?.autoReconnect ?? true}
          onChange={(v) => updateField(['offline', 'autoReconnect'], v)}
          description={t('app.offline.autoReconnectDesc')}
        />
      </Accordion>

      {/* Status Bar */}
      <Accordion
        title={t('app.statusBar.title')}
        sectionId="statusBar"
        onToggle={(isOpen) => handleAccordionToggle('statusBar', isOpen)}
      >
        <Toggle
          label={t('app.statusBar.visible')}
          value={data.statusBar?.visible ?? true}
          onChange={(v) => updateField(['statusBar', 'visible'], v)}
          description={t('app.statusBar.visibleDesc')}
        />
        <Select
          label={t('app.statusBar.style')}
          value={data.statusBar?.style || 'dark'}
          onChange={(v) => updateField(['statusBar', 'style'], v)}
          description={t('app.statusBar.styleDesc')}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' }
          ]}
        />
        <Toggle
          label={t('app.statusBar.translucent')}
          value={data.statusBar?.translucent ?? true}
          onChange={(v) => updateField(['statusBar', 'translucent'], v)}
          description={t('app.statusBar.translucentDesc')}
        />
        <Toggle
          label={t('app.statusBar.overlapsWebView')}
          value={data.statusBar?.overlapsWebView ?? false}
          onChange={(v) => updateField(['statusBar', 'overlapsWebView'], v)}
          description={t('app.statusBar.overlapsWebViewDesc')}
        />
        <Toggle
          label={t('app.statusBar.showOverlay')}
          value={data.statusBar?.showOverlay ?? true}
          onChange={(v) => updateField(['statusBar', 'showOverlay'], v)}
          description={t('app.statusBar.showOverlayDesc')}
        />
        <TextInput
          label={t('app.statusBar.overlayColor')}
          value={data.statusBar?.overlayColor || 'rgba(0,0,0,0.5)'}
          onChange={(v) => updateField(['statusBar', 'overlayColor'], v)}
          description={t('app.statusBar.overlayColorDesc')}
        />
      </Accordion>

      {/* Navigation Bar */}
      <Accordion
        title={t('app.navigationBar.title')}
        sectionId="navigationBar"
        onToggle={(isOpen) => handleAccordionToggle('navigationBar', isOpen)}
      >
        <Select
          label={t('app.navigationBar.visibility')}
          value={data.navigationBar?.visibility || 'visible'}
          onChange={(v) => updateField(['navigationBar', 'visibility'], v)}
          description={t('app.navigationBar.visibilityDesc')}
          options={[
            { value: 'visible', label: 'Visible' },
            { value: 'hidden', label: 'Hidden' }
          ]}
        />
        <Select
          label={t('app.navigationBar.behavior')}
          value={data.navigationBar?.behavior || 'overlay-swipe'}
          onChange={(v) => updateField(['navigationBar', 'behavior'], v)}
          description={t('app.navigationBar.behaviorDesc')}
          options={[
            { value: 'overlay-swipe', label: 'Overlay Swipe' },
            { value: 'inset-swipe', label: 'Inset Swipe' }
          ]}
        />
        <Select
          label={t('app.navigationBar.buttonStyle')}
          value={data.navigationBar?.buttonStyle || 'dark'}
          onChange={(v) => updateField(['navigationBar', 'buttonStyle'], v)}
          description={t('app.navigationBar.buttonStyleDesc')}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' }
          ]}
        />
        <ColorPicker
          label={t('app.navigationBar.backgroundColor')}
          value={data.navigationBar?.backgroundColor || '#ffffff'}
          onChange={(v) => updateField(['navigationBar', 'backgroundColor'], v)}
          description={t('app.navigationBar.backgroundColorDesc')}
        />
        <ColorPicker
          label={t('app.navigationBar.darkBackgroundColor')}
          value={data.navigationBar?.darkBackgroundColor || '#000000'}
          onChange={(v) => updateField(['navigationBar', 'darkBackgroundColor'], v)}
          description={t('app.navigationBar.darkBackgroundColorDesc')}
        />
      </Accordion>

      {/* Safe Area */}
      <Accordion
        title={t('app.safeArea.title')}
        sectionId="safeArea"
        onToggle={(isOpen) => handleAccordionToggle('safeArea', isOpen)}
      >
        <Toggle
          label={t('app.safeArea.enabled')}
          value={data.safeArea?.enabled ?? false}
          onChange={(v) => updateField(['safeArea', 'enabled'], v)}
          description={t('app.safeArea.enabledDesc')}
        />
        <Select
          label={t('app.safeArea.edges')}
          value={data.safeArea?.edges || 'none'}
          onChange={(v) => updateField(['safeArea', 'edges'], v)}
          description={t('app.safeArea.edgesDesc')}
          options={[
            { value: 'all', label: 'All' },
            { value: 'top', label: 'Top' },
            { value: 'bottom', label: 'Bottom' },
            { value: 'none', label: 'None' }
          ]}
        />
        <ColorPicker
          label={t('app.safeArea.backgroundColor')}
          value={data.safeArea?.backgroundColor || '#ffffff'}
          onChange={(v) => updateField(['safeArea', 'backgroundColor'], v)}
          description={t('app.safeArea.backgroundColorDesc')}
        />
        <ColorPicker
          label={t('app.safeArea.darkBackgroundColor')}
          value={data.safeArea?.darkBackgroundColor || '#000000'}
          onChange={(v) => updateField(['safeArea', 'darkBackgroundColor'], v)}
          description={t('app.safeArea.darkBackgroundColorDesc')}
        />
      </Accordion>

      {/* Theme */}
      <Accordion
        title={t('app.theme.title')}
        sectionId="theme"
        onToggle={(isOpen) => handleAccordionToggle('theme', isOpen)}
      >
        <ColorPicker
          label={t('app.theme.loadingIndicatorColor')}
          value={data.theme?.loadingIndicatorColor || '#007AFF'}
          onChange={(v) => updateField(['theme', 'loadingIndicatorColor'], v)}
          description={t('app.theme.loadingIndicatorColorDesc')}
        />
      </Accordion>

      {/* Splash Screen */}
      <Accordion
        title={t('app.splash.title')}
        sectionId="splash"
        onToggle={(isOpen) => handleAccordionToggle('splash', isOpen)}
      >
        <Toggle
          label={t('app.splash.enabled')}
          value={data.splash?.enabled ?? true}
          onChange={(v) => updateField(['splash', 'enabled'], v)}
          description={t('app.splash.enabledDesc')}
        />
        <Select
          label={t('app.splash.mode')}
          value={data.splash?.mode ?? 'default'}
          onChange={(v) => updateField(['splash', 'mode'], v)}
          description={t('app.splash.modeDesc')}
          options={[
            { value: 'default', label: t('app.splash.modeDefault') },
            { value: 'image', label: t('app.splash.modeImage') },
          ]}
        />
        <NumberInput
          label={t('app.splash.minDisplayTime')}
          value={data.splash?.minDisplayTime ?? 1000}
          onChange={(v) => updateField(['splash', 'minDisplayTime'], v)}
          description={t('app.splash.minDisplayTimeDesc')}
          min={0}
          max={5000}
          step={100}
        />
        <NumberInput
          label={t('app.splash.fadeOutDuration')}
          value={data.splash?.fadeOutDuration ?? 300}
          onChange={(v) => updateField(['splash', 'fadeOutDuration'], v)}
          description={t('app.splash.fadeOutDurationDesc')}
          min={0}
          max={2000}
          step={50}
        />

        {/* 이미지 모드 전용 */}
        {(data.splash?.mode ?? 'default') === 'image' && (
          <TextInput
            label={t('app.splash.fullscreenImage')}
            value={data.splash?.fullscreenImage || ''}
            onChange={(v) => updateField(['splash', 'fullscreenImage'], v || null)}
            description={t('app.splash.fullscreenImageDesc')}
          />
        )}

        {/* 기본 모드 전용 */}
        {(data.splash?.mode ?? 'default') === 'default' && (
          <>
            <TextInput
              label={t('app.splash.logoImage')}
              value={data.splash?.logoImage || ''}
              onChange={(v) => updateField(['splash', 'logoImage'], v || null)}
              description={t('app.splash.logoImageDesc')}
            />
            <TextInput
              label={t('app.splash.loadingText')}
              value={data.splash?.loadingText || ''}
              onChange={(v) => updateField(['splash', 'loadingText'], v)}
              description={t('app.splash.loadingTextDesc')}
            />
            <Toggle
              label={t('app.splash.showLoadingIndicator')}
              value={data.splash?.showLoadingIndicator ?? true}
              onChange={(v) => updateField(['splash', 'showLoadingIndicator'], v)}
              description={t('app.splash.showLoadingIndicatorDesc')}
            />
          </>
        )}
      </Accordion>

      {/* Security */}
      <Accordion
        title={t('app.security.title')}
        sectionId="security"
        onToggle={(isOpen) => handleAccordionToggle('security', isOpen)}
      >
        <TagInput
          label={t('app.security.allowedOrigins')}
          value={data.security?.allowedOrigins || []}
          onChange={(v) => updateField(['security', 'allowedOrigins'], v)}
          description={t('app.security.allowedOriginsDesc')}
          placeholder="https://example.com"
        />
        <TagInput
          label={t('app.security.allowedSchemes')}
          value={data.security?.allowedSchemes || ['https', 'http', 'about']}
          onChange={(v) => updateField(['security', 'allowedSchemes'], v)}
          description={t('app.security.allowedSchemesDesc')}
          placeholder="https"
        />
        <TagInput
          label={t('app.security.blockedSchemes')}
          value={data.security?.blockedSchemes || ['data', 'blob', 'javascript', 'vbscript']}
          onChange={(v) => updateField(['security', 'blockedSchemes'], v)}
          description={t('app.security.blockedSchemesDesc')}
          placeholder="javascript"
        />
        <Toggle
          label={t('app.security.allowInsecureHttp')}
          value={data.security?.allowInsecureHttp ?? false}
          onChange={(v) => updateField(['security', 'allowInsecureHttp'], v)}
          description={t('app.security.allowInsecureHttpDesc')}
        />
        <Toggle
          label={t('app.security.debug')}
          value={data.security?.debug ?? false}
          onChange={(v) => updateField(['security', 'debug'], v)}
          description={t('app.security.debugDesc')}
        />
      </Accordion>

      {/* Debug */}
      <Accordion
        title={t('app.debug.title')}
        sectionId="debug"
        onToggle={(isOpen) => handleAccordionToggle('debug', isOpen)}
      >
        <Toggle
          label={t('app.debug.enabled')}
          value={data.debug?.enabled ?? false}
          onChange={(v) => updateField(['debug', 'enabled'], v)}
          description={t('app.debug.enabledDesc')}
        />
        <NumberInput
          label={t('app.debug.maxLogLines')}
          value={data.debug?.maxLogLines ?? 50}
          onChange={(v) => updateField(['debug', 'maxLogLines'], v)}
          description={t('app.debug.maxLogLinesDesc')}
          min={10}
          max={200}
        />
        <NumberInput
          label={t('app.debug.overlayOpacity')}
          value={data.debug?.overlayOpacity ?? 0.85}
          onChange={(v) => updateField(['debug', 'overlayOpacity'], v)}
          description={t('app.debug.overlayOpacityDesc')}
          min={0.1}
          max={1}
          step={0.05}
          showSlider
        />
        <NumberInput
          label={t('app.debug.fontSize')}
          value={data.debug?.fontSize ?? 11}
          onChange={(v) => updateField(['debug', 'fontSize'], v)}
          description={t('app.debug.fontSizeDesc')}
          min={8}
          max={16}
        />
        <Accordion
          title={t('app.debug.colors')}
          sectionId="debug-colors"
          onToggle={(isOpen) => handleAccordionToggle('debug-colors', isOpen)}
        >
          <ColorPicker
            label={t('app.debug.colorInfo')}
            value={data.debug?.colors?.info || '#3498db'}
            onChange={(v) => updateField(['debug', 'colors', 'info'], v)}
            description={t('app.debug.colorInfoDesc')}
          />
          <ColorPicker
            label={t('app.debug.colorWarn')}
            value={data.debug?.colors?.warn || '#f39c12'}
            onChange={(v) => updateField(['debug', 'colors', 'warn'], v)}
            description={t('app.debug.colorWarnDesc')}
          />
          <ColorPicker
            label={t('app.debug.colorError')}
            value={data.debug?.colors?.error || '#e74c3c'}
            onChange={(v) => updateField(['debug', 'colors', 'error'], v)}
            description={t('app.debug.colorErrorDesc')}
          />
          <ColorPicker
            label={t('app.debug.colorSuccess')}
            value={data.debug?.colors?.success || '#27ae60'}
            onChange={(v) => updateField(['debug', 'colors', 'success'], v)}
            description={t('app.debug.colorSuccessDesc')}
          />
          <ColorPicker
            label={t('app.debug.colorEvent')}
            value={data.debug?.colors?.event || '#9b59b6'}
            onChange={(v) => updateField(['debug', 'colors', 'event'], v)}
            description={t('app.debug.colorEventDesc')}
          />
          <ColorPicker
            label={t('app.debug.colorNav')}
            value={data.debug?.colors?.nav || '#1abc9c'}
            onChange={(v) => updateField(['debug', 'colors', 'nav'], v)}
            description={t('app.debug.colorNavDesc')}
          />
        </Accordion>
      </Accordion>

      <SaveRevertBar
        hasChanges={hasChanges}
        saving={saving}
        onSave={handleSave}
        onRevert={revert}
      />
    </div>
  );
}
