// tools/config-editor/client/src/components/TabNav.tsx
import { useTranslation } from 'react-i18next';

interface TabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unsavedTabs: string[];
}

const TABS = ['appSettings', 'theme', 'plugins', 'build'] as const;

export default function TabNav({ activeTab, onTabChange, unsavedTabs }: TabNavProps) {
  const { t } = useTranslation();

  const TAB_ICONS: Record<string, string> = {
    appSettings: '📱',
    theme: '🎨',
    plugins: '🧩',
    build: '🔨'
  };

  return (
    <div className="flex bg-white rounded-t-xl border-b border-slate-200">
      {TABS.map(tab => {
        const isActive = activeTab === tab;
        const hasUnsaved = unsavedTabs.includes(tab);
        const isDisabled = false;

        return (
          <button
            key={tab}
            onClick={() => !isDisabled && onTabChange(tab)}
            disabled={isDisabled}
            className={`
              relative flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all duration-200
              ${isActive
                ? 'text-indigo-600 bg-indigo-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              first:rounded-tl-xl
            `}
          >
            <span className="text-lg">{TAB_ICONS[tab]}</span>
            <span>{t(`nav.${tab}`)}</span>
            {hasUnsaved && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
            )}
            {isDisabled && <span className="ml-1 text-xs text-slate-400">(TBD)</span>}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}