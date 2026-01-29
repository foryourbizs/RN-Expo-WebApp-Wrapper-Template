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

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [buildOutput]);

  // Poll build output
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <span className="text-green-500">✓</span>;
      case 'error': return <span className="text-red-500">✗</span>;
      case 'warning': return <span className="text-yellow-500">⚠</span>;
      case 'info': return <span className="text-gray-400">○</span>;
      default: return null;
    }
  };

  const getOutputClass = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      case 'info': return 'text-blue-400';
      case 'stderr': return 'text-yellow-400';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Environment Check */}
      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">{t('build.envCheck')}</h3>
          <button
            onClick={checkEnvironment}
            disabled={envChecking || building}
            className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            {envChecking ? t('common.loading') : t('build.checkEnv')}
          </button>
        </div>

        {envChecks.length > 0 && (
          <div className="space-y-2">
            {envChecks.map((check, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5">{getStatusIcon(check.status)}</span>
                <div>
                  <span className="font-medium">{check.name}:</span>{' '}
                  <span className={check.status === 'error' ? 'text-red-600' : ''}>{check.message}</span>
                  {check.detail && (
                    <div className="text-gray-500 text-xs">{check.detail}</div>
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
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">{t('build.cloudBuild')}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('build.cloudBuildDesc')}</p>
          <div className="space-y-2">
            <button
              onClick={() => startBuild('cloud', 'development')}
              disabled={building}
              className="w-full px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 text-left"
            >
              <span className="font-medium">Development</span>
              <span className="text-sm text-gray-500 block">{t('build.devBuildDesc')}</span>
            </button>
            <button
              onClick={() => startBuild('cloud', 'preview')}
              disabled={building}
              className="w-full px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 text-left"
            >
              <span className="font-medium">Preview</span>
              <span className="text-sm text-gray-500 block">{t('build.previewBuildDesc')}</span>
            </button>
            <button
              onClick={() => startBuild('cloud', 'production')}
              disabled={building}
              className="w-full px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 text-left"
            >
              <span className="font-medium">Production</span>
              <span className="text-sm text-gray-500 block">{t('build.prodBuildDesc')}</span>
            </button>
          </div>
        </div>

        {/* Local Build */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">{t('build.localBuild')}</h3>
          <p className="text-sm text-gray-500 mb-4">{t('build.localBuildDesc')}</p>
          <div className="space-y-2">
            <button
              onClick={() => startBuild('local', 'debug')}
              disabled={building}
              className="w-full px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 text-left"
            >
              <span className="font-medium">Debug APK</span>
              <span className="text-sm text-gray-500 block">{t('build.debugApkDesc')}</span>
            </button>
            <button
              onClick={() => startBuild('local', 'release-apk')}
              disabled={building}
              className="w-full px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 text-left"
            >
              <span className="font-medium">Release APK</span>
              <span className="text-sm text-gray-500 block">{t('build.releaseApkDesc')}</span>
            </button>
            <button
              onClick={() => startBuild('local', 'release-aab')}
              disabled={building}
              className="w-full px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 text-left"
            >
              <span className="font-medium">Release AAB</span>
              <span className="text-sm text-gray-500 block">{t('build.releaseAabDesc')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Utilities */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-medium mb-4">{t('build.utilities')}</h3>
        <div className="flex gap-2">
          <button
            onClick={cleanCache}
            disabled={building}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {t('build.cleanCache')}
          </button>
          {building && (
            <button
              onClick={cancelBuild}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
            >
              {t('build.cancel')}
            </button>
          )}
        </div>
      </div>

      {/* Build Output */}
      {buildOutput.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-800 px-4 py-2 flex justify-between items-center">
            <h3 className="text-white font-medium">{t('build.output')}</h3>
            <button
              onClick={() => setBuildOutput([])}
              className="text-gray-400 hover:text-white text-sm"
            >
              {t('common.reset')}
            </button>
          </div>
          <div
            ref={outputRef}
            className="bg-gray-900 p-4 font-mono text-sm h-64 overflow-y-auto"
          >
            {buildOutput.map((line, index) => (
              <div key={index} className={getOutputClass(line.type)}>
                {line.text}
              </div>
            ))}
            {building && (
              <div className="text-gray-500 animate-pulse">▌</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
