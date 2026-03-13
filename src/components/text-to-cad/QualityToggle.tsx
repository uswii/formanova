/**
 * GemToggle — Simple toggle between "Simple Gems" and "Refractive Gems"
 * in the viewport top-right corner. No GPU gating — users choose freely.
 */

import { Gem, Sparkles } from "lucide-react";
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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-200 cursor-pointer ${
        isRefractive
          ? "bg-primary/15 text-primary border-primary/40 shadow-sm shadow-primary/10"
          : "bg-card/80 backdrop-blur-sm border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/50"
      }`}
      title={isRefractive ? "Refractive gems (ray-traced)" : "Simple gems (fast)"}
    >
      {isRefractive ? (
        <Sparkles className="w-3.5 h-3.5" />
      ) : (
        <Gem className="w-3.5 h-3.5" />
      )}
      {isRefractive ? "Refractive" : "Simple Gems"}
    </button>
  );
}
