import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[blob-proxy] Fetching: ${url.substring(0, 120)}`);

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[blob-proxy] Upstream error: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ error: `Upstream fetch failed (${response.status})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`[blob-proxy] Success, size: ${arrayBuffer.byteLength} bytes`);

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "model/gltf-binary",
        "Content-Length": String(arrayBuffer.byteLength),
      },
    });
  } catch (err) {
    console.error("[blob-proxy] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
