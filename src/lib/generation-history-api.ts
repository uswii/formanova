/**
 * Generation History API
 * Fetches workflow history from formanova.ai backend (NOT Supabase).
 */

import { authenticatedFetch } from '@/lib/authenticated-fetch';

const BASE_URL = 'https://formanova.ai';

// ─── Types ──────────────────────────────────────────────────────────

export interface WorkflowSummary {
  workflow_id: string;
  name: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  /** Category derived from workflow name or metadata */
  source_type: 'photo' | 'cad_render' | 'cad_text' | 'unknown';
}

export interface WorkflowStep {
  tool: string;
  version: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  deterministic: boolean;
  took_ms: number;
  at: string;
}

export interface WorkflowDetail {
  summary: {
    id: string;
    name: string;
    status: string;
    created_at: string;
    finished_at: string | null;
  };
  steps: WorkflowStep[];
}

export interface WorkflowListResponse {
  workflows: WorkflowSummary[];
  total: number;
  page: number;
  per_page: number;
}

// ─── API Functions ──────────────────────────────────────────────────

/**
 * List the authenticated user's workflows with pagination.
 */
export async function listMyWorkflows(
  page = 1,
  perPage = 10,
): Promise<WorkflowListResponse> {
  const offset = (page - 1) * perPage;
  const res = await authenticatedFetch(
    `${BASE_URL}/history/workflows/me?limit=${perPage}&offset=${offset}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to list workflows: ${res.status}`);
  }

  const data = await res.json();

  // Normalize the response — backend may return a flat array or wrapped object
  const workflows: WorkflowSummary[] = (data.workflows ?? data ?? []).map(
    (w: any) => ({
      workflow_id: w.workflow_id ?? w.id,
      name: w.name ?? '',
      status: w.status ?? 'unknown',
      created_at: w.created_at ?? '',
      finished_at: w.finished_at ?? null,
      source_type: inferSourceType(w.name ?? ''),
    }),
  );

  return {
    workflows,
    total: data.total ?? workflows.length,
    page,
    per_page: perPage,
  };
}

/**
 * Get full details for a single workflow.
 */
export async function getWorkflowDetails(
  workflowId: string,
): Promise<WorkflowDetail> {
  const res = await authenticatedFetch(
    `${BASE_URL}/history/workflow/${workflowId}/details`,
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch workflow: ${res.status}`);
  }

  return res.json();
}

// ─── Helpers ────────────────────────────────────────────────────────

function inferSourceType(name: string): WorkflowSummary['source_type'] {
  const lower = name.toLowerCase();
  if (lower.includes('cad') && lower.includes('text')) return 'cad_text';
  if (lower.includes('cad') || lower.includes('render')) return 'cad_render';
  if (
    lower.includes('photo') ||
    lower.includes('necklace') ||
    lower.includes('earring') ||
    lower.includes('ring') ||
    lower.includes('bracelet') ||
    lower.includes('watch') ||
    lower.includes('jewelry') ||
    lower.includes('jewel')
  )
    return 'photo';
  return 'unknown';
}
