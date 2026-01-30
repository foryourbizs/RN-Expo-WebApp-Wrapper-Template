interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  description?: string;
}

export default function Select({ label, value, onChange, options, description }: SelectProps) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg
            text-slate-700 appearance-none cursor-pointer
            focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
            hover:border-slate-300
            transition-all duration-200 outline-none"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
