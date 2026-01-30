interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  description?: string;
}

export default function Select({ label, value, onChange, options, description }: SelectProps) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    </div>
  );
}
