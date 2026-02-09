// tools/config-editor/client/src/pages/PermissionsConfig.tsx
// 권한 현황 읽기 전용 대시보드

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// API 응답 타입
interface PluginPermissions {
  plugin: string;
  enabled: boolean;
  permissions: string[];
  features: Array<{ name: string; required: boolean }>;
}

interface ExpoPluginAndroid {
  plugin: string;
  permissions: string[];
}

interface ExpoPluginIos {
  plugin: string;
  permissions: Record<string, string>;
}

interface IosMissing {
  key: string;
  reason: string;
  defaultValue: string;
  sourcePlugin: string;
}

interface PermissionsData {
  android: {
    fromPlugins: PluginPermissions[];
    fromExpoPlugins: ExpoPluginAndroid[];
    fromAppJson: string[];
  };
  ios: {
    fromInfoPlist: Record<string, string>;
    fromExpoPlugins: ExpoPluginIos[];
    missing: IosMissing[];
  };
}

// 퍼미션 이름에서 짧은 이름 추출
function shortPermission(perm: string): string {
  return perm.replace('android.permission.', '');
}

function shortFeature(name: string): string {
  return name.replace('android.hardware.', 'hardware.');
}

export default function PermissionsConfigPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<PermissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/permissions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 rounded-xl border border-red-200">
        <p className="text-red-700 font-medium">{t('common.error')}</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={fetchPermissions}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
        >
          {t('permissions.retry')}
        </button>
      </div>
    );
  }

  // app.json android.permissions와 Expo 플러그인/rnww 플러그인 간 중복 검사
  const allAutoPermissions = new Set<string>();
  for (const p of data.android.fromPlugins) {
    if (p.enabled) {
      for (const perm of p.permissions) {
        allAutoPermissions.add(shortPermission(perm));
      }
    }
  }
  for (const p of data.android.fromExpoPlugins) {
    for (const perm of p.permissions) {
      allAutoPermissions.add(shortPermission(perm));
    }
  }
  const duplicateAppJsonPerms = data.android.fromAppJson.filter(p => allAutoPermissions.has(p));

  // iOS: infoPlist과 Expo 플러그인 간 중복 검사
  const expoIosKeys = new Set<string>();
  for (const ep of data.ios.fromExpoPlugins) {
    for (const k of Object.keys(ep.permissions)) {
      expoIosKeys.add(k);
    }
  }
  const duplicateIosKeys = Object.keys(data.ios.fromInfoPlist).filter(k => expoIosKeys.has(k));

  return (
    <div className="space-y-6">
      {/* Android 권한 */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-green-100 rounded flex items-center justify-center text-xs">A</span>
          {t('permissions.androidTitle')}
        </h2>

        {/* 플러그인 자동 주입 */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-slate-600 mb-2">{t('permissions.pluginInjection')}</h3>
          {data.android.fromPlugins.length === 0 ? (
            <p className="text-sm text-slate-400 italic">{t('permissions.noPlugins')}</p>
          ) : (
            <div className="space-y-2">
              {data.android.fromPlugins.map(plugin => (
                <div
                  key={plugin.plugin}
                  className={`p-3 rounded-lg border ${
                    plugin.enabled
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-100 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                      plugin.enabled
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {plugin.enabled ? t('plugins.active') : t('plugins.inactive')}
                    </span>
                    <span className="font-mono text-sm text-slate-800">{plugin.plugin}</span>
                  </div>
                  {plugin.enabled ? (
                    <div className="ml-1 space-y-0.5">
                      {plugin.permissions.map(perm => (
                        <div key={perm} className="flex items-center gap-1.5 text-sm text-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          {shortPermission(perm)}
                        </div>
                      ))}
                      {plugin.features.map(feat => (
                        <div key={feat.name} className="flex items-center gap-1.5 text-sm text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          {shortFeature(feat.name)}
                          <span className="text-xs text-slate-400">
                            ({feat.required ? t('permissions.required') : t('permissions.optional')})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 ml-1">{t('permissions.inactiveHint')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expo 플러그인 자동 주입 */}
        {data.android.fromExpoPlugins.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-slate-600 mb-2">{t('permissions.expoPluginInjection')}</h3>
            <div className="space-y-2">
              {data.android.fromExpoPlugins.map(ep => (
                <div key={ep.plugin} className="p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="font-mono text-sm text-slate-800 mb-1">{ep.plugin}</div>
                  <div className="ml-1 space-y-0.5">
                    {ep.permissions.map(perm => (
                      <div key={perm} className="flex items-center gap-1.5 text-sm text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        {shortPermission(perm)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* app.json 수동 선언 */}
        <div className="mb-2">
          <h3 className="text-sm font-medium text-slate-600 mb-2">{t('permissions.appJsonManual')}</h3>
          {data.android.fromAppJson.length === 0 ? (
            <p className="text-sm text-slate-400 italic">{t('permissions.noManualPerms')}</p>
          ) : (
            <div className="p-3 rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap gap-1.5">
                {data.android.fromAppJson.map(perm => (
                  <span
                    key={perm}
                    className="px-2 py-0.5 text-sm bg-slate-100 text-slate-700 rounded font-mono"
                  >
                    {perm}
                  </span>
                ))}
              </div>
              {duplicateAppJsonPerms.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
                  <span className="mt-0.5">ℹ️</span>
                  <span>
                    {t('permissions.duplicateWithAuto', {
                      perms: duplicateAppJsonPerms.join(', ')
                    })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 구분선 */}
      <hr className="border-slate-200" />

      {/* iOS 권한 */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center text-xs">i</span>
          {t('permissions.iosTitle')}
        </h2>

        {/* 현재 설정된 권한 */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-slate-600 mb-2">{t('permissions.currentIosPerms')}</h3>
          {Object.keys(data.ios.fromInfoPlist).length === 0 ? (
            <p className="text-sm text-slate-400 italic">{t('permissions.noInfoPlist')}</p>
          ) : (
            <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1.5">
              {Object.entries(data.ios.fromInfoPlist).map(([key, value]) => (
                <div key={key} className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="font-mono text-sm text-slate-800">{key}</span>
                    <p className="text-xs text-slate-500 truncate">{value}</p>
                  </div>
                </div>
              ))}
              {duplicateIosKeys.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
                  <span className="mt-0.5">ℹ️</span>
                  <span>{t('permissions.duplicateIosWithExpo')}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expo 플러그인 자동 주입 */}
        {data.ios.fromExpoPlugins.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-slate-600 mb-2">{t('permissions.expoPluginInjection')}</h3>
            <div className="space-y-2">
              {data.ios.fromExpoPlugins.map(ep => (
                <div key={ep.plugin} className="p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="font-mono text-sm text-slate-800 mb-1">{ep.plugin}</div>
                  <div className="ml-1 space-y-0.5">
                    {Object.entries(ep.permissions).map(([key]) => (
                      <div key={key}>
                        <span className="font-mono text-xs text-slate-600">{key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 누락된 iOS 권한 */}
        {data.ios.missing.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
              <span>⚠</span>
              {t('permissions.missingIosTitle')}
            </h3>
            <div className="space-y-2">
              {data.ios.missing.map(m => (
                <div
                  key={m.key}
                  className="p-3 rounded-lg border border-amber-200 bg-amber-50"
                >
                  <div className="font-mono text-sm text-amber-800 font-medium">{m.key}</div>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {t('permissions.neededBy')}: {m.reason}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('permissions.defaultValue')}: <span className="font-mono">{m.defaultValue}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 새로고침 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={fetchPermissions}
          className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
        >
          {t('permissions.refresh')}
        </button>
      </div>
    </div>
  );
}
