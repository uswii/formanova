// Live credit estimate hook — calls POST /api/credits/estimate
// whenever workflow_name, model, or numVariations changes.

import { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { TOOL_COSTS } from '@/lib/credits-api';

interface UseEstimatedCostOptions {
  workflowName: string;
  model?: string;
  numVariations?: number;
}

interface EstimatedCostState {
  cost: number | null;
  loading: boolean;
}

/**
 * Fetches `projected_max_hold` from the backend estimate endpoint
 * every time inputs change. Falls back to client-side TOOL_COSTS
 * only if the fetch fails.
 */
export function useEstimatedCost({
  workflowName,
  model,
  numVariations = 1,
}: UseEstimatedCostOptions): EstimatedCostState {
  const [cost, setCost] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Abort previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const API_BASE = import.meta.env.DEV ? 'https://formanova.ai/api' : '/api';
        const res = await authenticatedFetch(`${API_BASE}/credits/estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow_name: workflowName,
            num_variations: numVariations,
            ...(model ? { pricing_context: { llm: model } } : {}),
          }),
          signal: controller.signal,
        });

        if (cancelled) return;

        if (res.ok) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            const serverCost = data.projected_max_hold ?? data.estimated_credits;
          if (serverCost && serverCost > 0) {
            setCost(serverCost);
            setLoading(false);
            return;
          }
          } catch { /* non-JSON — fall through */ }
        }
      } catch {
        // Network error or aborted — fall through to fallback
      }

      if (cancelled) return;

      // Fallback to client-side constants
      const fallbackKey = model ? `${workflowName}:${model}` : workflowName;
      setCost(TOOL_COSTS[fallbackKey] ?? TOOL_COSTS[workflowName] ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [workflowName, model, numVariations]);

  return { cost, loading };
}
