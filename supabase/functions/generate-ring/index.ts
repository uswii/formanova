import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AUTH_SERVICE_URL = "https://formanova.ai/auth";

async function authenticateUser(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { await res.text(); return null; }
    const user = await res.json();
    return { userId: user.id || user.email };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await authenticateUser(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { prompt, model } = await req.json();
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("Formanova_auth_key");
    const baseUrl = Deno.env.get("FORMANOVA_BASE_URL") || "https://formanova.ai/api";

    if (!apiKey) {
      console.error("[generate-ring] Formanova_auth_key not configured");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const llm = model === "claude-sonnet" ? "claude-sonnet" : model === "claude-opus" ? "claude-opus" : "gemini";

    console.log(`[generate-ring] User ${auth.userId} starting ring generation with llm=${llm}`);

    const res = await fetch(`${baseUrl}/run/ring_generate_v1`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "X-On-Behalf-Of": auth.userId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: { llm, prompt: prompt.trim(), max_attempts: 3 },
        return_nodes: [
          "build_initial", "build_retry", "build_corrected",
          "validate_output", "success_final", "success_original_glb", "failed_final",
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[generate-ring] Backend error:", res.status, errText);
      return new Response(JSON.stringify({ error: `Backend error (${res.status})` }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await res.json();
    console.log(`[generate-ring] Workflow started: ${result.workflow_id}`);
    return new Response(JSON.stringify({ workflow_id: result.workflow_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-ring] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
