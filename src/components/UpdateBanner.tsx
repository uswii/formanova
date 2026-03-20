import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  visible: boolean;
  onRefresh: () => void;
  onDismiss: () => void;
}

/**
 * Centered modal overlay that appears when a new version of Formanova is deployed.
 * Styled consistently with the ChunkErrorBoundary recovery overlay.
 */
export function UpdateBanner({ visible, onRefresh, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="max-w-md w-full mx-6 rounded-lg border border-border bg-card shadow-2xl p-8 relative"
          >
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-6">
              <div className="space-y-3">
                <p className="font-display text-lg md:text-xl uppercase tracking-wider text-foreground">
                  Formanova has been updated.
                </p>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  A new version is available. Refresh to get the latest improvements.
                </p>
              </div>

              <Button
                variant="default"
                size="lg"
                className="w-full gap-2"
                onClick={onRefresh}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh now
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
