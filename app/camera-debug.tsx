import * as Camera from '@/modules/camera';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Image, NativeEventEmitter, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CameraDebugScreen() {
  const [status, setStatus] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [crashLogs, setCrashLogs] = useState<any[]>([]);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const [frameInfo, setFrameInfo] = useState<{ width: number; height: number; size: number } | null>(null);
  const frameCountRef = useRef<number>(0);
  const eventListenersRef = useRef<Map<string, any>>(new Map());
  const eventEmitterRef = useRef<any>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage].slice(-20)); // 최근 20개만
  };

  // NativeEventEmitter 초기화 (1회만)
  useEffect(() => {
    addLog('=== NativeEventEmitter 초기화 ===');
    try {
      const nativeModule = Camera.getNativeModule();
      addLog(`CustomCamera 모듈: ${nativeModule ? '있음' : '없음'}`);
      
      if (nativeModule) {
        eventEmitterRef.current = new NativeEventEmitter(nativeModule);
        addLog('✓ NativeEventEmitter 생성 완료');
        
        // onCameraFrame 기본 리스너 등록 (Native가 항상 이 이름으로 보냄)
        const baseListener = eventEmitterRef.current.addListener('onCameraFrame', (data: any) => {
          const eventKey = data?.eventKey || 'onCameraFrame';
          addLog(`✓✓✓ [onCameraFrame] 수신! eventKey: ${eventKey}, size: ${data.base64?.length || 0}`);
          
          // eventKey가 일치하는지 확인
          const targetListener = eventListenersRef.current.get(eventKey);
          if (targetListener) {
            targetListener(data);
          }
        });
        
        // 기본 리스너도 Map에 저장
        eventListenersRef.current.set('__base__', baseListener);
        addLog('✓ onCameraFrame 기본 리스너 등록 완료');
      } else {
        addLog('ERROR: CustomCamera 모듈을 찾을 수 없음');
      }
    } catch (error) {
      addLog(`ERROR 이벤트 이미터 설정 실패: ${error}`);
      console.error('Event emitter setup error:', error);
    }

    return () => {
      // 모든 리스너 해제
      eventListenersRef.current.forEach((listener, key) => {
        if (typeof listener === 'object' && listener.remove) {
          listener.remove();
        }
        addLog(`✓ 리스너 해제: ${key}`);
      });
      eventListenersRef.current.clear();
    };
  }, []);

  // 동적 이벤트 리스너 추가
  const addFrameListener = (eventKey: string) => {
    addLog(`[addFrameListener] 시작: ${eventKey}`);
    
    if (!eventEmitterRef.current) {
      addLog('ERROR: EventEmitter가 초기화되지 않음');
      Alert.alert('오류', 'EventEmitter가 초기화되지 않았습니다.');
      return;
    }

    // 이미 등록된 리스너가 있으면 제거
    const existing = eventListenersRef.current.get(eventKey);
    if (existing && typeof existing === 'function') {
      addLog(`기존 핸들러 제거: ${eventKey}`);
    }

    // 프레임 처리 핸들러 (실제 리스너가 아닌 콜백 함수)
    const frameHandler = (data: any) => {
      addLog(`✓✓✓ [${eventKey}] 프레임 처리! size: ${data.base64?.length || 0}`);
      
      frameCountRef.current += 1;
      setFrameCount(frameCountRef.current);
      
      if (data.base64) {
        setLastFrame(data.base64);
        const base64Size = data.base64.length;
        setFrameInfo({
          width: data.width || 0,
          height: data.height || 0,
          size: Math.round(base64Size / 1024)
        });
      }
    };

    eventListenersRef.current.set(eventKey, frameHandler);
    addLog(`✓ 프레임 핸들러 등록 완료: ${eventKey} (총 ${eventListenersRef.current.size}개)`);
  };

  // 리스너 제거
  const removeFrameListener = (eventKey: string) => {
    const handler = eventListenersRef.current.get(eventKey);
    if (handler) {
      eventListenersRef.current.delete(eventKey);
      addLog(`✓ 프레임 핸들러 해제: ${eventKey}`);
    }
  };

  const checkPermission = async () => {
    try {
      addLog('권한 확인 중...');
      const result = await Camera.checkCameraPermission();
      addLog(`권한 상태: ${JSON.stringify(result)}`);
      setStatus(result.granted ? '권한 있음 ✓' : '권한 없음 ✗');
    } catch (error) {
      addLog(`권한 확인 실패: ${error}`);
    }
  };

  const requestPermission = async () => {
    try {
      addLog('권한 요청 중...');
      const result = await Camera.requestCameraPermission();
      addLog(`권한 요청 결과: ${JSON.stringify(result)}`);
      
      // 요청 후 1초 뒤에 다시 확인
      setTimeout(async () => {
        const check = await Camera.checkCameraPermission();
        addLog(`권한 재확인: ${JSON.stringify(check)}`);
        setStatus(check.granted ? '권한 있음 ✓' : '권한 없음 ✗');
      }, 1000);
    } catch (error) {
      addLog(`권한 요청 실패: ${error}`);
    }
  };

  const startCamera = async () => {
    try {
      addLog('=== 카메라 시작 요청 ===');
      // 프레임 카운터 초기화
      frameCountRef.current = 0;
      setFrameCount(0);
      setLastFrame(null);
      setFrameInfo(null);
      
      const eventKey = 'cameraStream';
      addLog(`eventKey 설정: ${eventKey}`);
      
      // eventKey에 대한 리스너 등록
      addLog(`리스너 등록 중... (${eventKey})`);
      addFrameListener(eventKey);
      addLog(`리스너 등록 완료, 현재 활성 리스너 수: ${eventListenersRef.current.size}`);
      
      addLog('Native startCamera 호출 중...');
      const result = await Camera.startCamera({ facing: 'back', eventKey });
      addLog(`startCamera 응답: ${JSON.stringify(result)}`);
      
      if (result.success) {
        addLog(`✓ 카메라 시작 성공 - 프레임 대기 중 (${eventKey})`);
      } else {
        addLog(`✗ 카메라 시작 실패: ${result.error}`);
        Alert.alert('실패', result.error || '알 수 없는 오류');
      }
    } catch (error: any) {
      addLog(`ERROR 카메라 시작 실패: ${error.message || error}`);
      Alert.alert('크래시', `에러: ${error.message || error}`);
    }
  };

  const stopCamera = async () => {
    try {
      addLog('=== 카메라 중지 요청 ===');
      
      // 리스너 제거
      removeFrameListener('cameraStream');
      
      const result = await Camera.stopCamera();
      addLog(`카메라 중지 결과: ${JSON.stringify(result)}`);
      
      if (result.success) {
        addLog(`✓ 카메라 중지 성공 (총 수신 프레임: ${frameCountRef.current}개)`);
        Alert.alert('성공', `카메라가 중지되었습니다.\n총 ${frameCountRef.current}개의 프레임을 수신했습니다.`);
      } else {
        addLog(`ERROR: 카메라 중지 실패 - ${result.error}`);
        Alert.alert('실패', result.error || '카메라 중지 중 오류 발생');
      }
    } catch (error) {
      addLog(`ERROR 카메라 중지 실패: ${error}`);
      Alert.alert('오류', String(error));
    }
  };

  const checkCameraStatus = async () => {
    try {
      addLog('카메라 상태 확인 중...');
      const result = await Camera.getCameraStatus();
      addLog(`카메라 상태: ${JSON.stringify(result)}`);
      
      Alert.alert(
        '카메라 상태',
        `실행 중: ${result.isRecording ? '예' : '아니오'}\n` +
        `스트리밍: ${result.isStreaming ? '예' : '아니오'}\n` +
        `카메라 사용 가능: ${result.hasCamera ? '예' : '아니오'}`
      );
    } catch (error) {
      addLog(`상태 확인 실패: ${error}`);
    }
  };

  const getCrashLogs = async () => {
    try {
      addLog('크래시 로그 조회 중...');
      const result = await Camera.getCrashLogs();
      addLog(`크래시 로그: ${result.count}개 발견`);
      
      if (result.success && result.logs) {
        setCrashLogs(result.logs);
        if (result.count === 0) {
          Alert.alert('알림', '크래시 로그가 없습니다.');
        } else {
          Alert.alert(
            '크래시 로그',
            `총 ${result.count}개 발견`,
            [
              {
                text: '최신 로그 공유',
                onPress: () => Camera.shareCrashLog(result.logs![0].path),
              },
              { text: '확인' },
            ]
          );
        }
      }
    } catch (error) {
      addLog(`크래시 로그 조회 실패: ${error}`);
    }
  };

  const clearCrashLogs = async () => {
    try {
      Alert.alert(
        '크래시 로그 삭제',
        '모든 크래시 로그를 삭제하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
              addLog('크래시 로그 삭제 중...');
              const result = await Camera.clearCrashLogs();
              if (result.success) {
                addLog(`크래시 로그 ${result.deleted}개 삭제됨`);
                setCrashLogs([]);
                Alert.alert('완료', `${result.deleted}개의 로그를 삭제했습니다.`);
              } else {
                addLog(`삭제 실패: ${result.error}`);
                Alert.alert('실패', result.error || '삭제 중 오류 발생');
              }
            },
          },
        ]
      );
    } catch (error) {
      addLog(`크래시 로그 삭제 실패: ${error}`);
      Alert.alert('오류', String(error));
    }
  };

  const getDebugLog = async () => {
    try {
      addLog('디버그 로그 조회 중...');
      const result = await Camera.getDebugLog();
      
      if (result.success && result.content) {
        // 로그 내용을 20줄씩 표시
        const lines = result.content.split('\n');
        const lastLines = lines.slice(-30).join('\n');
        
        Alert.alert(
          '디버그 로그',
          `총 ${lines.length}줄\n경로: ${result.path}\n\n최근 30줄:\n${lastLines}`,
          [
            { text: '공유하기', onPress: () => Camera.shareDebugLog() },
            { text: '닫기' },
          ],
          { cancelable: true }
        );
        
        addLog(`디버그 로그: ${lines.length}줄, ${Math.round((result.size || 0) / 1024)}KB`);
      } else if (result.exists === false) {
        Alert.alert('알림', '디버그 로그가 아직 생성되지 않았습니다.');
        addLog('디버그 로그 없음');
      } else {
        Alert.alert('오류', result.error || '로그를 불러올 수 없습니다.');
        addLog(`디버그 로그 조회 실패: ${result.error}`);
      }
    } catch (error) {
      addLog(`디버그 로그 조회 실패: ${error}`);
      Alert.alert('오류', String(error));
    }
  };

  const shareDebugLog = async () => {
    try {
      addLog('디버그 로그 공유 중...');
      const result = await Camera.shareDebugLog();
      
      if (result.success) {
        addLog('디버그 로그 공유 창 열림');
      } else {
        Alert.alert('실패', result.error || '공유 중 오류 발생');
        addLog(`디버그 로그 공유 실패: ${result.error}`);
      }
    } catch (error) {
      addLog(`디버그 로그 공유 실패: ${error}`);
      Alert.alert('오류', String(error));
    }
  };

  const clearDebugLog = async () => {
    try {
      Alert.alert(
        '디버그 로그 삭제',
        '디버그 로그를 삭제하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
              addLog('디버그 로그 삭제 중...');
              const result = await Camera.clearDebugLog();
              if (result.success) {
                addLog('디버그 로그 삭제됨');
                Alert.alert('완료', result.message || '디버그 로그를 삭제했습니다.');
              } else {
                addLog(`삭제 실패: ${result.error}`);
                Alert.alert('실패', result.error || '삭제 중 오류 발생');
              }
            },
          },
        ]
      );
    } catch (error) {
      addLog(`디버그 로그 삭제 실패: ${error}`);
      Alert.alert('오류', String(error));
    }
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('로그 클리어됨');
  };

  useEffect(() => {
    checkPermission();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>카메라 디버그</Text>
        </View>
        <Text style={styles.status}>{status}</Text>

        {/* 프레임 정보 */}
        <View style={styles.frameInfo}>
          <Text style={styles.frameInfoTitle}>📹 프레임 정보</Text>
          <Text style={styles.frameInfoText}>수신 프레임: {frameCount}개</Text>
          {frameInfo && (
            <>
              <Text style={styles.frameInfoText}>
                해상도: {frameInfo.width} x {frameInfo.height}
              </Text>
              <Text style={styles.frameInfoText}>크기: ~{frameInfo.size} KB</Text>
            </>
          )}
          {lastFrame && (
            <View style={styles.framePreview}>
              <Text style={styles.framePreviewTitle}>최신 프레임:</Text>
              <Image 
                source={{ uri: lastFrame }} 
                style={styles.frameImage}
                resizeMode="contain"
              />
            </View>
          )}
        </View>

      <View style={styles.buttons}>
        <Button title="1. 권한 확인" onPress={checkPermission} />
        <Button title="2. 권한 요청" onPress={requestPermission} />
        <Button title="3. 카메라 시작" onPress={startCamera} />
        <Button title="4. 카메라 중지" onPress={stopCamera} />
        <Button title="5. 카메라 상태 확인" onPress={checkCameraStatus} color="#4CAF50" />
        
        <View style={styles.separator} />
        
        <Button title="📝 디버그 로그 보기" onPress={getDebugLog} color="#2196F3" />
        <Button title="📤 디버그 로그 공유" onPress={shareDebugLog} color="#03A9F4" />
        <Button title="🗑️ 디버그 로그 삭제" onPress={clearDebugLog} color="#FF9800" />
        
        <View style={styles.separator} />
        
        <Button title="크래시 로그 보기" onPress={getCrashLogs} color="#ff6b6b" />
        <Button title="크래시 로그 삭제" onPress={clearCrashLogs} color="#d32f2f" />
        <Button title="로그 클리어" onPress={clearLogs} color="#999" />
      </View>

      <ScrollView style={styles.logContainer}>
        <Text style={styles.logTitle}>📋 로그:</Text>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>
            {log}
          </Text>
        ))}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    marginRight: 10,
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  status: {
    fontSize: 18,
    marginBottom: 10,
    color: '#333',
  },
  frameInfo: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  frameInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  frameInfoText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  framePreview: {
    marginTop: 10,
  },
  framePreviewTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  frameImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#000',
    borderRadius: 4,
  },
  buttons: {
    gap: 10,
    marginBottom: 20,
  },
  separator: {
    height: 5,
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
    color: '#333',
  },
});
