// Formanova CAD proxy – secures API key server-side
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL_MAP: Record<string, string> = {
  gemini: "gemini",
  "claude-sonnet": "claude-sonnet",
  "claude-opus": "claude-opus",
};

const FORMANOVA_BASE = "https://formanova.ai/api";

// ── Public Artifact URL ──
// Artifacts in agentic-artifacts are public — no SAS needed
const AZURE_BLOB_HOST = "https://snapwear.blob.core.windows.net";

function azureUriToPublicUrl(azureUri: string): string | null {
  if (!azureUri.startsWith("azure://")) return null;
  const path = azureUri.replace("azure://", "");
  if (!path.includes("/")) return null;
  const url = `${AZURE_BLOB_HOST}/${path}`;
  console.log(`[formanova-proxy] Resolved public URL: ${url}`);
  return url;
}

// ── Helpers ──

/**
 * Extract the azure:// URI from a node's glb_path.uri structure.
 * Expected shape: results["ring-validate"] = [{ glb_path: { uri: "azure://..." } }]
 */
function extractGlbUri(results: Record<string, unknown>, nodeKey: string): string | null {
  const node = results[nodeKey];
  if (!node) return null;
  // node is an array — take first element
  const arr = Array.isArray(node) ? node : [node];
  for (const entry of arr) {
    const rec = entry as Record<string, unknown> | null;
    if (!rec) continue;
    const glbPath = rec.glb_path as Record<string, unknown> | undefined;
    if (glbPath && typeof glbPath.uri === "string" && glbPath.uri.startsWith("azure://")) {
      return glbPath.uri;
    }
  }
  return null;
}

/** Legacy fallback: recursively find any azure:// URI */
function findAzureUri(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  for (const val of Object.values(obj as Record<string, unknown>)) {
    if (typeof val === "string" && val.startsWith("azure://")) return val;
    if (val && typeof val === "object") {
      const found = findAzureUri(val);
      if (found) return found;
    }
  }
  return null;
}

