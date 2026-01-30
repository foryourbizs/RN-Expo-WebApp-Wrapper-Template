// tools/config-editor/client/src/components/preview/BridgeConsole.tsx
import { useState, useEffect, useRef, useCallback } from 'react';

// Bridge 메시지 타입
interface BridgeMessage {
  protocol: string;
  payload: Record<string, unknown>;
  requestId?: string;
  timestamp: number;
}

interface PreviewBridgeEvent {
  type: 'PREVIEW_BRIDGE_MESSAGE';
  data: BridgeMessage;
}

interface BridgeLog {
  id: number;
  timestamp: Date;
  direction: 'outgoing' | 'incoming';
  action: string;
  payload: Record<string, unknown>;
  requestId?: string;
}

interface BridgeConsoleProps {
  onSendResponse?: (requestId: string, response: unknown) => void;
}

export default function BridgeConsole({ onSendResponse }: BridgeConsoleProps) {
  const [logs, setLogs] = useState<BridgeLog[]>([]);
  const [isExpanded, setIsExpanded] = useState(false); // 기본 접힘 상태
  const [selectedLog, setSelectedLog] = useState<BridgeLog | null>(null);
  const logIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Bridge 메시지 로깅
  const addLog = useCallback((log: Omit<BridgeLog, 'id' | 'timestamp'>) => {
    setLogs(prev => {
      const newLogs = [...prev, {
        ...log,
        id: ++logIdRef.current,
        timestamp: new Date()
      }];
      // 최대 50개 유지
      return newLogs.slice(-50);
    });
  }, []);

  // postMessage 리스너
  useEffect(() => {
    const handleMessage = (e: MessageEvent<PreviewBridgeEvent>) => {
      if (e.data?.type === 'PREVIEW_BRIDGE_MESSAGE') {
        const message = e.data.data;
        const action = message.protocol.replace('app://', '');

        addLog({
          direction: 'outgoing',
          action,
          payload: message.payload,
          requestId: message.requestId
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addLog]);

  // 스크롤 자동
  useEffect(() => {
    if (containerRef.current && isExpanded) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  // 로그 클리어
  const clearLogs = () => {
    setLogs([]);
    setSelectedLog(null);
  };

  // Mock 응답 전송
  const sendMockResponse = (log: BridgeLog) => {
    if (!log.requestId || !onSendResponse) return;

    // 기본 성공 응답
    const response = {
      success: true,
      data: { message: 'Mock response from preview' }
    };

    onSendResponse(log.requestId, response);

    addLog({
      direction: 'incoming',
      action: 'bridgeResponse',
      payload: { requestId: log.requestId, ...response },
      requestId: log.requestId
    });
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="absolute bottom-2 left-2 px-2 py-1 bg-slate-800 text-white text-xs rounded flex items-center gap-1 z-20"
      >
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        Bridge {logs.length > 0 && `(${logs.length})`}
      </button>
    );
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 text-white z-20 flex flex-col max-h-[40%]">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full" />
          <span className="text-xs font-medium">AppBridge Console</span>
          <span className="text-xs text-slate-400">({logs.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearLogs}
            className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white hover:bg-slate-700 rounded"
          >
            Clear
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-0.5 text-slate-400 hover:text-white"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 로그 목록 */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-1 space-y-0.5 text-[10px] font-mono">
        {logs.length === 0 ? (
          <div className="text-center text-slate-500 py-2">
            No bridge activity yet
          </div>
        ) : (
          logs.map(log => (
            <div
              key={log.id}
              onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
              className={`
                px-1.5 py-0.5 rounded cursor-pointer
                ${log.direction === 'outgoing' ? 'bg-blue-900/50' : 'bg-green-900/50'}
                ${selectedLog?.id === log.id ? 'ring-1 ring-white/30' : ''}
                hover:bg-white/10
              `}
            >
              <div className="flex items-center gap-1">
                <span className={log.direction === 'outgoing' ? 'text-blue-400' : 'text-green-400'}>
                  {log.direction === 'outgoing' ? '→' : '←'}
                </span>
                <span className="text-yellow-300">{log.action}</span>
                <span className="text-slate-500 ml-auto">
                  {log.timestamp.toLocaleTimeString()}
                </span>
              </div>

              {selectedLog?.id === log.id && (
                <div className="mt-1 p-1 bg-black/30 rounded text-[9px]">
                  <pre className="whitespace-pre-wrap break-all text-slate-300">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                  {log.requestId && log.direction === 'outgoing' && onSendResponse && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sendMockResponse(log);
                      }}
                      className="mt-1 px-2 py-0.5 bg-green-600 text-white rounded text-[9px] hover:bg-green-500"
                    >
                      Send Mock Response
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
