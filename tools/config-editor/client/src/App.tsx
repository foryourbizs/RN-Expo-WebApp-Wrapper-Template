// tools/config-editor/client/src/App.tsx
import { useState, useCallback } from 'react';
import Layout from './components/Layout';
import TabNav from './components/TabNav';
import AppConfigPage from './pages/AppConfig';
import ThemeConfigPage from './pages/ThemeConfig';
import PluginsConfigPage from './pages/PluginsConfig';
import BuildConfigPage from './pages/BuildConfig';
import { PreviewPanel, FullscreenModal } from './components/preview';
import { PreviewProvider } from './contexts/PreviewContext';
import { ConfigProvider, useAppConfig, useThemeConfig } from './contexts/ConfigContext';

function AppContent() {
  const [activeTab, setActiveTab] = useState('appSettings');
  const [unsavedTabs, setUnsavedTabs] = useState<string[]>([]);

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
            onTabChange={setActiveTab}
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
              <BuildConfigPage />
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
        <AppContent />
      </PreviewProvider>
    </ConfigProvider>
  );
}
