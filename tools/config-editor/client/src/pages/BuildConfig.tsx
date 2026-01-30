import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

interface BuildStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'done' | 'error';
  startTime?: number;
  endTime?: number;
}

// 빌드 단계 패턴 정의
const BUILD_STAGE_PATTERNS: { pattern: RegExp; stage: string; name: string }[] = [
  { pattern: /Starting.*build/i, stage: 'start', name: 'Starting' },
  { pattern: /Configure project|Configuring/i, stage: 'configure', name: 'Configuring' },
  { pattern: /compileDebugKotlin|compileReleaseKotlin|Compiling/i, stage: 'compile', name: 'Compiling' },
  { pattern: /mergeDebugResources|mergeReleaseResources|Processing resources/i, stage: 'resources', name: 'Resources' },
  { pattern: /bundleDebug|bundleRelease|Bundling/i, stage: 'bundle', name: 'Bundling' },
  { pattern: /packageDebug|packageRelease|Packaging/i, stage: 'package', name: 'Packaging' },
  { pattern: /assembleDebug|assembleRelease|Assembling/i, stage: 'assemble', name: 'Assembling' },
  { pattern: /BUILD SUCCESSFUL/i, stage: 'success', name: 'Complete' },
  { pattern: /BUILD FAILED/i, stage: 'failed', name: 'Failed' },
];

interface BuildEnvConfig {
  android?: {
    sdkPath?: string;
    javaHome?: string;
  };
  ios?: {
    xcodeSelectPath?: string;
  };
}

