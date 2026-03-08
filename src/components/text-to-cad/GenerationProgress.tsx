import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GENERATION_STAGES = [
  { id: "queued", label: "Initializing" },
  { id: "generating", label: "Generating geometry" },
  { id: "detailing", label: "Adding details" },
  { id: "optimizing", label: "Optimizing structure" },
  { id: "preview", label: "Preparing preview" },
  { id: "completed", label: "Completed" },
] as const;

const ROTATING_MESSAGES: Record<string, string[]> = {
  queued: [
    "Initializing generation pipeline",
    "Loading ring design parameters",
    "Setting up 3D workspace",
    "Configuring material properties",
    "Preparing geometry engine",
    "Allocating compute resources",
    "Parsing design intent",
  ],
  generating: [
    "Building base ring profile",
    "Constructing mesh topology",
    "Extruding band cross-section",
    "Calculating curve segments",
    "Defining prong placements",
    "Generating shank geometry",
    "Laying out stone settings",
    "Shaping the stone seat",
    "Calculating ring proportions",
    "Building band geometry",
  ],
  detailing: [
    "Sculpting surface details",
    "Carving filigree patterns",
    "Refining prong tips",
    "Adding edge bevels",
    "Shaping gallery openings",
    "Engraving decorative elements",
    "Refining edges and surfaces",
    "Polishing micro-details",
    "Adding texture definition",
  ],
  optimizing: [
    "Validating watertight mesh",
    "Checking wall thickness",
    "Optimizing polygon count",
    "Verifying structural integrity",
    "Cleaning non-manifold edges",
    "Smoothing surface normals",
    "Running topology analysis",
    "Validating ring dimensions",
    "Checking mesh integrity",
  ],
  preview: [
    "Rendering final preview",
    "Applying studio lighting",
    "Capturing angle views",
    "Packaging model files",
    "Generating preview thumbnails",
    "Loading 3D preview",
    "Finalizing output",
  ],
  completed: ["Done"],
};

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
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!visible) {
      setDisplayStage(0);
      lastBackendStage.current = 0;
      return;
    }
    const backendStage = mapBackendStatus(currentStep, progress);
    lastBackendStage.current = backendStage;
    setDisplayStage(prev => Math.max(prev, backendStage));
  }, [visible, currentStep, progress]);

  useEffect(() => {
    if (!visible) return;
    const advanceIfNeeded = () => {
      setDisplayStage(prev => {
        const maxAllowed = Math.min(lastBackendStage.current + 1, GENERATION_STAGES.length - 2);
        if (prev < maxAllowed) return prev + 1;
        return prev;
      });
    };
    stageTimerRef.current = setInterval(advanceIfNeeded, 8000);
    const initialTimer = setTimeout(advanceIfNeeded, 3000);
    return () => {
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      clearTimeout(initialTimer);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setMessageIndex(0);
    const stageId = GENERATION_STAGES[displayStage]?.id;
    const msgs = ROTATING_MESSAGES[stageId] || [];
    if (msgs.length <= 1) return;
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % msgs.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [visible, displayStage]);

  if (!visible) return null;

  const currentStageData = GENERATION_STAGES[displayStage];
  const stageMessages = ROTATING_MESSAGES[currentStageData.id] || [];
  const currentMessage = stageMessages[messageIndex % stageMessages.length] || "";
  const isCompleted = displayStage === GENERATION_STAGES.length - 1;
  const displayPct = isCompleted ? 100 : Math.max(Math.min(progress, 99), Math.round((displayStage / (GENERATION_STAGES.length - 1)) * 100));
  const totalStages = GENERATION_STAGES.length - 1;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center flex-col bg-background/95 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-[420px] flex flex-col items-center text-center"
      >
        {/* Percentage — Bebas Neue display font */}
        <div className="font-display text-[80px] tracking-[0.08em] text-foreground leading-none">
          {displayPct}%
        </div>

        {/* Stage label — Bebas Neue, smaller */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStageData.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="font-display text-lg tracking-[0.2em] text-muted-foreground uppercase mt-2"
          >
            {currentStageData.label}
          </motion.div>
        </AnimatePresence>

        {/* Progress bar — flat, no radius, brutalist */}
        <div className="w-full h-[1px] overflow-hidden mt-6 mb-6 bg-border">
          <motion.div
            className="h-full bg-foreground"
            animate={{ width: `${displayPct}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>

        {/* Rotating message — Space Mono, single line */}
        <AnimatePresence mode="wait">
          <motion.p
            key={`${currentStageData.id}-${messageIndex}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.6, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground h-5"
          >
            {currentMessage}
          </motion.p>
        </AnimatePresence>

        {/* Minimal stage dots — flat squares, brutalist */}
        <div className="flex items-center gap-1.5 mt-8">
          {GENERATION_STAGES.slice(0, totalStages).map((stage, i) => {
            const isDone = i < displayStage;
            const isActive = i === displayStage;
            return (
              <div
                key={stage.id}
                className={`transition-all duration-500 ${
                  isDone
                    ? "w-6 h-[2px] bg-foreground"
                    : isActive
                      ? "w-8 h-[2px] bg-foreground"
                      : "w-4 h-[1px] bg-muted-foreground/20"
                }`}
              >
                {isActive && (
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
