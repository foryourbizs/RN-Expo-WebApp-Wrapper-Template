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
    <div className={`
      sticky bottom-0 -mx-6 -mb-6 px-6 py-4 
      bg-gradient-to-t from-white via-white to-white/95
      border-t border-slate-200
      flex items-center justify-between
      transition-all duration-300
      ${hasChanges ? 'shadow-[0_-4px_20px_rgba(0,0,0,0.1)]' : ''}
    `}>
      <div className="flex items-center gap-3">
        {hasChanges && (
          <>
            <span className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              {t('common.unsaved')}
            </span>
          </>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={onRevert}
          disabled={!hasChanges}
          className={`
            px-5 py-2.5 rounded-lg font-medium text-sm
            border border-slate-200
            transition-all duration-200
            ${hasChanges 
              ? 'text-slate-700 hover:bg-slate-100 hover:border-slate-300' 
              : 'text-slate-400 cursor-not-allowed'
            }
          `}
        >
          {t('common.revert')}
        </button>
        <button
          onClick={onSave}
          disabled={!hasChanges || saving}
          className={`
            px-6 py-2.5 rounded-lg font-medium text-sm
            transition-all duration-200
            ${hasChanges && !saving
              ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('common.loading')}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>💾</span>
              {t('common.save')}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
