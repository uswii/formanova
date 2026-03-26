// Microservices API Client
// Routes through Edge Functions to Azure, Image Manipulator, BiRefNet, and SAM3

import { authenticatedFetch } from './authenticated-fetch';

const AZURE_UPLOAD_URL = `${import.meta.env.VITE_PIPELINE_API_URL}/upload`;

// ========== Azure Upload ==========
export interface AzureUploadResponse {
  uri: string;  // azure:// format for microservices
  sas_url: string;  // SAS URL for direct browser access
  https_url: string;  // Plain HTTPS URL (won't work for private containers)
  asset_id?: string | null;  // set by backend registration; null if fail-open triggered
}

export async function uploadToAzure(
  base64: string,
  contentType: string = 'image/jpeg',
  assetType?: 'jewelry_photo' | 'model_photo',
  metadata?: Record<string, string>,
): Promise<AzureUploadResponse> {
  console.log('[microservices] Uploading to Azure...');

  const response = await authenticatedFetch(AZURE_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64,
      content_type: contentType,
      ...(assetType ? { asset_type: assetType } : {}),
      ...(metadata ? { metadata } : {}),
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

