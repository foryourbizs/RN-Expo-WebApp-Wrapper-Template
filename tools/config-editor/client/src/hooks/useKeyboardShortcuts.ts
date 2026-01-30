// tools/config-editor/client/src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { usePreview, DeviceSize } from '../contexts/PreviewContext';

const DEVICE_SIZE_KEYS: Record<string, DeviceSize> = {
  '1': 'small',
  '2': 'phone',
  '3': 'large',
  '4': 'tablet',
};

export function useKeyboardShortcuts() {
  const { toggleOrientation, setDeviceSize } = usePreview();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // input이나 textarea에서는 무시
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // R: 회전
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        toggleOrientation();
      }

      // 1-4: 디바이스 크기
      if (DEVICE_SIZE_KEYS[e.key]) {
        e.preventDefault();
        setDeviceSize(DEVICE_SIZE_KEYS[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleOrientation, setDeviceSize]);
}
