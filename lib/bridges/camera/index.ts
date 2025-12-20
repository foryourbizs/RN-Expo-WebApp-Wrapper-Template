/**
 * 카메라 관련 핸들러
 */

import { registerHandler } from '@/lib/bridge';

export const registerCameraHandlers = () => {
  // 카메라 권한 확인
  registerHandler('checkCameraPermission', async (_payload, respond) => {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ granted: false, status: 'unavailable', error: 'Only supported on Android' });
        return;
      }
      
      const Camera = await import('@/modules/camera');
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
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ granted: false, status: 'unavailable', error: 'Only supported on Android' });
        return;
      }
      
      const Camera = await import('@/modules/camera');
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
  registerHandler('takePhoto', async (_payload, respond) => {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ success: false, error: 'Only supported on Android' });
        return;
      }
      
      const Camera = await import('@/modules/camera');
      const result = await Camera.takePhoto();
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to take photo' 
      });
    }
  });

  // 카메라 녹화 시작
  registerHandler('startCamera', async (payload, respond) => {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ success: false, error: 'Only supported on Android' });
        return;
      }
      
      const Camera = await import('@/modules/camera');
      const options = payload as { facing?: 'front' | 'back'; eventKey?: string };
      const result = await Camera.startCamera(options);
      respond(result);
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start camera' 
      });
    }
  });

  // 카메라 녹화 중지
  registerHandler('stopCamera', async (_payload, respond) => {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ success: false, error: 'Only supported on Android' });
        return;
      }
      
      const Camera = await import('@/modules/camera');
      const result = await Camera.stopCamera();
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
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'android') {
        respond({ 
          success: true,
          data: {
            isRecording: false,
            isStreaming: false,
            facing: 'back',
            hasCamera: false
          }
        });
        return;
      }
      
      const Camera = await import('@/modules/camera');
      const status = await Camera.getCameraStatus();
      respond({ success: true, data: status });
    } catch (error) {
      respond({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get camera status' 
      });
    }
  });

  console.log('[Bridge] Camera handlers registered');
};
