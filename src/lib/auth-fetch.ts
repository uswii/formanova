// Centralized fetch interceptor with automatic 401 handling
// Queues requests during re-auth, retries after success, never clears session

import { getStoredToken, authApi } from '@/lib/auth-api';

// Custom error for expired auth that needs user interaction
export class AuthExpiredError extends Error {
  constructor() {
    super('Session expired — please reconnect');
    this.name = 'AuthExpiredError';
  }
}

// ========== Re-auth State (shared with AuthContext) ==========

type ReauthListener = (needsReauth: boolean) => void;
let _needsReauth = false;
const _listeners: Set<ReauthListener> = new Set();

export function getNeedsReauth(): boolean {
  return _needsReauth;
}

export function setNeedsReauth(value: boolean): void {
  _needsReauth = value;
  _listeners.forEach(fn => fn(value));
}

export function onNeedsReauthChange(listener: ReauthListener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

// ========== Refresh Mutex & Request Queue ==========

let _isRefreshing = false;
let _refreshPromise: Promise<boolean> | null = null;

interface QueuedRequest {
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
  url: RequestInfo | URL;
  init?: RequestInit;
}

const _queue: QueuedRequest[] = [];

/**
 * Attempt to silently refresh the session by calling getCurrentUser().
 * If the backend returns a valid user (meaning the token is still valid
 * or was refreshed server-side), this succeeds. Otherwise we flag needsReauth.
 */
async function attemptSilentRefresh(): Promise<boolean> {
  try {
    console.log('[authFetch] Attempting silent token validation...');
    const user = await authApi.getCurrentUser();
    if (user) {
      console.log('[authFetch] Token still valid, retrying queued requests');
      setNeedsReauth(false);
      return true;
    }
    // getCurrentUser returned null (401 from backend)
    console.warn('[authFetch] Token expired, setting needsReauth');
    setNeedsReauth(true);
    return false;
  } catch (error) {
    console.error('[authFetch] Silent refresh failed:', error);
    setNeedsReauth(true);
    return false;
  }
}

/**
 * Process all queued requests after a successful refresh.
 */
function drainQueue(success: boolean): void {
  const pending = _queue.splice(0);
  if (success) {
    // Retry all queued requests with the (potentially updated) token
    pending.forEach(({ resolve, reject, url, init }) => {
      fetch(url, injectCurrentToken(init))
        .then(resolve)
        .catch(reject);
    });
  } else {
    // Reject all with AuthExpiredError
    pending.forEach(({ reject }) => {
      reject(new AuthExpiredError());
    });
  }
}

/**
 * Inject the current stored token into the request init.
 * Only touches Authorization header if it was a Bearer token.
 */
function injectCurrentToken(init?: RequestInit): RequestInit {
  const updated = { ...init };
  const headers = new Headers(updated.headers);
  
  // Only update if there was already a Bearer token (user auth, not anon key)
  const existingAuth = headers.get('Authorization');
  if (existingAuth && existingAuth.startsWith('Bearer ')) {
    // Check if this is a user token header (X-User-Token pattern)
    const userToken = getStoredToken();
    if (userToken && headers.has('X-User-Token')) {
      headers.set('X-User-Token', userToken);
    }
  }
  
  updated.headers = headers;
  return updated;
}

// ========== Public API ==========

/**
 * Drop-in replacement for `fetch()` that intercepts 401 responses.
 * 
 * On 401:
 * 1. If a refresh is already in progress, queues this request
 * 2. Otherwise, initiates a single refresh attempt
 * 3. On success: retries this + all queued requests
 * 4. On failure: sets needsReauth flag, rejects with AuthExpiredError
 * 
 * NEVER clears localStorage, NEVER logs out, NEVER redirects.
 */
export async function authFetch(
  url: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // If we already know reauth is needed, don't even try
  if (_needsReauth) {
    throw new AuthExpiredError();
  }

  const response = await fetch(url, init);

  // Not a 401 — return normally
  if (response.status !== 401) {
    return response;
  }

  // 401 received — check if we have a token (if not, this is just an unauthenticated call)
  const token = getStoredToken();
  if (!token) {
    // No token = not an auth issue, just return the 401
    return response;
  }

  // If refresh is already in progress, queue this request
  if (_isRefreshing) {
    return new Promise<Response>((resolve, reject) => {
      _queue.push({ resolve, reject, url, init });
    });
  }

  // Start refresh
  _isRefreshing = true;
  _refreshPromise = attemptSilentRefresh();

  try {
    const success = await _refreshPromise;
    drainQueue(success);

    if (success) {
      // Retry the original request with updated token
      return fetch(url, injectCurrentToken(init));
    } else {
      throw new AuthExpiredError();
    }
  } finally {
    _isRefreshing = false;
    _refreshPromise = null;
  }
}

/**
 * Reset the reauth state (call after successful re-authentication).
 */
export function clearReauthState(): void {
  setNeedsReauth(false);
}
