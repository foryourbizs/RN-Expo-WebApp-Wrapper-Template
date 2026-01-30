import { useTranslation } from 'react-i18next';

interface SaveRevertBarProps {
  hasChanges: boolean;
  saving: boolean;
  onSave: () => void;
  onRevert: () => void;
}

export default function SaveRevertBar({ hasChanges, saving, onSave, onRevert }: SaveRevertBarProps) {
  const { t } = useTranslation();

  return (
    <div className="sticky bottom-0 -mx-4 -mb-4 px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
      <div>
        {hasChanges && (
          <span className="text-xs text-orange-600">{t('common.unsaved')}</span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onRevert}
          disabled={!hasChanges}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common.revert')}
        </button>
        <button
          onClick={onSave}
          disabled={!hasChanges || saving}
          className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '...' : t('common.save')}
        </button>
      </div>
    </div>
  );
}
