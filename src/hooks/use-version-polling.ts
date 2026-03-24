import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { getStoredToken } from '@/lib/auth-api';
import { reloadPreservingSession } from '@/lib/reload-utils';

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const DEPLOY_SAFETY_POLL_MS = 10_000; // re-check every 10s while deploy unsafe

/**
 * Checks /api/admin/active-generations to see if it's safe to prompt a refresh.
 * Returns true if safe (or if the endpoint is unavailable — fail-open).
 */
async function isDeploySafe(): Promise<boolean> {
  // /api/admin/active-generations temporarily disabled — always safe
  return true;
  // try {
  //   const token = getStoredToken();
  //   const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  //   if (token) headers['Authorization'] = `Bearer ${token}`;
  //   const res = await fetch('/api/admin/active-generations', { method: 'GET', headers });
  //   if (!res.ok) return true;
  //   const data = await res.json();
  //   return data.safe_to_deploy !== false;
  // } catch {
  //   return true;
  // }
}

/**
 * Polls /version.json and surfaces a non-intrusive update banner
 * when the app version changes after deployment.
 *
 * Generation-aware: defers the banner while a generation is in progress
 * and shows it once the generation completes.
 *
 * Deploy-safe: when a version change is detected, checks the backend
 * active-generations endpoint before showing the banner.
 */
export function useVersionPolling() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialVersion = useRef<string | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();

  // Cleanup safety timer on unmount
  useEffect(() => {
    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, []);

  /**
   * Once we know the version changed and local generation is idle,
   * poll the deploy-safety endpoint before surfacing the banner.
   */
  const waitForDeploySafety = useCallback(async () => {
    const safe = await isDeploySafe();
    if (safe) {
      setUpdateAvailable(true);
    } else {
      // Re-poll after a short delay
      safetyTimerRef.current = setTimeout(waitForDeploySafety, DEPLOY_SAFETY_POLL_MS);
    }
  }, []);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const version = data?.version;
      if (!version) return;

      if (initialVersion.current === null) {
        initialVersion.current = version;
        return;
      }

      if (version !== initialVersion.current) {
        // If generation in progress locally, defer — the event listener will catch it
        if ((window as any).__generationInProgress) return;
        // Check backend safety before showing banner
        waitForDeploySafety();
      }
    } catch {
      // Network error — silently ignore
    }
  }, [waitForDeploySafety]);

  // Poll on interval
  useEffect(() => {
    checkVersion(); // initial fetch to capture baseline
    const id = setInterval(checkVersion, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkVersion]);

  // Also check on route change
  useEffect(() => {
    checkVersion();
  }, [location.pathname, checkVersion]);

  // Listen for generation completion to surface deferred update
  useEffect(() => {
    const handler = () => {
      if (initialVersion.current) {
        checkVersion();
      }
    };
    window.addEventListener('generation:complete', handler);
    return () => window.removeEventListener('generation:complete', handler);
  }, [checkVersion]);

  // Dev-only: force a version mismatch for testing the update banner
  useEffect(() => {
    const handler = () => {
      if (initialVersion.current) {
        initialVersion.current = '__dev_old_version__';
        checkVersion();
      }
    };
    window.addEventListener('dev:force-version-mismatch', handler);
    return () => window.removeEventListener('dev:force-version-mismatch', handler);
  }, [checkVersion]);

  const refresh = useCallback(() => {
    reloadPreservingSession();
  }, []);

  const dismiss = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return { updateAvailable, refresh, dismiss };
}
