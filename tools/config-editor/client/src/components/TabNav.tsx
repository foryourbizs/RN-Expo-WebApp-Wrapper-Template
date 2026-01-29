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

  return (
    <div className="flex border-b bg-white rounded-t-lg">
      {TABS.map(tab => {
        const isActive = activeTab === tab;
        const hasUnsaved = unsavedTabs.includes(tab);
        const isDisabled = tab === 'build';

        return (
          <button
            key={tab}
            onClick={() => !isDisabled && onTabChange(tab)}
            disabled={isDisabled}
            className={`
              px-6 py-3 text-sm font-medium border-b-2 transition-colors
              ${isActive
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {t(`nav.${tab}`)}
            {hasUnsaved && <span className="ml-1 text-orange-500">*</span>}
            {isDisabled && <span className="ml-1 text-xs">(TBD)</span>}
          </button>
        );
      })}
    </div>
  );
}
