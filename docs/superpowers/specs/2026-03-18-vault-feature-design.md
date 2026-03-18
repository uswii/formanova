# Vault Feature Design Spec
**Date:** 2026-03-18
**Feature:** My Products + My Models (Digital Asset Manager)
**Status:** Approved for implementation

---

## 1. Problem Statement

FormaNova currently operates as a vending machine: users upload a jewelry photo or model face, generate images, and leave. Nothing persists. Every new shoot starts from zero.

This spec introduces a **Digital Asset Manager** layer — "My Products" and "My Models" — that surfaces users' previously uploaded jewelry photos and fashion model faces as a permanent, searchable, reusable library. The primary retention mechanism: once a B2B jewelry business has 50 SKUs organized in the vault, the operational dependency makes switching costly.

---

## 2. Goals

1. Jewelry photos uploaded by a user become permanently reusable across sessions with one click.
2. Model face photos uploaded by a user become permanently reusable across sessions with one click.
3. SHA-256 deduplication prevents a user from accumulating duplicate cards for the same physical image.
4. Historical uploads (pre-feature) are backfilled into the vault from `workflow_executions.input_payload`.
5. A "Re-shoot" button on any product card pre-loads that product into UnifiedStudio Step 1, skipping re-upload.

### Non-Goals (explicitly deferred)

- Perceptual dedup (detecting same ring photographed twice differently)
- SKU/name field (Phase 4)
- Shopify sync / bulk export (PostHog-gated, post Re-shoot data)
- CAD output graduation to My Products (Phase 4+)
- Tags, catalog view (PostHog-gated)
- Full test coverage of existing codebase

---

## 3. Architecture

### 3.1 Data Model

```
artifacts (existing CAS layer — extend, not replace)
  sha256        TEXT PK
  uri           TEXT            -- azure:// URI
  mime_type     TEXT
  size_bytes    INTEGER
  created_at    TIMESTAMPTZ

user_assets (NEW ownership layer)
  id                    UUID PK DEFAULT gen_random_uuid()
  user_id               UUID NOT NULL FK → users.id       -- wallet table, NOT auth table
  tenant_id             UUID FK → tenants.id
  artifact_sha256       TEXT NOT NULL FK → artifacts.sha256
  asset_type            TEXT NOT NULL  -- 'jewelry_photo' | 'model_photo' | 'cad_model'
  name                  TEXT           -- nullable; Phase 4 SKU label
  source_workflow_id    UUID FK → workflow_executions.id  -- nullable; CAD outputs only
  created_at            TIMESTAMPTZ DEFAULT NOW()
  UNIQUE (user_id, artifact_sha256, asset_type)

workflow_executions (two new nullable FK columns)
  input_jewelry_asset_id   UUID FK → user_assets.id  -- nullable
  input_model_asset_id     UUID FK → user_assets.id  -- nullable
```

**Key architectural decision:** `user_assets` references `artifacts.sha256` — it does NOT store its own `uri` or `sha256`. The URI comes from `artifacts` via a JOIN. Deduplication lives in one place: the `artifacts` CAS table. Multiple users can reference the same `artifact` row without any duplication of storage metadata.

**Important FK constraint:** All FKs must point to `users.id` (the wallet table, UUID PK), never to `user` (the Supabase auth table).

### 3.2 Why Not Use the Existing `artifacts` Table Directly?

The existing `artifacts` table is populated exclusively by `normalise_payload()` during GPU pipeline output processing. It contains AI-generated output images only. Frontend input uploads travel via plain HTTPS URLs that `normalise_payload()` passes through unchanged. Production data confirms: 3,322 artifact rows, only 3 linked to workflow input URLs (coincidental). Extending `artifacts` for CAS is correct; routing ownership through a separate `user_assets` table keeps concerns separate.

### 3.3 Upload Path (post-Phase 0)

