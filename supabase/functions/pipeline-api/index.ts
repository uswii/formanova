import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ==================== FETCH PENDING BATCHES ====================

async function fetchPending(supabase: any, statuses: string[], limit = 10) {
  // Fetch only a limited number of batches to avoid timeout
  const { data: batches, error } = await supabase
    .from('batch_jobs')
    .select('*')
    .in('status', statuses)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) return jsonResp({ error: error.message }, 500)
  if (!batches?.length) return jsonResp({ batches: [], count: 0 })

  // Fetch ALL images for these batches in ONE query (not N+1)
  const batchIds = batches.map((b: any) => b.id)
  const { data: allImages, error: imgErr } = await supabase
    .from('batch_images')
    .select('*')
    .in('batch_id', batchIds)
    .order('sequence_number', { ascending: true })

  if (imgErr) return jsonResp({ error: imgErr.message }, 500)

  // Group images by batch_id
  const imagesByBatch: Record<string, any[]> = {}
  for (const img of allImages || []) {
    if (!imagesByBatch[img.batch_id]) imagesByBatch[img.batch_id] = []
    imagesByBatch[img.batch_id].push(img)
  }

  const results = batches.map((b: any) => ({
    ...b,
    images: imagesByBatch[b.id] || [],
  }))

  return jsonResp({ batches: results, count: results.length })
}

// ==================== UPDATE SINGLE IMAGE ====================

async function updateImage(supabase: any, body: any) {
  const { image_id, status, result_url, error_message } = body

  if (!image_id || !status) {
    return jsonResp({ error: 'image_id and status required' }, 400)
  }

  const update: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (result_url) update.result_url = result_url
  if (error_message) update.error_message = error_message
  if (status === 'completed') {
    update.processing_completed_at = new Date().toISOString()
  }
  if (status === 'processing') {
    update.processing_started_at = new Date().toISOString()
  }

  const { error: updateErr } = await supabase
    .from('batch_images')
    .update(update)
    .eq('id', image_id)

  if (updateErr) return jsonResp({ error: updateErr.message }, 500)

  // Recalculate batch counts
  const { data: img } = await supabase
    .from('batch_images')
    .select('batch_id')
    .eq('id', image_id)
    .single()

  if (img) {
    await recalcBatchCounts(supabase, img.batch_id)
  }

  return jsonResp({ success: true })
}

// ==================== BULK UPDATE IMAGES ====================

async function bulkUpdateImages(supabase: any, body: any) {
  const { updates } = body
  // updates: [{ image_id, status, result_url?, error_message? }]

  if (!updates?.length) {
    return jsonResp({ error: 'updates[] required' }, 400)
  }

  const batchIds = new Set<string>()
  const errors: string[] = []

  for (const u of updates) {
    const update: Record<string, any> = {
      status: u.status,
      updated_at: new Date().toISOString(),
    }
    if (u.result_url) update.result_url = u.result_url
    if (u.error_message) update.error_message = u.error_message
    if (u.status === 'completed') update.processing_completed_at = new Date().toISOString()

    const { error } = await supabase
      .from('batch_images')
      .update(update)
      .eq('id', u.image_id)

    if (error) {
      errors.push(`${u.image_id}: ${error.message}`)
    }

    // Track batch for count recalc
    const { data: img } = await supabase
      .from('batch_images')
      .select('batch_id')
      .eq('id', u.image_id)
      .single()

    if (img) batchIds.add(img.batch_id)
  }

  // Recalculate all affected batches
  for (const batchId of batchIds) {
    await recalcBatchCounts(supabase, batchId)
  }

  return jsonResp({
    success: errors.length === 0,
    updated: updates.length - errors.length,
    errors,
  })
}

// ==================== RECALC BATCH COUNTS ====================

