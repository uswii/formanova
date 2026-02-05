import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

// Authentication helper - validates JWT and returns user ID
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data?.user) {
    console.log('[azure-fetch-image] Auth failed:', error?.message);
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    };
  }

  return { userId: data.user.id };
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
  
  const formatDate = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const startTime = formatDate(now);
  const expiryTime = formatDate(expiry);
  
  const signedPermissions = 'r';
  const signedResourceType = 'b';
  const signedProtocol = 'https';
  const signedVersion = '2020-10-02';
  
  const stringToSign = [
    signedPermissions,
    startTime,
    expiryTime,
    `/blob/${accountName}/${containerName}/${blobName}`,
    '', '', signedProtocol, signedVersion, signedResourceType,
    '', '', '', '', '', '',
  ].join('\n');

  const encoder = new TextEncoder();
  const keyData = Uint8Array.from(atob(accountKey), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const sasParams = new URLSearchParams({
    sv: signedVersion, st: startTime, se: expiryTime,
    sr: signedResourceType, sp: signedPermissions, spr: signedProtocol, sig: signatureBase64,
  });

  return sasParams.toString();
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate request
  const auth = await authenticateRequest(req);
  if ('error' in auth) {
    return auth.error;
  }
  console.log(`[azure-fetch-image] Authenticated user: ${auth.userId}`);

  try {
    const AZURE_ACCOUNT_NAME = Deno.env.get('AZURE_ACCOUNT_NAME');
    const AZURE_ACCOUNT_KEY = Deno.env.get('AZURE_ACCOUNT_KEY');

    if (!AZURE_ACCOUNT_NAME || !AZURE_ACCOUNT_KEY) {
      return new Response(
        JSON.stringify({ error: 'Azure configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { azure_uri } = await req.json();

    if (!azure_uri || !azure_uri.startsWith('azure://')) {
      return new Response(
        JSON.stringify({ error: 'azure_uri is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse azure://container/blob format
    const path = azure_uri.replace('azure://', '');
    const slashIndex = path.indexOf('/');
    const containerName = path.substring(0, slashIndex);
    const blobName = path.substring(slashIndex + 1);

    console.log(`Fetching image: ${containerName}/${blobName}`);

    // Generate SAS and fetch
    const sasToken = await generateSasToken(AZURE_ACCOUNT_NAME, AZURE_ACCOUNT_KEY, containerName, blobName, 60);
    const url = `https://${AZURE_ACCOUNT_NAME}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Azure fetch failed: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ error: `Failed to fetch from Azure: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Convert to base64 in chunks to avoid stack overflow with large images
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);
    
    console.log(`Successfully fetched image (${arrayBuffer.byteLength} bytes)`);

    return new Response(
      JSON.stringify({ base64, content_type: response.headers.get('content-type') || 'image/png' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Azure fetch-image error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
