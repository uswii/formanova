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

    const { prompt, model, mode, source_code, current_code, original_glb_artifact, original_screenshots } = await req.json();
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("Formanova_auth_key");
    const baseUrl = Deno.env.get("FORMANOVA_BASE_URL") || "https://formanova.ai/api";

    if (!apiKey) {
      console.error("[generate-ring] Formanova_auth_key not configured");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Map frontend model IDs to backend LLM identifiers
    const LLM_MAP: Record<string, string> = {
      "gemini": "gemini",
      "claude-sonnet": "claude-sonnet-4-6",
      "claude-opus": "claude-opus",
    };
    const llm = LLM_MAP[model] || "gemini";
    const generationMode = mode || "generate";

    console.log(`[generate-ring] User ${auth.userId} starting ring ${generationMode} with llm=${llm}`);

    // Build payload — edit mode includes previous generation artifacts
    const payload: Record<string, unknown> = {
      llm,
      mode: generationMode,
      user_prompt: prompt.trim(),
      max_attempts: 3,
    };

    if (generationMode === "edit") {
      if (source_code) payload.source_code = source_code;
      if (current_code) payload.current_code = current_code;
      if (original_glb_artifact) payload.original_glb_artifact = original_glb_artifact;
      if (original_screenshots) payload.original_screenshots = original_screenshots;
    }

    const res = await fetch(`${baseUrl}/run/ring_generate_v1`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "X-On-Behalf-Of": auth.userId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[generate-ring] Backend error:", res.status, errText);
      return new Response(JSON.stringify({ error: `Backend error (${res.status})` }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await res.json();
    console.log(`[generate-ring] Workflow started: ${result.workflow_id}`);
    return new Response(JSON.stringify({
      workflow_id: result.workflow_id,
      result_url: result.result_url || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-ring] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
