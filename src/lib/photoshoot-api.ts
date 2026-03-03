/**
 * Photoshoot Generation API
 * POST /run/state/jewelry_photoshoots_generator
 *
 * Uses direct JWT auth to the Temporal API gateway at /api.
 * Jewelry image must first be uploaded via /api/process to get a URL,
 * or use the azure-upload edge function.
 */

import { getStoredToken } from '@/lib/auth-api';

const API_BASE = '/api';

// ─── Types ──────────────────────────────────────────────────────────

export interface PhotoshootStartRequest {
  jewelry_image_url: string;
  model_image_url: string;
  category: string;
  idempotency_key?: string;
}

export interface PhotoshootStartResponse {
  workflow_id: string;
  status_url: string;
  result_url: string;
  projected_cost?: number;
  authorized_budget?: number;
}

export interface PhotoshootStatusResponse {
  progress?: {
    state: 'running' | 'completed' | 'failed';
    total_nodes?: number;
    completed_nodes?: number;
    visited?: string[];
  };
  state?: 'running' | 'completed' | 'failed';
  results?: Record<string, unknown[]>;
  error?: string;
}

export interface PhotoshootResultResponse {
  [key: string]: unknown[];
}

// ─── Auth Headers ───────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getFormHeaders(): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ─── Upload Image ───────────────────────────────────────────────────

/**
 * Upload an image via the Temporal /process endpoint to get a URL.
 * Uses a lightweight "upload_only" workflow or reuses image_classification.
 * Returns the Azure URL of the uploaded image.
 */
export async function uploadImageForUrl(
  imageBlob: Blob,
  filename = 'image.jpg',
): Promise<string> {
  const formData = new FormData();
  formData.append('file', imageBlob, filename);
  formData.append('workflow_name', 'image_classification');
  formData.append('num_variations', '1');

  const res = await fetch(`${API_BASE}/process`, {
    method: 'POST',
    headers: getFormHeaders(),
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }

  const data = await res.json();
  const workflowId = data.workflow_id;

  // Poll until completed to get the uploaded URL
  const pollStart = Date.now();
  while (Date.now() - pollStart < 60000) {
    await new Promise(r => setTimeout(r, 2000));

    const statusRes = await fetch(`${API_BASE}/status/${workflowId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    const state = statusData.progress?.state || statusData.state;

    if (state === 'completed') {
      // Extract uploaded image URL from results
      // The classification workflow stores the original image URL
      const results = statusData.results || {};

      // Try to find the image URL from various result keys
      for (const key of Object.keys(results)) {
        const items = results[key];
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item?.image_url) return item.image_url;
            if (item?.original_url) return item.original_url;
            if (item?.url) return item.url;
          }
        }
      }

      // Fallback: try root.original_path in steps
      if (statusData.steps) {
        for (const step of statusData.steps) {
          if (step?.input?.original_path) return step.input.original_path;
          if (step?.output?.original_path) return step.output.original_path;
        }
      }

      throw new Error('Upload completed but no image URL found in results');
    }

    if (state === 'failed') {
      throw new Error('Image upload workflow failed');
    }
  }

  throw new Error('Image upload timed out');
}

// ─── Start Photoshoot ───────────────────────────────────────────────

export async function startPhotoshoot(
  request: PhotoshootStartRequest,
): Promise<PhotoshootStartResponse> {
  const res = await fetch(`${API_BASE}/run/state/jewelry_photoshoots_generator`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ payload: request }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to start photoshoot: ${res.status} — ${text.substring(0, 200)}`);
  }

  return res.json();
}

// ─── Poll Status ────────────────────────────────────────────────────

export async function getPhotoshootStatus(
  workflowId: string,
): Promise<PhotoshootStatusResponse> {
  const res = await fetch(`${API_BASE}/status/${workflowId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Status check failed: ${res.status} — ${text.substring(0, 200)}`);
  }

  return res.json();
}

// ─── Get Result ─────────────────────────────────────────────────────

export async function getPhotoshootResult(
  workflowId: string,
): Promise<PhotoshootResultResponse> {
  const res = await fetch(`${API_BASE}/result/${workflowId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Result fetch failed: ${res.status} — ${text.substring(0, 200)}`);
  }

  return res.json();
}

// ─── Convenience: Poll Until Done ───────────────────────────────────

export interface PollCallbacks {
  onProgress?: (visited: string[], total: number, completed: number) => void;
  onComplete?: (result: PhotoshootResultResponse) => void;
  onError?: (error: string) => void;
}

export async function pollUntilDone(
  workflowId: string,
  callbacks: PollCallbacks = {},
  timeoutMs = 300000, // 5 min
  intervalMs = 3000,
): Promise<PhotoshootResultResponse> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, intervalMs));

    const status = await getPhotoshootStatus(workflowId);
    const state = status.progress?.state || (status as any).state;

    if (status.progress) {
      callbacks.onProgress?.(
        status.progress.visited || [],
        status.progress.total_nodes || 0,
        status.progress.completed_nodes || 0,
      );
    }

    if (state === 'completed') {
      const result = await getPhotoshootResult(workflowId);
      callbacks.onComplete?.(result);
      return result;
    }

    if (state === 'failed') {
      const errMsg = status.error || 'Workflow failed';
      callbacks.onError?.(errMsg);
      throw new Error(errMsg);
    }
  }

  throw new Error('Photoshoot timed out');
}
