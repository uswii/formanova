// Credit Preflight Validation
// Mandatory estimation + balance check before any generation workflow

import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { TOOL_COSTS } from '@/lib/credits-api';

export interface PreflightResult {
  approved: boolean;
  estimatedCredits: number;
  currentBalance: number;
}

/**
 * Mandatory credit preflight check.
 * 1. Tries POST /credits/estimate for server-side cost — falls back to TOOL_COSTS
 * 2. Fetches current balance via GET /credits/balance/me
 * 3. Compares and returns approval status
 *
 * AuthExpiredError is thrown automatically by authenticatedFetch on 401.
 */
export async function performCreditPreflight(
  workflowName: string,
  numVariations: number = 1
): Promise<PreflightResult> {
  // 1️⃣ Estimate required credits — try server, fall back to client-side constant
  let estimatedCredits = TOOL_COSTS[workflowName] ?? 5;

  try {
    const estimateRes = await authenticatedFetch('/api/credits/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_name: workflowName,
        num_variations: numVariations,
      }),
    });

    if (estimateRes.ok) {
      const data = await estimateRes.json();
      if (data.estimated_credits && data.estimated_credits > 0) {
        estimatedCredits = data.estimated_credits;
      }
    }
  } catch {
    // Estimate endpoint failed — use client-side fallback, continue to balance check
  }

  // 2️⃣ Fetch current balance
  const balanceRes = await authenticatedFetch('/api/credits/balance/me');

  if (!balanceRes.ok) {
    throw new Error(`Balance fetch failed (${balanceRes.status})`);
  }

  const { balance } = await balanceRes.json();

  // 3️⃣ Compare
  return {
    approved: balance >= estimatedCredits,
    estimatedCredits,
    currentBalance: balance,
  };
}
