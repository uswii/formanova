# PostHog Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the PostHog identity race condition (returning users appear as UUIDs in session replay) and add full funnel event coverage across the photo studio and CAD flows.

**Architecture:** Eager PostHog init with `bootstrap` eliminates the identity race condition at the source. All new event functions live in `posthog-events.ts` (single audit point). `TO_SINGULAR` is extracted to a shared lib first so both `UnifiedStudio.tsx` and `PhotographyStudioCategories.tsx` can normalise jewelry type strings to singular form.

**Tech Stack:** posthog-js, React, TypeScript, Vitest

---

## File Map

| File | Role |
|---|---|
| `src/lib/jewelry-utils.ts` | **Create** — export `TO_SINGULAR` map (moved from UnifiedStudio.tsx) |
| `src/lib/posthog-events.ts` | **Modify** — add 6 new event functions, update 4 existing signatures, add `consumeFirstGeneration()` helper |
| `src/lib/posthog-events.test.ts` | **Create** — Vitest unit tests for posthog-events.ts |
| `src/main.tsx` | **Modify** — replace lazy init with eager `posthog.init()` + bootstrap |
| `src/pages/PhotographyStudioCategories.tsx` | **Modify** — add `category_selected` event |
| `src/pages/UnifiedStudio.tsx` | **Modify** — add 5 new events + enrich 3 existing; add `regenerationCount` state |
| `src/pages/TextToCAD.tsx` | **Modify** — add `paywall_hit` + `cad_generation_completed` |
| `src/pages/PaymentSuccess.tsx` | **Modify** — update `trackPaymentSuccess` call with new properties |

---

## Task 0: Extract TO_SINGULAR to shared lib

`TO_SINGULAR` is currently a private `const` inside `UnifiedStudio.tsx` (line 111). `PhotographyStudioCategories.tsx` needs it for the `category_selected` event. Extract it first so all subsequent tasks can import it.

**Files:**
- Create: `src/lib/jewelry-utils.ts`
- Modify: `src/pages/UnifiedStudio.tsx:111-117`

- [ ] **Step 1: Create `src/lib/jewelry-utils.ts`**

```ts
// Normalise plural or singular jewelry type URL params → singular for PostHog events and API payloads.
// Both forms accepted so routes like /studio/rings and /studio/ring both work.
export const TO_SINGULAR: Record<string, string> = {
  necklace: 'necklace', necklaces: 'necklace',
  earring: 'earring',   earrings: 'earring',
  ring: 'ring',         rings: 'ring',
  bracelet: 'bracelet', bracelets: 'bracelet',
  watch: 'watch',       watches: 'watch',
};
```

- [ ] **Step 2: Remove the duplicate const from `UnifiedStudio.tsx`**

In `src/pages/UnifiedStudio.tsx`, delete lines 110–117 (the `// Normalise URL param` comment and the `TO_SINGULAR` const).

Add this import at the top of the file with the other `@/lib/` imports:

```ts
import { TO_SINGULAR } from '@/lib/jewelry-utils';
```

- [ ] **Step 3: Verify build still passes**

```bash
npm run build
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/jewelry-utils.ts src/pages/UnifiedStudio.tsx
git commit -m "refactor: extract TO_SINGULAR to src/lib/jewelry-utils.ts"
```

---

## Task 1: Write failing tests for posthog-events.ts (TDD)

Write all the tests before touching the implementation. They will fail — that is correct at this stage.

