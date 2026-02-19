import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EDIT_TOOLS, MATERIAL_LIBRARY } from "./types";

interface EditToolbarProps {
  onApplyMaterial: (matId: string) => void;
  onSceneAction: (action: string) => void;
}

export default function EditToolbar({ onApplyMaterial, onSceneAction }: EditToolbarProps) {
  const [activeFlyout, setActiveFlyout] = useState<string | null>(null);
  const [activeDisplayToggles, setActiveDisplayToggles] = useState<Set<string>>(new Set());

  const toggleFlyout = (flyout: string) => {
    setActiveFlyout((prev) => (prev === flyout ? null : flyout));
  };

  const toggleDisplay = (id: string) => {
    setActiveDisplayToggles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (id === "Wireframe") onSceneAction("wireframe-off");
      } else {
        next.add(id);
        if (id === "Wireframe") onSceneAction("wireframe-on");
      }
      return next;
    });
  };

  const metals = MATERIAL_LIBRARY.filter((m) => m.category === "metal");
  const gems = MATERIAL_LIBRARY.filter((m) => m.category === "gemstone");

  return (
    <>
      {/* Vertical toolbar */}
      <div
        className="absolute top-[70px] left-0 z-[45] flex flex-col gap-0.5 px-1.5 py-2"
        style={{
          background: "linear-gradient(180deg, rgba(22,22,22,0.92) 0%, rgba(14,14,14,0.96) 100%)",
          backdropFilter: "blur(24px)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.5)",
        }}
      >
        {EDIT_TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => toggleFlyout(tool.flyout)}
            className={`w-[56px] h-[50px] flex flex-col items-center justify-center gap-0.5 rounded-md cursor-pointer transition-all duration-150 relative group ${
              activeFlyout === tool.flyout
                ? "text-white shadow-[0_0_12px_rgba(255,255,255,0.08)]"
                : "text-[#777] hover:text-white hover:bg-white/5"
            }`}
            style={{
              background: activeFlyout === tool.flyout
                ? "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)"
                : "transparent",
              border: activeFlyout === tool.flyout ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
            }}
          >
            <span className="text-[20px]">{tool.icon}</span>
            <span className="text-[7px] uppercase tracking-[0.5px] text-[#666] font-semibold">{tool.label}</span>
            <span className="hidden group-hover:block absolute left-[64px] top-1/2 -translate-y-1/2 z-50 text-[12px] text-[#e0e0e0] px-3.5 py-2 rounded-md whitespace-nowrap font-medium tracking-[0.3px] pointer-events-none"
              style={{
                background: "linear-gradient(180deg, rgba(35,35,35,0.95) 0%, rgba(25,25,25,0.98) 100%)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "4px 4px 16px rgba(0,0,0,0.5)",
              }}
            >
              {tool.tip}
            </span>
          </button>
        ))}
      </div>

      {/* Flyout panels */}
      <AnimatePresence>
        {activeFlyout && (
          <motion.div
            key={activeFlyout}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute z-[46] overflow-y-auto max-h-[80vh] w-[300px] rounded-xl p-4"
            style={{
              left: "70px",
              top: activeFlyout === "transform" ? "56px"
                : activeFlyout === "mesh" ? "100px"
                : activeFlyout === "modifiers" ? "144px"
                : activeFlyout === "materials" ? "188px"
                : activeFlyout === "display" ? "232px"
                : activeFlyout === "sculpt" ? "276px"
                : "320px",
              background: "linear-gradient(180deg, rgba(30,30,30,0.88) 0%, rgba(18,18,18,0.94) 100%)",
              backdropFilter: "blur(30px)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "8px 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {activeFlyout === "transform" && <TransformFlyout onAction={onSceneAction} />}
            {activeFlyout === "mesh" && <MeshFlyout onAction={onSceneAction} />}
            {activeFlyout === "modifiers" && <ModifiersFlyout onAction={onSceneAction} />}
            {activeFlyout === "materials" && <MaterialsFlyout metals={metals} gems={gems} onApply={onApplyMaterial} />}
            {activeFlyout === "display" && <DisplayFlyout toggles={activeDisplayToggles} onToggle={toggleDisplay} />}
            {activeFlyout === "sculpt" && <SculptFlyout onAction={onSceneAction} />}
            {activeFlyout === "snap" && <SnapFlyout onAction={onSceneAction} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-away */}
      {activeFlyout && (
        <div className="absolute inset-0 z-[44]" onClick={() => setActiveFlyout(null)} />
      )}
    </>
  );
}

// ── Reusable UI ──
function FoBtn({ children, shortcut, active, onClick }: {
  children: React.ReactNode; shortcut?: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-3.5 py-3 mb-1.5 rounded-lg text-[12px] text-left cursor-pointer transition-all duration-200 font-semibold ${
        active ? "text-white shadow-[0_0_12px_rgba(255,255,255,0.06)]" : "text-[#aaa] hover:text-white"
      }`}
      style={{
        background: active
          ? "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)"
          : "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.06)"}`,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
          e.currentTarget.style.background = "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
          e.currentTarget.style.background = "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)";
        }
      }}
    >
      {children}
      {shortcut && <kbd className="float-right text-[10px] text-[#666] font-semibold">{shortcut}</kbd>}
    </button>
  );
}

function FlyoutTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[12px] text-white mb-3.5 font-bold uppercase tracking-[2px]">{children}</h3>;
}

function FlyoutSubtitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] text-[#777] mt-4 mb-2 uppercase tracking-[1.5px] font-semibold">{children}</h4>;
}

function FoSep() {
  return <div className="h-px bg-white/5 my-3" />;
}

function NumInput({ label, color, step, value, min }: {
  label: string; color: string; step: string; value: string; min?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <label className="text-[13px] font-bold w-9 text-center rounded-md py-1" style={{ color }}>{label}</label>
      <input
        type="number"
        step={step}
        defaultValue={value}
        min={min}
        className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-white focus:outline-none"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(8px)",
        }}
      />
    </div>
  );
}

// ── FLYOUT CONTENTS (now wired to onAction) ──

function TransformFlyout({ onAction }: { onAction: (a: string) => void }) {
  return (
    <>
      <FlyoutTitle>Transform</FlyoutTitle>
      <FlyoutSubtitle>Position (precise)</FlyoutSubtitle>
      <NumInput label="X" color="#f44" step="0.001" value="0" />
      <NumInput label="Y" color="#4f4" step="0.001" value="0" />
      <NumInput label="Z" color="#48f" step="0.001" value="0" />
      <FlyoutSubtitle>Rotation (degrees)</FlyoutSubtitle>
      <NumInput label="RX" color="#f44" step="1" value="0" />
      <NumInput label="RY" color="#4f4" step="1" value="0" />
      <NumInput label="RZ" color="#48f" step="1" value="0" />
      <FlyoutSubtitle>Scale (per-axis)</FlyoutSubtitle>
      <NumInput label="SX" color="#f44" step="0.01" value="1" min="0.01" />
      <NumInput label="SY" color="#4f4" step="0.01" value="1" min="0.01" />
      <NumInput label="SZ" color="#48f" step="0.01" value="1" min="0.01" />
      <FlyoutSubtitle>Tools</FlyoutSubtitle>
      <FoBtn onClick={() => onAction("reset-transform")}>Reset Transform</FoBtn>
      <FoSep />
      <FlyoutSubtitle>Mirror</FlyoutSubtitle>
      <div className="flex gap-1.5 mb-1">
        <FoBtn onClick={() => onAction("mirror-x")}>Mirror X</FoBtn>
        <FoBtn onClick={() => onAction("mirror-y")}>Mirror Y</FoBtn>
        <FoBtn onClick={() => onAction("mirror-z")}>Mirror Z</FoBtn>
      </div>
      <FoBtn shortcut="Shift+D" onClick={() => onAction("duplicate")}>Duplicate</FoBtn>
    </>
  );
}

function MeshFlyout({ onAction }: { onAction: (a: string) => void }) {
  return (
    <>
      <FlyoutTitle>Mesh</FlyoutTitle>
      <FoBtn shortcut="X" onClick={() => onAction("delete")}>Delete Selected</FoBtn>
      <FoBtn shortcut="Shift+D" onClick={() => onAction("duplicate")}>Duplicate</FoBtn>
      <FoBtn onClick={() => onAction("merge")}>Merge Selected</FoBtn>
      <FoBtn onClick={() => onAction("separate")}>Separate Loose Parts</FoBtn>
      <FoSep />
      <FoBtn onClick={() => onAction("flip-normals")}>Flip Normals</FoBtn>
      <FoBtn onClick={() => onAction("center-origin")}>Center Origin</FoBtn>
      <FoBtn onClick={() => onAction("recalc-normals")}>Recalculate Normals</FoBtn>
    </>
  );
}

function ModifiersFlyout({ onAction }: { onAction: (a: string) => void }) {
  return (
    <>
      <FlyoutTitle>Modifiers</FlyoutTitle>
      <FlyoutSubtitle>Geometry</FlyoutSubtitle>
      <FoBtn onClick={() => onAction("subdivide-1")}>Subdivide (x1)</FoBtn>
      <FoBtn onClick={() => onAction("subdivide-2")}>Subdivide (x2)</FoBtn>
      <FoBtn onClick={() => onAction("smooth-3")}>Smooth (3 iter)</FoBtn>
      <FoBtn onClick={() => onAction("smooth-10")}>Smooth (10 iter)</FoBtn>
      <FlyoutSubtitle>Reduce</FlyoutSubtitle>
      <FoBtn onClick={() => onAction("decimate-50")}>Decimate 50%</FoBtn>
      <FoBtn onClick={() => onAction("decimate-25")}>Decimate 25%</FoBtn>
      <FoBtn onClick={() => onAction("decimate-10")}>Decimate 10%</FoBtn>
      <FlyoutSubtitle>Mirror Modifier</FlyoutSubtitle>
      <div className="flex gap-1.5 mb-1">
        <FoBtn onClick={() => onAction("mirror-x")}>Mirror X</FoBtn>
        <FoBtn onClick={() => onAction("mirror-y")}>Mirror Y</FoBtn>
        <FoBtn onClick={() => onAction("mirror-z")}>Mirror Z</FoBtn>
      </div>
    </>
  );
}

