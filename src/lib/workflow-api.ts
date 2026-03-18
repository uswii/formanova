/**
 * DAG Workflow API Client
 */

import { getStoredToken } from './auth-api';

const getProxyUrl = (endpoint: string) => `/api${endpoint}`;
// ========== Types ==========

export type JewelryType = 'necklace' | 'ring' | 'bracelet' | 'earrings' | 'watch';
export type SkinTone = 'light' | 'medium' | 'dark';

export interface WorkflowStartResponse {
  workflow_id: string;
  status_url?: string;
  result_url?: string;
}

export interface WorkflowProgress {
  state: 'running' | 'completed' | 'failed';
  total_nodes: number;
  completed_nodes: number;
  visited: string[];
}

export interface WorkflowStatusResponse {
  progress: WorkflowProgress;
  results: Record<string, unknown[]>;
}

export interface WorkflowResultResponse {
  [key: string]: unknown[];
}

// ========== Workflow 1: necklace_point_masking ==========

export interface MaskingRequest {
  imageBlob: Blob;
  points: number[][];      // [[x, y], ...] in image coordinates
  pointLabels: number[];   // [1, 1, 0, ...] - 1=foreground, 0=background
}

export interface MaskingResult {
  mask_base64: string;
  mask_overlay_base64: string;
  processed_image_base64: string;
  scaled_points: number[][];
  session_id: string;
  image_width: number;
  image_height: number;
}

// ========== Workflow 2: flux_gen_pipeline ==========

export interface FluxGenRequest {
  imageBlob: Blob;
  maskBase64: string;      // Must be data:image/png;base64,... format
  prompt: string;
}

export interface FluxGenResult {
  result_base64: string;
  result_gemini_base64?: string;
  fidelity_viz_base64?: string;
  fidelity_viz_gemini_base64?: string;
  metrics?: {
    precision: number;
    recall: number;
    iou: number;
    growth_ratio: number;
  };
  metrics_gemini?: {
    precision: number;
    recall: number;
    iou: number;
    growth_ratio: number;
  };
  session_id: string;
}

// ========== Workflow 3a: all_jewelry_masking ==========

export interface AllJewelryMaskingRequest {
  imageBlob: Blob;
  points: number[][];      // [[x, y], ...] in image coordinates
  pointLabels: number[];   // [1, 1, 0, ...] - 1=foreground, 0=background
  jewelryType: 'ring' | 'bracelet' | 'earrings' | 'watch';
}

export interface AllJewelryMaskingResult {
  mask_base64: string;
  mask_overlay_base64?: string;
  session_id?: string;
}

// ========== Workflow 3b: all_jewelry_generation ==========

export interface AllJewelryResult {
  result_base64: string;
  fidelity_viz_base64?: string;
  metrics?: {
    precision: number;
    recall: number;
    iou: number;
    growth_ratio: number;
  };
  session_id: string;
}

// ========== DAG Step Labels ==========

export const MASKING_DAG_STEPS = {
  'image_manipulator': { progress: 20, label: 'Resizing image...' },
  'zoom_check': { progress: 35, label: 'Analyzing zoom level...' },
  'bg_remove': { progress: 55, label: 'Removing background...' },
  'sam3': { progress: 85, label: 'Generating mask...' },
} as const;

export const FLUX_GEN_DAG_STEPS = {
  'resize_image': { progress: 5, label: 'Resizing image...' },
  'resize_mask': { progress: 8, label: 'Resizing mask...' },
  'mask_invert_input': { progress: 10, label: 'Inverting input mask...' },
  'white_bg_segmenter': { progress: 15, label: 'Segmenting background...' },
  'flux_fill': { progress: 40, label: 'Generating with Flux...' },
  'upscaler': { progress: 55, label: 'Upscaling...' },
  'mask_invert_original': { progress: 56, label: 'Inverting original mask...' },
  'composite': { progress: 58, label: 'Compositing Flux...' },
  'output_mask': { progress: 60, label: 'Detecting output mask...' },
  'mask_invert_flux': { progress: 62, label: 'Processing mask...' },
  'quality_metrics': { progress: 64, label: 'Calculating Flux metrics...' },
  'resize_for_gemini': { progress: 68, label: 'Preparing for Gemini...' },
  'gemini_router': { progress: 70, label: 'Routing to Gemini...' },
  'gemini_refine': { progress: 80, label: 'Refining with Gemini...' },
  'upscaler_gemini': { progress: 88, label: 'Upscaling Gemini...' },
  'composite_gemini': { progress: 92, label: 'Final composite...' },
  'output_mask_gemini': { progress: 94, label: 'Detecting Gemini mask...' },
  'mask_invert_gemini': { progress: 96, label: 'Processing Gemini mask...' },
  'quality_metrics_gemini': { progress: 98, label: 'Calculating metrics...' },
} as const;

