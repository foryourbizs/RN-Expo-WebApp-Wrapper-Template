// tools/config-editor/client/src/App.tsx
import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from './components/Layout';
import TabNav from './components/TabNav';
import AppConfigPage from './pages/AppConfig';
import ThemeConfigPage from './pages/ThemeConfig';
import PluginsConfigPage from './pages/PluginsConfig';
import BuildConfigPage from './pages/BuildConfig';
import { PreviewPanel, FullscreenModal } from './components/preview';
import { PreviewProvider } from './contexts/PreviewContext';
import { PreviewNavigationProvider } from './contexts/PreviewNavigationContext';
import { ConfigProvider, useAppConfig, useThemeConfig } from './contexts/ConfigContext';

function AppContent() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('appSettings');
  const [unsavedTabs, setUnsavedTabs] = useState<string[]>([]);
  const isBuildingRef = useRef(false);

  // 공유 Context에서 config 데이터 로드 (변경 즉시 반영)
  const { data: appConfig } = useAppConfig();
  const { data: themeConfig } = useThemeConfig();

  const handleUnsavedChange = useCallback((tab: string) => (hasChanges: boolean) => {
    setUnsavedTabs(prev => {
      if (hasChanges && !prev.includes(tab)) {
        return [...prev, tab];
      }
      if (!hasChanges && prev.includes(tab)) {
        return prev.filter(t => t !== tab);
      }
      return prev;
    });
  }, []);

  // 빌드 상태 변경 핸들러
  const handleBuildingChange = useCallback((building: boolean) => {
    isBuildingRef.current = building;
  }, []);

  // 탭 변경 핸들러 (빌드 중일 때 경고)
  const handleTabChange = useCallback((newTab: string) => {
    if (isBuildingRef.current && activeTab === 'build') {
      const confirmed = window.confirm(t('build.leaveWhileBuilding'));
      if (!confirmed) return;
    }
    setActiveTab(newTab);
  }, [activeTab, t]);

  const previewPanel = (
    <PreviewPanel
      appConfig={appConfig}
      themeConfig={themeConfig}
      activeTab={activeTab}
    />
  );

  return (
    <>
      <Layout previewPanel={previewPanel}>
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <TabNav
            activeTab={activeTab}
            onTabChange={handleTabChange}
            unsavedTabs={unsavedTabs}
          />
          <div className="p-6">
            {activeTab === 'appSettings' && (
              <AppConfigPage onUnsavedChange={handleUnsavedChange('appSettings')} />
            )}
            {activeTab === 'theme' && (
              <ThemeConfigPage onUnsavedChange={handleUnsavedChange('theme')} />
            )}
            {activeTab === 'plugins' && (
              <PluginsConfigPage onUnsavedChange={handleUnsavedChange('plugins')} />
            )}
            {activeTab === 'build' && (
              <BuildConfigPage onBuildingChange={handleBuildingChange} />
            )}
          </div>
        </div>
      </Layout>
      <FullscreenModal
        appConfig={appConfig}
        themeConfig={themeConfig}
        activeTab={activeTab}
      />
    </>
  );
}

export default function App() {
  return (
    <ConfigProvider>
      <PreviewProvider>
        <PreviewNavigationProvider>
          <AppContent />
        </PreviewNavigationProvider>
      </PreviewProvider>
    </ConfigProvider>
  );
}
