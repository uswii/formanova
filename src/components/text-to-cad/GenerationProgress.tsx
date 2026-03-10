import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Diamond } from "lucide-react";

const NODE_LABELS: Record<string, string> = {
  generate_initial: "Designing your ring...",
  build_initial: "Crafting the 3D model...",
  generate_fix: "Improving the design...",
  build_retry: "Refining the geometry...",
  validate_output: "Checking for accuracy...",
  build_corrected: "Applying corrections...",
  success_final: "Your ring is ready",
  success_original_glb: "Your ring is ready",
  failed_final: "Something went wrong — want to try again?",
  _loading: "Loading model into viewport",
};

const TERMINAL_NODES = new Set(["success_final", "success_original_glb", "failed_final"]);

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface GenerationProgressProps {
  visible: boolean;
  currentStep: string;
  retryAttempt?: number;
  maxAttempts?: number;
  onRetry?: () => void;
}

export default function GenerationProgress({
  visible,
  currentStep,
  retryAttempt,
  maxAttempts = 3,
  onRetry,
}: GenerationProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const workflowStartRef = useRef(Date.now());

  useEffect(() => {
    if (visible) {
      workflowStartRef.current = Date.now();
      setElapsed(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || TERMINAL_NODES.has(currentStep)) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - workflowStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, currentStep]);

  if (!visible) return null;

  const isFailed = currentStep === "failed_final";
  const isDone = currentStep === "success_final" || currentStep === "success_original_glb";
  const isTerminal = isFailed || isDone;

  let label = NODE_LABELS[currentStep] || "";
  if (currentStep === "generate_fix" && retryAttempt) {
    label = `Improving the design... (attempt ${retryAttempt} of ${maxAttempts})`;
  }

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto">
        {/* Diamond spinner — same as photo studio */}
        {!isTerminal && (
          <div className="relative mb-2">
            <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Diamond className="absolute inset-0 m-auto h-10 w-10 text-primary" />
          </div>
        )}

        {/* Label + timer */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-2 text-center"
          >
            <span
              className={`font-display text-lg tracking-[0.12em] uppercase text-center ${
                isFailed ? "text-destructive" : "text-foreground/80"
              }`}
            >
              {label}
            </span>
            {!isTerminal && currentStep !== "_loading" && (
              <>
                <span className="font-mono text-sm text-muted-foreground/50 tabular-nums text-center">
                  {formatElapsed(elapsed)}
                </span>
                <span className="text-[11px] italic text-muted-foreground/40 text-center">
                  This may take several minutes
                </span>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {isFailed && onRetry && (
          <button
            onClick={onRetry}
            className="px-8 py-3 text-[12px] font-bold uppercase tracking-[0.2em] bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
