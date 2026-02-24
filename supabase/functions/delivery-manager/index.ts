import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

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

function verifyAdmin(req: Request, user: { email: string }): boolean {
  const adminEmails = getAdminEmails();
  if (adminEmails.length > 0 && !adminEmails.includes(user.email)) return false;
  const adminSecret = req.headers.get('X-Admin-Secret');
  if (!adminSecret || adminSecret !== ADMIN_SECRET) return false;
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

  const encoder = new TextEncoder();
  const keyData = Uint8Array.from(atob(accountKey), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const sasParams = new URLSearchParams({
    sv: signedVersion, st: startTime, se: expiryTime,
    sr: signedResourceType, sp: signedPermissions, spr: signedProtocol, sig: signatureBase64,
  });
  return sasParams.toString();
}

async function generateSasUrlFromHttps(blobUrl: string, accountName: string, accountKey: string, expiryMinutes = 120): Promise<string> {
  try {
    const url = new URL(blobUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return blobUrl;
    const containerName = decodeURIComponent(pathParts[0]);
    const blobPath = pathParts.slice(1).map(p => decodeURIComponent(p)).join('/');
    const sas = await generateSasToken(accountName, accountKey, containerName, blobPath, expiryMinutes);
    return `${blobUrl}?${sas}`;
  } catch {
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
  const { recipientName, category, resultsUrl, imageCount } = params;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="color: #c8a97e; font-size: 28px; letter-spacing: 6px; font-weight: 300; margin: 0;">FORMANOVA</h1>
      <div style="width: 60px; height: 1px; background: linear-gradient(90deg, transparent, #c8a97e, transparent); margin: 16px auto;"></div>
    </div>
    <div style="background-color: #111; border: 1px solid #222; border-radius: 8px; padding: 32px;">
      <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Hi ${recipientName},</p>
      <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
        Your <strong style="color: #c8a97e; text-transform: capitalize;">${category}</strong> results are ready!
        You have ${imageCount} image${imageCount !== 1 ? 's' : ''} available for download.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resultsUrl}" style="display: inline-block; background: linear-gradient(135deg, #c8a97e, #a88b5e); color: #0a0a0a; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-weight: 600; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">
          View & Download Results
        </a>
      </div>
      <p style="color: #666; font-size: 12px; line-height: 1.6; margin: 0;">
        This link does not expire. You can access your results anytime.
      </p>
    </div>
    <div style="text-align: center; margin-top: 32px;">
      <p style="color: #555; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} FormaNova · AI-Powered Jewelry Photography</p>
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

  // ── Public actions (token-validated, no admin auth) ──
  if (action === 'gallery' || action === 'download') {
    const token = url.searchParams.get('token');
    if (!token) return json({ error: 'Missing token' }, 400);

    const db = getSupabaseAdmin();
    const { data: delivery, error: dErr } = await db
      .from('delivery_batches').select('*').eq('token', token).single();
    if (dErr || !delivery) return json({ error: 'Invalid or expired token' }, 404);

    if (action === 'gallery') {
      const { data: images } = await db
        .from('delivery_images').select('id, image_filename, sequence')
        .eq('delivery_batch_id', delivery.id).order('sequence');
      return json({
        category: delivery.category,
        user_email: delivery.user_email,
        images: images || [],
      });
    }

    if (action === 'download') {
      const imageId = url.searchParams.get('image_id');
      if (!imageId) return json({ error: 'Missing image_id' }, 400);

      const { data: image, error: iErr } = await db
        .from('delivery_images').select('*').eq('id', imageId)
        .eq('delivery_batch_id', delivery.id).single();
      if (iErr || !image) return json({ error: 'Image not found' }, 404);

      const accountName = Deno.env.get('AZURE_ACCOUNT_NAME') ?? '';
      const accountKey = Deno.env.get('AZURE_ACCOUNT_KEY') ?? '';
      const sasUrl = await generateSasUrlFromHttps(image.image_url, accountName, accountKey, 60);

      try {
        const blobResp = await fetch(sasUrl);
        if (!blobResp.ok) {
          console.error(`[delivery-manager] Blob fetch failed: ${blobResp.status}`);
          return json({ error: 'Failed to fetch image from storage' }, 502);
        }

        const contentType = blobResp.headers.get('Content-Type') || 'image/jpeg';
        const filename = image.image_filename || `image_${image.sequence}.jpg`;

        return new Response(blobResp.body, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'private, max-age=3600',
          },
        });
      } catch (err) {
        console.error('[delivery-manager] Download proxy error:', err);
        return json({ error: 'Download failed' }, 500);
      }
    }
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

      // Group by batch_id + user_email
      const groups: Record<string, { batch_id: string; user_email: string; safe_email: string; images: { filename: string; url: string }[] }> = {};
      for (const row of rows) {
        const key = `${row.batch_id}::${row.user_email}`;
        if (!groups[key]) {
          groups[key] = { batch_id: row.batch_id, user_email: row.user_email, safe_email: row.safe_email, images: [] };
        }
        // Extract filename from URL or use image_filename column
        const filename = row.image_filename || row.image_url.split('/').pop()?.split('?')[0] || `image_${groups[key].images.length + 1}.jpg`;
        groups[key].images.push({ filename, url: row.image_url.split('?')[0] }); // strip any existing SAS
      }

      const category = body.category || 'necklace';
      const created: { id: string; batch_id: string; user_email: string; image_count: number }[] = [];

      for (const group of Object.values(groups)) {
        // Check if delivery already exists for this batch_id + user_email
        const { data: existing } = await db.from('delivery_batches')
          .select('id').eq('batch_id', group.batch_id).eq('user_email', group.user_email).limit(1);
        if (existing && existing.length > 0) {
          console.log(`[delivery-manager] Skipping existing delivery for ${group.user_email} / ${group.batch_id}`);
          continue;
        }

        const { data: batch, error: bErr } = await db.from('delivery_batches').insert({
          batch_id: group.batch_id,
          user_email: group.user_email,
          safe_email: group.safe_email,
          category,
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
        created.push({ id: batch.id, batch_id: group.batch_id, user_email: group.user_email, image_count: group.images.length });
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
      const accountName = Deno.env.get('AZURE_ACCOUNT_NAME') ?? '';
      const accountKey = Deno.env.get('AZURE_ACCOUNT_KEY') ?? '';
      const previewImages = await Promise.all((images || []).map(async (img: any) => ({
        ...img,
        preview_url: await generateSasUrlFromHttps(img.image_url, accountName, accountKey, 30),
      })));

      return json({ delivery: batch, images: previewImages });
    }

    // ── send ──
    if (action === 'send' && req.method === 'POST') {
      if (!RESEND_API_KEY) return json({ error: 'Resend API key not configured' }, 500);

      const body = await req.json();
      const deliveryIds = body.delivery_ids as string[];
      if (!deliveryIds || deliveryIds.length === 0) return json({ error: 'delivery_ids required' }, 400);

      // Determine the base URL for results page
      const origin = req.headers.get('Origin') || 'https://formanova.ai';
      const resultsBaseUrl = origin.includes('lovable.app') ? origin : 'https://formanova.ai';

      const results: { id: string; email: string; status: string; error?: string }[] = [];

      for (const deliveryId of deliveryIds) {
        try {
          const { data: delivery } = await db.from('delivery_batches').select('*').eq('id', deliveryId).single();
          if (!delivery) { results.push({ id: deliveryId, email: '', status: 'failed', error: 'Not found' }); continue; }
          if (delivery.delivery_status === 'delivered') { results.push({ id: deliveryId, email: delivery.override_email || delivery.user_email, status: 'skipped', error: 'Already delivered' }); continue; }

          // Generate unique token
          const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').substring(0, 16);

          // Get image count
          const { data: images } = await db.from('delivery_images').select('id').eq('delivery_batch_id', deliveryId);
          const imageCount = images?.length || 0;

          const recipientEmail = delivery.override_email || delivery.user_email;
          const recipientName = recipientEmail.split('@')[0];
          const resultsUrl = `${resultsBaseUrl}/results/${token}`;
          const category = delivery.category || 'jewelry';

          const html = buildDeliveryEmailHtml({ recipientName, category, resultsUrl, imageCount });

          const resendResp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'FormaNova <noreply@formanova.ai>',
              to: [recipientEmail],
              subject: `Your ${category} results are ready — FormaNova`,
              html,
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

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[delivery-manager] Error:', msg);
    return json({ error: msg }, 500);
  }
});
