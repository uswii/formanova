// src/hooks/useUserAssets.ts
import { useState, useEffect, useCallback } from 'react';
import { fetchUserAssets, type AssetType, type UserAsset } from '@/lib/assets-api';

export interface UseUserAssetsResult {
  assets: UserAsset[];
  total: number;
  page: number;
  isLoading: boolean;
  error: string | null;
  goToPage: (page: number) => void;
  refresh: () => void;
}

export function useUserAssets(type: AssetType, pageSize = 20): UseUserAssetsResult {
  const [assets, setAssets] = useState<UserAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Note: concurrent tab switches are safe here because each tab mounts its own hook instance
  // (TabsContent unmounts on switch). If type ever changes without unmount, add an AbortController.
  const load = useCallback(async (pageNum: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUserAssets(type, pageNum, pageSize);
      setAssets(data.items);
      setTotal(data.total);
      setPage(pageNum);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assets');
    } finally {
      setIsLoading(false);
    }
  }, [type, pageSize]);

  useEffect(() => { load(0); }, [load]);

  return {
    assets,
    total,
    page,
    isLoading,
    error,
    goToPage: load,
    refresh: () => load(page),
  };
}
