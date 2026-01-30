import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

export default function ColorPicker({ label, value, onChange, description }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {description && <p className="text-xs text-slate-400 mb-1">{description}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-8 h-8 rounded border border-slate-200"
          style={{ backgroundColor: value }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded font-mono uppercase"
        />
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-2">
          <div className="fixed inset-0" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white p-2 rounded shadow-lg border border-slate-200">
            <HexColorPicker color={value} onChange={onChange} />
            <button
              onClick={() => setIsOpen(false)}
              className="w-full mt-2 px-2 py-1 text-xs bg-slate-800 text-white rounded"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
