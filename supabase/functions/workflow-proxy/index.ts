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
const TEMPORAL_URL = (Deno.env.get('TEMPORAL_API_URL') || '').replace(/\/+$/, '');
const STANDALONE_URL = (Deno.env.get('A100_STANDALONE_URL') || '').replace(/\/+$/, '');
const DIRECT_API_URL = (Deno.env.get('A100_JEWELRY_URL') || '').replace(/\/+$/, '');
const AUTH_SERVICE_URL = Deno.env.get('AUTH_SERVICE_URL');

const tunnelHeaders = {
  'Bypass-Tunnel-Reminder': 'true',
  'ngrok-skip-browser-warning': 'true',
};

function getBackendUrl(mode: string | null): string {
  if (mode === 'temporal') return TEMPORAL_URL;
  return STANDALONE_URL;
}

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
      headers: { 'Authorization': `Bearer ${userToken}`, 'ngrok-skip-browser-warning': 'true' },
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
    const endpoint = url.searchParams.get('endpoint') || '/process';
    const mode = url.searchParams.get('mode');
    const BACKEND_URL = getBackendUrl(mode);

    // Health check
    if (endpoint === '/health') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(`${BACKEND_URL}/health`, {
          method: 'GET', headers: { 'Content-Type': 'application/json', ...tunnelHeaders },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await response.text();
        return new Response(data, { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        clearTimeout(timeoutId);
        return new Response(JSON.stringify({ status: 'offline' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Status check
    if (endpoint.startsWith('/status/')) {
      const workflowId = endpoint.replace('/status/', '');
      const response = await fetch(`${BACKEND_URL}/status/${workflowId}`, {
        method: 'GET', headers: { 'Content-Type': 'application/json', ...tunnelHeaders },
      });
      const data = await response.text();
      return new Response(data, { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Result fetch
    if (endpoint.startsWith('/result/')) {
      const workflowId = endpoint.replace('/result/', '');
      const response = await fetch(`${BACKEND_URL}/result/${workflowId}`, {
        method: 'GET', headers: { 'Content-Type': 'application/json', ...tunnelHeaders },
      });
      const data = await response.text();
      return new Response(data, { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Process workflow
    if (endpoint === '/process' && req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      const body = await req.arrayBuffer();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000);

      try {
        const response = await fetch(`${BACKEND_URL}/process`, {
          method: 'POST',
          headers: { 'Content-Type': contentType, ...tunnelHeaders },
          body: body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          return new Response(
            JSON.stringify({ error: `Workflow failed: ${errorText}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.text();
        return new Response(data, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        clearTimeout(timeoutId);
        if (e instanceof Error && e.name === 'AbortError') {
          return new Response(
            JSON.stringify({ error: 'Workflow timed out after 10 minutes' }),
            { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw e;
      }
    }

    // Agentic masking
    if (endpoint === '/tools/agentic_masking/run' && req.method === 'POST') {
      const body = await req.json();
      let imageObj = body.data?.image;
      if (typeof imageObj === 'string') {
        const base64Data = imageObj.includes(',') ? imageObj.split(',')[1] : imageObj;
        imageObj = { base64: base64Data };
      }
      
      const transformedBody = { data: { ...body.data, image: imageObj } };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      try {
        const response = await fetch(`${STANDALONE_URL}/tools/agentic_masking/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...tunnelHeaders },
          body: JSON.stringify(transformedBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          return new Response(
            JSON.stringify({ error: `Agentic masking failed: ${errorText}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.text();
        return new Response(data, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        clearTimeout(timeoutId);
        if (e instanceof Error && e.name === 'AbortError') {
          return new Response(
            JSON.stringify({ error: 'Agentic masking timed out after 5 minutes' }),
            { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw e;
      }
    }

    // Multipart photoshoot
    if (endpoint === '/tools/agentic_photoshoot/run-multipart' && req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      const body = await req.arrayBuffer();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000);

      try {
        const response = await fetch(`${STANDALONE_URL}/tools/agentic_photoshoot/run-multipart`, {
          method: 'POST',
          headers: { 'Content-Type': contentType, ...tunnelHeaders },
          body: body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          return new Response(
            JSON.stringify({ error: `Multipart photoshoot failed: ${errorText}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.text();
        return new Response(data, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        clearTimeout(timeoutId);
        if (e instanceof Error && e.name === 'AbortError') {
          return new Response(
            JSON.stringify({ error: 'Multipart photoshoot timed out after 10 minutes' }),
            { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw e;
      }
    }

    // Validation API
    if (endpoint.startsWith('/api/validate/') && req.method === 'POST') {
      const body = await req.text();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(`${TEMPORAL_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...tunnelHeaders },
          body: body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return new Response(
            JSON.stringify({ results: [], all_acceptable: true, flagged_count: 0, message: 'Validation service unavailable' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.text();
        return new Response(data, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        clearTimeout(timeoutId);
        return new Response(
          JSON.stringify({ results: [], all_acceptable: true, flagged_count: 0, message: 'Validation error' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Upload validation workflow
    if (endpoint === '/run/upload_validation' && req.method === 'POST') {
      try {
        const body = await req.json();
        const imageData = body.data?.image;
        const temporalPayload = { payload: { original_path: imageData } };

        const startResponse = await fetch(`${TEMPORAL_URL}/run/upload_validation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...tunnelHeaders },
          body: JSON.stringify(temporalPayload),
        });

        if (!startResponse.ok) {
          return new Response(
            JSON.stringify({ category: 'unknown', is_worn: true, confidence: 0, flagged: false }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const startData = await startResponse.json();
        const workflowId = startData.workflow_id;

        // Poll for result
        const pollStart = Date.now();
        while (Date.now() - pollStart < 60000) {
          await new Promise(r => setTimeout(r, 1000));

          const statusResponse = await fetch(`${TEMPORAL_URL}/status/${workflowId}`, {
            method: 'GET', headers: { 'Content-Type': 'application/json', ...tunnelHeaders },
          });

          if (!statusResponse.ok) continue;

          const statusData = await statusResponse.json();

          if (statusData.progress?.state === 'completed') {
            const resultResponse = await fetch(`${TEMPORAL_URL}/result/${workflowId}`, {
              method: 'GET', headers: { 'Content-Type': 'application/json', ...tunnelHeaders },
            });

            if (!resultResponse.ok) {
              return new Response(
                JSON.stringify({ category: 'unknown', is_worn: true, confidence: 0, flagged: false }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            const resultData = await resultResponse.json();
            const classificationResults = resultData.image_classification;
            if (classificationResults && classificationResults.length > 0) {
              return new Response(
                JSON.stringify(classificationResults[0]),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            return new Response(
              JSON.stringify({ category: 'unknown', is_worn: true, confidence: 0, flagged: false }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (statusData.progress?.state === 'failed') {
            return new Response(
              JSON.stringify({ category: 'unknown', is_worn: true, confidence: 0, flagged: false }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ category: 'unknown', is_worn: true, confidence: 0, flagged: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (e) {
        return new Response(
          JSON.stringify({ category: 'unknown', is_worn: true, confidence: 0, flagged: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
