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

export function usePlugins() {
  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [scannedFolders, setScannedFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInstalled = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/plugins/installed');
      if (!res.ok) throw new Error('Failed to fetch');
      setInstalledPackages(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const searchPackages = async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/plugins/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to search');
      setSearchResults(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const scanFolders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/plugins/scan');
      if (!res.ok) throw new Error('Failed to scan');
      setScannedFolders(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const installPackage = async (name: string, version?: string) => {
    setLoading(true);
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
  };

  const uninstallPackage = async (name: string) => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  return {
    installedPackages,
    searchResults,
    scannedFolders,
    loading,
    error,
    fetchInstalled,
    searchPackages,
    scanFolders,
    installPackage,
    uninstallPackage
  };
}
