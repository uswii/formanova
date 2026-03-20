/**
 * Dev-only component that throws a chunk-load error during React render
 * when triggered via the DevErrorTestPanel. This ensures the error is
 * caught by ChunkErrorBoundary (which only catches render-time errors).
 */
import { useState, useEffect } from 'react';

export function DevChunkErrorBomb() {
  const [shouldThrow, setShouldThrow] = useState(false);

  useEffect(() => {
    const handler = () => setShouldThrow(true);
    window.addEventListener('dev:force-chunk-error', handler);
    return () => window.removeEventListener('dev:force-chunk-error', handler);
  }, []);

  if (shouldThrow) {
    // Clear the flag so a future render after recovery doesn't re-throw
    (window as any).__devForceChunkError = false;
    throw new TypeError(
      'Failed to fetch dynamically imported module: https://formanova.ai/assets/DevTest-abc123.js',
    );
  }

  return null;
}
