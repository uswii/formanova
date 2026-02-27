/**
 * Frontend API client for the Formanova Text-to-CAD pipeline.
 * Calls the production API directly with JWT Bearer auth (no proxy needed).
 */

import { getStoredToken } from '@/lib/auth-api';

const FORMANOVA_API = 'https://formanova.ai/api';
const AZURE_BLOB_HOST = 'https://snapwear.blob.core.windows.net';

const MODEL_MAP: Record<string, string> = {
  gemini: 'gemini',
  'claude-sonnet': 'claude-sonnet',
  'claude-opus': 'claude-opus',
};

// ── Types ──

export interface RunResponse {
  workflow_id: string;
  status_url: string;
  result_url: string;
  projected_cost?: number;
  [key: string]: unknown;
}

export interface StatusResponse {
  status: string;
  progress?: number;
  current_step?: string;
  steps_completed?: number;
  steps_total?: number;
  glb_url?: string | null;
  azure_source?: string | null;
  results?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ResultResponse {
  glb_url: string | null;
  azure_source?: string | null;
  [key: string]: unknown;
}

// ── Helpers ──

function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated — please sign in first');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

function azureUriToPublicUrl(azureUri: string): string | null {
  if (!azureUri.startsWith('azure://')) return null;
  const path = azureUri.replace('azure://', '');
  if (!path.includes('/')) return null;
  return `${AZURE_BLOB_HOST}/${path}`;
}

function extractGlbUri(results: Record<string, unknown>, nodeKey: string): string | null {
  const node = results[nodeKey];
  if (!node) return null;
  const arr = Array.isArray(node) ? node : [node];
  for (const entry of arr) {
    const rec = entry as Record<string, unknown> | null;
    if (!rec) continue;
    const glbPath = rec.glb_path as Record<string, unknown> | undefined;
    if (glbPath && typeof glbPath.uri === 'string' && glbPath.uri.startsWith('azure://')) {
      return glbPath.uri;
    }
  }
  return null;
}

function findAzureUri(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const val of Object.values(obj as Record<string, unknown>)) {
    if (typeof val === 'string' && val.startsWith('azure://')) return val;
    if (val && typeof val === 'object') {
      const found = findAzureUri(val);
      if (found) return found;
    }
  }
  return null;
}

/** Resolve GLB URL from results object */
function resolveGlbFromResults(results: Record<string, unknown>): { glb_url: string | null; azure_source: string | null } {
  const validateUri = extractGlbUri(results, 'ring-validate');
  const generateUri = extractGlbUri(results, 'ring-generate');
  const azureUri = validateUri || generateUri;
  const source = validateUri ? 'ring-validate' : generateUri ? 'ring-generate' : null;

  let glbUrl = azureUri ? azureUriToPublicUrl(azureUri) : null;
  if (!glbUrl) {
    const fallbackUri = findAzureUri(results);
    if (fallbackUri) glbUrl = azureUriToPublicUrl(fallbackUri);
  }

  return { glb_url: glbUrl, azure_source: source };
}

// ── API calls ──

export async function startRingPipeline(prompt: string, model: string): Promise<RunResponse> {
  const llmName = MODEL_MAP[model] || 'gemini';

  const res = await fetch(`${FORMANOVA_API}/run/ring_full_pipeline`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      payload: { prompt, llm_name: llmName, max_retries: 3 },
      return_nodes: ['ring-generate', 'ring-validate'],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || `Pipeline start failed (${res.status})`);
  }

  return res.json();
}

export async function pollStatus(statusUrl: string): Promise<StatusResponse> {
  const fullUrl = statusUrl.startsWith('http')
    ? statusUrl
    : `${FORMANOVA_API}${statusUrl.startsWith('/') ? '' : '/'}${statusUrl}`;

  const res = await fetch(fullUrl, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Status poll failed (${res.status})`);
  }

  const data: StatusResponse = await res.json();

  // Normalize progress object → numeric percentage
  const progressObj = data.progress as unknown;
  if (progressObj && typeof progressObj === 'object') {
    const p = progressObj as Record<string, unknown>;
    const completed = Number(p.completed_nodes ?? 0);
    const total = Number(p.total_nodes ?? 1);
    const state = String(p.state || 'running').toLowerCase();

    data.status = state;
    data.steps_completed = completed;
    data.steps_total = total;
    data.progress = state === 'completed' || state === 'done'
      ? 100
      : total > 0 ? Math.round((completed / total) * 100) : 0;
  } else if (typeof data.progress !== 'number') {
    const s = (data.status || '').toLowerCase();
    data.progress = (s === 'completed' || s === 'done') ? 100 : 0;
  }

  // Resolve GLB URL from inline results if completed
  if ((data.progress as number) >= 100 && data.results) {
    const { glb_url, azure_source } = resolveGlbFromResults(data.results);
    if (glb_url) {
      data.glb_url = glb_url;
      data.azure_source = azure_source;
    }
  }

  return data;
}

export async function fetchResult(resultUrl: string): Promise<ResultResponse> {
  const fullUrl = resultUrl.startsWith('http')
    ? resultUrl
    : `${FORMANOVA_API}${resultUrl.startsWith('/') ? '' : '/'}${resultUrl}`;

  const res = await fetch(fullUrl, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Result fetch failed (${res.status})`);
  }

  const data = await res.json();

  // Resolve GLB URL
  const { glb_url, azure_source } = resolveGlbFromResults(data);
  return { ...data, glb_url, azure_source };
}

/**
 * Calculate progress percentage from status response.
 */
export function calcProgress(status: StatusResponse): number {
  if (typeof status.progress === 'number') return Math.min(status.progress, 100);
  if (status.steps_completed != null && status.steps_total != null && status.steps_total > 0) {
    return Math.round((status.steps_completed / status.steps_total) * 100);
  }
  const s = (status.status || '').toLowerCase();
  if (s === 'completed' || s === 'done') return 100;
  if (s === 'running' || s === 'in_progress') return 50;
  return 0;
}
