/**
 * Frontend API client for the Formanova Text-to-CAD pipeline.
 * All calls go through the formanova-proxy edge function — the API key never touches the browser.
 */

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/formanova-proxy`;

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
  [key: string]: unknown;
}

export interface ResultResponse {
  glb_url: string | null;
  [key: string]: unknown;
}

// ── API calls ──

export async function startRingPipeline(prompt: string, model: string): Promise<RunResponse> {
  const res = await fetch(`${PROXY_URL}?action=run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Pipeline start failed (${res.status})`);
  }

  return res.json();
}

export async function pollStatus(statusUrl: string): Promise<StatusResponse> {
  const res = await fetch(`${PROXY_URL}?action=status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status_url: statusUrl }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Status poll failed (${res.status})`);
  }

  return res.json();
}

export async function fetchResult(resultUrl: string): Promise<ResultResponse> {
  const res = await fetch(`${PROXY_URL}?action=result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result_url: resultUrl }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Result fetch failed (${res.status})`);
  }

  return res.json();
}

/**
 * Calculate progress percentage from status response.
 * Adapts to whatever fields the API returns.
 */
export function calcProgress(status: StatusResponse): number {
  if (typeof status.progress === "number") return Math.min(status.progress, 100);
  if (status.steps_completed != null && status.steps_total != null && status.steps_total > 0) {
    return Math.round((status.steps_completed / status.steps_total) * 100);
  }
  // Fallback: derive from status string
  const s = (status.status || "").toLowerCase();
  if (s === "completed" || s === "done") return 100;
  if (s === "running" || s === "in_progress") return 50;
  return 0;
}
