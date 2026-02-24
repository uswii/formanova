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

const AUTH_SERVICE_URL = Deno.env.get('AUTH_SERVICE_URL') || 'https://formanova.ai/auth';
const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET') || '';
const ADMIN_EMAILS_RAW = Deno.env.get('ADMIN_EMAILS') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';

function getAdminEmails(): string[] {
  if (!ADMIN_EMAILS_RAW) return [];
  return ADMIN_EMAILS_RAW.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

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

// Generate SAS URL for Azure blob (48h expiry for email links)
async function generateSasUrl(blobUrl: string, accountName: string, accountKey: string, expiryHours = 48): Promise<string> {
  if (!blobUrl || !accountName || !accountKey) return blobUrl;
  try {
    const url = new URL(blobUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return blobUrl;
    const containerName = decodeURIComponent(pathParts[0]);
    const blobPath = pathParts.slice(1).map(p => decodeURIComponent(p)).join('/');
    const expiryTime = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    const expiryStr = expiryTime.toISOString().split('.')[0] + 'Z';
    const startTime = new Date(Date.now() - 5 * 60 * 1000);
    const startStr = startTime.toISOString().split('.')[0] + 'Z';
    const permissions = 'r';
    const resource = 'b';
    const version = '2021-06-08';
    const canonicalResource = `/blob/${accountName}/${containerName}/${blobPath}`;
    const stringToSign = [
      permissions, startStr, expiryStr, canonicalResource,
      '', '', '', version, resource, '', '', '', '', '', '', '',
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

function buildEmailHtml(params: {
  recipientName: string;
  category: string;
  totalImages: number;
  imageLinks: { sequence: number; url: string }[];
  expiryHours: number;
}): string {
  const { recipientName, category, totalImages, imageLinks, expiryHours } = params;
  
  const imageRows = imageLinks.map(img => `
    <tr>
      <td style="padding: 8px 16px; border-bottom: 1px solid #2a2a2a; color: #999; font-size: 13px;">
        Image #${img.sequence}
      </td>
      <td style="padding: 8px 16px; border-bottom: 1px solid #2a2a2a;">
        <a href="${img.url}" style="color: #c8a97e; text-decoration: none; font-size: 13px;">Download →</a>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="color: #c8a97e; font-size: 28px; letter-spacing: 6px; font-weight: 300; margin: 0;">FORMANOVA</h1>
      <div style="width: 60px; height: 1px; background: linear-gradient(90deg, transparent, #c8a97e, transparent); margin: 16px auto;"></div>
    </div>

    <!-- Body -->
    <div style="background-color: #111; border: 1px solid #222; border-radius: 8px; padding: 32px;">
      <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
        Hi ${recipientName},
      </p>
      <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
        Your <strong style="color: #c8a97e; text-transform: capitalize;">${category}</strong> batch results are ready! 
        Below you'll find download links for your ${totalImages} processed image${totalImages !== 1 ? 's' : ''}.
      </p>

      <!-- Results Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px 16px; border-bottom: 2px solid #c8a97e; color: #c8a97e; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Image</th>
            <th style="text-align: left; padding: 8px 16px; border-bottom: 2px solid #c8a97e; color: #c8a97e; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Download</th>
          </tr>
        </thead>
        <tbody>
          ${imageRows}
        </tbody>
      </table>

      <div style="background-color: #1a1a1a; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px;">
        <p style="color: #777; font-size: 12px; margin: 0;">
          ⏱ These download links expire in <strong style="color: #999;">${expiryHours} hours</strong>. 
          Please save your images before then.
        </p>
      </div>

      <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 0;">
        Thank you for choosing FormaNova.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px;">
      <p style="color: #555; font-size: 11px; margin: 0;">
        © ${new Date().getFullYear()} FormaNova · AI-Powered Jewelry Photography
      </p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth: same dual-auth as admin-batches ──
    const userToken = req.headers.get('X-User-Token');
    if (!userToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized - missing user token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = await authenticateUser(userToken);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const adminEmails = getAdminEmails();
    if (adminEmails.length > 0 && !adminEmails.includes(user.email)) {
      return new Response(JSON.stringify({ error: 'Forbidden - not an admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const adminSecret = req.headers.get('X-Admin-Secret');
    if (!adminSecret || adminSecret !== ADMIN_SECRET) {
      return new Response(JSON.stringify({ error: 'Forbidden - invalid admin secret' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Resend API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse request ──
    const body = await req.json();
    const { deliveries } = body as { deliveries: { email: string; batch_id: string }[] };

    if (!deliveries || !Array.isArray(deliveries) || deliveries.length === 0) {
      return new Response(JSON.stringify({ error: 'deliveries array is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (deliveries.length > 50) {
      return new Response(JSON.stringify({ error: 'Max 50 deliveries per request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const azureAccountName = Deno.env.get('AZURE_ACCOUNT_NAME') ?? '';
    const azureAccountKey = Deno.env.get('AZURE_ACCOUNT_KEY') ?? '';
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const EXPIRY_HOURS = 48;
    const results: { email: string; batch_id: string; status: 'sent' | 'failed'; error?: string }[] = [];

    for (const delivery of deliveries) {
      try {
        const { email, batch_id } = delivery;
        if (!email || !batch_id) {
          results.push({ email: email || '', batch_id: batch_id || '', status: 'failed', error: 'Missing email or batch_id' });
          continue;
        }

        // Fetch batch info
        const { data: batch, error: batchErr } = await supabaseAdmin
          .from('batch_jobs')
          .select('*')
          .eq('id', batch_id)
          .single();
        if (batchErr || !batch) {
          results.push({ email, batch_id, status: 'failed', error: 'Batch not found' });
          continue;
        }

        // Fetch completed images with results
        const { data: images, error: imgErr } = await supabaseAdmin
          .from('batch_images')
          .select('*')
          .eq('batch_id', batch_id)
          .eq('status', 'completed')
          .not('result_url', 'is', null)
          .order('sequence_number', { ascending: true });

        if (imgErr || !images || images.length === 0) {
          results.push({ email, batch_id, status: 'failed', error: 'No completed images with results' });
          continue;
        }

        // Generate SAS URLs for result images
        const imageLinks = await Promise.all(images.map(async (img: any) => ({
          sequence: img.sequence_number,
          url: await generateSasUrl(img.result_url, azureAccountName, azureAccountKey, EXPIRY_HOURS),
        })));

        const recipientName = batch.user_display_name || email.split('@')[0];
        const html = buildEmailHtml({
          recipientName,
          category: batch.jewelry_category,
          totalImages: imageLinks.length,
          imageLinks,
          expiryHours: EXPIRY_HOURS,
        });

        // Send via Resend
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'FormaNova <noreply@formanova.ai>',
            to: [email],
            subject: `Your ${batch.jewelry_category} results are ready — FormaNova`,
            html,
          }),
        });

        if (!resendResponse.ok) {
          const errText = await resendResponse.text();
          console.error(`[send-results-email] Resend failed for ${email}:`, errText);
          results.push({ email, batch_id, status: 'failed', error: `Resend error: ${resendResponse.status}` });
          continue;
        }

        await resendResponse.json(); // consume body

        // Update batch status to delivered
        await supabaseAdmin
          .from('batch_jobs')
          .update({ status: 'delivered', updated_at: new Date().toISOString() })
          .eq('id', batch_id);

        console.log(`[send-results-email] Email sent to ${email} for batch ${batch_id} (${imageLinks.length} images)`);
        results.push({ email, batch_id, status: 'sent' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[send-results-email] Error for delivery:`, err);
        results.push({ email: delivery.email || '', batch_id: delivery.batch_id || '', status: 'failed', error: msg });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;
    console.log(`[send-results-email] Complete: ${sent} sent, ${failed} failed by ${user.email}`);

    return new Response(JSON.stringify({ results, summary: { sent, failed, total: results.length } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[send-results-email] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
