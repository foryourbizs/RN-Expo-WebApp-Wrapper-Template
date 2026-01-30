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
      setSelectedPath(null);
      setNamespace('');
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[400px] shadow-xl">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-200">
          <h2 className="font-medium text-slate-800">{t('plugins.addManualTitle')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>

        <div className="p-4">
          <p className="text-xs text-slate-500 mb-2">{t('plugins.scanResults')}</p>

          {loading ? (
            <div className="text-center py-6 text-sm text-slate-500">{t('common.loading')}</div>
          ) : availableFolders.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400 border border-dashed border-slate-200 rounded">
              No unregistered folders
            </div>
          ) : (
            <div className="border border-slate-200 rounded max-h-48 overflow-y-auto">
              {availableFolders.map(folder => (
                <button
                  key={folder}
                  onClick={() => setSelectedPath(folder)}
                  className={`w-full px-3 py-2 text-left text-sm border-b border-slate-100 last:border-b-0 ${
                    selectedPath === folder ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  {folder}
                </button>
              ))}
            </div>
          )}

          {selectedPath && (
            <div className="mt-3 p-3 bg-slate-50 rounded border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">
                {t('plugins.selected')}: <strong>{selectedPath}</strong>
              </p>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('plugins.namespace')}</label>
                <input
                  type="text"
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  className="w-28 px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                />
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
            disabled={!selectedPath || !namespace}
            className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('plugins.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
