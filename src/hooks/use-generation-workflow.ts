import { useState, useCallback, useRef, useEffect } from 'react';
import { markGenerationStarted, markGenerationCompleted, markGenerationFailed } from '@/lib/generation-lifecycle';
import {
  temporalApi,
  WorkflowStatusResponse,
  WorkflowResult,
  WorkflowError,
  getStepLabel,
  BrushStroke as TemporalBrushStroke,
  MaskPoint,
} from '@/lib/temporal-api';

// Convert from component brush stroke format to Temporal format
interface ComponentBrushStroke {
  type: 'add' | 'remove';
  points: number[][];  // [[x, y], [x, y], ...]
  radius: number;
}

function convertBrushStrokes(
  strokes: ComponentBrushStroke[],
  imageWidth: number,
  imageHeight: number
): TemporalBrushStroke[] {
  return strokes.map(stroke => ({
    points: stroke.points.map(([x, y]) => ({
      x: x / imageWidth,  // Normalize to 0-1
      y: y / imageHeight,
    })),
    mode: stroke.type,
    size: Math.round((stroke.radius / Math.max(imageWidth, imageHeight)) * 100), // Normalize size
  }));
}

export interface GenerationState {
  status: 'idle' | 'running' | 'completed' | 'failed';
  workflowId: string | null;
  progress: number;
  currentStep: string | null;
  stepLabel: string;
  result: WorkflowResult | null;
  error: WorkflowError | null;
}

export interface UseGenerationWorkflowOptions {
  onComplete?: (result: WorkflowResult) => void;
  onError?: (error: WorkflowError | Error) => void;
  onProgress?: (progress: number, step: string) => void;
}

export function useGenerationWorkflow(options: UseGenerationWorkflowOptions = {}) {
  const { onComplete, onError, onProgress } = options;

  const [state, setState] = useState<GenerationState>({
    status: 'idle',
    workflowId: null,
    progress: 0,
    currentStep: null,
    stepLabel: '',
    result: null,
    error: null,
  });

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const workflowIdRef = useRef<string | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const pollStatus = useCallback(async () => {
    if (!workflowIdRef.current) return;

    try {
      const status = await temporalApi.getWorkflowStatus(workflowIdRef.current);

      const stepLabel = getStepLabel(status.currentStep);
      const progress = status.progress ?? 0;

      setState(prev => ({
        ...prev,
        progress,
        currentStep: status.currentStep,
        stepLabel,
      }));

      onProgress?.(progress, stepLabel);

      if (status.status === 'COMPLETED' && status.result) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        setState(prev => ({
          ...prev,
          status: 'completed',
          progress: 100,
          result: status.result,
          stepLabel: 'Complete',
        }));

        if (workflowIdRef.current) markGenerationCompleted(workflowIdRef.current);
        onComplete?.(status.result);
      } else if (status.status === 'FAILED') {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        setState(prev => ({
          ...prev,
          status: 'failed',
          error: status.error,
          stepLabel: 'Failed',
        }));

        if (workflowIdRef.current) markGenerationFailed(workflowIdRef.current, status.error?.message);
        onError?.(status.error || new Error('Workflow failed'));
      } else if (status.status === 'CANCELLED') {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        setState(prev => ({
          ...prev,
          status: 'idle',
          stepLabel: 'Cancelled',
        }));
      }
    } catch (error) {
      console.error('Polling error:', error);
      // Don't stop polling on transient errors
    }
  }, [onComplete, onError, onProgress]);

  const startGeneration = useCallback(async (params: {
    originalImageBase64: string;
    maskPoints: Array<{ x: number; y: number; label: 0 | 1 }>;
    brushStrokes?: ComponentBrushStroke[];
    imageWidth?: number;
    imageHeight?: number;
    gender?: 'female' | 'male';
    sessionId?: string;
  }) => {
    const {
      originalImageBase64,
      maskPoints,
      brushStrokes = [],
      imageWidth = 2000,
      imageHeight = 2667,
      gender = 'female',
      sessionId,
    } = params;

    // Reset state
    setState({
      status: 'running',
      workflowId: null,
      progress: 0,
      currentStep: 'UPLOADING_IMAGE',
      stepLabel: 'Starting...',
      result: null,
      error: null,
    });

    try {
      // Convert brush strokes to Temporal format
      const temporalBrushStrokes = convertBrushStrokes(brushStrokes, imageWidth, imageHeight);

      // Start the workflow
      const { workflowId } = await temporalApi.startWorkflow({
        originalImageBase64,
        maskPoints: maskPoints as MaskPoint[],
        brushStrokes: temporalBrushStrokes.length > 0 ? temporalBrushStrokes : undefined,
        gender,
        sessionId,
      });

      workflowIdRef.current = workflowId;
      markGenerationStarted(workflowId);
      setState(prev => ({ ...prev, workflowId }));

      // Start polling
      pollingRef.current = setInterval(pollStatus, 2000);
      
      // Also poll immediately
      await pollStatus();

      return workflowId;
    } catch (error) {
      console.error('Failed to start generation:', error);
      
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: {
          code: 'WORKFLOW_FAILED',
          message: error instanceof Error ? error.message : 'Failed to start workflow',
          failedStep: 'STARTING',
        },
        stepLabel: 'Failed to start',
      }));

      onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [pollStatus, onError]);

  const cancelGeneration = useCallback(async () => {
    if (!workflowIdRef.current) return;

    try {
      await temporalApi.cancelWorkflow(workflowIdRef.current);
      
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      setState(prev => ({
        ...prev,
        status: 'idle',
        stepLabel: 'Cancelled',
      }));
    } catch (error) {
      console.error('Failed to cancel workflow:', error);
    }
  }, []);

  const reset = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    workflowIdRef.current = null;

    setState({
      status: 'idle',
      workflowId: null,
      progress: 0,
      currentStep: null,
      stepLabel: '',
      result: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    isGenerating: state.status === 'running',
    isComplete: state.status === 'completed',
    isFailed: state.status === 'failed',
    startGeneration,
    cancelGeneration,
    reset,
  };
}
