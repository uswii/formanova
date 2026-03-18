// Microservices API Client
// Routes through the formanova.ai gateway

import { getStoredToken } from './auth-api';

const GATEWAY_BASE = 'https://formanova.ai';

// ========== Azure Upload (via gateway) ==========

export interface AzureUploadResponse {
  uri: string;
  sas_url: string;
  https_url: string;
  asset_id?: string | null;
}

export async function uploadToAzure(
  base64: string,
  contentType: string = 'image/jpeg',
  assetType?: 'jewelry_photo' | 'model_photo'
): Promise<AzureUploadResponse> {
  console.log('[microservices] Uploading to Azure via gateway...');
  const token = getStoredToken();
  
  const response = await fetch(`${GATEWAY_BASE}/api/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': 'true',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({
      base64,
      content_type: contentType,
      ...(assetType ? { asset_type: assetType } : {}),
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
