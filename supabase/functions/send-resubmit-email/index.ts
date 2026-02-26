import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token, x-admin-secret',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET') || '';
const AUTH_SERVICE_URL = Deno.env.get('AUTH_SERVICE_URL') || '';
const ADMIN_EMAILS_RAW = Deno.env.get('ADMIN_EMAILS') || '';
const FRONTEND_URL = 'https://formanova.lovable.app';

function getAdminEmails(): string[] {
  if (!ADMIN_EMAILS_RAW) return [];
  return ADMIN_EMAILS_RAW.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

async function authenticateAdmin(req: Request): Promise<boolean> {
  const userToken = req.headers.get('X-User-Token');
  if (!userToken) return false;
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });
    if (!response.ok) return false;
    const user = await response.json();
    const email = (user.email || '').toLowerCase();
    const adminEmails = getAdminEmails();
    return adminEmails.length === 0 || adminEmails.includes(email);
  } catch {
    return false;
  }
}

function buildResubmitEmailHtml(recipientEmail: string, category: string, flaggedCount: number): string {
  // Upload guide image hosted on the published app
  const guideImageUrl = `${FRONTEND_URL}/email-examples/upload-guide.png`;

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
      <p style="color: #c8a97e; font-size: 16px; font-weight: 600; margin: 0 0 24px; text-transform: uppercase; letter-spacing: 1px;">
        Request to Resubmit Images
      </p>

      <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
        Dear user,
      </p>

      <p style="color: #ccc; font-size: 14px; line-height: 1.7; margin: 0 0 16px;">
        We would love to create amazing images for you. However, <strong style="color: #c8a97e;">${flaggedCount}</strong> of the inputs you provided in your <strong style="color: #c8a97e; text-transform: capitalize;">${category}</strong> batch do not match the required format for processing.
      </p>

      <p style="color: #ccc; font-size: 14px; line-height: 1.7; margin: 0 0 24px;">
        Kindly review the style guide below and resubmit your images accordingly so we may proceed.
      </p>

      <!-- Upload Guide Image -->
      <div style="margin: 24px 0; text-align: center;">
        <img src="${guideImageUrl}" alt="Upload Guide - Jewelry must be worn on person" 
             style="max-width: 100%; border-radius: 8px; border: 1px solid #222;" />
      </div>

      <div style="background-color: #1a1a1a; border-radius: 6px; padding: 16px; margin: 24px 0; border-left: 3px solid #c8a97e;">
        <p style="color: #e0e0e0; font-size: 13px; margin: 0 0 8px; font-weight: 600;">
          💡 Quick Tips:
        </p>
        <ul style="color: #999; font-size: 13px; line-height: 1.8; margin: 0; padding-left: 16px;">
          <li>Upload photos of jewelry <strong style="color: #ccc;">worn on a person</strong></li>
          <li>Avoid product shots, flatlay images, or 3D renders</li>
          <li>Clear, well-lit photos produce the best results</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 32px 0 16px;">
        <a href="${FRONTEND_URL}/bulk-upload" 
           style="display: inline-block; background: #c8a97e; color: #0a0a0a; padding: 14px 32px; 
                  text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 14px;
                  letter-spacing: 0.5px;">
          Resubmit Your Images →
        </a>
      </div>

      <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
        We look forward to receiving your updated inputs.
      </p>

      <p style="color: #ccc; font-size: 14px; margin: 16px 0 0;">
        Warm regards,<br/>
        <strong style="color: #c8a97e;">The FormaNova Team</strong>
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const isAdmin = await authenticateAdmin(req);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const campaign = 'resubmit_flagged_v1';

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch completed batches that have flagged images
    const { data: completedBatches, error: batchErr } = await supabaseAdmin
      .from('batch_jobs')
      .select('id, user_email, notification_email, jewelry_category, user_display_name')
      .eq('status', 'completed');

    if (batchErr || !completedBatches) {
      return new Response(JSON.stringify({ error: 'Failed to fetch batches', details: batchErr }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For each batch, check if it has flagged images
    const batchIds = completedBatches.map(b => b.id);
    const { data: flaggedImages, error: flagErr } = await supabaseAdmin
      .from('batch_images')
      .select('batch_id')
      .in('batch_id', batchIds)
      .eq('classification_flagged', true);

    if (flagErr) {
      return new Response(JSON.stringify({ error: 'Failed to fetch flagged images', details: flagErr }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Count flagged per batch
    const flaggedCounts: Record<string, number> = {};
    for (const img of (flaggedImages || [])) {
      flaggedCounts[img.batch_id] = (flaggedCounts[img.batch_id] || 0) + 1;
    }

    // Filter to only batches with flagged images
    const flaggedBatches = completedBatches
      .filter(b => flaggedCounts[b.id] > 0)
      .map(b => ({
        ...b,
        flagged_count: flaggedCounts[b.id],
        send_to: b.notification_email || b.user_email,
      }));

    // Check notification_log to skip already-sent
    const { data: alreadySent } = await supabaseAdmin
      .from('notification_log')
      .select('user_email')
      .eq('campaign', campaign);

    const sentEmails = new Set((alreadySent || []).map(r => r.user_email.toLowerCase()));

    // Deduplicate by email — send once per unique email, aggregate info
    const emailMap: Record<string, { batches: typeof flaggedBatches; totalFlagged: number }> = {};
    for (const b of flaggedBatches) {
      const email = b.send_to.toLowerCase();
      if (sentEmails.has(email)) continue;
      if (!emailMap[email]) emailMap[email] = { batches: [], totalFlagged: 0 };
      emailMap[email].batches.push(b);
      emailMap[email].totalFlagged += b.flagged_count;
    }

    const recipients = Object.entries(emailMap);

    if (dryRun) {
      return new Response(JSON.stringify({
        dry_run: true,
        will_send: recipients.length,
        already_sent: sentEmails.size,
        recipients: recipients.map(([email, info]) => ({
          email,
          flagged_count: info.totalFlagged,
          categories: info.batches.map(b => b.jewelry_category),
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send emails
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const [email, info] of recipients) {
      try {
        const primaryBatch = info.batches[0];
        const category = info.batches.length === 1 
          ? primaryBatch.jewelry_category 
          : info.batches.map(b => b.jewelry_category).join(', ');

        const html = buildResubmitEmailHtml(email, category, info.totalFlagged);

        const msgId = crypto.randomUUID();
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'FormaNova <noreply@formanova.ai>',
            reply_to: 'studio@formanova.ai',
            to: [email],
            subject: 'Request to Resubmit Images in the Required Format — FormaNova',
            html,
            headers: {
              'Message-ID': `<resubmit-${msgId}@formanova.ai>`,
              'X-Entity-Ref-ID': `resubmit-${msgId}`,
            },
          }),
        });

        if (!resendResponse.ok) {
          const errText = await resendResponse.text();
          console.error(`[send-resubmit] Failed for ${email}:`, errText);
          errors.push(`${email}: ${resendResponse.status}`);
          failed++;
          continue;
        }

        await resendResponse.json();

        // Log to notification_log
        await supabaseAdmin.from('notification_log').insert({
          user_email: email,
          campaign,
        });

        console.log(`[send-resubmit] ✓ Sent to ${email} (${info.totalFlagged} flagged)`);
        sent++;
      } catch (err) {
        console.error(`[send-resubmit] Error for ${email}:`, err);
        errors.push(`${email}: ${String(err)}`);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      summary: { sent, failed, total: recipients.length },
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[send-resubmit] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
