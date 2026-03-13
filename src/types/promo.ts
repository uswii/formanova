export interface PromoCode {
  id: string;
  tenant_id: string;
  code: string;
  credits_awarded: number;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
  per_user_limit: number;
  campaign_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePromoCodePayload {
  code: string;
  credits_awarded: number;
  max_redemptions?: number;
  starts_at?: string;
  expires_at?: string;
  campaign_name?: string;
  notes?: string;
  per_user_limit: 1;
}

export interface UpdatePromoCodePayload {
  is_active?: boolean;
  expires_at?: string;
  max_redemptions?: number;
  campaign_name?: string;
  notes?: string;
}
