import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

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
      <div className="flex flex-col items-center gap-6">
        {/* Single line: spinner + label + timer */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3"
          >
            {!isTerminal && (
              <Loader2 className="h-4 w-4 text-foreground/60 animate-spin" />
            )}
            <span
              className={`font-display text-lg tracking-[0.12em] uppercase ${
                isFailed ? "text-destructive" : "text-foreground/80"
              }`}
            >
              {label}
            </span>
            {!isTerminal && (
              <span className="font-mono text-sm text-muted-foreground/50 tabular-nums">
                {formatElapsed(elapsed)}
              </span>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Retry button on failure */}
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
  const currentIdx = STAGE_ORDER.indexOf(currentStep);

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center flex-col bg-background/95 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-[420px] max-w-[90vw] flex flex-col items-center text-center"
      >
        {/* Stage label */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className={`font-display text-xl tracking-[0.15em] uppercase ${
              isFailed ? "text-destructive" : isDone ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
          </motion.div>
        </AnimatePresence>

        {/* Elapsed timer */}
        {!isTerminal && currentStep && (
          <p className="font-mono text-[11px] text-muted-foreground/60 mt-2 tracking-wide">
            ({formatElapsed(elapsed)})
          </p>
        )}

        {/* Slow stage warning */}
        <AnimatePresence>
          {showSlowWarning && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="font-mono text-[10px] text-muted-foreground/50 mt-3 tracking-wide"
            >
              This step can take a couple of minutes — still working
            </motion.p>
          )}
        </AnimatePresence>

        {/* Crawling stage progress bars */}
        {!isFailed && (
          <div className="flex items-center gap-1 w-full mt-6 mb-2">
            {STAGE_ORDER.map((node, i) => {
              const stageDone = currentIdx >= 0 && i < currentIdx;
              const stageActive = node === currentStep && !isTerminal;
              const stageDoneTerminal = isDone && i === STAGE_ORDER.length - 1;
              return (
                <StageSegment
                  key={node}
                  active={stageActive}
                  done={stageDone || stageDoneTerminal}
                />
              );
            })}
          </div>
        )}

        {/* Retry button on failure */}
        {isFailed && onRetry && (
          <button
            onClick={onRetry}
            className="mt-8 px-8 py-3 text-[12px] font-bold uppercase tracking-[0.2em] bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
          >
            Try Again
          </button>
        )}
      </motion.div>
    </div>
  );
}