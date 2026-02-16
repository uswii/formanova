import { useState } from "react";
import {
  Move, Box, Settings, Paintbrush, Eye, PenTool, Magnet,
  RotateCcw, Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOOLS = [
  { id: "move", label: "MOVE", icon: Move },
  { id: "mesh", label: "MESH", icon: Box },
  { id: "mods", label: "MODS", icon: Settings },
  { id: "mat", label: "MAT", icon: Paintbrush },
  { id: "view", label: "VIEW", icon: Eye },
  { id: "sculpt", label: "SCULPT", icon: PenTool },
  { id: "snap", label: "SNAP", icon: Magnet },
] as const;

export default function ViewportToolbar() {
  const [active, setActive] = useState("move");

  return (
    <div className="flex flex-col items-center py-3 px-1.5 gap-1 bg-card/60 backdrop-blur-sm border-r border-border/30 w-[58px] flex-shrink-0">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActive(tool.id)}
          className={cn(
            "flex flex-col items-center justify-center w-11 h-14 rounded-lg text-[8px] font-bold uppercase tracking-[1.5px] transition-all duration-200",
            active === tool.id
              ? "bg-primary/15 text-primary border border-primary/30 shadow-sm"
              : "text-foreground/70 hover:text-foreground hover:bg-muted/40"
          )}
        >
          <tool.icon className="w-4.5 h-4.5 mb-0.5" strokeWidth={1.5} />
          {tool.label}
        </button>
      ))}
    </div>
  );
}
