// tools/config-editor/client/src/components/Layout.tsx
import { ReactNode } from 'react';
import LanguageSelector from './LanguageSelector';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">RNWW Config Editor</h1>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <span className="text-sm text-gray-500">v1.0.0</span>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
