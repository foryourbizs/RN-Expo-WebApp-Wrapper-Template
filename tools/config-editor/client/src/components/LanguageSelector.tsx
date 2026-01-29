// tools/config-editor/client/src/components/LanguageSelector.tsx
import { useTranslation } from 'react-i18next';

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    localStorage.setItem('rnww-config-lang', lang);
  };

  return (
    <select
      value={i18n.language}
      onChange={handleChange}
      className="text-sm border rounded px-2 py-1 bg-white"
    >
      <option value="ko">한국어</option>
      <option value="en">English</option>
    </select>
  );
}
