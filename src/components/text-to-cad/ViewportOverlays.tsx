import { useState } from "react";
import { TRANSFORM_MODES, PART_REGEN_PARTS, PROGRESS_STEPS } from "./types";
import type { StatsData } from "./types";

// ── Viewport Top Toolbar (Orbit/Move/Rotate/Scale) ──
export function ViewportToolbar({ mode, setMode }: { mode: string; setMode: (m: string) => void }) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex gap-1 px-3 py-2 bg-card/95 backdrop-blur-sm border border-border rounded-sm">
      {TRANSFORM_MODES.map((tm) => (
        <button
          key={tm.id}
          onClick={() => setMode(tm.id)}
          className={`px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] cursor-pointer transition-all duration-200 flex items-center gap-2 border ${
            mode === tm.id
              ? "text-primary-foreground bg-primary border-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
          }`}
        >
          {tm.id !== "orbit" && mode === tm.id && (
            <span className="flex gap-[3px] mr-1.5">
              <span className="w-[5px] h-[20px] rounded-full bg-destructive" />
              <span className="w-[5px] h-[20px] rounded-full bg-green-500" />
              <span className="w-[5px] h-[20px] rounded-full bg-blue-500" />
            </span>
          )}
          {tm.label}
          {tm.shortcut && <kbd className="font-mono text-[8px] ml-1.5 opacity-50">{tm.shortcut}</kbd>}
        </button>
      ))}
    </div>
  );
}

// ── Part Regen Bar ──
export function PartRegenBar({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [desc, setDesc] = useState("");
  const [newPartDesc, setNewPartDesc] = useState("");

  if (!visible) return null;

  return (
    <div
      className={`absolute top-0 left-1/2 -translate-x-1/2 z-[200] min-w-[700px] max-w-[92%] bg-card/95 backdrop-blur-sm border border-border border-t-0 ${collapsed ? "py-2 px-7" : "px-7 pt-4 pb-5"}`}
    >
      <div
        className={`text-center uppercase font-display cursor-pointer text-foreground ${collapsed ? "text-sm tracking-[0.15em] mb-0" : "text-base tracking-[0.15em] mb-4"}`}
        onClick={() => setCollapsed(!collapsed)}
      >
        ⚙ Rebuild or Add Parts
      </div>

      {!collapsed && (
        <>
          <p className="text-center font-mono text-[10px] text-muted-foreground -mt-2 mb-4 tracking-wide">
            Click any part below to rebuild it, or add something new
          </p>
          <div className="flex gap-1.5 flex-wrap justify-center mb-4">
            {PART_REGEN_PARTS.map((part) => (
              <button
                key={part.id}
                onClick={() => setSelectedPart(part.id)}
                className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide cursor-pointer transition-all duration-200 border ${
                  selectedPart === part.id
                    ? "text-foreground bg-accent border-border"
                    : "text-muted-foreground hover:text-foreground bg-muted/20 border-border/50"
                }`}
              >
                {part.icon} {part.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2.5 items-center">
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Tell us how you want it to look..."
              className="flex-1 px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring font-body bg-muted/30 border border-border"
            />
            <button
              disabled={!selectedPart}
              className="px-8 py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
            >
              ⚙ Rebuild This Part
            </button>
          </div>
          <div className="h-px bg-border my-5" />
          <div className="text-center font-display text-sm text-foreground tracking-[0.15em] uppercase mb-3">
            ✚ Generate Something New
          </div>
          <div className="flex gap-2.5 items-center">
            <input
              value={newPartDesc}
              onChange={(e) => setNewPartDesc(e.target.value)}
              placeholder="Describe a new part to add..."
              className="flex-1 px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring font-body bg-muted/30 border border-border"
            />
            <button
              className="px-8 py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 bg-green-600 text-white hover:opacity-90 active:scale-[0.98]"
            >
              ✚ Add to Ring
            </button>
          </div>
        </>
      )}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-7 h-7 flex items-center justify-center text-[14px] text-muted-foreground cursor-pointer transition-all duration-200 hover:text-foreground bg-card border border-border"
      >
        {collapsed ? "▼" : "▲"}
      </button>
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

// ── Action Buttons (top right) ──
export function ActionButtons({ visible, onReset, onUndo, undoCount, onDownload }: {
  visible: boolean; onReset: () => void; onUndo: () => void; undoCount: number; onDownload?: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
      <button
        onClick={onReset}
        className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] cursor-pointer transition-all duration-200 text-muted-foreground hover:text-foreground active:scale-[0.98] bg-card/95 backdrop-blur-sm border border-border"
      >
        Start Over
      </button>

      <button
        onClick={onUndo}
        disabled={undoCount === 0}
        className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] cursor-pointer transition-all duration-200 text-muted-foreground hover:text-foreground active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 bg-card/95 backdrop-blur-sm border border-border"
      >
        <span className="text-[16px]">↶</span>
        Undo
        {undoCount > 0 && (
          <span className="font-mono text-[9px] bg-accent px-1.5 py-0.5">{undoCount}</span>
        )}
      </button>

      <button
        onClick={onDownload}
        className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] cursor-pointer transition-all duration-200 bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] border border-primary"
      >
        Download
      </button>
    </div>
  );
}
