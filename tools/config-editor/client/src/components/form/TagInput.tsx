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
    <div className="mb-5">
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg min-h-[52px]
        focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500
        transition-all duration-200">
        {value.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5
            bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-sm font-medium
            shadow-sm">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="w-4 h-4 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
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
          placeholder={value.length === 0 ? placeholder : 'Enter로 추가...'}
          className="flex-1 min-w-[150px] outline-none bg-transparent text-slate-700 placeholder:text-slate-400"
        />
      </div>
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
