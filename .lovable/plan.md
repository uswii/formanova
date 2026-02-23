
# Silent Token Refresh via Authenticated Fetch Interceptor

## Problem

The app has 6+ API modules that independently call `fetch()` with the stored JWT. When the token expires:
- Each module fails independently with 401 errors
- UI components show errors, flash, and reset state
- The admin dashboard's ad-hoc retry in `fetchBatches` doesn't cover other calls
- There is no refresh token -- the FastAPI backend only issues access tokens via Google OAuth

## Solution: Centralized Fetch Wrapper with Silent Re-Authentication

Since the backend has no refresh token endpoint, the only way to get a fresh token is to silently re-initiate Google OAuth. However, Google OAuth requires a full-page redirect, making truly silent refresh impossible without backend changes.

**Practical approach**: Create a centralized `authFetch` wrapper that:

1. Intercepts all API calls
2. On 401, queues pending requests and attempts a single background token validation
3. If validation fails, shows a non-disruptive inline re-auth prompt (NOT a logout) -- a small banner or modal saying "Session expired -- click to reconnect" that re-triggers Google OAuth
4. Never clears app state, never logs out, never flashes errors
5. Retries queued requests after successful re-auth

## Implementation Details

### 1. Create `src/lib/auth-fetch.ts` -- Centralized fetch interceptor

- Wraps native `fetch` with automatic 401 handling
- Maintains a request queue during re-auth
- Uses a mutex/lock so only one refresh attempt happens at a time
- On 401: pauses new requests, attempts `getCurrentUser()`, if that also 401s, sets a `needsReauth` flag (but does NOT clear session)
- On successful reauth: replays all queued requests with the new token

```
authFetch(url, options)
  --> fetch(url, options)
  --> if 401:
       if already refreshing: queue this request, wait
       else: lock, try getCurrentUser()
         success: unlock, retry this + queued requests
         fail: set needsReauth flag, reject with AuthExpiredError
```

### 2. Create `src/components/SessionExpiredBanner.tsx`

- A small, non-intrusive banner at the top of the page
- Only appears when `needsReauth` is true
- Shows "Session expired -- click to reconnect" with a Google sign-in button
- Clicking it opens a popup or redirects for Google OAuth
- After successful re-auth, banner disappears and app continues normally
- Never clears user state or navigates away

### 3. Update `src/contexts/AuthContext.tsx`

- Add `needsReauth` state to the context
- Expose a `refreshSession` method that re-triggers OAuth
- The `SessionExpiredBanner` reads from this context
- Background validation no longer returns null silently -- it sets `needsReauth` if token is expired

### 4. Update all API modules to use `authFetch`

Replace raw `fetch` calls with `authFetch` in:

| File | Change |
|------|--------|
| `src/lib/auth-api.ts` | Export `authFetch`, update `getCurrentUser` |
| `src/lib/temporal-api.ts` | Replace `fetch` with `authFetch` in all methods |
| `src/lib/microservices-api.ts` | Replace `fetch` with `authFetch` in all functions |
| `src/lib/credits-api.ts` | Replace `fetch` with `authFetch` |
| `src/lib/jewelry-generate-api.ts` | Replace `fetch` with `authFetch` |
| `src/hooks/use-image-validation.ts` | Replace `fetch` with `authFetch` |
| `src/pages/AdminBatches.tsx` | Replace `fetch` with `authFetch`, remove ad-hoc retry logic |

### 5. Update `src/App.tsx`

- Add `SessionExpiredBanner` component at the top level inside `AuthProvider`

## What This Achieves

- **Zero UI disruption**: 401 errors are caught before they reach components
- **Request queuing**: Multiple simultaneous 401s trigger only one re-auth attempt
- **No forced logout**: User stays visually logged in; app state is preserved
- **Graceful re-auth**: A small banner prompts reconnection only when truly needed
- **Centralized**: All future API calls automatically get 401 protection

## Files to Create
- `src/lib/auth-fetch.ts`
- `src/components/SessionExpiredBanner.tsx`

## Files to Modify
- `src/contexts/AuthContext.tsx`
- `src/lib/temporal-api.ts`
- `src/lib/microservices-api.ts`
- `src/lib/credits-api.ts`
- `src/lib/jewelry-generate-api.ts`
- `src/hooks/use-image-validation.ts`
- `src/pages/AdminBatches.tsx`
- `src/App.tsx`
