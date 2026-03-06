import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, X } from "lucide-react";

const SHORTCUT_SECTIONS = [
  {
    title: "Transform Modes",
    shortcuts: [
      { keys: ["G"], desc: "Move" },
      { keys: ["R"], desc: "Rotate" },
      { keys: ["S"], desc: "Scale" },
      { keys: ["Esc"], desc: "Orbit (cancel transform)" },
    ],
  },
  {
    title: "Mesh Editing",
    shortcuts: [
      { keys: ["X"], desc: "Delete selected" },
      { keys: ["Del"], desc: "Delete selected" },
      { keys: ["Shift", "D"], desc: "Duplicate selected" },
      { keys: ["W"], desc: "Toggle wireframe" },
    ],
  },
  {
    title: "Selection",
    shortcuts: [
      { keys: ["Ctrl", "A"], desc: "Select all" },
      { keys: ["Ctrl", "Shift", "A"], desc: "Deselect all" },
    ],
  },
  {
    title: "History",
    shortcuts: [
      { keys: ["Ctrl", "Z"], desc: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], desc: "Redo" },
      { keys: ["U"], desc: "Undo (alt)" },
    ],
  },
  {
    title: "Mouse Controls",
    shortcuts: [
      { keys: ["Scroll"], desc: "Zoom" },
      { keys: ["Left Drag"], desc: "Orbit" },
      { keys: ["Right Drag"], desc: "Pan" },
      { keys: ["Click"], desc: "Select mesh" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 font-mono text-[10px] font-semibold bg-background border border-border rounded text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

interface KeyboardShortcutsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsPanel({ open, onClose }: KeyboardShortcutsPanelProps) {
  // Close on Escape
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
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[420px] max-w-[95vw] max-h-[90vh] flex flex-col bg-card border border-border rounded-lg shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Keyboard className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-foreground">
                  Keyboard Shortcuts
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sections */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1 min-h-0">
              {SHORTCUT_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2.5">
                    {section.title}
                  </h3>
                  <div className="space-y-1.5">
                    {section.shortcuts.map((sc) => (
                      <div
                        key={sc.desc}
                        className="flex items-center justify-between py-1 px-1"
                      >
                        <span className="text-[12px] text-foreground/80">{sc.desc}</span>
                        <div className="flex items-center gap-1">
                          {sc.keys.map((k, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && <span className="text-[9px] text-muted-foreground/50">+</span>}
                              <Kbd>{k}</Kbd>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border">
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

/** Trigger button for bottom-left of viewport */
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
