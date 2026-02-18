import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const AUTH_SERVICE_URL = Deno.env.get("AUTH_SERVICE_URL") || "https://formanova.ai/auth";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Strip the edge function prefix to get the path
    const pathParts = url.pathname.split("/credits-proxy");
    const targetPath = pathParts.length > 1 ? pathParts[1] : "/";

    // Forward auth token
    const userToken = req.headers.get("x-user-token") || req.headers.get("authorization")?.replace("Bearer ", "");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (userToken) {
      headers["Authorization"] = `Bearer ${userToken}`;
    }

    // Build target URL - credits service is on the same backend
    const targetUrl = `${AUTH_SERVICE_URL}${targetPath}${url.search}`;
    console.log(`[credits-proxy] ${req.method} ${targetPath} -> ${targetUrl}`);

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method === "POST" || req.method === "PUT") {
      fetchOptions.body = await req.text();
    }

    const response = await fetch(targetUrl, fetchOptions);
    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("[credits-proxy] Error:", error);
    return new Response(
      JSON.stringify({ error: "Credits proxy error", detail: String(error) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
