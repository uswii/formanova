import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
    import('posthog-js').then(({ default: posthog }) => {
      if (posthog.__loaded) posthog.captureException(event.reason);
    }).catch(() => {});

    // During active generation, suppress — ChunkErrorBoundary handles the UI
    if ((window as any).__generationInProgress) {
      event.preventDefault();
      return;
    }

    const alreadyAttempted = sessionStorage.getItem('chunk_reload_attempted');
    if (!alreadyAttempted) {
      sessionStorage.setItem('chunk_reload_attempted', '1');
      window.location.reload();
    }
  }
});

window.addEventListener('error', (event) => {
  if (isChunkLoadError(event.error)) {
    import('posthog-js').then(({ default: posthog }) => {
      if (posthog.__loaded) posthog.captureException(event.error);
    }).catch(() => {});

    // During active generation, suppress — ChunkErrorBoundary handles the UI
    if ((window as any).__generationInProgress) {
      event.preventDefault();
      return;
    }

    const alreadyAttempted = sessionStorage.getItem('chunk_reload_attempted');
    if (!alreadyAttempted) {
      sessionStorage.setItem('chunk_reload_attempted', '1');
      window.location.reload();
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
  // Render immediately — don't block on analytics/monitoring
  const rootEl = document.getElementById("root")!;
  const root = createRoot(rootEl);

  const posthogKey = 'phc_aN8qVaPxHbJIwdyuQfQkPdyrx9qDcytx1XUHSZfwvwC';

  // Defer PostHog well past LCP — load on first user interaction OR after 5s
  const loadPostHog = () => {
    if ((loadPostHog as any).__done) return;
    (loadPostHog as any).__done = true;

    import("posthog-js").then((posthogModule) => {
      const posthog = posthogModule.default;
      posthog.init(posthogKey, {
        api_host: 'https://us.i.posthog.com',
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        capture_exceptions: true,
        enable_heatmaps: true,
      });
    });
  };

  if (posthogKey) {
    const timer = setTimeout(loadPostHog, 5000);
    const interactionEvents = ['click', 'scroll', 'keydown', 'touchstart'] as const;
    const onInteraction = () => {
      clearTimeout(timer);
      interactionEvents.forEach(e => window.removeEventListener(e, onInteraction));
      requestIdleCallback(loadPostHog);
    };
    interactionEvents.forEach(e =>
      window.addEventListener(e, onInteraction, { once: true, passive: true })
    );
  }

  // Render app immediately — don't block on lazy imports
  root.render(<App />);
}
