interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}

export default function Toggle({ label, value, onChange, description }: ToggleProps) {
  return (
    <div className="mb-3 flex items-center justify-between py-1">
      <div>
        <span className="text-xs font-medium text-slate-600">{label}</span>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`
          relative inline-flex h-5 w-9 items-center rounded-full transition-colors
          ${value ? 'bg-slate-800' : 'bg-slate-300'}
        `}
      >
        <span
          className={`
            inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
            ${value ? 'translate-x-4.5' : 'translate-x-1'}
          `}
          style={{ transform: value ? 'translateX(18px)' : 'translateX(4px)' }}
        />
      </button>
    </div>
  );
}
