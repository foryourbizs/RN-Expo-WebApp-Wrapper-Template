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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[550px] shadow-2xl">
        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-purple-500 to-indigo-500">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📁</span>
            <h2 className="text-lg font-semibold text-white">{t('plugins.addManualTitle')}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-600 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-xs">📂</span>
            {t('plugins.scanResults')}
          </p>

          {loading ? (
            <div className="text-center py-8 text-slate-500">{t('common.loading')}</div>
          ) : availableFolders.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <span className="text-3xl mb-2 block">📭</span>
              No unregistered folders found
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {availableFolders.map(folder => (
                <button
                  key={folder}
                  onClick={() => setSelectedPath(folder)}
                  className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b border-slate-100 last:border-b-0 transition-colors ${
                    selectedPath === folder ? 'bg-purple-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm">📂</span>
                  <span className="font-medium text-slate-700">{folder}</span>
                  {selectedPath === folder && (
                    <span className="ml-auto text-purple-500 font-medium">Selected ✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {selectedPath && (
            <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
              <p className="text-sm text-slate-600 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-purple-100 flex items-center justify-center text-xs">✓</span>
                {t('plugins.selected')}: <strong className="text-purple-700">{selectedPath}</strong>
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('plugins.namespace')}</label>
                <input
                  type="text"
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  className="w-36 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono
                    focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                />
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
            disabled={!selectedPath || !namespace}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              selectedPath && namespace
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-0.5'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {t('plugins.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
