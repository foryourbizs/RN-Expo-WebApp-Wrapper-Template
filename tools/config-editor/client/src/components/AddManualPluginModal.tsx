import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlugins } from '../hooks/usePlugins';

interface AddManualPluginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (path: string, namespace: string) => void;
  existingPaths: string[];
}

export default function AddManualPluginModal({
  isOpen,
  onClose,
  onAdd,
  existingPaths
}: AddManualPluginModalProps) {
  const { t } = useTranslation();
  const { scannedFolders, loading, scanFolders } = usePlugins();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [namespace, setNamespace] = useState('');

  useEffect(() => {
    if (isOpen) {
      scanFolders();
    }
  }, [isOpen, scanFolders]);

  useEffect(() => {
    if (selectedPath) {
      const ns = selectedPath.replace('./', '').replace(/-/g, '').slice(0, 6);
      setNamespace(ns);
    }
  }, [selectedPath]);

  const handleAdd = useCallback(() => {
    if (selectedPath && namespace) {
      onAdd(selectedPath, namespace);
      onClose();
    }
  }, [selectedPath, namespace, onAdd, onClose]);

  if (!isOpen) return null;

  const availableFolders = scannedFolders.filter(
    folder => !existingPaths.includes(folder)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[500px]">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-medium">{t('plugins.addManualTitle')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="p-4">
          <p className="text-sm text-gray-600 mb-3">{t('plugins.scanResults')}</p>

          {loading ? (
            <div className="text-center py-4">{t('common.loading')}</div>
          ) : availableFolders.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No unregistered folders found
            </div>
          ) : (
            <div className="border rounded max-h-60 overflow-y-auto">
              {availableFolders.map(folder => (
                <button
                  key={folder}
                  onClick={() => setSelectedPath(folder)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${
                    selectedPath === folder ? 'bg-blue-50' : ''
                  }`}
                >
                  {folder}
                </button>
              ))}
            </div>
          )}

          {selectedPath && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                {t('plugins.selected')}: <strong>{selectedPath}</strong>
              </p>
              <div>
                <label className="block text-sm text-gray-600">{t('plugins.namespace')}</label>
                <input
                  type="text"
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  className="w-32 px-2 py-1 border rounded text-sm"
                />
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
            disabled={!selectedPath || !namespace}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {t('plugins.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
