import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EDIT_TOOLS, MATERIAL_LIBRARY } from "./types";
import MaterialSphere from "@/components/cad-studio/MaterialSphere";

interface EditToolbarProps {
  onApplyMaterial: (matId: string) => void;
  onSceneAction: (action: string) => void;
  hasSelection: boolean;
  transformMode?: string;
}

export default function EditToolbar({ onApplyMaterial, onSceneAction, hasSelection, transformMode = "orbit" }: EditToolbarProps) {
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

  // Compute flyout vertical positions based on reduced tool count
  const getFlyoutTop = (flyout: string) => {
    const idx = EDIT_TOOLS.findIndex((t) => t.flyout === flyout);
    return `${56 + idx * 54}px`;
  };

  return (
    <>
      {/* Vertical toolbar — Transform Actions section */}
      <div className="absolute top-[70px] left-0 z-[45] flex flex-col">
        {/* Transform utility actions — shown when a transform tool is active */}
        {transformMode !== "orbit" && (
          <div className="flex flex-col gap-0.5 px-1.5 py-2 bg-card/95 backdrop-blur-sm border-r border-b border-border">
            {[
              { label: "Reset", icon: "⟳", action: "reset-transform", tip: "Reset transform" },
              { label: "Apply", icon: "✓", action: "apply-transform", tip: "Apply transform to geometry" },
              { label: "Dupe", icon: "⧉", action: "duplicate", tip: "Duplicate selected" },
            ].map((btn) => (
              <button
                key={btn.action}
                onClick={() => onSceneAction(btn.action)}
                className="w-[56px] h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all duration-150 relative group border border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
              >
                <span className="text-[16px]">{btn.icon}</span>
                <span className="font-mono text-[7px] uppercase tracking-wide">{btn.label}</span>
                <span className="hidden group-hover:block absolute left-[64px] top-1/2 -translate-y-1/2 z-50 font-mono text-[11px] text-foreground px-3.5 py-2 whitespace-nowrap pointer-events-none bg-popover border border-border shadow-md">
                  {btn.tip}
                </span>
              </button>
            ))}
            {/* Mirror sub-group */}
            <div className="h-px bg-border mx-2 my-1" />
            {(["x", "y", "z"] as const).map((axis) => (
              <button
                key={axis}
                onClick={() => onSceneAction(`mirror-${axis}`)}
                className="w-[56px] h-[36px] flex items-center justify-center gap-1 cursor-pointer transition-all duration-150 border border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
              >
                <span className="text-[12px]">⌿</span>
                <span className="font-mono text-[8px] uppercase font-bold">{axis}</span>
              </button>
            ))}
          </div>
        )}

        {/* Other tools (Mesh, Materials, Display) */}
        <div className="flex flex-col gap-0.5 px-1.5 py-2 bg-card/95 backdrop-blur-sm border-r border-border">
          {EDIT_TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => toggleFlyout(tool.flyout)}
              className={`w-[56px] h-[50px] flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all duration-150 relative group border ${
                activeFlyout === tool.flyout
                  ? "text-foreground bg-accent border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50 border-transparent"
              }`}
            >
              <span className="text-[20px]">{tool.icon}</span>
              <span className="font-mono text-[7px] uppercase tracking-wide text-muted-foreground">{tool.label}</span>
              <span className="hidden group-hover:block absolute left-[64px] top-1/2 -translate-y-1/2 z-50 font-mono text-[11px] text-foreground px-3.5 py-2 whitespace-nowrap pointer-events-none bg-popover border border-border shadow-md">
                {tool.tip}
              </span>
            </button>
          ))}
        </div>
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
            className="absolute z-[46] overflow-y-auto max-h-[80vh] w-[300px] p-4 bg-card/95 backdrop-blur-sm border border-border"
            style={{
              left: "70px",
              top: transformMode !== "orbit"
                ? `${(3 * 44 + 3 * 36 + 40) + EDIT_TOOLS.findIndex((t) => t.flyout === activeFlyout) * 54 + 70}px`
                : `${EDIT_TOOLS.findIndex((t) => t.flyout === activeFlyout) * 54 + 70}px`,
            }}
          >
            {!hasSelection && activeFlyout !== "display" && (
              <div className="mb-3 px-3 py-2.5 font-mono text-[11px] text-amber-500 bg-amber-500/10 border border-amber-500/20">
                ⚠ Select a mesh in the viewport first
              </div>
            )}
            {activeFlyout === "mesh" && <MeshFlyout onAction={onSceneAction} />}
            {activeFlyout === "materials" && <MaterialsFlyout metals={metals} gems={gems} onApply={onApplyMaterial} />}
            {activeFlyout === "display" && <DisplayFlyout toggles={activeDisplayToggles} onToggle={toggleDisplay} />}
          </motion.div>
        )}
      </AnimatePresence>
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
      className={`block w-full px-3.5 py-3 mb-1.5 text-[12px] text-left cursor-pointer transition-all duration-200 font-semibold border ${
        active
          ? "text-foreground bg-accent border-border"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50 bg-muted/20 border-border/50"
      }`}
    >
      {children}
      {shortcut && <kbd className="float-right font-mono text-[10px] text-muted-foreground">{shortcut}</kbd>}
    </button>
  );
}

function FlyoutTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display text-base text-foreground mb-4 uppercase tracking-[0.15em]">{children}</h3>;
}

function FlyoutSubtitle({ children }: { children: React.ReactNode }) {
  return <h4 className="font-mono text-[10px] text-muted-foreground mt-4 mb-2 uppercase tracking-[0.15em]">{children}</h4>;
}

function FoSep() {
  return <div className="h-px bg-border my-3" />;
}

// ── FLYOUT CONTENTS ──

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
            className="py-2.5 px-3 text-[10px] text-muted-foreground text-center cursor-pointer transition-all duration-200 hover:text-foreground active:scale-[0.97] bg-muted/20 border border-border/50"
          >
            <MaterialSphere category="metal" preview={m.preview} size={16} />
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
            className="py-2.5 px-3 text-[10px] text-muted-foreground text-center cursor-pointer transition-all duration-200 hover:text-foreground active:scale-[0.97] bg-muted/20 border border-border/50"
          >
            <MaterialSphere category="gemstone" preview={g.preview} size={16} />
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
