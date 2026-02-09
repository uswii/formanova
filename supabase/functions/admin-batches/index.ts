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
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/.*\.lovable\.app$/.test(origin);
  const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token, x-admin-secret',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════
const AUTH_SERVICE_URL = Deno.env.get('AUTH_SERVICE_URL') || 'https://formanova.ai/auth';
const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET') || '';
const ADMIN_EMAILS_RAW = Deno.env.get('ADMIN_EMAILS') || '';

function getAdminEmails(): string[] {
  if (!ADMIN_EMAILS_RAW) return [];
  return ADMIN_EMAILS_RAW.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

// Authenticate user via custom auth service, return user info
async function authenticateUser(userToken: string): Promise<{ id: string; email: string } | null> {
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });
    if (!response.ok) return null;
    const user = await response.json();
    return { id: user.id || '', email: (user.email || '').toLowerCase() };
  } catch {
    return null;
  }
}

// Simple approach: append SAS token using account key
async function generateSasUrl(blobUrl: string, accountName: string, accountKey: string): Promise<string> {
  if (!blobUrl || !accountName || !accountKey) return blobUrl;
  
  try {
    const url = new URL(blobUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return blobUrl;
    
    // Decode URI components for canonical resource (Azure requires decoded path in signature)
    const containerName = decodeURIComponent(pathParts[0]);
    const blobPath = pathParts.slice(1).map(p => decodeURIComponent(p)).join('/');
    
    const expiryTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    const expiryStr = expiryTime.toISOString().split('.')[0] + 'Z';
    const startTime = new Date(Date.now() - 5 * 60 * 1000);
    const startStr = startTime.toISOString().split('.')[0] + 'Z';
    
    const permissions = 'r';
    const resource = 'b';
    const version = '2021-06-08';
    const canonicalResource = `/blob/${accountName}/${containerName}/${blobPath}`;
    
    // Azure Service SAS string-to-sign requires exactly 16 fields (15 newlines)
    const stringToSign = [
      permissions,       // sp - signed permissions
      startStr,          // st - signed start
      expiryStr,         // se - signed expiry
      canonicalResource, // canonicalized resource
      '',                // si - signed identifier
      '',                // sip - signed IP
      '',                // spr - signed protocol
      version,           // sv - signed version
      resource,          // sr - signed resource
      '',                // snapshot time
      '',                // encryption scope
      '',                // rscc - response cache control
      '',                // rscd - response content disposition
      '',                // rsce - response content encoding
      '',                // rscl - response content language
      '',                // rsct - response content type
    ].join('\n');
    
    const keyBytes = Uint8Array.from(atob(accountKey), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
    const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
    
    const sasParams = new URLSearchParams({ sv: version, st: startStr, se: expiryStr, sr: resource, sp: permissions, sig });
    return `${blobUrl}?${sasParams.toString()}`;
  } catch (err) {
    console.error('[SAS generation error]', err);
    return blobUrl;
  }
}

async function addSasToImages(images: any[], accountName: string, accountKey: string): Promise<any[]> {
  return Promise.all(images.map(async (img) => ({
    ...img,
    original_url: img.original_url ? await generateSasUrl(img.original_url, accountName, accountKey) : null,
    result_url: img.result_url ? await generateSasUrl(img.result_url, accountName, accountKey) : null,
    mask_url: img.mask_url ? await generateSasUrl(img.mask_url, accountName, accountKey) : null,
    thumbnail_url: img.thumbnail_url ? await generateSasUrl(img.thumbnail_url, accountName, accountKey) : null,
    inspiration_url: img.inspiration_url ? await generateSasUrl(img.inspiration_url, accountName, accountKey) : null,
  })));
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'list_batches';
    const batchId = url.searchParams.get('batch_id');

    // ── Dual Authentication ──
    // 1. Validate user token
    const userToken = req.headers.get('X-User-Token');
    if (!userToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing user token. Sign in first.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = await authenticateUser(userToken);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check email whitelist
    const adminEmails = getAdminEmails();
    if (adminEmails.length > 0 && !adminEmails.includes(user.email)) {
      console.warn(`[admin-batches] Access denied for ${user.email} - not in ADMIN_EMAILS`);
      return new Response(
        JSON.stringify({ error: 'Forbidden - your email is not authorized for admin access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Validate admin secret
    const adminSecret = req.headers.get('X-Admin-Secret') || url.searchParams.get('key');
    if (!adminSecret || adminSecret !== ADMIN_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - invalid admin secret' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-batches] Admin access granted: ${user.email}`);

    // ── Data Access ──
    const azureAccountName = Deno.env.get('AZURE_ACCOUNT_NAME') ?? '';
    const azureAccountKey = Deno.env.get('AZURE_ACCOUNT_KEY') ?? '';

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── LIST BATCHES (with skin tone summary from images + search) ──
    if (action === 'list_batches') {
      const searchQuery = url.searchParams.get('search')?.trim().toLowerCase() || '';

      const { data: batchData, error: batchError } = await supabaseAdmin
        .from('batch_jobs')
        .select('*')
        .order('created_at', { ascending: false });
      if (batchError) throw batchError;

      // Client-side search filtering (email, batch ID, category, status, user name, drive link)
      let filteredBatches = batchData || [];
      if (searchQuery) {
        filteredBatches = filteredBatches.filter((b: any) => {
          const fields = [
            b.id, b.user_email, b.notification_email, b.user_display_name,
            b.jewelry_category, b.status, b.workflow_id, b.drive_link,
          ].filter(Boolean).map((f: string) => f.toLowerCase());
          return fields.some((f: string) => f.includes(searchQuery));
        });
      }

      // Fetch skin tones per batch
      const batchIds = filteredBatches.map((b: any) => b.id);
      let skinToneMap: Record<string, string[]> = {};
      if (batchIds.length > 0) {
        const { data: imageData } = await supabaseAdmin
          .from('batch_images')
          .select('batch_id, skin_tone')
          .in('batch_id', batchIds);
        if (imageData) {
          for (const img of imageData) {
            if (!skinToneMap[img.batch_id]) skinToneMap[img.batch_id] = [];
            if (img.skin_tone && !skinToneMap[img.batch_id].includes(img.skin_tone)) {
              skinToneMap[img.batch_id].push(img.skin_tone);
            }
          }
        }
      }

      // SAS-sign batch-level inspiration URLs
      const batches = await Promise.all(filteredBatches.map(async (b: any) => ({
        ...b,
        skin_tones: skinToneMap[b.id] || [],
        inspiration_url: b.inspiration_url ? await generateSasUrl(b.inspiration_url, azureAccountName, azureAccountKey) : null,
      })));

      return new Response(JSON.stringify({ batches, total_unfiltered: (batchData || []).length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── GET IMAGES ──
    if (action === 'get_images' && batchId) {
      const { data, error } = await supabaseAdmin
        .from('batch_images')
        .select('*')
        .eq('batch_id', batchId)
        .order('sequence_number', { ascending: true });
      if (error) throw error;
      const imagesWithSas = await addSasToImages(data || [], azureAccountName, azureAccountKey);
      return new Response(JSON.stringify({ images: imagesWithSas }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ALL IMAGES ──
    if (action === 'all_images') {
      const { data, error } = await supabaseAdmin
        .from('batch_images')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const imagesWithSas = await addSasToImages(data || [], azureAccountName, azureAccountKey);
      return new Response(JSON.stringify({ images: imagesWithSas }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── UPDATE BATCH STATUS ──
    if (action === 'update_status' && req.method === 'POST') {
      const body = await req.json();
      const { batch_id, status } = body;
      
      if (!batch_id || !status) {
        return new Response(
          JSON.stringify({ error: 'Missing batch_id or status' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const validStatuses = ['pending', 'processing', 'completed', 'failed', 'partial', 'delivered'];
      if (!validStatuses.includes(status)) {
        return new Response(
          JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateData: Record<string, any> = { 
        status,
        updated_at: new Date().toISOString(),
      };
      
      if (status === 'completed' || status === 'delivered') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabaseAdmin
        .from('batch_jobs')
        .update(updateData)
        .eq('id', batch_id)
        .select()
        .single();

      if (error) throw error;

      console.log(`[admin-batches] Status updated: batch ${batch_id} → ${status} by ${user.email}`);
      
      return new Response(JSON.stringify({ success: true, batch: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── UPDATE DRIVE LINK ──
    if (action === 'update_drive_link' && req.method === 'POST') {
      const body = await req.json();
      const { batch_id, drive_link } = body;
      
      if (!batch_id) {
        return new Response(
          JSON.stringify({ error: 'Missing batch_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabaseAdmin
        .from('batch_jobs')
        .update({ drive_link: drive_link || null, updated_at: new Date().toISOString() })
        .eq('id', batch_id)
        .select()
        .single();

      if (error) throw error;

      console.log(`[admin-batches] Drive link updated: batch ${batch_id} by ${user.email}`);
      
      return new Response(JSON.stringify({ success: true, batch: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── DELETE BATCH ──
    if (action === 'delete_batch' && req.method === 'POST') {
      const body = await req.json();
      const { batch_id } = body;
      
      if (!batch_id) {
        return new Response(
          JSON.stringify({ error: 'Missing batch_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete images first (foreign key dependency)
      const { error: imgDelError } = await supabaseAdmin
        .from('batch_images')
        .delete()
        .eq('batch_id', batch_id);

      if (imgDelError) {
        console.error(`[admin-batches] Failed to delete images for batch ${batch_id}:`, imgDelError);
      }

      const { error: batchDelError } = await supabaseAdmin
        .from('batch_jobs')
        .delete()
        .eq('id', batch_id);

      if (batchDelError) throw batchDelError;

      console.log(`[admin-batches] Batch deleted: ${batch_id} by ${user.email}`);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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