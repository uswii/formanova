/**
 * Frontend API client for the Formanova Text-to-CAD pipeline.
 * Calls the production API directly with JWT Bearer auth.
 * Uses authenticatedFetch for centralized 401 handling.
 */

import { authenticatedFetch } from '@/lib/authenticated-fetch';

const FORMANOVA_API = import.meta.env.DEV ? 'https://formanova.ai/api' : '/api';
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

function normalizeApiUrl(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return FORMANOVA_API;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/api/')) return `${FORMANOVA_API}${trimmed.slice(4)}`;
  if (trimmed.startsWith('/')) return `${FORMANOVA_API}${trimmed}`;
  return `${FORMANOVA_API}/${trimmed}`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { __non_json: true, __raw_text: text };
  }
}

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;

  const data = payload as Record<string, unknown>;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    const messages = data.detail
      .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>).msg : null))
      .filter((msg): msg is string => typeof msg === 'string');
    if (messages.length > 0) return messages.join('; ');
  }
  if (typeof data.error === 'string') return data.error;

  if (data.__non_json) {
    const raw = String(data.__raw_text ?? '').trim().toLowerCase();
    if (raw.includes('<!doctype') || raw.includes('<html')) {
      return `${fallback} (received HTML instead of JSON)`;
    }
    return `${fallback} (received non-JSON response)`;
  }

  return fallback;
}

function resolveWorkflowEndpoint(template: unknown, workflowId: string, fallbackPath: string): string {
  const workflowToken = encodeURIComponent(workflowId);
  const raw = typeof template === 'string' && template.trim().length > 0
    ? template
    : fallbackPath;

  const resolved = raw
    .replaceAll('{workflow_id}', workflowToken)
    .replaceAll('{workflowId}', workflowToken)
    .replaceAll(':workflow_id', workflowToken)
    .replaceAll(':workflowId', workflowToken);

  return normalizeApiUrl(resolved);
}

// ── API calls ──

export async function startRingPipeline(prompt: string, model: string): Promise<RunResponse> {
  const llmName = MODEL_MAP[model] || 'gemini';

  const res = await authenticatedFetch(`${FORMANOVA_API}/run/state/ring_generate_v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: {
        prompt,
        llm: llmName,
        max_attempts: 3,
        skip_validation: false,
      },
    }),
  });

  const payload = await readResponseBody(res);
  if (!res.ok) {
    throw new Error(getApiErrorMessage(payload, `Pipeline start failed (${res.status})`));
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Pipeline start response is invalid');
  }

  const data = payload as Record<string, unknown>;
  // Normalize spec response (workflowId) to internal shape (workflow_id)
  const workflow_id = String(data.workflowId || data.workflow_id || '').trim();
  if (!workflow_id) {
    throw new Error('Pipeline start response missing workflow_id');
  }

  return {
    ...data,
    workflow_id,
    status_url: resolveWorkflowEndpoint(
      data.progressUrl || data.status_url,
      workflow_id,
      `${FORMANOVA_API}/status/${encodeURIComponent(workflow_id)}`,
    ),
    result_url: resolveWorkflowEndpoint(
      data.resultUrl || data.result_url,
      workflow_id,
      `${FORMANOVA_API}/result/${encodeURIComponent(workflow_id)}`,
    ),
  };
}

export async function pollStatus(statusUrl: string): Promise<StatusResponse> {
  // Per API spec: GET /api/workflows/:workflowId/progress
  const fullUrl = normalizeApiUrl(statusUrl);

  const res = await authenticatedFetch(fullUrl);
  const payload = await readResponseBody(res);

  if (!res.ok) {
    throw new Error(getApiErrorMessage(payload, `Status poll failed (${res.status})`));
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Status poll failed: invalid response body');
  }

  const raw = payload as Record<string, unknown>;
  if (raw.__non_json) {
    throw new Error(getApiErrorMessage(raw, 'Status poll failed'));
  }

  // Spec response: { state, step, stepLabel, attempt, maxAttempts }
  const rawState = String(raw.state ?? 'running').toLowerCase();
  const data: StatusResponse = {
    status: rawState,
    current_step: typeof raw.step === 'string'
      ? raw.step
      : (typeof raw.current_step === 'string' ? raw.current_step : undefined),
    progress: (rawState === 'completed' || rawState === 'done')
      ? 100
      : Number(raw.progress ?? 0),
    steps_completed: raw.steps_completed == null ? undefined : Number(raw.steps_completed),
    steps_total: raw.steps_total == null ? undefined : Number(raw.steps_total),
    results: raw.results && typeof raw.results === 'object' && !Array.isArray(raw.results)
      ? (raw.results as Record<string, unknown>)
      : undefined,
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
  const fullUrl = normalizeApiUrl(resultUrl);

  const res = await authenticatedFetch(fullUrl);
  const payload = await readResponseBody(res);

  if (!res.ok) {
    throw new Error(getApiErrorMessage(payload, `Result fetch failed (${res.status})`));
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Result fetch failed: invalid response body');
  }

  const data = payload as Record<string, unknown>;
  if (data.__non_json) {
    throw new Error(getApiErrorMessage(data, 'Result fetch failed'));
  }

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
