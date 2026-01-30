import { ReactNode, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';

interface LayoutProps {
  children: ReactNode;
  previewPanel?: ReactNode;
}

export default function Layout({ children, previewPanel }: LayoutProps) {
  const { t } = useTranslation();
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(true);

  // 반응형 처리
  useEffect(() => {
    const checkWidth = () => {
      setIsWideScreen(window.innerWidth >= 1024);
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-base font-semibold text-white">RNWW Config</h1>
          <div className="flex items-center gap-3">
            {/* 모바일에서 Preview 토글 버튼 */}
            {!isWideScreen && previewPanel && (
              <button
                onClick={() => setShowPreviewModal(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {t('preview.showPreview')}
              </button>
            )}
            <LanguageSelector />
            <span className="text-xs text-slate-400">v1.0</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-4">
        {previewPanel && isWideScreen ? (
          <div className="grid grid-cols-[65%_35%] gap-4">
            <div>{children}</div>
            <div className="sticky top-4 h-[calc(100vh-6rem)]">
              {previewPanel}
            </div>
          </div>
        ) : (
          children
        )}
      </main>

      {/* 모바일 Preview 모달 */}
      {showPreviewModal && previewPanel && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <span className="font-medium text-slate-700">{t('preview.title')}</span>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {previewPanel}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