**Files:**
- Create: `src/lib/posthog-events.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock posthog-js BEFORE importing posthog-events
vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), __loaded: true },
}))

import posthog from 'posthog-js'
import {
  consumeFirstGeneration,
  trackCategorySelected,
  trackJewelryUploaded,
  trackValidationFlagged,
  trackModelSelected,
  trackPaywallHit,
  trackCadGenerationCompleted,
  trackGenerationComplete,
  trackDownloadClicked,
  trackRegenerateClicked,
  trackPaymentSuccess,
} from './posthog-events'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

// ── consumeFirstGeneration ──────────────────────────────────────────

describe('consumeFirstGeneration', () => {
  it('returns true on first call', () => {
    expect(consumeFirstGeneration()).toBe(true)
  })

  it('returns false on all subsequent calls', () => {
    consumeFirstGeneration()
    expect(consumeFirstGeneration()).toBe(false)
    expect(consumeFirstGeneration()).toBe(false)
  })

  it('persists across calls via localStorage', () => {
    consumeFirstGeneration()
    // Simulate a new module import by calling again — state is in localStorage
    expect(consumeFirstGeneration()).toBe(false)
  })
})

// ── __loaded guard ──────────────────────────────────────────────────

describe('__loaded guard', () => {
  it('does not capture when __loaded is false', () => {
    ;(posthog as any).__loaded = false
    trackJewelryUploaded({ category: 'ring', upload_type: 'mannequin', was_flagged: false })
    expect(posthog.capture).not.toHaveBeenCalled()
    ;(posthog as any).__loaded = true
  })
})

// ── New event functions ─────────────────────────────────────────────

describe('trackCategorySelected', () => {
  it('captures category_selected with correct shape', () => {
    trackCategorySelected({ category: 'ring', is_first_selection: true })
    expect(posthog.capture).toHaveBeenCalledWith('category_selected', {
      category: 'ring',
      is_first_selection: true,
    })
  })
})

describe('trackJewelryUploaded', () => {
  it('captures jewelry_uploaded — accepted path', () => {
    trackJewelryUploaded({ category: 'ring', upload_type: 'mannequin', was_flagged: false })
    expect(posthog.capture).toHaveBeenCalledWith('jewelry_uploaded', {
      category: 'ring',
      upload_type: 'mannequin',
      was_flagged: false,
    })
  })

  it('captures jewelry_uploaded — continue anyway path', () => {
    trackJewelryUploaded({ category: 'earring', upload_type: 'flatlay', was_flagged: true })
    expect(posthog.capture).toHaveBeenCalledWith('jewelry_uploaded', {
      category: 'earring',
      upload_type: 'flatlay',
      was_flagged: true,
    })
  })
})

describe('trackValidationFlagged', () => {
  it('captures validation_flagged with static validation_reason', () => {
    trackValidationFlagged({ category: 'ring', detected_label: 'flatlay' })
    expect(posthog.capture).toHaveBeenCalledWith('validation_flagged', {
      category: 'ring',
      detected_label: 'flatlay',
      validation_reason: 'wrong_shot_type',
    })
  })
})

describe('trackModelSelected', () => {
  it('captures model_selected for catalog model', () => {
    trackModelSelected({ category: 'ring', model_type: 'catalog' })
    expect(posthog.capture).toHaveBeenCalledWith('model_selected', {
      category: 'ring',
      model_type: 'catalog',
    })
  })

  it('captures model_selected for custom upload', () => {
    trackModelSelected({ category: 'necklace', model_type: 'custom_upload' })
    expect(posthog.capture).toHaveBeenCalledWith('model_selected', {
      category: 'necklace',
      model_type: 'custom_upload',
    })
  })
})

describe('trackPaywallHit', () => {
  it('captures paywall_hit for photo studio', () => {
    trackPaywallHit({ category: 'ring', steps_completed: 2 })
    expect(posthog.capture).toHaveBeenCalledWith('paywall_hit', {
      category: 'ring',
      steps_completed: 2,
    })
  })

  it('captures paywall_hit for CAD', () => {
    trackPaywallHit({ category: 'ring', steps_completed: 1 })
    expect(posthog.capture).toHaveBeenCalledWith('paywall_hit', {
      category: 'ring',
      steps_completed: 1,
    })
  })
})

describe('trackCadGenerationCompleted', () => {
  it('captures cad_generation_completed with correct shape', () => {
    trackCadGenerationCompleted({ category: 'ring', prompt_length: 42, duration_ms: 5000 })
    expect(posthog.capture).toHaveBeenCalledWith('cad_generation_completed', {
      category: 'ring',
      prompt_length: 42,
      duration_ms: 5000,
    })
  })
})

// ── Updated existing functions ──────────────────────────────────────

describe('trackGenerationComplete', () => {
  it('captures generation_completed with all new props', () => {
    trackGenerationComplete({
      source: 'unified-studio',
      category: 'ring',
      upload_type: 'mannequin',
      duration_ms: 3000,
      is_first_ever: true,
    })
    expect(posthog.capture).toHaveBeenCalledWith('generation_completed', {
      source: 'unified-studio',
      category: 'ring',
      upload_type: 'mannequin',
      duration_ms: 3000,
      is_first_ever: true,
    })
  })

  it('accepts null upload_type', () => {
    trackGenerationComplete({
      source: 'unified-studio',
      category: 'ring',
      upload_type: null,
      duration_ms: 3000,
      is_first_ever: false,
    })
    expect(posthog.capture).toHaveBeenCalledWith('generation_completed', expect.objectContaining({
      upload_type: null,
    }))
  })
})

describe('trackDownloadClicked', () => {
  it('captures download_clicked with no args', () => {
    trackDownloadClicked()
    expect(posthog.capture).toHaveBeenCalledWith('download_clicked', {})
  })

  it('captures download_clicked with category', () => {
    trackDownloadClicked({ category: 'ring', context: 'unified-studio' })
    expect(posthog.capture).toHaveBeenCalledWith('download_clicked', {
      category: 'ring',
      context: 'unified-studio',
    })
  })

  it('captures download_clicked without category (non-UnifiedStudio call site)', () => {
    trackDownloadClicked({ file_type: 'glb', context: 'text-to-cad' })
    expect(posthog.capture).toHaveBeenCalledWith('download_clicked', {
      file_type: 'glb',
      context: 'text-to-cad',
    })
  })
})

describe('trackRegenerateClicked', () => {
  it('captures regenerate_clicked with enriched props', () => {
    trackRegenerateClicked({ context: 'unified-studio', category: 'ring', regeneration_number: 1 })
    expect(posthog.capture).toHaveBeenCalledWith('regenerate_clicked', {
      context: 'unified-studio',
      category: 'ring',
      regeneration_number: 1,
    })
  })
})

describe('trackPaymentSuccess', () => {
  it('captures payment_success with correct shape', () => {
    trackPaymentSuccess({ package: '$9', amount_usd: 9, currency_shown: 'USD' })
    expect(posthog.capture).toHaveBeenCalledWith('payment_success', {
      package: '$9',
      amount_usd: 9,
      currency_shown: 'USD',
    })
  })
})
```

