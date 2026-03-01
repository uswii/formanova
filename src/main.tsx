import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import App from "./App.tsx";
import "./index.css";

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

// Credit coin icon is imported where needed; no manual preload required.

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
  // Preserve the path and query string during redirect
  window.location.replace(`https://${PRODUCTION_DOMAIN}${window.location.pathname}${window.location.search}${window.location.hash}`);
} else {
  const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;

  // Initialize PostHog eagerly so session recording starts immediately
  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: 'https://us.i.posthog.com',
      defaults: '2026-01-30',
    });
  }

  createRoot(document.getElementById("root")!).render(
    posthogKey ? (
      <PostHogProvider client={posthog}>
        <App />
      </PostHogProvider>
    ) : (
      <App />
    )
  );
}
