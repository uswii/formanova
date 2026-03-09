import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Node-based stages matching the backend's active_nodes[0]
const NODE_STAGES = [
  { node: "generate_initial", label: "Writing Blender code", pct: 10 },
  { node: "build_initial", label: "Building 3D model", pct: 30 },
  { node: "validate_output", label: "Validating render", pct: 55 },
  { node: "generate_fix", label: "Fixing errors", pct: 65 },
  { node: "build_retry", label: "Rebuilding model", pct: 75 },
  { node: "build_corrected", label: "Applying corrections", pct: 85 },
  { node: "success_final", label: "Done", pct: 100 },
  { node: "success_original_glb", label: "Done", pct: 100 },
  { node: "failed_final", label: "Failed", pct: 0 },
] as const;

const ROTATING_MESSAGES: Record<string, string[]> = {
  generate_initial: [
    "Analyzing your design prompt",
    "Writing Blender Python code",
    "Translating description to geometry",
    "Mapping ring proportions",
    "Preparing build script",
  ],
  build_initial: [
    "Executing Blender build",
    "Constructing mesh topology",
    "Extruding band cross-section",
    "Generating shank geometry",
    "Placing stone settings",
    "Building base ring profile",
  ],
  validate_output: [
    "Rendering validation screenshot",
    "Checking structural integrity",
    "Verifying mesh is watertight",
    "Validating ring dimensions",
    "Inspecting gem placements",
  ],
  generate_fix: [
    "Analyzing validation feedback",
    "Rewriting problem sections",
    "Adjusting geometry parameters",
    "Correcting proportions",
  ],
  build_retry: [
    "Rebuilding with corrections",
    "Re-executing Blender script",
    "Reconstructing mesh topology",
    "Applying structural fixes",
  ],
  build_corrected: [
    "Applying final corrections",
    "Polishing surface normals",
    "Smoothing edge transitions",
    "Finalizing geometry",
  ],
  success_final: ["Done"],
  success_original_glb: ["Done"],
  failed_final: ["Generation failed"],
  _loading: ["Loading model into viewport"],
};

function getNodeStage(activeNode: string): { label: string; pct: number } {
  const stage = NODE_STAGES.find((s) => s.node === activeNode);
  if (stage) return { label: stage.label, pct: stage.pct };
  return { label: "Processing", pct: 5 };
}

interface GenerationProgressProps {
  visible: boolean;
  progress: number;
  currentStep: string;
  retryAttempt?: number;
}

export default function GenerationProgress({ visible, progress, currentStep, retryAttempt }: GenerationProgressProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const prevNodeRef = useRef(currentStep);

  // Reset message index when node changes
  useEffect(() => {
    if (currentStep !== prevNodeRef.current) {
      setMessageIndex(0);
      prevNodeRef.current = currentStep;
    }
  }, [currentStep]);

  // Rotate messages within current node
  useEffect(() => {
    if (!visible) return;
    const msgs = ROTATING_MESSAGES[currentStep] || ROTATING_MESSAGES["_loading"] || [];
    if (msgs.length <= 1) return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % msgs.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [visible, currentStep]);

  if (!visible) return null;

  const { label, pct } = getNodeStage(currentStep);
  const displayPct = progress >= 100 ? 100 : Math.max(pct, Math.min(progress, 99));
  const displayLabel = retryAttempt && retryAttempt > 0 && currentStep === "generate_fix"
    ? `${label} (attempt ${retryAttempt})`
    : label;

  const msgs = ROTATING_MESSAGES[currentStep] || ROTATING_MESSAGES["_loading"] || [];
  const currentMessage = msgs[messageIndex % msgs.length] || "";

  const isCompleted = displayPct >= 100;
  const isFailed = currentStep === "failed_final";

  // Count completed stages for dots
  const mainStages = NODE_STAGES.filter((s) => s.node !== "failed_final" && s.node !== "success_original_glb");
  const currentIdx = mainStages.findIndex((s) => s.node === currentStep);

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center flex-col bg-background/95 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-[420px] flex flex-col items-center text-center"
      >
        {/* Percentage */}
        <div className="font-display text-[80px] tracking-[0.08em] text-foreground leading-none">
          {isFailed ? "✕" : `${Math.round(displayPct)}%`}
        </div>

        {/* Stage label */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="font-display text-lg tracking-[0.2em] text-muted-foreground uppercase mt-2"
          >
            {displayLabel}
          </motion.div>
        </AnimatePresence>

        {/* Progress bar */}
        <div className="w-full h-[1px] overflow-hidden mt-6 mb-6 bg-border">
          <motion.div
            className="h-full bg-foreground"
            animate={{ width: `${displayPct}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>

        {/* Rotating message */}
        <AnimatePresence mode="wait">
          <motion.p
            key={`${currentStep}-${messageIndex}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.6, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground h-5"
          >
            {currentMessage}
          </motion.p>
        </AnimatePresence>

        {/* Stage dots */}
        <div className="flex items-center gap-1.5 mt-8">
          {mainStages.map((stage, i) => {
            const isDone = currentIdx >= 0 && i < currentIdx;
            const isActive = i === currentIdx;
            return (
              <div
                key={stage.node}
                className={`transition-all duration-500 ${
                  isDone
                    ? "w-6 h-[2px] bg-foreground"
                    : isActive
                      ? "w-8 h-[2px] bg-foreground"
                      : "w-4 h-[1px] bg-muted-foreground/20"
                }`}
              >
                {isActive && !isCompleted && (
                  <motion.div
                    className="w-full h-full bg-foreground"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
