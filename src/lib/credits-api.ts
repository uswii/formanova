// Credits API client — relative paths only

import { authenticatedFetch } from '@/lib/authenticated-fetch';

export const TOOL_COSTS: Record<string, number> = {
  from_photo: 3,
  cad_generation: 5,
  qa_with_gpu: 3,
  ring_full_pipeline: 5,
};

export interface CreditBalance {
  balance: number;
  reserved_balance?: number;
  available?: number;
}

/**
 * Single source of truth for credit balance.
 * Calls GET /credits/balance/me with JWT auth.
 * Throws AuthExpiredError on 401 (handled by authenticatedFetch).
 */
export async function fetchBalance(): Promise<CreditBalance> {
  const response = await authenticatedFetch('/api/credits/balance/me');

  if (!response.ok) {
    throw new Error('Failed to fetch credits');
  }

  return await response.json();
}

// Keep backward-compat alias
export const getUserCredits = fetchBalance;

export async function startCheckout(tierName: string): Promise<string> {
  const response = await authenticatedFetch('/billing/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: tierName }),
  });

  if (!response.ok) {
    throw new Error('Checkout session creation failed');
  }

  const { url } = await response.json();
  if (!url) throw new Error('No checkout URL received');
  return url;
}
