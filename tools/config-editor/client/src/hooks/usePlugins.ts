import { useState, useCallback } from 'react';

interface InstalledPackage {
  name: string;
  version: string;
}

interface SearchResult {
  name: string;
  version: string;
  description?: string;
}

/** 플러그인 옵션 메타데이터 */
interface PluginOptionMeta {
  type: 'boolean' | 'string' | 'number';
  default?: boolean | string | number;
  label: { ko: string; en: string } | string;
  description?: { ko: string; en: string } | string;
}

/** 플러그인 메타데이터 */
export interface PluginMeta {
  name: string;
  version?: string;
  supportedOptions?: {
    [category: string]: {
      [optionKey: string]: PluginOptionMeta;
    };
  };
}

export function usePlugins() {
  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([]);
  const [installedLoaded, setInstalledLoaded] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [scannedFolders, setScannedFolders] = useState<string[]>([]);
  const [pluginMetadata, setPluginMetadata] = useState<Record<string, PluginMeta | null>>({});
  const [metadataLoaded, setMetadataLoaded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInstalled = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plugins/installed');
      if (!res.ok) throw new Error('Failed to fetch');
      setInstalledPackages(await res.json());
      setInstalledLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setInstalledLoaded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchPackages = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/plugins/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to search');
      setSearchResults(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const scanFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plugins/scan');
      if (!res.ok) throw new Error('Failed to scan');
      setScannedFolders(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const installPackage = useCallback(async (name: string, version?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plugins/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, version })
      });
      if (!res.ok) throw new Error('Failed to install');
      await fetchInstalled();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchInstalled]);

  const uninstallPackage = useCallback(async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plugins/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('Failed to uninstall');
      await fetchInstalled();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchInstalled]);

  /** 설치된 플러그인의 메타데이터 조회 */
  const fetchMetadata = useCallback(async (packageNames?: string[]) => {
    setError(null);
    try {
      const url = packageNames?.length
        ? `/api/plugins/metadata?names=${packageNames.join(',')}`
        : '/api/plugins/metadata';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch metadata');
      const data = await res.json();
      setPluginMetadata(prev => ({ ...prev, ...data }));
      // 조회한 패키지들을 로드 완료로 표시
      if (packageNames?.length) {
        setMetadataLoaded(prev => {
          const next = new Set(prev);
          packageNames.forEach(name => next.add(name));
          return next;
        });
      }
      return data as Record<string, PluginMeta | null>;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      // 에러 시에도 로드 시도 완료로 표시
      if (packageNames?.length) {
        setMetadataLoaded(prev => {
          const next = new Set(prev);
          packageNames.forEach(name => next.add(name));
          return next;
        });
      }
      return {};
    }
  }, []);

  return {
    installedPackages,
    installedLoaded,
    searchResults,
    scannedFolders,
    pluginMetadata,
    metadataLoaded,
    loading,
    error,
    fetchInstalled,
    searchPackages,
    scanFolders,
    installPackage,
    uninstallPackage,
    fetchMetadata
  };
}
