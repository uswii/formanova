import React from 'react';
import { reloadPreservingSession } from '@/lib/reload-utils';

/**
 * Wraps React.lazy with retry logic for chunk load failures.
 * 3 attempts with exponential backoff, then falls back to
 * sessionStorage-guarded reload (skipped if generation in progress).
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await importFn();
      } catch (err) {
        const isLast = attempt === MAX_RETRIES - 1;
        if (isLast) {
          // Final failure — try a guarded reload if safe
          const alreadyAttempted = sessionStorage.getItem('chunk_reload_attempted');

          if (!alreadyAttempted) {
            sessionStorage.setItem('chunk_reload_attempted', '1');

            // Don't reload during an active generation — let ChunkErrorBoundary handle it
            if ((window as any).__generationInProgress) {
              throw err;
            }

            reloadPreservingSession();
            // Return a never-resolving promise so React doesn't render stale content
            return new Promise<never>(() => {});
          }

          // Already attempted reload — bubble error to ChunkErrorBoundary
          throw err;
        }

        // Exponential backoff: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }

    // Unreachable, but TypeScript needs it
    throw new Error('lazyWithRetry: exhausted retries');
  });
}