// ── Main Handler ──

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
    const action = url.searchParams.get("action");

    // ── RUN ──
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

      console.log(`[formanova-proxy] Starting pipeline: model=${model} -> llm=${llmName}, prompt="${prompt.substring(0, 50)}..."`);

      const formanovaRes = await fetch(`${FORMANOVA_BASE}/run/ring_full_pipeline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "X-On-Behalf-Of": "nimra-dev",
        },
        body: JSON.stringify({
          payload: { prompt, llm_name: llmName, max_retries: 3 },
          return_nodes: ["ring-generate", "ring-validate"],
        }),
      });

      const rawText = await formanovaRes.text();
      console.log(`[formanova-proxy] Formanova response status: ${formanovaRes.status}`);
      console.log(`[formanova-proxy] Formanova response body: ${rawText.substring(0, 500)}`);

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(rawText);
      } catch {
        return new Response(
          JSON.stringify({ error: `Formanova returned non-JSON (status ${formanovaRes.status})`, raw: rawText.substring(0, 200) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!formanovaRes.ok) {
        const detail = (data as any).message || (data as any).error || (data as any).detail || rawText.substring(0, 200);
        console.error(`[formanova-proxy] Formanova API error: ${detail}`);
        return new Response(
          JSON.stringify({ error: `Formanova API error (${formanovaRes.status}): ${detail}`, details: data }),
          { status: formanovaRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STATUS ──
    if (action === "status" && req.method === "POST") {
      const body = await req.json();
      const { status_url } = body as { status_url: string };

      if (!status_url) {
        return new Response(
          JSON.stringify({ error: "status_url is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fullUrl = status_url.startsWith("http")
        ? status_url
        : `${FORMANOVA_BASE}${status_url.startsWith("/") ? "" : "/"}${status_url}`;

      console.log(`[formanova-proxy] Polling status: ${fullUrl}`);

      const statusRes = await fetch(fullUrl, {
        method: "GET",
        headers: { "X-API-Key": apiKey },
      });

      const rawStatus = await statusRes.text();
      console.log(`[formanova-proxy] Status response (${statusRes.status}): ${rawStatus.substring(0, 500)}`);

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(rawStatus);
      } catch {
        return new Response(
          JSON.stringify({ error: `Status returned non-JSON`, raw: rawStatus.substring(0, 200) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Normalize progress ──
      // The API returns progress as an OBJECT: {completed_nodes, total_nodes, state, visited}
      // Frontend expects a top-level numeric `progress` (0-100) and string `status`
      const progressObj = data.progress as Record<string, unknown> | undefined;
      let progressPct = 0;
      let normalizedStatus = String(data.status || "running").toLowerCase();

      if (progressObj && typeof progressObj === "object") {
        const completed = Number(progressObj.completed_nodes ?? 0);
        const total = Number(progressObj.total_nodes ?? 1);
        const state = String(progressObj.state || "running").toLowerCase();
        normalizedStatus = state;

        if (state === "completed" || state === "done") {
          progressPct = 100;
        } else if (total > 0) {
          progressPct = Math.round((completed / total) * 100);
        }

        data.steps_completed = completed;
        data.steps_total = total;
        console.log(`[formanova-proxy] Progress: ${completed}/${total} = ${progressPct}%, state=${state}`);
      } else if (typeof data.progress === "number") {
        progressPct = data.progress as number;
      } else {
        const s = String(data.status || "").toLowerCase();
        if (s === "completed" || s === "done") progressPct = 100;
      }

      // Overwrite with normalized values
      data.progress = progressPct;
      data.status = normalizedStatus;

      // ── If completed, extract GLB URL from inline results ──
      let glbUrl: string | null = null;
      let source: string | null = null;
      if (progressPct >= 100 && data.results) {
        const results = data.results as Record<string, unknown>;
        const validateUri = extractGlbUri(results, "ring-validate");
        const generateUri = extractGlbUri(results, "ring-generate");
        const azureUri = validateUri || generateUri;
        source = validateUri ? "ring-validate" : generateUri ? "ring-generate" : null;

        if (azureUri) {
          glbUrl = azureUriToPublicUrl(azureUri);
        }
        // Fallback: try legacy recursive search
        if (!glbUrl) {
          const fallbackUri = findAzureUri(data.results);
          if (fallbackUri) glbUrl = azureUriToPublicUrl(fallbackUri);
        }
        if (glbUrl) {
          data.glb_url = glbUrl;
          data.azure_source = source;
        }
      }

      return new Response(JSON.stringify(data), {
        status: statusRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RESULT ──
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

      console.log(`[formanova-proxy] Fetching result: ${fullUrl}`);

      const resultRes = await fetch(fullUrl, {
        method: "GET",
        headers: { "X-API-Key": apiKey },
      });

      const rawResult = await resultRes.text();
      console.log(`[formanova-proxy] Result response (${resultRes.status}), length=${rawResult.length}`);
      console.log(`[formanova-proxy] Result preview: ${rawResult.substring(0, 500)}`);

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(rawResult);
      } catch {
        return new Response(
          JSON.stringify({ error: `Result returned non-JSON`, raw: rawResult.substring(0, 200) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!resultRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch result", details: data }),
          { status: resultRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract GLB URI — prefer ring-validate, fallback to ring-generate
      const validateUri = extractGlbUri(data, "ring-validate");
      const generateUri = extractGlbUri(data, "ring-generate");
      const azureUri = validateUri || generateUri;
      const source = validateUri ? "ring-validate" : generateUri ? "ring-generate" : null;

      let glbUrl: string | null = null;
      if (azureUri) {
        glbUrl = azureUriToPublicUrl(azureUri);
      }
      // Fallback: legacy recursive search
      if (!glbUrl) {
        const fallbackUri = findAzureUri(data);
        if (fallbackUri) glbUrl = azureUriToPublicUrl(fallbackUri);
      }

      return new Response(
        JSON.stringify({ ...data, glb_url: glbUrl, azure_source: source }),
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
