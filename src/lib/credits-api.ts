// Credits API client - calls API gateway directly

const API_GATEWAY_URL = 'https://formanova.ai/api';

import { getStoredToken, authApi } from '@/lib/auth-api';

export const TOOL_COSTS: Record<string, number> = {
  from_photo: 3,
  cad_generation: 5,
};

export interface CreditBalance {
  balance: number;
  reserved_balance: number;
  available: number;
}

// Cache the internal user ID to avoid repeated /users/me calls
let cachedInternalUserId: string | null = null;

async function resolveInternalUserId(): Promise<string> {
  if (cachedInternalUserId) return cachedInternalUserId;

  const user = await authApi.getCurrentUser();
  if (!user?.id) throw new Error('Could not resolve internal user ID');

  cachedInternalUserId = user.id;
  return cachedInternalUserId;
}

// Clear cache on logout
export function clearInternalUserIdCache(): void {
  cachedInternalUserId = null;
}

export async function getUserCredits(): Promise<CreditBalance> {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const internalId = await resolveInternalUserId();

  const response = await fetch(`${API_GATEWAY_URL}/credits/balance/${internalId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch credits');
  }

  return await response.json();
}

export async function startCheckout(tierName: string): Promise<string> {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const internalId = await resolveInternalUserId();

  const response = await fetch(`${API_GATEWAY_URL}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      tier: tierName,
      user_id: internalId,
    }),
  });

  if (!response.ok) {
    throw new Error('Checkout session creation failed');
  }

  const { url } = await response.json();
  if (!url) throw new Error('No checkout URL received');
  return url;
}
