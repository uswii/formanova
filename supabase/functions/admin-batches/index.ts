import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

// ═══════════════════════════════════════════════════════════════
// CONFIG — Edit these directly when needed
// ═══════════════════════════════════════════════════════════════
const ADMIN_SECRET = 'formanova-admin-2024';  // Admin access key

// Simple approach: append SAS token using account key
async function generateSasUrl(blobUrl: string, accountName: string, accountKey: string): Promise<string> {
  if (!blobUrl || !accountName || !accountKey) return blobUrl;
  
  try {
    // Parse the blob URL to get container and path
    const url = new URL(blobUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return blobUrl;
    
    const containerName = pathParts[0];
    const blobPath = pathParts.slice(1).join('/');
    
    // Generate SAS parameters
    const expiryTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const expiryStr = expiryTime.toISOString().split('.')[0] + 'Z';
    const startTime = new Date(Date.now() - 5 * 60 * 1000);
    const startStr = startTime.toISOString().split('.')[0] + 'Z';
    
    const permissions = 'r';
    const resource = 'b';
    const version = '2021-06-08';
    
    // Canonical resource
    const canonicalResource = `/blob/${accountName}/${containerName}/${blobPath}`;
    
    // String to sign (Service SAS for blob)
    const stringToSign = [
      permissions,      // sp
      startStr,         // st
      expiryStr,        // se
      canonicalResource,
      '',               // si (signed identifier)
      '',               // sip
      '',               // spr (protocol)
      version,          // sv
      resource,         // sr
      '',               // snapshot time
      '',               // encryption scope
      '',               // rscc
      '',               // rscd
      '',               // rsce
      '',               // rscl
      '',               // rsct
    ].join('\n');
    
    // Create HMAC-SHA256 signature
    const keyBytes = Uint8Array.from(atob(accountKey), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
    const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
    
    // Build SAS query string
    const sasParams = new URLSearchParams({
      sv: version,
      st: startStr,
      se: expiryStr,
      sr: resource,
      sp: permissions,
      sig: sig,
    });
    
    return `${blobUrl}?${sasParams.toString()}`;
  } catch (err) {
    console.error('[SAS generation error]', err);
    return blobUrl;
  }
}

// Add SAS tokens to all Azure URLs in image records
async function addSasToImages(images: any[], accountName: string, accountKey: string): Promise<any[]> {
  return Promise.all(images.map(async (img) => ({
    ...img,
    original_url: img.original_url ? await generateSasUrl(img.original_url, accountName, accountKey) : null,
    result_url: img.result_url ? await generateSasUrl(img.result_url, accountName, accountKey) : null,
    mask_url: img.mask_url ? await generateSasUrl(img.mask_url, accountName, accountKey) : null,
    thumbnail_url: img.thumbnail_url ? await generateSasUrl(img.thumbnail_url, accountName, accountKey) : null,
  })));
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const secretKey = url.searchParams.get('key');
    const batchId = url.searchParams.get('batch_id');
    const action = url.searchParams.get('action') || 'list_batches';

    // Verify admin access
    if (secretKey !== ADMIN_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Azure credentials for SAS generation
    const azureAccountName = Deno.env.get('AZURE_ACCOUNT_NAME') ?? '';
    const azureAccountKey = Deno.env.get('AZURE_ACCOUNT_KEY') ?? '';

    // Create Supabase client with service role (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (action === 'list_batches') {
      // Fetch all batches
      const { data, error } = await supabaseAdmin
        .from('batch_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ batches: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_images' && batchId) {
      // Fetch images for a specific batch
      const { data, error } = await supabaseAdmin
        .from('batch_images')
        .select('*')
        .eq('batch_id', batchId)
        .order('sequence_number', { ascending: true });

      if (error) throw error;

      // Add SAS tokens to URLs
      const imagesWithSas = await addSasToImages(data || [], azureAccountName, azureAccountKey);

      return new Response(
        JSON.stringify({ images: imagesWithSas }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'all_images') {
      // Fetch all images for export
      const { data, error } = await supabaseAdmin
        .from('batch_images')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Add SAS tokens to URLs
      const imagesWithSas = await addSasToImages(data || [], azureAccountName, azureAccountKey);

      return new Response(
        JSON.stringify({ images: imagesWithSas }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin-batches] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
