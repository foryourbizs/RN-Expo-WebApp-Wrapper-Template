import { ReactNode } from 'react';
import LanguageSelector from './LanguageSelector';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-base font-semibold text-white">RNWW Config</h1>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <span className="text-xs text-slate-400">v1.0</span>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  );
}
