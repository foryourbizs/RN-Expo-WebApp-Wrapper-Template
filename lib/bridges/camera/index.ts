/**
 * 카메라 관련 핸들러
 */

import { registerHandler, sendToWeb } from '@/lib/bridge';
import { Platform } from 'react-native';

export const registerCameraHandlers = () => {
  // Android와 iOS만 지원
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    console.log('[Bridge] Camera handlers skipped (Android/iOS only)');
    return;
  }

  // 카메라 모듈을 안전하게 로드
  let Camera: any = null;
  try {
    Camera = require('@/modules/camera');
  } catch (error) {
    console.error('[Bridge] Failed to load camera module:', error);
    return;
  }

  // 이벤트 리스너 구독 객체 저장 (메모리 누수 방지)
  let frameSubscription: any = null;

  // 카메라 권한 확인
  registerHandler('checkCameraPermission', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ granted: false, status: 'unavailable', error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.checkCameraPermission();
      respond({ success: true, ...result });
    } catch (error) {
      respond({ 
        success: false, 
        granted: false, 
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to check camera permission' 
      });
    }
  });

  // 카메라 권한 요청
  registerHandler('requestCameraPermission', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ granted: false, status: 'unavailable', error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.requestCameraPermission();
      respond({ success: true, ...result });
    } catch (error) {
      respond({ 
        success: false, 
        granted: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to request camera permission' 
      });
    }
  });

  // 사진 촬영
  registerHandler('takePhoto', async (payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const options = payload as { facing?: 'front' | 'back' };
      const facing = options?.facing || 'back';  // 기본값: 후면 카메라
      
      const result = await Camera.takePhoto(facing);
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to take photo' 
      });
    }
  });

  // 카메라 스트리밍 시작
  registerHandler('startCamera', async (payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      // 기존 리스너 정리 (중복 방지)
      if (frameSubscription) {
        try {
          frameSubscription.remove();
        } catch (e) {
          console.warn('[Bridge] Failed to remove existing listener:', e);
        }
      }
      
      // 새 리스너 등록
      try {
        frameSubscription = Camera.addListener('onCameraFrame', (data: any) => {
          sendToWeb('onCameraFrame', data);
        });
      } catch (e) {
        console.error('[Bridge] Failed to register frame listener:', e);
      }
      
      // 파라미터 정규화 (호환성 유지)
      const options = payload as { 
        facing?: 'front' | 'back';
        fps?: number;
        quality?: number;
        maxWidth?: number;
        maxHeight?: number;
      };
      
      const result = await Camera.startCamera(options);
      respond(result);
    } catch (error) {
      console.error('[Bridge] startCamera error:', error);
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start camera' 
      });
    }
  });

  // 카메라 중지
  registerHandler('stopCamera', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.stopCamera();
      
      // 이벤트 리스너 정리 (메모리 누수 방지)
      if (frameSubscription) {
        try {
          frameSubscription.remove();
          frameSubscription = null;
        } catch (e) {
          console.warn('[Bridge] Failed to remove frame listener:', e);
        }
      }
      
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to stop camera' 
      });
    }
  });

  // 카메라 상태 확인
  registerHandler('getCameraStatus', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ 
          isStreaming: false,
          facing: 'back',
          hasCamera: false
        });
        return;
      }
      
      const status = await Camera.getCameraStatus();
      respond(status);
    } catch (error) {
      respond({ 
        isStreaming: false,
        facing: 'back',
        hasCamera: false,
        error: error instanceof Error ? error.message : 'Failed to get camera status'
      });
    }
  });

  // 크래시 로그 조회
  registerHandler('getCrashLogs', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.getCrashLogs();
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get crash logs' 
      });
    }
  });

  // 크래시 로그 공유
  registerHandler('shareCrashLog', async (payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const { filePath } = payload as { filePath: string };
      if (!filePath) {
        respond({ success: false, error: 'filePath is required' });
        return;
      }
      
      const result = await Camera.shareCrashLog(filePath);
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to share crash log' 
      });
    }
  });

  // 크래시 로그 삭제
  registerHandler('clearCrashLogs', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.clearCrashLogs();
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to clear crash logs' 
      });
    }
  });

  // 디버그 로그 가져오기
  registerHandler('getDebugLog', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.getDebugLog();
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get debug log' 
      });
    }
  });

  // 디버그 로그 공유하기
  registerHandler('shareDebugLog', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.shareDebugLog();
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to share debug log' 
      });
    }
  });

  // 디버그 로그 삭제
  registerHandler('clearDebugLog', async (_payload, respond) => {
    try {
      if (!Camera) {
        respond({ success: false, error: 'Camera module not available' });
        return;
      }
      
      const result = await Camera.clearDebugLog();
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to clear debug log' 
      });
    }
  });

  console.log('[Bridge] Camera handlers registered');
};
