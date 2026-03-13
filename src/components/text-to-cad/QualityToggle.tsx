/**
 * GemToggle — Proper segmented toggle between "Simple" and "Refractive" gem rendering.
 * Placed in the bottom-left viewport toolbar area for clean alignment.
 */

import type { GemMode } from "./GemInstanceRenderer";

interface GemToggleProps {
  visible: boolean;
  mode: GemMode;
  onModeChange: (mode: GemMode) => void;
}

export default function GemToggle({ visible, mode, onModeChange }: GemToggleProps) {
  if (!visible) return null;

  const isRefractive = mode === "refraction";

  return (
    <div className="flex bg-card/90 backdrop-blur-sm border border-border/50 rounded-sm overflow-hidden shadow-sm">
      <button
        onClick={() => onModeChange("simple")}
        className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-150 cursor-pointer ${
          !isRefractive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
        }`}
        title="Standard gem rendering (fast)"
      >
        <span className="text-[12px]">◆</span>
        Simple
      </button>
      <button
        onClick={() => onModeChange("refraction")}
        className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-150 cursor-pointer ${
          isRefractive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
        }`}
        title="Ray-traced refractive gems (higher quality)"
      >
        <span className="text-[12px]">◇</span>
        Refractive
      </button>
    </div>
  );
}
