// tools/config-editor/client/src/hooks/useAccordionSync.ts
import { useCallback } from 'react';
import { usePreview } from '../contexts/PreviewContext';
import { SECTION_TO_SCREEN_MAP, HIGHLIGHT_SECTIONS } from '../constants/devices';

export function useAccordionSync() {
  const { setCurrentScreen, setHighlightTarget } = usePreview();

  const handleAccordionToggle = useCallback((sectionId: string, isOpen: boolean) => {
    if (!isOpen) {
      // 섹션이 닫히면 강조 해제
      setHighlightTarget(null);
      return;
    }

    // 열린 섹션에 맞는 화면으로 전환
    const screen = SECTION_TO_SCREEN_MAP[sectionId];
    if (screen) {
      setCurrentScreen(screen);
    }

    // 강조 표시 설정
    const highlight = HIGHLIGHT_SECTIONS[sectionId];
    setHighlightTarget(highlight || null);
  }, [setCurrentScreen, setHighlightTarget]);

  return { handleAccordionToggle };
}
