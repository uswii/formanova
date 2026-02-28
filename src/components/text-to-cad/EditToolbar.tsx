import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EDIT_TOOLS, MATERIAL_LIBRARY } from "./types";
import MaterialSphere from "@/components/cad-studio/MaterialSphere";

interface EditToolbarProps {
  onApplyMaterial: (matId: string) => void;
  onSceneAction: (action: string) => void;
  hasSelection: boolean;
}

export default function EditToolbar({ onApplyMaterial, onSceneAction, hasSelection }: EditToolbarProps) {
  const [activeFlyout, setActiveFlyout] = useState<string | null>(null);
  const [activeDisplayToggles, setActiveDisplayToggles] = useState<Set<string>>(new Set());

  const toggleFlyout = (flyout: string) => {
    setActiveFlyout((prev) => (prev === flyout ? null : flyout));
  };

  // Don't close flyout when selection changes — keep it open
  // Only close on explicit click-away or button toggle

  const toggleDisplay = (id: string) => {
    setActiveDisplayToggles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (id === "Wireframe") onSceneAction("wireframe-off");
        if (id === "Flat Shading") onSceneAction("flat-shading-off");
      } else {
        next.add(id);
        if (id === "Wireframe") onSceneAction("wireframe-on");
        if (id === "Flat Shading") onSceneAction("flat-shading-on");
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
                : activeFlyout === "materials" ? "144px"
                : "188px",
              background: "linear-gradient(180deg, rgba(30,30,30,0.88) 0%, rgba(18,18,18,0.94) 100%)",
              backdropFilter: "blur(30px)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "8px 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {!hasSelection && activeFlyout !== "display" && (
              <div className="mb-3 px-3 py-2.5 rounded-lg text-[11px] text-amber-400/90 font-medium"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
                ⚠ Select a mesh in the viewport first
              </div>
            )}
            {activeFlyout === "transform" && <TransformFlyout onAction={onSceneAction} />}
            {activeFlyout === "mesh" && <MeshFlyout onAction={onSceneAction} />}
            {activeFlyout === "materials" && <MaterialsFlyout metals={metals} gems={gems} onApply={onApplyMaterial} />}
            {activeFlyout === "display" && <DisplayFlyout toggles={activeDisplayToggles} onToggle={toggleDisplay} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-away removed — flyout stays open during viewport interaction */}
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

// ── FLYOUT CONTENTS ──

function TransformFlyout({ onAction }: { onAction: (a: string) => void }) {
  return (
    <>
      <FlyoutTitle>Transform</FlyoutTitle>
      <FoBtn shortcut="G" onClick={() => onAction("set-mode-translate")}>Move</FoBtn>
      <FoBtn shortcut="R" onClick={() => onAction("set-mode-rotate")}>Rotate</FoBtn>
      <FoBtn shortcut="S" onClick={() => onAction("set-mode-scale")}>Scale</FoBtn>
      <FoSep />
      <FoBtn onClick={() => onAction("reset-transform")}>Reset Transform</FoBtn>
      <FoBtn onClick={() => onAction("apply-transform")}>Apply Transform</FoBtn>
      <FoBtn shortcut="Shift+D" onClick={() => onAction("duplicate")}>Duplicate</FoBtn>
      <FoSep />
      <FlyoutSubtitle>Mirror</FlyoutSubtitle>
      <div className="flex gap-1.5 mb-1">
        <FoBtn onClick={() => onAction("mirror-x")}>Mirror X</FoBtn>
        <FoBtn onClick={() => onAction("mirror-y")}>Mirror Y</FoBtn>
        <FoBtn onClick={() => onAction("mirror-z")}>Mirror Z</FoBtn>
      </div>
    </>
  );
}

function MeshFlyout({ onAction }: { onAction: (a: string) => void }) {
  return (
    <>
      <FlyoutTitle>Mesh</FlyoutTitle>
      <FoBtn shortcut="X" onClick={() => onAction("delete")}>Delete Selected</FoBtn>
      <FoBtn shortcut="Shift+D" onClick={() => onAction("duplicate")}>Duplicate</FoBtn>
      <FoSep />
      <FoBtn onClick={() => onAction("flip-normals")}>Flip Normals</FoBtn>
      <FoBtn onClick={() => onAction("center-origin")}>Center Origin</FoBtn>
      <FoBtn onClick={() => onAction("recalc-normals")}>Recalculate Normals</FoBtn>
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
            <MaterialSphere category="metal" preview={m.preview} size={16} />
            {m.name}
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
            <MaterialSphere category="gemstone" preview={g.preview} size={16} />
            {g.name}
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
      {["Wireframe", "Flat Shading", "Bounding Box", "Show Normals"].map((label) => (
        <FoBtn key={label} active={toggles.has(label)} onClick={() => onToggle(label)}>{label}</FoBtn>
      ))}
    </>
  );
}
