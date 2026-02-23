// Temporal/DAG Workflow API Client
// Connects to DAG pipeline orchestrator for jewelry generation

import { supabase } from '@/integrations/supabase/client';
import { getStoredToken } from '@/lib/auth-api';
import { authFetch } from '@/lib/auth-fetch';

// Use Supabase edge function proxy
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const getProxyUrl = (endpoint: string) => 
  `${SUPABASE_URL}/functions/v1/workflow-proxy?endpoint=${encodeURIComponent(endpoint)}`;

// ========== DAG Pipeline Types ==========

export interface DAGStartResponse {
  workflow_id: string;
  status_url: string;
  result_url: string;
}

export interface DAGProgress {
  state: 'running' | 'completed' | 'failed';
  total_nodes: number;
  completed_nodes: number;
  visited: string[];
}

export interface DAGStatusResponse {
  progress: DAGProgress;
  results: Record<string, any[]>;
}

export interface DAGResultResponse {
  [key: string]: any[];
}

// ========== Masking Workflow Types ==========

export interface MaskingWorkflowRequest {
  imageBlob: Blob;
  points: number[][];  // [[x, y], ...] normalized 0-1
  pointLabels: number[];  // [1, 1, ...] foreground points
}

export interface MaskingResult {
  mask_uri: string;
  overlay_uri: string;
}

// ========== Generation Workflow Types ==========

export interface GenerationWorkflowRequest {
  imageBlob: Blob;
  maskBase64: string;
  prompt: string;
  invertMask: boolean;
}

export interface GenerationResult {
  image: string;  // Azure URI
}

// ========== Legacy Types (kept for compatibility) ==========

export interface MaskPoint {
  x: number;
  y: number;
  label: 0 | 1;
}

export interface BrushStroke {
  points: Array<{ x: number; y: number }>;
  mode: 'add' | 'remove';
  size?: number;
}

export interface PreprocessingRequest {
  originalImageBase64: string;
  maskPoints: MaskPoint[];
}

export interface PreprocessingResult {
  resizedUri: string;
  maskUri: string;
  bgRemovedUri?: string | null;
  backgroundRemoved: boolean;
  padding: { top: number; bottom: number; left: number; right: number };
  sessionId: string;
  scaledPoints: number[][];
}

export interface OverlayResponse {
  imageBase64: string;
  maskBase64: string;
  overlayBase64: string;
}

export interface GenerationRequest {
  imageUri: string;
  maskUri: string;
  brushStrokes?: BrushStroke[];
  gender?: 'female' | 'male';
  scaledPoints?: number[][];
}

export interface WorkflowStartResponse {
  workflowId: string;
  status: 'RUNNING';
}

export interface FidelityMetrics {
  precision: number;
  recall: number;
  iou: number;
  growthRatio: number;
}

export interface WorkflowResult {
  fluxResultUri: string;
  geminiResultUri: string | null;
  fluxMetrics: FidelityMetrics;
  geminiMetrics: FidelityMetrics | null;
  fluxFidelityVizUri: string | null;
  geminiFidelityVizUri: string | null;
  maskUri?: string;
  processedImageUri?: string;
  backgroundRemoved?: boolean;
}

export interface WorkflowError {
  code: 'A100_UNAVAILABLE' | 'ML_SERVICE_UNAVAILABLE' | 'WORKFLOW_FAILED';
  message: string;
  failedStep: string;
}

export type WorkflowStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface WorkflowStatusResponse {
  workflowId: string;
  status: WorkflowStatus;
  progress: number | null;
  currentStep: string | null;
  result: WorkflowResult | null;
  error: WorkflowError | null;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'offline';
  temporal?: string;
  services?: {
    a100: 'online' | 'offline';
    imageManipulator: 'online' | 'offline';
    birefnet: 'online' | 'offline';
    sam3: 'online' | 'offline';
  };
}

// ========== DAG Workflow Steps ==========

export const DAG_MASKING_STEPS = {
  'image_manipulator': { progress: 15, label: 'Resizing image...' },
  'zoom_check': { progress: 25, label: 'Analyzing zoom level...' },
  'bg_remove': { progress: 45, label: 'Removing background...' },
  'sam3': { progress: 80, label: 'Generating mask...' },
} as const;

