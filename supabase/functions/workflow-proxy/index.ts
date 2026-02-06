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
const TEMPORAL_URL = 'https://formanova.ai/api';                                                  // Temporal/DAG gateway
const STANDALONE_URL = 'http://48.214.48.103:8000';                                              // A100 standalone server
const DIRECT_API_URL = 'http://48.214.48.103:8000';                                              // A100 jewelry direct API
const AUTH_SERVICE_URL = 'https://formanova.ai/auth';                                            // Auth service

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
    const endpoint = url.searchParams.get('endpoint') || '/process';
    const mode = url.searchParams.get('mode');
    const BACKEND_URL = getBackendUrl(mode);

    // Health check
    if (endpoint === '/health') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(`${BACKEND_URL}/health`, {
          method: 'GET', headers: { 'Content-Type': 'application/json' },
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
        method: 'GET', headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.text();
      return new Response(data, { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Result fetch
    if (endpoint.startsWith('/result/')) {
      const workflowId = endpoint.replace('/result/', '');
      const response = await fetch(`${BACKEND_URL}/result/${workflowId}`, {
        method: 'GET', headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': contentType },
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
          headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': contentType },
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
          headers: { 'Content-Type': 'application/json' },
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

        console.log('[workflow-proxy] Starting upload_validation workflow...');
        console.log('[workflow-proxy] Image data type:', typeof imageData, imageData ? (typeof imageData === 'object' ? JSON.stringify(Object.keys(imageData)) : String(imageData).substring(0, 100)) : 'null');

        const startResponse = await fetch(`${TEMPORAL_URL}/run/upload_validation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(temporalPayload),
        });

        if (!startResponse.ok) {
          const errorText = await startResponse.text();
          console.error('[workflow-proxy] Failed to start workflow:', startResponse.status, errorText);
          return new Response(
            JSON.stringify({ category: 'unknown', is_worn: true, confidence: 0, flagged: false, _debug: 'workflow_start_failed', _status: startResponse.status }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const startData = await startResponse.json();
        const workflowId = startData.workflow_id;
        console.log('[workflow-proxy] Workflow started:', workflowId);

        // Poll for result
        const pollStart = Date.now();
        let pollCount = 0;
        while (Date.now() - pollStart < 60000) {
          await new Promise(r => setTimeout(r, 1500));
          pollCount++;

          const statusResponse = await fetch(`${TEMPORAL_URL}/status/${workflowId}`, {
            method: 'GET', headers: { 'Content-Type': 'application/json' },
          });

          if (!statusResponse.ok) {
            console.warn(`[workflow-proxy] Poll ${pollCount}: status check failed (${statusResponse.status})`);
            continue;
          }

          const statusData = await statusResponse.json();
          const state = statusData.progress?.state || statusData.state || 'unknown';
          console.log(`[workflow-proxy] Poll ${pollCount}: state=${state}`);

          if (state === 'completed') {
            const resultResponse = await fetch(`${TEMPORAL_URL}/result/${workflowId}`, {
              method: 'GET', headers: { 'Content-Type': 'application/json' },
            });

            if (!resultResponse.ok) {
              const errText = await resultResponse.text();
              console.error('[workflow-proxy] Failed to fetch result:', resultResponse.status, errText);
              return new Response(
                JSON.stringify({ category: 'unknown', is_worn: true, confidence: 0, flagged: false, _debug: 'result_fetch_failed' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            const resultData = await resultResponse.json();
            console.log('[workflow-proxy] Result data keys:', JSON.stringify(Object.keys(resultData)));
            console.log('[workflow-proxy] Full result:', JSON.stringify(resultData).substring(0, 500));

            const classificationResults = resultData.image_classification;
            if (classificationResults && classificationResults.length > 0) {
              const raw = classificationResults[0];
              console.log('[workflow-proxy] Raw classification:', JSON.stringify(raw));

              // Map backend format {label, confidence, reason} → frontend format {category, is_worn, confidence, reason, flagged}
              const WORN_CATEGORIES = ['mannequin', 'model', 'body_part'];
              const category = raw.category || raw.label || 'unknown';
              const is_worn = raw.is_worn !== undefined ? raw.is_worn : WORN_CATEGORIES.includes(category);
              const confidence = raw.confidence || 0;
              const reason = raw.reason || '';
              const flagged = !is_worn;

              const mapped = { category, is_worn, confidence, reason, flagged };
              console.log('[workflow-proxy] Mapped result:', JSON.stringify(mapped));
              return new Response(
                JSON.stringify(mapped),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            console.warn('[workflow-proxy] No image_classification in result. Keys:', JSON.stringify(Object.keys(resultData)));
            return new Response(
              JSON.stringify({ category: 'unknown', is_worn: true, confidence: 0, flagged: false, _debug: 'no_classification_in_result', _resultKeys: Object.keys(resultData) }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (state === 'failed') {
            console.error('[workflow-proxy] Workflow failed:', JSON.stringify(statusData));
            return new Response(
              JSON.stringify({ category: 'unknown', is_worn: true, confidence: 0, flagged: false, _debug: 'workflow_failed', _details: statusData.error || statusData.progress?.error }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        console.warn('[workflow-proxy] Workflow timed out after 60s, polls:', pollCount);
        return new Response(
          JSON.stringify({ category: 'unknown', is_worn: true, confidence: 0, flagged: false, _debug: 'timeout' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (e) {
        console.error('[workflow-proxy] Upload validation error:', e instanceof Error ? e.message : e);
        return new Response(
          JSON.stringify({ category: 'unknown', is_worn: true, confidence: 0, flagged: false, _debug: 'exception', _error: e instanceof Error ? e.message : 'unknown' }),
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
