/**
 * QualityToggle — Balanced / Ultra quality mode toggle for the CAD viewport.
 * Defaults to "Balanced" (safe). Ultra is gated by a hardware capability check.
 * Shows a graceful denial toast if the device can't handle Ultra.
 */

import { useState, useEffect } from "react";
import { Sparkles, Shield } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import type { QualityMode } from "@/lib/gpu-detect";
import { canHandleUltra, getUltraDenialReason, getQualitySettings } from "@/lib/gpu-detect";

interface QualityToggleProps {
  visible: boolean;
  mode: QualityMode;
  onModeChange: (mode: QualityMode) => void;
}

export default function QualityToggle({ visible, mode, onModeChange }: QualityToggleProps) {
  const [showDenial, setShowDenial] = useState(false);

  if (!visible) return null;

  const handleToggle = () => {
    if (mode === "balanced") {
      // Attempting to switch to Ultra — check capability
      if (canHandleUltra()) {
        onModeChange("ultra");
        toast.success("Ultra quality enabled", {
          description: "Higher refraction bounces and resolution active.",
          duration: 3000,
        });
      } else {
        // Show graceful denial
        setShowDenial(true);
        setTimeout(() => setShowDenial(false), 5000);
      }
    } else {
      onModeChange("balanced");
      toast.info("Switched to Balanced mode", {
        duration: 2000,
      });
    }
  };

  const denialReason = getUltraDenialReason();
  const tier = getQualitySettings().tier;

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-200 cursor-pointer ${
          mode === "ultra"
            ? "bg-primary/15 text-primary border-primary/40 shadow-sm shadow-primary/10"
            : "bg-card/80 backdrop-blur-sm border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
        title={mode === "ultra" ? "Ultra quality (higher refraction)" : "Balanced quality (optimized for stability)"}
      >
        {mode === "ultra" ? (
          <Sparkles className="w-3.5 h-3.5" />
        ) : (
          <Shield className="w-3.5 h-3.5" />
        )}
        {mode === "ultra" ? "Ultra" : "Balanced"}
      </button>

      {/* Graceful denial popover */}
      <AnimatePresence>
        {showDenial && denialReason && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-11 left-0 w-[260px] bg-card border border-border shadow-lg rounded-lg p-3 z-50"
          >
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-foreground mb-1">
                  Ultra unavailable
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {denialReason}
                </p>
                <div className="mt-2 text-[9px] text-muted-foreground/60 font-mono uppercase tracking-wider">
                  Detected: {tier} tier
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
