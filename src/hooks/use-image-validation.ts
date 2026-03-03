import { useState, useCallback } from 'react';
import { getStoredToken } from '@/lib/auth-api';
import { compressImageBlob } from '@/lib/image-compression';
import { uploadToAzure } from '@/lib/microservices-api';

const BASE_URL = 'https://formanova.ai';
const WORN_CATEGORIES = ['mannequin', 'model', 'body_part'];

// Response from the classification service
export interface ClassificationResult {
  category: 'mannequin' | 'model' | 'body_part' | 'flatlay' | '3d_render' | 'product_surface' | 'floating' | 'packshot';
  is_worn: boolean;
  confidence: number;
  reason: string;
  flagged: boolean;
  /** URL of the uploaded image — reuse to avoid double uploads */
  uploaded_url?: string;
}

// Mapped result for UI consumption
export interface ImageValidationResult {
  index: number;
  detected_type: 'worn' | 'flatlay' | 'packshot' | 'unknown';
  is_acceptable: boolean;
  flags: string[];
  confidence: number;
  message: string;
  category: string;
  /** URL of the uploaded image — reuse for photoshoot generation */
  uploaded_url?: string;
}

export interface ValidationResponse {
  results: ImageValidationResult[];
  all_acceptable: boolean;
  flagged_count: number;
  message: string;
}

export interface ValidationState {
  isValidating: boolean;
  results: ImageValidationResult[] | null;
  flaggedCount: number;
  error: string | null;
}

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

/**
 * Map backend category to simplified type for UI
 */
function mapCategoryToType(category: string, is_worn: boolean): 'worn' | 'flatlay' | 'packshot' | 'unknown' {
  if (is_worn) return 'worn';
  if (category === 'flatlay' || category === 'product_surface') return 'flatlay';
  if (category === 'packshot' || category === '3d_render' || category === 'floating') return 'packshot';
  return 'unknown';
}

/**
 * Build flags array from classification result
 */
function buildFlags(result: ClassificationResult): string[] {
  const flags: string[] = [];
  if (!result.is_worn) flags.push('not_worn');
  if (result.flagged) flags.push('flagged');
  if (result.category === '3d_render') flags.push('3d_render');
  if (result.category === 'floating') flags.push('floating');
  return flags;
}

/**
 * Hook for validating uploaded jewelry images.
 *
 * New flow:
 * 1. Upload image via azure-upload edge function → get URL
 * 2. POST /api/run/state/image_classification with { payload: { original_path: { uri } } }
 * 3. Poll /api/status/{id} checking runtime.state
 * 4. Fetch result from /api/result/{id}
 * 5. Read result.image_captioning[0] with label, confidence, reason
 */
