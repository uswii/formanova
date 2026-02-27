// Credit Preflight Validation
// Mandatory estimation + balance check before any generation workflow

import { getStoredToken } from '@/lib/auth-api';

const API_GATEWAY_URL = 'https://formanova.ai/api';

export interface PreflightResult {
  approved: boolean;
  estimatedCredits: number;
  currentBalance: number;
}

/**
 * Mandatory credit preflight check.
 * 1. Estimates the cost via POST /api/credits/estimate
 * 2. Fetches current balance via GET /api/credits/balance
 * 3. Compares and returns approval status
 *
 * Throws on network/auth errors. Returns { approved: false } when balance is insufficient.
 */
export async function performCreditPreflight(
  workflowName: string,
  numVariations: number = 1
): Promise<PreflightResult> {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated');

  // 1️⃣ Estimate required credits
  const estimateRes = await fetch(`${API_GATEWAY_URL}/credits/estimate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflow_name: workflowName,
      num_variations: numVariations,
    }),
  });

  if (estimateRes.status === 401) {
    throw new Error('AUTH_EXPIRED');
  }
  if (!estimateRes.ok) {
    throw new Error(`Credit estimation failed (${estimateRes.status})`);
  }

  const { estimated_credits } = await estimateRes.json();

  // 2️⃣ Fetch current balance
  const balanceRes = await fetch(`${API_GATEWAY_URL}/credits/balance`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (balanceRes.status === 401) {
    throw new Error('AUTH_EXPIRED');
  }
  if (!balanceRes.ok) {
    throw new Error(`Balance fetch failed (${balanceRes.status})`);
  }

  const { balance } = await balanceRes.json();

  // 3️⃣ Compare
  return {
    approved: balance >= estimated_credits,
    estimatedCredits: estimated_credits,
    currentBalance: balance,
  };
}
