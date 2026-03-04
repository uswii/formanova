import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Mode 1: single send (existing behavior)
    if (body.to) {
      const { to, subject, html } = body;
      if (!subject || !html) {
        return new Response(JSON.stringify({ error: 'Missing subject or html' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const recipients = Array.isArray(to) ? to : [to];
      const result = await sendEmail(recipients, subject, html);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mode 2: blast to all batch submitters
    if (body.blast === true) {
      const { subject, html, campaign, dry_run } = body;
      if (!subject || !html || !campaign) {
        return new Response(JSON.stringify({ error: 'Missing subject, html, or campaign' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Paginate through all batch_jobs to get every email
      const allEmails = new Set<string>();
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data: batches, error: bErr } = await supabase
          .from('batch_jobs')
          .select('user_email, notification_email')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (bErr) throw bErr;
        if (!batches || batches.length === 0) break;
        for (const b of batches) {
          allEmails.add(b.notification_email || b.user_email);
        }
        if (batches.length < pageSize) break;
        page++;
      }

      // Get already-sent emails for this campaign (also paginated)
      const sentSet = new Set<string>();
      page = 0;
      while (true) {
        const { data: sent } = await supabase
          .from('notification_log')
          .select('user_email')
          .eq('campaign', campaign)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (!sent || sent.length === 0) break;
        for (const s of sent) sentSet.add(s.user_email);
        if (sent.length < pageSize) break;
        page++;
      }

      const toSend = [...allEmails].filter(e => !sentSet.has(e));

      if (dry_run) {
        return new Response(JSON.stringify({
          total_unique: allEmails.size,
          already_sent: sentSet.size,
          to_send: toSend.length,
          sample: toSend.slice(0, 10),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Resend batch API: max 100 emails per call, 2 req/sec rate limit
      let sentCount = 0;
      let failedCount = 0;
      const batchSize = 100;

      for (let i = 0; i < toSend.length; i += batchSize) {
        const chunk = toSend.slice(i, i + batchSize);
        
        try {
          const emails = chunk.map(email => ({
            from: 'FormaNova <noreply@formanova.ai>',
            reply_to: 'studio@formanova.ai',
            to: [email],
            subject,
            html,
          }));

          const res = await fetch('https://api.resend.com/emails/batch', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(emails),
          });

          const data = await res.json();
          
          if (res.ok) {
            sentCount += chunk.length;
            const logs = chunk.map(email => ({ user_email: email, campaign }));
            await supabase.from('notification_log').insert(logs);
            console.log(`Batch ${Math.floor(i/batchSize)+1}: sent ${chunk.length}`);
          } else {
            failedCount += chunk.length;
            console.error(`Batch ${Math.floor(i/batchSize)+1} failed:`, data);
          }
        } catch (e) {
          failedCount += chunk.length;
          console.error(`Batch error:`, e);
        }

        // Wait 1.5s between batch API calls to stay under rate limit
        if (i + batchSize < toSend.length) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      return new Response(JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        total: toSend.length,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-announcement] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendEmail(recipients: string[], subject: string, html: string) {
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'FormaNova <noreply@formanova.ai>',
      reply_to: 'studio@formanova.ai',
      to: recipients,
      subject,
      html,
    }),
  });

  const data = await resendResponse.json();
  if (!resendResponse.ok) {
    return { success: false, error: data };
  }
  return { success: true, data };
}
