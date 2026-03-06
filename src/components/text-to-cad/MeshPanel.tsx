import { useState, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Focus, Shuffle, Layers, Filter, Trash2, Copy, Crosshair, FlipVertical, RefreshCw } from "lucide-react";
import type { MeshItemData } from "./types";
import { MATERIAL_LIBRARY, MATERIAL_TYPES, MATERIAL_ALLOYS, MATERIAL_FINISHES } from "@/components/cad-studio/materials";
import type { MaterialType, MaterialAlloy, MaterialFinish } from "@/components/cad-studio/materials";
import MaterialSphere from "@/components/cad-studio/MaterialSphere";

interface MeshPanelProps {
  meshes: MeshItemData[];
  onSelectMesh: (name: string, multi: boolean) => void;
  onAction: (action: string) => void;
  onApplyMaterial: (matId: string) => void;
}

const ACTION_BTN = "flex items-center justify-center gap-1.5 py-3 px-2 text-[11px] font-bold uppercase tracking-wide cursor-pointer transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-[0.97] bg-muted/40 border border-border text-foreground/80";

const CHIP = "px-2.5 py-1.5 text-[9px] font-mono font-semibold uppercase tracking-[0.1em] cursor-pointer transition-all duration-150 border";
const CHIP_DEFAULT = `${CHIP} text-muted-foreground border-border/50 hover:text-foreground hover:bg-accent/30`;
const CHIP_ACTIVE = `${CHIP} text-foreground bg-accent border-border`;

