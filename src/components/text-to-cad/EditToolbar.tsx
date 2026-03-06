import { useState } from "react";

interface EditToolbarProps {
  onSceneAction: (action: string) => void;
  hasSelection: boolean;
  transformMode?: string;
}

// Icon-only sidebar button with tooltip
const SIDE_BTN = "w-[48px] h-[48px] flex items-center justify-center cursor-pointer transition-all duration-150 relative group";
const SIDE_BTN_DEFAULT = `${SIDE_BTN} text-foreground/60 hover:text-foreground hover:bg-accent/50`;

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
  const isTransformActive = transformMode !== "orbit";

  if (!isTransformActive) return null;

  return (
    <div className="absolute top-[110px] left-0 z-[45] flex flex-col bg-card border-r border-border shadow-md w-[52px]">
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
      <div className="pb-2" />
    </div>
  );
}
