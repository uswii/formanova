

# CSV-Driven Delivery System

## The Problem

1. You renamed downloaded images using `safeemail_counter.jpg` format, ran generation offline, reviewed outputs, and uploaded passed results to Azure under a new structure.
2. The original batch IDs got mixed up during renaming, but the filename itself preserves which user each image belongs to.
3. The current `send-results-email` edge function tries to look up images from the original `batch_jobs`/`batch_images` tables -- which no longer match.
4. When users click download links in emails, they see an XML `AuthenticationFailed` error because the SAS signature in the `send-results-email` function is malformed (different signing format than the working `azure-get-sas` function).

## Solution Overview

Build a standalone delivery layer that:
- Accepts a CSV (with `batch_id`, `user_email`, `safe_email`, `image_url` columns) as the single source of truth
- Groups images by `batch_id` + `user_email` for preview before sending
- On send: generates a unique token per delivery, emails the user a link to `/results/{token}`
- The results page proxies downloads through the edge function (fixing the XML auth error permanently -- users never touch SAS URLs)
- Status tracks actual email state: `completed` on CSV upload, `delivered` only after successful Resend response

```text
Admin uploads CSV
       |
  Parse & group by batch_id + user_email
       |
  Store in delivery_batches + delivery_images (status: completed)
       |
  Admin previews mapping, verifies correctness
       |
  Admin triggers send
       |
  Generate unique token per delivery batch
       |
  Send email via Resend with link: /results/{token}
       |
  On success: status -> delivered, set timestamps
       |
  User clicks link -> public gallery page
       |
  Download button -> edge function proxies Azure blob directly
  (no SAS in browser, no XML error)
```

## Database Changes

### Table: `delivery_batches`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | PK |
| batch_id | text | required | From CSV, groups the delivery |
| user_email | text | required | From CSV |
| safe_email | text | required | Filename-safe format from CSV |
| override_email | text | null | Admin can set different recipient |
| category | text | null | e.g. "necklace" |
| token | text | null | Generated on send, unique |
| delivery_status | text | 'completed' | completed -> delivered |
| delivered_at | timestamptz | null | Set on successful email |
| email_sent_at | timestamptz | null | Set on successful email |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### Table: `delivery_images`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | PK |
| delivery_batch_id | uuid | required | FK to delivery_batches |
| image_filename | text | required | Original filename from CSV |
| image_url | text | required | Azure HTTPS URL (base, no SAS) |
| sequence | integer | required | Order |
| created_at | timestamptz | now() | |

Both tables get deny-all RLS (same pattern as existing batch tables). All access through edge functions with service role key.

## Edge Function: `delivery-manager`

Single function with `?action=` routing. Six actions total:

### Admin actions (require dual auth: user token + admin secret):

1. **`upload_csv`** (POST) -- Parse CSV text from request body, group rows by `batch_id` + `user_email`, create `delivery_batches` + `delivery_images` records. Status set to `completed`. Returns created records for immediate preview.

2. **`list`** (GET) -- List all delivery batches with image counts and status.

3. **`preview`** (GET, `?delivery_id=xxx`) -- Return a specific delivery batch with all its images for verification.

4. **`send`** (POST) -- Accept array of delivery batch IDs. For each: generate crypto-random token, send email via Resend with a link to `/results/{token}`, on success update status to `delivered` and set timestamps. If override_email exists, use that instead of user_email.

5. **`delete`** (POST) -- Remove delivery batch and its images.

### Public actions (no auth, token-validated):

6. **`download`** (GET, `?token=xxx&image_id=yyy`) -- Validate token against delivery_batches, find the image, generate a fresh SAS server-side using the working signing format from `azure-get-sas`, fetch the blob, and stream it to the user with `Content-Disposition: attachment; filename="image_01.jpg"`. The user's browser receives a direct image download -- no SAS URL exposed, no XML error possible.

7. **`gallery`** (GET, `?token=xxx`) -- Return delivery info + image list (IDs, filenames, sequences) for the results page to render. No image URLs exposed -- the page uses the `download` action for each image.

## Frontend Changes

### New: `DeliveryManager.tsx` (admin modal)

Opened from a new "Delivery" button in the admin top bar. Three tabs:

1. **Upload** -- CSV file picker, parses and shows grouped preview table (user email, image count, batch_id). Confirm button stores to DB.

2. **Deliveries** -- Lists all delivery batches. Shows status badge (completed/delivered), user email, image count, category. Actions: preview, send, delete. Override email editable inline.

3. **Results** -- After send, shows sent/failed summary with per-delivery status.

### New: `DeliveryResults.tsx` (public page at `/results/:token`)

- No authentication required (token = access)
- FormaNova branded dark theme with gold accents
- Shows category and greeting
- Grid of image thumbnails (loaded via the proxy download endpoint)
- Each image has a "Download" button that triggers the proxy download
- "Download All" option
- Clean, minimal design

### Modified: `AdminBatches.tsx`

- Add "Delivery" button in the top bar next to existing "Email Results" and "ZIP Download"
- Opens the `DeliveryManager` modal

### Modified: `App.tsx`

- Add public route: `/results/:token` pointing to `DeliveryResults`

### Modified: `supabase/config.toml`

- Add `[functions.delivery-manager]` with `verify_jwt = false`

## Email Template

The email will contain:
- FormaNova branded header (dark theme, gold accents)
- Greeting: "Hi {name},"
- Message: "Your {category} results are ready!"
- For each image: a direct download link pointing to the proxy endpoint (`/functions/v1/delivery-manager?action=download&token=xxx&image_id=yyy`)
- No expiry warning needed (proxy generates fresh SAS on demand)
- FormaNova footer

This solves the XML error because users never interact with Azure SAS URLs directly -- every download goes through the edge function proxy.

## SAS Fix

The download proxy will use the exact same signing format as the working `azure-get-sas` function (version `2020-10-02` with `spr` field), not the broken format in `send-results-email` (version `2021-06-08` missing `spr`). This ensures signatures are always valid.

## Testing Plan

1. Upload a test CSV with your own email address
2. Preview in admin dashboard -- verify images mapped correctly to your email
3. Send to yourself
4. Open email, click download links
5. Verify images download directly (no XML error)
6. Check admin dashboard shows status as "delivered"

## Files Summary

| File | Action |
|------|--------|
| Database migration | Create `delivery_batches` + `delivery_images` tables with deny-all RLS |
| `supabase/functions/delivery-manager/index.ts` | Create -- all delivery logic |
| `src/components/admin/DeliveryManager.tsx` | Create -- admin modal UI |
| `src/pages/DeliveryResults.tsx` | Create -- public results gallery |
| `src/pages/AdminBatches.tsx` | Modify -- add Delivery button |
| `src/App.tsx` | Modify -- add `/results/:token` route |
| `supabase/config.toml` | Modify -- add delivery-manager config |

