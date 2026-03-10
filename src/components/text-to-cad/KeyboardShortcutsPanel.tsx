import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { SHORTCUT_SECTIONS } from "@/hooks/use-cad-keyboard-shortcuts";

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 font-mono text-[10px] font-semibold bg-background border border-border rounded text-foreground shadow-sm whitespace-nowrap flex-shrink-0">
      {children}
    </kbd>
  );
}

interface KeyboardShortcutsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsPanel({ open, onClose }: KeyboardShortcutsPanelProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] bg-black/20"
            onClick={onClose}
          />
          {/* Panel – anchored above trigger via absolute positioning in parent */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-full left-0 mb-2 z-[201] w-[380px] max-h-[70vh] flex flex-col bg-card border border-border rounded-lg shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Keyboard className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-foreground">
                  Keyboard Shortcuts
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Sections – scrollable */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              {SHORTCUT_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
                    {section.title}
                  </h3>
                  <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 items-center">
                    {section.shortcuts.map((sc) => (
                      <React.Fragment key={sc.desc}>
                        <span className="text-[11px] text-foreground/80 leading-tight">{sc.desc}</span>
                        <div className="flex items-center gap-1 justify-end whitespace-nowrap">
                          {sc.keys.map((k, i) => (
                            k === "/" ? (
                              <span key={i} className="text-[9px] text-muted-foreground/50 mx-0.5">/</span>
                            ) : (
                              <Kbd key={i}>{k}</Kbd>
                            )
                          ))}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border shrink-0">
              <p className="font-mono text-[9px] text-muted-foreground/50 text-center tracking-wider">
                Press <Kbd>?</Kbd> to toggle this panel
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Trigger button – wrap in relative container so panel anchors above */
export function KeyboardShortcutsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 flex items-center justify-center rounded-lg border bg-card/80 backdrop-blur-sm border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-150 cursor-pointer"
      title="Keyboard shortcuts (?)"
    >
      <Keyboard className="w-4 h-4" />
    </button>
  );
}