```
1. Frontend calls uploadToAzure(base64, contentType, assetType) — adds assetType param
2. azure-upload edge function:
     a. Decodes base64 → binary
     b. Computes SHA-256 from binary (server-side, no client-side SubtleCrypto needed)
     c. Uploads to Azure → gets azure:// URI
     d. Calls POST /assets { sha256, uri, mime_type, size_bytes, asset_type }
     e. Returns { asset_id, https_url, sas_url } to frontend
3. POST /assets (backend):
     UPSERT INTO artifacts (sha256, uri, mime_type, size_bytes) ON CONFLICT DO NOTHING
     INSERT INTO user_assets (user_id, artifact_sha256, asset_type) ON CONFLICT DO NOTHING
     Returns { asset_id, https_url }
4. Frontend receives asset_id, passes it in workflow payload
5. workflow_executions.input_jewelry_asset_id / input_model_asset_id gets set
```

**SHA-256 computation location:** Computed in the `azure-upload` edge function from the decoded binary bytes (the function already has the binary data). The frontend only passes `asset_type` as a new parameter. No SubtleCrypto required on the frontend.

**Frontend call signature change:** `uploadToAzure(base64: string, contentType: string, assetType: 'jewelry_photo' | 'model_photo')` — adds `assetType` to the existing call. All callers in `UnifiedStudio.tsx` must pass the correct `assetType`.

### 3.4 Model Upload Timing Change

- **Jewelry:** saves at generate time (no change from current behaviour)
- **Models:** saves at upload time (`handleModelUpload` → immediately call `azure-upload` → register asset)
  - Reason: My Models vault should surface uploads immediately, not only after a generation completes
  - Current behaviour: `handleModelUpload` stores base64 in React state; Azure upload deferred to `handleGenerate`

---

## 4. Phase Breakdown

### Phase 0 — Backend Foundations *(backend repo only, invisible to users)*

**DB migration:**
- Create `user_assets` table (schema above)
- Add `input_jewelry_asset_id` and `input_model_asset_id` nullable FK columns to `workflow_executions`

**New Python endpoints:**

`POST /assets`
- Body: `{ sha256, uri, mime_type, size_bytes, asset_type }`
- Auth guard: extracts `user_id` from JWT; `tenant_id` from user record
- Returns: `{ asset_id: UUID, https_url: str }`

`GET /assets`
- Query params: `asset_type` (required), `page` (default 0), `page_size` (default 20)
- Scoped strictly to calling user — `user_id` from JWT only, never from query params
- Returns:
  ```json
  {
    "items": [
      {
        "id": "uuid",
        "asset_type": "jewelry_photo",
        "created_at": "2026-03-18T00:00:00Z",
        "thumbnail_url": "<fresh SAS URL, 1-hour expiry>",
        "name": null
      }
    ],
    "total": 42,
    "page": 0,
    "page_size": 20
  }
  ```
