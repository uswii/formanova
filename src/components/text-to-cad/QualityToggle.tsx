/**
 * GemToggle — A proper toggle switch between Simple and Refractive gem rendering.
 * Compact horizontal toggle for the bottom-left viewport toolbar.
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
    <button
      onClick={() => onModeChange(isRefractive ? "simple" : "refraction")}
      className="flex items-center gap-2 px-2.5 py-1.5 bg-card/90 backdrop-blur-sm border border-border/50 rounded-sm shadow-sm cursor-pointer hover:bg-accent/30 transition-all duration-150 group"
      title={isRefractive ? "Refractive gems (click for Simple)" : "Simple gems (click for Refractive)"}
    >
      {/* Toggle track */}
      <div className="relative w-[28px] h-[14px] rounded-full border border-border bg-muted/50 transition-colors duration-200">
        <div
          className={`absolute top-[1px] w-[10px] h-[10px] rounded-full transition-all duration-200 ${
            isRefractive
              ? "left-[15px] bg-primary"
              : "left-[1px] bg-muted-foreground/60"
          }`}
        />
      </div>

      {/* Label */}
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground group-hover:text-foreground transition-colors min-w-[52px]">
        {isRefractive ? "Refract" : "Simple"}
      </span>
    </button>
  );
}
