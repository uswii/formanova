import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@4.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  };
}

// Input validation schemas
const SkinToneSchema = z.enum(['fair', 'light', 'medium', 'tan', 'dark', 'deep']);
const JewelryCategorySchema = z.enum(['necklace', 'earring', 'ring', 'bracelet', 'watch']);

const ClassificationSchema = z.object({
  category: z.string().max(100),
  is_worn: z.boolean(),
  flagged: z.boolean(),
}).optional();

const BatchImageSchema = z.object({
  data_uri: z.string()
    .regex(/^data:image\/(jpeg|png|webp|jpg);base64,/, 'Invalid image data URI format')
    .max(15_000_000, 'Image too large (max 10MB)'),
  skin_tone: SkinToneSchema.optional(),
  classification: ClassificationSchema,
  inspiration_data_uri: z.string().max(15_000_000).optional().nullable(),
});

const BatchSubmitRequestSchema = z.object({
  jewelry_category: JewelryCategorySchema,
  images: z.array(BatchImageSchema).min(1, 'At least one image required').max(10, 'Maximum 10 images per batch'),
  notification_email: z.string().email().max(255).optional(),
  global_inspiration_data_uri: z.string().max(15_000_000).optional().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// SERVICE URLs — Edit these directly when endpoints change
// ═══════════════════════════════════════════════════════════════
const AUTH_SERVICE_URL = Deno.env.get('AUTH_SERVICE_URL') || 'https://formanova.ai/auth';
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || '').split(',').map(e => e.trim()).filter(Boolean);

// Azure Blob Storage config
const AZURE_ACCOUNT_NAME = Deno.env.get('AZURE_ACCOUNT_NAME') || '';
const AZURE_ACCOUNT_KEY = Deno.env.get('AZURE_ACCOUNT_KEY') || '';
const AZURE_CONTAINER_NAME = Deno.env.get('AZURE_CONTAINER_NAME') || 'jewelry-uploads';

// Supabase config
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Resend for email notifications
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';

interface BatchImage {
  data_uri: string;
  skin_tone?: string;
  classification?: {
    category: string;
    is_worn: boolean;
    flagged: boolean;
  };
  inspiration_data_uri?: string | null;
}

interface BatchSubmitRequest {
  jewelry_category: 'necklace' | 'earring' | 'ring' | 'bracelet' | 'watch';
  notification_email?: string;
  images: BatchImage[];
  global_inspiration_data_uri?: string | null;
}

interface UserInfo {
  id: string;
  email: string;
  display_name?: string;
}

// Authenticate request against custom auth service
async function authenticateRequest(req: Request): Promise<UserInfo | null> {
  const userToken = req.headers.get('X-User-Token');
  if (!userToken) {
    console.log('[batch-submit] Missing X-User-Token header');
    return null;
  }

  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/users/me`, {
      headers: { 
        'Authorization': `Bearer ${userToken}`,
      },
    });

    if (!response.ok) {
      console.log('[batch-submit] Token validation failed:', response.status);
      return null;
    }

    const user = await response.json();
    return {
      id: user.id || user.sub,
      email: user.email,
      display_name: user.display_name || user.name,
    };
  } catch (e) {
    console.error('[batch-submit] Auth service error:', e);
    return null;
  }
}

// Upload image to Azure Blob Storage
async function uploadToAzure(dataUri: string, blobPath: string): Promise<string> {
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URI format');
  }

  const contentType = matches[1];
  const base64Data = matches[2];
  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  const now = new Date();
  const dateString = now.toUTCString();

  const canonicalizedHeaders = `x-ms-blob-type:BlockBlob\nx-ms-date:${dateString}\nx-ms-version:2022-11-02`;
  const canonicalizedResource = `/${AZURE_ACCOUNT_NAME}/${AZURE_CONTAINER_NAME}/${blobPath}`;
  
  const stringToSign = [
    'PUT', '', '', binaryData.length.toString(), '', contentType, '', '', '', '', '', '',
    canonicalizedHeaders, canonicalizedResource,
  ].join('\n');

  const keyData = Uint8Array.from(atob(AZURE_ACCOUNT_KEY), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(stringToSign));
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  const blobUrl = `https://${AZURE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${blobPath}`;

  const response = await fetch(blobUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': binaryData.length.toString(),
      'x-ms-blob-type': 'BlockBlob',
      'x-ms-date': dateString,
      'x-ms-version': '2022-11-02',
      'Authorization': `SharedKey ${AZURE_ACCOUNT_NAME}:${signature}`,
    },
    body: binaryData,
  });

  if (!response.ok) {
    throw new Error(`Azure upload failed: ${response.status}`);
  }

  return blobUrl;
}