- [ ] **Step 2: Run tests — confirm they all fail**

```bash
npx vitest run src/lib/posthog-events.test.ts
```

Expected: tests fail because the new functions don't exist yet. That is correct.

---

## Task 2: Update posthog-events.ts to pass the tests

**Files:**
- Modify: `src/lib/posthog-events.ts`

- [ ] **Step 1: Replace the entire contents of `src/lib/posthog-events.ts`**

```ts
import posthog from 'posthog-js';

/** Safe wrapper — only fires when PostHog is loaded */
function capture(event: string, properties?: Record<string, unknown>) {
  // posthog.__loaded is always true after eager init in main.tsx.
  // Guard kept as a safety net in case init order ever changes.
  if (posthog.__loaded) {
    posthog.capture(event, properties);
  }
}

// ═══════ localStorage helper ════════════════════════════════════════

const PH_FIRST_GEN_KEY = 'ph_first_generation_done';

/** Returns true only on the very first generation_completed call ever.
 *  Flips to false permanently after that.
 *  Stored in localStorage — robust to session resets, not to storage clears. */
export function consumeFirstGeneration(): boolean {
  const done = localStorage.getItem(PH_FIRST_GEN_KEY) === '1';
  if (!done) localStorage.setItem(PH_FIRST_GEN_KEY, '1');
  return !done;
}

// ═══════ Types ══════════════════════════════════════════════════════

export interface CategorySelectedProps {
  category: string;
  is_first_selection: boolean;
}

export interface JewelryUploadedProps {
  category: string;
  upload_type: string;
  was_flagged: boolean;
}

export interface ValidationFlaggedProps {
  category: string;
  detected_label: string;
}

export interface ModelSelectedProps {
  category: string;
  model_type: 'catalog' | 'custom_upload';
}

export interface PaywallHitProps {
  category: string;
  steps_completed: number;
}

export interface CadGenerationCompletedProps {
  category: string;
  prompt_length: number;
  duration_ms: number;
}

export interface GenerationCompleteProps {
  source: string;
  category: string;
  upload_type: string | null;
  duration_ms: number;
  is_first_ever: boolean;
}

export interface PaymentSuccessProps {
  package: string;
  amount_usd: number;
  currency_shown: string;
}

// ═══════ Auth Events ════════════════════════════════════════════════

export function trackSignup(method: string, email?: string) {
  capture('user_signed_up', { method, email });
}

export function trackLogin(method: string, email?: string) {
  capture('user_logged_in', { method, email });
}

export function trackLogout() {
  capture('user_logged_out');
  if (posthog.__loaded) posthog.reset();
}

// ═══════ Feature Usage ══════════════════════════════════════════════

export function trackStudioOpen(category: string) {
  capture('studio_opened', { category });
}

export function trackBatchSubmit(imageCount: number, category: string) {
  capture('batch_submitted', { image_count: imageCount, category });
}

export function trackGenerationStart(source: string) {
  capture('generation_started', { source });
}

// Signature change: was trackGenerationComplete(source: string, durationMs?: number)
// Only one call site — UnifiedStudio.tsx. Update it when updating this function.
export function trackGenerationComplete(props: GenerationCompleteProps) {
  capture('generation_completed', { ...props });
}

// ═══════ New Funnel Events ═══════════════════════════════════════════

export function trackCategorySelected(props: CategorySelectedProps) {
  capture('category_selected', { ...props });
}

export function trackJewelryUploaded(props: JewelryUploadedProps) {
  capture('jewelry_uploaded', { ...props });
}

export function trackValidationFlagged(props: ValidationFlaggedProps) {
  capture('validation_flagged', {
    ...props,
    validation_reason: 'wrong_shot_type', // static — only reason currently
  });
}

export function trackModelSelected(props: ModelSelectedProps) {
  capture('model_selected', { ...props });
}

export function trackPaywallHit(props: PaywallHitProps) {
  capture('paywall_hit', { ...props });
}

export function trackCadGenerationCompleted(props: CadGenerationCompletedProps) {
  capture('cad_generation_completed', { ...props });
}

// ═══════ Conversion / Checkout ══════════════════════════════════════

export function trackCheckoutStart(plan?: string) {
  capture('checkout_started', { plan });
}

// Signature change: was trackPaymentSuccess(plan?: string)
// Only one call site — PaymentSuccess.tsx:63. Update it when updating this function.
export function trackPaymentSuccess(props: PaymentSuccessProps) {
  capture('payment_success', { ...props });
}

export function trackPaymentCancel() {
  capture('payment_cancelled');
}

// ═══════ Engagement ═════════════════════════════════════════════════

export function trackButtonClick(buttonName: string, context?: string) {
  capture('button_clicked', { button: buttonName, context });
}

export function trackFormSubmit(formName: string) {
  capture('form_submitted', { form: formName });
}

// ═══════ 3D Rendering Diagnostics ═══════════════════════════════════

export function trackWebGLContextLost(stats: Record<string, unknown>) {
  capture('webgl_context_lost', stats);
}

export function trackWebGLContextRestored(stats: Record<string, unknown>) {
  capture('webgl_context_restored', stats);
}

// ═══════ User Identification ═════════════════════════════════════════

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (posthog.__loaded) {
    posthog.identify(userId, properties);
  }
}

// ═══════ Studio Actions ══════════════════════════════════════════════

// No breaking change — new optional `category` property added
export function trackDownloadClicked(props?: {
  file_name?: string;
  file_type?: string;
  context?: string;
  category?: string;
}) {
  capture('download_clicked', props ?? {});
}

// Signature change: was trackRegenerateClicked(context?: string)
// Only called in UnifiedStudio.tsx — update it alongside this change.
export function trackRegenerateClicked(props?: {
  context?: string;
  category?: string;
  regeneration_number?: number;
}) {
  capture('regenerate_clicked', props ?? {});
}
```

