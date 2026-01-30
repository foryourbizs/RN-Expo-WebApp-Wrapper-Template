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
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded"
      />
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    </div>
  );
}
