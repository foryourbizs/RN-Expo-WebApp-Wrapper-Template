// tools/config-editor/client/src/contexts/ConfigContext.tsx
import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { AppConfig, ThemeConfig, PluginsConfig, ExpoConfig } from '../types/config';

interface ConfigState<T> {
  data: T | null;
  originalData: T | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
}

interface ConfigActions<T> {
  setData: (valueOrUpdater: T | null | ((prev: T | null) => T | null)) => void;
  save: (data: T) => Promise<boolean>;
  revert: () => void;
  hasChanges: boolean;
}

interface ConfigContextValue {
  app: ConfigState<AppConfig> & ConfigActions<AppConfig>;
  theme: ConfigState<ThemeConfig> & ConfigActions<ThemeConfig>;
  plugins: ConfigState<PluginsConfig> & ConfigActions<PluginsConfig>;
  expo: ConfigState<ExpoConfig> & ConfigActions<ExpoConfig>;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

type SetDataArg<T> = T | null | ((prev: T | null) => T | null);

function useConfigState<T>(type: 'app' | 'theme' | 'plugins' | 'expo') {
  const [data, setDataInternal] = useState<T | null>(null);
  const [originalData, setOriginalData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // setData가 함수 updater도 지원하도록
  const setData = useCallback((valueOrUpdater: SetDataArg<T>) => {
    if (typeof valueOrUpdater === 'function') {
      setDataInternal(valueOrUpdater as (prev: T | null) => T | null);
    } else {
      setDataInternal(valueOrUpdater);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/config/${type}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setDataInternal(json);
      setOriginalData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const save = useCallback(async (newData: T) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/config/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      });
      if (!res.ok) throw new Error('Failed to save');
      // 저장 성공 시 data와 originalData 모두 업데이트
      setDataInternal(newData);
      setOriginalData(newData);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return false;
    } finally {
      setSaving(false);
    }
  }, [type]);

  const revert = useCallback(() => {
    setDataInternal(originalData);
  }, [originalData]);

  const hasChanges = useMemo(
    () => JSON.stringify(data) !== JSON.stringify(originalData),
    [data, originalData]
  );

  return {
    data,
    originalData,
    loading,
    error,
    saving,
    setData,
    save,
    revert,
    hasChanges
  };
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const app = useConfigState<AppConfig>('app');
  const theme = useConfigState<ThemeConfig>('theme');
  const plugins = useConfigState<PluginsConfig>('plugins');
  const expo = useConfigState<ExpoConfig>('expo');

  const value = useMemo(() => ({ app, theme, plugins, expo }), [app, theme, plugins, expo]);

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useAppConfig() {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useAppConfig must be used within ConfigProvider');
  return context.app;
}

export function useThemeConfig() {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useThemeConfig must be used within ConfigProvider');
  return context.theme;
}

export function usePluginsConfig() {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('usePluginsConfig must be used within ConfigProvider');
  return context.plugins;
}

export function useExpoConfig() {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useExpoConfig must be used within ConfigProvider');
  return context.expo;
}
