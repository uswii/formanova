import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Auth service URL from environment
const AUTH_SERVICE_URL = Deno.env.get('AUTH_SERVICE_URL') || 'https://interastral-joie-untough.ngrok-free.dev';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://formanova.lovable.app',
  'https://id-preview--d0dca58e-2556-4f62-b433-dc23617837ac.lovable.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
  'http://localhost:8010',
  'http://20.157.122.64:8010',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/auth-proxy', '');
    const queryString = url.search;
    
    const targetUrl = `${AUTH_SERVICE_URL}${path}${queryString}`;
    console.log(`[auth-proxy] Proxying: ${req.method} ${path}${queryString}`);

    // Special handling for Google OAuth authorize - follow redirects and return the final URL
    if (path === '/auth/google/authorize') {
      console.log('[auth-proxy] Handling Google OAuth authorize...');
      
      // Follow redirects manually to get the Google OAuth URL
      const response = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'manual', // Don't auto-follow redirects
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      
      console.log(`[auth-proxy] OAuth response status: ${response.status}`);
      
      // Check for redirect (302, 303, 307)
      if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get('Location');
        console.log(`[auth-proxy] Redirect URL: ${redirectUrl}`);
        
        if (redirectUrl) {
          // Return the redirect URL as JSON so frontend can redirect
          return new Response(
            JSON.stringify({ redirect_url: redirectUrl }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
      
      // If not a redirect, return the response as-is
      const responseText = await response.text();
      return new Response(responseText, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Forward the request to auth service - preserve original content type
    const contentType = req.headers.get('Content-Type') || 'application/json';
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': contentType,
      'ngrok-skip-browser-warning': 'true',
    };

    // Forward authorization header if present
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    console.log(`[auth-proxy] Content-Type: ${contentType}`);

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Forward body for POST/PUT requests
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await req.text();
      console.log(`[auth-proxy] Body length: ${body.length}`);
      if (body) {
        fetchOptions.body = body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    const responseText = await response.text();
    
    console.log(`[auth-proxy] Response status: ${response.status}`);

    // Try to parse as JSON, otherwise return as text
    let responseBody: string;
    try {
      JSON.parse(responseText);
      responseBody = responseText;
    } catch {
      responseBody = JSON.stringify({ message: responseText });
    }

    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    console.error('[auth-proxy] Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
