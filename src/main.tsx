import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { reloadPreservingSession } from "./lib/reload-utils";
import { getStoredUser } from "./lib/auth-api";
import posthog from 'posthog-js';

// requestIdleCallback polyfill for Safari
if (typeof window !== 'undefined' && !('requestIdleCallback' in window)) {
  (window as any).requestIdleCallback = (cb: Function) => setTimeout(cb, 1);
}

// ── Global chunk-load error handlers ──────────────────────────────
function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message || '';
    return (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('ChunkLoadError') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module') ||
      error.name === 'ChunkLoadError'
    );
  }
  return false;
}

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) {
    if (posthog.__loaded) posthog.captureException(event.reason);

    // During active generation, suppress — ChunkErrorBoundary handles the UI
    if ((window as any).__generationInProgress) {
      event.preventDefault();
      return;
    }

    const alreadyAttempted = sessionStorage.getItem('chunk_reload_attempted');
    if (!alreadyAttempted) {
      sessionStorage.setItem('chunk_reload_attempted', '1');
      reloadPreservingSession();
    }
  }
});

window.addEventListener('error', (event) => {
  if (isChunkLoadError(event.error)) {
    if (posthog.__loaded) posthog.captureException(event.error);

    // During active generation, suppress — ChunkErrorBoundary handles the UI
    if ((window as any).__generationInProgress) {
      event.preventDefault();
      return;
    }

    const alreadyAttempted = sessionStorage.getItem('chunk_reload_attempted');
    if (!alreadyAttempted) {
      sessionStorage.setItem('chunk_reload_attempted', '1');
      reloadPreservingSession();
    }
  }
});

// ── Domain redirect ───────────────────────────────────────────────
const PRODUCTION_DOMAIN = 'formanova.ai';
if (
  typeof window !== 'undefined' &&
  window.location.hostname !== PRODUCTION_DOMAIN &&
  window.location.hostname !== 'www.formanova.ai' &&
  window.location.hostname !== 'localhost' &&
  !window.location.hostname.startsWith('192.168.') &&
  !window.location.hostname.startsWith('10.') &&
  !window.location.hostname.startsWith('127.')
) {
  window.location.replace(`https://${PRODUCTION_DOMAIN}${window.location.pathname}${window.location.search}${window.location.hash}`);
} else {
  const rootEl = document.getElementById("root")!;
  const root = createRoot(rootEl);

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
    api_host: 'https://formanova.ai/fn-relay',
    ui_host: 'https://us.posthog.com',
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    capture_exceptions: true,
    enable_heatmaps: true,
    disable_surveys: true,
    bootstrap: storedUser
      ? { distinctID: storedUser.id, isIdentifiedID: true }
      : undefined,
  });

  root.render(<App />);
}