- [ ] **Step 2: Run tests — confirm they all pass**

```bash
npx vitest run src/lib/posthog-events.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/posthog-events.ts src/lib/posthog-events.test.ts
git commit -m "feat: add posthog event functions + consumeFirstGeneration helper (TDD)"
```

---

## Task 3: Fix main.tsx — eager PostHog init

Replace the entire lazy-loading machinery with an eager `posthog.init()` call that includes the `bootstrap` option for returning users.

**Files:**
- Modify: `src/main.tsx`

**What to remove:**
- The entire `loadPostHog` function (lines 87–108) and the `if (posthogKey)` block (lines 110–121)
- The `const posthogKey = '...'` line (line 84)
- The two `import('posthog-js').then(...)` blocks inside the error handlers (lines 29–31 and 49–51)

**What to add:**
- Static import `posthog` at the top
- Eager `posthog.init()` with bootstrap, placed after the domain redirect check passes (inside the `else` branch, before `root.render()`)
- Replace the two dynamic imports in error handlers with direct `posthog` references

- [ ] **Step 1: Add the static posthog import**

At the top of `src/main.tsx`, after the existing imports, add:

```ts
import posthog from 'posthog-js';
```

- [ ] **Step 2: Replace the two error handler dynamic imports**

In the `unhandledrejection` handler (lines 29–31), replace:
```ts
import('posthog-js').then(({ default: posthog }) => {
  if (posthog.__loaded) posthog.captureException(event.reason);
}).catch(() => {});
```
With:
```ts
if (posthog.__loaded) posthog.captureException(event.reason);
```

