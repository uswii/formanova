# PostHog Overhaul — Reliable Init + Full Event Coverage

**Date:** 2026-03-24
**Status:** Approved for implementation

---

## Goal

Two problems, one package:

1. **Init reliability** — PostHog currently loads lazily (deferred 5s or until interaction). `identifyUser()` fires during app boot before PostHog is ready, silently dropping the call. Returning users with a cached session appear as anonymous UUIDs in session replay instead of their email.

2. **Event coverage** — The funnel between landing and paying is largely untracked. PostHog cannot answer: which category converts best? Where do users drop off? What triggers a purchase?

---

## Architecture

### PostHog Init (main.tsx)

**Current (broken):**
- `posthog-js` is statically imported via `posthog-events.ts → AuthContext → App` — it's in the critical download path regardless
- `posthog.init()` is called lazily inside a dynamic `import("posthog-js")` deferred 5s or until interaction
- `identifyUser()` guards on `posthog.__loaded` and silently no-ops if PostHog hasn't initialised yet
- Result: returning users (cached session) fire `identifyUser()` before PostHog is ready → UUID in session replay

**New (correct):**
- Remove the entire lazy-loading machinery (`loadPostHog` function, timer, interaction event listeners)
- Add static `import posthog from 'posthog-js'` to `main.tsx`
- Call `posthog.init()` eagerly, before `root.render()`, with the `bootstrap` option
- `bootstrap` passes the stored user identity at init time — identify fires atomically with init, zero race condition possible
- `identifyUser()` in `AuthContext` remains for new logins (already works; PostHog is loaded by then)
- The existing 3-line identify-after-init patch (added 2026-03-24) is superseded and removed

**⚠️ Important — field name is case-sensitive:**
The PostHog JS SDK uses `distinctId` (lowercase `d`). Using `distinctID` silently no-ops the bootstrap.

```ts
// ── PostHog: eager init with identity bootstrap ──────────────────────────────
// posthog-js is already in the static import chain (via posthog-events.ts →
// AuthContext → App). Initialising eagerly here costs no extra bandwidth.
// The bootstrap option sets the user identity atomically at init time,
// eliminating the race condition where identifyUser() fired before PostHog
// was ready (causing returning users to appear as anonymous UUIDs).
//
// DO NOT revert to lazy/deferred init — it breaks identify for returning users.
// The "performance benefit" of lazy loading was illusory: the bundle was already
// downloaded eagerly. Only init() was deferred, which just caused the bug.
//
// NOTE: getStoredUser is already imported at line 5 of main.tsx — do not add
// a duplicate import.
import posthog from 'posthog-js';
const storedUser = getStoredUser();
posthog.init(POSTHOG_KEY, {
  api_host: 'https://us.i.posthog.com',
  autocapture: true,
  capture_pageview: true,
  capture_pageleave: true,
  capture_exceptions: true,
  enable_heatmaps: true,
  bootstrap: storedUser
    ? { distinctId: storedUser.id, isIdentifiedID: true }  // distinctId lowercase — MUST match PostHog SDK exactly
    : undefined,
});
```

**Also in main.tsx:** The two error handlers (for `unhandledrejection` and `error`) currently contain `import('posthog-js')` dynamic imports as a fallback. After this change, PostHog is already eagerly initialized — replace those dynamic imports with a direct reference to the imported `posthog` singleton:

```ts
// Before (in error handlers):
import('posthog-js').then(({ default: posthog }) => {
  if (posthog.__loaded) posthog.captureException(event.reason);
}).catch(() => {});

// After:
if (posthog.__loaded) posthog.captureException(event.reason);
```

### Event Architecture (posthog-events.ts)

All PostHog event functions live in one file. This is intentional:
- Single place to audit what is tracked
- Single place to add/remove events
- Call sites stay thin (just import and call)

**Function signature changes to existing functions:**

`trackPaymentSuccess(plan?: string)` → replaced by `trackPaymentSuccess(props: PaymentSuccessProps)`. The existing `plan?` parameter is dropped — it was never used. All call sites pass the new properties object.

`trackGenerationComplete(source: string, durationMs?: number)` → replaced by `trackGenerationComplete(props: GenerationCompleteProps)`. The `source` and `durationMs` parameters become properties inside the props object along with the new ones. **Update the call site in `UnifiedStudio.tsx` when updating this function.**

