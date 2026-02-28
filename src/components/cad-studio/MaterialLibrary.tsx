import { useState } from "react";
import { Gem, CircleDot } from "lucide-react";
import { MATERIAL_LIBRARY, type MaterialDef } from "./materials";
import MaterialSphere from "./MaterialSphere";

interface MaterialLibraryProps {
  selectedMesh: string | null;
  onApplyMaterial: (material: MaterialDef) => void;
}

export default function MaterialLibrary({ selectedMesh, onApplyMaterial }: MaterialLibraryProps) {
  const [tab, setTab] = useState<"metal" | "gemstone">("metal");

  const metals = MATERIAL_LIBRARY.filter((m) => m.category === "metal");
  const gemstones = MATERIAL_LIBRARY.filter((m) => m.category === "gemstone");
  const items = tab === "metal" ? metals : gemstones;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-[10px] uppercase tracking-[3px] text-muted-foreground font-semibold mb-3">
          Material Library
        </h2>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
          <button
            onClick={() => setTab("metal")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-semibold transition-colors ${
              tab === "metal"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CircleDot className="w-3 h-3" />
            Metals
          </button>
          <button
            onClick={() => setTab("gemstone")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-semibold transition-colors ${
              tab === "gemstone"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Gem className="w-3 h-3" />
            Gems
          </button>
        </div>
      </div>

      {!selectedMesh && (
        <div className="px-4 py-2">
          <p className="text-[10px] text-muted-foreground/60 italic">
            Select a mesh to apply materials
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin">
        <div className="grid grid-cols-2 gap-2 mt-2">
          {items.map((mat) => (
            <button
              key={mat.id}
              onClick={() => onApplyMaterial(mat)}
              disabled={!selectedMesh}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/30 bg-card/30 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              <MaterialSphere category={mat.category} preview={mat.preview} size={40} />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-foreground/80 group-hover:text-foreground">
                {mat.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