async function recalcBatchCounts(supabase: any, batchId: string) {
  const { data: allImages } = await supabase
    .from('batch_images')
    .select('status')
    .eq('batch_id', batchId)

  if (!allImages) return

  const total = allImages.length
  const completed = allImages.filter((i: any) => i.status === 'completed').length
  const failed = allImages.filter((i: any) => i.status === 'failed').length

  const batchUpdate: Record<string, any> = {
    completed_images: completed,
    failed_images: failed,
    updated_at: new Date().toISOString(),
  }

  if (completed + failed >= total) {
    batchUpdate.status = failed === total ? 'failed' : 'completed'
    batchUpdate.completed_at = new Date().toISOString()
  } else if (completed > 0 || failed > 0) {
    batchUpdate.status = 'processing'
  }

  await supabase.from('batch_jobs').update(batchUpdate).eq('id', batchId)
}

// ==================== DELIVER ====================

async function deliver(supabase: any, body: any) {
  const { batch_id, images } = body
  // images: [{ image_id, result_url, filename }]

  if (!batch_id || !images?.length) {
    return jsonResp({ error: 'batch_id and images[] required' }, 400)
  }

  // Get batch info
  const { data: batch, error: batchErr } = await supabase
    .from('batch_jobs')
    .select('*')
    .eq('id', batch_id)
    .single()

  if (batchErr || !batch) {
    return jsonResp({ error: 'Batch not found' }, 404)
  }

  const recipientEmail = batch.notification_email || batch.user_email
  const safeEmail = recipientEmail.replace('@', '_at_').replace(/\./g, '_')
  const token = crypto.randomUUID()

  // Create delivery_batches record
  const { data: deliveryBatch, error: dbErr } = await supabase
    .from('delivery_batches')
    .insert({
      batch_id,
      user_email: recipientEmail,
      safe_email: safeEmail,
      category: batch.jewelry_category,
      token,
      delivery_status: 'completed',
    })
    .select()
    .single()

  if (dbErr) return jsonResp({ error: dbErr.message }, 500)

  // Create delivery_images
  const deliveryImages = images.map((img: any, idx: number) => ({
    delivery_batch_id: deliveryBatch.id,
    image_url: img.result_url,
    image_filename: img.filename || `result_${idx + 1}.jpg`,
    sequence: idx + 1,
  }))

  const { error: diErr } = await supabase
    .from('delivery_images')
    .insert(deliveryImages)

  if (diErr) return jsonResp({ error: diErr.message }, 500)

  // Sync result_url back to batch_images
  for (const img of images) {
    if (img.image_id && img.result_url) {
      await supabase
        .from('batch_images')
        .update({ result_url: img.result_url })
        .eq('id', img.image_id)
    }
  }

  // Send email
  const emailOk = await sendDeliveryEmail(recipientEmail, token, images.length)

  // Update delivery status
  const now = new Date().toISOString()
  if (emailOk) {
    await supabase
      .from('delivery_batches')
      .update({
        delivery_status: 'delivered',
        delivered_at: now,
        email_sent_at: now,
      })
      .eq('id', deliveryBatch.id)
  }

  // Mark batch as delivered
  await supabase
    .from('batch_jobs')
    .update({ status: 'delivered', updated_at: now })
    .eq('id', batch_id)

  return jsonResp({
    success: true,
    token,
    email_sent: emailOk,
    delivery_url: `https://formanova.ai/yourresults/${token}`,
    images_delivered: images.length,
  })
}

// ==================== EMAIL ====================

