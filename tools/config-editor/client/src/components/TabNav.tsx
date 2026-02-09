import { useTranslation } from 'react-i18next';

interface TabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unsavedTabs: string[];
}

const TABS = ['appSettings', 'theme', 'plugins', 'permissions', 'build', 'debug'] as const;

export default function TabNav({ activeTab, onTabChange, unsavedTabs }: TabNavProps) {
  const { t } = useTranslation();

  return (
    <div className="flex border-b border-slate-200 bg-white">
      {TABS.map(tab => {
        const isActive = activeTab === tab;
        const hasUnsaved = unsavedTabs.includes(tab);

        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`
              relative px-4 py-2.5 text-sm font-medium transition-colors
              ${isActive
                ? 'text-slate-900 border-b-2 border-slate-800 -mb-px'
                : 'text-slate-500 hover:text-slate-700'
              }
            `}
          >
            {t(`nav.${tab}`)}
            {hasUnsaved && (
              <span className="absolute top-1.5 right-1 w-1.5 h-1.5 bg-orange-500 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
