import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user with anon client
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Promo code is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Find promo code
    const { data: promo, error: promoError } = await adminClient
      .from("promo_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("active", true)
      .single();

    if (promoError || !promo) {
      return new Response(JSON.stringify({ error: "invalid", message: "This promo code is invalid. Please check and try again." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "expired", message: "This promo code has expired." }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check max uses
    if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
      return new Response(JSON.stringify({ error: "exhausted", message: "This promo code has reached its usage limit." }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already redeemed
    const { data: existing } = await adminClient
      .from("promo_redemptions")
      .select("id")
      .eq("promo_code_id", promo.id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ error: "already_redeemed", message: "You have already redeemed this promo code." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Credit the user via the auth service (same pattern as top-up)
    const authServiceUrl = Deno.env.get("AUTH_SERVICE_URL") || "https://formanova.ai/auth";
    const creditResponse = await fetch(`${authServiceUrl}/api/credits/admin/topup`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("ADMIN_API_KEY") || serviceKey}`,
      },
      body: JSON.stringify({ 
        external_id: user.id, 
        amount: promo.credits,
        reason: `Promo code: ${promo.code}`,
      }),
    });

    if (!creditResponse.ok) {
      console.error("[redeem-promo] Credit top-up failed:", await creditResponse.text());
      return new Response(JSON.stringify({ error: "credit_failed", message: "Failed to add credits. Please try again." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record redemption
    await adminClient.from("promo_redemptions").insert({
      promo_code_id: promo.id,
      user_id: user.id,
      credits_awarded: promo.credits,
    });

    // Increment usage count
    await adminClient
      .from("promo_codes")
      .update({ current_uses: promo.current_uses + 1 })
      .eq("id", promo.id);

    return new Response(JSON.stringify({ 
      success: true, 
      credits_awarded: promo.credits,
      message: `${promo.credits} credits have been added to your account!`,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[redeem-promo] Error:", error);
    return new Response(JSON.stringify({ error: "server_error", message: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