export default function MeshPanel({ meshes, onSelectMesh, onAction, onApplyMaterial }: MeshPanelProps) {
  const [search, setSearch] = useState("");
  const [materialOpen, setMaterialOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterType, setFilterType] = useState<MaterialType | null>(null);
  const [filterAlloy, setFilterAlloy] = useState<MaterialAlloy | null>(null);
  const [filterFinish, setFilterFinish] = useState<MaterialFinish | null>(null);
  const [matTab, setMatTab] = useState<"metal" | "gemstone">("metal");
  const lastClickedIdx = useRef<number>(-1);

  const selectedMeshes = useMemo(() => meshes.filter(m => m.selected), [meshes]);
  const hasSelection = selectedMeshes.length > 0;

  const totalVerts = useMemo(() => meshes.reduce((s, m) => s + m.verts, 0), [meshes]);
  const filtered = useMemo(
    () => meshes.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())),
    [meshes, search]
  );

  const hasActiveFilters = filterType !== null || filterAlloy !== null || filterFinish !== null;

  const filteredMaterials = useMemo(() => {
    return MATERIAL_LIBRARY.filter(m => {
      if (m.category !== matTab) return false;
      if (matTab === "gemstone") return true;
      if (filterType && m.type !== filterType) return false;
      if (filterAlloy && m.alloy !== filterAlloy) return false;
      if (filterFinish && m.finish !== filterFinish) return false;
      return true;
    });
  }, [matTab, filterType, filterAlloy, filterFinish]);

  const clearFilters = () => {
    setFilterType(null);
    setFilterAlloy(null);
    setFilterFinish(null);
  };

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
    <div className="flex flex-col bg-card border-l border-border h-full">
      {/* ═══ SECTION 1: Materials (fixed top) ═══ */}
      <div className="flex-shrink-0 border-b border-border">
        <button
          onClick={() => setMaterialOpen(!materialOpen)}
          className="w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-accent/20"
        >
          <span className="font-display text-sm tracking-[0.15em] text-foreground uppercase font-bold">Material</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {materialOpen ? "▾" : "▸"} {hasSelection ? `${selectedMeshes.length} sel` : ""}
          </span>
        </button>

        <AnimatePresence>
          {materialOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                {!hasSelection && (
                  <div className="px-3 py-2 font-mono text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20">
                    Select a mesh to assign material
                  </div>
                )}

                {/* Category tabs + filter toggle row */}
                <div className="flex items-center gap-2">
                  <div className="flex gap-0 border border-border flex-1">
                    {(["metal", "gemstone"] as const).map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setMatTab(cat); clearFilters(); }}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-150 ${
                          matTab === cat ? "text-primary-foreground bg-primary" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {cat === "metal" ? "Metals" : "Gems"}
                      </button>
                    ))}
                  </div>
                  {matTab === "metal" && (
                    <button
                      onClick={() => setFiltersOpen(!filtersOpen)}
                      className={`flex items-center gap-1 px-2.5 py-2 text-[9px] font-bold uppercase tracking-wide border transition-colors duration-150 cursor-pointer ${
                        filtersOpen || hasActiveFilters
                          ? "text-foreground bg-accent border-border"
                          : "text-muted-foreground hover:text-foreground border-border/50"
                      }`}
                    >
                      <Filter className="w-3 h-3" />
                      {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </button>
                  )}
                </div>

                {/* Collapsible filters */}
                <AnimatePresence>
                  {filtersOpen && matTab === "metal" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 pb-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground/60">Filters</span>
                          {hasActiveFilters && (
                            <button onClick={clearFilters} className="font-mono text-[8px] text-muted-foreground hover:text-foreground cursor-pointer uppercase tracking-wide">
                              Clear
                            </button>
                          )}
                        </div>
                        <div>
                          <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1 block">Type</span>
                          <div className="flex flex-wrap gap-1">
                            <button onClick={() => setFilterType(null)} className={filterType === null ? CHIP_ACTIVE : CHIP_DEFAULT}>All</button>
                            {MATERIAL_TYPES.map(t => (
                              <button key={t.id} onClick={() => setFilterType(t.id)} className={filterType === t.id ? CHIP_ACTIVE : CHIP_DEFAULT}>{t.label}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1 block">Color</span>
                          <div className="flex flex-wrap gap-1">
                            <button onClick={() => setFilterAlloy(null)} className={filterAlloy === null ? CHIP_ACTIVE : CHIP_DEFAULT}>All</button>
                            {MATERIAL_ALLOYS.map(a => (
                              <button key={a.id} onClick={() => setFilterAlloy(a.id)} className={filterAlloy === a.id ? CHIP_ACTIVE : CHIP_DEFAULT}>{a.label}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1 block">Finish</span>
                          <div className="flex flex-wrap gap-1">
                            <button onClick={() => setFilterFinish(null)} className={filterFinish === null ? CHIP_ACTIVE : CHIP_DEFAULT}>All</button>
                            {MATERIAL_FINISHES.map(f => (
                              <button key={f.id} onClick={() => setFilterFinish(f.id)} className={filterFinish === f.id ? CHIP_ACTIVE : CHIP_DEFAULT}>{f.label}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Material swatch grid — primary focus */}
                <div className="grid grid-cols-3 gap-1.5 max-h-[200px] overflow-y-auto scrollbar-thin">
                  {filteredMaterials.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onApplyMaterial(m.id)}
                      disabled={!hasSelection}
                      className="py-2 px-1.5 text-center cursor-pointer transition-all duration-200 hover:bg-accent/50 hover:text-foreground active:scale-[0.97] bg-muted/20 border border-border/50 disabled:opacity-30 disabled:cursor-not-allowed group"
                    >
                      <div className="flex justify-center mb-1">
                        <MaterialSphere category={m.category} preview={m.preview} size={24} />
                      </div>
                      <div className="text-[8px] truncate font-mono font-semibold text-muted-foreground group-hover:text-foreground leading-tight">{m.name}</div>
                    </button>
                  ))}
                  {filteredMaterials.length === 0 && (
                    <div className="col-span-3 text-center font-mono text-[10px] text-muted-foreground/50 py-4">
                      No materials match
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ SECTION 2: Meshes header + scrollable list ═══ */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display text-sm tracking-[0.15em] text-foreground uppercase font-bold">Meshes</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {meshes.length > 0 ? `${meshes.length} · ${totalVerts.toLocaleString()}v` : "—"}
          </span>
        </div>
        <input
          type="text"
          placeholder="Search meshes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-ring font-body bg-muted/30 border border-border"
        />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-1 scrollbar-thin">
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

      {/* ═══ SECTION 3: Mesh actions (fixed footer) ═══ */}
      <div className="px-3 py-3 border-t border-border flex-shrink-0 bg-card">
        <div className="grid grid-cols-3 gap-1.5 mb-1.5">
          <button onClick={() => onAction("hide")} className={ACTION_BTN}>
            <EyeOff className="w-3.5 h-3.5" /> Hide
          </button>
          <button onClick={() => onAction("show")} className={ACTION_BTN}>
            <Eye className="w-3.5 h-3.5" /> Show
          </button>
          <button onClick={() => onAction("show-all")} className={ACTION_BTN}>
            <Layers className="w-3.5 h-3.5" /> All
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => onAction("isolate")} className={ACTION_BTN}>
            <Focus className="w-3.5 h-3.5" /> Isolate
          </button>
          <button onClick={() => onAction("select-invert")} className={ACTION_BTN}>
            <Shuffle className="w-3.5 h-3.5" /> Invert
          </button>
        </div>
      </div>
    </div>
  );
}
