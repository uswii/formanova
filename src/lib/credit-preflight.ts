// Credit Preflight Validation
// Mandatory estimation + balance check before any generation workflow

import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { TOOL_COSTS } from '@/lib/credits-api';

const API_BASE = import.meta.env.DEV ? 'https://formanova.ai/api' : '/api';

export interface PreflightResult {
  approved: boolean;
  estimatedCredits: number;
  currentBalance: number;
}

/**
 * Mandatory credit preflight check.
 * 1. Estimates cost via POST /credits/estimate → reads projected_max_hold
 * 2. Fetches current balance via GET /credits/balance/me → reads available (or balance)
 * 3. Compares and returns approval status
 */
export async function performCreditPreflight(
  workflowName: string,
  numVariations: number = 1,
  metadata?: { model?: string }
): Promise<PreflightResult> {
  // 1️⃣ Estimate required credits — use model-specific fallback if available
  const fallbackKey = metadata?.model
    ? `${workflowName}:${metadata.model}`
    : workflowName;
  let estimatedCredits = TOOL_COSTS[fallbackKey] ?? TOOL_COSTS[workflowName] ?? 5;

  try {
    const estimateRes = await authenticatedFetch(`${API_BASE}/credits/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_name: workflowName,
        num_variations: numVariations,
        ...(metadata?.model ? { pricing_context: { llm: metadata.model } } : {}),
      }),
    });

    if (estimateRes.ok) {
      const text = await estimateRes.text();
      try {
        const data = JSON.parse(text);
        const serverCost = data.projected_max_hold ?? data.estimated_credits;
        if (serverCost && serverCost > 0) {
          estimatedCredits = serverCost;
        }
      } catch {
        // Non-JSON response (HTML error page) — use fallback
      }
    }
  } catch {
    // Estimate failed — use client-side fallback
  }

  // 2️⃣ Fetch current balance
  const balanceRes = await authenticatedFetch(`${API_BASE}/credits/balance/me`);

  if (!balanceRes.ok) {
    throw new Error(`Balance fetch failed (${balanceRes.status})`);
  }

  const balanceText = await balanceRes.text();
  let balanceData: any;
  try {
    balanceData = JSON.parse(balanceText);
  } catch {
    throw new Error('Balance response was not valid JSON');
  }
  // Use "available" (balance minus reserved holds), fall back to "balance"
  const currentBalance = balanceData.available ?? balanceData.balance ?? 0;

  // 3️⃣ Compare
  return {
    approved: currentBalance >= estimatedCredits,
    estimatedCredits,
    currentBalance,
  };
}