export function useImageValidation() {
  const [state, setState] = useState<ValidationState>({
    isValidating: false,
    results: null,
    flaggedCount: 0,
    error: null,
  });

  /**
   * Convert File to base64 string (for azure-upload)
   */
  const fileToBase64 = useCallback(async (file: File): Promise<string> => {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const { blob: compressed } = await compressImageBlob(blob, 900);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(compressed);
    });
  }, []);

  /**
   * Classify a single image:
   * 1. Upload to Azure via edge function → get URL
   * 2. POST /api/run/image_classification with { payload: { original_path: url } }
   * 3. Response contains { result_url } — GET that (blocks until done)
   * 4. Read result.image_captioning[0]
   */
  const classifyImage = useCallback(async (
    base64DataUri: string
  ): Promise<ClassificationResult | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      console.log('[ImageValidation] Uploading image to Azure...');

      // 1. Upload to Azure to get a URL
      const azureResult = await uploadToAzure(base64DataUri);
      const uploadedUrl = azureResult.https_url || azureResult.sas_url;
      console.log('[ImageValidation] Uploaded:', uploadedUrl);

      // 2. POST to /api/run/image_classification (plain URL string, Bearer JWT)
      const authHeaders = getAuthHeaders();
      const runRes = await fetch(`${BASE_URL}/api/run/image_classification`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          payload: {
            original_path: uploadedUrl,
          },
        }),
        signal: controller.signal,
      });

      if (!runRes.ok) {
        console.warn('[ImageValidation] /run/image_classification failed:', runRes.status);
        clearTimeout(timeoutId);
        return {
          category: 'flatlay',
          is_worn: true,
          confidence: 0,
          reason: 'skipped',
          flagged: false,
          uploaded_url: uploadedUrl,
        };
      }

      const runData = await runRes.json();
      const resultUrl = runData.result_url;
      console.log('[ImageValidation] Got result_url:', resultUrl);

      // 3. GET the result (blocks until workflow completes)
      const resultRes = await fetch(`${BASE_URL}/api${resultUrl}`, {
        method: 'GET',
        headers: authHeaders,
        signal: controller.signal,
      });

      if (!resultRes.ok) {
        console.warn('[ImageValidation] Result fetch failed:', resultRes.status);
        clearTimeout(timeoutId);
        return {
          category: 'flatlay',
          is_worn: true,
          confidence: 0,
          reason: 'error',
          flagged: false,
          uploaded_url: uploadedUrl,
        };
      }

      const resultData = await resultRes.json();
      console.log('[ImageValidation] Classification result:', JSON.stringify(resultData));
      const classificationResults = resultData.image_captioning;

      if (classificationResults && classificationResults.length > 0) {
        const raw = classificationResults[0];
        const label = raw.label || raw.category || 'unknown';
        const reason = raw.reason || '';
        const is_worn = reason === 'worn';

        clearTimeout(timeoutId);
        return {
          category: label,
          is_worn,
          confidence: raw.confidence || 0,
          reason,
          flagged: reason === 'not_worn',
          uploaded_url: uploadedUrl,
        };
      }

      console.warn('[ImageValidation] No image_captioning in result');
      clearTimeout(timeoutId);
      return {
        category: 'flatlay' as const,
        is_worn: true,
        confidence: 0,
        reason: 'no_result',
        flagged: false,
        uploaded_url: uploadedUrl,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[ImageValidation] Request timed out');
      } else {
        console.error('[ImageValidation] Request failed:', error);
      }
      return null;
    }
  }, []);

  /**
   * Validate multiple images at once
   */
  const validateImages = useCallback(async (
    files: File[],
    category: string
  ): Promise<ValidationResponse | null> => {
    if (files.length === 0) return null;

    setState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
      const base64Uris = await Promise.all(files.map(fileToBase64));
      const classificationResults = await Promise.all(
        base64Uris.map(uri => classifyImage(uri))
      );

      const results: ImageValidationResult[] = classificationResults.map((result, idx) => {
        if (!result) {
          return {
            index: idx,
            detected_type: 'unknown' as const,
            is_acceptable: true,
            flags: [],
            confidence: 0,
            message: 'Validation skipped',
            category: 'unknown',
          };
        }

        const detectedType = mapCategoryToType(result.category, result.is_worn);
        const flags = buildFlags(result);

        return {
          index: idx,
          detected_type: detectedType,
          is_acceptable: result.is_worn || !result.flagged,
          flags,
          confidence: result.confidence,
          message: result.reason,
          category: result.category,
          uploaded_url: result.uploaded_url,
        };
      });

      const flaggedCount = results.filter(r => r.flags.length > 0).length;
      const allAcceptable = results.every(r => r.is_acceptable);

      setState({
        isValidating: false,
        results,
        flaggedCount,
        error: null,
      });

      return {
        results,
        all_acceptable: allAcceptable,
        flagged_count: flaggedCount,
        message: flaggedCount > 0
          ? `${flaggedCount} image(s) flagged - review recommended before submission`
          : 'All images passed validation',
      };
    } catch (error) {
      console.error('Image validation error:', error);

      const fallbackResults: ImageValidationResult[] = files.map((_, idx) => ({
        index: idx,
        detected_type: 'unknown' as const,
        is_acceptable: true,
        flags: [],
        confidence: 0,
        message: 'Validation error',
        category: 'unknown',
      }));

      setState({
        isValidating: false,
        results: fallbackResults,
        flaggedCount: 0,
        error: error instanceof Error ? error.message : 'Validation failed',
      });

      return {
        results: fallbackResults,
        all_acceptable: true,
        flagged_count: 0,
        message: 'Validation error - proceeding anyway',
      };
    }
  }, [fileToBase64, classifyImage]);

  const clearValidation = useCallback(() => {
    setState({ isValidating: false, results: null, flaggedCount: 0, error: null });
  }, []);

  const isImageFlagged = useCallback((index: number): boolean => {
    if (!state.results) return false;
    const result = state.results.find(r => r.index === index);
    return result ? result.flags.length > 0 : false;
  }, [state.results]);

  const getImageFlags = useCallback((index: number): string[] => {
    if (!state.results) return [];
    const result = state.results.find(r => r.index === index);
    return result?.flags || [];
  }, [state.results]);

  return {
    ...state,
    validateImages,
    clearValidation,
    isImageFlagged,
    getImageFlags,
  };
}
