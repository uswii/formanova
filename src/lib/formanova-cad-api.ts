/**
 * Frontend API client for the Formanova Text-to-CAD pipeline.
 * Calls the production API directly with JWT Bearer auth.
 * Uses authenticatedFetch for centralized 401 handling.
 */

import { authenticatedFetch } from '@/lib/authenticated-fetch';

const FORMANOVA_API = '/api';
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

function azureUriToPublicUrl(azureUri: string): string | null {
  if (!azureUri.startsWith('azure://')) return null;
  const path = azureUri.replace('azure://', '');
  if (!path.includes('/')) return null;
  return `${AZURE_BLOB_HOST}/${path}`;
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

/** Extract GLB artifact URI from a result node, checking glb_artifact then original_glb_artifact */
function extractArtifactUri(results: Record<string, unknown>, nodeKey: string, artifactKey: string = 'glb_artifact'): string | null {
  const node = results[nodeKey];
  if (!node) return null;
  const arr = Array.isArray(node) ? node : [node];
  for (const entry of arr) {
    const rec = entry as Record<string, unknown> | null;
    if (!rec) continue;
    const artifact = rec[artifactKey] as Record<string, unknown> | undefined;
    if (artifact && typeof artifact.uri === 'string') return artifact.uri;
  }
  return null;
}

/** Resolve GLB URL from results per spec:
 *  success_final → glb_artifact, fallback original_glb_artifact
 *  success_original_glb → original_glb_artifact
 *  failed_final → null
 */
function resolveGlbFromResults(results: Record<string, unknown>): { glb_url: string | null; azure_source: string | null } {
  // Check failed_final first
  const failedArr = results['failed_final'];
  if (Array.isArray(failedArr) && failedArr.length > 0) {
    return { glb_url: null, azure_source: 'failed_final' };
  }

  // success_final: prefer glb_artifact, fallback to original_glb_artifact
  const finalUri = extractArtifactUri(results, 'success_final', 'glb_artifact')
    || extractArtifactUri(results, 'success_final', 'original_glb_artifact');
  if (finalUri) {
    const url = azureUriToPublicUrl(finalUri) || finalUri;
    return { glb_url: url, azure_source: 'success_final' };
  }

  // success_original_glb: use original_glb_artifact
  const originalUri = extractArtifactUri(results, 'success_original_glb', 'original_glb_artifact');
  if (originalUri) {
    const url = azureUriToPublicUrl(originalUri) || originalUri;
    return { glb_url: url, azure_source: 'success_original_glb' };
  }

  // Legacy fallback: scan for any azure:// URI
  const fallbackUri = findAzureUri(results);
  if (fallbackUri) {
    const url = azureUriToPublicUrl(fallbackUri);
    return { glb_url: url, azure_source: 'fallback' };
  }

  return { glb_url: null, azure_source: null };
}

function resolveWorkflowEndpoint(template: unknown, workflowId: string, fallbackPath: string): string {
  const workflowToken = encodeURIComponent(workflowId);
  const raw = typeof template === 'string' && template.trim().length > 0
    ? template
    : fallbackPath;

  return raw
    .replaceAll('{workflow_id}', workflowToken)
    .replaceAll('{workflowId}', workflowToken)
    .replaceAll(':workflow_id', workflowToken)
    .replaceAll(':workflowId', workflowToken);
}

// ── API calls ──

export async function startRingPipeline(prompt: string, model: string): Promise<RunResponse> {
  const llmName = MODEL_MAP[model] || 'gemini';

  const res = await authenticatedFetch(`${FORMANOVA_API}/run/state/ring_generate_v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      llm: llmName,
      max_attempts: 3,
      skip_validation: false,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || `Pipeline start failed (${res.status})`);
  }

  const data = await res.json();
  // Normalize spec response (workflowId) to internal shape (workflow_id)
  return {
    ...data,
    workflow_id: data.workflowId || data.workflow_id,
    status_url: data.progressUrl || data.status_url,
    result_url: data.resultUrl || data.result_url,
  };
}

export async function pollStatus(statusUrl: string): Promise<StatusResponse> {
  // Per API spec: GET /api/workflows/:workflowId/progress
  const fullUrl = statusUrl.startsWith('http')
    ? statusUrl
    : `${FORMANOVA_API}${statusUrl.startsWith('/') ? '' : '/'}${statusUrl}`;

  const res = await authenticatedFetch(fullUrl);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Status poll failed (${res.status})`);
  }

  const raw = await res.json();

  // Spec response: { state, step, stepLabel, attempt, maxAttempts }
  const data: StatusResponse = {
    status: (raw.state || 'running').toLowerCase(),
    current_step: raw.step || raw.current_step,
    progress: (raw.state === 'completed' || raw.state === 'done') ? 100 : (raw.progress ?? 0),
    steps_completed: raw.steps_completed,
    steps_total: raw.steps_total,
    results: raw.results,
  };

  // Also handle legacy progress object shape
  const progressObj = raw.progress;
  if (progressObj && typeof progressObj === 'object') {
    const p = progressObj as Record<string, unknown>;
    const completed = Number(p.completed_nodes ?? 0);
    const total = Number(p.total_nodes ?? 1);
    const state = String(p.state || raw.state || 'running').toLowerCase();

    data.status = state;
    data.steps_completed = completed;
    data.steps_total = total;
    data.progress = (state === 'completed' || state === 'done')
      ? 100
      : total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  // Resolve GLB URL from inline results if completed
  if ((data.progress as number) >= 100 && data.results) {
    const { glb_url, azure_source } = resolveGlbFromResults(data.results as Record<string, unknown>);
    if (glb_url) {
      data.glb_url = glb_url;
      data.azure_source = azure_source;
    }
  }

  return data;
}

export async function fetchResult(resultUrl: string): Promise<ResultResponse> {
  // Per API spec: GET /api/workflows/:workflowId/result
  const fullUrl = resultUrl.startsWith('http')
    ? resultUrl
    : `${FORMANOVA_API}${resultUrl.startsWith('/') ? '' : '/'}${resultUrl}`;

  const res = await authenticatedFetch(fullUrl);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Result fetch failed (${res.status})`);
  }

  const data = await res.json();

  // Resolve GLB URL per spec fallback rules
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