serve(async (req) => {
  // Top-level CORS — always set, even if everything else fails
  let corsHeaders: Record<string, string>;
  try {
    corsHeaders = getCorsHeaders(req);
  } catch {
    corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    };
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {

  // ── PATCH: Update notification email for existing batch ──
  if (req.method === 'PATCH') {
    try {
      console.log('[batch-submit] PATCH request received');
      const user = await authenticateRequest(req);
      if (!user) {
        console.log('[batch-submit] PATCH auth failed');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('[batch-submit] PATCH authenticated user:', user.email);

      const body = await req.json();
      const { batch_id, notification_email } = body;
      if (!batch_id || !notification_email) {
        return new Response(
          JSON.stringify({ error: 'Missing batch_id or notification_email' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate email format server-side
      const emailSchema = z.string().trim().email('Invalid email address').max(255, 'Email too long');
      const emailResult = emailSchema.safeParse(notification_email);
      if (!emailResult.success) {
        return new Response(
          JSON.stringify({ error: emailResult.error.issues[0]?.message || 'Invalid email address' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const validatedEmail = emailResult.data;

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // Only allow updating own batches
      const { data: batch, error: fetchError } = await supabase
        .from('batch_jobs')
        .select('user_id')
        .eq('id', batch_id)
        .single();

      if (fetchError || !batch || batch.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Batch not found or access denied' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabase
        .from('batch_jobs')
        .update({ notification_email: validatedEmail })
        .eq('id', batch_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update email', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, notification_email: validatedEmail }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('[batch-submit] PATCH error:', error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: BatchSubmitRequest = await req.json();
    
    if (!body.jewelry_category || !body.images || body.images.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: jewelry_category, images' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.images.length > 10) {
      return new Response(
        JSON.stringify({ error: 'Maximum 10 images per batch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const batchId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Upload global inspiration image if provided
    let globalInspirationUrl: string | null = null;
    if (body.global_inspiration_data_uri) {
      try {
        const inspPath = `batches/${user.id}/${batchId}/${timestamp}_inspiration_global.jpg`;
        globalInspirationUrl = await uploadToAzure(body.global_inspiration_data_uri, inspPath);
        console.log('[batch-submit] Global inspiration uploaded:', inspPath);
      } catch (inspErr) {
        console.error('[batch-submit] Failed to upload global inspiration:', inspErr);
        // Non-blocking — continue without inspiration
      }
    }
    
    const imageRecords: Array<{
      batch_id: string;
      sequence_number: number;
      original_url: string;
      skin_tone: string | null;
      classification_category: string | null;
      classification_is_worn: boolean | null;
      classification_flagged: boolean | null;
      status: string;
      inspiration_url: string | null;
    }> = [];

    for (let i = 0; i < body.images.length; i++) {
      const img = body.images[i];
      const blobPath = `batches/${user.id}/${batchId}/${timestamp}_${i + 1}.jpg`;
      
      try {
        const azureUrl = await uploadToAzure(img.data_uri, blobPath);

        // Upload per-image inspiration if provided
        let perImageInspirationUrl: string | null = null;
        if (img.inspiration_data_uri) {
          try {
            const inspPath = `batches/${user.id}/${batchId}/${timestamp}_inspiration_${i + 1}.jpg`;
            perImageInspirationUrl = await uploadToAzure(img.inspiration_data_uri, inspPath);
            console.log(`[batch-submit] Per-image inspiration uploaded for image ${i + 1}`);
          } catch (inspErr) {
            console.error(`[batch-submit] Failed to upload inspiration for image ${i + 1}:`, inspErr);
          }
        }

        imageRecords.push({
          batch_id: batchId,
          sequence_number: i + 1,
          original_url: azureUrl,
          skin_tone: img.skin_tone || null,
          classification_category: img.classification?.category || null,
          classification_is_worn: img.classification?.is_worn ?? null,
          classification_flagged: img.classification?.flagged ?? null,
          status: 'pending',
          inspiration_url: perImageInspirationUrl,
        });
      } catch (uploadError) {
        console.error(`[batch-submit] Failed to upload image ${i + 1}:`, uploadError);
      }
    }

    if (imageRecords.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Failed to upload any images' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: batchError } = await supabase
      .from('batch_jobs')
      .insert({
        id: batchId,
        user_id: user.id,
        user_email: user.email,
        user_display_name: user.display_name || null,
        jewelry_category: body.jewelry_category,
        notification_email: body.notification_email || user.email,
        total_images: imageRecords.length,
        status: 'pending',
        inspiration_url: globalInspirationUrl,
      });

    if (batchError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create batch record', details: batchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: imagesError } = await supabase.from('batch_images').insert(imageRecords);

    if (imagesError) {
      await supabase.from('batch_jobs').delete().eq('id', batchId);
      return new Response(
        JSON.stringify({ error: 'Failed to save image records', details: imagesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send admin notification (non-blocking)
    if (RESEND_API_KEY && ADMIN_EMAILS.length > 0) {
      try {
        console.log('[batch-submit] Sending email to:', ADMIN_EMAILS);
        const resend = new Resend(RESEND_API_KEY);
        const hasInspiration = !!globalInspirationUrl || imageRecords.some(r => r.inspiration_url);
        // onboarding@resend.dev can only send to account owner — send individually, skip failures
        const emailPromises = ADMIN_EMAILS.map(email =>
          resend.emails.send({
            from: 'FormaNova <onboarding@resend.dev>',
            to: [email],
          subject: `New Batch: ${user.email} submitted ${imageRecords.length} ${body.jewelry_category} images`,
          html: `<p><strong>User:</strong> ${user.email} (${user.display_name || 'N/A'})</p><p><strong>Batch ID:</strong> ${batchId}</p><p><strong>Category:</strong> ${body.jewelry_category}</p><p><strong>Images:</strong> ${imageRecords.length}</p><p><strong>Notification email:</strong> ${body.notification_email || user.email}</p><p><strong>Inspiration:</strong> ${hasInspiration ? 'Yes' : 'No'}${globalInspirationUrl ? ' (global)' : ''}${imageRecords.filter(r => r.inspiration_url).length > 0 ? ` + ${imageRecords.filter(r => r.inspiration_url).length} per-image` : ''}</p>`,
          }).catch(e => ({ error: e, email }))
        );
        const emailResults = await Promise.allSettled(emailPromises);
        console.log('[batch-submit] Email results:', JSON.stringify(emailResults.map((r, i) => ({ email: ADMIN_EMAILS[i], status: r.status }))));
      } catch (emailError) {
        console.error('[batch-submit] Email failed:', emailError instanceof Error ? emailError.message : emailError);
      }
    } else {
      console.warn('[batch-submit] Skipping email: RESEND_API_KEY=', !!RESEND_API_KEY, 'ADMIN_EMAILS=', ADMIN_EMAILS.length);
    }

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batchId,
        image_count: imageRecords.length,
        message: `Batch submitted successfully.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[batch-submit] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  } catch (outerError) {
    // Catch-all: guarantees CORS headers even on unexpected crashes
    console.error('[batch-submit] Unhandled outer error:', outerError);
    const fallbackCors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    };
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...fallbackCors, 'Content-Type': 'application/json' } }
    );
  }
});