import { useState, ReactNode } from 'react';

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-200 rounded-xl mb-4 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full px-5 py-4 flex items-center justify-between
          ${isOpen
            ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-200'
            : 'bg-slate-50 hover:bg-slate-100'
          }
          transition-all duration-200
        `}
      >
        <div className="flex items-center gap-3">
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center text-sm
            ${isOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}
            transition-colors duration-200
          `}>
            {isOpen ? '📂' : '📁'}
          </div>
          <span className={`font-semibold ${isOpen ? 'text-indigo-700' : 'text-slate-700'}`}>{title}</span>
        </div>
        <div className={`
          w-6 h-6 rounded-full flex items-center justify-center
          ${isOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}
          transition-all duration-300
          ${isOpen ? 'rotate-180' : 'rotate-0'}
        `}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      <div className={`
        transition-all duration-300 ease-in-out
        ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
        overflow-hidden
      `}>
        <div className="px-5 py-5 bg-white">{children}</div>
      </div>
    </div>
  );
}