**localStorage helper** — one helper only. PostHog reconstructs all counter-based metrics (generation number, session counts, repeat buyer, download counts) natively from its event timeline. The only client-side flag worth keeping is `is_first_ever` on `generation_completed`: it's a one-time boolean flip (not an incrementing counter), and it makes "first generation" cohort analysis a one-click PostHog filter rather than a SQL query. Everything else: drop.

```ts
const PH_FIRST_GEN_KEY = 'ph_first_generation_done';

/** Returns true only on the very first generation_completed call ever.
 *  Flips to false permanently after that.
 *  Stored in localStorage — robust to session resets, not to storage clears. */
export function consumeFirstGeneration(): boolean {
  const done = localStorage.getItem(PH_FIRST_GEN_KEY) === '1';
  if (!done) localStorage.setItem(PH_FIRST_GEN_KEY, '1');
  return !done;
}
```

**`is_first_selection` sessionStorage flag** — managed inline in `PhotographyStudioCategories.tsx` (not in posthog-events.ts since it's a single-use local flag):
```ts
const PH_CATEGORY_SELECTED_KEY = 'ph_category_selected';
const isFirst = !sessionStorage.getItem(PH_CATEGORY_SELECTED_KEY);
sessionStorage.setItem(PH_CATEGORY_SELECTED_KEY, '1');
```

**`posthog.__loaded` guards** — kept on all `capture()` calls as a safety net with a comment:
```ts
// posthog.__loaded is always true after eager init in main.tsx.
// Guard kept as a safety net in case init order ever changes.
```

---

## Events

### The jewelry upload flow (read this before implementing upload events)

The upload flow has **two distinct paths** through `UnifiedStudio.tsx`:

**Path A — Accepted upload (worn jewelry)**
`handleJewelryUpload` → `validateImages()` → `localResult.is_acceptable === true` → user proceeds to step 2 normally.

**Path B — Flagged upload (non-worn: flatlay, product_surface, 3d_render, etc.)**
`handleJewelryUpload` → `validateImages()` → `localResult.is_acceptable === false` → a dialog appears showing the user what's wrong. The dialog has two buttons:
- "Go Back & Re-upload" — clears everything, user starts over
- "Continue Anyway" → calls `handleContinueAnyway()` → user proceeds to step 2 with the non-worn image

`handleContinueAnyway` simply does:
```ts
setShowFlaggedDialog(false);
setCurrentStep('model');
```
It does NOT reset `validationResult`. The flagged result stays in state.

**Why this matters for PostHog:** Users who click "Continue Anyway" proceed to generate with a non-worn image. Without tracking this path, PostHog sees them generate but has no upload event — making conversion analysis by upload type impossible.

**Event placement rules:**
- `jewelry_uploaded` fires in **both** paths (see below) — one event per user who has a ready image, split by `was_flagged`
- `validation_flagged` fires in path B only, in `handleJewelryUpload` — it's a signal of friction, regardless of what the user does next
- `generation_completed` fires for both path A and path B users (anyone who generates)

### ⚠️ React state trap in handleJewelryUpload

In `handleJewelryUpload`, validation runs and sets state via `setValidationResult(result.results[0])`. **React state setters are asynchronous** — `validationResult` in scope at that point is still the previous state value (stale/null).

**In `handleJewelryUpload`: always use the local variable `localResult` directly**, never `validationResult`:

```ts
const result = await validateImages([normalized], jewelryType);
if (result && result.results.length > 0) {
  const localResult = result.results[0];  // ← use this, not validationResult state
  setValidationResult(localResult);
  if (localResult.uploaded_url) setJewelryUploadedUrl(localResult.uploaded_url);

  if (localResult.is_acceptable) {
    // Path A: worn image accepted — fire jewelry_uploaded immediately
    trackJewelryUploaded({ category: TO_SINGULAR[jewelryType] ?? jewelryType, upload_type: localResult.category, was_flagged: false });
  } else {
    // Path B: non-worn image flagged — fire validation_flagged; jewelry_uploaded fires later if user clicks Continue Anyway
    trackValidationFlagged({ category: TO_SINGULAR[jewelryType] ?? jewelryType, detected_label: localResult.category });
  }
}
```

**In `handleContinueAnyway`: `validationResult` state IS safe to read** — validation completed before the dialog appeared, so state is fully settled by the time the user clicks Continue Anyway:

```ts
const handleContinueAnyway = () => {
  // Fire jewelry_uploaded here for path B users (was_flagged: true)
  // validationResult state is stable — validation finished before this dialog appeared
  if (validationResult) {
    trackJewelryUploaded({ category: TO_SINGULAR[jewelryType] ?? jewelryType, upload_type: validationResult.category, was_flagged: true });
  }
  setShowFlaggedDialog(false);
  setCurrentStep('model');
};
```

---

### New events

#### `category_selected`
Fired in: `PhotographyStudioCategories.tsx` → `handleCategoryClick`
```ts
posthog.capture('category_selected', {
  category: TO_SINGULAR[category.id] ?? category.id,   // singular: 'ring' | 'earring' | 'necklace' | 'bracelet' | 'watch'
  is_first_selection: boolean,   // sessionStorage flag — true only on first click this session
})
// NOTE: category.id in PhotographyStudioCategories is the plural key ('rings', 'earrings', etc.).
// TO_SINGULAR must be imported or duplicated here so category values match all other events.
```

#### `jewelry_uploaded`
Fires in **two places** — see flow description above.

**Path A (accepted):** `handleJewelryUpload`, when `localResult.is_acceptable === true`. Use `localResult.category` (local variable — stale state trap applies here).

**Path B (continue anyway):** `handleContinueAnyway`, for users who proceed despite the validation warning. Use `validationResult.category` (state IS safe here — see flow description above).

`upload_type` values come directly from the backend classification API:
- Worn (accepted or continued): `mannequin` | `model` | `body_part`
- Non-worn (continued anyway): `flatlay` | `product_surface` | `3d_render` | `packshot` | `floating` | `unknown`

```ts
posthog.capture('jewelry_uploaded', {
  category: TO_SINGULAR[jewelryType] ?? jewelryType,   // singular — matches all other events
  upload_type: string,   // raw backend label — see values above
  was_flagged: boolean,  // false = accepted normally; true = user clicked "Continue Anyway"
})
```

With `was_flagged` PostHog can answer: do "continue anyway" users generate at the same rate as accepted users? Do they produce worse results?

#### `validation_flagged`
Fired in: `UnifiedStudio.tsx` → `handleJewelryUpload`, when `localResult.is_acceptable === false`.
Use `localResult.category` (local variable — stale state trap applies here, NOT `validationResult` state).
Fires regardless of whether the user then clicks "Continue Anyway" or "Go Back". Measures how often users hit the friction wall. PostHog will show what % of users who see this still reach `generation_completed`.
```ts
posthog.capture('validation_flagged', {
  category: TO_SINGULAR[jewelryType] ?? jewelryType,   // singular — matches all other events
  detected_label: localResult.category,  // raw backend label: 'flatlay' | 'product_surface' | etc.
  validation_reason: 'wrong_shot_type',  // static — only reason currently
})
```

#### `model_selected`
Fired in: `UnifiedStudio.tsx` — two handlers:
- `handleSelectLibraryModel` → `model_type: 'catalog'` (sync, straightforward)
- `handleModelUpload` → `model_type: 'custom_upload'` — fire AFTER `setCustomModelImage(stableUrl)` succeeds (Azure upload done)

Note: `handleModelUpload` is also called from the paste handler (when user pastes an image in step 2). The event will fire correctly in all paths — paste path should be tested explicitly.
```ts
posthog.capture('model_selected', {
  category: TO_SINGULAR[jewelryType] ?? jewelryType,   // singular — matches all other events
  model_type: 'catalog' | 'custom_upload',
})
```

#### `paywall_hit`
**Photo studio:** `UnifiedStudio.tsx` → `handleGenerate`, when `checkCredits()` returns false (uses `useCreditPreflight` hook).
```ts
posthog.capture('paywall_hit', {
  category: TO_SINGULAR[jewelryType] ?? jewelryType,   // singular jewelry type
  steps_completed: 2,   // user has completed: upload(1) + model selection(2)
})
```

**CAD:** `TextToCAD.tsx` → generate handler, when `balance < cost` (uses `performCreditPreflight` directly — different code pattern from photo studio, same intent).
```ts
posthog.capture('paywall_hit', {
  category: 'ring',   // hardcoded — CAD only supports rings currently; update when more categories added
  steps_completed: 1,   // user has completed: prompt entry only(1)
})
```

#### `cad_generation_completed`
Fired in: `TextToCAD.tsx` — immediately after `setGlbUrl(glb_url)` when the API returns the GLB URL (not after canvas renders it). This is consistent with how photo studio measures `duration_ms` (until result received, not until rendered). Canvas render time is device-dependent noise.

`cadGenStartTime` must be declared as `const cadGenStartTime = Date.now()` at the start of the real generation branch (after preflight passes, before the API call). Not inside the `simulateGeneration` branch.
```ts
posthog.capture('cad_generation_completed', {
  category: 'ring',   // hardcoded — CAD only supports rings currently; update when more categories added
  prompt_length: prompt.trim().length,
  duration_ms: Date.now() - cadGenStartTime,
})
```

---

### Enriched existing events

#### `generation_completed`
Current signature: `trackGenerationComplete(source: string, durationMs?: number)`
New signature: `trackGenerationComplete(props: GenerationCompleteProps)`
Update call site in `UnifiedStudio.tsx` when updating this function.

`upload_type` requires reading `validationResult?.category` from state (it IS safe to read from state here — `generation_completed` fires long after `handleJewelryUpload` completed and after the user has potentially clicked "Continue Anyway", so state is fully stable). This will capture both path A (worn, `was_flagged: false`) and path B ("continue anyway", `was_flagged: true`) users in the same event, letting PostHog compare generation outcomes by upload type.
```ts
posthog.capture('generation_completed', {
  source: 'unified-studio',
  category: TO_SINGULAR[jewelryType],
  upload_type: validationResult?.category ?? null,  // raw backend label; null if validation was skipped
  duration_ms: Date.now() - _genStartTime,   // _genStartTime already declared in handleGenerate
  is_first_ever: consumeFirstGeneration(),   // localStorage boolean — true only on very first generation ever
})
```

#### `download_clicked`
Current signature: `trackDownloadClicked(props?: { file_name?, file_type?, context? })`
New signature: same shape, new optional properties added. **No breaking change — existing call sites still compile.**

Additional properties only populated where context is available (UnifiedStudio-originated calls):
```ts
{
  category: TO_SINGULAR[jewelryType] ?? jewelryType,   // singular — only in UnifiedStudio context
}
```
Non-UnifiedStudio call sites (generations modals, StepRefineAndGenerate, TextToCAD) keep existing properties unchanged. The `context` field already distinguishes them.

#### `regenerate_clicked`
Add `category` and `regeneration_number`. `regenerationCount` is a React state counter `const [regenerationCount, setRegenerationCount] = useState(0)` in UnifiedStudio — increment it on each regenerate click alongside the existing call.
```ts
{
  context: 'unified-studio',
  category: TO_SINGULAR[jewelryType] ?? jewelryType,   // singular — matches all other events
  regeneration_number: regenerationCount + 1,  // +1 because state hasn't updated yet
}
```

#### `payment_success`
Current signature: `trackPaymentSuccess(plan?: string)` — **breaking change, update signature**.
New signature: `trackPaymentSuccess(props: PaymentSuccessProps)`

`creditsAdded` comes from `data.credits_added` (already in scope). `currency` comes from `useBillingLocale()` hook (add to `PaymentSuccess.tsx` — same hook used in `Pricing.tsx`).

```ts
// Credits → plan mapping (matches PLANS array in Pricing.tsx)
function derivePackageInfo(creditsAdded: number): { package: string; amount_usd: number } {
  if (creditsAdded <= 100) return { package: '$9', amount_usd: 9 };
  if (creditsAdded <= 500) return { package: '$39', amount_usd: 39 };
  return { package: '$99', amount_usd: 99 };
}

posthog.capture('payment_success', {
  package: pkg.package,
  amount_usd: pkg.amount_usd,
  currency_shown: currency,      // from useBillingLocale() — 'INR' or 'USD'
  // steps_completed_before_paying: intentionally omitted per PostHog guidance
  // (PostHog reconstructs pre-payment journey from event timeline natively)
  // category_at_time: intentionally omitted — not available post-Stripe redirect
  // is_repeat_buyer: intentionally omitted — PostHog reconstructs from event timeline natively
})
```

---

## Files Modified

| File | Changes |
|---|---|
| `src/main.tsx` | Remove `loadPostHog` fn + timer + interaction listeners; add static `import posthog`; add eager `posthog.init()` with bootstrap before `root.render()`; replace dynamic `import('posthog-js')` in two error handlers with direct `posthog` reference; remove 3-line identify-after-init patch |
| `src/lib/posthog-events.ts` | Add 5 new event functions; update `trackPaymentSuccess` and `trackGenerationComplete` signatures; add localStorage/sessionStorage counter helpers; update comments throughout |
| `src/pages/PhotographyStudioCategories.tsx` | Add `category_selected` to `handleCategoryClick`; add posthog-events import |
| `src/pages/UnifiedStudio.tsx` | Add `jewelry_uploaded` (in `handleJewelryUpload` for path A + in `handleContinueAnyway` for path B), `validation_flagged`, `model_selected`, `paywall_hit`; enrich `generation_completed`, `regenerate_clicked`, `download_clicked`; add `regenerationCount` state; update `trackGenerationComplete` call site |
| `src/pages/TextToCAD.tsx` | Add `paywall_hit`; add `cad_generation_completed`; add `cadGenStartTime` ref |
| `src/pages/PaymentSuccess.tsx` | Update `trackPaymentSuccess` call with new properties; add `useBillingLocale` import |

---

## What is NOT tracked (intentional gaps)

| Property | Reason omitted |
|---|---|
| `steps_completed_before_paying` on `payment_success` | PostHog reconstructs from event timeline natively — confirmed with PostHog |
| `category_at_time` on `payment_success` | Not available after Stripe redirect. Not worth the localStorage plumbing. |
| `is_repeat_buyer` on `payment_success` | PostHog reconstructs from event timeline natively — confirmed with PostHog |
| `generation_number` on `generation_completed` + `cad_generation_completed` | PostHog reconstructs true counts natively. localStorage counter adds complexity and failure modes for no gain at PMF stage. |
| `session_generation_count` on `generation_completed` | Same as above. |
| `is_first_download` on `download_clicked` | Same as above. |

---

## Regression Protection

- No existing event is removed or renamed
- `trackDownloadClicked` signature is backward-compatible (new optional properties only)
- `trackPaymentSuccess` signature changes — only one call site (`PaymentSuccess.tsx:63`)
- `trackGenerationComplete` signature changes — only one call site (`UnifiedStudio.tsx`)
- `identifyUser()` in `AuthContext` stays — harmless double-identify for returning users, PostHog deduplicates
- `posthog.__loaded` guards stay on all `capture()` calls as safety net
- `vendor-posthog` stays in `manualChunks` — keeps PostHog in its own chunk
- Build must pass (`npm run build`) before considering done

---

## Testing Checklist

**Init / Identity:**
- [ ] Open app as a logged-out user → PostHog session starts anonymous, no UUID persisted
- [ ] Log in via Google OAuth → PostHog identifies user with email in Live Events
- [ ] Open app as returning user (cached session) → PostHog identifies user immediately, no UUID — verify in session replay
- [ ] Log out → PostHog `reset()` fires, next session is anonymous

**Category / Upload:**
- [ ] Select a category → `category_selected` fires, `is_first_selection: true`
- [ ] Navigate back and select again same session → `category_selected` fires, `is_first_selection: false`
- [ ] Upload worn jewelry (mannequin/model/body_part) → `jewelry_uploaded` fires with `was_flagged: false` and correct `upload_type`
- [ ] Upload flatlay/non-worn jewelry → `validation_flagged` fires with correct `detected_label`; `jewelry_uploaded` does NOT fire yet
- [ ] After flatlay validation dialog → click "Go Back & Re-upload" → no `jewelry_uploaded` fires
- [ ] After flatlay validation dialog → click "Continue Anyway" → `jewelry_uploaded` fires with `was_flagged: true` and non-worn `upload_type`
- [ ] Paste an image into step 2 (model upload) → `model_selected` fires with `model_type: 'custom_upload'`

**Model / Generate:**
- [ ] Select a catalog model → `model_selected` fires with `model_type: 'catalog'`
- [ ] Upload a custom model → `model_selected` fires with `model_type: 'custom_upload'`
- [ ] Click Generate with zero credits (photo studio) → `paywall_hit` fires with `steps_completed: 2`, `category` = singular jewelry type
- [ ] Click Generate in CAD with zero credits → `paywall_hit` fires with `steps_completed: 1`, `category: 'ring'`
- [ ] Complete a photo generation → `generation_completed` fires with `is_first_ever: true`
- [ ] Complete a second generation → `is_first_ever: false`
- [ ] Regenerate → `regenerate_clicked` fires with `regeneration_number: 1`
- [ ] Regenerate again → `regeneration_number: 2`

**Download:**
- [ ] Download a result → `download_clicked` fires with `category` populated
- [ ] Download from generations modal (non-UnifiedStudio) → `download_clicked` fires with existing properties only, no `category` — regression check

**CAD:**
- [ ] Complete a CAD generation → `cad_generation_completed` fires with `prompt_length` > 0 and `duration_ms` > 0

**Payment:**
- [ ] Complete payment → `payment_success` fires with correct `package`, `amount_usd`, `currency_shown`
