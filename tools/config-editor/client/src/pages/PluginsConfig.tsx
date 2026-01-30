import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '../hooks/useConfig';
import { usePlugins } from '../hooks/usePlugins';
import AddAutoPluginModal from '../components/AddAutoPluginModal';
import AddManualPluginModal from '../components/AddManualPluginModal';
import { SaveRevertBar } from '../components/form';
import type { PluginsConfig } from '../types/config';

interface PluginsConfigProps {
  onUnsavedChange: (hasChanges: boolean) => void;
}

export default function PluginsConfigPage({ onUnsavedChange }: PluginsConfigProps) {
  const { t } = useTranslation();
  const { data, setData, loading, error, saving, saveConfig, revert, hasChanges } =
    useConfig<PluginsConfig>('plugins');
  const { installedPackages, fetchInstalled, installPackage } = usePlugins();

  const [showAutoModal, setShowAutoModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  // 변경 사항 알림 - useEffect로 처리
  useEffect(() => {
    onUnsavedChange(hasChanges);
  }, [hasChanges, onUnsavedChange]);

  const autoPlugins = data?.plugins?.auto || [];
  const manualPlugins = data?.plugins?.manual || [];

  const isInstalled = useCallback((name: string) =>
    installedPackages.some(p => p.name === name), [installedPackages]);

  const handleAddAutoPlugin = useCallback(async (name: string, namespace: string, needsInstall: boolean) => {
    if (needsInstall) {
      setInstalling(name);
      const success = await installPackage(name);
      setInstalling(null);
      if (!success) {
        // Install failed, don't add plugin
        return;
      }
    }
    setData((prevData) => {
      if (!prevData) return prevData;
      return {
        ...prevData,
        plugins: {
          ...prevData.plugins,
          auto: [...(prevData.plugins?.auto || []), { name, namespace }]
        }
      };
    });
  }, [installPackage, setData]);

  const handleAddManualPlugin = useCallback((path: string, namespace: string) => {
    setData((prevData) => {
      if (!prevData) return prevData;
      return {
        ...prevData,
        plugins: {
          ...prevData.plugins,
          manual: [...(prevData.plugins?.manual || []), { path, namespace }]
        }
      };
    });
  }, [setData]);

  const handleRemoveAutoPlugin = useCallback((index: number) => {
    setData((prevData) => {
      if (!prevData) return prevData;
      return {
        ...prevData,
        plugins: {
          ...prevData.plugins,
          auto: (prevData.plugins?.auto || []).filter((_, i) => i !== index)
        }
      };
    });
  }, [setData]);

  const handleRemoveManualPlugin = useCallback((index: number) => {
    setData((prevData) => {
      if (!prevData) return prevData;
      return {
        ...prevData,
        plugins: {
          ...prevData.plugins,
          manual: (prevData.plugins?.manual || []).filter((_, i) => i !== index)
        }
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
      {/* Auto Plugins */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">{t('plugins.auto')}</h3>
              <p className="text-sm text-slate-500">NPM packages that extend app functionality</p>
            </div>
          </div>
          <button
            onClick={() => setShowAutoModal(true)}
            className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg 
              shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5
              transition-all duration-200"
          >
            + {t('plugins.add')}
          </button>
        </div>
        <div className="space-y-3">
          {autoPlugins.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <span className="text-4xl mb-3 block">📭</span>
              <p className="text-slate-500">No auto plugins configured</p>
              <p className="text-sm text-slate-400 mt-1">Click the add button to install plugins</p>
            </div>
          ) : (
            autoPlugins.map((plugin, index) => {
              const installed = isInstalled(plugin.name);
              const isOfficial = plugin.name.startsWith('rnww-plugin-');
              return (
                <div key={plugin.name} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg
                        ${isOfficial ? 'bg-amber-100' : 'bg-slate-100'}`}>
                        {isOfficial ? '⭐' : '📦'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{plugin.name}</span>
                          {isOfficial && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">Official</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-slate-500">
                            <span className="text-slate-400">namespace:</span> <code className="px-1.5 py-0.5 bg-slate-100 rounded text-indigo-600">{plugin.namespace}</code>
                          </span>
                        </div>
                        <div className="mt-2">
                          {installed ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                              {t('plugins.installed')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                              {t('plugins.notInstalled')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!installed && (
                        <button
                          onClick={async () => {
                            setInstalling(plugin.name);
                            await installPackage(plugin.name);
                            setInstalling(null);
                          }}
                          disabled={installing === plugin.name}
                          className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          {installing === plugin.name ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Installing...
                            </span>
                          ) : (
                            t('plugins.install')
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveAutoPlugin(index)}
                        className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        {t('plugins.remove')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Manual Plugins */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📁</span>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">{t('plugins.manual')}</h3>
              <p className="text-sm text-slate-500">Local plugins in lib/bridges directory</p>
            </div>
          </div>
          <button
            onClick={() => setShowManualModal(true)}
            className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg 
              shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5
              transition-all duration-200"
          >
            + {t('plugins.add')}
          </button>
        </div>
        <div className="space-y-3">
          {manualPlugins.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <span className="text-4xl mb-3 block">📭</span>
              <p className="text-slate-500">No manual plugins configured</p>
              <p className="text-sm text-slate-400 mt-1">Click the add button to add local plugins</p>
            </div>
          ) : (
            manualPlugins.map((plugin, index) => (
              <div key={plugin.path} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-lg">
                      📂
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">{plugin.path}</span>
                      <div className="text-sm text-slate-500 mt-0.5">
                        <span className="text-slate-400">namespace:</span> <code className="px-1.5 py-0.5 bg-slate-100 rounded text-purple-600">{plugin.namespace}</code>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveManualPlugin(index)}
                    className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    {t('plugins.remove')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <SaveRevertBar
        hasChanges={hasChanges}
        saving={saving}
        onSave={handleSave}
        onRevert={revert}
      />

      {/* Modals */}
      <AddAutoPluginModal
        isOpen={showAutoModal}
        onClose={() => setShowAutoModal(false)}
        onAdd={handleAddAutoPlugin}
        existingPlugins={autoPlugins.map(p => p.name)}
      />
      <AddManualPluginModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onAdd={handleAddManualPlugin}
        existingPaths={manualPlugins.map(p => p.path)}
      />
    </div>
  );
}
