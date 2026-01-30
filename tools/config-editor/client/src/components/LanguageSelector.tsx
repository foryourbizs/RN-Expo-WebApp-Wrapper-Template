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
      className="text-xs px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-300 cursor-pointer"
    >
      <option value="ko">한국어</option>
      <option value="en">English</option>
    </select>
  );
}
