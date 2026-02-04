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

// Auth service for token validation
const AUTH_SERVICE_URL = Deno.env.get('AUTH_SERVICE_URL') || 'http://20.157.122.64:8002';

// Authentication helper - validates token against custom FastAPI auth service
// Uses X-User-Token header (not Authorization, which Supabase intercepts)
async function authenticateRequest(req: Request): Promise<{ userId: string } | { error: Response }> {
  const corsHeaders = getCorsHeaders(req);
  const userToken = req.headers.get('X-User-Token');
  if (!userToken) {
    console.log('[azure-upload] Auth failed: missing X-User-Token header');
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
      console.log('[azure-upload] Auth failed: token validation returned', response.status);
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
    console.log('[azure-upload] Auth service error:', e);
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

// Maximum payload size: 20MB (images up to ~15MB base64 encoded)
const MAX_PAYLOAD_SIZE = 20 * 1024 * 1024;
// Maximum decoded image size: 15MB
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
// Allowed content types
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
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

  // Authenticate request
  const auth = await authenticateRequest(req);
  if ('error' in auth) {
    return auth.error;
  }
  console.log(`[azure-upload] Authenticated user: ${auth.userId}`);

  try {
    const AZURE_ACCOUNT_NAME = Deno.env.get('AZURE_ACCOUNT_NAME');
    const AZURE_ACCOUNT_KEY = Deno.env.get('AZURE_ACCOUNT_KEY');
    // Azure container names must be lowercase
    const AZURE_CONTAINER_NAME = Deno.env.get('AZURE_CONTAINER_NAME')?.toLowerCase();

    console.log('Azure config:', { 
      account: AZURE_ACCOUNT_NAME, 
      container: AZURE_CONTAINER_NAME,
      hasKey: !!AZURE_ACCOUNT_KEY 
    });

    if (!AZURE_ACCOUNT_NAME || !AZURE_ACCOUNT_KEY || !AZURE_CONTAINER_NAME) {
      console.error('Missing Azure configuration');
      return new Response(
        JSON.stringify({ error: 'Azure configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { base64, filename, content_type } = await req.json();

    if (!base64) {
      return new Response(
        JSON.stringify({ error: 'base64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate content type
    const normalizedContentType = (content_type || 'image/jpeg').toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(normalizedContentType)) {
      return new Response(
        JSON.stringify({ error: `Invalid content type. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate filename if provided (prevent path traversal)
    if (filename && (filename.includes('..') || filename.includes('/') || filename.includes('\\'))) {
      return new Response(
        JSON.stringify({ error: 'Invalid filename. Path separators and parent references are not allowed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strip data URI prefix if present (e.g., "data:image/jpeg;base64,")
    let cleanBase64 = base64;
    if (base64.includes(',')) {
      cleanBase64 = base64.split(',')[1];
    }

    // Generate unique blob name with user ID prefix for organization
    // Use crypto.randomUUID() for cryptographically secure random values
    const timestamp = Date.now();
    const random = crypto.randomUUID();
    const extension = content_type?.includes('png') ? 'png' : 'jpg';
    const blobName = filename || `${auth.userId}/${timestamp}_${random}.${extension}`;

    // Decode base64 to binary
    const binaryData = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));

    // Validate decoded image size
    if (binaryData.length > MAX_IMAGE_SIZE) {
      return new Response(
        JSON.stringify({ error: `Image too large. Maximum decoded size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Azure Blob Storage REST API - URL encode the blob name for the request
    const encodedBlobName = encodeURIComponent(blobName);
    const url = `https://${AZURE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${encodedBlobName}`;
    const dateStr = new Date().toUTCString();
    const blobType = 'BlockBlob';
    const contentLength = binaryData.length;
    const blobContentType = content_type || 'image/jpeg';

    // Create signature for Azure authentication
    const stringToSign = [
      'PUT',
      '', // Content-Encoding
      '', // Content-Language
      contentLength.toString(), // Content-Length
      '', // Content-MD5
      blobContentType, // Content-Type
      '', // Date
      '', // If-Modified-Since
      '', // If-Match
      '', // If-None-Match
      '', // If-Unmodified-Since
      '', // Range
      // CanonicalizedHeaders
      `x-ms-blob-type:${blobType}`,
      `x-ms-date:${dateStr}`,
      `x-ms-version:2020-10-02`,
      // CanonicalizedResource
      `/${AZURE_ACCOUNT_NAME}/${AZURE_CONTAINER_NAME}/${blobName}`,
    ].join('\n');

    // Create HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const keyData = Uint8Array.from(atob(AZURE_ACCOUNT_KEY), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
    const authHeader = `SharedKey ${AZURE_ACCOUNT_NAME}:${signatureBase64}`;

    console.log(`Uploading to Azure: ${blobName} (${contentLength} bytes)`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'x-ms-date': dateStr,
        'x-ms-version': '2020-10-02',
        'x-ms-blob-type': blobType,
        'Content-Type': blobContentType,
        'Content-Length': contentLength.toString(),
      },
      body: binaryData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure upload failed:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Azure upload failed', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate SAS token for the uploaded blob (valid for 60 minutes)
    const sasToken = await generateSasToken(
      AZURE_ACCOUNT_NAME,
      AZURE_ACCOUNT_KEY,
      AZURE_CONTAINER_NAME,
      blobName,
      60
    );
    
    // Create SAS URL for private blob access
    const sasUrl = `${url}?${sasToken}`;

    // Return azure:// format as primary (microservices expect this format and have their own Azure creds)
    // Also include SAS URL for direct browser/client access to private blobs
    const azureUri = `azure://${AZURE_CONTAINER_NAME}/${blobName}`;
    console.log(`Upload successful: ${azureUri}`);

    return new Response(
      JSON.stringify({ 
        uri: azureUri,  // Primary: azure:// format for microservices
        sas_url: sasUrl,  // SAS URL for direct client access to private blobs
        https_url: url  // Plain HTTPS URL (won't work for private containers without SAS)
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Azure upload error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
