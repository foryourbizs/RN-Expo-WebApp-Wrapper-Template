import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlugins } from '../hooks/usePlugins';

interface AddAutoPluginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, namespace: string, needsInstall: boolean) => void;
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
  const [version, setVersion] = useState('latest');

  useEffect(() => {
    if (isOpen) {
      fetchInstalled();
      setSelectedPackage(null);
      setNamespace('');
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
      onAdd(selectedPackage, namespace, !isInstalled);
      onClose();
    }
  }, [selectedPackage, namespace, installedPackages, onAdd, onClose]);

  if (!isOpen) return null;

  const rnwwPlugins = installedPackages.filter(
    p => p.name.startsWith('rnww-plugin-')
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[650px] max-h-[85vh] overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-500">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <h2 className="text-lg font-semibold text-white">{t('plugins.addAutoTitle')}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Installed Packages */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center text-xs">✅</span>
              {t('plugins.installedPackages')} ({rnwwPlugins.length})
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-slate-500">{t('common.loading')}</div>
              ) : rnwwPlugins.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  No rnww-plugin-* packages installed
                </div>
              ) : (
                rnwwPlugins.map(pkg => {
                  const isAlreadyAdded = existingPlugins.includes(pkg.name);
                  return (
                    <button
                      key={pkg.name}
                      onClick={() => !isAlreadyAdded && setSelectedPackage(pkg.name)}
                      disabled={isAlreadyAdded}
                      className={`w-full px-4 py-3 text-left flex justify-between items-center border-b border-slate-100 last:border-b-0 transition-colors ${
                        isAlreadyAdded
                          ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                          : selectedPackage === pkg.name
                          ? 'bg-indigo-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500">⭐</span>
                        <span className="font-medium">{pkg.name}</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">v{pkg.version}</span>
                      </div>
                      {isAlreadyAdded ? (
                        <span className="text-xs text-slate-400 bg-slate-200 px-2 py-1 rounded-full">{t('plugins.alreadyAdded')}</span>
                      ) : (
                        <span className="text-sm text-indigo-500 font-medium">Select →</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* npm Search */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center text-xs">🔍</span>
              {t('plugins.npmSearch')}
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('plugins.searchPlaceholder')}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg
                  focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
                  transition-all duration-200 outline-none"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-slate-700 transition-colors"
              >
                {loading ? '...' : 'Search'}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {searchResults.map(pkg => (
                  <button
                    key={pkg.name}
                    onClick={() => setSelectedPackage(pkg.name)}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors ${
                      selectedPackage === pkg.name ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {pkg.name.startsWith('rnww-plugin-') && <span className="text-amber-500">⭐</span>}
                      <span className="font-medium">{pkg.name}</span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">v{pkg.version}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Package */}
          {selectedPackage && (
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
              <p className="text-sm text-slate-600 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center text-xs">✓</span>
                {t('plugins.selected')}: <strong className="text-indigo-700">{selectedPackage}</strong>
              </p>
              <div className="flex gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('plugins.version')}</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-28 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono
                      focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('plugins.namespace')}</label>
                  <input
                    type="text"
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                    className="w-28 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono
                      focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-200 rounded-lg hover:bg-white font-medium text-slate-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedPackage || !namespace}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              selectedPackage && namespace
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {t('plugins.installAndAdd')}
          </button>
        </div>
      </div>
    </div>
  );
}
