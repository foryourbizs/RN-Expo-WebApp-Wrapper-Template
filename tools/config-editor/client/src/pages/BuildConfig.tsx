import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface EnvCheckResult {
  name: string;
  status: 'ok' | 'error' | 'warning' | 'info';
  message: string;
  detail?: string;
}

interface BuildOutput {
  type: 'stdout' | 'stderr' | 'info' | 'error' | 'success';
  text: string;
  timestamp: number;
}

export default function BuildConfigPage() {
  const { t } = useTranslation();
  const [envChecks, setEnvChecks] = useState<EnvCheckResult[]>([]);
  const [envChecking, setEnvChecking] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildOutput, setBuildOutput] = useState<BuildOutput[]>([]);
  const [buildId, setBuildId] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [buildOutput]);

  useEffect(() => {
    if (!buildId || !building) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/build/output/${buildId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.lines && data.lines.length > 0) {
            setBuildOutput(prev => [...prev, ...data.lines]);
          }
          if (data.finished) {
            setBuilding(false);
            setBuildId(null);
          }
        }
      } catch (e) {
        console.error('Failed to fetch build output:', e);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [buildId, building]);

  const checkEnvironment = useCallback(async () => {
    setEnvChecking(true);
    setEnvChecks([]);
    try {
      const res = await fetch('/api/build/env-check');
      if (res.ok) {
        const data = await res.json();
        setEnvChecks(data.checks || []);
      }
    } catch (e) {
      console.error('Environment check failed:', e);
    } finally {
      setEnvChecking(false);
    }
  }, []);

  const startBuild = useCallback(async (type: string, profile?: string) => {
    setBuilding(true);
    setBuildOutput([{ type: 'info', text: `Starting ${type} build...`, timestamp: Date.now() }]);

    try {
      const res = await fetch('/api/build/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, profile })
      });

      if (res.ok) {
        const data = await res.json();
        setBuildId(data.buildId);
      } else {
        const error = await res.json();
        setBuildOutput(prev => [...prev, {
          type: 'error',
          text: error.error || 'Build failed to start',
          timestamp: Date.now()
        }]);
        setBuilding(false);
      }
    } catch (e) {
      setBuildOutput(prev => [...prev, {
        type: 'error',
        text: 'Failed to start build',
        timestamp: Date.now()
      }]);
      setBuilding(false);
    }
  }, []);

  const cleanCache = useCallback(async () => {
    setBuilding(true);
    setBuildOutput([{ type: 'info', text: 'Cleaning Gradle cache...', timestamp: Date.now() }]);

    try {
      const res = await fetch('/api/build/clean', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBuildId(data.buildId);
      }
    } catch (e) {
      setBuildOutput(prev => [...prev, {
        type: 'error',
        text: 'Failed to clean cache',
        timestamp: Date.now()
      }]);
      setBuilding(false);
    }
  }, []);

  const cancelBuild = useCallback(async () => {
    if (buildId) {
      try {
        await fetch(`/api/build/cancel/${buildId}`, { method: 'POST' });
        setBuildOutput(prev => [...prev, {
          type: 'info',
          text: 'Build cancelled',
          timestamp: Date.now()
        }]);
      } catch (e) {
        console.error('Failed to cancel build:', e);
      }
    }
    setBuilding(false);
    setBuildId(null);
  }, [buildId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-amber-600';
      default: return 'text-slate-500';
    }
  };

  const getOutputClass = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      case 'info': return 'text-blue-400';
      case 'stderr': return 'text-yellow-400';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* Environment Check */}
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium text-slate-800">{t('build.envCheck')}</h3>
          <button
            onClick={checkEnvironment}
            disabled={envChecking || building}
            className="px-3 py-1.5 text-sm rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {envChecking ? 'Checking...' : t('build.checkEnv')}
          </button>
        </div>

        {envChecks.length > 0 && (
          <div className="space-y-1 text-sm">
            {envChecks.map((check, index) => (
              <div key={index} className="flex items-start gap-2 py-1">
                <span className={`font-medium ${getStatusColor(check.status)}`}>
                  {check.status === 'ok' ? '✓' : check.status === 'error' ? '✗' : '!'}
                </span>
                <div>
                  <span className="font-medium text-slate-700">{check.name}:</span>{' '}
                  <span className={check.status === 'error' ? 'text-red-600' : 'text-slate-600'}>{check.message}</span>
                  {check.detail && (
                    <div className="text-slate-400 text-xs">{check.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Build Options */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cloud Build */}
        <div className="border border-slate-200 rounded-lg p-4 bg-white">
          <h3 className="font-medium text-slate-800 mb-3">{t('build.cloudBuild')}</h3>
          <div className="space-y-2">
            {[
              { profile: 'development', name: 'Development' },
              { profile: 'preview', name: 'Preview' },
              { profile: 'production', name: 'Production' }
            ].map(item => (
              <button
                key={item.profile}
                onClick={() => startBuild('cloud', item.profile)}
                disabled={building}
                className="w-full px-3 py-2 text-sm text-left border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* Local Build */}
        <div className="border border-slate-200 rounded-lg p-4 bg-white">
          <h3 className="font-medium text-slate-800 mb-3">{t('build.localBuild')}</h3>
          <div className="space-y-2">
            {[
              { profile: 'debug', name: 'Debug APK' },
              { profile: 'release-apk', name: 'Release APK' },
              { profile: 'release-aab', name: 'Release AAB' }
            ].map(item => (
              <button
                key={item.profile}
                onClick={() => startBuild('local', item.profile)}
                disabled={building}
                className="w-full px-3 py-2 text-sm text-left border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Utilities */}
      <div className="flex gap-2">
        <button
          onClick={cleanCache}
          disabled={building}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('build.cleanCache')}
        </button>
        {building && (
          <button
            onClick={cancelBuild}
            className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            {t('build.cancel')}
          </button>
        )}
      </div>

      {/* Build Output */}
      {buildOutput.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-800 px-3 py-2 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white font-medium">{t('build.output')}</span>
              {building && (
                <span className="text-xs text-green-400">Running</span>
              )}
            </div>
            <button
              onClick={() => setBuildOutput([])}
              className="text-xs text-slate-400 hover:text-white"
            >
              {t('common.reset')}
            </button>
          </div>
          <div
            ref={outputRef}
            className="bg-slate-900 p-3 font-mono text-xs h-48 overflow-y-auto"
          >
            {buildOutput.map((line, index) => (
              <div key={index} className={getOutputClass(line.type)}>
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
