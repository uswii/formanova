import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL_MAP: Record<string, string> = {
  gemini: "gemini",
  "claude-sonnet": "claude-sonnet-4.6",
};

const FORMANOVA_BASE = "https://formanova.ai/api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("Formanova_auth_key");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Formanova API key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action"); // "run" | "status" | "result"

    // ── RUN: Start the ring pipeline ──
    if (action === "run" && req.method === "POST") {
      const body = await req.json();
      const { prompt, model } = body as { prompt: string; model: string };

      if (!prompt?.trim()) {
        return new Response(
          JSON.stringify({ error: "Prompt is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const llmName = MODEL_MAP[model] || "gemini";

      const formanovaRes = await fetch(`${FORMANOVA_BASE}/run/ring_full_pipeline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "X-On-Behalf-Of": "nimra-dev",
        },
        body: JSON.stringify({
          payload: {
            prompt,
            llm_name: llmName,
            max_retries: 3,
          },
          return_nodes: ["ring-generate", "ring-validate"],
        }),
      });

      const data = await formanovaRes.json();

      if (!formanovaRes.ok) {
        return new Response(
          JSON.stringify({ error: "Formanova API error", details: data }),
          { status: formanovaRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Return workflow_id, status_url, result_url, projected_cost
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STATUS: Poll workflow progress ──
    if (action === "status" && req.method === "POST") {
      const body = await req.json();
      const { status_url } = body as { status_url: string };

      if (!status_url) {
        return new Response(
          JSON.stringify({ error: "status_url is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Ensure URL is on our domain
      const fullUrl = status_url.startsWith("http")
        ? status_url
        : `${FORMANOVA_BASE}${status_url.startsWith("/") ? "" : "/"}${status_url}`;

      const statusRes = await fetch(fullUrl, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      const data = await statusRes.json();
      return new Response(JSON.stringify(data), {
        status: statusRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RESULT: Fetch final result and extract GLB URL ──
    if (action === "result" && req.method === "POST") {
      const body = await req.json();
      const { result_url } = body as { result_url: string };

      if (!result_url) {
        return new Response(
          JSON.stringify({ error: "result_url is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fullUrl = result_url.startsWith("http")
        ? result_url
        : `${FORMANOVA_BASE}${result_url.startsWith("/") ? "" : "/"}${result_url}`;

      const resultRes = await fetch(fullUrl, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      const data = await resultRes.json();

      if (!resultRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch result", details: data }),
          { status: resultRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract GLB URL from the result payload
      // The result JSON can be nested; search for azure artifact URL ending in .glb
      const glbUrl = findGlbUrl(data);

      return new Response(
        JSON.stringify({ ...data, glb_url: glbUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use ?action=run|status|result" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("formanova-proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Recursively search JSON for a URL ending in .glb
 * Handles Azure blob URLs and nested result structures
 */
function findGlbUrl(obj: unknown): string | null {
  if (typeof obj === "string") {
    if (obj.endsWith(".glb") || obj.includes(".glb")) return obj;
    return null;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findGlbUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (obj && typeof obj === "object") {
    // Prioritize keys that likely contain the artifact URL
    const priorityKeys = ["artifact_url", "artifact_uri", "glb_url", "model_url", "output_url", "url", "file_url", "blob_url"];
    const record = obj as Record<string, unknown>;
    for (const key of priorityKeys) {
      if (key in record) {
        const found = findGlbUrl(record[key]);
        if (found) return found;
      }
    }
    for (const [key, val] of Object.entries(record)) {
      if (!priorityKeys.includes(key)) {
        const found = findGlbUrl(val);
        if (found) return found;
      }
    }
  }
  return null;
}
