interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  placeholder?: string;
}

export default function TextInput({
  label, value, onChange, description, placeholder
}: TextInputProps) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg
          text-slate-700 placeholder:text-slate-400
          focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
          hover:border-slate-300
          transition-all duration-200 outline-none"
      />
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
