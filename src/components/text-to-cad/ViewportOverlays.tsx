import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Undo2, Redo2, Download, Plus, Minus, Maximize2 } from "lucide-react";
import { TRANSFORM_MODES, PROGRESS_STEPS } from "./types";
import type { StatsData } from "./types";

const MODE_CONFIG: Record<string, { label: string; title: string; icon: string; color: string; unit: string; step: string; defaultVal: string }> = {
  translate: { label: "Move", title: "Position", icon: "↔", color: "text-green-400", unit: "", step: "0.01", defaultVal: "0.00" },
  rotate:    { label: "Rotate", title: "Rotation", icon: "↻", color: "text-blue-400", unit: "°", step: "1", defaultVal: "0" },
  scale:     { label: "Scale", title: "Scale", icon: "⇔", color: "text-amber-400", unit: "", step: "0.01", defaultVal: "1.00" },
};

const AXES = ["X", "Y", "Z"] as const;
const AXIS_COLORS = ["text-red-400", "text-green-400", "text-blue-400"];

// ── Viewer Tool Button ──
const VT_BTN = "h-[40px] px-5 text-[11px] font-bold uppercase tracking-[0.12em] cursor-pointer transition-all duration-150 flex items-center gap-2";
const VT_BTN_DEFAULT = `${VT_BTN} text-foreground/70 hover:text-foreground hover:bg-accent/40`;
const VT_BTN_ACTIVE = `${VT_BTN} text-primary-foreground bg-primary`;

