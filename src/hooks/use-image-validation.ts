import { useState, useCallback } from 'react';
import { getStoredToken } from '@/lib/auth-api';
import { compressImageBlob } from '@/lib/image-compression';

const TEMPORAL_API = '/api';
const WORN_CATEGORIES = ['mannequin', 'model', 'body_part'];

// Response from the classification service
export interface ClassificationResult {
  category: 'mannequin' | 'model' | 'body_part' | 'flatlay' | '3d_render' | 'product_surface' | 'floating' | 'packshot';
  is_worn: boolean;
  confidence: number;
  reason: string;
  flagged: boolean;
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
  const headers: Record<string, string> = {};
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
 * Convert a data URI to a Blob
 */
function dataUriToBlob(dataUri: string): Blob {
  const commaIdx = dataUri.indexOf(',');
  const meta = dataUri.substring(0, commaIdx);
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const b64 = dataUri.substring(commaIdx + 1);
  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/**
 * Hook for validating uploaded jewelry images.
 * Calls the Temporal API directly with JWT auth — no edge function proxy.
 */
export function useImageValidation() {
  const [state, setState] = useState<ValidationState>({
    isValidating: false,
    results: null,
    flaggedCount: 0,
    error: null,
  });

  /**
   * Convert File to a compressed data URI string.
   */
  const fileToDataUri = useCallback(async (file: File): Promise<string> => {
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
   * 1. POST multipart to /process (image_classification workflow)
   * 2. Poll /status/{id} until completed
   * 3. Extract result from status.results.image_captioning[0]
   */
  const classifyImage = useCallback(async (
    dataUri: string
  ): Promise<ClassificationResult | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      console.log('[ImageValidation] Starting classification via direct API...');
      const authHeaders = getAuthHeaders();

      // 1. Convert data URI to multipart form
      const imageBlob = dataUriToBlob(dataUri);
      const ext = imageBlob.type.split('/')[1] || 'jpg';
      const formData = new FormData();
      formData.append('file', imageBlob, `image.${ext}`);
      formData.append('workflow_name', 'image_classification');
      formData.append('num_variations', '1');

      // 2. POST to /process
      const startRes = await fetch(`${TEMPORAL_API}/process`, {
        method: 'POST',
        headers: authHeaders, // no Content-Type — browser sets multipart boundary
        body: formData,
        signal: controller.signal,
      });

      if (!startRes.ok) {
        console.warn('[ImageValidation] /process failed:', startRes.status);
        clearTimeout(timeoutId);
        return null;
      }

      const startData = await startRes.json();
      const workflowId = startData.workflow_id;
      console.log('[ImageValidation] Workflow started:', workflowId);

      // 3. Poll /status/{id} (up to 80s, 2s intervals)
      const pollStart = Date.now();
      let pollCount = 0;
      while (Date.now() - pollStart < 80000) {
        await new Promise(r => setTimeout(r, 2000));
        pollCount++;

        const statusRes = await fetch(`${TEMPORAL_API}/status/${workflowId}`, {
          method: 'GET',
          headers: authHeaders,
          signal: controller.signal,
        });

        if (!statusRes.ok) {
          console.warn(`[ImageValidation] Poll ${pollCount}: status failed (${statusRes.status})`);
          continue;
        }

        const statusData = await statusRes.json();
        const state = statusData.progress?.state || statusData.state || 'unknown';
        console.log(`[ImageValidation] Poll ${pollCount}: state=${state}`);

        if (state === 'completed') {
          const classificationResults = statusData.results?.image_captioning;
          if (classificationResults && classificationResults.length > 0) {
            const raw = classificationResults[0];
            const category = raw.category || raw.label || 'unknown';
            const reason = raw.reason || '';
            const is_worn = raw.is_worn !== undefined
              ? raw.is_worn
              : reason === 'worn' ? true
              : reason === 'not_worn' ? false
              : WORN_CATEGORIES.includes(category);

            clearTimeout(timeoutId);
            return {
              category,
              is_worn,
              confidence: raw.confidence || 0,
              reason,
              flagged: !is_worn,
            };
          }
          console.warn('[ImageValidation] Completed but no results');
          break;
        }

        if (state === 'failed') {
          console.error('[ImageValidation] Workflow failed:', JSON.stringify(statusData));
          break;
        }
      }

      clearTimeout(timeoutId);
      return null;
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
      const dataUris = await Promise.all(files.map(fileToDataUri));
      const classificationResults = await Promise.all(
        dataUris.map(uri => classifyImage(uri))
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
  }, [fileToDataUri, classifyImage]);

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
