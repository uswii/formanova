import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// A100 Standalone Server (api_server.py) - direct FastAPI endpoints
// This is the unified API handling all jewelry types: necklace, ring, bracelet, earring, watch
const A100_BASE_URL = (Deno.env.get("A100_STANDALONE_URL") || "http://48.214.48.103:8000").replace(/\/+$/, '');
// Auth service for token validation
const AUTH_SERVICE_URL = Deno.env.get('AUTH_SERVICE_URL') || 'http://20.157.122.64:8002';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://formanova.lovable.app',
  'https://id-preview--d0dca58e-2556-4f62-b433-dc23617837ac.lovable.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

// Authentication helper - validates token against custom FastAPI auth service
async function authenticateRequest(req: Request): Promise<{ userId: string } | { error: Response }> {
  const corsHeaders = getCorsHeaders(req);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized - missing or invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    };
  }

  try {
    // Validate token against custom auth service
    const response = await fetch(`${AUTH_SERVICE_URL}/users/me`, {
      headers: { 'Authorization': authHeader },
    });

    if (!response.ok) {
      console.log('[a100-proxy] Auth failed: token validation returned', response.status);
      return {
        error: new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      };
    }

    const user = await response.json();
    return { userId: user.id || user.email || 'authenticated' };
  } catch (e) {
    console.log('[a100-proxy] Auth service error:', e);
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized - auth service unavailable' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    };
  }
}

// Maximum payload size: 20MB
const MAX_PAYLOAD_SIZE = 20 * 1024 * 1024;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check payload size before processing
  const contentLength = parseInt(req.headers.get('content-length') || '0');
  if (contentLength > MAX_PAYLOAD_SIZE) {
    return new Response(
      JSON.stringify({ error: 'Payload too large. Maximum size is 20MB.' }),
      { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Authenticate request
  const auth = await authenticateRequest(req);
  if ('error' in auth) {
    return auth.error;
  }
  console.log(`[a100-proxy] Authenticated user: ${auth.userId}`);

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");
    
    if (!endpoint) {
      return new Response(JSON.stringify({ error: "Missing endpoint parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const a100Url = `${A100_BASE_URL}${endpoint}`;
    
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    // Forward body for POST requests
    if (req.method === "POST") {
      const body = await req.text();
      fetchOptions.body = body;
      
      // Log jewelry_type for segment requests
      if (endpoint === '/segment') {
        try {
          const parsed = JSON.parse(body);
          console.log(`[segment] jewelry_type: ${parsed.jewelry_type || 'necklace (default)'}, points: ${parsed.points?.length || 0}`);
        } catch (e) {}
      }
    }

    console.log(`Proxying ${req.method} to ${a100Url}`);
    
    const response = await fetch(a100Url, fetchOptions);
    const data = await response.text();
    
    // Log response for debugging (truncated for large responses)
    if (endpoint === '/segment' || endpoint === '/generate') {
      try {
        const parsed = JSON.parse(data);
        console.log(`Response from ${endpoint}:`, {
          keys: Object.keys(parsed),
          hasScaledPoints: 'scaled_points' in parsed,
          scaledPointsLength: parsed.scaled_points?.length,
          hasMetrics: 'metrics' in parsed,
          hasFidelityViz: 'fidelity_viz_base64' in parsed,
        });
      } catch (e) {
        console.log(`Response from ${endpoint}: (not JSON)`);
      }
    }
    
    return new Response(data, {
      status: response.status,
      headers: { 
        ...corsHeaders, 
        "Content-Type": response.headers.get("Content-Type") || "application/json" 
      },
    });
  } catch (error) {
    console.error("A100 proxy error:", error);
    return new Response(JSON.stringify({ 
      error: "A100 server unavailable",
      details: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
