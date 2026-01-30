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
import { useConfig, useKeyboardShortcuts } from './hooks';
import type { AppConfig, ThemeConfig } from './types/config';

function AppContent() {
  const [activeTab, setActiveTab] = useState('appSettings');
  const [unsavedTabs, setUnsavedTabs] = useState<string[]>([]);

  // 미리보기를 위해 config 데이터 로드
  const { data: appConfig } = useConfig<AppConfig>('app');
  const { data: themeConfig } = useConfig<ThemeConfig>('theme');

  // 키보드 단축키 활성화
  useKeyboardShortcuts();

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
    <PreviewProvider>
      <AppContent />
    </PreviewProvider>
  );
}