In the `error` handler (lines 49–51), replace:
```ts
import('posthog-js').then(({ default: posthog }) => {
  if (posthog.__loaded) posthog.captureException(event.error);
}).catch(() => {});
```
With:
```ts
if (posthog.__loaded) posthog.captureException(event.error);
```

- [ ] **Step 3: Replace the lazy-loading block with eager init**

Inside the `else` branch (after the domain redirect check), replace everything from `const posthogKey = ...` down to (but not including) `root.render(<App />)` with:

```ts
// ── PostHog: eager init with identity bootstrap ────────────────────
// posthog-js is already in the static import chain (via posthog-events.ts →
// AuthContext → App). Initialising eagerly costs no extra bandwidth.
// The bootstrap option sets the user identity atomically at init time,
// eliminating the race condition where identifyUser() fired before PostHog
// was ready — which caused returning users to appear as anonymous UUIDs.
//
// DO NOT revert to lazy/deferred init. The bundle was already downloaded
// eagerly; only init() was deferred, which just caused the bug.
//
// NOTE: getStoredUser is already imported at line 5 — do not add a duplicate.
// NOTE: distinctId lowercase — PostHog SDK is case-sensitive; distinctID silently no-ops.
const storedUser = getStoredUser();
posthog.init('phc_aN8qVaPxHbJIwdyuQfQkPdyrx9qDcytx1XUHSZfwvwC', {
  api_host: 'https://us.i.posthog.com',
  autocapture: true,
  capture_pageview: true,
  capture_pageleave: true,
  capture_exceptions: true,
  enable_heatmaps: true,
  bootstrap: storedUser
    ? { distinctId: storedUser.id, isIdentifiedID: true }
    : undefined,
});
```

