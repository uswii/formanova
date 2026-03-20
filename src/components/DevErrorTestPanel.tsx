// TODO: REMOVE AFTER TESTING. We will delete this once QA is done.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, X, Zap, Film, RotateCcw, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const ALLOWED_EMAIL = 'uswa@raresense.so';

export function DevErrorTestPanel() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Gate: only render for the allowed email
  if (!user?.email || user.email.toLowerCase() !== ALLOWED_EMAIL) return null;

  const actions = [
    {
      icon: Zap,
      label: 'Chunk error (safe)',
      description: 'No generation active → auto-reload after brief "Refreshing…" UI',
      action: () => {
        (window as any).__generationInProgress = false;
        (window as any).__activeGenerationId = null;
        setOpen(false);
        // Throw async so React boundary catches it
        setTimeout(() => {
          throw new TypeError(
            'Failed to fetch dynamically imported module: https://formanova.ai/assets/Test-abc123.js',
          );
        }, 100);
      },
    },
    {
      icon: Film,
      label: 'Chunk error mid-generation',
      description: 'Generation active → branded recovery overlay, no auto-reload',
      action: () => {
        (window as any).__generationInProgress = true;
        (window as any).__activeGenerationId = 'test-gen-123';
        setOpen(false);
        setTimeout(() => {
          throw new TypeError(
            'Failed to fetch dynamically imported module: https://formanova.ai/assets/Test-abc123.js',
          );
        }, 100);
      },
    },
    {
      icon: RotateCcw,
      label: 'Post-reload redirect',
      description: 'Sets sessionStorage then reloads → lands on /generations with banner',
      action: () => {
        sessionStorage.setItem('post_reload_redirect', '/generations');
        sessionStorage.setItem(
          'post_reload_message',
          'Your generation was saved while we updated the app.',
        );
        window.location.reload();
      },
    },
    {
      icon: Bell,
      label: 'New version banner',
      description: 'Fakes a version mismatch → update banner appears immediately',
      action: () => {
        // Dispatch a custom event that the version polling hook listens for
        window.dispatchEvent(new CustomEvent('dev:force-version-mismatch'));
        setOpen(false);
      },
    },
  ];

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 left-4 z-[200] w-10 h-10 flex items-center justify-center rounded-full bg-destructive/90 text-destructive-foreground shadow-lg hover:bg-destructive transition-colors"
        title="Dev: Test error handling"
      >
        <Bug className="w-4 h-4" />
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-16 left-4 z-[200] w-80 rounded-lg border border-border bg-card shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Error Handling Tests
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="p-3 space-y-2">
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.action}
                  className="w-full text-left group rounded-md border border-border/50 hover:border-border bg-background/50 hover:bg-muted/50 transition-colors p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <a.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="font-mono text-xs tracking-wide text-foreground">
                      {a.label}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground pl-5.5">
                    {a.description}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
