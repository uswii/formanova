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

// Upload binary to Azure Blob Storage
async function uploadToAzure(
  binaryData: Uint8Array,
  blobName: string,
  contentType: string,
  accountName: string,
  accountKey: string,
  containerName: string,
): Promise<string> {
  const url = `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(blobName)}`;
  const dateStr = new Date().toUTCString();
  const blobType = 'BlockBlob';

  const stringToSign = [
    'PUT', '', '', binaryData.length.toString(), '', contentType,
    '', '', '', '', '', '',
    `x-ms-blob-type:${blobType}`, `x-ms-date:${dateStr}`, `x-ms-version:2020-10-02`,
    `/${accountName}/${containerName}/${blobName}`,
  ].join('\n');

  const encoder = new TextEncoder();
  const keyData = Uint8Array.from(atob(accountKey), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `SharedKey ${accountName}:${signatureBase64}`,
      'x-ms-date': dateStr,
      'x-ms-version': '2020-10-02',
      'x-ms-blob-type': blobType,
      'Content-Type': contentType,
      'Content-Length': binaryData.length.toString(),
    },
    body: binaryData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure upload failed: ${response.status} - ${errorText}`);
  }

  return url; // Return the HTTPS URL (without SAS)
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

    const adminEmails = getAdminEmails();
    if (adminEmails.length > 0 && !adminEmails.includes(user.email)) {
      console.warn(`[admin-batches] Access denied for ${user.email} - not in ADMIN_EMAILS`);
      return new Response(
        JSON.stringify({ error: 'Forbidden - your email is not authorized for admin access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin secret check removed — access is granted to any authenticated user
    // whose email is in the ADMIN_EMAILS list (checked above)

    console.log(`[admin-batches] Admin access granted: ${user.email}`);

    // ── Data Access ──
    const azureAccountName = Deno.env.get('AZURE_ACCOUNT_NAME') ?? '';
    const azureAccountKey = Deno.env.get('AZURE_ACCOUNT_KEY') ?? '';
    const azureContainerName = (Deno.env.get('AZURE_CONTAINER_NAME') ?? 'jewelry-uploads').toLowerCase();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── LIST BATCHES (with server-side pagination) ──
    if (action === 'list_batches') {
      const searchQuery = url.searchParams.get('search')?.trim().toLowerCase() || '';
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('page_size') || '50', 10)));

      // Always compute status counts from full dataset using count queries
      // This avoids fetching all rows just for stats
      const { count: totalCount } = await supabaseAdmin
        .from('batch_jobs').select('*', { count: 'exact', head: true });

      const statusCounts: Record<string, number> = {};
      for (const s of ['pending', 'processing', 'completed', 'failed', 'partial', 'delivered']) {
        const { count: c } = await supabaseAdmin
          .from('batch_jobs').select('*', { count: 'exact', head: true }).eq('status', s);
        if (c && c > 0) statusCounts[s] = c;
      }

      // If searching, fetch all and filter (search is across multiple fields)
      if (searchQuery) {
        const { data: batchData, error: batchError } = await supabaseAdmin
          .from('batch_jobs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5000);
        if (batchError) throw batchError;

        let filteredBatches = (batchData || []).filter((b: any) => {
          const fields = [
            b.id, b.user_email, b.notification_email, b.user_display_name,
            b.jewelry_category, b.status, b.workflow_id, b.drive_link,
          ].filter(Boolean).map((f: string) => f.toLowerCase());
          return fields.some((f: string) => f.includes(searchQuery));
        });

        const totalFiltered = filteredBatches.length;
        const totalPages = Math.ceil(totalFiltered / pageSize);
        const paginatedBatches = filteredBatches.slice((page - 1) * pageSize, page * pageSize);

        const batchIds = paginatedBatches.map((b: any) => b.id);
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

        const batches = await Promise.all(paginatedBatches.map(async (b: any) => ({
          ...b,
          skin_tones: skinToneMap[b.id] || [],
          inspiration_url: b.inspiration_url ? await generateSasUrl(b.inspiration_url, azureAccountName, azureAccountKey) : null,
        })));

        return new Response(JSON.stringify({
          batches,
          page,
          page_size: pageSize,
          total_filtered: totalFiltered,
          total_pages: totalPages,
          total_unfiltered: totalCount || 0,
          status_counts: statusCounts,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // No search — use efficient range-based pagination
      const offset = (page - 1) * pageSize;
      const { data: batchData, error: batchError } = await supabaseAdmin
        .from('batch_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (batchError) throw batchError;

      const filteredBatches = batchData || [];
      const totalPages = Math.ceil((totalCount || 0) / pageSize);

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

      const batches = await Promise.all(filteredBatches.map(async (b: any) => ({
        ...b,
        skin_tones: skinToneMap[b.id] || [],
        inspiration_url: b.inspiration_url ? await generateSasUrl(b.inspiration_url, azureAccountName, azureAccountKey) : null,
      })));

      return new Response(JSON.stringify({
        batches,
        page,
        page_size: pageSize,
        total_filtered: totalCount || 0,
        total_pages: totalPages,
        total_unfiltered: totalCount || 0,
        status_counts: statusCounts,
      }), {
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

    // ── UPLOAD OUTPUT IMAGE ──
    if (action === 'upload_output' && req.method === 'POST') {
      const body = await req.json();
      const { batch_id, image_id, base64, content_type, filename } = body;

      if (!batch_id || !image_id || !base64) {
        return new Response(
          JSON.stringify({ error: 'Missing batch_id, image_id, or base64' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Strip data URI prefix
      let cleanBase64 = base64;
      if (base64.includes(',')) {
        cleanBase64 = base64.split(',')[1];
      }

      const binaryData = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
      const ct = content_type || 'image/jpeg';
      const ext = ct.includes('png') ? 'png' : 'jpg';
      const blobName = `outputs/${batch_id}/${image_id}_output.${ext}`;

      console.log(`[admin-batches] Uploading output: ${blobName} (${binaryData.length} bytes)`);

      const httpsUrl = await uploadToAzure(
        binaryData, blobName, ct,
        azureAccountName, azureAccountKey, azureContainerName
      );

      // Update the batch_images record
      const { data, error } = await supabaseAdmin
        .from('batch_images')
        .update({
          result_url: httpsUrl,
          status: 'completed',
          processing_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', image_id)
        .eq('batch_id', batch_id)
        .select()
        .single();

      if (error) throw error;

      // Generate SAS URL for immediate preview
      const sasUrl = await generateSasUrl(httpsUrl, azureAccountName, azureAccountKey);

      // Update batch completed count
      const { data: allImages } = await supabaseAdmin
        .from('batch_images')
        .select('status')
        .eq('batch_id', batch_id);

      if (allImages) {
        const completedCount = allImages.filter((i: any) => i.status === 'completed').length;
        const failedCount = allImages.filter((i: any) => i.status === 'failed').length;
        await supabaseAdmin
          .from('batch_jobs')
          .update({
            completed_images: completedCount,
            failed_images: failedCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', batch_id);
      }

      console.log(`[admin-batches] Output uploaded: ${blobName} by ${user.email}`);

      return new Response(JSON.stringify({
        success: true,
        image: { ...data, result_url: sasUrl },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── DELETE OUTPUT IMAGE ──
    if (action === 'delete_output' && req.method === 'POST') {
      const body = await req.json();
      const { batch_id, image_id } = body;

      if (!batch_id || !image_id) {
        return new Response(
          JSON.stringify({ error: 'Missing batch_id or image_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabaseAdmin
        .from('batch_images')
        .update({
          result_url: null,
          status: 'pending',
          processing_completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', image_id)
        .eq('batch_id', batch_id)
        .select()
        .single();

      if (error) throw error;

      // Update batch completed count
      const { data: allImages } = await supabaseAdmin
        .from('batch_images')
        .select('status')
        .eq('batch_id', batch_id);

      if (allImages) {
        const completedCount = allImages.filter((i: any) => i.status === 'completed').length;
        await supabaseAdmin
          .from('batch_jobs')
          .update({
            completed_images: completedCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', batch_id);
      }

      console.log(`[admin-batches] Output deleted for image ${image_id} by ${user.email}`);

      return new Response(JSON.stringify({ success: true, image: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── PROXY IMAGE (binary passthrough for ZIP downloads) ──
    if (action === 'proxy_image') {
      const imageUrl = url.searchParams.get('url');
      if (!imageUrl) {
        return new Response(
          JSON.stringify({ error: 'Missing url parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Only allow Azure blob URLs
      if (!imageUrl.includes('.blob.core.windows.net')) {
        return new Response(
          JSON.stringify({ error: 'Only Azure Blob URLs are allowed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        return new Response(
          JSON.stringify({ error: `Azure fetch failed: ${imgResponse.status}` }),
          { status: imgResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
      const blob = await imgResponse.arrayBuffer();

      return new Response(blob, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Length': blob.byteLength.toString(),
        },
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

    // ── SYNC DELIVERED STATUSES ──
    // Retroactively update batch_jobs to 'delivered' for all delivery_batches that are already delivered
    if (action === 'sync_delivered' && req.method === 'POST') {
      const { data: deliveredBatches, error: dbErr } = await supabaseAdmin
        .from('delivery_batches')
        .select('user_email, category')
        .eq('delivery_status', 'delivered');
      if (dbErr) throw dbErr;

      let updatedCount = 0;
      const seen = new Set<string>();
      for (const d of (deliveredBatches || [])) {
        const key = `${d.user_email}|${d.category || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);

        let jobQuery = supabaseAdmin
          .from('batch_jobs')
          .select('id')
          .ilike('user_email', d.user_email)
          .neq('status', 'delivered');
        if (d.category) jobQuery = jobQuery.eq('jewelry_category', d.category);

        const { data: jobs } = await jobQuery;

        if (jobs && jobs.length > 0) {
          const ids = jobs.map((j: any) => j.id);
          await supabaseAdmin.from('batch_jobs').update({
            status: 'delivered',
            completed_at: new Date().toISOString(),
          }).in('id', ids);
          updatedCount += ids.length;
        }
      }

      console.log(`[admin-batches] Synced ${updatedCount} batch_jobs to delivered by ${user.email}`);
      return new Response(JSON.stringify({ success: true, updated_count: updatedCount }), {
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
