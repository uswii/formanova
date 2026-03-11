const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const RECIPIENTS = [
  { name: "Chetan", email: "chetanmittal98@gmail.com" },
  { name: "Kashish", email: "creative@zavya.co" },
  { name: "Hitesh", email: "kumathhitesh@icloud.com" },
  { name: "Puneet", email: "vibbhav@gmail.com" },
  { name: "Madhusudhan", email: "sreeramvmadhusudhan@gmail.com" },
  { name: "Vineeth", email: "vineethtated123@gmail.com" },
  { name: "Davender", email: "kumar.davender87@gmail.com" },
  { name: "Allan", email: "thecovyjewels@gmail.com" },
];

const SURVEY_URL = "https://formanova.lovable.app/feedback";

function buildHtml(name: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background-color:#ffffff;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;line-height:1.7"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff"><tr><td align="center" style="padding:40px 20px"><table role="presentation" width="100%" style="max-width:560px"><tr><td style="padding-bottom:32px"><p style="margin:0 0 20px;font-size:17px">Namaste ${name},</p><p style="margin:0 0 20px;font-size:17px">I am the founder of Forma Nova. I saw you recently used our AI for your jewelry photos. Thank you for being one of our first customers!</p><p style="margin:0 0 20px;font-size:17px">I want to make sure Forma Nova is helping your business grow. Could you please answer 4 very short questions?</p><p style="margin:0 0 28px;text-align:center"><a href="${SURVEY_URL}" style="display:inline-block;background-color:#1a1a1a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-family:Georgia,serif;font-size:16px;white-space:nowrap">💎 Click here to start (takes 2 mins)</a></p><p style="margin:0 0 20px;font-size:17px">As a &quot;thank you&quot; for your time, I will add <strong>20 free credits</strong> to your account immediately after you finish!</p><p style="margin:0 0 20px;font-size:17px">Your feedback helps me build the right features for you.</p><p style="margin:28px 0 4px;font-size:17px">Warm regards,</p><p style="margin:0 0 4px;font-size:17px"><strong>Sophie Pervez</strong></p><p style="margin:0 0 4px;font-size:15px;color:#666">Founder, Forma Nova</p><p style="margin:0;font-size:14px"><a href="https://www.linkedin.com/in/sophiapervez/" style="color:#1a1a1a;text-decoration:underline">LinkedIn</a></p></td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Build batch payload for Resend Batch API
    const emails = RECIPIENTS.map((r) => ({
      from: "Sophie — Forma Nova <studio@formanova.ai>",
      reply_to: "studio@formanova.ai",
      to: [r.email],
      subject: "Your gift from Forma Nova (+ quick feedback)",
      html: buildHtml(r.name),
    }));

    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emails),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[feedback-campaign] Resend error:", JSON.stringify(data));
      return new Response(JSON.stringify({ success: false, error: data }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[feedback-campaign] Sent ${RECIPIENTS.length} emails successfully`);

    return new Response(
      JSON.stringify({ success: true, sent: RECIPIENTS.length, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("[feedback-campaign] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
