// Microservices API Client
// Routes through Edge Functions to Azure, Image Manipulator, BiRefNet, and SAM3

import { getStoredToken } from './auth-api';
import { authFetch } from './auth-fetch';

const AZURE_UPLOAD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/azure-upload`;
const MICROSERVICES_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/microservices-proxy`;

function getAuthHeaders(): Record<string, string> {
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const userToken = getStoredToken();
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${anonKey}`, // Supabase gateway routing
    'apikey': anonKey,
    'Content-Type': 'application/json',
  };
  if (userToken) {
    headers['X-User-Token'] = userToken; // Backend auth via custom FastAPI service
  }
  return headers;
}
// ========== Azure Upload ==========
export interface AzureUploadResponse {
  uri: string;  // azure:// format for microservices
  sas_url: string;  // SAS URL for direct browser access
  https_url: string;  // Plain HTTPS URL (won't work for private containers)
}

export async function uploadToAzure(
  base64: string, 
  contentType: string = 'image/jpeg'
): Promise<AzureUploadResponse> {
  console.log('[microservices] Uploading to Azure...');
  
  const response = await authFetch(AZURE_UPLOAD_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ 
      base64, 
      content_type: contentType 
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[microservices] Azure upload failed:', error);
    throw new Error(`Azure upload failed: ${error}`);
  }

  const data = await response.json();
  console.log('[microservices] Azure upload success:', data.uri);
  return data;
}

// ========== Image Manipulator ==========
export interface ResizeRequest {
  image: string;  // Can be azure:// URI, HTTP URL, or base64
  target_width?: number;
  target_height?: number;
  flag?: string;  // e.g., "fixed_dimensions"
}

export interface ResizeResponse {
  image_base64: string;
  padding: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export async function resize(request: ResizeRequest): Promise<ResizeResponse> {
  console.log('[microservices] Resizing image...');
  
  // Backend expects image as an object with uri property
  const payload = {
    image: { uri: request.image },
    target_width: request.target_width,
    target_height: request.target_height,
    flag: request.flag,
  };
  
  const response = await authFetch(`${MICROSERVICES_PROXY_URL}?endpoint=/resize`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[microservices] Resize failed:', error);
    throw new Error(`Resize failed: ${error}`);
  }

  const data = await response.json();
  console.log('[microservices] Resize success, padding:', data.padding);
  return data;
}

export interface ZoomCheckRequest {
  image: string;  // Can be azure:// URI, HTTP URL, or base64
}

export interface ZoomCheckResponse {
  should_remove_background: boolean;
}

export async function zoomCheck(request: ZoomCheckRequest): Promise<ZoomCheckResponse> {
  console.log('[microservices] Checking zoom level...');
  
  // Backend expects image as an object with uri property
  const payload = {
    image: { uri: request.image },
  };
  
  const response = await authFetch(`${MICROSERVICES_PROXY_URL}?endpoint=/zoom-check`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[microservices] Zoom check failed:', error);
    throw new Error(`Zoom check failed: ${error}`);
  }

  const data = await response.json();
  console.log('[microservices] Zoom check result:', data);
  return data;
}

// ========== BiRefNet (Background Removal) ==========
export interface BiRefNetJobResponse {
  job_id: string;
}

export interface BiRefNetJobStatus {
  status: 'pending' | 'processing' | 'queued' | 'running' | 'completed' | 'succeeded' | 'failed';
  result?: {
    output?: {
      uri: string;
    };
  } | null;
  result_uri?: string; // Legacy field
  error?: string | null;
}

export async function submitBiRefNetJob(imageUri: string): Promise<BiRefNetJobResponse> {
  console.log('[microservices] Submitting BiRefNet job...');
  
  // BiRefNet expects { data: { image: { uri: "..." } } }
  const response = await authFetch(`${MICROSERVICES_PROXY_URL}?endpoint=/birefnet/jobs`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ data: { image: { uri: imageUri } } }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[microservices] BiRefNet job submission failed:', error);
    throw new Error(`BiRefNet job submission failed: ${error}`);
  }

  const data = await response.json();
  console.log('[microservices] BiRefNet job created:', data.job_id);
  return data;
}

export async function pollBiRefNetJob(jobId: string): Promise<BiRefNetJobStatus> {
  const response = await authFetch(`${MICROSERVICES_PROXY_URL}?endpoint=/birefnet/jobs/${jobId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`BiRefNet job poll failed: ${error}`);
  }

  const data = await response.json();
  console.log('[microservices] BiRefNet poll result:', data.status, data.result ? 'has result' : 'no result');
  return data;
}