After this block, `root.render(<App />)` stays as-is.

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx
git commit -m "fix: replace lazy PostHog init with eager init + identity bootstrap"
```

---

## Task 4: PhotographyStudioCategories.tsx — category_selected

**Files:**
- Modify: `src/pages/PhotographyStudioCategories.tsx`

**Context:** `category.id` values in this file are: `'necklace'`, `'earrings'`, `'rings'`, `'bracelets'`, `'watches'`. Most are already plural — `TO_SINGULAR` normalises them. The `is_first_selection` flag uses `sessionStorage` so it resets per browser tab session.

- [ ] **Step 1: Add imports**

Add to the top of `src/pages/PhotographyStudioCategories.tsx`:

```ts
import { trackCategorySelected } from '@/lib/posthog-events';
import { TO_SINGULAR } from '@/lib/jewelry-utils';
```

- [ ] **Step 2: Add sessionStorage constant**

Add above the `PhotographyStudio` component function:

```ts
const PH_CATEGORY_SELECTED_KEY = 'ph_category_selected';
```

- [ ] **Step 3: Update `handleCategoryClick`**

Replace:
```ts
const handleCategoryClick = (category: JewelryCategory) => {
  navigate(`/studio/${category.id}`);
};
```

With:
```ts
const handleCategoryClick = (category: JewelryCategory) => {
  const isFirst = !sessionStorage.getItem(PH_CATEGORY_SELECTED_KEY);
  sessionStorage.setItem(PH_CATEGORY_SELECTED_KEY, '1');
  trackCategorySelected({
    category: TO_SINGULAR[category.id] ?? category.id,
    is_first_selection: isFirst,
  });
  navigate(`/studio/${category.id}`);
};
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/PhotographyStudioCategories.tsx
git commit -m "feat: track category_selected event in PhotographyStudioCategories"
```

---

## Task 5: UnifiedStudio.tsx — upload, model, paywall, generation events

This is the largest task. Read each step carefully before editing — UnifiedStudio.tsx is a large file. Make one change at a time.

**Files:**
- Modify: `src/pages/UnifiedStudio.tsx`

**Key line numbers (verify before editing — may shift):**
- Imports section: ~lines 1–84
- `TO_SINGULAR` const: already removed in Task 0
- `handleJewelryUpload`: starts ~line 347
- `handleModelUpload`: starts ~line 372
- `handleSelectLibraryModel`: starts ~line 418
- `handleContinueAnyway`: ~line 456
- `handleGenerate`: starts ~line 463, `_genStartTime` at ~line 481, success branch ends ~line 593
- Download button onClick: ~line 1409
- Regenerate button onClick: ~line 1454

- [ ] **Step 1: Update posthog-events imports**

In the existing imports at the top of `UnifiedStudio.tsx`, find where `posthog-events` functions are used or add a new import line. Add all needed functions in one import:

```ts
import {
  trackJewelryUploaded,
  trackValidationFlagged,
  trackModelSelected,
  trackPaywallHit,
  trackGenerationComplete,
  trackDownloadClicked,
  trackRegenerateClicked,
  consumeFirstGeneration,
} from '@/lib/posthog-events';
```

- [ ] **Step 2: Add `regenerationCount` state**

In the state declarations block (around line 160–200), add:

```ts
const [regenerationCount, setRegenerationCount] = useState(0);
```

- [ ] **Step 3: Add events to `handleJewelryUpload`**

Find `handleJewelryUpload`. The validation result block currently looks like:

```ts
const result = await validateImages([normalized], jewelryType);
if (result && result.results.length > 0) {
  setValidationResult(result.results[0]);
  if (result.results[0].uploaded_url) {
    setJewelryUploadedUrl(result.results[0].uploaded_url);
  }
}
```

Replace with:

```ts
const result = await validateImages([normalized], jewelryType);
if (result && result.results.length > 0) {
  const localResult = result.results[0]; // use local variable — validationResult state is stale here (async setter)
  setValidationResult(localResult);
  if (localResult.uploaded_url) {
    setJewelryUploadedUrl(localResult.uploaded_url);
  }

  if (localResult.is_acceptable) {
    // Path A: worn image accepted — fire jewelry_uploaded immediately
    trackJewelryUploaded({
      category: TO_SINGULAR[jewelryType] ?? jewelryType,
      upload_type: localResult.category,
      was_flagged: false,
    });
  } else {
    // Path B: non-worn image flagged — fire validation_flagged now;
    // jewelry_uploaded fires in handleContinueAnyway if user proceeds
    trackValidationFlagged({
      category: TO_SINGULAR[jewelryType] ?? jewelryType,
      detected_label: localResult.category,
    });
  }
}
```

- [ ] **Step 4: Add event to `handleContinueAnyway`**

Find `handleContinueAnyway` (~line 456). Replace:

```ts
const handleContinueAnyway = () => {
  setShowFlaggedDialog(false);
  setCurrentStep('model');
};
```

With:

```ts
const handleContinueAnyway = () => {
  // Path B: user chose to proceed despite validation warning.
  // validationResult state IS safe to read here — validation finished before this dialog appeared.
  if (validationResult) {
    trackJewelryUploaded({
      category: TO_SINGULAR[jewelryType] ?? jewelryType,
      upload_type: validationResult.category,
      was_flagged: true,
    });
  }
  setShowFlaggedDialog(false);
  setCurrentStep('model');
};
```

- [ ] **Step 5: Add `trackModelSelected` to `handleSelectLibraryModel`**

Find `handleSelectLibraryModel` (~line 418). Replace:

```ts
const handleSelectLibraryModel = (model: ModelImage) => {
  setSelectedModel(model);
  setCustomModelImage(null);
  setCustomModelFile(null);
};
```

With:

```ts
const handleSelectLibraryModel = (model: ModelImage) => {
  setSelectedModel(model);
  setCustomModelImage(null);
  setCustomModelFile(null);
  trackModelSelected({
    category: TO_SINGULAR[jewelryType] ?? jewelryType,
    model_type: 'catalog',
  });
};
```

- [ ] **Step 6: Add `trackModelSelected` to `handleModelUpload`**

In `handleModelUpload`, find the line `setCustomModelImage(stableUrl)` (inside the Azure upload try block). After that line and the `setModelAssetId` line, add:

```ts
trackModelSelected({
  category: TO_SINGULAR[jewelryType] ?? jewelryType,
  model_type: 'custom_upload',
});
```

- [ ] **Step 7: Add `trackPaywallHit` to `handleGenerate`**

In `handleGenerate`, find:

```ts
const hasCredits = await checkCredits('jewelry_photoshoots_generator');
if (!hasCredits) return;
```

Replace with:

```ts
const hasCredits = await checkCredits('jewelry_photoshoots_generator');
if (!hasCredits) {
  trackPaywallHit({
    category: TO_SINGULAR[jewelryType] ?? jewelryType,
    steps_completed: 2,
  });
  return;
}
```

- [ ] **Step 8: Add `trackGenerationComplete` on success in `handleGenerate`**

In `handleGenerate`, find the success branch where `markGenerationCompleted` is called:

```ts
markGenerationCompleted(_genWorkflowId, _genStartTime);
refreshCredits();
return;
```

Replace with:

```ts
markGenerationCompleted(_genWorkflowId, _genStartTime);
trackGenerationComplete({
  source: 'unified-studio',
  category: TO_SINGULAR[jewelryType] ?? jewelryType,
  upload_type: validationResult?.category ?? null,
  duration_ms: Date.now() - _genStartTime,
  is_first_ever: consumeFirstGeneration(),
});
refreshCredits();
return;
```

- [ ] **Step 9: Add `trackDownloadClicked` to the download button**

Find the download button onClick handler (~line 1409). It currently ends with `URL.revokeObjectURL(blobUrl)`. Add the tracking call before the closing `}` of the `try` block:

```ts
trackDownloadClicked({
  file_type: 'jpg',
  context: 'unified-studio',
  category: TO_SINGULAR[jewelryType] ?? jewelryType,
});
```

- [ ] **Step 10: Update the regenerate button**

Find the regenerate button onClick (~line 1454):

```ts
onClick={() => { import('@/lib/posthog-events').then(m => m.trackRegenerateClicked('unified-studio')); setResultImages([]); setCurrentStep('generating'); handleGenerate(); }}
```

Replace with (using the static import already added in Step 1):

```ts
onClick={() => {
  setRegenerationCount(c => c + 1);
  trackRegenerateClicked({
    context: 'unified-studio',
    category: TO_SINGULAR[jewelryType] ?? jewelryType,
    regeneration_number: regenerationCount + 1, // +1 because setRegenerationCount hasn't updated state yet
  });
  setResultImages([]);
  setCurrentStep('generating');
  handleGenerate();
}}
```

- [ ] **Step 11: Verify build passes**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
git add src/pages/UnifiedStudio.tsx
git commit -m "feat: add jewelry upload, model, paywall, and generation events to UnifiedStudio"
```