export default function BuildConfigPage() {
  const { t } = useTranslation();
  const [envChecks, setEnvChecks] = useState<EnvCheckResult[]>([]);
  const [envChecking, setEnvChecking] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildOutput, setBuildOutput] = useState<BuildOutput[]>([]);
  const [buildId, setBuildId] = useState<string | null>(null);
  const [buildStartTime, setBuildStartTime] = useState<number | null>(null);
  const [outputView, setOutputView] = useState<'summary' | 'log'>('summary');
  const outputRef = useRef<HTMLDivElement>(null);

  // 빌드 분석 데이터 계산
  const buildAnalysis = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const stages: BuildStage[] = [];
    let currentStage: string | null = null;
    let buildResult = 'pending' as 'pending' | 'success' | 'failed';
    let outputPath: string | null = null;

    const seenStages = new Set<string>();

    buildOutput.forEach((line) => {
      const text = line.text;

      // 에러/경고 수집
      if (line.type === 'error' || /error:/i.test(text)) {
        if (!errors.includes(text) && text.length > 10) {
          errors.push(text);
        }
      }
      if (/warning:/i.test(text)) {
        if (!warnings.includes(text) && text.length > 10) {
          warnings.push(text);
        }
      }

      // 출력 경로 감지 (Output: 메시지 또는 기타 패턴)
      const outputLineMatch = text.match(/^Output:\s*(.+\.(?:apk|aab))$/i);
      if (outputLineMatch) {
        outputPath = outputLineMatch[1];
      } else {
        const apkMatch = text.match(/(?:output|wrote|created)[:\s]+([^\s]+\.apk)/i);
        const aabMatch = text.match(/(?:output|wrote|created)[:\s]+([^\s]+\.aab)/i);
        if (apkMatch) outputPath = apkMatch[1];
        if (aabMatch) outputPath = aabMatch[1];
      }

      // 단계 감지
      for (const { pattern, stage, name } of BUILD_STAGE_PATTERNS) {
        if (pattern.test(text)) {
          if (stage === 'success') {
            buildResult = 'success';
          } else if (stage === 'failed') {
            buildResult = 'failed';
          } else if (!seenStages.has(stage)) {
            seenStages.add(stage);
            // 이전 단계 완료 처리
            if (currentStage) {
              const prevStage = stages.find(s => s.id === currentStage);
              if (prevStage) {
                prevStage.status = 'done';
                prevStage.endTime = line.timestamp;
              }
            }
            // 새 단계 추가
            stages.push({
              id: stage,
              name,
              status: 'running',
              startTime: line.timestamp,
            });
            currentStage = stage;
          }
          break;
        }
      }
    });

    // 마지막 단계 완료 처리
    if (currentStage && buildResult !== 'pending') {
      const lastStage = stages.find(s => s.id === currentStage);
      if (lastStage) {
        lastStage.status = buildResult === 'success' ? 'done' : 'error';
        lastStage.endTime = Date.now();
      }
    }

    return {
      errors,
      warnings,
      stages,
      buildResult,
      outputPath,
      totalLines: buildOutput.length,
    };
  }, [buildOutput]);

  // Environment config
  const [buildEnv, setBuildEnv] = useState<BuildEnvConfig>({});
  const [envSaving, setEnvSaving] = useState(false);
  const [envDirty, setEnvDirty] = useState(false);

  // Keystore
  const [keystoreStatus, setKeystoreStatus] = useState<{ exists: boolean; path?: string; hasSigningConfig: boolean } | null>(null);
  const [showKeystoreForm, setShowKeystoreForm] = useState(false);
  const [keystoreForm, setKeystoreForm] = useState({
    alias: 'my-key-alias',
    storePassword: '',
    keyPassword: '',
    cn: '',
    ou: '',
    o: '',
    l: '',
    st: '',
    c: 'US'
  });
  const [keystoreGenerating, setKeystoreGenerating] = useState(false);

  // Load build-env and keystore status on mount
  useEffect(() => {
    (async () => {
      try {
        const [envRes, ksRes] = await Promise.all([
          fetch('/api/config/build-env'),
          fetch('/api/build/keystore')
        ]);

        if (envRes.ok) {
          const data = await envRes.json();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { $schema, ...config } = data;
          setBuildEnv(config);
        }

        if (ksRes.ok) {
          setKeystoreStatus(await ksRes.json());
        }
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    })();
  }, []);

  const generateKeystore = useCallback(async () => {
    if (!keystoreForm.storePassword || keystoreForm.storePassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    setKeystoreGenerating(true);
    try {
      const dname = [
        `CN=${keystoreForm.cn || 'Unknown'}`,
        `OU=${keystoreForm.ou || 'Unknown'}`,
        `O=${keystoreForm.o || 'Unknown'}`,
        `L=${keystoreForm.l || 'Unknown'}`,
        `ST=${keystoreForm.st || 'Unknown'}`,
        `C=${keystoreForm.c || 'US'}`
      ].join(', ');

      const res = await fetch('/api/build/keystore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias: keystoreForm.alias,
          storePassword: keystoreForm.storePassword,
          keyPassword: keystoreForm.keyPassword || keystoreForm.storePassword,
          dname
        })
      });

      if (res.ok) {
        const data = await res.json();
        setKeystoreStatus({ exists: true, path: data.path, hasSigningConfig: true });
        setShowKeystoreForm(false);
        setKeystoreForm(prev => ({ ...prev, storePassword: '', keyPassword: '' }));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to generate keystore');
      }
    } catch (e) {
      console.error('Keystore generation failed:', e);
      alert('Failed to generate keystore');
    } finally {
      setKeystoreGenerating(false);
    }
  }, [keystoreForm]);

  const saveBuildEnv = useCallback(async () => {
    setEnvSaving(true);
    try {
      const res = await fetch('/api/config/build-env', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          $schema: './schemas/build-env.schema.json',
          ...buildEnv
        })
      });
      if (res.ok) {
        setEnvDirty(false);
      }
    } catch (e) {
      console.error('Failed to save build-env:', e);
    } finally {
      setEnvSaving(false);
    }
  }, [buildEnv]);

  const updateEnvConfig = useCallback((path: string, value: string) => {
    setBuildEnv(prev => {
      const parts = path.split('.');
      const newConfig = { ...prev };
      let current: any = newConfig;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current[parts[i]] = { ...current[parts[i]] };
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      return newConfig;
    });
    setEnvDirty(true);
  }, []);

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
    setBuildStartTime(Date.now());
    setOutputView('summary');
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
    setBuildStartTime(Date.now());
    setOutputView('summary');
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

  const deepClean = useCallback(async () => {
    if (!confirm(t('build.deepCleanConfirm'))) return;

    setBuilding(true);
    setBuildStartTime(Date.now());
    setOutputView('log');
    setBuildOutput([{ type: 'info', text: 'Starting deep clean...', timestamp: Date.now() }]);

    try {
      const res = await fetch('/api/build/deep-clean', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBuildId(data.buildId);
      }
    } catch (e) {
      setBuildOutput(prev => [...prev, {
        type: 'error',
        text: 'Failed to start deep clean',
        timestamp: Date.now()
      }]);
      setBuilding(false);
    }
  }, [t]);

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

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const getElapsedTime = () => {
    if (!buildStartTime) return '';
    return formatDuration(Date.now() - buildStartTime);
  };

  const downloadOutput = useCallback((filePath: string) => {
    const link = document.createElement('a');
    link.href = `/api/build/download?path=${encodeURIComponent(filePath)}`;
    link.download = filePath.split('/').pop() || 'output';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const openOutputFolder = useCallback(async (filePath: string) => {
    try {
      await fetch('/api/build/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
    } catch (e) {
      console.error('Failed to open folder:', e);
    }
  }, []);


  return (
    <div className="space-y-4">
      {/* Environment Settings */}
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium text-slate-800">{t('build.envSettings')}</h3>
          <button
            onClick={saveBuildEnv}
            disabled={!envDirty || envSaving}
            className="px-3 py-1 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {envSaving ? '...' : t('common.save')}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Android SDK Path</label>
            <input
              type="text"
              value={buildEnv.android?.sdkPath || ''}
              onChange={(e) => updateEnvConfig('android.sdkPath', e.target.value)}
              placeholder="E:\AndroidSDK"
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Java Home</label>
            <input
              type="text"
              value={buildEnv.android?.javaHome || ''}
              onChange={(e) => updateEnvConfig('android.javaHome', e.target.value)}
              placeholder="C:\Program Files\Java\jdk-17"
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded font-mono"
            />
          </div>
        </div>
        {envDirty && (
          <p className="text-xs text-orange-600 mt-2">{t('common.unsaved')}</p>
        )}
      </div>

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

      {/* Keystore */}
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium text-slate-800">{t('build.keystore')}</h3>
          {!showKeystoreForm && (
            <button
              onClick={() => setShowKeystoreForm(true)}
              className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50"
            >
              {keystoreStatus?.exists ? t('build.regenerate') : t('build.generate')}
            </button>
          )}
        </div>

        {keystoreStatus && !showKeystoreForm && (
          <div className="text-sm">
            {keystoreStatus.exists ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-slate-600">{t('build.keystoreExists')}</span>
                </div>
                {keystoreStatus.path && (
                  <div className="text-xs text-slate-400 font-mono">{keystoreStatus.path}</div>
                )}
                {keystoreStatus.hasSigningConfig && (
                  <div className="text-xs text-green-600">{t('build.signingConfigured')}</div>
                )}
              </div>
            ) : (
              <div className="text-slate-500">{t('build.noKeystore')}</div>
            )}
          </div>
        )}

        {showKeystoreForm && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('build.keystoreAlias')}</label>
                <input
                  type="text"
                  value={keystoreForm.alias}
                  onChange={(e) => setKeystoreForm(prev => ({ ...prev, alias: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('build.storePassword')}</label>
                <input
                  type="password"
                  value={keystoreForm.storePassword}
                  onChange={(e) => setKeystoreForm(prev => ({ ...prev, storePassword: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('build.keyPassword')}</label>
                <input
                  type="password"
                  value={keystoreForm.keyPassword}
                  onChange={(e) => setKeystoreForm(prev => ({ ...prev, keyPassword: e.target.value }))}
                  placeholder="Same as store password if empty"
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('build.country')} (C)</label>
                <input
                  type="text"
                  value={keystoreForm.c}
                  onChange={(e) => setKeystoreForm(prev => ({ ...prev, c: e.target.value }))}
                  maxLength={2}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('build.commonName')} (CN)</label>
                <input
                  type="text"
                  value={keystoreForm.cn}
                  onChange={(e) => setKeystoreForm(prev => ({ ...prev, cn: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('build.organization')} (O)</label>
                <input
                  type="text"
                  value={keystoreForm.o}
                  onChange={(e) => setKeystoreForm(prev => ({ ...prev, o: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('build.orgUnit')} (OU)</label>
                <input
                  type="text"
                  value={keystoreForm.ou}
                  onChange={(e) => setKeystoreForm(prev => ({ ...prev, ou: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('build.city')} (L)</label>
                <input
                  type="text"
                  value={keystoreForm.l}
                  onChange={(e) => setKeystoreForm(prev => ({ ...prev, l: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('build.state')} (ST)</label>
                <input
                  type="text"
                  value={keystoreForm.st}
                  onChange={(e) => setKeystoreForm(prev => ({ ...prev, st: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={generateKeystore}
                disabled={keystoreGenerating}
                className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50"
              >
                {keystoreGenerating ? '...' : t('build.generate')}
              </button>
              <button
                onClick={() => setShowKeystoreForm(false)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Utilities */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={cleanCache}
          disabled={building}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('build.cleanCache')}
        </button>
        <button
          onClick={deepClean}
          disabled={building}
          className="px-3 py-1.5 text-sm border border-orange-300 text-orange-700 rounded hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('build.deepClean')}
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
          {/* Header */}
          <div className="bg-slate-800 px-3 py-2 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-sm text-white font-medium">{t('build.output')}</span>
              {building ? (
                <span className="flex items-center gap-1.5 text-xs text-green-400">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  {t('build.running')}
                </span>
              ) : buildAnalysis.buildResult === 'success' ? (
                <span className="text-xs text-green-400">{t('build.succeeded')}</span>
              ) : buildAnalysis.buildResult === 'failed' ? (
                <span className="text-xs text-red-400">{t('build.failed')}</span>
              ) : null}
              {buildStartTime && (
                <span className="text-xs text-slate-400">{getElapsedTime()}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Tab 전환 */}
              <div className="flex bg-slate-700 rounded overflow-hidden">
                <button
                  onClick={() => setOutputView('summary')}
                  className={`px-2 py-1 text-xs transition-colors ${
                    outputView === 'summary'
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t('build.summary')}
                </button>
                <button
                  onClick={() => setOutputView('log')}
                  className={`px-2 py-1 text-xs transition-colors ${
                    outputView === 'log'
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t('build.log')}
                </button>
              </div>
              <button
                onClick={() => {
                  setBuildOutput([]);
                  setBuildStartTime(null);
                }}
                className="text-xs text-slate-400 hover:text-white"
              >
                {t('common.reset')}
              </button>
            </div>
          </div>

          {/* Summary View */}
          {outputView === 'summary' && (
            <div className="bg-slate-900 p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Left: Stages */}
                <div>
                  <h4 className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                    {t('build.stages')}
                  </h4>
                  <div className="space-y-1.5">
                    {buildAnalysis.stages.length > 0 ? (
                      buildAnalysis.stages.map((stage) => (
                        <div key={stage.id} className="flex items-center gap-2">
                          {stage.status === 'running' ? (
                            <span className="w-4 h-4 flex items-center justify-center">
                              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                            </span>
                          ) : stage.status === 'done' ? (
                            <span className="w-4 h-4 flex items-center justify-center text-green-400 text-xs">✓</span>
                          ) : stage.status === 'error' ? (
                            <span className="w-4 h-4 flex items-center justify-center text-red-400 text-xs">✗</span>
                          ) : (
                            <span className="w-4 h-4 flex items-center justify-center text-slate-600 text-xs">○</span>
                          )}
                          <span className={`text-sm ${
                            stage.status === 'running' ? 'text-blue-400' :
                            stage.status === 'done' ? 'text-slate-300' :
                            stage.status === 'error' ? 'text-red-400' :
                            'text-slate-500'
                          }`}>
                            {stage.name}
                          </span>
                          {stage.startTime && stage.endTime && (
                            <span className="text-xs text-slate-500">
                              {formatDuration(stage.endTime - stage.startTime)}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">{t('build.waitingForStages')}</div>
                    )}
                  </div>
                </div>

                {/* Right: Stats */}
                <div className="space-y-3">
                  {/* Errors */}
                  <div>
                    <h4 className="text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide flex items-center gap-2">
                      {t('build.errors')}
                      {buildAnalysis.errors.length > 0 && (
                        <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-xs">
                          {buildAnalysis.errors.length}
                        </span>
                      )}
                    </h4>
                    {buildAnalysis.errors.length > 0 ? (
                      <div className="max-h-20 overflow-y-auto space-y-1">
                        {buildAnalysis.errors.slice(0, 5).map((err, i) => (
                          <div key={i} className="text-xs text-red-400 truncate" title={err}>
                            {err.slice(0, 80)}{err.length > 80 ? '...' : ''}
                          </div>
                        ))}
                        {buildAnalysis.errors.length > 5 && (
                          <div className="text-xs text-slate-500">
                            +{buildAnalysis.errors.length - 5} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">{t('build.noErrors')}</div>
                    )}
                  </div>

                  {/* Warnings */}
                  <div>
                    <h4 className="text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide flex items-center gap-2">
                      {t('build.warnings')}
                      {buildAnalysis.warnings.length > 0 && (
                        <span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded text-xs">
                          {buildAnalysis.warnings.length}
                        </span>
                      )}
                    </h4>
                    {buildAnalysis.warnings.length > 0 ? (
                      <div className="max-h-16 overflow-y-auto space-y-1">
                        {buildAnalysis.warnings.slice(0, 3).map((warn, i) => (
                          <div key={i} className="text-xs text-amber-400 truncate" title={warn}>
                            {warn.slice(0, 80)}{warn.length > 80 ? '...' : ''}
                          </div>
                        ))}
                        {buildAnalysis.warnings.length > 3 && (
                          <div className="text-xs text-slate-500">
                            +{buildAnalysis.warnings.length - 3} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">{t('build.noWarnings')}</div>
                    )}
                  </div>

                  {/* Output Path */}
                  {buildAnalysis.outputPath && (
                    <div>
                      <h4 className="text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                        {t('build.outputFile')}
                      </h4>
                      <div className="bg-slate-800 rounded p-2">
                        <div className="text-xs text-green-400 font-mono break-all mb-2">
                          {buildAnalysis.outputPath}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => downloadOutput(buildAnalysis.outputPath!)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            {t('build.download')}
                          </button>
                          <button
                            onClick={() => openOutputFolder(buildAnalysis.outputPath!)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                            </svg>
                            {t('build.openFolder')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {building && buildAnalysis.stages.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-700">
                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          (buildAnalysis.stages.filter(s => s.status === 'done').length / 7) * 100,
                          95
                        )}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Log View */}
          {outputView === 'log' && (
            <div
              ref={outputRef}
              className="bg-slate-900 p-3 font-mono text-xs h-64 overflow-y-auto"
            >
              {buildOutput.map((line, index) => (
                <div key={index} className={getOutputClass(line.type)}>
                  {line.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
