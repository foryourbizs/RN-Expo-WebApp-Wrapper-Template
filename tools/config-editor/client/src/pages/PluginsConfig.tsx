import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '../hooks/useConfig';
import { usePlugins } from '../hooks/usePlugins';
import AddAutoPluginModal from '../components/AddAutoPluginModal';
import AddManualPluginModal from '../components/AddManualPluginModal';
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
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium">{t('plugins.auto')}</h3>
          <button
            onClick={() => setShowAutoModal(true)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + {t('plugins.add')}
          </button>
        </div>
        <div className="border rounded-lg divide-y">
          {autoPlugins.length === 0 ? (
            <div className="p-4 text-gray-500 text-center">No auto plugins</div>
          ) : (
            autoPlugins.map((plugin, index) => {
              const installed = isInstalled(plugin.name);
              return (
                <div key={plugin.name} className="p-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      {plugin.name.startsWith('rnww-plugin-') && '⭐ '}
                      {plugin.name}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      namespace: {plugin.namespace}
                    </span>
                    <div className="mt-1 text-sm">
                      {installed ? (
                        <span className="text-green-600">✅ {t('plugins.installed')}</span>
                      ) : (
                        <span className="text-orange-500">⚠️ {t('plugins.notInstalled')}</span>
                      )}
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
                        className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                      >
                        {installing === plugin.name ? '...' : t('plugins.install')}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveAutoPlugin(index)}
                      className="px-3 py-1 text-sm text-red-500 border border-red-300 rounded hover:bg-red-50"
                    >
                      {t('plugins.remove')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Manual Plugins */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium">{t('plugins.manual')}</h3>
          <button
            onClick={() => setShowManualModal(true)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + {t('plugins.add')}
          </button>
        </div>
        <div className="border rounded-lg divide-y">
          {manualPlugins.length === 0 ? (
            <div className="p-4 text-gray-500 text-center">No manual plugins</div>
          ) : (
            manualPlugins.map((plugin, index) => (
              <div key={plugin.path} className="p-3 flex items-center justify-between">
                <div>
                  <span className="font-medium">{plugin.path}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    namespace: {plugin.namespace}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveManualPlugin(index)}
                  className="px-3 py-1 text-sm text-red-500 border border-red-300 rounded hover:bg-red-50"
                >
                  {t('plugins.remove')}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

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
