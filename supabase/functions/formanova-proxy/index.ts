// Formanova CAD proxy – secures API key server-side
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL_MAP: Record<string, string> = {
  gemini: "gemini",
  "claude-sonnet": "claude-sonnet-4.6",
  "claude-opus": "opus-4.6",
};

const FORMANOVA_BASE = "https://formanova.ai/api";

// ── SAS Token Generation ──

async function generateSasUrl(azureUri: string): Promise<string | null> {
  const accountName = Deno.env.get("AZURE_ACCOUNT_NAME");
  const accountKey = Deno.env.get("AZURE_ACCOUNT_KEY");
  if (!accountName || !accountKey) {
    console.error("[formanova-proxy] Missing AZURE_ACCOUNT_NAME or AZURE_ACCOUNT_KEY");
    return null;
  }

  const path = azureUri.replace("azure://", "");
  const slashIndex = path.indexOf("/");
  if (slashIndex === -1) return null;

  const containerName = path.substring(0, slashIndex);
  const blobName = path.substring(slashIndex + 1);

  const now = new Date();
  const expiry = new Date(now.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const st = fmt(now);
  const se = fmt(expiry);

  const stringToSign = [
    "r", st, se,
    `/blob/${accountName}/${containerName}/${blobName}`,
    "", "", "https", "2020-10-02", "b",
    "", "", "", "", "", "",
  ].join("\n");

  const keyData = Uint8Array.from(atob(accountKey), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(stringToSign));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));

  const qs = new URLSearchParams({ sv: "2020-10-02", st, se, sr: "b", sp: "r", spr: "https", sig: sigB64 });
  const url = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${qs.toString()}`;
  console.log(`[formanova-proxy] Resolved: ${containerName}/${blobName}`);
  return url;
}

// ── Helpers ──

function findAzureUri(obj: unknown, nodeKey?: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  if (nodeKey && nodeKey in rec) {
    const found = findAzureUri(rec[nodeKey]);
    if (found) return found;
  }
  for (const val of Object.values(rec)) {
    if (typeof val === "string" && val.startsWith("azure://")) return val;
    if (val && typeof val === "object") {
      const found = findAzureUri(val);
      if (found) return found;
    }
  }
  return null;
}

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
    const record = obj as Record<string, unknown>;
    for (const val of Object.values(record)) {
      const found = findGlbUrl(val);
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
      if (progressPct >= 100 && data.results) {
        const validateUri = findAzureUri(data.results, "ring-validate");
        const generateUri = findAzureUri(data.results, "ring-generate");
        const azureUri = validateUri || generateUri;

        if (azureUri) {
          glbUrl = await generateSasUrl(azureUri);
          console.log(`[formanova-proxy] Resolved GLB from status: ${azureUri} -> ${glbUrl ? "OK" : "FAILED"}`);
        }
        if (glbUrl) {
          data.glb_url = glbUrl;
          data.azure_source = validateUri ? "ring-validate" : "ring-generate";
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

      // Extract azure:// URIs — prefer ring-validate, fallback to ring-generate
      const validateUri = findAzureUri(data, "ring-validate");
      const generateUri = findAzureUri(data, "ring-generate");
      const azureUri = validateUri || generateUri;

      let glbUrl: string | null = null;

      if (azureUri) {
        glbUrl = await generateSasUrl(azureUri);
      } else {
        glbUrl = findGlbUrl(data);
      }

      const source = validateUri ? "ring-validate" : generateUri ? "ring-generate" : null;

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
