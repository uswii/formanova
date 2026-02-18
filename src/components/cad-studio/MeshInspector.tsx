import { Box, ChevronRight } from "lucide-react";
import type { MaterialDef } from "./materials";

interface MeshInfo {
  name: string;
}

interface MeshInspectorProps {
  meshes: MeshInfo[];
  selectedMesh: string | null;
  onSelectMesh: (name: string) => void;
  meshMaterials: Record<string, MaterialDef>;
}

export default function MeshInspector({
  meshes,
  selectedMesh,
  onSelectMesh,
  meshMaterials,
}: MeshInspectorProps) {
  if (meshes.length === 0) {
    return (
      <div className="px-4 py-3">
        <h2 className="text-[10px] uppercase tracking-[3px] text-muted-foreground font-semibold mb-2">
          Mesh Inspector
        </h2>
        <p className="text-[10px] text-muted-foreground/60 italic">
          No model loaded
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <h2 className="text-[10px] uppercase tracking-[3px] text-muted-foreground font-semibold mb-3">
        Mesh Inspector
      </h2>
      <div className="space-y-1">
        {meshes.map((mesh) => {
          const assigned = meshMaterials[mesh.name];
          const isSelected = selectedMesh === mesh.name;
          return (
            <button
              key={mesh.name}
              onClick={() => onSelectMesh(mesh.name)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-200 ${
                isSelected
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted/50 border border-transparent"
              }`}
            >
              <Box className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${isSelected ? "text-foreground" : "text-foreground/80"}`}>
                  {mesh.name}
                </p>
                {assigned && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full border border-border/40"
                      style={{ background: assigned.preview }}
                    />
                    <span className="text-[9px] text-muted-foreground">{assigned.name}</span>
                  </div>
                )}
              </div>
              <ChevronRight className={`w-3 h-3 ${isSelected ? "text-primary" : "text-muted-foreground/40"}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
