// Multi-Jewelry Generation API Client
// Calls the jewelry-generate edge function which proxies to A100

import { getStoredToken } from './auth-api';
import { authFetch } from './auth-fetch';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Map plural to singular jewelry types
const JEWELRY_TYPE_MAP: Record<string, string> = {
  'rings': 'ring',
  'bracelets': 'bracelet',
  'earrings': 'earring',
  'necklaces': 'necklace',
  'watches': 'watch',
  'ring': 'ring',
  'bracelet': 'bracelet',
  'earring': 'earring',
  'necklace': 'necklace',
  'watch': 'watch',
};

export function toSingularJewelryType(type: string): string {
  return JEWELRY_TYPE_MAP[type.toLowerCase()] || 'necklace';
}

export interface GenerateRequest {
  imageBase64: string;      // Original/resized image
  maskBase64: string;       // Edited mask (user may have brush edited)
  jewelryType: string;      // Will be converted to singular
  skinTone: string;         // For non-necklace types
  gender?: string;          // For necklace type (always "female")
  scaledPoints?: number[][]; // Scaled points from segmentation
  enableQualityCheck?: boolean;
  enableTransformation?: boolean;
}

export interface FidelityMetrics {
  iou: number;
  dice: number;
  precision: number;
  recall: number;
  growth_ratio: number;
  extra_area_fraction: number;
}

export interface GenerateResponse {
  result_base64: string;
  result_gemini_base64: string | null;  // Only for necklace
  fidelity_viz_base64: string | null;
  fidelity_viz_gemini_base64: string | null;  // Only for necklace
  metrics: FidelityMetrics | null;
  metrics_gemini: FidelityMetrics | null;  // Only for necklace
  session_id: string;
  has_two_modes: boolean;  // True only for necklace
}

class JewelryGenerateApi {
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

  private getProxyUrl(endpoint: string): string {
    return `${SUPABASE_URL}/functions/v1/jewelry-generate?endpoint=${encodeURIComponent(endpoint)}`;
  }

  async checkHealth(): Promise<{ status: string; gemini_available: boolean } | null> {
    try {
      const response = await authFetch(this.getProxyUrl('/health'), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (response.ok) {
        return await response.json();
      }
      console.error('Jewelry API health check failed:', response.status);
      return null;
    } catch (error) {
      console.error('Jewelry API health check error:', error);
      return null;
    }
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // Convert to singular jewelry type
    const singularType = toSingularJewelryType(request.jewelryType);
    console.log(`[JewelryAPI] Generate: ${request.jewelryType} -> ${singularType}`);

    // Clean base64 (remove data URI prefix if present)
    const cleanBase64 = (b64: string) => {
      if (b64.includes(',')) {
        return b64.split(',')[1];
      }
      return b64;
    };

    // For necklace, send gender="female"; for others, send skin_tone
    const body: Record<string, unknown> = {
      image_base64: cleanBase64(request.imageBase64),
      mask_base64: cleanBase64(request.maskBase64),
      jewelry_type: singularType,
      enable_quality_check: request.enableQualityCheck ?? true,
      enable_transformation: request.enableTransformation ?? true,
    };

    if (singularType === 'necklace') {
      body.gender = 'female';
    } else {
      body.skin_tone = request.skinTone;
    }

    // Include scaled_points if available (needed for fidelity metrics)
    if (request.scaledPoints && request.scaledPoints.length > 0) {
      body.scaled_points = request.scaledPoints;
      console.log(`[JewelryAPI] Sending scaled_points:`, request.scaledPoints.length, 'points');
    }

    console.log(`[JewelryAPI] Sending request, image size: ${(body.image_base64 as string).length}, mask size: ${(body.mask_base64 as string).length}`);

    const response = await authFetch(this.getProxyUrl('/generate'), {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[JewelryAPI] Generation failed:', response.status, errorText);
      throw new Error(`Generation failed: ${errorText}`);
    }

    const data = await response.json();
    console.log(`[JewelryAPI] Generation complete, session: ${data.session_id}`);
    return data;
  }
}

export const jewelryGenerateApi = new JewelryGenerateApi();
