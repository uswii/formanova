import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NODE_LABELS: Record<string, string> = {
  generate_initial: "Designing your ring",
  build_initial: "Building 3D model",
  validate_output: "Polishing details",
  generate_fix: "Enhancing design",
  build_retry: "Rebuilding model",
  build_corrected: "Applying final touches",
  success_final: "Your ring is ready ✓",
  success_original_glb: "Your ring is ready ✓",
  failed_final: "We couldn't complete this one — please try again",
  _loading: "Loading model into viewport",
};

const TERMINAL_NODES = new Set(["success_final", "success_original_glb", "failed_final"]);

const STAGE_ORDER = [
  "generate_initial", "build_initial", "validate_output",
  "generate_fix", "build_retry", "build_corrected", "success_final",
];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Crawling progress bar for a single stage — never reaches 100% on its own */
/** A single step segment: shimmer when active, solid when done, dim when pending */
function StageSegment({ active, done }: { active: boolean; done: boolean }) {
  if (done) {
    return <div className="flex-1 h-[2px] bg-foreground/70" />;
  }
  if (active) {
    return (
      <div className="flex-1 h-[2px] bg-muted-foreground/10 overflow-hidden relative">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/60 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }
  return <div className="flex-1 h-[2px] bg-muted-foreground/10" />;
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
  const stageStartRef = useRef(Date.now());
  const prevStepRef = useRef(currentStep);

  useEffect(() => {
    if (currentStep !== prevStepRef.current) {
      stageStartRef.current = Date.now();
      setElapsed(0);
      prevStepRef.current = currentStep;
    }
  }, [currentStep]);

  useEffect(() => {
    if (!visible || TERMINAL_NODES.has(currentStep)) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - stageStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, currentStep]);

  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      stageStartRef.current = Date.now();
    }
  }, [visible]);

  if (!visible) return null;

  const isFailed = currentStep === "failed_final";
  const isDone = currentStep === "success_final" || currentStep === "success_original_glb";
  const isTerminal = isFailed || isDone;
  const showSlowWarning = !isTerminal && elapsed > 60;

  let label = NODE_LABELS[currentStep] || "";
  if (currentStep === "generate_fix" && retryAttempt) {
    label = `Enhancing design (attempt ${retryAttempt} of ${maxAttempts})`;
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
                <StageBar
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