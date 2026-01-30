interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}

export default function Toggle({ label, value, onChange, description }: ToggleProps) {
  return (
    <div className="mb-5 flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors duration-200">
      <div className="flex-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`
          relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ease-in-out
          ${value
            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/30'
            : 'bg-slate-300'
          }
        `}
      >
        <span
          className={`
            inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-all duration-300 ease-in-out
            ${value ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}
