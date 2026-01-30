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
    <div className="relative">
      <select
        value={i18n.language}
        onChange={handleChange}
        className="text-sm pl-8 pr-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white
          appearance-none cursor-pointer hover:bg-white/20 transition-colors outline-none"
      >
        <option value="ko" className="text-slate-800">🇰🇷 한국어</option>
        <option value="en" className="text-slate-800">🇺🇸 English</option>
      </select>
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🌐</span>
    </div>
  );
}
