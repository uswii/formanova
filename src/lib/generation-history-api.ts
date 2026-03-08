/**
 * Generation History API
 * Fetches workflow history from formanova.ai backend (NOT Supabase).
 * Uses authenticatedFetch for JWT Bearer auth.
 */

import { authenticatedFetch } from '@/lib/authenticated-fetch';

const BASE_URL = 'https://formanova.ai';

// ─── Types ──────────────────────────────────────────────────────────

export type SourceType = 'photo' | 'cad_render' | 'cad_text' | 'unknown';

export interface WorkflowSummary {
  workflow_id: string;
  name: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  source_type: SourceType;
  /** Optional thumbnail extracted from workflow details (populated client-side) */
  thumbnail_url?: string;
  /** All angle screenshots for cad_text workflows (populated client-side) */
  screenshots?: { angle: string; url: string }[];
  /** GLB download URL (populated client-side from workflow details) */
  glb_url?: string | null;
  /** GLB file name extracted from the azure URI */
  glb_filename?: string | null;
  /** AI model tier used (e.g. 'gemini', 'claude-sonnet', 'claude-opus') — populated client-side */
  ai_model?: string | null;
  /** Mode from workflow input (e.g. 'lite', 'standard', 'premium') — available in list response */
  mode?: string | null;
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

// ─── API Functions ──────────────────────────────────────────────────

/**
 * List the authenticated user's workflows.
 * Backend: GET /history/workflows/me?limit=N&offset=M
 */
export async function listMyWorkflows(
  limit = 100,
  offset = 0,
): Promise<WorkflowSummary[]> {
  const res = await authenticatedFetch(
    `${BASE_URL}/history/workflows/me?limit=${limit}&offset=${offset}`,
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('[HistoryAPI] list failed:', res.status, text.substring(0, 200));
    throw new Error(`Failed to list workflows: ${res.status}`);
  }

  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    const text = await res.text();
    console.error('[HistoryAPI] Expected JSON, got:', contentType, text.substring(0, 200));
    throw new Error(`API returned non-JSON response (${contentType}). The endpoint may not exist yet.`);
  }

  const data = await res.json();

  // Normalize — backend may return array or { workflows: [...] }
  const raw: any[] = Array.isArray(data) ? data : (data.workflows ?? []);

  const mapped = raw.map((w: any) => {
    const name = w.name ?? '';
    const sourceType = inferSourceType(name);
    if (sourceType === 'unknown') {
      console.warn('[HistoryAPI] unknown source_type for workflow:', { id: w.workflow_id ?? w.id, name, status: w.status });
    }
    return {
      workflow_id: w.workflow_id ?? w.id,
      name,
      status: w.status ?? 'unknown',
      created_at: w.created_at ?? w.started_at ?? '',
      finished_at: w.finished_at ?? null,
      source_type: sourceType,
      mode: w.input?.mode ?? null,
    };
  });
  console.log('[HistoryAPI] source_type breakdown:', {
    photo: mapped.filter(w => w.source_type === 'photo').length,
    cad_text: mapped.filter(w => w.source_type === 'cad_text').length,
    cad_render: mapped.filter(w => w.source_type === 'cad_render').length,
    unknown: mapped.filter(w => w.source_type === 'unknown').length,
  });
  return mapped;
}

/**
 * Get full details for a single workflow.
 * Backend: GET /history/workflow/{id}/details
 */
export async function getWorkflowDetails(
  workflowId: string,
): Promise<WorkflowDetail> {
  const res = await authenticatedFetch(
    `${BASE_URL}/history/workflow/${workflowId}/details`,
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('[HistoryAPI] detail failed:', res.status, text.substring(0, 200));
    throw new Error(`Failed to fetch workflow: ${res.status}`);
  }

  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    const text = await res.text();
    console.error('[HistoryAPI] Expected JSON, got:', contentType, text.substring(0, 200));
    throw new Error(`API returned non-JSON response`);
  }

  const raw = await res.json();
  console.debug('[HistoryAPI] detail raw response keys:', Object.keys(raw ?? {}));
  console.debug('[HistoryAPI] detail raw response (full):', JSON.stringify(raw, null, 2).substring(0, 5000));

  // Log steps detail
  const stepsSource = raw?.data?.steps ?? raw?.workflow?.steps ?? raw?.result?.steps ?? raw?.steps ?? raw?.workflow_steps ?? [];
  console.debug('[HistoryAPI] steps count:', stepsSource.length);
  stepsSource.forEach((step: any, i: number) => {
    console.debug(`[HistoryAPI] step[${i}] tool="${step.tool ?? step.tool_name ?? step.name}" status="${step.status}" has_output=${!!step.output}`);
    const toolName = (step.tool ?? step.tool_name ?? step.name ?? '').toLowerCase();
    if (toolName.includes('blender')) {
      console.debug(`[HistoryAPI] run_blender output:`, JSON.stringify(step.output, null, 2)?.substring(0, 3000));
      console.debug(`[HistoryAPI] run_blender output.success:`, step.output?.success);
      console.debug(`[HistoryAPI] run_blender screenshots:`, step.output?.screenshots);
      console.debug(`[HistoryAPI] run_blender glb_artifact:`, step.output?.glb_artifact);
    }
  });

  // Normalize: backend may wrap response in different shapes
  const payload = raw?.data ?? raw?.workflow ?? raw?.result ?? raw;
  return {
    summary: payload?.summary ?? {
      id: payload?.workflow_id ?? payload?.id ?? workflowId,
      name: payload?.name ?? '',
      status: payload?.status ?? 'unknown',
      created_at: payload?.created_at ?? '',
      finished_at: payload?.finished_at ?? null,
    },
    steps: payload?.steps ?? payload?.workflow_steps ?? [],
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Infer the source type from the workflow name */
export function inferSourceType(name: string): SourceType {
  const lower = name.toLowerCase();

  // Text-to-CAD workflows (ring_full_pipeline, ring_generate, text_to_cad, etc.)
  if (
    lower.includes('ring_full_pipeline') ||
    lower.includes('ring_generate') ||
    lower.includes('text_to_cad') ||
    lower.includes('text-to-cad') ||
    lower.includes('ring-generate') ||
    (lower.includes('ring') && lower.includes('pipeline')) ||
    (lower.includes('ring') && lower.includes('generate'))
  )
    return 'cad_text';

  // CAD render workflows
  if (lower.includes('cad') || lower.includes('render')) return 'cad_render';

  // Photo workflows (jewelry photoshoot, masking, flux gen, etc.)
  if (
    lower.includes('photo') ||
    lower.includes('masking') ||
    lower.includes('flux') ||
    lower.includes('necklace') ||
    lower.includes('earring') ||
    lower.includes('bracelet') ||
    lower.includes('watch') ||
    lower.includes('jewelry') ||
    lower.includes('agentic')
  )
    return 'photo';

  return 'unknown';
}
