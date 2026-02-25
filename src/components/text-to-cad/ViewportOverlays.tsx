import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TRANSFORM_MODES, PART_REGEN_PARTS, PROGRESS_STEPS } from "./types";
import type { StatsData } from "./types";

const glassStyle = {
  background: "linear-gradient(180deg, rgba(25,25,25,0.85) 0%, rgba(16,16,16,0.92) 100%)",
  backdropFilter: "blur(30px)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
};

// ── Viewport Top Toolbar (Orbit/Move/Rotate/Scale) ──
export function ViewportToolbar({ mode, setMode }: { mode: string; setMode: (m: string) => void }) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex gap-1.5 px-3 py-2 rounded-xl"
      style={glassStyle}
    >
      {TRANSFORM_MODES.map((tm) => (
        <button
          key={tm.id}
          onClick={() => setMode(tm.id)}
          className={`px-5 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-[1.5px] cursor-pointer transition-all duration-200 flex items-center gap-2 ${
            mode === tm.id ? "text-black scale-[1.02]" : "text-[#999] hover:text-white hover:bg-white/5"
          }`}
          style={{
            background: mode === tm.id
              ? tm.color
                ? `linear-gradient(135deg, ${tm.color} 0%, ${tm.color}cc 100%)`
                : "linear-gradient(135deg, #ffffff 0%, #d0d0d0 100%)"
              : "transparent",
            border: `1px solid ${mode === tm.id ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.06)"}`,
            boxShadow: mode === tm.id ? `0 2px 16px ${tm.color || "rgba(255,255,255,0.1)"}40` : "none",
          }}
        >
          {/* Axis indicator lines for active transform modes */}
          {tm.id !== "orbit" && mode === tm.id && (
            <span className="flex gap-[3px] mr-1.5">
              <span className="w-[5px] h-[20px] rounded-full" style={{ background: "#ef4444" }} />
              <span className="w-[5px] h-[20px] rounded-full" style={{ background: "#22c55e" }} />
              <span className="w-[5px] h-[20px] rounded-full" style={{ background: "#3b82f6" }} />
            </span>
          )}
          {tm.label}
          {tm.shortcut && <kbd className="text-[9px] ml-1.5 font-semibold opacity-60">{tm.shortcut}</kbd>}
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
      className={`absolute top-0 left-1/2 -translate-x-1/2 z-[200] min-w-[700px] max-w-[92%] rounded-b-2xl ${collapsed ? "py-2 px-7" : "px-7 pt-4 pb-5"}`}
      style={{ ...glassStyle, borderTop: "none" }}
    >
      <div
        className={`text-center uppercase tracking-[3px] font-bold text-white cursor-pointer ${collapsed ? "text-[11px] mb-0" : "text-[13px] mb-3.5"}`}
        onClick={() => setCollapsed(!collapsed)}
      >
        ⚙ Rebuild or Add Parts to Your Ring
      </div>

      {!collapsed && (
        <>
          <p className="text-center text-[11px] text-[#666] -mt-2 mb-3 tracking-[0.5px]">
            Click any part below to rebuild it, or add something new
          </p>
          <div className="flex gap-1.5 flex-wrap justify-center mb-3.5">
            {PART_REGEN_PARTS.map((part) => (
              <button
                key={part.id}
                onClick={() => setSelectedPart(part.id)}
                className={`px-4 py-2.5 rounded-full text-[12px] font-semibold uppercase tracking-[0.5px] cursor-pointer transition-all duration-200 ${
                  selectedPart === part.id
                    ? "text-white shadow-[0_0_14px_rgba(255,255,255,0.08)]"
                    : "text-[#999] hover:text-white"
                }`}
                style={{
                  background: selectedPart === part.id
                    ? "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.06) 100%)"
                    : "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                  backdropFilter: "blur(12px)",
                  border: `1px solid ${selectedPart === part.id ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                }}
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
              className="flex-1 px-4 py-3 rounded-xl text-[14px] text-[#e0e0e0] placeholder:text-[#555] focus:outline-none"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
            <button
              disabled={!selectedPart}
              className="px-8 py-3.5 rounded-xl text-[12px] font-bold uppercase tracking-[2px] cursor-pointer transition-all duration-200 text-black disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_4px_20px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)",
                boxShadow: "0 2px 12px rgba(255,255,255,0.1)",
                border: "none",
              }}
            >
              ⚙ Rebuild This Part
            </button>
          </div>
          <div className="h-px bg-white/5 my-4" />
          <div className="text-center text-[11px] font-bold text-white tracking-[2px] uppercase mb-2.5">
            ✚ Generate Something New
          </div>
          <div className="flex gap-2.5 items-center">
            <input
              value={newPartDesc}
              onChange={(e) => setNewPartDesc(e.target.value)}
              placeholder="Describe a new part to add..."
              className="flex-1 px-4 py-3 rounded-xl text-[14px] text-[#e0e0e0] placeholder:text-[#555] focus:outline-none"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
            <button
              className="px-8 py-3.5 rounded-xl text-[12px] font-bold uppercase tracking-[2px] cursor-pointer transition-all duration-200 text-black hover:shadow-[0_4px_20px_rgba(74,222,128,0.15)] hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)",
                border: "none",
                boxShadow: "0 2px 12px rgba(74,222,128,0.15)",
              }}
            >
              ✚ Add to Ring
            </button>
          </div>
        </>
      )}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[14px] text-[#999] cursor-pointer transition-all duration-200 hover:bg-white/10 hover:text-white"
        style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(26,26,26,0.9)", backdropFilter: "blur(12px)" }}
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
    <div className="absolute inset-0 z-[100] flex items-center justify-center flex-col"
      style={{ background: "rgba(13,13,13,0.96)", backdropFilter: "blur(20px)" }}
    >
      <div className="w-[420px] text-center">
        <div className="text-[64px] font-black tracking-[-2px] text-white leading-none mb-2">
          {progress}%
        </div>
        <div className="w-full h-1 rounded-full overflow-hidden mt-4 mb-5" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-500 relative"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, #888 0%, #fff 100%)" }}
          />
        </div>
        <div className="text-[14px] text-[#e0e0e0] tracking-[1.5px] font-medium mb-1.5 min-h-[22px]">
          {currentStep}
        </div>
        <div className="flex flex-col gap-0 mt-7 text-left">
          {PROGRESS_STEPS.map((s, i) => {
            const stepIdx = PROGRESS_STEPS.findIndex((ps) => ps === currentStep);
            const isDone = i < stepIdx;
            const isActive = i === stepIdx;
            return (
              <div
                key={s}
                className={`flex items-center gap-3 py-1.5 transition-all duration-400 ${
                  isActive ? "opacity-100 translate-x-0" : isDone ? "opacity-50 translate-x-0" : "opacity-25 -translate-x-1.5"
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-400 ${
                  isActive ? "bg-white border-white animate-pulse" : isDone ? "bg-[#4ade80] border-[#4ade80]" : "bg-[#333] border-[#444]"
                }`} style={{ border: "1.5px solid" }} />
                <span className={`text-[12px] tracking-[0.5px] ${
                  isActive ? "text-[#e0e0e0] font-medium" : isDone ? "text-[#666] line-through" : "text-[#666]"
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
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 flex gap-6 px-7 py-3.5 rounded-xl"
      style={glassStyle}
    >
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <div className="text-[18px] font-bold text-white">{item.val}</div>
          <div className="text-[8px] uppercase tracking-[1.5px] text-[#666] mt-0.5">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Action Buttons (top right) — now with Undo ──
export function ActionButtons({ visible, onReset, onUndo, undoCount, onDownload }: {
  visible: boolean; onReset: () => void; onUndo: () => void; undoCount: number; onDownload?: () => void;
}) {
  if (!visible) return null;

  return (
    <>
      {/* Download */}
      <button
        onClick={onDownload}
        className="absolute top-4 right-4 z-50 px-6 py-3 rounded-xl text-[11px] font-bold uppercase tracking-[1.5px] cursor-pointer transition-all duration-200 text-black hover:shadow-[0_4px_20px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)",
          border: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
        }}
      >
        Download
      </button>

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={undoCount === 0}
        className="absolute top-4 right-[136px] z-50 px-5 py-3 rounded-xl text-[11px] font-bold uppercase tracking-[1.5px] cursor-pointer transition-all duration-200 text-[#bbb] hover:text-white hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
        style={{ ...glassStyle }}
      >
        <span className="text-[16px]">↶</span>
        Undo
        {undoCount > 0 && (
          <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded-full">{undoCount}</span>
        )}
      </button>

      {/* Start Over */}
      <button
        onClick={onReset}
        className="absolute top-4 right-[260px] z-50 px-6 py-3 rounded-xl text-[12px] font-bold uppercase tracking-[1px] cursor-pointer transition-all duration-200 text-[#bbb] hover:text-white hover:scale-[1.02] active:scale-[0.98]"
        style={{ ...glassStyle }}
      >
        Start Over
      </button>
    </>
  );
}
