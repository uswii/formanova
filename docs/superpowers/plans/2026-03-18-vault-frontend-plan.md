# Vault Feature — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface My Products + My Models vault in the Dashboard; register assets on upload via the azure-upload function; add Re-shoot pre-load path in UnifiedStudio.

**Architecture:** `azure-upload` function (the only justified server-side function — holds Azure credentials) gains SHA-256 computation + asset registration after upload, fail-open. `assets-api.ts` calls FastAPI directly via `authenticatedFetch` — no proxy layer. Data logic lives in `useUserAssets` hook; components are purely presentational, making the UI layer independently restyable by a frontend developer without touching any data code.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, react-router-dom, existing `authenticatedFetch` utility (`src/lib/authenticated-fetch.ts`)

**Spec:** `docs/superpowers/specs/2026-03-18-vault-feature-design.md`

**Prerequisite:** Task 1 and Task 2 can start immediately (no backend dependency). Tasks 3–8 require Backend Phase 0 complete (POST /assets and GET /assets live at `VITE_PIPELINE_API_URL`).

---

## ⚠️ Before Starting: Check for Backend Verification Report

If the backend Claude session completed Task 0 and found API contract discrepancies, they will have written a report. Ask the user: "Did the backend session produce a verification report? If so, please share it before I proceed with Tasks 2+."

Incorporate any changes to endpoint shapes, auth headers, or response fields before implementing `assets-api.ts`.

If the verification report is not yet available, proceed through Task 2 only and wait for the backend session to complete Task 0 before starting Task 3.

---

## Design Principle for the Frontend Developer

**Components are purely presentational.** `AssetCard` and `AssetGrid` receive all data as props. They never fetch, never mutate. Styling uses only Tailwind classes and the project's existing design tokens — no inline styles, no hardcoded colours. A developer can open `src/components/vault/AssetCard.tsx`, restyle it freely, and nothing else in the codebase needs to change. The data contract is `AssetCardProps` — keep that interface stable and everything downstream stays wired.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/functions/azure-upload/index.ts` | Modify | Add SHA-256 + asset registration (fail-open) |
| `src/lib/microservices-api.ts` | Modify | Add `assetType` param to `uploadToAzure`; add `asset_id` to response type |
| `src/lib/assets-api.ts` | Create | `fetchUserAssets()` — direct FastAPI call, typed response |
| `src/hooks/useUserAssets.ts` | Create | Data fetching + pagination state; no UI concerns |
| `src/components/vault/AssetCard.tsx` | Create | Presentational card — props only, no data fetching |
| `src/components/vault/AssetGrid.tsx` | Create | Grid layout with loading skeleton and empty state |
| `src/pages/Dashboard.tsx` | Modify | Add vault section with My Products + My Models tabs |
| `src/lib/photoshoot-api.ts` | Modify | Add `input_jewelry_asset_id` + `input_model_asset_id` optional fields to `PhotoshootStartRequest` |
| `src/pages/UnifiedStudio.tsx` | Modify | Read preloaded URL from route state; move model upload to selection time; thread asset_ids to workflow payload |

---

### Task 1: Modify azure-upload — SHA-256 + Asset Registration

**Files:**
- Modify: `supabase/functions/azure-upload/index.ts`

This task can start before backend Phase 0 is complete. The POST /assets call is fail-open — if the backend isn't ready yet it just logs a warning and the upload still succeeds.

- [ ] **Step 1: Add `asset_type` to request destructuring (line 193)**

Find:
```ts
const { base64, filename, content_type } = await req.json();
```
Change to:
```ts
const { base64, filename, content_type, asset_type } = await req.json();
```

- [ ] **Step 2: Compute SHA-256 from binary (add immediately after line 233)**

Line 233 is: `const binaryData = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));`

Add directly below it:
```ts
// Compute SHA-256 server-side — binaryData is already in memory, zero extra cost
const hashBuffer = await crypto.subtle.digest('SHA-256', binaryData);
const sha256 = Array.from(new Uint8Array(hashBuffer))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');
```

- [ ] **Step 3: Add asset registration after successful Azure upload**

