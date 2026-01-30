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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">✓</span>;
      case 'error': return <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">✗</span>;
      case 'warning': return <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs">!</span>;
      case 'info': return <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs">○</span>;
      default: return null;
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
    <div className="space-y-6">
      {/* Environment Check */}
      <div className="border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔍</span>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">{t('build.envCheck')}</h3>
              <p className="text-sm text-slate-500">Verify build prerequisites</p>
            </div>
          </div>
          <button
            onClick={checkEnvironment}
            disabled={envChecking || building}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              envChecking || building
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {envChecking ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Checking...
              </span>
            ) : t('build.checkEnv')}
          </button>
        </div>

        {envChecks.length > 0 && (
          <div className="space-y-2 bg-slate-50 rounded-xl p-4">
            {envChecks.map((check, index) => (
              <div key={index} className="flex items-start gap-3 py-2">
                {getStatusIcon(check.status)}
                <div className="flex-1">
                  <span className="font-medium text-slate-700">{check.name}:</span>{' '}
                  <span className={check.status === 'error' ? 'text-red-600' : 'text-slate-600'}>{check.message}</span>
                  {check.detail && (
                    <div className="text-slate-400 text-xs mt-0.5">{check.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Build Options */}
      <div className="grid grid-cols-2 gap-6">
        {/* Cloud Build */}
        <div className="border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">☁️</span>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">{t('build.cloudBuild')}</h3>
              <p className="text-sm text-slate-500">{t('build.cloudBuildDesc')}</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { profile: 'development', icon: '🛠️', name: 'Development', desc: t('build.devBuildDesc') },
              { profile: 'preview', icon: '👁️', name: 'Preview', desc: t('build.previewBuildDesc') },
              { profile: 'production', icon: '🚀', name: 'Production', desc: t('build.prodBuildDesc') }
            ].map(item => (
              <button
                key={item.profile}
                onClick={() => startBuild('cloud', item.profile)}
                disabled={building}
                className="w-full p-4 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-indigo-200
                  disabled:opacity-50 disabled:cursor-not-allowed text-left transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <span className="font-semibold text-slate-700 group-hover:text-indigo-600">{item.name}</span>
                    <span className="text-sm text-slate-500 block">{item.desc}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Local Build */}
        <div className="border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">💻</span>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">{t('build.localBuild')}</h3>
              <p className="text-sm text-slate-500">{t('build.localBuildDesc')}</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { profile: 'debug', icon: '🐛', name: 'Debug APK', desc: t('build.debugApkDesc') },
              { profile: 'release-apk', icon: '📦', name: 'Release APK', desc: t('build.releaseApkDesc') },
              { profile: 'release-aab', icon: '🎁', name: 'Release AAB', desc: t('build.releaseAabDesc') }
            ].map(item => (
              <button
                key={item.profile}
                onClick={() => startBuild('local', item.profile)}
                disabled={building}
                className="w-full p-4 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-purple-200
                  disabled:opacity-50 disabled:cursor-not-allowed text-left transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <span className="font-semibold text-slate-700 group-hover:text-purple-600">{item.name}</span>
                    <span className="text-sm text-slate-500 block">{item.desc}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Utilities */}
      <div className="border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🧹</span>
          <h3 className="text-lg font-semibold text-slate-800">{t('build.utilities')}</h3>
        </div>
        <div className="flex gap-3">
          <button
            onClick={cleanCache}
            disabled={building}
            className="px-5 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50
              disabled:opacity-50 disabled:cursor-not-allowed font-medium text-slate-700 transition-colors"
          >
            🗑️ {t('build.cleanCache')}
          </button>
          {building && (
            <button
              onClick={cancelBuild}
              className="px-5 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors"
            >
              ⏹️ {t('build.cancel')}
            </button>
          )}
        </div>
      </div>

      {/* Build Output */}
      {buildOutput.length > 0 && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-lg">📟</span>
              <h3 className="text-white font-semibold">{t('build.output')}</h3>
              {building && (
                <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full animate-pulse">
                  Running
                </span>
              )}
            </div>
            <button
              onClick={() => setBuildOutput([])}
              className="text-slate-400 hover:text-white text-sm px-3 py-1 rounded hover:bg-white/10 transition-colors"
            >
              {t('common.reset')}
            </button>
          </div>
          <div
            ref={outputRef}
            className="bg-slate-900 p-5 font-mono text-sm h-72 overflow-y-auto"
          >
            {buildOutput.map((line, index) => (
              <div key={index} className={`${getOutputClass(line.type)} leading-relaxed`}>
                {line.text}
              </div>
            ))}
            {building && (
              <div className="text-indigo-400 animate-pulse mt-2">▌</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
