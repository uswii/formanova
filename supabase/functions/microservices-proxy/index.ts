import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

// All URLs from environment (no fallbacks - must be configured)
const IMAGE_MANIPULATOR_URL = Deno.env.get('IMAGE_MANIPULATOR_URL');
const BIREFNET_URL = Deno.env.get('BIREFNET_URL');
const SAM3_URL = Deno.env.get('SAM3_URL');
const AUTH_SERVICE_URL = Deno.env.get('AUTH_SERVICE_URL');

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

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'endpoint query parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let targetUrl: string;
    let targetBody: string | undefined;
    const targetHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

    if (endpoint === '/resize') {
      targetUrl = `${IMAGE_MANIPULATOR_URL}/resize`;
      if (req.method === 'POST') targetBody = await req.text();
    } else if (endpoint === '/zoom-check') {
      targetUrl = `${IMAGE_MANIPULATOR_URL}/zoom_check`;
      if (req.method === 'POST') targetBody = await req.text();
    } else if (endpoint === '/birefnet/jobs') {
      targetUrl = `${BIREFNET_URL}/jobs`;
      if (req.method === 'POST') targetBody = await req.text();
    } else if (endpoint.startsWith('/birefnet/jobs/')) {
      targetUrl = `${BIREFNET_URL}/jobs/${endpoint.replace('/birefnet/jobs/', '')}`;
    } else if (endpoint === '/sam3/jobs') {
      targetUrl = `${SAM3_URL}/jobs`;
      if (req.method === 'POST') targetBody = await req.text();
    } else if (endpoint.startsWith('/sam3/jobs/')) {
      targetUrl = `${SAM3_URL}/jobs/${endpoint.replace('/sam3/jobs/', '')}`;
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown endpoint: ${endpoint}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fetchOptions: RequestInit = { method: req.method, headers: targetHeaders };
    if (targetBody && (req.method === 'POST' || req.method === 'PUT')) {
      fetchOptions.body = targetBody;
    }

    const response = await fetch(targetUrl, fetchOptions);
    const responseData = await response.text();

    return new Response(responseData, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Proxy error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