export const DAG_GENERATION_STEPS = {
  'resize_image': { progress: 10, label: 'Resizing image...' },
  'resize_mask': { progress: 15, label: 'Resizing mask...' },
  'white_bg_segmenter': { progress: 35, label: 'Segmenting background...' },
  'flux_fill': { progress: 70, label: 'Generating photoshoot...' },
  'upscaler': { progress: 95, label: 'Upscaling result...' },
} as const;

export type DAGMaskingStep = keyof typeof DAG_MASKING_STEPS;
export type DAGGenerationStep = keyof typeof DAG_GENERATION_STEPS;

export function getDAGStepLabel(step: string | null, workflow: 'masking' | 'generation'): string {
  if (!step) return 'Starting workflow...';
  
  if (workflow === 'masking') {
    const stepInfo = DAG_MASKING_STEPS[step as DAGMaskingStep];
    return stepInfo?.label || step.replace(/_/g, ' ');
  } else {
    const stepInfo = DAG_GENERATION_STEPS[step as DAGGenerationStep];
    return stepInfo?.label || step.replace(/_/g, ' ');
  }
}

export function getDAGStepProgress(visited: string[], workflow: 'masking' | 'generation'): number {
  if (!visited || visited.length === 0) return 0;
  
  const lastStep = visited[visited.length - 1];
  if (workflow === 'masking') {
    const stepInfo = DAG_MASKING_STEPS[lastStep as DAGMaskingStep];
    return stepInfo?.progress ?? 0;
  } else {
    const stepInfo = DAG_GENERATION_STEPS[lastStep as DAGGenerationStep];
    return stepInfo?.progress ?? 0;
  }
}

// ========== Legacy Step Labels ==========

export const WORKFLOW_STEPS = {
  CHECKING_HEALTH: { progress: 0, label: 'Checking services...' },
  UPLOADING_IMAGE: { progress: 5, label: 'Uploading to Azure...' },
  RESIZING_IMAGE: { progress: 12, label: 'Resizing image (2000×2667)...' },
  CHECKING_ZOOM: { progress: 18, label: 'Analyzing zoom level...' },
  SUBMITTING_BIREFNET: { progress: 22, label: 'Submitting background removal...' },
  POLLING_BIREFNET: { progress: 28, label: 'Removing background...' },
  SUBMITTING_SAM3: { progress: 38, label: 'Submitting mask generation...' },
  POLLING_SAM3: { progress: 48, label: 'Generating mask...' },
  REFINING_MASK: { progress: 55, label: 'Applying refinements...' },
  GENERATING_FLUX: { progress: 65, label: 'Generating photoshoot...' },
  GENERATING_GEMINI: { progress: 85, label: 'Enhancing with AI...' },
  CALCULATING_METRICS: { progress: 95, label: 'Calculating fidelity metrics...' },
  COMPLETED: { progress: 100, label: 'Complete!' },
} as const;

export type WorkflowStep = keyof typeof WORKFLOW_STEPS;

export function getStepLabel(step: string | null): string {
  if (!step) return 'Starting workflow...';
  const stepInfo = WORKFLOW_STEPS[step as WorkflowStep];
  return stepInfo?.label || step.replace(/_/g, ' ').toLowerCase();
}

export function getStepProgress(step: string | null): number {
  if (!step) return 0;
  const stepInfo = WORKFLOW_STEPS[step as WorkflowStep];
  return stepInfo?.progress ?? 0;
}

// ========== API Client ==========

class TemporalApi {
  private getAuthHeaders(): Record<string, string> {
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const userToken = getStoredToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`, // Supabase gateway routing
      'apikey': anonKey,
    };

    if (userToken) {
      headers['X-User-Token'] = userToken; // Backend auth via custom FastAPI service
    }

    return headers;
  }

  private getFormDataHeaders(): Record<string, string> {
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const userToken = getStoredToken();

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${anonKey}`, // Supabase gateway routing
      'apikey': anonKey,
    };

    if (userToken) {
      headers['X-User-Token'] = userToken; // Backend auth via custom FastAPI service
    }

