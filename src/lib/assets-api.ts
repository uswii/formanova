// src/lib/assets-api.ts
// Direct calls to FastAPI /assets — no proxy. authenticatedFetch handles Bearer token.

import { authenticatedFetch } from '@/lib/authenticated-fetch';

const API_BASE = import.meta.env.VITE_PIPELINE_API_URL ?? '';

export type AssetType = 'jewelry_photo' | 'model_photo';

export interface UserAsset {
  id: string;
  asset_type: AssetType;
  created_at: string;      // ISO string
  thumbnail_url: string;   // SAS URL with 1-hour expiry — use directly in <img src>
  name: string | null;
}

export interface AssetsPage {
  items: UserAsset[];
  total: number;
  page: number;
  page_size: number;
}

export async function fetchUserAssets(
  type: AssetType,
  page = 0,
  pageSize = 20,
): Promise<AssetsPage> {
  const url = `${API_BASE}/assets?asset_type=${type}&page=${page}&page_size=${pageSize}`;
  const response = await authenticatedFetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${type} assets: ${response.status}`);
  }
  return response.json();
}