---

## Task 6: TextToCAD.tsx — paywall_hit + cad_generation_completed

**Files:**
- Modify: `src/pages/TextToCAD.tsx`

**Key line numbers (verify before editing):**
- `performCreditPreflight` for main generation: ~line 331
- `balance < cost` check in main generation: ~line 334
- API call start (`authenticatedFetch /api/run/ring_generate_v1`): ~line 354
- `setGlbUrl(glb_url)` in main generation result: ~line 485

**Note:** There is a second `balance < cost` check in `runEditWithPrompt` (~line 515). Do NOT add `paywall_hit` there — that is an edit handler for an existing model, not an initial generation. Do NOT add `cad_generation_completed` to the edit path either (line 629).

- [ ] **Step 1: Add imports**

Add to the imports at the top of `TextToCAD.tsx`:

```ts
import { trackPaywallHit, trackCadGenerationCompleted } from '@/lib/posthog-events';
```

- [ ] **Step 2: Add `trackPaywallHit` to the main generate handler**

Find the main generation handler's credit check (~line 334):

```ts
if (balance < cost) {
  setCreditBlock({ approved: false, estimatedCredits: cost, currentBalance: balance });
  return;
}
```

Replace with:

```ts
if (balance < cost) {
  setCreditBlock({ approved: false, estimatedCredits: cost, currentBalance: balance });
  trackPaywallHit({ category: 'ring', steps_completed: 1 });
  return;
}
```

