import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://formanova.ai',
  'https://www.formanova.ai',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

// ═══════════════════════════════════════════════════════════════
// SERVICE URLs — Edit these directly when endpoints change
// ═══════════════════════════════════════════════════════════════
const A100_URL = 'http://48.214.48.103:8000';                                                   // A100 jewelry generation server
const AUTH_SERVICE_URL = 'https://interastral-joie-untough.ngrok-free.dev';                      // Auth service (ngrok → 20.157.122.64:8002)

const JEWELRY_TYPE_MAP: Record<string, string> = {
  'rings': 'ring', 'bracelets': 'bracelet', 'earrings': 'earring',
  'necklaces': 'necklace', 'watches': 'watch',
  'ring': 'ring', 'bracelet': 'bracelet', 'earring': 'earring',
  'necklace': 'necklace', 'watch': 'watch',
};

async function authenticateRequest(req: Request, corsHeaders: Record<string, string>): Promise<{ userId: string } | { error: Response }> {
  const userToken = req.headers.get('X-User-Token');
  if (!userToken) {
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized - missing X-User-Token header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    };
  }

  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });

    if (!response.ok) {
      return {
        error: new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      };
    }

    const user = await response.json();
    return { userId: user.id || user.email || 'authenticated' };
  } catch (e) {
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized - auth service unavailable' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    };
  }
}

// Maximum payload size: 20MB
const MAX_PAYLOAD_SIZE = 20 * 1024 * 1024;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
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

  const auth = await authenticateRequest(req, corsHeaders);
  if ('error' in auth) return auth.error;

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint');

    if (endpoint === '/health') {
      const response = await fetch(`${A100_URL}/health`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      const data = await response.text();
      return new Response(data, { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (endpoint === '/generate' && req.method === 'POST') {
      const body = await req.json();
      const singularType = JEWELRY_TYPE_MAP[(body.jewelry_type || 'necklace').toLowerCase()] || 'necklace';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const response = await fetch(`${A100_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, jewelry_type: singularType }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({ error: `Generation failed: ${errorText}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.text();
      return new Response(data, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ error: `Unknown endpoint: ${endpoint}` }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Proxy error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
