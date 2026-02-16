import { useState } from "react";
import { ChevronDown, ChevronRight, Sparkles, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MeshItem {
  name: string;
  verts: number;
  faces: number;
}

const MESH_GROUPS: { group: string; items: MeshItem[] }[] = [
  {
    group: "Prong",
    items: [
      { name: "Prong_Center_0", verts: 578, faces: 1152 },
      { name: "Prong_Center_1", verts: 578, faces: 1152 },
      { name: "Prong_Center_2", verts: 578, faces: 1152 },
      { name: "Prong_Center_3", verts: 578, faces: 1152 },
    ],
  },
  {
    group: "Bead",
    items: [
      { name: "Bead_0.0", verts: 42, faces: 80 },
      { name: "Bead_0.1", verts: 42, faces: 80 },
      { name: "Bead_1.0", verts: 42, faces: 80 },
      { name: "Bead_1.1", verts: 42, faces: 80 },
      { name: "Bead_2.0", verts: 42, faces: 80 },
      { name: "Bead_2.1", verts: 42, faces: 80 },
    ],
  },
  {
    group: "Band",
    items: [
      { name: "Band_Main", verts: 1240, faces: 2400 },
      { name: "Band_Inner", verts: 620, faces: 1200 },
    ],
  },
  {
    group: "Stone",
    items: [
      { name: "Stone_Center", verts: 2048, faces: 4096 },
      { name: "Stone_Side_0", verts: 128, faces: 256 },
      { name: "Stone_Side_1", verts: 128, faces: 256 },
    ],
  },
];

const totalMeshes = MESH_GROUPS.reduce((s, g) => s + g.items.length, 0);
const totalVerts = MESH_GROUPS.reduce(
  (s, g) => s + g.items.reduce((ss, i) => ss + i.verts, 0),
  0
);

export default function MeshLibrary() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Prong: true });
  const [generating, setGenerating] = useState<string | null>(null);

  const toggle = (group: string) =>
    setExpanded((prev) => ({ ...prev, [group]: !prev[group] }));

  const handleGenerate = (name: string) => {
    setGenerating(name);
    setTimeout(() => setGenerating(null), 2000);
  };

  const filtered = MESH_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) =>
      i.name.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="w-[260px] flex-shrink-0 flex flex-col border-l border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/20">
        <h3 className="text-[10px] font-bold uppercase tracking-[3px] text-foreground">
          Meshes
        </h3>
        <p className="text-[9px] text-muted-foreground mt-0.5">
          {totalMeshes} meshes | {totalVerts.toLocaleString()} vertices
        </p>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border/10">
        <input
          type="text"
          placeholder="Search meshes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs bg-muted/20 border border-border/20 rounded-md px-3 py-1.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30"
        />
      </div>

      {/* Mesh list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.map((group) => (
          <div key={group.group}>
            {/* Group header */}
            <button
              onClick={() => toggle(group.group)}
              className="flex items-center gap-1.5 w-full px-3 py-2 text-left hover:bg-muted/10 transition-colors"
            >
              {expanded[group.group] ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-[2px] text-foreground">
                {group.group}
              </span>
              <span className="text-[9px] text-muted-foreground/50 ml-auto">
                {group.items.length}
              </span>
            </button>

            {/* Items */}
            {expanded[group.group] &&
              group.items.map((item) => (
                <div
                  key={item.name}
                  className="group px-4 py-1.5 hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-foreground/90">
                        {item.name}
                      </p>
                      <p className="text-[9px] text-muted-foreground/50">
                        {item.verts} verts / {item.faces} faces
                      </p>
                    </div>
                    <button
                      onClick={() => handleGenerate(item.name)}
                      className={cn(
                        "opacity-0 group-hover:opacity-100 transition-opacity",
                        "w-6 h-6 rounded flex items-center justify-center",
                        generating === item.name
                          ? "text-primary animate-pulse"
                          : "text-foreground/60 hover:text-primary hover:bg-primary/10"
                      )}
                      title="Regenerate this part"
                    >
                      <Sparkles className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* Actions footer */}
      <div className="px-3 py-2.5 border-t border-border/20 space-y-1.5">
        <p className="text-[9px] font-bold uppercase tracking-[2px] text-primary/70 mb-1">
          Mesh Actions
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {["Hide", "Show", "Show All", "Isolate"].map((action) => (
            <button
              key={action}
              className="text-[9px] font-medium py-1.5 rounded border border-border/20 text-muted-foreground hover:text-foreground hover:border-border/40 transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
        <p className="text-[9px] font-bold uppercase tracking-[2px] text-primary/70 mt-2 mb-1">
          Selection
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {["All", "None", "Invert"].map((action) => (
            <button
              key={action}
              className="text-[9px] font-medium py-1.5 rounded border border-border/20 text-muted-foreground hover:text-foreground hover:border-border/40 transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
