interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  showSlider?: boolean;
}

export default function NumberInput({
  label, value, onChange, description, min, max, step = 1, showSlider = false
}: NumberInputProps) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-20 px-2 py-1 text-sm bg-slate-50 border border-slate-200 rounded text-center"
        />
        {showSlider && min !== undefined && max !== undefined && (
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xs text-slate-400">{min}</span>
            <input
              type="range"
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              min={min}
              max={max}
              step={step}
              className="flex-1 h-1 bg-slate-200 rounded appearance-none cursor-pointer"
            />
            <span className="text-xs text-slate-400">{max}</span>
          </div>
        )}
      </div>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    </div>
  );
}
