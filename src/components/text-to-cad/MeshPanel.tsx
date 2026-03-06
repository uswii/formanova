import { useState, useMemo, useRef } from "react";
import type { MeshItemData } from "./types";

interface MeshPanelProps {
  meshes: MeshItemData[];
  onSelectMesh: (name: string, multi: boolean) => void;
  onAction: (action: string) => void;
}

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
    <div
      className="w-[270px] flex-shrink-0 flex flex-col"
      style={{
        background: "rgba(12,12,12,0.98)",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <h2 className="font-display text-lg tracking-[0.15em] text-white uppercase mb-2">Meshes</h2>
        <div className="font-mono text-[10px] text-[#666] mb-3 tracking-wide">
          {meshes.length > 0 ? `${meshes.length} meshes · ${totalVerts.toLocaleString()} vertices` : "No model loaded"}
        </div>
        <input
          type="text"
          placeholder="Search meshes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2.5 text-[11px] text-[#e0e0e0] placeholder:text-[#444] transition-all duration-200 focus:outline-none focus:border-white/15 font-body"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
      </div>

      {/* Mesh list */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {filtered.length === 0 && (
          <div className="text-center font-mono text-[10px] text-[#444] py-5">
            {meshes.length === 0 ? "Generate a ring to see meshes" : "No matching meshes"}
          </div>
        )}
        {filtered.map((mesh) => (
          <button
            key={mesh.name}
            onClick={(e) => handleMeshClick(mesh, e)}
            className={`w-full text-left px-3 py-2.5 mb-1 cursor-pointer transition-all duration-200 ${
              mesh.selected ? "text-white" : "hover:bg-white/5 text-[#ccc]"
            } ${!mesh.visible ? "opacity-35" : ""}`}
            style={{
              background: mesh.selected ? "rgba(255,255,255,0.08)" : "transparent",
              border: mesh.selected ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
            }}
          >
            <div className="text-[11px] mb-0.5 truncate font-medium">
              {!mesh.visible && "[H] "}{mesh.name}
            </div>
            <div className="font-mono text-[9px] text-[#666]">
              {mesh.verts} verts / {mesh.faces} faces
            </div>
          </button>
        ))}
      </div>

      {/* Batch actions */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <h4 className="font-mono text-[9px] uppercase text-[#777] mb-2 tracking-[0.15em]">Mesh Actions</h4>
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {["Hide", "Show", "Show All", "Isolate"].map((action) => (
            <button
              key={action}
              onClick={() => onAction(action.toLowerCase().replace(" ", "-"))}
              className="py-2.5 text-[10px] text-[#bbb] text-center cursor-pointer transition-all duration-200 font-semibold hover:text-white active:scale-[0.98]"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {action}
            </button>
          ))}
        </div>
        <h4 className="font-mono text-[9px] uppercase text-[#777] mb-2 mt-2 tracking-[0.15em]">Selection</h4>
        <div className="flex gap-1.5">
          {["All", "None", "Invert"].map((action) => (
            <button
              key={action}
              onClick={() => onAction(`select-${action.toLowerCase()}`)}
              className="flex-1 py-2.5 text-[10px] text-[#bbb] text-center cursor-pointer transition-all duration-200 font-semibold hover:text-white active:scale-[0.98]"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
