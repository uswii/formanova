// Credits API client - routes through edge function proxy

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const CREDITS_PROXY_URL = `${SUPABASE_URL}/functions/v1/credits-proxy`;

import { getStoredToken } from '@/lib/auth-api';

export const TOOL_COSTS: Record<string, number> = {
  from_photo: 3,
  cad_generation: 5,
};

export interface CreditBalance {
  balance: number;
}

export async function getUserCredits(userId: string): Promise<CreditBalance> {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${CREDITS_PROXY_URL}/credits/balance/${userId}`, {
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

export async function startCheckout(tierName: string, userId: string): Promise<string> {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${CREDITS_PROXY_URL}/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      tier: tierName,
      user_id: userId,
    }),
  });

  if (!response.ok) {
    throw new Error('Checkout session creation failed');
  }

  const { url } = await response.json();
  if (!url) throw new Error('No checkout URL received');
  return url;
}
