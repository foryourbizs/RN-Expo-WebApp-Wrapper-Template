import { useState, useEffect, ReactNode } from 'react';

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Controlled mode: external open state */
  isOpen?: boolean;
  /** Callback when accordion is toggled */
  onToggle?: (isOpen: boolean) => void;
  /** Unique identifier for tracking */
  sectionId?: string;
}

export default function Accordion({
  title,
  children,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle,
  sectionId,
}: AccordionProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);

  // 제어 모드 여부 확인
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  // 제어 모드에서 외부 값이 변경되면 내부 상태도 동기화
  useEffect(() => {
    if (isControlled) {
      setInternalIsOpen(controlledIsOpen);
    }
  }, [isControlled, controlledIsOpen]);

  const handleToggle = () => {
    const newState = !isOpen;

    if (!isControlled) {
      setInternalIsOpen(newState);
    }

    onToggle?.(newState);
  };

  return (
    <div className="border border-slate-200 rounded-lg mb-3 overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        data-section-id={sectionId}
        className={`
          w-full px-4 py-2.5 flex items-center justify-between text-left
          ${isOpen ? 'bg-slate-100 border-b border-slate-200' : 'bg-slate-50 hover:bg-slate-100'}
          transition-colors
        `}
      >
        <span className="font-medium text-sm text-slate-700">{title}</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-white">{children}</div>
      )}
    </div>
  );
}