    return headers;
  }

  // ========== DAG Pipeline Methods ==========

  async startMaskingWorkflow(
    imageBlob: Blob,
    points: number[][],
    pointLabels: number[]
  ): Promise<DAGStartResponse> {
    const formData = new FormData();
    formData.append('file', imageBlob, 'image.jpg');
    formData.append('workflow_name', 'necklace_point_masking');
    formData.append('overrides', JSON.stringify({
      points,
      point_labels: pointLabels,
    }));

    const response = await authFetch(getProxyUrl('/process'), {
      method: 'POST',
      headers: this.getFormDataHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start masking workflow: ${error}`);
    }

    return await response.json();
  }

  async startGenerationWorkflow(
    imageBlob: Blob,
    maskBase64: string,
    prompt: string,
    invertMask: boolean = false
  ): Promise<DAGStartResponse> {
    // Send as FormData directly - matching the curl example exactly
    // This way the proxy just forwards it and the DAG gets root.original_path from the file
    const formData = new FormData();
    formData.append('file', imageBlob, 'image.jpg');
    formData.append('workflow_name', 'flux_gen_pipeline');

    // Clean mask base64 and ensure data-uri format for the pipeline
    const cleanMask = maskBase64.includes(',') ? maskBase64.split(',')[1] : maskBase64;
    const maskDataUri = `data:image/png;base64,${cleanMask}`;

    formData.append(
      'overrides',
      JSON.stringify({
        mask: maskDataUri,
        prompt,
        invert_mask: invertMask,
        tile_size: 192,
      })
    );

    // DO NOT set Content-Type for FormData - browser sets boundary automatically
    const response = await authFetch(getProxyUrl('/process'), {
      method: 'POST',
      headers: this.getFormDataHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start generation workflow: ${error}`);
    }

    return await response.json();
  }

  async getDAGStatus(workflowId: string): Promise<DAGStatusResponse> {
    const response = await authFetch(getProxyUrl(`/status/${workflowId}`), {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get DAG status: ${error}`);
    }

    return await response.json();
  }

  async getDAGResult(workflowId: string): Promise<DAGResultResponse> {
    const response = await authFetch(getProxyUrl(`/result/${workflowId}`), {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get DAG result: ${error}`);
    }

    return await response.json();
  }

  // ========== Legacy Methods (kept for compatibility) ==========

  async checkHealth(): Promise<HealthResponse | null> {
    try {
      const response = await authFetch(getProxyUrl('/health'), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (response.ok) {
        return await response.json();
      }
      console.error('Health check failed:', response.status);
      return null;
    } catch (error) {
      console.error('Health check error:', error);
      return null;
    }
  }

  async startPreprocessing(request: PreprocessingRequest): Promise<WorkflowStartResponse> {
    const response = await authFetch(getProxyUrl('/workflow/preprocess'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start preprocessing: ${error}`);
    }

    return await response.json();
  }

  async startGeneration(request: GenerationRequest): Promise<WorkflowStartResponse> {
    const response = await authFetch(getProxyUrl('/workflow/generate'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start generation: ${error}`);
    }

    return await response.json();
  }

  async startWorkflow(request: any): Promise<WorkflowStartResponse> {
    const response = await authFetch(getProxyUrl('/workflow/start'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start workflow: ${error}`);
    }

    return await response.json();
  }

  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatusResponse> {
    const response = await authFetch(getProxyUrl(`/workflow/${workflowId}`), {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Invalid response from workflow API: ${text}`);
    }

    if (data.detail === 'CANCELLED') {
      return {
        workflowId,
        status: 'CANCELLED',
        progress: 0,
        currentStep: 'cancelled',
        result: null,
        error: {
          code: 'WORKFLOW_FAILED',
          message: 'Workflow was cancelled by the system',
          failedStep: 'unknown',
        },
      };
    }

    if (data.detail === 'FAILED' || data.error) {
      return {
        workflowId,
        status: 'FAILED',
        progress: 0,
        currentStep: 'failed',
        result: null,
        error: {
          code: 'WORKFLOW_FAILED',
          message: data.detail || data.error || 'Workflow failed',
          failedStep: 'unknown',
        },
      };
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }
      throw new Error(`Failed to get workflow status: ${text}`);
    }

    return data as WorkflowStatusResponse;
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    const response = await authFetch(getProxyUrl(`/workflow/${workflowId}/cancel`), {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to cancel workflow: ${error}`);
    }
  }

  async fetchOverlay(imageUri: string, maskUri: string): Promise<OverlayResponse> {
    const response = await authFetch(getProxyUrl('/overlay'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ imageUri, maskUri }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch overlay: ${error}`);
    }

    return await response.json();
  }

  async fetchImages(imageUris: { [key: string]: string | null | undefined }): Promise<{ [key: string]: string | null }> {
    const results: { [key: string]: string | null } = {};
    
    // Use azure-fetch-image edge function to fetch each image from Azure
    const fetchPromises = Object.entries(imageUris).map(async ([key, uri]) => {
      if (!uri) {
        results[key] = null;
        return;
      }
      
      // Handle both object { uri: "..." } and string formats
      const azureUri = typeof uri === 'object' && (uri as any).uri ? (uri as any).uri : uri;
      
      if (!azureUri || !azureUri.startsWith('azure://')) {
        console.warn(`[fetchImages] Invalid URI for ${key}:`, azureUri);
        results[key] = null;
        return;
      }
      
      try {
        const response = await authFetch(`${SUPABASE_URL}/functions/v1/azure-fetch-image`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ azure_uri: azureUri }),
        });
        
        if (!response.ok) {
          console.warn(`[fetchImages] Failed to fetch ${key}:`, response.status);
          results[key] = null;
          return;
        }
        
        const data = await response.json();
        results[key] = data.base64 || null;
      } catch (error) {
        console.warn(`[fetchImages] Error fetching ${key}:`, error);
        results[key] = null;
      }
    });
    
    await Promise.all(fetchPromises);
    return results;
  }
}

