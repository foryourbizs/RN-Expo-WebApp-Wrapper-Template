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
    <div className="mb-5">
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <div className="flex items-center gap-4">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-28 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg
            text-slate-700 text-center font-medium
            focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
            hover:border-slate-300
            transition-all duration-200 outline-none"
        />
        {showSlider && min !== undefined && max !== undefined && (
          <div className="flex-1 flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">{min}</span>
            <input
              type="range"
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              min={min}
              max={max}
              step={step}
              className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:bg-indigo-500
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:shadow-lg
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:transition-transform
                [&::-webkit-slider-thumb]:hover:scale-110"
            />
            <span className="text-xs text-slate-400 font-medium">{max}</span>
          </div>
        )}
      </div>
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
