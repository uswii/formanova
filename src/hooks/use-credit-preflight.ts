// Hook for credit preflight validation with modal UI
// Wraps performCreditPreflight and manages insufficient credits modal state

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { performCreditPreflight, type PreflightResult } from '@/lib/credit-preflight';

export interface UseCreditPreflightReturn {
  /** Run preflight check. Returns true if approved, false if blocked. Throws on auth errors. */
  checkCredits: (workflowName: string, numVariations?: number) => Promise<boolean>;
  /** Whether the insufficient credits modal should be shown */
  showInsufficientModal: boolean;
  /** Close the modal */
  dismissModal: () => void;
  /** Last preflight result (for rendering modal content) */
  preflightResult: PreflightResult | null;
  /** Whether a preflight check is currently in progress */
  checking: boolean;
}

export function useCreditPreflight(): UseCreditPreflightReturn {
  const navigate = useNavigate();
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [checking, setChecking] = useState(false);

  const checkCredits = useCallback(async (workflowName: string, numVariations: number = 1): Promise<boolean> => {
    setChecking(true);
    try {
      const result = await performCreditPreflight(workflowName, numVariations);
      setPreflightResult(result);

      if (!result.approved) {
        setShowInsufficientModal(true);
        return false;
      }

      return true;
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_EXPIRED') {
        const currentPath = window.location.pathname + window.location.search;
        navigate(`/login?redirect=${encodeURIComponent(currentPath)}`, { replace: true });
        return false;
      }
      throw error;
    } finally {
      setChecking(false);
    }
  }, [navigate]);

  const dismissModal = useCallback(() => {
    setShowInsufficientModal(false);
  }, []);

  return {
    checkCredits,
    showInsufficientModal,
    dismissModal,
    preflightResult,
    checking,
  };
}