// ========== SAM3 (Segmentation) ==========
export interface SAM3JobRequest {
  image_uri: string;
  points: number[][];
}

export interface SAM3JobResponse {
  job_id: string;
}

export interface SAM3JobStatus {
  status: 'pending' | 'processing' | 'queued' | 'running' | 'completed' | 'succeeded' | 'failed';
  result?: {
    mask?: {
      uri: string;
      type?: string;
      bytes?: number;
    };
    mask_overlay?: {
      uri: string;
    };
    original_mask?: {
      uri: string;
    };
    status?: string;
    meta?: {
      method?: string;
      image_size?: number[];
      dilation?: number;
    };
  };
  error?: string | null;
}

export async function submitSAM3Job(request: SAM3JobRequest): Promise<SAM3JobResponse> {
  console.log('[microservices] Submitting SAM3 job with', request.points.length, 'points...');
  
  // SAM3 expects { data: { image: { uri: "..." }, points: [...] } }
  const payload = {
    data: {
      image: { uri: request.image_uri },
      points: request.points,
    }
  };
  
  const response = await authFetch(`${MICROSERVICES_PROXY_URL}?endpoint=/sam3/jobs`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[microservices] SAM3 job submission failed:', error);
    throw new Error(`SAM3 job submission failed: ${error}`);
  }

  const data = await response.json();
  console.log('[microservices] SAM3 job created:', data.job_id);
  return data;
}

export async function pollSAM3Job(jobId: string): Promise<SAM3JobStatus> {
  const response = await authFetch(`${MICROSERVICES_PROXY_URL}?endpoint=/sam3/jobs/${jobId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SAM3 job poll failed: ${error}`);
  }

  return await response.json();
}

// ========== Polling Utility ==========
export interface PollOptions {
  maxAttempts?: number;
  intervalMs?: number;
  onProgress?: (attempt: number, status: string) => void;
}

export async function pollJobUntilComplete<T extends { status: string }>(
  pollFn: () => Promise<T>,
  options: PollOptions = {}
): Promise<T> {
  const { 
    maxAttempts = 120, // 2 minutes at 1s intervals
    intervalMs = 1000,
    onProgress 
  } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await pollFn();
    
    onProgress?.(attempt, result.status);
    
    if (result.status === 'completed' || result.status === 'succeeded') {
      console.log(`[microservices] Job completed after ${attempt} attempts`);
      return result;
    }
    
    if (result.status === 'failed') {
      throw new Error(`Job failed: ${(result as any).error || 'Unknown error'}`);
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  throw new Error(`Job timed out after ${maxAttempts} attempts`);
}

// ========== Helper: Fetch image via edge function (avoids CORS) ==========
const AZURE_FETCH_IMAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/azure-fetch-image`;

export async function fetchImageAsBase64(uri: string): Promise<string> {
  console.log('[microservices] Fetching image from URI:', uri.substring(0, 50) + '...');
  
  // Handle azure:// URIs via edge function to avoid CORS
  if (uri.startsWith('azure://')) {
    console.log('[microservices] Fetching via edge function to avoid CORS...');
    const response = await authFetch(AZURE_FETCH_IMAGE_URL, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ azure_uri: uri }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch image: ${error}`);
    }

    const data = await response.json();
    return data.base64;
  }
  
  // For regular URLs, fetch directly
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  
  return base64;
}
