import { useState, useEffect, useCallback } from 'react';

type ConfigType = 'app' | 'theme' | 'plugins';

export function useConfig<T>(type: ConfigType) {
  const [data, setData] = useState<T | null>(null);
  const [originalData, setOriginalData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/config/${type}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
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

  const saveConfig = async (newData: T) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/config/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      });
      if (!res.ok) throw new Error('Failed to save');
      setOriginalData(newData);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    setData(originalData);
  };

  const hasChanges = JSON.stringify(data) !== JSON.stringify(originalData);

  return {
    data,
    setData,
    loading,
    error,
    saving,
    saveConfig,
    revert,
    hasChanges,
    refresh: fetchConfig
  };
}
