import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-12 h-12 rounded-xl border-2 border-slate-200 shadow-sm
            hover:border-indigo-300 hover:shadow-md
            transition-all duration-200 relative overflow-hidden group"
          style={{ backgroundColor: value }}
        >
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </button>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-32 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg
            font-mono text-sm text-slate-700 uppercase
            focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
            transition-all duration-200 outline-none"
          placeholder="#000000"
        />
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-3">
          <div className="fixed inset-0" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white p-3 rounded-xl shadow-2xl border border-slate-200">
            <HexColorPicker color={value} onChange={onChange} />
            <button
              onClick={() => setIsOpen(false)}
              className="w-full mt-3 px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg
                hover:bg-indigo-600 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
