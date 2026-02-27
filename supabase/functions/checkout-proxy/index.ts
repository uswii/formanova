import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BILLING_URL = "https://formanova.ai/billing/checkout";
const AUTH_URL = Deno.env.get("AUTH_SERVICE_URL") || "https://formanova.ai/auth";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Verify JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // 2. Resolve authenticated user via /users/me
    const meRes = await fetch(`${AUTH_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!meRes.ok) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = await meRes.json();
    const username = user.email;
    if (!username) {
      return new Response(JSON.stringify({ error: "Could not resolve user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Read server-only API key
    const billingApiKey = Deno.env.get("BILLING_API_KEY");
    if (!billingApiKey) {
      console.error("[checkout-proxy] BILLING_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Parse frontend body
    const body = await req.json();
    const { tier_id, return_to } = body;
    if (!tier_id) {
      return new Response(JSON.stringify({ error: "tier_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build forwarded body
    const forwardBody: Record<string, string> = { tier_id };
    if (return_to) forwardBody.return_to = return_to;

    // 5. Forward to Billing Gateway
    console.log(`[checkout-proxy] Creating checkout for ${username}, tier=${tier_id}`);
    const billingRes = await fetch(BILLING_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": billingApiKey,
        "X-On-Behalf-Of": username,
      },
      body: JSON.stringify(forwardBody),
    });

    const billingBody = await billingRes.text();

    // 6. Return billing response as-is
    return new Response(billingBody, {
      status: billingRes.status,
      headers: {
        ...corsHeaders,
        "Content-Type": billingRes.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("[checkout-proxy] Error:", error);
    return new Response(
      JSON.stringify({ error: "Checkout proxy error" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
