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

  // Defer heavy SDKs (Sentry + PostHog) to after first paint
  requestIdleCallback(() => {
    // Sentry — dynamically imported so it doesn't block FCP
    import("@sentry/react").then((Sentry) => {
      Sentry.init({
        dsn: "https://fb062ed4887fdb94c55272c7cfc9c7d0@o4510947153870848.ingest.us.sentry.io/4510947154722816",
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
          }),
        ],
        tracesSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
      });
    });

    // PostHog — dynamically imported
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