async function sendDeliveryEmail(
  to: string,
  token: string,
  count: number,
): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return false

  const viewUrl = `https://formanova.ai/yourresults/${token}`
  const messageId = `<${crypto.randomUUID()}@formanova.ai>`
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:40px;">
      <h1 style="color:#c8a97e;font-size:28px;letter-spacing:6px;font-weight:300;margin:0;">FORMANOVA</h1>
      <div style="width:60px;height:1px;background:linear-gradient(90deg,transparent,#c8a97e,transparent);margin:16px auto;"></div>
    </div>

    <!-- Body -->
    <div style="background-color:#111;border:1px solid #222;border-radius:8px;padding:32px;">
      <p style="color:#e0e0e0;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Dear user,
      </p>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Thank you for using Forma Nova to create your jewelry photos. Your requested images are attached.
      </p>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 24px;">
        If you have any questions or feedback, please email us at
        <a href="mailto:studio@formanova.ai" style="color:#c8a97e;text-decoration:none;">studio@formanova.ai</a>
        and a member of our team will get back to you.
      </p>

      <!-- Pro Tip -->
      <div style="background-color:#1a1a1a;border-radius:6px;padding:16px;margin-bottom:24px;">
        <p style="color:#c8a97e;font-size:13px;font-weight:600;margin:0 0 8px;">💡 Pro Tip</p>
        <p style="color:#999;font-size:13px;line-height:1.5;margin:0;">
          For the best results, please upload worn images (jewelry on a person) rather than product-only images.
          If you need a specific model, look, background, or vibe, use the &ldquo;Inspirational Photos&rdquo; option
          to upload reference images that match your desired final result.
        </p>
      </div>

      <!-- Total Photos -->
      <div style="text-align:center;margin-bottom:24px;">
        <p style="color:#777;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Total Photos Attached</p>
        <p style="color:#c8a97e;font-size:28px;font-weight:600;margin:0;">${count}</p>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${viewUrl}"
           style="display:inline-block;background:#c8a97e;color:#0a0a0a;padding:14px 44px;
                  text-decoration:none;font-weight:600;font-size:15px;border-radius:4px;
                  letter-spacing:1px;">
          View Your Photos
        </a>
      </div>
      <p style="color:#666;font-size:12px;text-align:center;margin:0 0 24px;">
        Click the button above to view and download your photos on our secure gallery.
      </p>

      <p style="color:#999;font-size:14px;line-height:1.6;margin:0;">
        Warmest Regards,<br>
        <strong style="color:#c8a97e;">Forma Nova AI Agent</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;">
      <p style="color:#555;font-size:11px;margin:0;">
        &copy; ${new Date().getFullYear()} Forma Nova &middot; AI-Powered Jewelry Photography
      </p>
    </div>
  </div>
</body>
</html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FormaNova <studio@formanova.ai>',
        to: [to],
        reply_to: 'studio@formanova.ai',
        subject: 'Your photos are ready — Forma Nova',
        html,
        headers: {
          'Message-ID': messageId,
          'References': messageId,
          'X-Entity-Ref-ID': messageId,
        },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ==================== MAIN ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Auth via API key
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey || apiKey !== Deno.env.get('ADMIN_SECRET')) {
      return jsonResp({ error: 'Unauthorized' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    if (req.method === 'GET') {
      switch (action) {
        case 'fetch_pending': {
          const statuses = url.searchParams.get('statuses')?.split(',') || ['pending']
          const limit = parseInt(url.searchParams.get('limit') || '10', 10)
          return await fetchPending(supabase, statuses, Math.min(limit, 50))
        }
        default:
          return jsonResp({ error: `Unknown GET action: ${action}` }, 400)
      }
    }

    if (req.method === 'POST') {
      let body = {}
      try { body = await req.json() } catch { /* empty body is ok for admin actions */ }
      switch (action) {
        case 'update_image':
          return await updateImage(supabase, body)
        case 'bulk_update':
          return await bulkUpdateImages(supabase, body)
        case 'deliver':
          return await deliver(supabase, body)
        case 'kill_locks': {
          // Terminate all idle-in-transaction connections that are blocking queries
          const { data, error } = await supabase.rpc('terminate_blocked_connections')
          if (error) {
            // Fallback: try direct query via pg_stat_activity
            const { data: locks, error: lockErr } = await supabase
              .from('pg_stat_activity' as any)
              .select('pid, state, query, wait_event_type')
              .in('state', ['idle in transaction', 'idle in transaction (aborted)'])
            return jsonResp({ 
              message: 'Cannot terminate directly from edge function. Use Supabase SQL Editor to run: SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = \'idle in transaction\';',
              visible_locks: locks || [],
              error: lockErr?.message 
            })
          }
          return jsonResp({ success: true, terminated: data })
        }
        default:
          return jsonResp({ error: `Unknown POST action: ${action}` }, 400)
      }
    }

    return jsonResp({ error: 'Method not allowed' }, 405)
  } catch (err: any) {
    console.error('Pipeline API error:', err)
    return jsonResp({ error: err.message || 'Internal error' }, 500)
  }
})
