/**
 * Camera Module (Cross-Platform)
 * 카메라 권한 및 촬영 기능 제공
 * Supports: Android, iOS
 */

import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

// Lazy 모듈 로드 (크래시 방지)
let CameraModule: any = null;

function getCameraModule() {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return null;
  }
  
  if (CameraModule === null) {
    try {
      CameraModule = requireNativeModule('CustomCamera');
    } catch (error) {
      console.error('[CustomCamera] Failed to load native module:', error);
      CameraModule = undefined; // 재시도 방지
      return null;
    }
  }
  
  return CameraModule === undefined ? null : CameraModule;
}

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
  /** 프레임레이트 (1-30, 기본값: 10) */
  fps?: number;
  /** JPEG 압축 품질 (1-100, 기본값: 30) */
  quality?: number;
  /** 최대 가로 해상도 (px) */
  maxWidth?: number;
  /** 최대 세로 해상도 (px) */
  maxHeight?: number;
}

export interface RecordingResult {
  /** 성공 여부 */
  success: boolean;
  /** 스트리밍 여부 */
  isStreaming?: boolean;
  /** 오류 메시지 */
  error?: string;
}

export interface CameraStatus {
  /** 스트리밍 여부 */
  isStreaming: boolean;
  /** 카메라 방향 */
  facing: string;
  /** 카메라 사용 가능 여부 */
  hasCamera: boolean;
}

export interface CrashLog {
  /** 파일명 */
  name: string;
  /** 파일 경로 */
  path: string;
  /** 파일 크기 (bytes) */
  size: number;
  /** 생성 날짜 (timestamp) */
  date: number;
}

export interface DebugLogResult {
  /** 성공 여부 */
  success: boolean;
  /** 로그 내용 */
  content?: string;
  /** 파일 경로 */
  path?: string;
  /** 파일 크기 */
  size?: number;
  /** 파일 존재 여부 */
  exists?: boolean;
  /** 오류 메시지 */
  error?: string;
  /** 메시지 */
  message?: string;
}

export interface CrashLogsResult {
  /** 성공 여부 */
  success: boolean;
  /** 크래시 로그 목록 */
  logs?: CrashLog[];
  /** 로그 개수 */
  count?: number;
  /** 오류 메시지 */
  error?: string;
}

export interface PhotoResult {
  /** 성공 여부 */
  success: boolean;
  /** base64 인코딩된 이미지 */
  base64?: string;
  /** 이미지 너비 */
  width?: number;
  /** 이미지 높이 */
  height?: number;
  /** 사용된 카메라 방향 */
  facing?: string;
  /** 오류 메시지 */
  error?: string;
}

/**
 * 카메라 권한 확인
 * @returns 카메라 권한 상태
 */
export async function checkCameraPermission(): Promise<CameraPermissionStatus> {
  const module = getCameraModule();
  if (!module) {
    return { granted: false, status: 'unavailable' };
  }
  return await module.checkCameraPermission();
}

/**
 * 카메라 권한 요청
 * @returns 권한 요청 결과
 */
export async function requestCameraPermission(): Promise<CameraPermissionStatus> {
  const module = getCameraModule();
  if (!module) {
    return { granted: false, status: 'unavailable' };
  }
  return await module.requestCameraPermission();
}

/**
 * 사진 촬영 (1프레임 캡처)
 * @param facing 카메라 방향 (front/back, 기본값: back)
 * @returns 촬영 결과 및 base64 이미지
 */
export async function takePhoto(facing?: 'front' | 'back'): Promise<PhotoResult> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  return await module.takePhoto(facing || 'back');
}

/**
 * 카메라 스트리밍 시작
 * @param options 카메라 옵션
 * @returns 시작 결과
 */
export async function startCamera(options?: CameraRecordingOptions): Promise<RecordingResult> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  
  // 파라미터 정규화 (호환성 유지)
  const params = {
    facing: options?.facing || 'back',
    fps: options?.fps,
    quality: options?.quality,
    maxWidth: options?.maxWidth,
    maxHeight: options?.maxHeight,
  };
  
  return await module.startCamera(params);
}

/**
 * 비디오 녹화 중지
 * @returns 녹화 중지 결과
 */
export async function stopCamera(): Promise<RecordingResult> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  return await module.stopCamera();
}

/**
 * 카메라 상태 확인
 * @returns 현재 카메라 상태
 */
export async function getCameraStatus(): Promise<CameraStatus> {
  const module = getCameraModule();
  if (!module) {
    return { 
      isStreaming: false, 
      facing: 'back',
      hasCamera: false 
    };
  }
  return await module.getCameraStatus();
}

/**
 * 크래시 로그 목록 가져오기
 * @returns 크래시 로그 목록
 */
export async function getCrashLogs(): Promise<CrashLogsResult> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  return await module.getCrashLogs();
}

/**
 * 크래시 로그 공유하기 (카카오톡, 이메일 등)
 * @param filePath 공유할 로그 파일 경로
 * @returns 공유 성공 여부
 */
export async function shareCrashLog(filePath: string): Promise<{ success: boolean; error?: string }> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  return await module.shareCrashLog(filePath);
}

/**
 * 모든 크래시 로그 삭제
 * @returns 삭제 성공 여부 및 삭제된 파일 수
 */
export async function clearCrashLogs(): Promise<{ success: boolean; deleted?: number; error?: string }> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  return await module.clearCrashLogs();
}

/**
 * 디버그 로그 가져오기
 * @returns 디버그 로그 내용
 */
export async function getDebugLog(): Promise<DebugLogResult> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  return await module.getDebugLog();
}

/**
 * 디버그 로그 공유하기
 * @returns 공유 성공 여부
 */
export async function shareDebugLog(): Promise<{ success: boolean; error?: string }> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  return await module.shareDebugLog();
}

/**
 * 디버그 로그 삭제
 * @returns 삭제 성공 여부
 */
export async function clearDebugLog(): Promise<{ success: boolean; error?: string; message?: string }> {
  const module = getCameraModule();
  if (!module) {
    return { success: false, error: 'Camera module not available' };
  }
  return await module.clearDebugLog();
}

/**
 * Add listener for camera events (Expo module style)
 * @param eventName Event name to listen to (e.g., 'onCameraFrame')
 * @param listener Callback function to handle the event
 * @returns Subscription object with remove() method
 */
export function addListener(eventName: string, listener: (event: any) => void): { remove: () => void } {
  const module = getCameraModule();
  if (!module || !module.addListener) {
    console.error('[CustomCamera] addListener not available');
    return { remove: () => {} };
  }
  return module.addListener(eventName, listener);
}
