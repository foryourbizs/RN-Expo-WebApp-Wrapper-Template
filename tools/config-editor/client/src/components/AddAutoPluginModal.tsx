import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlugins } from '../hooks/usePlugins';

interface AddAutoPluginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, namespace: string, needsInstall: boolean, method?: string) => void;
  existingPlugins: string[];
}

export default function AddAutoPluginModal({
  isOpen,
  onClose,
  onAdd,
  existingPlugins
}: AddAutoPluginModalProps) {
  const { t } = useTranslation();
  const { installedPackages, searchResults, loading, fetchInstalled, searchPackages } = usePlugins();

  const [searchQuery, setSearchQuery] = useState('rnww-plugin-');
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [namespace, setNamespace] = useState('');
  const [method, setMethod] = useState('');
  const [version, setVersion] = useState('latest');

  useEffect(() => {
    if (isOpen) {
      fetchInstalled();
      setSelectedPackage(null);
      setNamespace('');
      setMethod('');
      setVersion('latest');
      setSearchQuery('rnww-plugin-');
    }
  }, [isOpen, fetchInstalled]);

  useEffect(() => {
    if (selectedPackage) {
      const ns = selectedPackage
        .replace('rnww-plugin-', '')
        .replace(/-/g, '')
        .slice(0, 6);
      setNamespace(ns);
    }
  }, [selectedPackage]);

  const handleSearch = useCallback(() => {
    searchPackages(searchQuery);
  }, [searchPackages, searchQuery]);

  const handleAdd = useCallback(() => {
    if (selectedPackage && namespace) {
      const isInstalled = installedPackages.some(p => p.name === selectedPackage);
      onAdd(selectedPackage, namespace, !isInstalled, method || undefined);
      onClose();
    }
  }, [selectedPackage, namespace, method, installedPackages, onAdd, onClose]);

  if (!isOpen) return null;

  const rnwwPlugins = installedPackages.filter(
    p => p.name.startsWith('rnww-plugin-')
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[500px] max-h-[80vh] overflow-hidden shadow-xl">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-200">
          <h2 className="font-medium text-slate-800">{t('plugins.addAutoTitle')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[55vh]">
          {/* Installed Packages */}
          <div className="mb-4">
            <h3 className="text-xs font-medium text-slate-500 mb-2">
              {t('plugins.installedPackages')} ({rnwwPlugins.length})
            </h3>
            <div className="border border-slate-200 rounded max-h-36 overflow-y-auto">
              {loading ? (
                <div className="p-3 text-center text-sm text-slate-500">{t('common.loading')}</div>
              ) : rnwwPlugins.length === 0 ? (
                <div className="p-3 text-center text-sm text-slate-500">No rnww-plugin-* packages</div>
              ) : (
                rnwwPlugins.map(pkg => {
                  const isAlreadyAdded = existingPlugins.includes(pkg.name);
                  return (
                    <button
                      key={pkg.name}
                      onClick={() => !isAlreadyAdded && setSelectedPackage(pkg.name)}
                      disabled={isAlreadyAdded}
                      className={`w-full px-3 py-2 text-left text-sm flex justify-between items-center border-b border-slate-100 last:border-b-0 ${
                        isAlreadyAdded
                          ? 'bg-slate-50 text-slate-400'
                          : selectedPackage === pkg.name
                          ? 'bg-slate-100'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <span>{pkg.name} <span className="text-xs text-slate-400">v{pkg.version}</span></span>
                      {isAlreadyAdded && <span className="text-xs text-slate-400">{t('plugins.alreadyAdded')}</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* npm Search */}
          <div className="mb-4">
            <h3 className="text-xs font-medium text-slate-500 mb-2">{t('plugins.npmSearch')}</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('plugins.searchPlaceholder')}
                className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded"
              >
                {loading ? '...' : 'Search'}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded max-h-36 overflow-y-auto">
                {searchResults.map(pkg => (
                  <button
                    key={pkg.name}
                    onClick={() => setSelectedPackage(pkg.name)}
                    className={`w-full px-3 py-2 text-left text-sm border-b border-slate-100 last:border-b-0 ${
                      selectedPackage === pkg.name ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    {pkg.name} <span className="text-xs text-slate-400">v{pkg.version}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Package */}
          {selectedPackage && (
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">
                {t('plugins.selected')}: <strong>{selectedPackage}</strong>
              </p>
              <div className="flex gap-3 flex-wrap">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('plugins.version')}</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-20 px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('plugins.namespace')}</label>
                  <input
                    type="text"
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                    className="w-20 px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('plugins.method')}</label>
                  <input
                    type="text"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    placeholder="registerHandlers"
                    className="w-36 px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded hover:bg-white"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedPackage || !namespace}
            className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('plugins.installAndAdd')}
          </button>
        </div>
      </div>
    </div>
  );
}