// ── Unified Transform Toolbar + Inspector ──
export function ViewportToolbar({ mode, setMode }: { mode: string; setMode: (m: string) => void }) {
  const config = MODE_CONFIG[mode] ?? null;
  const isTransformActive = mode !== "orbit" && config !== null;

  return (
    <div className="absolute top-0 left-0 right-0 z-50 flex flex-col items-center pt-4 pointer-events-none">
      {/* Centered viewer tools */}
      <div className="pointer-events-auto flex gap-0 bg-card border border-border shadow-lg">
        {TRANSFORM_MODES.map((tm) => (
          <button
            key={tm.id}
            onClick={() => setMode(tm.id)}
            className={mode === tm.id ? VT_BTN_ACTIVE : VT_BTN_DEFAULT}
          >
            {tm.label}
            {tm.shortcut && <kbd className="font-mono text-[9px] opacity-60">{tm.shortcut}</kbd>}
          </button>
        ))}
      </div>

      {/* Integrated numeric inspector — slides down from viewer tools */}
      <AnimatePresence>
        {isTransformActive && config && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden pointer-events-auto"
          >
            <div className="bg-card border border-border border-t-0 px-4 py-3 min-w-[360px] shadow-lg">
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.15em] ${config.color}`}>
                  {config.icon} {config.title}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="font-mono text-[8px] text-muted-foreground/50 uppercase tracking-wider">
                  Gizmo + Numeric
                </span>
              </div>
              <div className="flex gap-2">
                {AXES.map((axis, i) => (
                  <div key={axis} className="flex items-center gap-1.5 flex-1">
                    <span className={`font-mono text-[11px] font-bold ${AXIS_COLORS[i]}`}>{axis}</span>
                    <input
                      type="number"
                      step={config.step}
                      defaultValue={config.defaultVal}
                      className="w-full px-2.5 py-1.5 text-[11px] font-mono text-foreground bg-background/50 border border-border focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    {config.unit && (
                      <span className="font-mono text-[9px] text-muted-foreground">{config.unit}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Progress Overlay ──
export function ProgressOverlay({ visible, progress, currentStep }: { visible: boolean; progress: number; currentStep: string }) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center flex-col bg-background/95 backdrop-blur-sm">
      <div className="w-[420px] text-center">
        <div className="font-display text-[72px] text-foreground leading-none mb-2">
          {progress}%
        </div>
        <div className="w-full h-[2px] overflow-hidden mt-4 mb-5 bg-border">
          <div
            className="h-full transition-all duration-500 bg-primary"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="font-mono text-[12px] text-foreground tracking-[0.15em] mb-1.5 min-h-[22px]">
          {currentStep}
        </div>
        <div className="flex flex-col gap-0 mt-8 text-left">
          {PROGRESS_STEPS.map((s, i) => {
            const stepIdx = PROGRESS_STEPS.findIndex((ps) => ps === currentStep);
            const isDone = i < stepIdx;
            const isActive = i === stepIdx;
            return (
              <div
                key={s}
                className={`flex items-center gap-3 py-2 transition-all duration-400 ${
                  isActive ? "opacity-100" : isDone ? "opacity-50" : "opacity-25"
                }`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 border-[1.5px] ${
                  isActive ? "bg-primary border-primary animate-pulse" : isDone ? "bg-green-500 border-green-500" : "bg-muted border-muted-foreground/30"
                }`} />
                <span className={`font-mono text-[11px] tracking-wide ${
                  isActive ? "text-foreground" : isDone ? "text-muted-foreground line-through" : "text-muted-foreground"
                }`}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Stats Bar ──
export function StatsBar({ visible, stats }: { visible: boolean; stats: StatsData }) {
  if (!visible) return null;
  const items = [
    { val: stats.meshes.toString(), label: "Meshes" },
    { val: `${stats.sizeKB}`, label: "KB" },
    { val: `${stats.timeSec}s`, label: "Time" },
  ];

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 flex gap-6 px-7 py-3.5 bg-card/95 backdrop-blur-sm border border-border rounded-sm">
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <div className="font-display text-xl text-foreground">{item.val}</div>
          <div className="font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Action Buttons ──
// Separated into: left=undo/redo, center=viewer tools (handled above), right=start over + download
const HIST_BTN = "h-[36px] px-4 text-[10px] font-bold uppercase tracking-[0.1em] cursor-pointer transition-all duration-150 flex items-center gap-1.5 text-foreground/70 hover:text-foreground hover:bg-accent/40 active:scale-[0.97] disabled:opacity-25 disabled:cursor-not-allowed";

export function ActionButtons({ visible, onReset, onUndo, onRedo, undoCount, redoCount, onDownload }: {
  visible: boolean;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  undoCount: number;
  redoCount: number;
  onDownload?: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="absolute top-[68px] left-0 right-0 z-50 flex items-center justify-between px-4 pointer-events-none">
      {/* Left: History controls */}
      <div className="pointer-events-auto flex items-center gap-0 bg-card border border-border shadow-md">
        <button
          onClick={onUndo}
          disabled={undoCount === 0}
          className={`${HIST_BTN} border-r border-border`}
        >
          <Undo2 className="w-3.5 h-3.5" />
          Undo
          {undoCount > 0 && (
            <span className="font-mono text-[9px] bg-accent px-1.5 py-0.5">{undoCount}</span>
          )}
        </button>
        <button
          onClick={onRedo}
          disabled={redoCount === 0}
          className={HIST_BTN}
        >
          <Redo2 className="w-3.5 h-3.5" />
          Redo
          {redoCount > 0 && (
            <span className="font-mono text-[9px] bg-accent px-1.5 py-0.5">{redoCount}</span>
          )}
        </button>
      </div>

      {/* Right: Project actions */}
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          onClick={onReset}
          className="h-[36px] px-4 text-[10px] font-bold uppercase tracking-[0.12em] cursor-pointer transition-all duration-150 flex items-center gap-1.5 text-foreground/70 hover:text-foreground active:scale-[0.97] bg-card border border-border shadow-md"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Start Over
        </button>
        <button
          onClick={onDownload}
          className="h-[36px] px-6 text-[10px] font-bold uppercase tracking-[0.12em] cursor-pointer transition-all duration-150 flex items-center gap-1.5 bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.97] border border-primary shadow-md"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </button>
      </div>
    </div>
  );
}
