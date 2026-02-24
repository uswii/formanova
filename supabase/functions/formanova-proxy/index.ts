import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL_MAP: Record<string, string> = {
  gemini: "gemini",
  "claude-sonnet": "claude-sonnet",
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

      const data = await formanovaRes.json();

      if (!formanovaRes.ok) {
        return new Response(
          JSON.stringify({ error: "Formanova API error", details: data }),
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

      const statusRes = await fetch(fullUrl, {
        method: "GET",
        headers: { "X-API-Key": apiKey },
      });

      const data = await statusRes.json();
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

      const resultRes = await fetch(fullUrl, {
        method: "GET",
        headers: { "X-API-Key": apiKey },
      });

      const data = await resultRes.json();

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
