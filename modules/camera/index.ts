/**
 * Camera Module (Android Only)
 * 카메라 권한 및 녹화 기능 제공
 */

import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

// Android에서만 네이티브 모듈 로드
const CameraModule = Platform.OS === 'android' 
  ? requireNativeModule('Camera')
  : null;

export interface CameraPermissionStatus {
  /** 권한 승인 여부 */
  granted: boolean;
  /** 권한 상태 */
  status: string;
  /** 카메라 권한 */
  cameraGranted?: boolean;
  /** 마이크 권한 */
  micGranted?: boolean;
}

export interface CameraRecordingOptions {
  /** 카메라 방향 (front/back) */
  facing?: 'front' | 'back';
  /** 이벤트 키 (프레임 스트리밍용) */
  eventKey?: string;
}

export interface RecordingResult {
  /** 성공 여부 */
  success: boolean;
  /** 녹화 여부 */
  isRecording?: boolean;
  /** 스트리밍 여부 */
  isStreaming?: boolean;
  /** 오류 메시지 */
  error?: string;
}

export interface CameraStatus {
  /** 녹화 여부 */
  isRecording: boolean;
  /** 스트리밍 여부 */
  isStreaming: boolean;
  /** 카메라 방향 */
  facing: string;
  /** 카메라 사용 가능 여부 */
  hasCamera: boolean;
}

export interface PhotoResult {
  /** 성공 여부 */
  success: boolean;
  /** 사진 파일 경로 */
  path?: string;
  /** 오류 메시지 */
  error?: string;
}

/**
 * 카메라 권한 확인
 * @returns 카메라 권한 상태
 */
export async function checkCameraPermission(): Promise<CameraPermissionStatus> {
  if (Platform.OS !== 'android' || !CameraModule) {
    return { granted: false, status: 'unavailable' };
  }
  return await CameraModule.checkCameraPermission();
}

/**
 * 카메라 권한 요청
 * @returns 권한 요청 결과
 */
export async function requestCameraPermission(): Promise<CameraPermissionStatus> {
  if (Platform.OS !== 'android' || !CameraModule) {
    return { granted: false, status: 'unavailable' };
  }
  return await CameraModule.requestCameraPermission();
}

/**
 * 사진 촬영
 * @returns 촬영 결과 및 파일 경로
 */
export async function takePhoto(): Promise<PhotoResult> {
  if (Platform.OS !== 'android' || !CameraModule) {
    return { success: false, error: 'Only supported on Android' };
  }
  return await CameraModule.takePhoto();
}

/**
 * 비디오 녹화 시작 (선택적으로 프레임 스트리밍)
 * @param options 녹화 옵션 (카메라 방향, 이벤트 키)
 * @returns 녹화 시작 결과
 */
export async function startCamera(options?: CameraRecordingOptions): Promise<RecordingResult> {
  if (Platform.OS !== 'android' || !CameraModule) {
    return { success: false, error: 'Only supported on Android' };
  }
  
  const { facing = 'back', eventKey } = options || {};
  return await CameraModule.startCamera(facing, eventKey || null);
}

/**
 * 비디오 녹화 중지
 * @returns 녹화 중지 결과
 */
export async function stopCamera(): Promise<RecordingResult> {
  if (Platform.OS !== 'android' || !CameraModule) {
    return { success: false, error: 'Only supported on Android' };
  }
  return await CameraModule.stopCamera();
}

/**
 * 카메라 상태 확인
 * @returns 현재 카메라 상태
 */
export async function getCameraStatus(): Promise<CameraStatus> {
  if (Platform.OS !== 'android' || !CameraModule) {
    return { 
      isRecording: false, 
      isStreaming: false, 
      facing: 'back',
      hasCamera: false 
    };
  }
  return await CameraModule.getCameraStatus();
}
