

## Plan: Show Users Their Generations on the Generations Page

The data already exists in the database. Each user has deliveries in `delivery_batches` (linked by `user_email`) with images in `delivery_images`. We need:

1. A new edge function action to fetch a user's own deliveries
2. A rebuilt Generations page that displays them in an organized gallery

### Data Available

- **delivery_batches**: has `user_email`, `category`, `token`, `created_at`, `delivery_status`
- **delivery_images**: has `image_url`, `image_filename`, `sequence` per delivery batch
- 464 total delivered records (291 necklace, 173 earring) across many users

### Changes

#### 1. Edge Function: Add `my_deliveries` action to `delivery-manager/index.ts`

Add a new action that:
- Authenticates the user via their `X-User-Token`
- Queries `delivery_batches` where `user_email` matches the authenticated user's email
- Joins `delivery_images` to get thumbnails with fresh SAS tokens
- Returns deliveries grouped by date/category
- No admin check needed — users can only see their own data

#### 2. Frontend: Rebuild `src/pages/Generations.tsx`

Replace the placeholder with a real page that:
- Fetches the user's deliveries from the new `my_deliveries` action
- Groups results by delivery batch (each batch = one "order" with a category and date)
- Shows a card per batch with:
  - Category badge (necklace/earring)
  - Date delivered
  - Thumbnail grid of images (2-3 preview thumbnails)
  - "View All" link that goes to `/results/:token` (the existing gallery page)
- Empty state if no deliveries yet
- Loading skeleton while fetching

### UI Layout

```text
┌──────────────────────────────────────────────┐
│  ← Back to Home                              │
│                                              │
│  My Generations                              │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │ 📅 Feb 24, 2026  ·  NECKLACE           │ │
│  │ ┌──────┐ ┌──────┐ ┌──────┐             │ │
│  │ │ img  │ │ img  │ │ img  │  3 images   │ │
│  │ └──────┘ └──────┘ └──────┘             │ │
│  │                          [View Results] │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │ 📅 Feb 23, 2026  ·  EARRING            │ │
│  │ ┌──────┐ ┌──────┐                      │ │
│  │ │ img  │ │ img  │           2 images    │ │
│  │ └──────┘ └──────┘                      │ │
│  │                          [View Results] │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Files to Change

| File | Change |
|------|--------|
| `supabase/functions/delivery-manager/index.ts` | Add `my_deliveries` action — authenticate user, query their deliveries + images, return with fresh SAS URLs |
| `src/pages/Generations.tsx` | Full rebuild — fetch from `my_deliveries`, display organized cards grouped by batch with thumbnails, category badges, dates, and "View Results" links to `/results/:token` |

### Technical Details

**Edge function `my_deliveries` action:**
- Requires `X-User-Token` header (same auth as other user actions)
- Calls `authenticateUser()` to get user email
- SQL: `SELECT db.*, di.* FROM delivery_batches db JOIN delivery_images di ON di.delivery_batch_id = db.id WHERE db.user_email = $email ORDER BY db.created_at DESC`
- Generates fresh SAS tokens for thumbnail URLs (reusing existing `generateSasUrlFromHttps`)
- Returns array of batches, each with nested images array

**Frontend Generations page:**
- Uses `useAuth()` to get user context and token
- Fetches on mount via `useEffect`
- Shows skeleton cards while loading
- Each batch card links to `/results/:token` for the full gallery experience
- Responsive grid: 1 column mobile, 2 columns tablet+