Find the closing of the `if (!response.ok)` block (around line 310). After it (still inside the `try` block, before SAS token generation), add:

```ts
// Register asset — fail-open: never fail the upload for a registration error
let assetId: string | null = null;
const BACKEND_URL = Deno.env.get('PIPELINE_API_URL');
if (BACKEND_URL && asset_type) {
  try {
    const regResp = await fetch(`${BACKEND_URL}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': userToken,  // forward the validated user token
      },
      body: JSON.stringify({
        sha256,
        uri: `azure://${AZURE_CONTAINER_NAME}/${blobName}`,
        mime_type: blobContentType,
        size_bytes: contentLength,
        asset_type,
      }),
    });
    if (regResp.ok) {
      assetId = (await regResp.json()).asset_id ?? null;
    } else {
      console.warn(`[azure-upload] Asset registration failed: ${regResp.status} — upload still succeeds`);
    }
  } catch (e) {
    console.warn('[azure-upload] Asset registration error (non-fatal):', e);
  }
}
```

- [ ] **Step 4: Add `asset_id` to the return payload (final return statement)**

Find the final `return new Response(JSON.stringify({ uri: azureUri, sas_url: sasUrl, https_url: url }), ...)` and add `asset_id`:

```ts
return new Response(
  JSON.stringify({
    uri: azureUri,
    sas_url: sasUrl,
    https_url: url,
    asset_id: assetId,   // null if registration failed (fail-open)
  }),
  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

- [ ] **Step 5: Add `PIPELINE_API_URL` to the azure-upload function's environment**

```bash
# Look up VITE_PIPELINE_API_URL in your .env, then run:
# supabase secrets set PIPELINE_API_URL=https://your-actual-api-url.example.com
```

*(Check your `.env` for the exact value. If you have separate staging and production environments, set the correct URL for each.)*

- [ ] **Step 6: Manual smoke test**

Upload a jewelry image through the normal UI. In the browser network tab, confirm the azure-upload response now contains `asset_id` (may be non-null once backend Phase 0 is done).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/azure-upload/index.ts
git commit -m "feat: azure-upload computes SHA-256 and registers asset on upload (fail-open)"
```

---

### Task 2: Extend `uploadToAzure` and `AzureUploadResponse`

**Files:**
- Modify: `src/lib/microservices-api.ts`

Current signature (line 29–32): `uploadToAzure(base64: string, contentType: string = 'image/jpeg')`
Current response type (lines 23–27): `{ uri, sas_url, https_url }`

- [ ] **Step 1: Add `asset_id` to `AzureUploadResponse`**

Find the `AzureUploadResponse` interface (line 23) and add:
```ts
asset_id?: string | null;  // set by backend registration; null if fail-open triggered
```

- [ ] **Step 2: Add `assetType` parameter to `uploadToAzure`**

Change signature from:
```ts
export async function uploadToAzure(
  base64: string,
  contentType: string = 'image/jpeg'
): Promise<AzureUploadResponse>
```
To:
```ts
export async function uploadToAzure(
  base64: string,
  contentType: string = 'image/jpeg',
  assetType?: 'jewelry_photo' | 'model_photo'
): Promise<AzureUploadResponse>
```

- [ ] **Step 3: Pass `assetType` in the request body**

Find the `body: JSON.stringify({ base64, content_type: contentType })` (line 38–41). Change to:
```ts
body: JSON.stringify({
  base64,
  content_type: contentType,
  ...(assetType ? { asset_type: assetType } : {}),
}),
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build -- --noEmit 2>&1 | grep microservices-api
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/microservices-api.ts
git commit -m "feat: add assetType param and asset_id to uploadToAzure"
```

---

### Task 3: `assets-api.ts` — Direct FastAPI Call

**Files:**
- Create: `src/lib/assets-api.ts`

*Before implementing, confirm the exact GET /assets response shape with the backend (see backend plan Task 5). If the backend verification report (Task 0 of backend plan) changed anything, update the types here.*

- [ ] **Step 1: Create the file**

```ts
// src/lib/assets-api.ts
// Direct calls to FastAPI /assets — no proxy. authenticatedFetch handles Bearer token.

import { authenticatedFetch } from '@/lib/authenticated-fetch';

const API_BASE = import.meta.env.VITE_PIPELINE_API_URL;

export type AssetType = 'jewelry_photo' | 'model_photo';

export interface UserAsset {
  id: string;
  asset_type: AssetType;
  created_at: string;      // ISO string
  thumbnail_url: string;   // SAS URL with 1-hour expiry — use directly in <img src>
  name: string | null;
}

export interface AssetsPage {
  items: UserAsset[];
  total: number;
  page: number;
  page_size: number;
}

export async function fetchUserAssets(
  type: AssetType,
  page = 0,
  pageSize = 20,
): Promise<AssetsPage> {
  const url = `${API_BASE}/assets?asset_type=${type}&page=${page}&page_size=${pageSize}`;
  const response = await authenticatedFetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${type} assets: ${response.status}`);
  }
  return response.json();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build -- --noEmit 2>&1 | grep assets-api
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/assets-api.ts
git commit -m "feat: add assets-api.ts for direct FastAPI vault fetching"
```

---

### Task 4: `useUserAssets` Hook

**Files:**
- Create: `src/hooks/useUserAssets.ts`

This hook owns all data-fetching and pagination state. Components receive data as props — they never call the API. This is the boundary that lets a frontend developer restyle `AssetCard`/`AssetGrid` without touching any fetch logic.

- [ ] **Step 1: Create the hook**

```ts
// src/hooks/useUserAssets.ts
import { useState, useEffect, useCallback } from 'react';
import { fetchUserAssets, type AssetType, type UserAsset } from '@/lib/assets-api';

export interface UseUserAssetsResult {
  assets: UserAsset[];
  total: number;
  page: number;
  isLoading: boolean;
  error: string | null;
  goToPage: (page: number) => void;
  refresh: () => void;
}

export function useUserAssets(type: AssetType, pageSize = 20): UseUserAssetsResult {
  const [assets, setAssets] = useState<UserAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pageNum: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUserAssets(type, pageNum, pageSize);
      setAssets(data.items);
      setTotal(data.total);
      setPage(pageNum);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assets');
    } finally {
      setIsLoading(false);
    }
  }, [type, pageSize]);

  useEffect(() => { load(0); }, [load]);

  return {
    assets,
    total,
    page,
    isLoading,
    error,
    goToPage: load,
    refresh: () => load(page),
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build -- --noEmit 2>&1 | grep useUserAssets
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useUserAssets.ts
git commit -m "feat: add useUserAssets hook"
```

---

### Task 5: `AssetCard` Component

**Files:**
- Create: `src/components/vault/AssetCard.tsx`

**Read `src/components/generations/WorkflowCard.tsx` first.** Note its exact Tailwind class patterns, hover effects, and border styles — `AssetCard` must be visually consistent.

**For the frontend developer:** This file is yours to restyle. The prop interface (`AssetCardProps`) is the contract — keep it stable. Everything inside the JSX is fair game.

- [ ] **Step 1: Read WorkflowCard**

```bash
cat src/components/generations/WorkflowCard.tsx
```

Note: card border class (`marta-frame`? `border border-border`?), aspect ratio, hover transitions used.

- [ ] **Step 2: Create `src/components/vault/AssetCard.tsx`**

```tsx
// src/components/vault/AssetCard.tsx
// Purely presentational — no data fetching. Restyle freely; keep AssetCardProps stable.

import { formatDistanceToNow } from 'date-fns';
import type { UserAsset } from '@/lib/assets-api';

export interface AssetCardProps {
  asset: UserAsset;
  /** Called when the Re-shoot / New Shoot button is clicked */
  onReshoot?: (asset: UserAsset) => void;
  /** Called when the card body itself is clicked */
  onClick?: (asset: UserAsset) => void;
  /** Override the action button label. Defaults: 'New Style' (jewelry), 'New Shoot' (model) */
  reshootLabel?: string;
}

export function AssetCard({ asset, onReshoot, onClick, reshootLabel }: AssetCardProps) {
  const label = reshootLabel ?? (asset.asset_type === 'model_photo' ? 'New Shoot' : 'New Style');
  const age = formatDistanceToNow(new Date(asset.created_at), { addSuffix: true });

  return (
    <div
      className="group relative rounded-lg overflow-hidden bg-card border border-border cursor-pointer hover:border-formanova-glow transition-colors duration-200"
      onClick={() => onClick?.(asset)}
    >
      {/* Thumbnail */}
      <div className="aspect-square w-full overflow-hidden bg-muted">
        <img
          src={asset.thumbnail_url}
          alt={asset.name ?? 'Asset'}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      {/* Footer */}
      <div className="p-3 space-y-1">
        {asset.name && (
          <p className="font-mono text-xs text-foreground truncate">{asset.name}</p>
        )}
        <p className="text-xs text-muted-foreground">{age}</p>
      </div>

      {/* Re-shoot overlay — appears on hover */}
      {onReshoot && (
        <div className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background/20">
          <button
            className="px-4 py-2 bg-formanova-glow text-black text-xs font-bold rounded hover:brightness-110 transition-all"
            onClick={(e) => { e.stopPropagation(); onReshoot(asset); }}
          >
            {label}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Install `date-fns` if not already present**

```bash
npm ls date-fns 2>/dev/null | grep date-fns || npm install date-fns
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build -- --noEmit 2>&1 | grep AssetCard
```

- [ ] **Step 5: Commit**

```bash
git add src/components/vault/AssetCard.tsx
git commit -m "feat: add AssetCard presentational component"
```

---

### Task 6: `AssetGrid` Component

**Files:**
- Create: `src/components/vault/AssetGrid.tsx`

- [ ] **Step 1: Read the Generations page grid**

```bash
grep -n "grid" src/pages/Generations.tsx | head -20
```

Note the exact grid Tailwind classes used (columns, gap, responsive breakpoints). Match them.

- [ ] **Step 2: Create `src/components/vault/AssetGrid.tsx`**

```tsx
// src/components/vault/AssetGrid.tsx
// Purely presentational grid. Pass assets as props. Loading/empty states included.

import { AssetCard, type AssetCardProps } from './AssetCard';
import type { UserAsset } from '@/lib/assets-api';

interface AssetGridProps {
  assets: UserAsset[];
  isLoading: boolean;
  error: string | null;
  emptyMessage?: string;
  onReshoot?: AssetCardProps['onReshoot'];
  onCardClick?: AssetCardProps['onClick'];
  reshootLabel?: string;
}

export function AssetGrid({
  assets,
  isLoading,
  error,
  emptyMessage = 'No assets yet.',
  onReshoot,
  onCardClick,
  reshootLabel,
}: AssetGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (assets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">{emptyMessage}</p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          onReshoot={onReshoot}
          onClick={onCardClick}
          reshootLabel={reshootLabel}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build -- --noEmit 2>&1 | grep AssetGrid
```

- [ ] **Step 4: Commit**

```bash
git add src/components/vault/AssetGrid.tsx
git commit -m "feat: add AssetGrid with loading skeleton and empty state"
```

---

### Task 7: Dashboard — My Products + My Models Vault Section

**Files:**
- Modify: `src/pages/Dashboard.tsx`

The current Dashboard (`src/pages/Dashboard.tsx`) is a hero-tile navigation page — no tabs. Add a vault section **below** the existing tiles. This preserves the existing navigation unchanged and lets a frontend developer later reorganise the layout if desired.

- [ ] **Step 1: Read the full Dashboard file**

```bash
cat src/pages/Dashboard.tsx
```

Note: closing `</div>` of the `max-w-7xl` motion div that wraps the tiles — the vault section goes after it, before the outer `</div>`.

- [ ] **Step 2: Add imports at the top of Dashboard.tsx**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';  // already imported — skip if present
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AssetGrid } from '@/components/vault/AssetGrid';
import { useUserAssets } from '@/hooks/useUserAssets';
import type { UserAsset } from '@/lib/assets-api';
```

- [ ] **Step 3: Add vault section inside the Dashboard component, after the tiles motion.div**

```tsx
{/* ── Vault Section ─────────────────────────────────── */}
<div className="max-w-7xl mx-auto mt-10">
  <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-4">
    My Vault
  </span>

  <Tabs defaultValue="products">
    <TabsList className="mb-6">
      <TabsTrigger value="products">My Products</TabsTrigger>
      <TabsTrigger value="models">My Models</TabsTrigger>
    </TabsList>

    <TabsContent value="products">
      <MyProductsTab />
    </TabsContent>

    <TabsContent value="models">
      <MyModelsTab />
    </TabsContent>
  </Tabs>
</div>
```

- [ ] **Step 4: Add tab sub-components inside `Dashboard.tsx` (above the `export default` line)**

```tsx
function MyProductsTab() {
  const navigate = useNavigate();
  const { assets, isLoading, error } = useUserAssets('jewelry_photo');

  const handleReshoot = (asset: UserAsset) => {
    // Pass both the URL and the asset.id so UnifiedStudio can set jewelryAssetId state,
    // ensuring the workflow execution FK gets populated even on the Re-shoot path.
    navigate('/studio', { state: { preloadedJewelryUrl: asset.thumbnail_url, preloadedJewelryAssetId: asset.id } });
  };

  return (
    <AssetGrid
      assets={assets}
      isLoading={isLoading}
      error={error}
      emptyMessage="No jewelry photos yet. Upload a photo to start your first shoot."
      onReshoot={handleReshoot}
    />
  );
}

function MyModelsTab() {
  const navigate = useNavigate();
  const { assets, isLoading, error } = useUserAssets('model_photo');

  const handleReshoot = (asset: UserAsset) => {
    // Pass both the URL and the asset.id so UnifiedStudio can set modelAssetId state.
    navigate('/studio', { state: { preloadedModelUrl: asset.thumbnail_url, preloadedModelAssetId: asset.id } });
  };

  return (
    <AssetGrid
      assets={assets}
      isLoading={isLoading}
      error={error}
      emptyMessage="No model photos yet. Upload a model face to get started."
      onReshoot={handleReshoot}
      reshootLabel="New Shoot"
    />
  );
}
```

- [ ] **Step 5: Run dev server — verify visually**

```bash
npm run dev
```

Check:
- My Products tab shows jewelry asset grid (or empty state if no assets yet)
- My Models tab shows model asset grid
- **Both tabs are always visible** — even for users with zero uploads. The empty state message appears inside the tab content via `AssetGrid`'s `emptyMessage` prop. Do NOT conditionally hide the tabs — this confuses returning users who have uploaded before. `AssetGrid` already handles the empty state.
- Existing hero tiles are unchanged
- No console errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: add My Products and My Models vault section to Dashboard"
```

---

### Task 8: UnifiedStudio — Pre-load from Route State

**Files:**
- Modify: `src/pages/UnifiedStudio.tsx`

When the user clicks "New Style" on an `AssetCard`, they are navigated to `/studio` with route state `{ preloadedJewelryUrl }` or `{ preloadedModelUrl }`. This task wires up that pre-load.

- [ ] **Step 1: Add `useLocation` import (line 2 area)**

Current imports include `useParams`. Add `useLocation`:
```tsx
import { useParams, useLocation } from 'react-router-dom';
```

- [ ] **Step 2: Add pre-load effect inside the component**

Add this `useEffect` near the top of the component body, after the existing state declarations (around line 160, after `jewelryUploadedUrl` is declared at line 151):

```tsx
// Pre-load vault asset into studio (Re-shoot / New Shoot from My Products or My Models)
const location = useLocation();
// Intentionally empty deps: pre-load runs once on mount from route state.
// Adding 'location' to deps would re-apply pre-load on every in-studio navigation, which is wrong.
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  const state = location.state as {
    preloadedJewelryUrl?: string;
    preloadedJewelryAssetId?: string;
    preloadedModelUrl?: string;
    preloadedModelAssetId?: string;
  } | null;

  if (state?.preloadedJewelryUrl) {
    // Set directly — same state variable set after a normal upload.
    // SAS URL is intentional: the existing generation path handles it via the else-branch.
    setJewelryUploadedUrl(state.preloadedJewelryUrl);
    // Thread asset_id so the workflow execution FK gets populated on Re-shoot generations
    setJewelryAssetId(state.preloadedJewelryAssetId ?? null);
  }

  if (state?.preloadedModelUrl) {
    // Set customModelImage to the SAS URL so the model preview renders
    // and generation picks it up without re-uploading
    setCustomModelImage(state.preloadedModelUrl);
    setModelAssetId(state.preloadedModelAssetId ?? null);
  }
}, []); // run once on mount — location.state is set before component renders
```

- [ ] **Step 3: Run dev server — test the Re-shoot flow end to end**

1. Navigate to Dashboard → My Products tab
2. Hover a card → click "New Style"
3. UnifiedStudio opens
4. Confirm jewelry image is pre-filled (upload step shows the image already loaded)
5. Proceed through to generation — confirm it completes without re-uploading

- [ ] **Step 4: Commit**

```bash
git add src/pages/UnifiedStudio.tsx
git commit -m "feat: pre-load vault asset into UnifiedStudio via route state"
```

---

### Task 9: Model Upload Timing Change + Asset ID Threading

**Files:**
- Modify: `src/pages/UnifiedStudio.tsx`
- Modify: `src/lib/photoshoot-api.ts`

Currently `handleModelUpload` (line 187) only normalizes and stores base64 in state. Azure upload is deferred to `handleGenerate` (line 294–305). This task moves the model upload to selection time so model cards appear in My Models immediately. It also threads `asset_id` values from both uploads into the workflow payload so `workflow_executions.input_jewelry_asset_id` / `input_model_asset_id` FKs get populated.

- [ ] **Step 1: Read the relevant sections before editing**

Read:
- `handleModelUpload` (lines 187–200)
- The model upload block in `handleGenerate` (lines 291–308)
- The `photoshootPayload` construction in `handleGenerate`
- `src/lib/photoshoot-api.ts` — find the `PhotoshootStartRequest` type

Understand exactly what state gets set and in what order.

- [ ] **Step 2: Add asset_id state declarations**

Near the existing state declarations (line 142–151 area, alongside `customModelImage` and `jewelryUploadedUrl`), add:

```tsx
const [jewelryAssetId, setJewelryAssetId] = useState<string | null>(null);
const [modelAssetId, setModelAssetId] = useState<string | null>(null);
```

- [ ] **Step 3: Update `handleModelUpload` to upload immediately**

**Before writing this code:** Read the definition of `imageSourceToBlob` in the codebase. In `handleGenerate`, it is called with a `data:` URL string — confirm whether it also accepts a `File` directly. If it only accepts URL strings, the implementation below must read the data URL first (via the existing FileReader) and pass that string instead of the `normalized` File.

Replace the current `handleModelUpload` body with one that uploads to Azure right after normalizing, captures `asset_id`, and clears the stale `customModelFile` reference:

```tsx
const handleModelUpload = useCallback(async (file: File) => {
  if (!file.type.startsWith('image/')) {
    toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload an image.' });
    return;
  }
  const normalized = await normalizeImageFile(file);
  setCustomModelFile(normalized);

  // Show preview immediately via local blob URL while upload runs
  const reader = new FileReader();
  reader.onload = (e) => {
    setCustomModelImage(e.target?.result as string);
    setSelectedModel(null);
  };
  reader.readAsDataURL(normalized);

  // Upload to Azure immediately so the model registers in My Models vault
  try {
    const blob = await imageSourceToBlob(normalized);
    const { blob: compressed } = await compressImageBlob(blob);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader2 = new FileReader();
      reader2.onload = () => resolve(reader2.result as string);
      reader2.onerror = reject;
      reader2.readAsDataURL(compressed);
    });
    const azResult = await uploadToAzure(base64, 'image/jpeg', 'model_photo');
    // Replace the local preview with the stable SAS URL for generation
    setCustomModelImage(azResult.sas_url || azResult.https_url);
    setModelAssetId(azResult.asset_id ?? null);
    setCustomModelFile(null);  // clear stale file reference
  } catch (e) {
    // Upload failed — clear state so the user is not left with a broken 'data:' URL in customModelImage.
    // (A 'data:' URL would silently fail the startsWith('http') guard in handleGenerate.)
    setCustomModelImage(null);
    setCustomModelFile(null);
    toast({ variant: 'destructive', title: 'Upload failed', description: 'Model image could not be uploaded. Please re-select the file.' });
    console.warn('[handleModelUpload] Azure upload failed:', e);
  }
}, [toast]);
```

- [ ] **Step 4: Fix handleGenerate model branch condition**

In `handleGenerate`, find the block (lines 291–308):
```tsx
} else if (customModelImage && customModelFile) {
  setGenerationStep('Uploading model image...');
  const modelBlob = await imageSourceToBlob(customModelImage);
  ...
  modelUrl = azResult.https_url || azResult.sas_url;
}
```

Replace with a simpler branch that uses the already-uploaded SAS URL. The `startsWith('http')` check distinguishes stable SAS URLs from the local base64 preview that `customModelImage` holds briefly before upload completes:

```tsx
} else if (customModelImage && customModelImage.startsWith('http')) {
  // Model was uploaded at selection time (handleModelUpload) — customModelImage is a SAS URL.
  // startsWith('http') guards against 'data:' URL previews set briefly before the Azure upload completes.
  modelUrl = customModelImage;
}
```

- [ ] **Step 5: Update the jewelry `uploadToAzure` call in `handleGenerate` and capture asset_id**

Find the jewelry upload in `handleGenerate`. Update the call to pass `'jewelry_photo'` and capture the returned `asset_id`:

```tsx
const azResult = await uploadToAzure(base64, 'image/jpeg', 'jewelry_photo');
setJewelryAssetId(azResult.asset_id ?? null);
```

- [ ] **Step 6: Thread asset_ids into photoshoot payload**

**6a: Add optional fields to `PhotoshootStartRequest` in `src/lib/photoshoot-api.ts`**

Find the `PhotoshootStartRequest` type/interface and add:
```ts
input_jewelry_asset_id?: string;
input_model_asset_id?: string;
```

**6b: Add asset_ids to the `photoshootPayload` object in `handleGenerate`**

Find the `photoshootPayload` construction (the object with `jewelry_image_url`, `model_image_url`, etc.) and add:
```tsx
...(jewelryAssetId ? { input_jewelry_asset_id: jewelryAssetId } : {}),
...(modelAssetId ? { input_model_asset_id: modelAssetId } : {}),
```

This populates `workflow_executions.input_jewelry_asset_id` / `input_model_asset_id` FKs, linking generations to vault assets.

- [ ] **Step 7: Run dev server — test model upload flow**

1. Upload a custom model image
2. Check My Models tab — card should appear immediately without clicking Generate
3. Start a generation with the uploaded model — confirm it completes correctly
4. Check browser network: photoshoot payload should contain `input_model_asset_id` when a model is uploaded

- [ ] **Step 8: Commit**

```bash
git add src/pages/UnifiedStudio.tsx src/lib/photoshoot-api.ts
git commit -m "feat: upload model at selection time; thread asset_ids to workflow payload"
```

---

## Phase 1 Complete QA Checklist

- [ ] Same jewelry image uploaded twice shows one card (SHA-256 dedup working)
- [ ] My Products tab shows historical jewelry uploads after backfill
- [ ] My Models tab shows historical model uploads after backfill
- [ ] Empty state renders correctly for users with no uploads
- [ ] "New Style" button pre-fills UnifiedStudio Step 1 — generation completes without re-upload
- [ ] "New Shoot" button pre-fills the model — generation completes correctly
- [ ] Model card appears in My Models immediately on file select (not after generation)
- [ ] No new Supabase dependencies introduced in React code
- [ ] All Tailwind classes use existing design tokens only
- [ ] `AssetCard` and `AssetGrid` contain zero data-fetching code (verify by inspection)
