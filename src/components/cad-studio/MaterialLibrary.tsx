import { MATERIAL_LIBRARY, type MaterialDef } from "./materials";
import MaterialSphere from "./MaterialSphere";

interface MaterialLibraryProps {
  selectedMesh: string | null;
  onApplyMaterial: (material: MaterialDef) => void;
}

export default function MaterialLibrary({ selectedMesh, onApplyMaterial }: MaterialLibraryProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-[10px] uppercase tracking-[3px] text-muted-foreground font-semibold mb-3">
          Material Library
        </h2>
      </div>

      {!selectedMesh && (
        <div className="px-4 py-2">
          <p className="text-[10px] text-muted-foreground/60 italic">
            Select a mesh to apply materials
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin">
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {MATERIAL_LIBRARY.map((mat) => (
            <button
              key={mat.id}
              onClick={() => onApplyMaterial(mat)}
              disabled={!selectedMesh}
              className="flex flex-col items-center gap-1 p-2 rounded-xl border border-border/30 bg-card/30 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed group overflow-hidden min-w-0"
            >
              <MaterialSphere category={mat.category} preview={mat.preview} size={36} />
              <span className="text-[8px] font-semibold uppercase tracking-wider text-foreground/80 group-hover:text-foreground text-center leading-tight w-full break-words hyphens-auto overflow-hidden">
                {mat.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}