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

async function fetchPending(supabase: any, statuses: string[]) {
  const { data: batches, error } = await supabase
    .from('batch_jobs')
    .select('*')
    .in('status', statuses)
    .order('created_at', { ascending: true })

  if (error) return jsonResp({ error: error.message }, 500)

  const results = []
  for (const batch of batches || []) {
    const { data: images } = await supabase
      .from('batch_images')
      .select('*')
      .eq('batch_id', batch.id)
      .order('sequence_number', { ascending: true })

    results.push({ ...batch, images: images || [] })
  }

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
  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#111;">
<div style="max-width:600px;margin:0 auto;padding:48px 24px;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#c9a94e;font-size:28px;font-weight:300;letter-spacing:4px;margin:0;">FORMANOVA</h1>
  </div>
  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:40px 32px;text-align:center;">
    <h2 style="color:#fff;font-size:22px;font-weight:400;margin:0 0 12px;">Your results are ready</h2>
    <p style="color:#999;font-size:15px;margin:0 0 32px;">
      ${count} photo${count > 1 ? 's' : ''} ready to view and download.
    </p>
    <a href="${viewUrl}"
       style="display:inline-block;background:#c9a94e;color:#111;padding:14px 44px;
              text-decoration:none;font-weight:600;font-size:15px;border-radius:4px;
              letter-spacing:1px;">
      View Your Photos
    </a>
    <p style="color:#666;font-size:12px;margin:32px 0 0;">
      Pro Tip: These photos are perfect for e-commerce, social media, and lookbooks.
    </p>
  </div>
  <p style="color:#444;font-size:11px;text-align:center;margin-top:24px;">
    &copy; FormaNova &middot; Questions? Reply to this email.
  </p>
</div>
</body></html>`

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
        subject: 'Your results are ready — FormaNova',
        html,
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
          return await fetchPending(supabase, statuses)
        }
        default:
          return jsonResp({ error: `Unknown GET action: ${action}` }, 400)
      }
    }

    if (req.method === 'POST') {
      const body = await req.json()
      switch (action) {
        case 'update_image':
          return await updateImage(supabase, body)
        case 'bulk_update':
          return await bulkUpdateImages(supabase, body)
        case 'deliver':
          return await deliver(supabase, body)
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
