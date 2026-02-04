import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://formanova.lovable.app',
  'https://id-preview--d0dca58e-2556-4f62-b433-dc23617837ac.lovable.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
];

// Auth service for token validation
const AUTH_SERVICE_URL = Deno.env.get('AUTH_SERVICE_URL') || 'http://20.157.122.64:8002';

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

// Authentication helper - validates token against custom FastAPI auth service
// Uses X-User-Token header (consistent with other edge functions)
async function authenticateRequest(req: Request): Promise<{ userId: string } | { error: Response }> {
  const corsHeaders = getCorsHeaders(req);
  const userToken = req.headers.get('X-User-Token');
  if (!userToken) {
    console.log('[azure-get-sas] Auth failed: missing X-User-Token header');
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized - missing X-User-Token header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    };
  }

  try {
    // Validate token against custom auth service
    const response = await fetch(`${AUTH_SERVICE_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });

    if (!response.ok) {
      console.log('[azure-get-sas] Auth failed: token validation returned', response.status);
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
    console.log('[azure-get-sas] Auth service error:', e);
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized - auth service unavailable' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    };
  }
}

// Generate SAS token for blob access
async function generateSasToken(
  accountName: string,
  accountKey: string,
  containerName: string,
  blobName: string,
  expiryMinutes: number = 60
): Promise<string> {
  const now = new Date();
  const expiry = new Date(now.getTime() + expiryMinutes * 60 * 1000);
  
  // Format dates for SAS
  const formatDate = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const startTime = formatDate(now);
  const expiryTime = formatDate(expiry);
  
  // SAS parameters
  const signedPermissions = 'r'; // read only
  const signedResourceType = 'b'; // blob
  const signedProtocol = 'https';
  const signedVersion = '2020-10-02';
  
  // String to sign for blob SAS
  const stringToSign = [
    signedPermissions,
    startTime,
    expiryTime,
    `/blob/${accountName}/${containerName}/${blobName}`,
    '', // signed identifier
    '', // signed IP
    signedProtocol,
    signedVersion,
    signedResourceType,
    '', // snapshot time
    '', // encryption scope
    '', // cache control
    '', // content disposition
    '', // content encoding
    '', // content language
    '', // content type
  ].join('\n');

  // Create HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const keyData = Uint8Array.from(atob(accountKey), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  // Build SAS query string
  const sasParams = new URLSearchParams({
    sv: signedVersion,
    st: startTime,
    se: expiryTime,
    sr: signedResourceType,
    sp: signedPermissions,
    spr: signedProtocol,
    sig: signatureBase64,
  });

  return sasParams.toString();
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate request
  const auth = await authenticateRequest(req);
  if ('error' in auth) {
    return auth.error;
  }
  console.log(`[azure-get-sas] Authenticated user: ${auth.userId}`);

  try {
    const AZURE_ACCOUNT_NAME = Deno.env.get('AZURE_ACCOUNT_NAME');
    const AZURE_ACCOUNT_KEY = Deno.env.get('AZURE_ACCOUNT_KEY');

    if (!AZURE_ACCOUNT_NAME || !AZURE_ACCOUNT_KEY) {
      console.error('Missing Azure configuration');
      return new Response(
        JSON.stringify({ error: 'Azure configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { azure_uri } = await req.json();

    if (!azure_uri || !azure_uri.startsWith('azure://')) {
      return new Response(
        JSON.stringify({ error: 'azure_uri is required and must start with azure://' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse azure://container/blob format
    const path = azure_uri.replace('azure://', '');
    const slashIndex = path.indexOf('/');
    if (slashIndex === -1) {
      return new Response(
        JSON.stringify({ error: 'Invalid azure_uri format. Expected: azure://container/blob' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const containerName = path.substring(0, slashIndex);
    const blobName = path.substring(slashIndex + 1);

    console.log(`Generating SAS URL for: ${containerName}/${blobName}`);

    // Generate SAS token (valid for 60 minutes)
    const sasToken = await generateSasToken(
      AZURE_ACCOUNT_NAME,
      AZURE_ACCOUNT_KEY,
      containerName,
      blobName,
      60
    );

    // Build the full SAS URL (don't encode the blob name as it may contain path segments)
    const httpsUrl = `https://${AZURE_ACCOUNT_NAME}.blob.core.windows.net/${containerName}/${blobName}`;
    const sasUrl = `${httpsUrl}?${sasToken}`;
    
    console.log(`Generated SAS URL: ${httpsUrl}`);

    return new Response(
      JSON.stringify({ 
        sas_url: sasUrl,
        expires_in_minutes: 60
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Azure get-sas error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
