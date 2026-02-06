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
const IMAGE_UTILS_URL = 'http://20.157.122.64:8001';                                              // Image Utils (classification, etc.)
const AUTH_SERVICE_URL = 'https://formanova.ai/auth';                                            // Auth service
const TEMPORAL_API_KEY = Deno.env.get('ADMIN_SECRET') || '';                                     // API key for Temporal gateway

function getTemporalHeaders(userId?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (TEMPORAL_API_KEY) {
    headers['X-API-Key'] = TEMPORAL_API_KEY;
  }
  if (userId) {
    headers['X-On-Behalf-Of'] = userId;
  }
  return headers;
}

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
    console.log('[workflow-proxy] Authenticated user:', user.email || user.id);
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
        method: 'GET', headers: getTemporalHeaders(auth.userId),
      });
      const data = await response.text();
      return new Response(data, { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Result fetch
    if (endpoint.startsWith('/result/')) {
      const workflowId = endpoint.replace('/result/', '');
      const response = await fetch(`${BACKEND_URL}/result/${workflowId}`, {
        method: 'GET', headers: getTemporalHeaders(auth.userId),
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
          headers: getTemporalHeaders(auth.userId),
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

        // ── Try Temporal workflow first ──
        let temporalSuccess = false;
        let classificationResult: Record<string, unknown> | null = null;

        try {
          const temporalPayload = { payload: { original_path: imageData } };
          console.log('[workflow-proxy] Starting image_classification workflow...');

          const startResponse = await fetch(`${TEMPORAL_URL}/run/image_classification`, {
            method: 'POST',
            headers: getTemporalHeaders(auth.userId),
            body: JSON.stringify(temporalPayload),
          });

          if (startResponse.ok) {
            const startData = await startResponse.json();
            const workflowId = startData.workflow_id;
            console.log('[workflow-proxy] Workflow started:', workflowId);

            const pollStart = Date.now();
            let pollCount = 0;
            while (Date.now() - pollStart < 30000) {
              await new Promise(r => setTimeout(r, 1500));
              pollCount++;

              const statusResponse = await fetch(`${TEMPORAL_URL}/status/${workflowId}`, {
                method: 'GET', headers: getTemporalHeaders(auth.userId),
              });

              if (!statusResponse.ok) continue;

              const statusData = await statusResponse.json();
              const state = statusData.progress?.state || statusData.state || 'unknown';
              console.log(`[workflow-proxy] Poll ${pollCount}: state=${state}`);

              if (state === 'completed') {
                const resultResponse = await fetch(`${TEMPORAL_URL}/result/${workflowId}`, {
                  method: 'GET', headers: getTemporalHeaders(auth.userId),
                });

                if (resultResponse.ok) {
                  const resultData = await resultResponse.json();
                  const classificationResults = resultData.image_classification;
                  if (classificationResults && classificationResults.length > 0) {
                    const raw = classificationResults[0];
                    const WORN_CATEGORIES = ['mannequin', 'model', 'body_part'];
                    const category = raw.category || raw.label || 'unknown';
                    // Derive is_worn: check explicit field, then reason field, then category list
                    const reason = raw.reason || '';
                    const is_worn = raw.is_worn !== undefined
                      ? raw.is_worn
                      : reason === 'worn' ? true
                      : reason === 'not_worn' ? false
                      : WORN_CATEGORIES.includes(category);
                    classificationResult = { category, is_worn, confidence: raw.confidence || 0, reason, flagged: !is_worn };
                    temporalSuccess = true;
                  }
                }
                break;
              }

              if (state === 'failed') {
                console.warn('[workflow-proxy] Temporal workflow failed, will try direct fallback');
                break;
              }
            }
          } else {
            console.warn('[workflow-proxy] Failed to start Temporal workflow:', startResponse.status);
          }
        } catch (e) {
          console.warn('[workflow-proxy] Temporal workflow error, falling back to direct call:', e instanceof Error ? e.message : e);
        }

        if (temporalSuccess && classificationResult) {
          console.log('[workflow-proxy] Temporal classification succeeded:', JSON.stringify(classificationResult));
          return new Response(JSON.stringify(classificationResult), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // ── Fallback: call /tools/image_classification/run directly ──
        console.log('[workflow-proxy] Falling back to direct /tools/image_classification/run...');
        try {
          let imageObj = imageData;
          if (typeof imageObj === 'string') {
            const base64Data = imageObj.includes(',') ? imageObj.split(',')[1] : imageObj;
            imageObj = { base64: base64Data };
          }

          const directPayload = {
            data: {
              operation: 'image_captioning',
              image: imageObj,
              prompt: 'Analyze this jewelry image. Classify it into one of: mannequin, model, body_part, flatlay, 3d_render, product_surface, floating, packshot. Respond with JSON: {"label": "category", "confidence": 0.95, "reason": "brief explanation"}',
              is_classification: true,
              allowed_categories: ['mannequin', 'model', 'body_part', 'flatlay', '3d_render', 'product_surface', 'floating', 'packshot'],
            },
          };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const directResponse = await fetch(`${IMAGE_UTILS_URL}/tools/image_classification/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(directPayload),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (directResponse.ok) {
            const directData = await directResponse.json();
            console.log('[workflow-proxy] Direct classification result:', JSON.stringify(directData).substring(0, 500));

            // Parse result — could be in directData directly or nested
            const raw = directData.result || directData.data || directData;
            const WORN_CATEGORIES = ['mannequin', 'model', 'body_part'];
            const category = raw.category || raw.label || 'unknown';
            // Derive is_worn: check explicit field, then reason field, then category list
            const reason = raw.reason || '';
            const is_worn = raw.is_worn !== undefined
              ? raw.is_worn
              : reason === 'worn' ? true
              : reason === 'not_worn' ? false
              : WORN_CATEGORIES.includes(category);
            const mapped = { category, is_worn, confidence: raw.confidence || 0, reason, flagged: !is_worn, _source: 'direct' };

            console.log('[workflow-proxy] Direct mapped result:', JSON.stringify(mapped));
            return new Response(JSON.stringify(mapped), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } else {
            const errText = await directResponse.text();
            console.error('[workflow-proxy] Direct classification failed:', directResponse.status, errText);
          }
        } catch (directErr) {
          console.error('[workflow-proxy] Direct classification error:', directErr instanceof Error ? directErr.message : directErr);
        }

        // ── Both failed — return permissive fallback ──
        console.warn('[workflow-proxy] Both Temporal and direct classification failed, returning permissive fallback');
        return new Response(
          JSON.stringify({ category: 'unknown', is_worn: true, confidence: 0, flagged: false, _debug: 'both_failed' }),
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
