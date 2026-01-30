// tools/config-editor/client/src/components/Layout.tsx
import { ReactNode } from 'react';
import LanguageSelector from './LanguageSelector';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <span className="text-2xl">⚙️</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">RNWW Config Editor</h1>
              <p className="text-xs text-indigo-200">React Native WebView Wrapper</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <span className="px-2 py-1 text-xs font-medium text-indigo-200 bg-white/10 rounded-full">v1.0.0</span>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