function MaterialsFlyout({ metals, gems, onApply }: {
  metals: typeof MATERIAL_LIBRARY;
  gems: typeof MATERIAL_LIBRARY;
  onApply: (matId: string) => void;
}) {
  return (
    <>
      <FlyoutTitle>Materials</FlyoutTitle>
      <FlyoutSubtitle>Metals ({metals.length})</FlyoutSubtitle>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {metals.map((m) => (
          <button
            key={m.id}
            onClick={() => onApply(m.id)}
            className="py-2.5 px-3 rounded-lg text-[10px] text-[#bbb] text-center cursor-pointer transition-all duration-200 hover:text-white font-medium hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span
              className="inline-block w-4 h-4 rounded-full mr-1.5 align-middle"
              style={{ background: m.preview, border: "1px solid rgba(255,255,255,0.2)" }}
            />
            {m.name}
          </button>
        ))}
      </div>
      <FlyoutSubtitle>Gems ({gems.length})</FlyoutSubtitle>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {gems.map((g) => (
          <button
            key={g.id}
            onClick={() => onApply(g.id)}
            className="py-2.5 px-3 rounded-lg text-[10px] text-[#bbb] text-center cursor-pointer transition-all duration-200 hover:text-white font-medium hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span
              className="inline-block w-4 h-4 rounded-full mr-1.5 align-middle"
              style={{ background: g.preview, border: "1px solid rgba(255,255,255,0.2)" }}
            />
            {g.name}
          </button>
        ))}
      </div>
    </>
  );
}

function DisplayFlyout({ toggles, onToggle }: { toggles: Set<string>; onToggle: (id: string) => void }) {
  return (
    <>
      <FlyoutTitle>Display</FlyoutTitle>
      {["Wireframe", "Flat Shading", "X-Ray", "Bounding Box", "Show Normals"].map((label) => (
        <FoBtn key={label} active={toggles.has(label)} onClick={() => onToggle(label)}>{label}</FoBtn>
      ))}
      <FoSep />
      <FoBtn>Toggle Auto-Rotate</FoBtn>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[13px] font-bold">Exposure</label>
        <input type="range" min="0.1" max="3" step="0.05" defaultValue={1.2} className="flex-1 h-[3px] accent-white" />
        <span className="text-[10px] text-[#888] w-9 text-right font-mono">1.2</span>
      </div>
    </>
  );
}

function SculptFlyout({ onAction }: { onAction: (a: string) => void }) {
  return (
    <>
      <FlyoutTitle>Sculpt</FlyoutTitle>
      <FoBtn onClick={() => onAction("sculpt-grab")}>Grab</FoBtn>
      <FoBtn onClick={() => onAction("sculpt-smooth")}>Smooth</FoBtn>
      <FoBtn onClick={() => onAction("sculpt-inflate")}>Inflate</FoBtn>
      <FoBtn onClick={() => onAction("sculpt-flatten")}>Flatten</FoBtn>
      <FoSep />
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[13px] font-bold">Size</label>
        <input type="range" min="0.02" max="1" step="0.01" defaultValue={0.2} className="flex-1 h-[3px] accent-white" />
        <span className="text-[10px] text-[#888] w-9 text-right font-mono">0.20</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[13px] font-bold">Strength</label>
        <input type="range" min="0.01" max="1" step="0.01" defaultValue={0.3} className="flex-1 h-[3px] accent-white" />
        <span className="text-[10px] text-[#888] w-9 text-right font-mono">0.30</span>
      </div>
      <FoBtn onClick={() => onAction("sculpt-enable")}>
        <span style={{ color: "#f80" }}>Enable Sculpt Mode</span>
      </FoBtn>
    </>
  );
}

function SnapFlyout({ onAction }: { onAction: (a: string) => void }) {
  return (
    <>
      <FlyoutTitle>Snap &amp; Pivot</FlyoutTitle>
      <FoBtn onClick={() => onAction("snap-toggle")}>Grid Snap: OFF</FoBtn>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[13px] font-bold">Grid Size</label>
        <input type="range" min="0.01" max="0.5" step="0.01" defaultValue={0.1} className="flex-1 h-[3px] accent-white" />
        <span className="text-[10px] text-[#888] w-9 text-right font-mono">0.10</span>
      </div>
      <FoSep />
      <FlyoutSubtitle>Pivot</FlyoutSubtitle>
      <FoBtn active onClick={() => onAction("pivot-median")}>Median Point</FoBtn>
      <FoBtn onClick={() => onAction("pivot-individual")}>Individual Origins</FoBtn>
      <FoBtn onClick={() => onAction("pivot-world")}>World Origin</FoBtn>
    </>
  );
}
