import { useState, useMemo, useRef, useCallback } from "react";

import { Eye, EyeOff, Focus, Shuffle, Layers, Trash2, Copy, Crosshair, FlipVertical, RefreshCw, ChevronUp, ChevronDown, Users } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { MeshItemData } from "./types";
import { MATERIAL_LIBRARY } from "@/components/cad-studio/materials";
import MaterialSphere from "@/components/cad-studio/MaterialSphere";

interface MeshPanelProps {
  meshes: MeshItemData[];
  onSelectMesh: (name: string, multi: boolean) => void;
  onAction: (action: string) => void;
  onApplyMaterial: (matId: string) => void;
  onSceneAction: (action: string) => void;
}

const ACTION_BTN = "flex items-center justify-center gap-1.5 py-3 px-2 text-[11px] font-bold uppercase tracking-wide cursor-pointer transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-[0.97] bg-muted/40 border border-border text-foreground/80";

export default function MeshPanel({ meshes, onSelectMesh, onAction, onApplyMaterial, onSceneAction }: MeshPanelProps) {
  const [search, setSearch] = useState("");
  const [matTab, setMatTab] = useState<"metal" | "gemstone">("metal");
  const [meshTab, setMeshTab] = useState<"list" | "actions">("list");
  const [meshCollapsed, setMeshCollapsed] = useState(false);
  const [materialCollapsed, setMaterialCollapsed] = useState(false);
  const lastClickedIdx = useRef<number>(-1);

  const selectedMeshes = useMemo(() => meshes.filter(m => m.selected), [meshes]);
  const hasSelection = selectedMeshes.length > 0;

  const totalVerts = useMemo(() => meshes.reduce((s, m) => s + m.verts, 0), [meshes]);
  const filtered = useMemo(
    () => meshes.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())),
    [meshes, search]
  );

  const filteredMaterials = useMemo(() => {
    return MATERIAL_LIBRARY.filter(m => m.category === matTab);
  }, [matTab]);

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

  // Both collapsed — show both headers stacked
  if (materialCollapsed && meshCollapsed) {
    return (
      <div className="flex flex-col bg-card border-l border-border h-full">
        <SectionHeader
          title="Material"
          subtitle={hasSelection ? `${selectedMeshes.length} sel` : ""}
          collapsed={true}
          onToggle={() => setMaterialCollapsed(false)}
        />
        <SectionHeader
          title="Meshes"
          subtitle={meshes.length > 0 ? `${meshes.length} · ${totalVerts.toLocaleString()}v` : "—"}
          collapsed={true}
          onToggle={() => setMeshCollapsed(false)}
        />
        <div className="flex-1" />
      </div>
    );
  }

  // One collapsed — show collapsed header + expanded section fills rest
  if (materialCollapsed) {
    return (
      <div className="flex flex-col bg-card border-l border-border h-full">
        <SectionHeader
          title="Material"
          subtitle={hasSelection ? `${selectedMeshes.length} sel` : ""}
          collapsed={true}
          onToggle={() => setMaterialCollapsed(false)}
        />
        <div className="flex-1 flex flex-col min-h-0 border-t border-border">
          <MeshSectionHeader
            title="Meshes"
            subtitle={meshes.length > 0 ? `${meshes.length} · ${totalVerts.toLocaleString()}v` : "—"}
            collapsed={false}
            onToggle={() => setMeshCollapsed(true)}
            meshTab={meshTab}
            setMeshTab={setMeshTab}
          />
          <MeshContent
            meshTab={meshTab}
            search={search}
            setSearch={setSearch}
            filtered={filtered}
            meshes={meshes}
            hasSelection={hasSelection}
            selectedMeshes={selectedMeshes}
            handleMeshClick={handleMeshClick}
            onAction={onAction}
            onSceneAction={onSceneAction}
          />
        </div>
      </div>
    );
  }

  if (meshCollapsed) {
    return (
      <div className="flex flex-col bg-card border-l border-border h-full">
        <div className="flex-1 flex flex-col min-h-0">
          <MaterialSectionHeader
            collapsed={false}
            onToggle={() => setMaterialCollapsed(true)}
            hasSelection={hasSelection}
            selectedMeshes={selectedMeshes}
          />
          <MaterialContent
            hasSelection={hasSelection}
            matTab={matTab}
            setMatTab={setMatTab}
            filteredMaterials={filteredMaterials}
            onApplyMaterial={onApplyMaterial}
          />
        </div>
        <SectionHeader
          title="Meshes"
          subtitle={meshes.length > 0 ? `${meshes.length} · ${totalVerts.toLocaleString()}v` : "—"}
          collapsed={true}
          onToggle={() => setMeshCollapsed(false)}
        />
      </div>
    );
  }

  // Both expanded — resizable split
  return (
    <div className="flex flex-col bg-card border-l border-border h-full">
      <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
        {/* Material panel */}
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="flex flex-col h-full">
            <MaterialSectionHeader
              collapsed={false}
              onToggle={() => setMaterialCollapsed(true)}
              hasSelection={hasSelection}
              selectedMeshes={selectedMeshes}
            />
            <MaterialContent
              hasSelection={hasSelection}
              matTab={matTab}
              setMatTab={setMatTab}
              filteredMaterials={filteredMaterials}
              onApplyMaterial={onApplyMaterial}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Mesh panel */}
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="flex flex-col h-full">
            <MeshSectionHeader
              title="Meshes"
              subtitle={meshes.length > 0 ? `${meshes.length} · ${totalVerts.toLocaleString()}v` : "—"}
              collapsed={false}
              onToggle={() => setMeshCollapsed(true)}
              meshTab={meshTab}
              setMeshTab={setMeshTab}
            />
            <MeshContent
              meshTab={meshTab}
              search={search}
              setSearch={setSearch}
              filtered={filtered}
              meshes={meshes}
              hasSelection={hasSelection}
              selectedMeshes={selectedMeshes}
              handleMeshClick={handleMeshClick}
              onAction={onAction}
              onSceneAction={onSceneAction}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

