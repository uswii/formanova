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
  const root = createRoot(document.getElementById("root")!);

  const posthogKey = 'phc_aN8qVaPxHbJIwdyuQfQkPdyrx9qDcytx1XUHSZfwvwC';

  // Defer PostHog to after first paint (no longer using Sentry)
  requestIdleCallback(() => {
    // PostHog — dynamically imported so it doesn't block FCP
    if (posthogKey) {
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
    }

    // Prefetch CAD/3D chunks in the background so they're cached before navigation
    import('./components/cad/InteractiveRing').catch(() => {});
  });

  // Render app without waiting for analytics SDKs
  import('./components/PostHogErrorBoundary').then(({ default: PostHogErrorBoundary }) => {
    root.render(
      <PostHogErrorBoundary>
        <App />
      </PostHogErrorBoundary>
    );
  }).catch(() => {
    root.render(<App />);
  });
}

