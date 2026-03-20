import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function isChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message || '';
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('Failed to fetch') ||
    msg.includes('Loading chunk') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  );
}

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  generationWasActive: boolean;
}

/**
 * Catches chunk-load errors at the React tree level.
 *
 * If a generation is in progress → shows a centered modal telling the user
 * their result is safe. No auto-reload — user controls the reload.
 *
 * If no generation → auto-reloads after 1.5 s (with sessionStorage guard).
 */
export class ChunkErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, generationWasActive: false };

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    if (isChunkError(error)) {
      return {
        hasError: true,
        generationWasActive: !!(window as any).__generationInProgress,
      };
    }
    // Non-chunk errors — re-throw
    throw error;
  }

  componentDidCatch(error: Error) {
    // Log to PostHog
    import('posthog-js')
      .then(({ default: posthog }) => {
        if (posthog.__loaded) posthog.captureException(error);
      })
      .catch(() => {});

    // If no generation is active, attempt a guarded auto-reload
    if (!(window as any).__generationInProgress) {
      const key = 'chunk_reload_attempted';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        setTimeout(() => window.location.reload(), 1500);
      }
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    // ── Generation-active modal ────────────────────────────────
    if (this.state.generationWasActive) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="max-w-md w-full mx-6 rounded-lg border border-border bg-card shadow-2xl p-8"
          >
            <div className="space-y-6">
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                We updated Formanova while you were generating. Your generation
                is still processing and will be saved to your history
                automatically.
              </p>

              <Button
                variant="default"
                size="lg"
                className="w-full gap-2"
                onClick={() => {
                  sessionStorage.setItem('post_reload_redirect', '/generations');
                  window.location.reload();
                }}
              >
                <RefreshCw className="w-4 h-4" />
                Reload &amp; go to my generations
              </Button>
            </div>
          </motion.div>
        </div>
      );
    }

    // ── Safe auto-reload state ─────────────────────────────────
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-3"
        >
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground tracking-wide">Refreshing…</p>
        </motion.div>
      </div>
    );
  }
}
