// tools/config-editor/client/src/pages/DebugConfig.tsx
// ADB 무선 디버깅 설정 페이지 - 단계별 가이드

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import TextInput from '../components/form/TextInput';

// 디바이스 정보 타입
interface Device {
  id: string;
  status: 'device' | 'offline' | 'unauthorized' | 'no permissions';
  isWireless: boolean;
  model?: string;
  product?: string;
  device?: string;
}

// 환경 상태 타입
interface EnvStatus {
  adbAvailable: boolean;
  adbPath?: string;
  adbVersion?: string;
  error?: string;
}

// 로그 항목 타입
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

// 현재 단계 타입
type ConnectionStep = 'check-env' | 'select-method' | 'usb-wireless' | 'pair' | 'connect' | 'ready';

export default function DebugConfigPage() {
  const { t } = useTranslation();

  // 상태
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<ConnectionStep>('check-env');

  // 입력 필드
  const [pairAddress, setPairAddress] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [connectAddress, setConnectAddress] = useState('');
  const [tcpPort, setTcpPort] = useState('5555');

  // 로그
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logType, setLogType] = useState<'native' | 'webview' | 'all'>('native');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedLogDevice, setSelectedLogDevice] = useState<string>('');
  const logContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 로그 추가
  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, level, message }].slice(-500));
  }, []);

  // 로그 컨테이너 자동 스크롤
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // 환경 확인
  const checkEnvironment = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/adb/check');
      const data = await res.json();
      setEnvStatus(data);
      if (data.adbAvailable) {
        addLog('success', `ADB ${t('adb.available')}: ${data.adbVersion}`);
        // adbAvailable 값을 직접 전달 (상태 업데이트가 비동기라서)
        await refreshDevices(true);
      } else {
        addLog('error', `ADB ${t('adb.unavailable')}: ${data.error || 'Not found'}`);
      }
    } catch (e) {
      setEnvStatus({ adbAvailable: false, error: 'Failed to check ADB' });
      addLog('error', 'ADB check failed');
    }
    setLoading(false);
  };

  // 디바이스 목록 조회
  // adbAvailable 파라미터: 환경 확인 직후 호출 시 상태가 아직 업데이트 안됐을 수 있어서 직접 전달
  const refreshDevices = async (adbAvailable?: boolean) => {
    try {
      const res = await fetch('/api/adb/devices');
      const data = await res.json();
      setDevices(data.devices || []);
      addLog('info', `${t('adb.foundDevices')}: ${data.devices?.length || 0}`);

      // 연결된 디바이스가 있으면 ready 단계로
      const connected = (data.devices || []).filter((d: Device) => d.status === 'device');
      const isAdbAvailable = adbAvailable ?? envStatus?.adbAvailable;

      if (connected.length > 0) {
        setCurrentStep('ready');
      } else if (isAdbAvailable) {
        setCurrentStep('select-method');
      }
    } catch (e) {
      addLog('error', t('adb.deviceListFailed'));
    }
  };

  // 초기 환경 확인
  useEffect(() => {
    checkEnvironment();
  }, []);

  // 무선 디버깅 페어링
  const handlePair = async () => {
    if (!pairAddress) {
      addLog('warn', t('adb.enterPairAddress'));
      return;
    }

    setActionLoading('pair');
    addLog('info', `${t('adb.pairing')}: ${pairAddress}`);

    try {
      const res = await fetch('/api/adb/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: pairAddress, code: pairCode })
      });
      const data = await res.json();

      if (data.success) {
        addLog('success', t('adb.pairSuccess'));
        setPairAddress('');
        setPairCode('');
        setCurrentStep('connect');
      } else {
        addLog('error', `${t('adb.pairFailed')}: ${data.error}`);
      }
    } catch (e) {
      addLog('error', t('adb.pairFailed'));
    }
    setActionLoading(null);
  };

  // 무선 디버깅 연결
  const handleConnect = async () => {
    if (!connectAddress) {
      addLog('warn', t('adb.enterConnectAddress'));
      return;
    }

    setActionLoading('connect');
    addLog('info', `${t('adb.connecting')}: ${connectAddress}`);

    try {
      const res = await fetch('/api/adb/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: connectAddress })
      });
      const data = await res.json();

      if (data.success) {
        addLog('success', `${t('adb.connectSuccess')}: ${data.device || connectAddress}`);
        setConnectAddress('');
        await refreshDevices();
        setCurrentStep('ready');
      } else {
        addLog('error', `${t('adb.connectFailed')}: ${data.error}`);
      }
    } catch (e) {
      addLog('error', t('adb.connectFailed'));
    }
    setActionLoading(null);
  };

  // 무선 디버깅 연결 해제
  const handleDisconnect = async (deviceId?: string) => {
    setActionLoading('disconnect');
    addLog('info', deviceId ? `${t('adb.disconnecting')}: ${deviceId}` : t('adb.disconnectingAll'));

    try {
      const res = await fetch('/api/adb/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: deviceId })
      });
      const data = await res.json();

      if (data.success) {
        addLog('success', t('adb.disconnectSuccess'));
        await refreshDevices();
      } else {
        addLog('error', `${t('adb.disconnectFailed')}: ${data.error}`);
      }
    } catch (e) {
      addLog('error', t('adb.disconnectFailed'));
    }
    setActionLoading(null);
  };

  // USB를 통한 무선 디버깅 활성화
  const handleTcpip = async () => {
    setActionLoading('tcpip');
    addLog('info', `${t('adb.enablingTcpip')}: ${tcpPort}`);

    try {
      const res = await fetch('/api/adb/tcpip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: tcpPort })
      });
      const data = await res.json();

      if (data.success) {
        addLog('success', `${t('adb.tcpipSuccess')}: ${data.address}`);
        if (data.address) {
          setConnectAddress(data.address);
        }
        await refreshDevices();
        setCurrentStep('ready');
      } else {
        addLog('error', `${t('adb.tcpipFailed')}: ${data.error}`);
      }
    } catch (e) {
      addLog('error', t('adb.tcpipFailed'));
    }
    setActionLoading(null);
  };

  // Logcat 스트리밍 시작
  const startLogcat = async () => {
    const device = selectedLogDevice || devices.find(d => d.status === 'device')?.id;
    if (!device) {
      addLog('warn', t('adb.selectDevice'));
      return;
    }

    // 기존 스트림 중지
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsStreaming(true);
    setLogs([]);
    addLog('info', `${t('adb.startingLogcat')}: ${device} (${logType})`);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch(`/api/adb/logcat?device=${encodeURIComponent(device)}&type=${logType}`, {
        signal: abortControllerRef.current.signal
      });

      if (!res.ok || !res.body) {
        throw new Error('Failed to start logcat');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            // 로그 레벨 감지
            let level: LogEntry['level'] = 'info';
            if (line.includes(' E ') || line.includes('/E ') || line.includes('Error')) {
              level = 'error';
            } else if (line.includes(' W ') || line.includes('/W ') || line.includes('Warning')) {
              level = 'warn';
            }
            addLog(level, line);
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        addLog('error', `Logcat error: ${e.message}`);
      }
    }

    setIsStreaming(false);
  };

  // Logcat 스트리밍 중지
  const stopLogcat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    addLog('info', t('adb.stoppedLogcat'));
  };

  // 컴포넌트 언마운트 시 스트림 정리
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 연결된 디바이스 수
  const connectedDevices = devices.filter(d => d.status === 'device');
  const usbDevices = devices.filter(d => !d.isWireless && d.status === 'device');
  const wirelessDevices = devices.filter(d => d.isWireless && d.status === 'device');

  // 단계별 진행 상태 표시
  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-6">
      {['check-env', 'select-method', 'connect', 'ready'].map((step, idx) => {
        const stepLabels: Record<string, string> = {
          'check-env': '1. 환경 확인',
          'select-method': '2. 연결 방법',
          'connect': '3. 연결',
          'ready': '4. 로그 보기'
        };
        const isActive = currentStep === step ||
          (step === 'connect' && (currentStep === 'usb-wireless' || currentStep === 'pair'));
        const isPast = idx < ['check-env', 'select-method', 'connect', 'ready'].indexOf(
          currentStep === 'usb-wireless' || currentStep === 'pair' ? 'connect' : currentStep
        );

        return (
          <div key={step} className="flex items-center gap-2">
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
              ${isPast ? 'bg-green-500 text-white' : isActive ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'}
            `}>
              {isPast ? '✓' : idx + 1}
            </div>
            <span className={`text-sm ${isActive ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
              {stepLabels[step]}
            </span>
            {idx < 3 && <div className="w-8 h-0.5 bg-slate-200" />}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <StepIndicator />

      {/* Step 1: 환경 확인 */}
      {currentStep === 'check-env' && (
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <h3 className="text-lg font-medium text-slate-800 mb-4">{t('adb.environmentStatus')}</h3>

          {envStatus === null ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-500">{t('common.loading')}</p>
            </div>
          ) : envStatus.adbAvailable ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <p className="text-green-600 font-medium mb-2">ADB {t('adb.available')}</p>
              <p className="text-slate-500 text-sm">{envStatus.adbVersion}</p>
            </div>
          ) : (
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-red-700 font-medium mb-1">ADB {t('adb.unavailable')}</p>
                  <p className="text-red-600 text-sm mb-3">{envStatus.error}</p>
                  <p className="text-slate-600 text-sm">{t('adb.installGuide')}</p>
                </div>
              </div>
              <button
                onClick={checkEnvironment}
                disabled={loading}
                className="mt-4 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
              >
                {t('adb.checkEnv')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: 연결 방법 선택 */}
      {currentStep === 'select-method' && (
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <h3 className="text-lg font-medium text-slate-800 mb-4">연결 방법 선택</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* USB 연결 방법 */}
            <button
              onClick={() => setCurrentStep('usb-wireless')}
              className="p-4 border-2 border-slate-200 rounded-xl text-left hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🔌</span>
                <span className="font-medium text-slate-800">USB 케이블 사용 (권장)</span>
              </div>
              <p className="text-sm text-slate-500">
                USB로 연결 후 무선 디버깅 활성화. 가장 간단한 방법입니다.
              </p>
              {usbDevices.length > 0 && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ USB 디바이스 감지됨: {usbDevices.length}개
                </p>
              )}
            </button>

            {/* 무선 페어링 방법 */}
            <button
              onClick={() => setCurrentStep('pair')}
              className="p-4 border-2 border-slate-200 rounded-xl text-left hover:border-purple-400 hover:bg-purple-50 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">📶</span>
                <span className="font-medium text-slate-800">무선 페어링 (Android 11+)</span>
              </div>
              <p className="text-sm text-slate-500">
                케이블 없이 QR 코드 또는 페어링 코드로 연결합니다.
              </p>
            </button>
          </div>

          {/* 이미 연결된 디바이스가 있는 경우 */}
          {connectedDevices.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <p className="text-green-700 text-sm">
                ✓ 이미 {connectedDevices.length}개의 디바이스가 연결되어 있습니다.
              </p>
              <button
                onClick={() => setCurrentStep('ready')}
                className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
              >
                로그 보기로 이동
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3a: USB를 통한 무선 활성화 */}
      {currentStep === 'usb-wireless' && (
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-800">USB를 통한 무선 디버깅 활성화</h3>
            <button
              onClick={() => setCurrentStep('select-method')}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← 뒤로
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-xl">1️⃣</span>
              <div>
                <p className="font-medium text-slate-800">USB 케이블로 디바이스 연결</p>
                <p className="text-sm text-slate-600">USB 디버깅이 활성화되어 있어야 합니다.</p>
              </div>
            </div>

            {usbDevices.length === 0 ? (
              <div className="p-4 bg-amber-50 rounded-lg">
                <p className="text-amber-700">USB로 연결된 디바이스가 없습니다.</p>
                <button
                  onClick={refreshDevices}
                  className="mt-2 px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
                >
                  새로고침
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <span className="text-xl">✓</span>
                  <div>
                    <p className="font-medium text-green-700">USB 디바이스 감지됨</p>
                    {usbDevices.map(d => (
                      <p key={d.id} className="text-sm text-slate-600">{d.model || d.id}</p>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <span className="text-xl">2️⃣</span>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">무선 디버깅 포트 설정</p>
                    <div className="flex items-center gap-3 mt-2">
                      <input
                        type="text"
                        value={tcpPort}
                        onChange={e => setTcpPort(e.target.value)}
                        placeholder="5555"
                        className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm"
                      />
                      <button
                        onClick={handleTcpip}
                        disabled={actionLoading === 'tcpip'}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {actionLoading === 'tcpip' ? '활성화 중...' : '무선 활성화'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Step 3b: 무선 페어링 */}
      {currentStep === 'pair' && (
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-800">무선 디버깅 페어링</h3>
            <button
              onClick={() => setCurrentStep('select-method')}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← 뒤로
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="font-medium text-purple-800 mb-2">📱 휴대폰에서 설정하기</p>
              <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                <li>설정 → 개발자 옵션 → 무선 디버깅 활성화</li>
                <li>"페어링 코드로 기기 페어링" 클릭</li>
                <li>표시되는 IP:Port와 페어링 코드 입력</li>
              </ol>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <TextInput
                label="페어링 주소 (IP:Port)"
                value={pairAddress}
                onChange={setPairAddress}
                placeholder="192.168.0.10:37123"
              />
              <TextInput
                label="페어링 코드"
                value={pairCode}
                onChange={setPairCode}
                placeholder="123456"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePair}
                disabled={actionLoading === 'pair' || !pairAddress}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {actionLoading === 'pair' ? '페어링 중...' : '페어링'}
              </button>
              <button
                onClick={() => setCurrentStep('connect')}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                이미 페어링됨 → 연결하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3c: 연결 */}
      {currentStep === 'connect' && (
        <div className="p-6 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-800">무선 디버깅 연결</h3>
            <button
              onClick={() => setCurrentStep('select-method')}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← 뒤로
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="font-medium text-green-800 mb-2">📱 휴대폰에서 확인하기</p>
              <p className="text-sm text-slate-600">
                무선 디버깅 화면에서 "IP 주소 및 포트" 확인 (페어링 포트와 다름!)
              </p>
            </div>

            <TextInput
              label="연결 주소 (IP:Port)"
              value={connectAddress}
              onChange={setConnectAddress}
              placeholder="192.168.0.10:43567"
            />

            <button
              onClick={handleConnect}
              disabled={actionLoading === 'connect' || !connectAddress}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading === 'connect' ? '연결 중...' : '연결'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: 준비 완료 - 로그 보기 */}
      {currentStep === 'ready' && (
        <>
          {/* 연결된 디바이스 목록 */}
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-slate-800">{t('adb.connectedDevices')}</h3>
              <div className="flex gap-2">
                <button
                  onClick={refreshDevices}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                >
                  {t('adb.refresh')}
                </button>
                <button
                  onClick={() => setCurrentStep('select-method')}
                  className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                >
                  + 디바이스 추가
                </button>
              </div>
            </div>

            {connectedDevices.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-slate-500">{t('adb.noDevices')}</p>
                <button
                  onClick={() => setCurrentStep('select-method')}
                  className="mt-2 text-blue-600 text-sm hover:underline"
                >
                  디바이스 연결하기
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {connectedDevices.map(device => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <div>
                        <div className="font-mono text-sm text-slate-700">{device.model || device.id}</div>
                        <div className="text-xs text-slate-500">{device.id}</div>
                      </div>
                      {device.isWireless && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                          {t('adb.wireless')}
                        </span>
                      )}
                    </div>
                    {device.isWireless && (
                      <button
                        onClick={() => handleDisconnect(device.id)}
                        disabled={actionLoading === 'disconnect'}
                        className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                      >
                        {t('adb.disconnect')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 디바이스 로그 */}
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-slate-800">{t('adb.deviceLogs')}</h3>
              <div className="flex items-center gap-2">
                {connectedDevices.length > 1 && (
                  <select
                    value={selectedLogDevice}
                    onChange={e => setSelectedLogDevice(e.target.value)}
                    className="px-2 py-1 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="">{t('adb.autoSelectDevice')}</option>
                    {connectedDevices.map(d => (
                      <option key={d.id} value={d.id}>{d.model || d.id}</option>
                    ))}
                  </select>
                )}
                <select
                  value={logType}
                  onChange={e => setLogType(e.target.value as typeof logType)}
                  className="px-2 py-1 text-sm border border-slate-300 rounded-lg"
                  disabled={isStreaming}
                >
                  <option value="native">{t('adb.logNative')}</option>
                  <option value="webview">{t('adb.logWebview')}</option>
                  <option value="all">{t('adb.logAll')}</option>
                </select>
                {!isStreaming ? (
                  <button
                    onClick={startLogcat}
                    disabled={connectedDevices.length === 0}
                    className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                  >
                    {t('adb.startLog')}
                  </button>
                ) : (
                  <button
                    onClick={stopLogcat}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    {t('adb.stopLog')}
                  </button>
                )}
                <button
                  onClick={() => setLogs([])}
                  className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >
                  {t('adb.clearLog')}
                </button>
              </div>
            </div>

            {/* 로그 출력 */}
            <div
              ref={logContainerRef}
              className="h-80 overflow-y-auto bg-slate-900 rounded-lg p-3 font-mono text-xs"
            >
              {logs.length === 0 ? (
                <div className="text-slate-500 text-center py-8">
                  {isStreaming ? '로그 대기 중...' : t('adb.noLogs')}
                </div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={`py-0.5 ${
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warn' ? 'text-amber-400' :
                      log.level === 'success' ? 'text-green-400' :
                      'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-500">[{log.timestamp}]</span> {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* 활동 로그 (항상 표시) */}
      {logs.length > 0 && currentStep !== 'ready' && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <h4 className="text-sm font-medium text-slate-600 mb-2">활동 로그</h4>
          <div className="max-h-32 overflow-y-auto text-xs font-mono">
            {logs.slice(-10).map((log, i) => (
              <div
                key={i}
                className={`py-0.5 ${
                  log.level === 'error' ? 'text-red-600' :
                  log.level === 'warn' ? 'text-amber-600' :
                  log.level === 'success' ? 'text-green-600' :
                  'text-slate-600'
                }`}
              >
                [{log.timestamp}] {log.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
