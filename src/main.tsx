import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// requestIdleCallback polyfill for Safari
if (typeof window !== 'undefined' && !('requestIdleCallback' in window)) {
  (window as any).requestIdleCallback = (cb: Function) => setTimeout(cb, 1);
}

// Global chunk load error handler — reloads on stale deployments
function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('ChunkLoadError') ||
      error.name === 'ChunkLoadError'
    );
  }
  return false;
}

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) {
    console.warn('Chunk load failed. Reloading to fetch latest version...');
    window.location.reload();
  }
});

window.addEventListener('error', (event) => {
  if (isChunkLoadError(event.error)) {
    console.warn('Chunk load failed. Reloading to fetch latest version...');
    window.location.reload();
  }
});

// Redirect all non-production domains to formanova.ai
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
  // Industry best practice: analytics should never compete with content rendering
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
      });
    });
  };

  if (posthogKey) {
    // Whichever fires first: 5-second timeout or first user interaction
    const timer = setTimeout(loadPostHog, 5000);
    const interactionEvents = ['click', 'scroll', 'keydown', 'touchstart'] as const;
    const onInteraction = () => {
      clearTimeout(timer);
      interactionEvents.forEach(e => window.removeEventListener(e, onInteraction));
      // Small delay after interaction to avoid jank during the interaction itself
      requestIdleCallback(loadPostHog);
    };
    interactionEvents.forEach(e =>
      window.addEventListener(e, onInteraction, { once: true, passive: true })
    );
  }

  // Render app immediately — don't block on lazy imports
  root.render(<App />);
}

