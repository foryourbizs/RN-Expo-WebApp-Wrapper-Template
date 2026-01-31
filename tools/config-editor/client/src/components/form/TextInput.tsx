import { ReactNode } from 'react';

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  placeholder?: string;
  action?: ReactNode;  // 입력 필드 옆에 표시할 액션 버튼
}

export default function TextInput({
  label, value, onChange, description, placeholder, action
}: TextInputProps) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className={action ? 'flex gap-2' : ''}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 w-full px-2 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded"
        />
        {action}
      </div>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    </div>
  );
}