- [ ] **Step 3: Add `cadGenStartTime` before the API call**

Find the line `setWorkspaceActive(true)` (just after the preflight `try/catch` block ends). Add one line before it:

```ts
const cadGenStartTime = Date.now(); // for cad_generation_completed duration_ms
setWorkspaceActive(true);
```

- [ ] **Step 4: Add `trackCadGenerationCompleted` after `setGlbUrl`**

Find the main generation success path. Locate:

```ts
setGlbUrl(glb_url);
setProgressStep("_loading");
setIsModelLoading(true);
setIsGenerating(false);
```

Replace with:

```ts
setGlbUrl(glb_url);
trackCadGenerationCompleted({
  category: 'ring', // hardcoded — CAD only supports rings currently; update when more categories added
  prompt_length: prompt.trim().length,
  duration_ms: Date.now() - cadGenStartTime,
});
setProgressStep("_loading");
setIsModelLoading(true);
setIsGenerating(false);
```

- [ ] **Step 5: Verify build passes**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/TextToCAD.tsx
git commit -m "feat: add paywall_hit and cad_generation_completed events to TextToCAD"
```

---

## Task 7: PaymentSuccess.tsx — enrich payment_success

**Files:**
- Modify: `src/pages/PaymentSuccess.tsx`

**Context:** `trackPaymentSuccess()` is called at line 63, after `data.status === 'fulfilled'`. `data.credits_added` is in scope at that point.

- [ ] **Step 1: Add `useBillingLocale` import**

Add to the imports:

```ts
import { useBillingLocale } from '@/hooks/use-billing-locale';
```

- [ ] **Step 2: Add `derivePackageInfo` helper**

Add this function at **module scope**, before the `PaymentSuccess` component function (it's a pure utility with no closure over component state — placing it inside the component would redefine it on every render):

```ts
function derivePackageInfo(creditsAdded: number): { package: string; amount_usd: number } {
  if (creditsAdded <= 100) return { package: '$9', amount_usd: 9 };
  if (creditsAdded <= 500) return { package: '$39', amount_usd: 39 };
  return { package: '$99', amount_usd: 99 };
}
```

- [ ] **Step 3: Add the `useBillingLocale` hook call and a currency ref**

`useBillingLocale()` resolves asynchronously — by the time the currency value updates from `'USD'` to `'INR'`, `verify`'s `useCallback` closure already holds the stale `'USD'` value, and `calledRef.current = true` prevents the effect from re-running. Adding `currency` to the dep array does not help here. Use a `ref` instead — a ref is always read at call time, not captured in the closure.

Inside the `PaymentSuccess` component body, alongside the existing hooks, add:

```ts
const { currency } = useBillingLocale();
const currencyRef = useRef<string>('USD');
```

Then sync the ref whenever `currency` changes. Add this `useEffect` alongside the other effects:

```ts
useEffect(() => { currencyRef.current = currency; }, [currency]);
```

Now `verify` reads `currencyRef.current` (Step 4) instead of `currency` directly — no stale closure problem.

- [ ] **Step 4: Update the `trackPaymentSuccess` call**

Find:

```ts
trackPaymentSuccess();
```

Replace with:

```ts
const pkg = derivePackageInfo(data.credits_added);
trackPaymentSuccess({
  package: pkg.package,
  amount_usd: pkg.amount_usd,
  currency_shown: currencyRef.current, // ref — always reads current value at call time, not stale closure
});
```

- [ ] **Step 5: Verify build passes**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/PaymentSuccess.tsx
git commit -m "feat: enrich payment_success event with package, amount, and currency"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass including `posthog-events.test.ts`.

- [ ] **Step 2: Full production build**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors and no warnings about missing exports.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: no new lint errors introduced.

- [ ] **Step 4: Smoke test the identity fix**

Open the app in a browser where you are already logged in (cached session). Open PostHog → Activity → Live Events. Refresh the app. Within 1–2 seconds, a `$pageview` event should appear with a `distinct_id` matching your user ID (not an anonymous UUID). This confirms the bootstrap fix is working.

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -p  # stage any final cleanups
git commit -m "chore: posthog overhaul — final cleanup"
```
