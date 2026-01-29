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
      // Reset state when modal opens
      setSelectedPackage(null);
      setNamespace('');
      setVersion('latest');
      setSearchQuery('rnww-plugin-');
    }
  }, [isOpen, fetchInstalled]);

  useEffect(() => {
    if (selectedPackage) {
      // 자동 네임스페이스 생성
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

  // rnww-plugin-* 패키지만 필터링
  const rnwwPlugins = installedPackages.filter(
    p => p.name.startsWith('rnww-plugin-')
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[600px] max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-medium">{t('plugins.addAutoTitle')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* Installed Packages */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              {t('plugins.installedPackages')} ({rnwwPlugins.length})
            </h3>
            <div className="border rounded max-h-40 overflow-y-auto">
              {loading ? (
                <div className="p-3 text-center text-gray-500">{t('common.loading')}</div>
              ) : rnwwPlugins.length === 0 ? (
                <div className="p-3 text-center text-gray-500">
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
                      className={`w-full px-3 py-2 text-left flex justify-between items-center ${
                        isAlreadyAdded
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : selectedPackage === pkg.name
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <span>
                        ⭐ {pkg.name} (v{pkg.version})
                      </span>
                      {isAlreadyAdded ? (
                        <span className="text-sm text-gray-400">{t('plugins.alreadyAdded')}</span>
                      ) : (
                        <span className="text-sm text-blue-500">Select</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* npm Search */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              {t('plugins.npmSearch')}
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('plugins.searchPlaceholder')}
                className="flex-1 px-3 py-2 border rounded-md"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                {loading ? '...' : 'Search'}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border rounded max-h-40 overflow-y-auto">
                {searchResults.map(pkg => (
                  <button
                    key={pkg.name}
                    onClick={() => setSelectedPackage(pkg.name)}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${
                      selectedPackage === pkg.name ? 'bg-blue-50' : ''
                    }`}
                  >
                    {pkg.name.startsWith('rnww-plugin-') && '⭐ '}
                    {pkg.name} (v{pkg.version})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Package */}
          {selectedPackage && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                {t('plugins.selected')}: <strong>{selectedPackage}</strong>
              </p>
              <div className="flex gap-4">
                <div>
                  <label className="block text-sm text-gray-600">{t('plugins.version')}</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-24 px-2 py-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">{t('plugins.namespace')}</label>
                  <input
                    type="text"
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                    className="w-24 px-2 py-1 border rounded text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedPackage || !namespace}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {t('plugins.installAndAdd')}
          </button>
        </div>
      </div>
    </div>
  );
}
