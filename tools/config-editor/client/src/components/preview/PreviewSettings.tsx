// tools/config-editor/client/src/components/preview/PreviewSettings.tsx
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreview } from '../../contexts/PreviewContext';

export default function PreviewSettings() {
  const { t } = useTranslation();
  const { settings, updateSettings } = usePreview();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          p-1.5 rounded transition-colors
          ${isOpen ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700'}
        `}
        title={t('preview.settings')}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-20 min-w-[180px]">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.loadIframe}
                onChange={(e) => updateSettings({ loadIframe: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span className="text-xs text-slate-700">{t('preview.loadIframe')}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showStatusBar}
                onChange={(e) => updateSettings({ showStatusBar: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span className="text-xs text-slate-700">{t('preview.showStatusBar')}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showNavBar}
                onChange={(e) => updateSettings({ showNavBar: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span className="text-xs text-slate-700">{t('preview.showNavBar')}</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
