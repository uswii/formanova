import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TRANSFORM_MODES, PART_REGEN_PARTS, PROGRESS_STEPS } from "./types";
import type { StatsData } from "./types";

// ── Viewport Top Toolbar (Orbit/Move/Rotate/Scale) ──
export function ViewportToolbar({ mode, setMode }: { mode: string; setMode: (m: string) => void }) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex gap-1 px-2.5 py-1.5 rounded-lg"
      style={{
        background: "linear-gradient(180deg, rgba(25,25,25,0.92) 0%, rgba(16,16,16,0.96) 100%)",
        backdropFilter: "blur(25px)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      {TRANSFORM_MODES.map((tm) => (
        <button
          key={tm.id}
          onClick={() => setMode(tm.id)}
          className={`px-4 py-2 rounded-md text-[11px] font-semibold uppercase tracking-[1.5px] cursor-pointer transition-all duration-150 ${
            mode === tm.id ? "text-black" : "text-[#999] hover:text-white hover:bg-[#252525]"
          }`}
          style={{
            background: mode === tm.id
              ? "linear-gradient(135deg, #ffffff 0%, #d0d0d0 100%)"
              : "transparent",
            border: `1px solid ${mode === tm.id ? "rgba(255,255,255,0.4)" : "#2a2a2a"}`,
            boxShadow: mode === tm.id ? "0 0 10px rgba(255,255,255,0.1)" : "none",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {tm.label}
          {tm.shortcut && <kbd className="text-[9px] text-[#555] ml-1.5 font-semibold">{tm.shortcut}</kbd>}
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
      className={`absolute top-0 left-1/2 -translate-x-1/2 z-[200] min-w-[700px] max-w-[92%] rounded-b-xl ${collapsed ? "py-2 px-7" : "px-7 pt-4 pb-5"}`}
      style={{
        background: "linear-gradient(180deg, rgba(28,28,28,0.95) 0%, rgba(18,18,18,0.98) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderTop: "none",
        backdropFilter: "blur(25px)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      <div
        className={`text-center uppercase tracking-[3px] font-bold text-white cursor-pointer ${collapsed ? "text-[11px] mb-0" : "text-[13px] mb-3.5"}`}
        onClick={() => setCollapsed(!collapsed)}
      >
        ⚙ Rebuild or Add Parts to Your Ring
      </div>

      {!collapsed && (
        <>
          <p className="text-center text-[11px] text-[#555] -mt-2 mb-3 tracking-[0.5px]">
            Click any part below to rebuild it, or add something new
          </p>

          {/* Parts */}
          <div className="flex gap-1.5 flex-wrap justify-center mb-3.5">
            {PART_REGEN_PARTS.map((part) => (
              <button
                key={part.id}
                onClick={() => setSelectedPart(part.id)}
                className={`px-4 py-2 rounded-full text-[12px] font-semibold uppercase tracking-[0.5px] cursor-pointer transition-all duration-200 ${
                  selectedPart === part.id
                    ? "text-white border-white/40 shadow-[0_0_10px_rgba(255,255,255,0.06)]"
                    : "text-[#999] border-[#2a2a2a] hover:border-[#444] hover:bg-[#252525] hover:text-white"
                }`}
                style={{
                  background: selectedPart === part.id
                    ? "linear-gradient(135deg, rgba(40,40,40,0.9) 0%, rgba(30,30,30,0.95) 100%)"
                    : "#1e1e1e",
                  border: `1px solid ${selectedPart === part.id ? "rgba(255,255,255,0.4)" : "#2a2a2a"}`,
                }}
              >
                {part.icon} {part.label}
              </button>
            ))}
          </div>

          {/* Rebuild row */}
          <div className="flex gap-2.5 items-center">
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Tell us how you want it to look..."
              className="flex-1 px-4 py-3 rounded-lg text-[14px] text-[#e0e0e0] placeholder:text-[#555] focus:outline-none focus:border-[#444]"
              style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", fontFamily: "Inter, sans-serif" }}
            />
            <button
              disabled={!selectedPart}
              className="px-7 py-3 rounded-lg text-[12px] font-bold uppercase tracking-[2px] cursor-pointer transition-all duration-200 text-black disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #d0d0d0 100%)",
                boxShadow: "0 2px 10px rgba(255,255,255,0.08)",
                border: "none",
              }}
            >
              ⚙ Rebuild This Part
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-[#2a2a2a] my-4" />

          {/* Add new part */}
          <div className="text-center text-[11px] font-bold text-white tracking-[2px] uppercase mb-2.5">
            ✚ Generate Something New
          </div>
          <div className="flex gap-2.5 items-center">
            <input
              value={newPartDesc}
              onChange={(e) => setNewPartDesc(e.target.value)}
              placeholder="Describe a new part to add, e.g. 'a second thinner band' or 'extra accent diamonds on the sides'..."
              className="flex-1 px-4 py-3 rounded-lg text-[14px] text-[#e0e0e0] placeholder:text-[#555] focus:outline-none focus:border-[#444]"
              style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", fontFamily: "Inter, sans-serif" }}
            />
            <button
              className="px-7 py-3 rounded-lg text-[12px] font-bold uppercase tracking-[2px] cursor-pointer transition-all duration-200 text-black"
              style={{
                background: "#fff",
                border: "none",
              }}
            >
              ✚ Add to Ring
            </button>
          </div>
        </>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[14px] text-[#999] cursor-pointer transition-all duration-200 hover:bg-[#252525] hover:text-white"
        style={{ border: "1px solid #333", background: "#1a1a1a" }}
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
        <div className="w-full h-1 rounded-full overflow-hidden mt-4 mb-5" style={{ background: "#2a2a2a" }}>
          <div
            className="h-full rounded-full transition-all duration-500 relative"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #888 0%, #fff 100%)",
            }}
          />
        </div>
        <div className="text-[14px] text-[#e0e0e0] tracking-[1.5px] font-medium mb-1.5 min-h-[22px]">
          {currentStep}
        </div>

        {/* Timeline steps */}
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
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 flex gap-6 px-7 py-3 rounded-lg"
      style={{
        background: "linear-gradient(180deg, rgba(25,25,25,0.92) 0%, rgba(16,16,16,0.96) 100%)",
        backdropFilter: "blur(25px)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <div className={`text-[18px] font-bold text-white`}>
            {item.val}
          </div>
          <div className="text-[8px] uppercase tracking-[1.5px] text-[#555] mt-0.5">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Action Buttons (top right) ──
export function ActionButtons({ visible, onReset }: { visible: boolean; onReset: () => void }) {
  if (!visible) return null;

  return (
    <>
      <button
        className="absolute top-4 right-4 z-50 px-5 py-2.5 rounded-md text-[11px] font-semibold uppercase tracking-[1.5px] cursor-pointer transition-all duration-200 text-black"
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #d0d0d0 100%)",
          border: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Download
      </button>
      <button
        onClick={onReset}
        className="absolute top-4 right-32 z-50 px-5 py-2.5 rounded-md text-[12px] font-semibold uppercase tracking-[1px] cursor-pointer transition-all duration-200 text-[#999] hover:text-white"
        style={{
          background: "linear-gradient(180deg, rgba(35,35,35,0.9) 0%, rgba(25,25,25,0.95) 100%)",
          backdropFilter: "blur(15px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Start Over
      </button>
    </>
  );
}
