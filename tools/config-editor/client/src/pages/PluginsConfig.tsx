import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePluginsConfig } from '../contexts/ConfigContext';
import { usePlugins } from '../hooks/usePlugins';
import AddAutoPluginModal from '../components/AddAutoPluginModal';
import AddManualPluginModal from '../components/AddManualPluginModal';
import { SaveRevertBar } from '../components/form';

interface PluginsConfigProps {
  onUnsavedChange: (hasChanges: boolean) => void;
}

export default function PluginsConfigPage({ onUnsavedChange }: PluginsConfigProps) {
  const { t } = useTranslation();
  const { data, setData, loading, error, saving, save: saveConfig, revert, hasChanges } =
    usePluginsConfig();
  const { installedPackages, fetchInstalled, installPackage } = usePlugins();

  const [showAutoModal, setShowAutoModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  useEffect(() => {
    onUnsavedChange(hasChanges);
  }, [hasChanges, onUnsavedChange]);

  const autoPlugins = data?.plugins?.auto || [];
  const manualPlugins = data?.plugins?.manual || [];

  // 네임스페이스 충돌 검사
  const namespaceConflicts = useMemo(() => {
    const allPlugins = [
      ...autoPlugins.map(p => ({ id: p.name, namespace: p.namespace, type: 'auto' as const })),
      ...manualPlugins.map(p => ({ id: p.path, namespace: p.namespace, type: 'manual' as const }))
    ];

    const nsMap = new Map<string, string[]>();
    allPlugins.forEach(p => {
      if (p.namespace) {
        if (!nsMap.has(p.namespace)) nsMap.set(p.namespace, []);
        nsMap.get(p.namespace)!.push(p.id);
      }
    });

    const conflicts: { namespace: string; plugins: string[] }[] = [];
    nsMap.forEach((plugins, namespace) => {
      if (plugins.length > 1) {
        conflicts.push({ namespace, plugins });
      }
    });
    return conflicts;
  }, [autoPlugins, manualPlugins]);

  const conflictingNamespaces = useMemo(() => {
    return new Set(namespaceConflicts.map(c => c.namespace));
  }, [namespaceConflicts]);

  const isInstalled = useCallback((name: string) =>
    installedPackages.some(p => p.name === name), [installedPackages]);

  const handleAddAutoPlugin = useCallback(async (name: string, namespace: string, needsInstall: boolean, method?: string) => {
    if (needsInstall) {
      setInstalling(name);
      const success = await installPackage(name);
      setInstalling(null);
      if (!success) return;
    }
    setData((prevData) => {
      if (!prevData) return prevData;
      const newPlugin: { name: string; namespace: string; method?: string } = { name, namespace };
      if (method) newPlugin.method = method;
      return {
        ...prevData,
        plugins: {
          ...prevData.plugins,
          auto: [...(prevData.plugins?.auto || []), newPlugin]
        }
      };
    });
  }, [installPackage, setData]);

  const handleAddManualPlugin = useCallback((path: string, namespace: string, method?: string) => {
    setData((prevData) => {
      if (!prevData) return prevData;
      const newPlugin: { path: string; namespace: string; method?: string } = { path, namespace };
      if (method) newPlugin.method = method;
      return {
        ...prevData,
        plugins: {
          ...prevData.plugins,
          manual: [...(prevData.plugins?.manual || []), newPlugin]
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

  if (loading) return <div className="p-4 text-sm">{t('common.loading')}</div>;
  if (error) return <div className="p-4 text-sm text-red-500">{error}</div>;
  if (!data) return null;

  return (
    <div>
      {/* Namespace Conflict Warning */}
      {namespaceConflicts.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm font-medium text-red-800 mb-1">{t('plugins.namespaceConflict')}</p>
          <ul className="text-xs text-red-600">
            {namespaceConflicts.map(c => (
              <li key={c.namespace}>
                "{c.namespace}" → {c.plugins.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Auto Plugins */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-slate-800">{t('plugins.auto')}</h3>
          <button
            onClick={() => setShowAutoModal(true)}
            className="px-2 py-1 text-xs font-medium bg-slate-800 text-white rounded hover:bg-slate-700"
          >
            + {t('plugins.add')}
          </button>
        </div>
        <div className="space-y-2">
          {autoPlugins.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded">
              No auto plugins
            </div>
          ) : (
            autoPlugins.map((plugin, index) => {
              const installed = isInstalled(plugin.name);
              const hasConflict = conflictingNamespaces.has(plugin.namespace);
              return (
                <div key={plugin.name} className={`p-3 bg-white border rounded flex items-center justify-between ${hasConflict ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                  <div>
                    <span className="text-sm font-medium text-slate-800">{plugin.name}</span>
                    <span className={`ml-2 text-xs ${hasConflict ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                      ns: {plugin.namespace}{hasConflict && ' ⚠'}
                    </span>
                    {plugin.method && (
                      <span className="ml-2 text-xs text-blue-500">
                        fn: {plugin.method}
                      </span>
                    )}
                    <span className={`ml-2 text-xs ${installed ? 'text-green-600' : 'text-orange-500'}`}>
                      {installed ? 'installed' : 'not installed'}
                    </span>
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
                        className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                      >
                        {installing === plugin.name ? '...' : t('plugins.install')}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveAutoPlugin(index)}
                      className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
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
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-slate-800">{t('plugins.manual')}</h3>
          <button
            onClick={() => setShowManualModal(true)}
            className="px-2 py-1 text-xs font-medium bg-slate-800 text-white rounded hover:bg-slate-700"
          >
            + {t('plugins.add')}
          </button>
        </div>
        <div className="space-y-2">
          {manualPlugins.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded">
              No manual plugins
            </div>
          ) : (
            manualPlugins.map((plugin, index) => {
              const hasConflict = conflictingNamespaces.has(plugin.namespace);
              return (
              <div key={plugin.path} className={`p-3 bg-white border rounded flex items-center justify-between ${hasConflict ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                <div>
                  <span className="text-sm font-medium text-slate-800">{plugin.path}</span>
                  <span className={`ml-2 text-xs ${hasConflict ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                    ns: {plugin.namespace}{hasConflict && ' ⚠'}
                  </span>
                  {plugin.method && (
                    <span className="ml-2 text-xs text-blue-500">
                      fn: {plugin.method}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveManualPlugin(index)}
                  className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                >
                  {t('plugins.remove')}
                </button>
              </div>
              );
            })
          )}
        </div>
      </div>

      <SaveRevertBar
        hasChanges={hasChanges}
        saving={saving}
        onSave={handleSave}
        onRevert={revert}
      />

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
