import { useState, KeyboardEvent } from 'react';

interface TagInputProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  description?: string;
  placeholder?: string;
}

export default function TagInput({ label, value, onChange, description, placeholder }: TagInputProps) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!value.includes(input.trim())) {
        onChange([...value, input.trim()]);
      }
      setInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded min-h-[32px]">
        {value.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 text-white rounded text-xs">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-slate-300"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] outline-none bg-transparent text-sm"
        />
      </div>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    </div>
  );
}