// ── Collapsed section header ──
function SectionHeader({ title, subtitle, collapsed, onToggle }: {
  title: string; subtitle: string; collapsed: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-accent/20 border-b border-border flex-shrink-0"
    >
      <span className="font-display text-sm tracking-[0.15em] text-foreground uppercase font-bold">{title}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{subtitle}</span>
        {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
      </span>
    </button>
  );
}

// ── Material section header ──
function MaterialSectionHeader({ collapsed, onToggle, hasSelection, selectedMeshes }: {
  collapsed: boolean; onToggle: () => void; hasSelection: boolean; selectedMeshes: MeshItemData[];
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-accent/20 border-b border-border flex-shrink-0"
    >
      <span className="font-display text-sm tracking-[0.15em] text-foreground uppercase font-bold">Material</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          {hasSelection ? `${selectedMeshes.length} sel` : ""}
        </span>
        {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
      </span>
    </button>
  );
}

// ── Material content (scrollable) ──
function MaterialContent({ hasSelection, matTab, setMatTab, filteredMaterials, onApplyMaterial }: {
  hasSelection: boolean;
  matTab: "metal" | "gemstone"; setMatTab: (t: "metal" | "gemstone") => void;
  filteredMaterials: typeof MATERIAL_LIBRARY;
  onApplyMaterial: (matId: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-3 pt-3 space-y-3 scrollbar-thin">
      {!hasSelection && (
        <div className="px-3 py-2 font-mono text-[10px] text-muted-foreground bg-muted/40 border border-border">
          Select a mesh to assign material
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-0 border border-border">
        {(["metal", "gemstone"] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setMatTab(cat)}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-150 ${
              matTab === cat ? "text-primary-foreground bg-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat === "metal" ? "Metals" : "Gems"}
          </button>
        ))}
      </div>

      {/* Material swatch grid */}
      <div className="grid grid-cols-3 gap-1.5">
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
  );
}

// ── Mesh section header with tabs ──
function MeshSectionHeader({ title, subtitle, collapsed, onToggle, meshTab, setMeshTab }: {
  title: string; subtitle: string; collapsed: boolean; onToggle: () => void;
  meshTab: "list" | "actions"; setMeshTab: (t: "list" | "actions") => void;
}) {
  return (
    <div className="flex-shrink-0 border-b border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-accent/20"
      >
        <span className="font-display text-sm tracking-[0.15em] text-foreground uppercase font-bold">{title}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">{subtitle}</span>
          {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
        </span>
      </button>
      <div className="flex gap-0 mx-4 mb-2 border border-border">
        {(["list", "actions"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setMeshTab(tab)}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-150 cursor-pointer ${
              meshTab === tab ? "text-primary-foreground bg-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "list" ? "List" : "Actions"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Mesh content (scrollable) ──
function MeshContent({ meshTab, search, setSearch, filtered, meshes, hasSelection, selectedMeshes, handleMeshClick, onAction, onSceneAction }: {
  meshTab: "list" | "actions";
  search: string; setSearch: (v: string) => void;
  filtered: MeshItemData[];
  meshes: MeshItemData[];
  hasSelection: boolean;
  selectedMeshes: MeshItemData[];
  handleMeshClick: (mesh: MeshItemData, e: React.MouseEvent) => void;
  onAction: (action: string) => void;
  onSceneAction: (action: string) => void;
}) {
  if (meshTab === "list") {
    // Detect mesh families by common prefix (e.g. "rib_001", "rib_002" → family "rib")
    const families = useMemo(() => {
      const familyMap = new Map<string, string[]>();
      filtered.forEach((m) => {
        // Strip trailing _number, _copy, _copy_N patterns to get family prefix
        const prefix = m.name.replace(/(_copy)?(_\d+)?$/, '').replace(/_\d+$/, '');
        if (!familyMap.has(prefix)) familyMap.set(prefix, []);
        familyMap.get(prefix)!.push(m.name);
      });
      // Only return families with 2+ members
      return new Map([...familyMap].filter(([_, names]) => names.length >= 2));
    }, [filtered]);

    const handleSelectFamily = useCallback((familyNames: string[]) => {
      familyNames.forEach((name) => {
        if (!meshes.find(m => m.name === name)?.selected) {
          onSelectMesh(name, true);
        }
      });
    }, [meshes, onSelectMesh]);

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <input
            type="text"
            placeholder="Search meshes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-ring font-body bg-muted/30 border border-border"
          />
        </div>

        {/* Family quick-select buttons */}
        {families.size > 0 && (
          <div className="px-4 pb-2 flex-shrink-0">
            <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-1.5 block">Families</span>
            <div className="flex flex-wrap gap-1">
              {[...families.entries()].map(([prefix, names]) => (
                <button
                  key={prefix}
                  onClick={() => handleSelectFamily(names)}
                  className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-border/50 transition-colors cursor-pointer"
                  title={`Select all ${names.length} "${prefix}" meshes`}
                >
                  <Users className="w-2.5 h-2.5" />
                  {prefix} <span className="text-muted-foreground/50">({names.length})</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-4 scrollbar-thin">
      <div className="px-3 py-2 font-mono text-[10px] border border-border bg-muted/20 text-muted-foreground">
        {hasSelection
          ? `${selectedMeshes.length} mesh${selectedMeshes.length > 1 ? "es" : ""} selected`
          : "No mesh selected — select from the List tab"}
      </div>

      <div>
        <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">Visibility</span>
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

      <div>
        <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">Edit</span>
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          <button onClick={() => onSceneAction("duplicate")} className={ACTION_BTN}>
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <button onClick={() => onSceneAction("delete")} className={`${ACTION_BTN} hover:bg-destructive/20 hover:text-destructive hover:border-destructive/40`}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => onSceneAction("center-origin")} className={ACTION_BTN}>
            <Crosshair className="w-3.5 h-3.5" /> Origin
          </button>
          <button onClick={() => onSceneAction("flip-normals")} className={ACTION_BTN}>
            <FlipVertical className="w-3.5 h-3.5" /> Flip N
          </button>
        </div>
      </div>
    </div>
  );
}