export const temporalApi = new TemporalApi();

// ========== Polling Helpers ==========

export interface DAGPollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onProgress?: (visited: string[], progress: number) => void;
}

export async function pollDAGUntilComplete(
  workflowId: string,
  workflow: 'masking' | 'generation',
  options: DAGPollOptions = {}
): Promise<DAGResultResponse> {
  const {
    intervalMs = 1500,
    timeoutMs = 300000,
    onProgress,
  } = options;

  const startTime = Date.now();

  while (true) {
    const status = await temporalApi.getDAGStatus(workflowId);
    
    const progress = getDAGStepProgress(status.progress.visited, workflow);
    onProgress?.(status.progress.visited, progress);

    if (status.progress.state === 'completed') {
      return await temporalApi.getDAGResult(workflowId);
    }

    if (status.progress.state === 'failed') {
      throw new Error('Workflow failed');
    }

    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Workflow timed out');
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

// Legacy polling helper
export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onProgress?: (status: WorkflowStatusResponse) => void;
}

export async function pollWorkflowUntilComplete(
  workflowId: string,
  options: PollOptions = {}
): Promise<WorkflowStatusResponse> {
  const {
    intervalMs = 2000,
    timeoutMs = 300000,
    onProgress,
  } = options;

  const startTime = Date.now();

  while (true) {
    const status = await temporalApi.getWorkflowStatus(workflowId);

    onProgress?.(status);

    if (status.status === 'COMPLETED') {
      return status;
    }

    if (status.status === 'FAILED') {
      throw new Error(status.error?.message || 'Workflow failed');
    }

    if (status.status === 'CANCELLED') {
      throw new Error('Workflow was cancelled');
    }

    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Workflow timed out');
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

// ========== Utilities ==========

/**
 * Convert base64 string or data URL to Blob.
 * For URLs (non-base64), use fetchUrlToBlob instead.
 */
export function base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
  // Check if this looks like a URL rather than base64
  if (base64.startsWith('http://') || base64.startsWith('https://') || 
      base64.startsWith('/') || base64.startsWith('blob:')) {
    throw new Error('Input appears to be a URL, not base64. Use fetchUrlToBlob instead.');
  }
  
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  
  // Validate base64 string
  if (!base64Data || !/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
    throw new Error('Invalid base64 string');
  }
  
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Fetch an image URL and convert to Blob.
 * Works for both local asset URLs and remote URLs.
 */
export async function fetchUrlToBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  return await response.blob();
}

/**
 * Convert image source to Blob - handles both base64 and URLs.
 */
export async function imageSourceToBlob(source: string): Promise<Blob> {
  // Check if it's a data URL (base64)
  if (source.startsWith('data:')) {
    return base64ToBlob(source);
  }
  
  // Check if it's a URL (local or remote)
  if (source.startsWith('http://') || source.startsWith('https://') || 
      source.startsWith('/') || source.startsWith('blob:')) {
    return await fetchUrlToBlob(source);
  }
  
  // Assume it's raw base64
  return base64ToBlob(source);
}
