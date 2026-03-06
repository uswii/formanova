import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EDIT_TOOLS } from "./types";

interface EditToolbarProps {
  onSceneAction: (action: string) => void;
  hasSelection: boolean;
  transformMode?: string;
}

// Icon-only sidebar button with tooltip
const SIDE_BTN = "w-[48px] h-[48px] flex items-center justify-center cursor-pointer transition-all duration-150 relative group";
const SIDE_BTN_DEFAULT = `${SIDE_BTN} text-foreground/60 hover:text-foreground hover:bg-accent/50`;
const SIDE_BTN_ACTIVE = `${SIDE_BTN} text-foreground bg-accent`;

function SidebarDivider() {
  return <div className="h-px bg-border mx-2 my-1" />;
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-3 pb-1.5">
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/70">{children}</span>
    </div>
  );
}

function SidebarTooltip({ text }: { text: string }) {
  return (
    <span className="hidden group-hover:flex absolute left-[56px] top-1/2 -translate-y-1/2 z-50 font-mono text-[11px] font-medium text-foreground px-3 py-2 whitespace-nowrap pointer-events-none bg-popover border border-border shadow-lg items-center">
      {text}
    </span>
  );
}

export default function EditToolbar({ onSceneAction, hasSelection, transformMode = "orbit" }: EditToolbarProps) {
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

  const viewTools = EDIT_TOOLS.filter(t => t.flyout === "display");

  const isTransformActive = transformMode !== "orbit";

  // Calculate flyout position based on sidebar layout
  const getFlyoutTop = () => {
    const baseOffset = isTransformActive ? 380 : 60;
    const editToolIdx = EDIT_TOOLS.findIndex((t) => t.flyout === activeFlyout);
    const displayIdx = EDIT_TOOLS.findIndex((t) => t.flyout === "display");
    
    if (activeFlyout === "display") {
      return baseOffset + (editToolIdx > 0 ? editToolIdx * 52 : 0) + 30; // extra gap for divider + view label
    }
    return baseOffset + editToolIdx * 52;
  };

  return (
    <>
      {/* Vertical sidebar toolbar */}
      <div className="absolute top-[110px] left-0 z-[45] flex flex-col bg-card border-r border-border shadow-md w-[52px]">
        {/* ── Transform Actions — only when transform tool is active ── */}
        {isTransformActive && (
          <>
            <SidebarLabel>Transform</SidebarLabel>
            {[
              { icon: "⟳", action: "reset-transform", tip: "Reset Transform" },
              { icon: "✓", action: "apply-transform", tip: "Apply to Geometry" },
              { icon: "⧉", action: "duplicate", tip: "Duplicate Selected" },
            ].map((btn) => (
              <button
                key={btn.action}
                onClick={() => onSceneAction(btn.action)}
                className={SIDE_BTN_DEFAULT}
              >
                <span className="text-[18px]">{btn.icon}</span>
                <SidebarTooltip text={btn.tip} />
              </button>
            ))}
            <SidebarDivider />
            {/* Mirror */}
            {(["x", "y", "z"] as const).map((axis) => (
              <button
                key={axis}
                onClick={() => onSceneAction(`mirror-${axis}`)}
                className={`${SIDE_BTN_DEFAULT} h-[38px]`}
              >
                <span className="font-mono text-[12px] font-bold uppercase">{axis}</span>
                <SidebarTooltip text={`Mirror ${axis.toUpperCase()}`} />
              </button>
            ))}
            <SidebarDivider />
          </>
        )}

        {/* ── Object Tools ── */}
        <SidebarLabel>Object</SidebarLabel>
        {objectTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => toggleFlyout(tool.flyout)}
            className={activeFlyout === tool.flyout ? SIDE_BTN_ACTIVE : SIDE_BTN_DEFAULT}
          >
            <span className="text-[20px]">{tool.icon}</span>
            <SidebarTooltip text={tool.tip} />
          </button>
        ))}

        <SidebarDivider />

        {/* ── View Tools ── */}
        <SidebarLabel>View</SidebarLabel>
        {viewTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => toggleFlyout(tool.flyout)}
            className={activeFlyout === tool.flyout ? SIDE_BTN_ACTIVE : SIDE_BTN_DEFAULT}
          >
            <span className="text-[20px]">{tool.icon}</span>
            <SidebarTooltip text={tool.tip} />
          </button>
        ))}

        <div className="pb-2" />
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
            className="absolute z-[46] overflow-y-auto max-h-[80vh] w-[300px] p-4 bg-card border border-border shadow-lg"
            style={{
              left: "56px",
              top: `${getFlyoutTop()}px`,
            }}
          >
            {!hasSelection && activeFlyout !== "display" && (
              <div className="mb-3 px-3 py-2.5 font-mono text-[11px] text-amber-500 bg-amber-500/10 border border-amber-500/20">
                ⚠ Select a mesh in the viewport first
              </div>
            )}
            {activeFlyout === "mesh" && <MeshFlyout onAction={onSceneAction} />}
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
  const disabled = !onClick;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`block w-full px-3.5 py-3 mb-1.5 text-[13px] text-left transition-all duration-200 font-bold border ${
        disabled
          ? "cursor-default border-border/30 bg-muted/10"
          : active
            ? "text-foreground bg-accent border-border cursor-pointer"
            : "text-foreground/80 hover:text-foreground hover:bg-accent/50 bg-muted/20 border-border/50 cursor-pointer"
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


const DISPLAY_OPTIONS = [
  { label: "Wireframe", available: true },
  { label: "Flat Shading", available: false },
  { label: "Bounding Box", available: false },
  { label: "Show Normals", available: false },
];

function DisplayFlyout({ toggles, onToggle }: { toggles: Set<string>; onToggle: (id: string) => void }) {
  return (
    <>
      <FlyoutTitle>Display</FlyoutTitle>
      {DISPLAY_OPTIONS.map(({ label, available }) => (
        <div key={label} className="relative">
          <FoBtn
            active={toggles.has(label)}
            onClick={available ? () => onToggle(label) : undefined}
          >
            <span className={available ? "" : "opacity-40"}>{label}</span>
            {!available && (
              <span className="float-right font-mono text-[9px] text-muted-foreground/60 italic">soon</span>
            )}
          </FoBtn>
        </div>
      ))}
    </>
  );
}
