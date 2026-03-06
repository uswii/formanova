import { useState, useRef, useEffect } from "react";
import { Eye } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const DISPLAY_OPTIONS = [
  { label: "Wireframe", available: true, onAction: "wireframe-on", offAction: "wireframe-off" },
  { label: "Flat Shading", available: false, onAction: "flat-shading-on", offAction: "flat-shading-off" },
  { label: "Bounding Box", available: false, onAction: "", offAction: "" },
  { label: "Show Normals", available: false, onAction: "", offAction: "" },
];

interface ViewportDisplayMenuProps {
  visible: boolean;
  onSceneAction: (action: string) => void;
}

export default function ViewportDisplayMenu({ visible, onSceneAction }: ViewportDisplayMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeToggles, setActiveToggles] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!visible) return null;

  const toggle = (opt: typeof DISPLAY_OPTIONS[number]) => {
    if (!opt.available) return;
    setActiveToggles((prev) => {
      const next = new Set(prev);
      if (next.has(opt.label)) {
        next.delete(opt.label);
        if (opt.offAction) onSceneAction(opt.offAction);
      } else {
        next.add(opt.label);
        if (opt.onAction) onSceneAction(opt.onAction);
      }
      return next;
    });
  };

  return (
    <div ref={menuRef} className="absolute bottom-4 left-4 z-50">
      {/* Trigger */}
      <button
        onClick={() => setOpen((p) => !p)}
        className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all duration-150 cursor-pointer ${
          open
            ? "bg-primary text-primary-foreground border-primary shadow-md"
            : "bg-card/80 backdrop-blur-sm border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
        title="Display options"
      >
        <Eye className="w-4 h-4" />
      </button>

      {/* Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-11 left-0 w-[180px] bg-card border border-border shadow-lg rounded-lg overflow-hidden"
          >
            <div className="px-3 pt-2.5 pb-1.5">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Display
              </span>
            </div>
            {DISPLAY_OPTIONS.map((opt) => {
              const isActive = activeToggles.has(opt.label);
              return (
                <button
                  key={opt.label}
                  onClick={() => toggle(opt)}
                  disabled={!opt.available}
                  className={`w-full px-3 py-2 text-left text-[12px] font-medium transition-all duration-150 flex items-center justify-between ${
                    !opt.available
                      ? "text-muted-foreground/40 cursor-default"
                      : isActive
                        ? "text-foreground bg-accent"
                        : "text-foreground/80 hover:bg-accent/50 cursor-pointer"
                  }`}
                >
                  <span>{opt.label}</span>
                  {!opt.available && (
                    <span className="font-mono text-[9px] text-muted-foreground/50 italic">soon</span>
                  )}
                  {opt.available && isActive && (
                    <span className="text-primary text-[10px]">●</span>
                  )}
                </button>
              );
            })}
            <div className="h-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
