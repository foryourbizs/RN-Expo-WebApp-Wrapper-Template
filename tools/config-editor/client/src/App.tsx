// tools/config-editor/client/src/App.tsx
import { useState } from 'react';
import Layout from './components/Layout';
import TabNav from './components/TabNav';

export default function App() {
  const [activeTab, setActiveTab] = useState('appSettings');
  const [unsavedTabs, setUnsavedTabs] = useState<string[]>([]);

  return (
    <Layout>
      <div className="bg-white rounded-lg shadow">
        <TabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          unsavedTabs={unsavedTabs}
        />
        <div className="p-6">
          {activeTab === 'appSettings' && <div>App Settings Tab</div>}
          {activeTab === 'theme' && <div>Theme Tab</div>}
          {activeTab === 'plugins' && <div>Plugins Tab</div>}
          {activeTab === 'build' && <div>Build Tab (Coming Soon)</div>}
        </div>
      </div>
    </Layout>
  );
}
