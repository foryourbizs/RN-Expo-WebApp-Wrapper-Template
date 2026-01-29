// tools/config-editor/client/src/App.tsx
import { useState, useCallback } from 'react';
import Layout from './components/Layout';
import TabNav from './components/TabNav';
import AppConfigPage from './pages/AppConfig';
import ThemeConfigPage from './pages/ThemeConfig';
import PluginsConfigPage from './pages/PluginsConfig';
import BuildConfigPage from './pages/BuildConfig';

export default function App() {
  const [activeTab, setActiveTab] = useState('appSettings');
  const [unsavedTabs, setUnsavedTabs] = useState<string[]>([]);

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

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow">
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
  );
}