- `thumbnail_url` is generated fresh at query time: backend derives blob name from `artifacts.uri` (azure:// format) and calls `azure_store.get_sas_url()` for each item. This is the same mechanism used elsewhere to serve private blob content. Frontend renders `thumbnail_url` directly — no additional SAS calls needed.

**New `repository.py` functions:**
- `register_asset(user_id, tenant_id, sha256, uri, mime_type, size_bytes, asset_type) → UserAsset`
- `get_user_assets(user_id, asset_type, page, page_size) → List[UserAsset]`

**Supabase edge function — modify `azure-upload`:**
- After successful Azure upload, call `POST /assets` with sha256 + uri + asset_type
- Returns `asset_id` and `https_url` to frontend

**Tests (pytest, written alongside new code):**
1. `POST /assets` happy path — asset created, returns `asset_id` + `https_url`
2. `POST /assets` dedup — same SHA-256 twice → one `artifacts` row, one `user_assets` row
3. `POST /assets` auth guard — request with wrong user token cannot overwrite another user's asset
4. `GET /assets` scoping — user A token cannot retrieve user B's assets
5. `GET /assets` pagination — correct page/page_size behaviour
6. `GET /assets` type filter — `asset_type=jewelry_photo` returns only jewelry assets

**Blast radius:** Backend heavy (migration + 2 endpoints + repository functions + edge function modification). Frontend: none.

---

### Phase 1 — Surface the Grid *(full stack)*

**Backend:**
- New Supabase edge function `assets-proxy` — exposes `GET /assets` to the frontend (same proxy pattern as existing `workflow-proxy`)
- One-time backfill migration script (idempotent Python script):
  - Extracts unique `jewelry_image_url` and `model_image_url` per user from `workflow_executions.input_payload`
  - **Scope: single-photo workflows only** — bulk upload workflows have a different `input_payload` schema and are excluded from Phase 1 backfill. Bulk backfill is a separate out-of-scope task.
  - Filters for Azure blob URLs (excludes preset library URLs by domain pattern)
  - **SAS URL handling:** Historical `input_payload` may contain expired SAS tokens. The script uses the backend's Azure service credentials (already available) to download blobs directly by blob name (derivable from the HTTPS/SAS URL by stripping the SAS query string and mapping the path). Expired SAS tokens are not a blocker.
  - Fetches each blob, computes SHA-256, inserts into `artifacts` + `user_assets`
  - Cross-session physical duplicates: accepted for Phase 1 (small user base — 19 users)
  - **Mandatory dry-run flag:** always run `--dry-run` first, inspect output (row counts + sample URLs), then run live
  - Idempotent: re-running produces no duplicate rows (UPSERT with ON CONFLICT DO NOTHING)

**Frontend:**
- New `src/lib/assets-api.ts` — `fetchUserAssets(type: 'jewelry_photo' | 'model_photo')` using `assets-proxy` edge function
- New "My Products" tab on Dashboard — shows jewelry asset grid
- New components:
  - `AssetGrid` — wraps `AssetCard` in the same grid layout as the Generations page
  - `AssetCard` — modelled directly on `WorkflowCard` (`src/components/generations/WorkflowCard.tsx`); shows thumbnail, date, no new design patterns

**Design constraints:** Components must use existing design tokens only — Bebas Neue (display), Inter (body), Space Mono (mono), `formanova-glow`, `formanova-success`, `formanova-warning`, `formanova-hero-accent`. `AssetCard` is an extension of `WorkflowCard`, not a new component family.

**Blast radius:** Backend medium (proxy + backfill script). Frontend medium (new tab + 2 components + API module).

---

### Phase 2 — Link Generations *(light full stack)*

**Backend:**
- `GET /assets/{id}/workflows` — returns `{ workflow_ids: [uuid, ...], total: int }` for all workflow executions where `input_jewelry_asset_id` or `input_model_asset_id` matches the given asset id
- Modify existing `GET /workflows` (or `listMyWorkflows` proxy) to accept optional `?asset_id=<uuid>` query param; when present, filters results to workflows that used that asset

**Frontend:**
- Generation count badge on each `AssetCard` (calls `GET /assets/{id}/workflows` count)
- Badge click navigates to `/dashboard/generations?asset_id=<uuid>`
- Generations page (`src/pages/Generations.tsx`) reads `useSearchParams` to detect `asset_id`; when present, passes it to the `listMyWorkflows` API call (server-side filter, not client-side)
- No other changes to the Generations page

**Blast radius:** Backend light (1 new endpoint + 1 modified query). Frontend light (badge on card + query param on existing page).

---

### Phase 3 — Re-shoot Button *(frontend heavy, no new backend)*

- "New Style" button on each jewelry `AssetCard`; "New Shoot with This Model" on each model `AssetCard`
- Navigates to `/studio` with route state:
  ```ts
  // Jewelry re-shoot
  { preloadedJewelryUrl: string }   // asset thumbnail_url (SAS URL)

  // Model re-shoot
  { preloadedModelUrl: string }
  ```
- `UnifiedStudio.tsx` reads `useLocation().state` on mount; if `preloadedJewelryUrl` is present, sets `jewelryUploadedUrl` state directly (same state variable used after a normal upload) — skips the upload step entirely, treats URL as already uploaded
- The SAS URL from the vault is valid for 1 hour — sufficient to complete a generation
- Reuses existing generation pipeline — no new backend work

**Blast radius:** Frontend medium (route state read in UnifiedStudio + button on AssetCard). Backend none.

---

### Phase 4 — Name / SKU *(light full stack)*

**Backend:**
- `PATCH /assets/{id}` — update `name` field

**Frontend:**
- Inline editable label on `AssetCard`

**Blast radius:** Backend light. Frontend light.

---

### My Models Tab *(runs in parallel with Phase 1)*

- Same `user_assets` table, `asset_type = 'model_photo'`
- `azure-upload` edge function already modified in Phase 0 — handles model uploads identically to jewelry
- **Model upload timing change:** `handleModelUpload` in `UnifiedStudio.tsx` calls `azure-upload` immediately on file select, not deferred to generate time
- Frontend: "My Models" tab (reuses `AssetGrid` + `AssetCard` with `asset_type` filter)
- "New Shoot with This Model" button (same pattern as Phase 3 Re-shoot)

**Blast radius:** Frontend light. Backend none (leverages Phase 0 work).

---

## 5. Blast Radius Summary

| Phase | Backend | Edge Functions | Frontend |
|-------|---------|----------------|----------|
| 0 | Heavy | Modified: azure-upload | None |
| 1 | Medium | New: assets-proxy | Medium |
| 2 | Light | None | Light |
| 3 | None | None | Medium |
| 4 | Light | None | Light |
| My Models | None | None | Light |

---

## 6. Testing Strategy

### Backend (pytest — written alongside Phase 0 code)
6 tests covering:
- `POST /assets` happy path
- `POST /assets` dedup (same SHA-256 → idempotent)
- `POST /assets` auth guard
- `GET /assets` user scoping
- `GET /assets` pagination
- `GET /assets` type filtering

### Backfill Script
Always run `--dry-run` first. Inspect row counts and sample URLs. Only run live after inspection confirms correctness.

### Frontend (manual QA checklist per phase — no new Vitest tests)

**Phase 1 QA:**
- Same jewelry image uploaded twice shows one card (not two)
- Cards appear for all historical uploads after backfill
- My Products tab is hidden / shows empty state for users with no uploads

**My Models QA:**
- Model card appears immediately on file select (not after generation)
- Same model file uploaded twice shows one card

**Phase 3 QA:**
- "New Style" button pre-fills jewelry URL in UnifiedStudio Step 1
- Upload step is skipped when URL is pre-loaded
- Generation completes normally from pre-filled state

---

## 7. Multi-Repo Collaboration

- **Frontend repo:** `/home/hassan/Desktop/Formanova_lovable_demo`
- **Backend repo:** Separate directory (Temporal agentic pipeline)
- **Two Claude Code terminal sessions** — one per repo, each launched from its own directory
- This spec file lives in the frontend repo at `docs/superpowers/specs/` — share the path with the backend session
- **Execution order per phase:** Backend session first (schema + endpoint); confirm working; frontend session consumes it
- Backend session receives: this full spec (for architectural context) + its section of the implementation plan (specific tasks)

---

## 8. What Was Explicitly Deferred

| Item | Reason |
|------|--------|
| Perceptual dedup | Requires ML embedding comparison — not justified at current scale |
| SKU/name field | Phase 4 — needs vault usage data first |
| Shopify sync / bulk export | PostHog-gated — only if Re-shoot usage justifies |
| CAD output graduation | Phase 4+ — complex cross-feature dependency |
| Full test coverage of existing codebase | Too expensive, derails focus |
| Tags, catalog view | PostHog-gated |

---

## 9. Key Implementation Constraints

1. **FK target:** All `user_id` foreign keys point to `users.id` (wallet table, UUID), never to the Supabase `user` auth table.
2. **CAS dedup lives in `artifacts`:** `user_assets` never stores its own `uri` or `sha256` — always retrieved via JOIN.
3. **Design consistency:** `AssetCard` is directly modelled on `WorkflowCard`. Do not introduce new component families or design patterns.
4. **Backfill is idempotent:** Script must be re-runnable safely. UPSERT, not INSERT.
5. **Plain HTTPS URLs are not processed by `normalise_payload()`:** Do not rely on existing artifact pipeline for input images — that pipeline only handles GPU-generated outputs.
6. **Model upload timing:** Move Azure upload for model images to `handleModelUpload`, not `handleGenerate`. This is required for the My Models vault to work correctly.