// agentic_all_jewelry_masking pipeline (1 step)
export const ALL_JEWELRY_MASKING_DAG_STEPS = {
  'agentic_masking': { progress: 95, label: 'AI is identifying jewelry...' },
} as const;

// agentic_all_jewelry_photoshoot pipeline (1-2 steps depending on whether masking is skipped)
export const ALL_JEWELRY_DAG_STEPS = {
  'agentic_masking': { progress: 30, label: 'AI is identifying jewelry...' },
  'agentic_photoshoot': { progress: 95, label: 'AI is generating photoshoot...' },
} as const;

// agentic_photoshoot_only pipeline (1 step - masking already done)
export const ALL_JEWELRY_PHOTOSHOOT_ONLY_DAG_STEPS = {
  'agentic_photoshoot': { progress: 95, label: 'AI is generating photoshoot...' },
} as const;

export function getStepProgress(visited: string[], workflow: 'masking' | 'flux_gen' | 'all_jewelry' | 'all_jewelry_masking'): { progress: number; label: string } {
  if (!visited || visited.length === 0) {
    return { progress: 0, label: 'Starting workflow...' };
  }

  const lastStep = visited[visited.length - 1];
  let steps: Record<string, { progress: number; label: string }>;

  switch (workflow) {
    case 'masking':
      steps = MASKING_DAG_STEPS;
      break;
    case 'flux_gen':
      steps = FLUX_GEN_DAG_STEPS;
      break;
    case 'all_jewelry':
      steps = ALL_JEWELRY_DAG_STEPS;
      break;
    case 'all_jewelry_masking':
      steps = ALL_JEWELRY_MASKING_DAG_STEPS;
      break;
  }

  const stepInfo = steps[lastStep as keyof typeof steps];
  if (stepInfo) {
    return stepInfo;
  }

  return { progress: 50, label: lastStep.replace(/_/g, ' ') };
}

// ========== API Client ==========

