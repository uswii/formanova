import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import JSZip from 'https://esm.sh/jszip@3.10.1';

// ═══════════════════════════════════════════════════════════════
// CORS
// ═══════════════════════════════════════════════════════════════
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
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';

function getAdminEmails(): string[] {
  if (!ADMIN_EMAILS_RAW) return [];
  return ADMIN_EMAILS_RAW.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ═══════════════════════════════════════════════════════════════
// AUTH HELPERS
// ═══════════════════════════════════════════════════════════════
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

function verifyAdmin(_req: Request, user: { email: string }): boolean {
  const adminEmails = getAdminEmails();
  if (adminEmails.length > 0 && !adminEmails.includes(user.email)) return false;
  // Admin access granted to any authenticated user whose email is in ADMIN_EMAILS
  return true;
}

// ═══════════════════════════════════════════════════════════════
// SAS GENERATION (matching azure-get-sas working format)
// ═══════════════════════════════════════════════════════════════
async function generateSasToken(
  accountName: string,
  accountKey: string,
  containerName: string,
  blobName: string,
  expiryMinutes = 120
): Promise<string> {
  const startTime = new Date(Date.now() - 5 * 60 * 1000);
  const expiryTime = new Date(Date.now() + expiryMinutes * 60 * 1000);
  const startStr = startTime.toISOString().split('.')[0] + 'Z';
  const expiryStr = expiryTime.toISOString().split('.')[0] + 'Z';

  const permissions = 'r';
  const resource = 'b';
  const version = '2021-06-08';
  const canonicalResource = `/blob/${accountName}/${containerName}/${blobName}`;

  // Azure Service SAS string-to-sign: exactly 16 fields (15 newlines)
  const stringToSign = [
    permissions,       // sp
    startStr,          // st
    expiryStr,         // se
    canonicalResource, // canonical resource
    '',                // si
    '',                // sip
    '',                // spr
    version,           // sv
    resource,          // sr
    '',                // snapshot
    '',                // encryption scope
    '',                // rscc
    '',                // rscd
    '',                // rsce
    '',                // rscl
    '',                // rsct
  ].join('\n');

  const keyBytes = Uint8Array.from(atob(accountKey), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const sasParams = new URLSearchParams({ sv: version, st: startStr, se: expiryStr, sr: resource, sp: permissions, sig });
  return sasParams.toString();
}

async function generateSasUrlFromHttps(blobUrl: string, _accountName: string, accountKey: string, expiryMinutes = 120): Promise<string> {
  try {
    const url = new URL(blobUrl);
    const hostAccountName = url.hostname.split('.')[0];
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return blobUrl;
    const containerName = decodeURIComponent(pathParts[0]);
    const blobPath = pathParts.slice(1).map(p => decodeURIComponent(p)).join('/');
    console.log(`[delivery-manager] SAS: account=${hostAccountName}, container=${containerName}, blob=${blobPath}`);
    const sas = await generateSasToken(hostAccountName, accountKey, containerName, blobPath, expiryMinutes);
    return `${url.origin}/${containerName}/${blobPath}?${sas}`;
  } catch (err) {
    console.error('[delivery-manager] SAS generation error:', err);
    return blobUrl;
  }
}

// ═══════════════════════════════════════════════════════════════
// CSV PARSER
// ═══════════════════════════════════════════════════════════════
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

// ═══════════════════════════════════════════════════════════════
// EMAIL TEMPLATE
// ═══════════════════════════════════════════════════════════════
function buildDeliveryEmailHtml(params: {
  recipientName: string;
  category: string;
  resultsUrl: string;
  imageCount: number;
}): string {
  const { recipientName, resultsUrl, imageCount } = params;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="color: #c8a97e; font-size: 28px; letter-spacing: 6px; font-weight: 300; margin: 0;">FORMA NOVA</h1>
      <div style="width: 60px; height: 1px; background: linear-gradient(90deg, transparent, #c8a97e, transparent); margin: 16px auto;"></div>
    </div>

    <!-- Body -->
    <div style="background-color: #111; border: 1px solid #222; border-radius: 8px; padding: 32px;">
      <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
        Dear user,
      </p>
      <p style="color: #bbb; font-size: 14px; line-height: 1.7; margin: 0 0 20px;">
        Thank you for using Forma Nova to create your jewelry photos. Your requested images are attached.
      </p>
      <p style="color: #bbb; font-size: 14px; line-height: 1.7; margin: 0 0 24px;">
        If you have any questions or feedback, please email us at <a href="mailto:studio@formanova.ai" style="color: #c8a97e; text-decoration: underline;">studio@formanova.ai</a> and a member of our team will get back to you.
      </p>

      <!-- Pro Tip -->
      <div style="background-color: #1a1a1a; border-left: 3px solid #c8a97e; border-radius: 4px; padding: 16px; margin-bottom: 28px;">
        <p style="color: #c8a97e; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">💡 Pro Tip</p>
        <p style="color: #999; font-size: 13px; line-height: 1.6; margin: 0;">
          For the best results, please upload <strong style="color: #bbb;">worn images</strong> (jewelry on a person) rather than product-only images. If you need a specific model, look, background, or vibe, use the <strong style="color: #bbb;">"Inspirational Photos"</strong> option to upload reference images that match your desired final result.
        </p>
      </div>

      <!-- Photo Count -->
      <div style="text-align: center; margin-bottom: 24px;">
        <p style="color: #999; font-size: 13px; margin: 0 0 4px;">Total Photos Attached</p>
        <p style="color: #c8a97e; font-size: 28px; font-weight: 300; margin: 0;">${imageCount}</p>
      </div>

      <!-- CTA -->
      <div style="text-align: center; margin: 28px 0 16px;">
        <a href="${resultsUrl}" style="display: inline-block; background: linear-gradient(135deg, #c8a97e, #a88b5e); color: #0a0a0a; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-weight: 600; font-size: 14px; letter-spacing: 1px;">
          View Your Photos
        </a>
      </div>
      <p style="color: #666; font-size: 11px; text-align: center; margin: 0;">
        Click the button above to view and download your photos on our secure gallery.
      </p>
    </div>

    <!-- Sign-off -->
    <div style="padding: 24px 0 0; text-align: center;">
      <p style="color: #999; font-size: 14px; margin: 0 0 4px;">Warmest Regards,</p>
      <p style="color: #c8a97e; font-size: 15px; font-weight: 500; letter-spacing: 1px; margin: 0;">Forma Nova AI Agent</p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #1a1a1a;">
      <p style="color: #444; font-size: 10px; margin: 0;">© ${new Date().getFullYear()} Forma Nova · AI-Powered Jewelry Photography</p>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || '';
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  // ── Authenticated actions (token + JWT ownership check) ──
  if (action === 'gallery' || action === 'download' || action === 'thumbnail' || action === 'download_zip') {
    const token = url.searchParams.get('token');
    if (!token) return json({ error: 'Missing token' }, 400);

    // Require authenticated user
    const userToken = req.headers.get('x-user-token') || req.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!userToken) return json({ error: 'Authentication required. Please log in to view your results.' }, 401);

    const authedUser = await authenticateUser(userToken);
    if (!authedUser) {
      console.error(`[delivery-manager] Auth failed for token starting: ${userToken.substring(0, 20)}...`);
      return json({ error: 'Invalid or expired session. Please log in again.' }, 401);
    }

    console.log(`[delivery-manager] Authenticated user: ${authedUser.email}, action=${action}`);

    const db = getSupabaseAdmin();
    const { data: delivery, error: dErr } = await db
      .from('delivery_batches').select('*').eq('token', token).single();
    if (dErr || !delivery) {
      console.error(`[delivery-manager] Token not found: ${token}`);
      return json({ error: 'Invalid or expired token' }, 404);
    }

    // Ownership check: authenticated user's email must match delivery recipient
    // Admin emails can bypass ownership to view any delivery
    const deliveryEmail = (delivery.user_email || '').toLowerCase();
    const overrideEmail = (delivery.override_email || '').toLowerCase();
    const userEmail = authedUser.email.toLowerCase();
    const isAdmin = getAdminEmails().includes(userEmail);
    console.log(`[delivery-manager] Check: user=${userEmail} delivery=${deliveryEmail} override=${overrideEmail} admin=${isAdmin}`);
    if (userEmail !== deliveryEmail && userEmail !== overrideEmail && !isAdmin) {
      console.warn(`[delivery-manager] ACCESS DENIED: ${userEmail} != ${deliveryEmail}`);
      return json({ error: 'Access denied. You do not have permission to view these results.' }, 403);
    }

    if (action === 'gallery') {
      const { data: images } = await db
        .from('delivery_images').select('id, image_filename, image_url, sequence')
        .eq('delivery_batch_id', delivery.id).order('sequence');

      // Generate SAS URLs for direct download
      const accountKey = Deno.env.get('AZURE_ACCOUNT_KEY') ?? '';
      const imagesWithSas = await Promise.all((images || []).map(async (img: any) => ({
        id: img.id,
        image_filename: img.image_filename,
        sequence: img.sequence,
        download_url: await generateSasUrlFromHttps(img.image_url, '', accountKey, 120),
      })));

      return json({
        category: delivery.category,
        user_email: delivery.user_email,
        images: imagesWithSas,
      });
    }

    // ── Download all images as ZIP ──
    if (action === 'download_zip') {
      const { data: images } = await db
        .from('delivery_images').select('id, image_filename, image_url, sequence')
        .eq('delivery_batch_id', delivery.id).order('sequence');

      if (!images || images.length === 0) return json({ error: 'No images found' }, 404);

      const accountKey = Deno.env.get('AZURE_ACCOUNT_KEY') ?? '';
      const zip = new JSZip();
      let fetched = 0;

      for (const img of images) {
        try {
          // Normalize URL and check for existing SAS
          let imgUrl = img.image_url;
          if (!imgUrl.startsWith('http://') && !imgUrl.startsWith('https://')) {
            imgUrl = `https://${imgUrl}`;
          }
          const hasSas = imgUrl.includes('sv=') && imgUrl.includes('sig=');
          const fetchUrl = hasSas 
            ? imgUrl 
            : await generateSasUrlFromHttps(imgUrl, '', accountKey, 60);
          
          const debugUrl = fetchUrl.split('?')[0];
          console.log(`[delivery-manager] ZIP: fetching ${debugUrl} (hasSas=${hasSas})`);
          const resp = await fetch(fetchUrl);
          if (!resp.ok) {
            const errBody = await resp.text();
            console.error(`[delivery-manager] ZIP: failed to fetch ${img.image_filename}: ${resp.status} - ${errBody.substring(0, 200)}`);
            continue;
          }
          const buf = await resp.arrayBuffer();
          zip.file(img.image_filename || `image_${img.sequence}.jpg`, buf);
          fetched++;
        } catch (err) {
          console.error(`[delivery-manager] ZIP: error fetching ${img.image_filename}:`, err);
        }
      }

      if (fetched === 0) return json({ error: 'Failed to fetch any images' }, 502);

      const zipBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const category = delivery.category || 'jewelry';
      const zipFilename = `FormaNova_${category}_results.zip`;

      console.log(`[delivery-manager] ZIP created: ${fetched}/${images.length} images, ${(zipBuffer.length / 1024 / 1024).toFixed(1)}MB`);

      return new Response(zipBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${zipFilename}"`,
          'Cache-Control': 'private, no-cache',
        },
      });
    }

    // Shared image proxy for both download and thumbnail
    if (action === 'download' || action === 'thumbnail') {
      const imageId = url.searchParams.get('image_id');
      if (!imageId) return json({ error: 'Missing image_id' }, 400);

      const { data: image, error: iErr } = await db
        .from('delivery_images').select('*').eq('id', imageId)
        .eq('delivery_batch_id', delivery.id).single();
      if (iErr || !image) return json({ error: 'Image not found' }, 404);

      const accountKey = Deno.env.get('AZURE_ACCOUNT_KEY') ?? '';
      const sasUrl = await generateSasUrlFromHttps(image.image_url, '', accountKey, 60);

      try {
        const blobResp = await fetch(sasUrl);
        if (!blobResp.ok) {
          const errBody = await blobResp.text();
          console.error(`[delivery-manager] Blob fetch failed: ${blobResp.status}`, errBody.substring(0, 200));
          return json({ error: 'Failed to fetch image from storage' }, 502);
        }

        const contentType = blobResp.headers.get('Content-Type') || 'image/jpeg';
        const filename = image.image_filename || `image_${image.sequence}.jpg`;
        const isDownload = action === 'download';

        return new Response(blobResp.body, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Content-Disposition': isDownload ? `attachment; filename="${filename}"` : 'inline',
            'Cache-Control': isDownload ? 'private, max-age=3600' : 'public, max-age=7200',
          },
        });
      } catch (err) {
        console.error('[delivery-manager] Download proxy error:', err);
        return json({ error: 'Download failed' }, 500);
      }
    }
  }

  // ── User-authenticated actions (no admin required) ──
  if (action === 'my_deliveries') {
    const userToken = req.headers.get('X-User-Token');
    if (!userToken) return json({ error: 'Unauthorized' }, 401);
    const user = await authenticateUser(userToken);
    if (!user) return json({ error: 'Invalid token' }, 401);

    const db = getSupabaseAdmin();
    const { data: batches, error: bErr } = await db
      .from('delivery_batches')
      .select('id, batch_id, category, token, created_at, delivery_status')
      .eq('user_email', user.email)
      .order('created_at', { ascending: false });

    if (bErr) {
      console.error('[delivery-manager] my_deliveries query error:', bErr);
      return json({ error: 'Failed to fetch deliveries' }, 500);
    }

    if (!batches || batches.length === 0) {
      return json({ deliveries: [] });
    }

    const accountKey = Deno.env.get('AZURE_ACCOUNT_KEY') ?? '';
    const batchIds = batches.map((b: any) => b.id);

    const { data: allImages } = await db
      .from('delivery_images')
      .select('id, delivery_batch_id, image_filename, image_url, sequence')
      .in('delivery_batch_id', batchIds)
      .order('sequence');

    // Group images by batch and generate SAS for first 3 thumbnails per batch
    const imagesByBatch: Record<string, any[]> = {};
    for (const img of (allImages || [])) {
      const bid = img.delivery_batch_id;
      if (!imagesByBatch[bid]) imagesByBatch[bid] = [];
      imagesByBatch[bid].push(img);
    }

    const deliveries = await Promise.all(batches.map(async (batch: any) => {
      const batchImages = imagesByBatch[batch.id] || [];
      // Only generate SAS for first 3 thumbnails to keep response fast
      const thumbnails = await Promise.all(
        batchImages.slice(0, 3).map(async (img: any) => ({
          id: img.id,
          filename: img.image_filename,
          url: await generateSasUrlFromHttps(img.image_url, '', accountKey, 120),
        }))
      );
      return {
        id: batch.id,
        batch_id: batch.batch_id,
        category: batch.category,
        token: batch.token,
        created_at: batch.created_at,
        delivery_status: batch.delivery_status,
        image_count: batchImages.length,
        thumbnails,
      };
    }));

    return json({ deliveries });
  }

  // ── Admin actions below: require dual auth ──
  const userToken = req.headers.get('X-User-Token');
  if (!userToken) return json({ error: 'Unauthorized' }, 401);
  const user = await authenticateUser(userToken);
  if (!user) return json({ error: 'Invalid token' }, 401);
  if (!verifyAdmin(req, user)) return json({ error: 'Forbidden' }, 403);

  const db = getSupabaseAdmin();

  try {
    // ── upload_csv ──
    if (action === 'upload_csv' && req.method === 'POST') {
      const body = await req.json();
      const csvText = body.csv_text as string;
      if (!csvText) return json({ error: 'csv_text is required' }, 400);

      const rows = parseCSV(csvText);
      if (rows.length === 0) return json({ error: 'No data rows found in CSV' }, 400);

      // Validate required columns
      const required = ['batch_id', 'user_email', 'safe_email', 'image_url'];
      const missing = required.filter(r => !(r in rows[0]));
      if (missing.length > 0) return json({ error: `Missing CSV columns: ${missing.join(', ')}` }, 400);

      // Group by batch_id + user_email + category
      const groups: Record<string, { batch_id: string; user_email: string; safe_email: string; category: string; images: { filename: string; url: string }[] }> = {};
      for (const row of rows) {
        // Strip trailing .N suffix from user_email (e.g. "user@gmail.com.1" → "user@gmail.com")
        const cleanEmail = row.user_email.replace(/\.\d+$/, '');
        const rowCategory = (row.category || body.category || 'necklace').toLowerCase().trim();
        const key = `${row.batch_id}::${cleanEmail}::${rowCategory}`;
        if (!groups[key]) {
          groups[key] = { batch_id: row.batch_id, user_email: cleanEmail, safe_email: row.safe_email.replace(/_\d+$/, ''), category: rowCategory, images: [] };
        }
        // Normalize URL: ensure https:// prefix
        let imageUrl = row.image_url;
        if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
          imageUrl = `https://${imageUrl}`;
        }
        // Extract filename from URL or use image_filename column
        const filename = row.image_filename || imageUrl.split('/').pop()?.split('?')[0] || `image_${groups[key].images.length + 1}.jpg`;
        groups[key].images.push({ filename, url: imageUrl }); // keep full URL including any SAS token
      }

      const created: { id: string; batch_id: string; user_email: string; category: string; image_count: number }[] = [];

      for (const group of Object.values(groups)) {
        // Check if delivery already exists for this batch_id + user_email + category
        const { data: existing } = await db.from('delivery_batches')
          .select('id, delivery_status').eq('batch_id', group.batch_id).eq('user_email', group.user_email).eq('category', group.category).limit(1);
        if (existing && existing.length > 0) {
          // Already delivered — skip entirely to prevent duplicate emails
          if (existing[0].delivery_status === 'delivered') {
            console.log(`[delivery-manager] Skipping already delivered: ${group.user_email} / ${group.batch_id}`);
          } else {
            console.log(`[delivery-manager] Skipping existing (${existing[0].delivery_status}) delivery for ${group.user_email} / ${group.batch_id}`);
          }
          continue;
        }

        // Look up notification_email from original batch_jobs for this user
        let overrideEmail: string | null = null;
        const { data: originalBatches } = await db.from('batch_jobs')
          .select('notification_email')
          .eq('user_email', group.user_email)
          .not('notification_email', 'is', null)
          .limit(1);
        if (originalBatches && originalBatches.length > 0) {
          const notifyEmail = originalBatches[0].notification_email;
          if (notifyEmail && notifyEmail.toLowerCase() !== group.user_email.toLowerCase()) {
            overrideEmail = notifyEmail;
            console.log(`[delivery-manager] Auto-set override email for ${group.user_email} → ${notifyEmail}`);
          }
        }

        const { data: batch, error: bErr } = await db.from('delivery_batches').insert({
          batch_id: group.batch_id,
          user_email: group.user_email,
          safe_email: group.safe_email,
          override_email: overrideEmail,
          category: group.category,
          delivery_status: 'completed',
        }).select().single();

        if (bErr || !batch) {
          console.error(`[delivery-manager] Failed to create delivery batch:`, bErr);
          continue;
        }

        const imageInserts = group.images.map((img, i) => ({
          delivery_batch_id: batch.id,
          image_filename: img.filename,
          image_url: img.url,
          sequence: i + 1,
        }));

        await db.from('delivery_images').insert(imageInserts);
        created.push({ id: batch.id, batch_id: group.batch_id, user_email: group.user_email, category: group.category, image_count: group.images.length });
      }

      console.log(`[delivery-manager] CSV uploaded: ${created.length} delivery batches created by ${user.email}`);
      return json({ created, total: created.length });
    }

    // ── list ──
    if (action === 'list') {
      const { data: batches, error } = await db.from('delivery_batches')
        .select('*, delivery_images(id)').order('created_at', { ascending: false });
      if (error) return json({ error: error.message }, 500);

      const result = (batches || []).map(b => ({
        ...b,
        image_count: (b as any).delivery_images?.length || 0,
        delivery_images: undefined,
      }));
      return json({ deliveries: result });
    }

    // ── preview ──
    if (action === 'preview') {
      const deliveryId = url.searchParams.get('delivery_id');
      if (!deliveryId) return json({ error: 'delivery_id required' }, 400);

      const { data: batch } = await db.from('delivery_batches').select('*').eq('id', deliveryId).single();
      if (!batch) return json({ error: 'Not found' }, 404);

      const { data: images } = await db.from('delivery_images').select('*')
        .eq('delivery_batch_id', deliveryId).order('sequence');

      // Generate preview SAS URLs
      const accountKey = Deno.env.get('AZURE_ACCOUNT_KEY') ?? '';
      const previewImages = await Promise.all((images || []).map(async (img: any) => ({
        ...img,
        preview_url: await generateSasUrlFromHttps(img.image_url, '', accountKey, 30),
      })));

      return json({ delivery: batch, images: previewImages });
    }

    // ── send ──
    if (action === 'send' && req.method === 'POST') {
      if (!RESEND_API_KEY) return json({ error: 'Resend API key not configured' }, 500);

      const body = await req.json();
      const deliveryIds = body.delivery_ids as string[];
      if (!deliveryIds || deliveryIds.length === 0) return json({ error: 'delivery_ids required' }, 400);

      // Build branded gallery URL (avoids "dangerous link" warnings from email clients)
      const BRANDED_BASE = 'https://formanova.ai';

      const results: { id: string; email: string; status: string; error?: string }[] = [];

      for (const deliveryId of deliveryIds) {
        try {
          const { data: delivery } = await db.from('delivery_batches').select('*').eq('id', deliveryId).single();
          if (!delivery) { results.push({ id: deliveryId, email: '', status: 'failed', error: 'Not found' }); continue; }
          // Allow re-sending delivered items (admin explicitly selected them)

          // Generate unique token
          const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').substring(0, 16);

          // Get image count
          const { data: images } = await db.from('delivery_images').select('id').eq('delivery_batch_id', deliveryId);
          const imageCount = images?.length || 0;

          const recipientEmail = delivery.override_email || delivery.user_email;
          const recipientName = recipientEmail.split('@')[0];
          const resultsUrl = `${BRANDED_BASE}/yourresults/${token}`;
          const category = delivery.category || 'jewelry';

          const html = buildDeliveryEmailHtml({ recipientName, category, resultsUrl, imageCount });

          // Unique headers to prevent email threading
          const uniqueId = crypto.randomUUID();
          const resendResp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'FormaNova <noreply@formanova.ai>',
              reply_to: 'studio@formanova.ai',
              to: [recipientEmail],
              subject: `Your results are ready — FormaNova`,
              html,
              headers: {
                'X-Entity-Ref-ID': uniqueId,
                'References': `<${uniqueId}@formanova.ai>`,
                'Message-ID': `<${uniqueId}@formanova.ai>`,
              },
            }),
          });

          if (!resendResp.ok) {
            const errText = await resendResp.text();
            console.error(`[delivery-manager] Resend failed for ${recipientEmail}:`, errText);
            results.push({ id: deliveryId, email: recipientEmail, status: 'failed', error: `Resend: ${resendResp.status}` });
            continue;
          }

          await resendResp.json();

          // Update delivery with token and status
          const now = new Date().toISOString();
          await db.from('delivery_batches').update({
            token,
            delivery_status: 'delivered',
            delivered_at: now,
            email_sent_at: now,
          }).eq('id', deliveryId);

          // Also update corresponding batch_jobs to 'delivered'
          // Match by user_email (case-insensitive) + category
          let jobQuery = db.from('batch_jobs')
            .select('id')
            .ilike('user_email', delivery.user_email);
          if (delivery.category) jobQuery = jobQuery.eq('jewelry_category', delivery.category);
          const { data: matchedJobs } = await jobQuery;
          if (matchedJobs && matchedJobs.length > 0) {
            const jobIds = matchedJobs.map((j: any) => j.id);
            await db.from('batch_jobs').update({
              status: 'delivered',
              completed_at: now,
            }).in('id', jobIds);
            console.log(`[delivery-manager] Updated ${jobIds.length} batch_jobs to delivered for ${delivery.user_email} / ${delivery.category}`);

            // Auto-populate batch_images.result_url with delivery output images
            try {
              const { data: deliveryImgs } = await db.from('delivery_images')
                .select('image_url, sequence')
                .eq('delivery_batch_id', deliveryId)
                .order('sequence');

              if (deliveryImgs && deliveryImgs.length > 0) {
                // For each matched batch_job, get its batch_images sorted by sequence_number
                for (const jobId of jobIds) {
                  const { data: batchImgs } = await db.from('batch_images')
                    .select('id, sequence_number')
                    .eq('batch_id', jobId)
                    .order('sequence_number');

                  if (batchImgs && batchImgs.length > 0) {
                    // Match by position: delivery image i → batch image i
                    const updateCount = Math.min(deliveryImgs.length, batchImgs.length);
                    for (let idx = 0; idx < updateCount; idx++) {
                      await db.from('batch_images')
                        .update({ result_url: deliveryImgs[idx].image_url })
                        .eq('id', batchImgs[idx].id);
                    }
                    console.log(`[delivery-manager] Populated ${updateCount} batch_images result_urls for job ${jobId}`);
                  }
                }
              }
            } catch (syncErr) {
              console.error(`[delivery-manager] Failed to sync output images to batch_images:`, syncErr);
              // Non-fatal — delivery still succeeds
            }
          }

          console.log(`[delivery-manager] Email sent to ${recipientEmail} for delivery ${deliveryId}`);
          results.push({ id: deliveryId, email: recipientEmail, status: 'sent' });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          results.push({ id: deliveryId, email: '', status: 'failed', error: msg });
        }
      }

      const sent = results.filter(r => r.status === 'sent').length;
      const failed = results.filter(r => r.status === 'failed').length;
      return json({ results, summary: { sent, failed, skipped: results.filter(r => r.status === 'skipped').length, total: results.length } });
    }

    // ── update_override_email ──
    if (action === 'update_override_email' && req.method === 'POST') {
      const body = await req.json();
      const { delivery_id, override_email } = body;
      if (!delivery_id) return json({ error: 'delivery_id required' }, 400);

      await db.from('delivery_batches').update({ override_email: override_email || null }).eq('id', delivery_id);
      return json({ success: true });
    }

    // ── delete ──
    if (action === 'delete' && req.method === 'POST') {
      const body = await req.json();
      const { delivery_ids } = body;
      if (!delivery_ids || delivery_ids.length === 0) return json({ error: 'delivery_ids required' }, 400);

      for (const id of delivery_ids) {
        await db.from('delivery_images').delete().eq('delivery_batch_id', id);
        await db.from('delivery_batches').delete().eq('id', id);
      }
      return json({ deleted: delivery_ids.length });
    }

    // ── send_apology (one-time) ──
    if (action === 'send_apology' && req.method === 'POST') {
      if (!RESEND_API_KEY) return json({ error: 'Resend API key not configured' }, 500);

      const body = await req.json();
      const dryRun = body.dry_run === true;

      // Find users who received duplicate emails
      const { data: allDelivered } = await db.from('delivery_batches')
        .select('user_email, override_email')
        .eq('delivery_status', 'delivered');

      const emailCounts: Record<string, number> = {};
      for (const d of (allDelivered || [])) {
        const email = (d as any).override_email || (d as any).user_email;
        emailCounts[email] = (emailCounts[email] || 0) + 1;
      }

      const duplicateEmails = Object.entries(emailCounts)
        .filter(([_, count]) => count > 1)
        .map(([email, count]) => ({ email, count }));

      if (dryRun) {
        return json({ duplicate_users: duplicateEmails, total: duplicateEmails.length });
      }

      const results: { email: string; status: string; error?: string }[] = [];

      for (const { email, count } of duplicateEmails) {
        try {
          const recipientName = email.split('@')[0];
          const apologyHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#0a0a0a; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px; margin:0 auto; padding:40px 24px;">
    <div style="text-align:center; margin-bottom:24px;">
      <p style="color:#c8a97e; font-size:22px; font-weight:300; letter-spacing:3px; margin:0;">FORMA NOVA</p>
    </div>
    <div style="background:#111; border:1px solid #1a1a1a; border-radius:8px; padding:32px 28px;">
      <p style="color:#e0e0e0; font-size:15px; margin:0 0 16px;">Dear user,</p>
      <p style="color:#ccc; font-size:14px; line-height:1.7; margin:0 0 16px;">
        We sincerely apologize — due to a brief technical issue on our end, you may have received 
        <strong style="color:#c8a97e;">${count} duplicate email(s)</strong> regarding your jewelry photography results.
      </p>
      <p style="color:#ccc; font-size:14px; line-height:1.7; margin:0 0 16px;">
        Rest assured, your results are perfectly fine and the most recent download link you received is the correct one. 
        You can safely disregard the earlier duplicate message(s).
      </p>
      <p style="color:#ccc; font-size:14px; line-height:1.7; margin:0 0 16px;">
        We've already resolved the issue to prevent this from happening again. We value your trust and appreciate your understanding.
      </p>
      <p style="color:#e0e0e0; font-size:14px; margin:24px 0 4px;">Warmest regards,</p>
      <p style="color:#c8a97e; font-size:15px; font-weight:500; letter-spacing:1px; margin:0;">The Forma Nova Team</p>
    </div>
    <div style="text-align:center; margin-top:24px;">
      <p style="color:#666; font-size:11px; margin:0;">
        If you have any questions, please email us at 
        <a href="mailto:studio@formanova.ai" style="color:#c8a97e; text-decoration:none;">studio@formanova.ai</a>
      </p>
      <p style="color:#444; font-size:10px; margin:8px 0 0;">© ${new Date().getFullYear()} Forma Nova · AI-Powered Jewelry Photography</p>
    </div>
  </div>
</body></html>`;

          const uniqueId = crypto.randomUUID();
          const resendResp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'FormaNova <noreply@formanova.ai>',
              reply_to: 'studio@formanova.ai',
              to: [email],
              subject: 'Our apologies — duplicate email notification',
              html: apologyHtml,
              headers: {
                'X-Entity-Ref-ID': uniqueId,
                'References': `<${uniqueId}@formanova.ai>`,
                'Message-ID': `<${uniqueId}@formanova.ai>`,
              },
            }),
          });

          if (!resendResp.ok) {
            const errText = await resendResp.text();
            results.push({ email, status: 'failed', error: errText });
          } else {
            await resendResp.json();
            results.push({ email, status: 'sent' });
          }
        } catch (err) {
          results.push({ email, status: 'failed', error: err instanceof Error ? err.message : 'Unknown' });
        }
      }

      const sent = results.filter(r => r.status === 'sent').length;
      const failed = results.filter(r => r.status === 'failed').length;
      console.log(`[delivery-manager] Apology emails: sent=${sent}, failed=${failed}`);
      return json({ results, summary: { sent, failed, total: results.length } });
    }

    // ── send_bulk: send delivery emails to N users, deduped via notification_log ──
    if (action === 'send_bulk' && req.method === 'POST') {
      if (!RESEND_API_KEY) return json({ error: 'Resend API key not configured' }, 500);

      const body = await req.json();
      const campaign = body.campaign as string || 'results_delivery_v1';
      const limit = Math.min(body.limit as number || 50, 100);
      const dryRun = body.dry_run === true;
      const BRANDED_BASE = 'https://formanova.ai';

      // Get all unique user_emails from delivery_batches
      const { data: allDeliveries, error: dErr } = await db
        .from('delivery_batches')
        .select('id, user_email, override_email, category, token')
        .eq('delivery_status', 'delivered')
        .order('created_at', { ascending: true });

      if (dErr || !allDeliveries) return json({ error: 'Failed to fetch deliveries' }, 500);

      // Deduplicate by effective email (override_email || user_email)
      const seen = new Set<string>();
      const uniqueDeliveries: typeof allDeliveries = [];
      for (const d of allDeliveries) {
        const effectiveEmail = ((d as any).override_email || (d as any).user_email).toLowerCase();
        if (!seen.has(effectiveEmail)) {
          seen.add(effectiveEmail);
          uniqueDeliveries.push(d);
        }
      }

      // Check notification_log for already-sent entries
      const { data: alreadySent } = await db
        .from('notification_log')
        .select('user_email')
        .eq('campaign', campaign);

      const sentEmails = new Set((alreadySent || []).map((r: any) => r.user_email.toLowerCase()));

      // Filter to unsent only
      const unsent = uniqueDeliveries.filter(d => {
        const effectiveEmail = ((d as any).override_email || (d as any).user_email).toLowerCase();
        return !sentEmails.has(effectiveEmail);
      });

      const toSend = unsent.slice(0, limit);

      if (dryRun) {
        return json({
          campaign,
          total_unique_users: uniqueDeliveries.length,
          already_sent: sentEmails.size,
          remaining: unsent.length,
          will_send: toSend.length,
          emails: toSend.map(d => (d as any).override_email || (d as any).user_email),
        });
      }

      if (toSend.length === 0) {
        return json({ campaign, message: 'No unsent users remaining', already_sent: sentEmails.size });
      }

      const results: { email: string; status: string; error?: string }[] = [];

      for (const delivery of toSend) {
        const recipientEmail = (delivery as any).override_email || (delivery as any).user_email;
        const effectiveEmail = recipientEmail.toLowerCase();

        try {
          // Get image count
          const { data: images } = await db.from('delivery_images').select('id').eq('delivery_batch_id', (delivery as any).id);
          const imageCount = images?.length || 0;

          const token = (delivery as any).token;
          if (!token) {
            results.push({ email: effectiveEmail, status: 'skipped', error: 'No token' });
            continue;
          }

          const resultsUrl = `${BRANDED_BASE}/yourresults/${token}`;
          const category = (delivery as any).category || 'jewelry';

          // Old-user template: simple, direct message for users who received emails before
          const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background-color:#0a0a0a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px; margin:0 auto; padding:40px 24px;">
    <div style="text-align:center; margin-bottom:32px;">
      <h1 style="color:#c8a97e; font-size:24px; letter-spacing:5px; font-weight:300; margin:0;">FORMA NOVA</h1>
      <div style="width:50px; height:1px; background:linear-gradient(90deg,transparent,#c8a97e,transparent); margin:14px auto;"></div>
    </div>
    <div style="background-color:#111; border:1px solid #222; border-radius:8px; padding:32px 28px;">
      <p style="color:#e0e0e0; font-size:15px; line-height:1.6; margin:0 0 16px;">Dear user,</p>
      <p style="color:#bbb; font-size:14px; line-height:1.7; margin:0 0 20px;">
        You can now view your Forma Nova results at the link below:
      </p>
      <div style="text-align:center; margin:24px 0;">
        <a href="${resultsUrl}" style="display:inline-block; background:linear-gradient(135deg,#c8a97e,#a88b5e); color:#0a0a0a; text-decoration:none; padding:14px 40px; border-radius:6px; font-weight:600; font-size:14px; letter-spacing:1px;">
          View Your Photos
        </a>
      </div>
      <p style="color:#999; font-size:13px; line-height:1.6; margin:0 0 20px; text-align:center;">
        Please make sure you are logged in to access them.
      </p>
      <div style="text-align:center; margin-bottom:16px;">
        <p style="color:#666; font-size:12px; margin:0 0 4px;">Total Photos</p>
        <p style="color:#c8a97e; font-size:24px; font-weight:300; margin:0;">${imageCount}</p>
      </div>
    </div>
    <div style="padding:20px 0 0; text-align:center;">
      <p style="color:#999; font-size:13px; margin:0 0 4px;">Warmest Regards,</p>
      <p style="color:#c8a97e; font-size:14px; font-weight:500; letter-spacing:1px; margin:0;">The Forma Nova Team</p>
    </div>
    <div style="text-align:center; margin-top:24px; padding-top:12px; border-top:1px solid #1a1a1a;">
      <p style="color:#555; font-size:11px; margin:0;">Questions? Email us at <a href="mailto:studio@formanova.ai" style="color:#c8a97e; text-decoration:none;">studio@formanova.ai</a></p>
      <p style="color:#444; font-size:10px; margin:6px 0 0;">© ${new Date().getFullYear()} Forma Nova · AI-Powered Jewelry Photography</p>
    </div>
  </div>
</body></html>`;

          const uniqueId = crypto.randomUUID();
          const resendResp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'FormaNova <noreply@formanova.ai>',
              reply_to: 'studio@formanova.ai',
              to: [recipientEmail],
              subject: 'Your Forma Nova results are ready to view',
              html,
              headers: {
                'X-Entity-Ref-ID': uniqueId,
                'References': `<${uniqueId}@formanova.ai>`,
                'Message-ID': `<${uniqueId}@formanova.ai>`,
              },
            }),
          });

          if (!resendResp.ok) {
            const errText = await resendResp.text();
            console.error(`[delivery-manager] Bulk send failed for ${effectiveEmail}:`, errText);
            results.push({ email: effectiveEmail, status: 'failed', error: `Resend: ${resendResp.status}` });
            continue;
          }
          await resendResp.json();

          // Log in notification_log
          await db.from('notification_log').insert({
            user_email: effectiveEmail,
            campaign,
          });

          results.push({ email: effectiveEmail, status: 'sent' });
          console.log(`[delivery-manager] Bulk sent to ${effectiveEmail} (campaign: ${campaign})`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown';
          results.push({ email: effectiveEmail, status: 'failed', error: msg });
        }
      }

      const sent = results.filter(r => r.status === 'sent').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      console.log(`[delivery-manager] Bulk campaign "${campaign}": sent=${sent}, failed=${failed}, skipped=${skipped}`);
      return json({ campaign, results, summary: { sent, failed, skipped, total: results.length, remaining: unsent.length - toSend.length } });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[delivery-manager] Error:', msg);
    return json({ error: msg }, 500);
  }
});
