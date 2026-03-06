import { useState, useMemo, useRef } from "react";
import type { MeshItemData } from "./types";

interface MeshPanelProps {
  meshes: MeshItemData[];
  onSelectMesh: (name: string, multi: boolean) => void;
  onAction: (action: string) => void;
}

// Consistent action button style
const ACTION_BTN = "py-2 text-[10px] text-muted-foreground text-center cursor-pointer transition-all duration-200 font-semibold hover:text-foreground active:scale-[0.98] bg-muted/20 border border-border/50";

export default function MeshPanel({ meshes, onSelectMesh, onAction }: MeshPanelProps) {
  const [search, setSearch] = useState("");
  const lastClickedIdx = useRef<number>(-1);

  const totalVerts = useMemo(() => meshes.reduce((s, m) => s + m.verts, 0), [meshes]);
  const filtered = useMemo(
    () => meshes.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())),
    [meshes, search]
  );

  const handleMeshClick = (mesh: MeshItemData, e: React.MouseEvent) => {
    const currentIdx = meshes.findIndex((m) => m.name === mesh.name);
    if (e.shiftKey && lastClickedIdx.current >= 0) {
      const start = Math.min(lastClickedIdx.current, currentIdx);
      const end = Math.max(lastClickedIdx.current, currentIdx);
      for (let i = start; i <= end; i++) {
        if (!meshes[i].selected) onSelectMesh(meshes[i].name, true);
      }
      return;
    }
    lastClickedIdx.current = currentIdx;
    onSelectMesh(mesh.name, e.ctrlKey || e.metaKey);
  };

  return (
    <div className="w-[270px] flex-shrink-0 flex flex-col bg-card border-l border-border h-full">
      {/* Header — fixed */}
      <div className="px-4 pt-4 pb-3.5 border-b border-border flex-shrink-0">
        <h2 className="font-display text-lg tracking-[0.15em] text-foreground uppercase mb-2">Meshes</h2>
        <div className="font-mono text-[10px] text-muted-foreground mb-3 tracking-wide">
          {meshes.length > 0 ? `${meshes.length} meshes · ${totalVerts.toLocaleString()} vertices` : "No model loaded"}
        </div>
        <input
          type="text"
          placeholder="Search meshes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2.5 text-[11px] text-foreground placeholder:text-muted-foreground/50 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-ring font-body bg-muted/30 border border-border"
        />
      </div>

      {/* Scrollable mesh list */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 scrollbar-thin">
        {filtered.length === 0 && (
          <div className="text-center font-mono text-[10px] text-muted-foreground/50 py-5">
            {meshes.length === 0 ? "Generate a ring to see meshes" : "No matching meshes"}
          </div>
        )}
        {filtered.map((mesh) => (
          <button
            key={mesh.name}
            onClick={(e) => handleMeshClick(mesh, e)}
            className={`w-full text-left px-3 py-2.5 mb-1 cursor-pointer transition-all duration-200 border ${
              mesh.selected ? "text-foreground bg-accent border-border" : "hover:bg-accent/50 text-foreground/80 border-transparent"
            } ${!mesh.visible ? "opacity-35" : ""}`}
          >
            <div className="text-[11px] mb-0.5 truncate font-medium">
              {!mesh.visible && "[H] "}{mesh.name}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">
              {mesh.verts} verts / {mesh.faces} faces
            </div>
          </button>
        ))}
      </div>

      {/* Sticky footer — always visible */}
      <div className="px-4 py-3 border-t border-border flex-shrink-0">
        <div className="grid grid-cols-3 gap-1.5 mb-1.5">
          {["Hide", "Show", "Show All"].map((action) => (
            <button
              key={action}
              onClick={() => onAction(action.toLowerCase().replace(" ", "-"))}
              className={ACTION_BTN}
            >
              {action}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {["Isolate", "Invert"].map((action) => (
            <button
              key={action}
              onClick={() => onAction(action === "Invert" ? "select-invert" : action.toLowerCase())}
              className={ACTION_BTN}
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