class WorkflowApi {
  private getAuthHeaders(): Record<string, string> {
    const userToken = getStoredToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userToken) headers['Authorization'] = `Bearer ${userToken}`;
    return headers;
  }

  /**
   * Check health of the workflow server
   */
  async checkHealth(): Promise<{ status: string } | null> {
    try {
      const response = await fetch(getProxyUrl('/health'), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('[WorkflowApi] Health check failed:', error);
      return null;
    }
  }

  /**
   * Start necklace_point_masking workflow
   * Returns mask for necklace based on clicked points
   */
  async startMasking(request: MaskingRequest): Promise<WorkflowStartResponse> {
    const formData = new FormData();
    formData.append('file', request.imageBlob, 'image.jpg');
    formData.append('workflow_name', 'necklace_point_masking');
    formData.append('overrides', JSON.stringify({
      points: request.points,
      point_labels: request.pointLabels,
    }));

    console.log('[WorkflowApi] Starting necklace_point_masking', {
      points: request.points.length,
      pointLabels: request.pointLabels,
    });

    const response = await fetch(getProxyUrl('/process'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Masking workflow failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Start flux_gen_pipeline workflow
   * Generates photoshoot for necklace with existing mask
   */
  async startFluxGen(request: FluxGenRequest): Promise<WorkflowStartResponse> {
    const formData = new FormData();
    formData.append('file', request.imageBlob, 'image.jpg');
    formData.append('workflow_name', 'flux_gen_pipeline');

    // Ensure mask is in data:image/png;base64,... format
    let maskDataUri = request.maskBase64;
    if (!maskDataUri.startsWith('data:')) {
      maskDataUri = `data:image/png;base64,${maskDataUri}`;
    }

    formData.append('overrides', JSON.stringify({
      mask: maskDataUri,
      prompt: request.prompt,
    }));

    console.log('[WorkflowApi] Starting flux_gen_pipeline', {
      prompt: request.prompt.substring(0, 50),
      maskLength: maskDataUri.length,
    });

    const response = await fetch(getProxyUrl('/process'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      // Parse tool_unavailable errors for user-friendly message
      const toolUnavailableMatch = error.match(/tool_unavailable\s*\[([^\]]+)\]/i);
      if (toolUnavailableMatch || error.includes('tool_unavailable')) {
        const missingTools = toolUnavailableMatch ? toolUnavailableMatch[1] : 'unknown';
        throw new Error(`Backend service missing required tool: ${missingTools}. Please contact support or try again later.`);
      }
      throw new Error(`Flux gen workflow failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Start agentic_all_jewelry_masking workflow
   * Single agentic tool for resize + SAM3 + segment
   */
  async startAllJewelryMasking(request: AllJewelryMaskingRequest): Promise<WorkflowStartResponse> {
    const formData = new FormData();
    formData.append('file', request.imageBlob, 'image.jpg');
    formData.append('workflow_name', 'agentic_all_jewelry_masking');
    
    formData.append('overrides', JSON.stringify({
      points: request.points,
      point_labels: request.pointLabels,
      jewelry_type: request.jewelryType,
    }));

    console.log('[WorkflowApi] Starting agentic_all_jewelry_masking', {
      jewelryType: request.jewelryType,
      points: request.points.length,
    });

    const response = await fetch(getProxyUrl('/process'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      // Parse tool_unavailable errors for user-friendly message
      const toolUnavailableMatch = error.match(/tool_unavailable\s*\[([^\]]+)\]/i);
      if (toolUnavailableMatch || error.includes('tool_unavailable')) {
        const missingTools = toolUnavailableMatch ? toolUnavailableMatch[1] : 'unknown';
        throw new Error(`Backend service missing required tool: ${missingTools}. Please contact support or try again later.`);
      }
      throw new Error(`Agentic masking workflow failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Start agentic_all_jewelry_photoshoot workflow via Temporal
   * The DAG now runs masking internally, so we only pass the image + params.
   * Full pipeline: agentic_masking → agentic_photoshoot
   */
  async startAllJewelryGeneration(request: {
    imageBlob: Blob;
    jewelryType: string;
    skinTone: string;
  }): Promise<WorkflowStartResponse> {
    const formData = new FormData();
    formData.append('file', request.imageBlob, 'image.png');
    formData.append('workflow_name', 'agentic_all_jewelry_photoshoot');
    
    // Build overrides - just jewelry_type and skin_tone (masking happens in DAG)
    const overrides: Record<string, unknown> = {
      jewelry_type: request.jewelryType,
      skin_tone: request.skinTone,
    };
    
    formData.append('overrides', JSON.stringify(overrides));

    console.log('[WorkflowApi] Starting agentic_all_jewelry_photoshoot via Temporal', {
      jewelryType: request.jewelryType,
      skinTone: request.skinTone,
      imageSize: request.imageBlob.size,
    });

    const response = await fetch(getProxyUrl('/process'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      const toolUnavailableMatch = error.match(/tool_unavailable\s*\[([^\]]+)\]/i);
      if (toolUnavailableMatch || error.includes('tool_unavailable')) {
        const missingTools = toolUnavailableMatch ? toolUnavailableMatch[1] : 'unknown';
        throw new Error(`Backend service missing required tool: ${missingTools}. Please contact support or try again later.`);
      }
      throw new Error(`All jewelry generation workflow failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Get status of a running workflow
   */
  async getStatus(workflowId: string): Promise<WorkflowStatusResponse> {
    const response = await fetch(getProxyUrl(`/status/${workflowId}`), {
      method: 'GET',
      headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
    });

    // Treat transient 404 as "still running" — don't label as failed
    if (response.status === 404) {
      return {
        progress: { state: 'running', total_nodes: 0, completed_nodes: 0, visited: [] },
        results: {},
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      
      // Detect Temporal nondeterminism errors
      if (errorText.includes('Nondeterminism error') || errorText.includes('TMPRL1100')) {
        console.error('[WorkflowApi] Temporal nondeterminism error detected');
        return {
          progress: {
            state: 'failed',
            total_nodes: 0,
            completed_nodes: 0,
            visited: [],
          },
          results: {},
          error: 'Workflow version mismatch. The backend was updated while this workflow was running. Please start a new generation.',
        } as WorkflowStatusResponse & { error: string };
      }
      
      throw new Error(`Failed to get workflow status: ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Get result of a completed workflow (with retry for result-write lag)
   */
  async getResult(workflowId: string, maxRetries: number = 5, retryDelayMs: number = 1000): Promise<WorkflowResultResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, retryDelayMs));
      }

      const response = await fetch(getProxyUrl(`/result/${workflowId}`), {
        method: 'GET',
        headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
      });

      // 404 = result not written yet — retry
      if (response.status === 404) {
        lastError = new Error('Result not ready yet (404)');
        console.log(`[WorkflowApi] Result 404, retry ${attempt + 1}/${maxRetries}`);
        continue;
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get workflow result: ${error}`);
      }

      return await response.json();
    }

    throw lastError || new Error('Result fetch exhausted retries');
  }

  /**
   * Poll workflow until complete
   */
  async pollUntilComplete(
    workflowId: string,
    workflow: 'masking' | 'flux_gen' | 'all_jewelry' | 'all_jewelry_masking',
    onProgress?: (progress: number, label: string) => void,
    pollInterval: number = 2000,
    maxWaitMs: number = 720000 // 12 minutes (Sonnet-safe)
  ): Promise<WorkflowResultResponse> {
    const startTime = Date.now();
    let lastStatus: WorkflowStatusResponse | null = null;

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getStatus(workflowId);
      lastStatus = status;

      if (status.progress.visited.length > 0 && onProgress) {
        const { progress, label } = getStepProgress(status.progress.visited, workflow);
        onProgress(progress, label);
      }

      if (status.progress.state === 'completed') {
        if (onProgress) onProgress(100, 'Complete!');
        
        // Get final result from /result endpoint
        const finalResult = await this.getResult(workflowId);
        
        // IMPORTANT: Merge status.results with finalResult
        // The /result endpoint often only returns terminal nodes (quality_metrics, etc.)
        // The status.results contains ALL node outputs including images
        const mergedResult = { ...finalResult };
        
        console.log('[WorkflowApi] Final result from /result:', Object.keys(finalResult));
        console.log('[WorkflowApi] Status has results?', !!status.results);
        console.log('[WorkflowApi] Status.results keys:', status.results ? Object.keys(status.results) : 'none');
        
        if (status.results) {
          for (const [key, value] of Object.entries(status.results)) {
            if (!mergedResult[key]) {
              console.log(`[WorkflowApi] Adding from status: ${key}`);
              mergedResult[key] = value;
            }
          }
        }
        
        console.log('[WorkflowApi] Merged result keys:', Object.keys(mergedResult));
        console.log('[WorkflowApi] Has transform_apply?', !!mergedResult.transform_apply);
        if (mergedResult.transform_apply) {
          const ta = mergedResult.transform_apply as unknown[];
          console.log('[WorkflowApi] transform_apply is array?', Array.isArray(ta), 'length:', ta?.length);
          if (Array.isArray(ta) && ta.length > 0) {
            console.log('[WorkflowApi] transform_apply[0] keys:', Object.keys(ta[0] as object));
          }
        }
        
        return mergedResult;
      }

      if (status.progress.state === 'failed') {
        const errorMsg = (status as WorkflowStatusResponse & { error?: string }).error || 'Workflow failed';
        throw new Error(errorMsg);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Workflow timed out');
  }
}

export const workflowApi = new WorkflowApi();

// ========== Helper: Convert image source to Blob ==========

export async function imageSourceToBlob(src: string): Promise<Blob> {
  // Data URL
  if (src.startsWith('data:')) {
    const [header, base64] = src.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mimeType });
  }

  // URL (http, blob, or relative path)
  const response = await fetch(src);
  return await response.blob();
}

// ========== Helper: Base64 to Blob ==========

export function base64ToBlob(base64: string, mimeType: string = 'image/png'): Blob {
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mimeType });
}
