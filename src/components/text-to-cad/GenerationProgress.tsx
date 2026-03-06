import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GENERATION_STAGES = [
  { id: "queued", label: "Creating your ring…", minTime: 2000 },
  { id: "generating", label: "Generating geometry", minTime: 4000 },
  { id: "detailing", label: "Adding details", minTime: 3000 },
  { id: "optimizing", label: "Optimizing structure", minTime: 3000 },
  { id: "preview", label: "Preparing preview", minTime: 2000 },
  { id: "completed", label: "Completed", minTime: 0 },
] as const;

// Maps backend status strings to our stage indices
function mapBackendStatus(status: string, progress: number): number {
  const s = status.toLowerCase();
  if (s.includes("complete") || s.includes("done") || progress >= 100) return 5;
  if (s.includes("download") || s.includes("preview") || s.includes("polish") || progress >= 80) return 4;
  if (s.includes("optimi") || s.includes("refin") || progress >= 60) return 3;
  if (s.includes("detail") || s.includes("sculpt") || progress >= 40) return 2;
  if (s.includes("generat") || s.includes("analyz") || progress >= 15) return 1;
  return 0;
}

interface GenerationProgressProps {
  visible: boolean;
  progress: number;
  currentStep: string;
}

export default function GenerationProgress({ visible, progress, currentStep }: GenerationProgressProps) {
  const [displayStage, setDisplayStage] = useState(0);
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastBackendStage = useRef(0);

  // Smooth stage progression — never goes backwards, advances at minimum pace
  useEffect(() => {
    if (!visible) {
      setDisplayStage(0);
      lastBackendStage.current = 0;
      return;
    }

    const backendStage = mapBackendStatus(currentStep, progress);
    lastBackendStage.current = backendStage;

    // If backend is ahead, jump to it
    setDisplayStage(prev => Math.max(prev, backendStage));
  }, [visible, currentStep, progress]);

  // Auto-advance stages to keep the UI feeling active
  useEffect(() => {
    if (!visible) return;

    const advanceIfNeeded = () => {
      setDisplayStage(prev => {
        // Don't advance past what backend reports, with 1 stage buffer
        const maxAllowed = Math.min(lastBackendStage.current + 1, GENERATION_STAGES.length - 2);
        if (prev < maxAllowed) return prev + 1;
        return prev;
      });
    };

    // Advance every 5 seconds to keep things moving
    stageTimerRef.current = setInterval(advanceIfNeeded, 5000);
    return () => {
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  const currentStageData = GENERATION_STAGES[displayStage];

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center flex-col bg-background/95 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-[420px] text-center"
      >
        {/* Animated ring icon */}
        <div className="mb-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto border-2 border-primary/30 rounded-full relative"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary" />
          </motion.div>
        </div>

        {/* Current stage label */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStageData.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="font-display text-2xl text-foreground tracking-[0.15em] uppercase mb-8"
          >
            {currentStageData.label}
          </motion.div>
        </AnimatePresence>

        {/* Stage checklist */}
        <div className="flex flex-col gap-0 text-left max-w-[280px] mx-auto">
          {GENERATION_STAGES.map((stage, i) => {
            const isDone = i < displayStage;
            const isActive = i === displayStage;
            const isPending = i > displayStage;

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: isPending ? 0.2 : 1 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={`flex items-center gap-3 py-2.5 transition-all duration-500 ${
                  isPending ? "opacity-20" : ""
                }`}
              >
                {/* Status indicator */}
                <div className="w-5 flex-shrink-0 flex items-center justify-center">
                  {isDone && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-[14px]"
                      style={{ color: "hsl(var(--formanova-success))" }}
                    >
                      ✓
                    </motion.span>
                  )}
                  {isActive && (
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-primary"
                    />
                  )}
                  {isPending && (
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
                  )}
                </div>

                {/* Label */}
                <span className={`font-mono text-[11px] tracking-wide transition-all duration-300 ${
                  isDone ? "text-muted-foreground line-through" : 
                  isActive ? "text-foreground font-semibold" : 
                  "text-muted-foreground/40"
                }`}>
                  {stage.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
