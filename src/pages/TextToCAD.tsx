import { useState, useCallback } from "react";
import { toast } from "sonner";
import LeftPanel from "@/components/text-to-cad/LeftPanel";
import EditToolbar from "@/components/text-to-cad/EditToolbar";
import MeshPanel from "@/components/text-to-cad/MeshPanel";
import CADCanvas from "@/components/text-to-cad/CADCanvas";
import {
  ViewportToolbar,
  PartRegenBar,
  ProgressOverlay,
  StatsBar,
  ActionButtons,
} from "@/components/text-to-cad/ViewportOverlays";
import { PROGRESS_STEPS } from "@/components/text-to-cad/types";
import type { MeshItemData, StatsData } from "@/components/text-to-cad/types";

// Demo mesh data (populated after generation)
const DEMO_MESHES: MeshItemData[] = [
  { name: "Band_Main", verts: 1240, faces: 2400, visible: true, selected: false },
  { name: "Band_Inner", verts: 620, faces: 1200, visible: true, selected: false },
  { name: "Prong_0", verts: 578, faces: 1152, visible: true, selected: false },
  { name: "Prong_1", verts: 578, faces: 1152, visible: true, selected: false },
  { name: "Prong_2", verts: 578, faces: 1152, visible: true, selected: false },
  { name: "Prong_3", verts: 578, faces: 1152, visible: true, selected: false },
  { name: "Stone_Center", verts: 2048, faces: 4096, visible: true, selected: false },
  { name: "Stone_Side_0", verts: 128, faces: 256, visible: true, selected: false },
  { name: "Stone_Side_1", verts: 128, faces: 256, visible: true, selected: false },
];

export default function TextToCAD() {
  const [model, setModel] = useState("gemini");
  const [prompt, setPrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [refImage, setRefImage] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasModel, setHasModel] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState("");
  const [transformMode, setTransformMode] = useState("orbit");
  const [showPartRegen, setShowPartRegen] = useState(false);
  const [meshes, setMeshes] = useState<MeshItemData[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [stats, setStats] = useState<StatsData>({ meshes: 0, sizeKB: 0, timeSec: 0 });

  const toggleModule = (mod: string) => {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const simulateGeneration = useCallback(async () => {
    if (!prompt.trim()) { toast.error("Please describe your ring first"); return; }
    setIsGenerating(true);
    setProgress(0);
    setHasModel(false);
    for (let i = 0; i < PROGRESS_STEPS.length; i++) {
      setProgressStep(PROGRESS_STEPS[i]);
      const target = Math.round(((i + 1) / PROGRESS_STEPS.length) * 100);
      for (let p = Math.round((i / PROGRESS_STEPS.length) * 100); p <= target; p += 2) {
        setProgress(p);
        await new Promise((r) => setTimeout(r, 60));
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    setProgress(100);
    setIsGenerating(false);
    setHasModel(true);
    setShowPartRegen(true);
    setMeshes(DEMO_MESHES);
    setModules(["Band", "Prongs", "Gems", "Setting"]);
    setStats({ meshes: 9, sizeKB: 384, timeSec: 12 });
    toast.success("Ring generated successfully");
  }, [prompt]);

  const simulateEdit = useCallback(async () => {
    if (!editPrompt.trim()) { toast.error("Please describe the edit"); return; }
    setIsEditing(true);
    setIsGenerating(true);
    setProgress(0);
    setProgressStep("Applying edits…");
    for (let p = 0; p <= 100; p += 3) {
      setProgress(p);
      await new Promise((r) => setTimeout(r, 50));
    }
    setProgress(100);
    setIsGenerating(false);
    setIsEditing(false);
    setEditPrompt("");
    toast.success("Edit applied");
  }, [editPrompt]);

  const handleQuickEdit = useCallback((preset: string) => {
    setEditPrompt(preset);
  }, []);

  const handleReset = () => {
    setPrompt("");
    setEditPrompt("");
    setRefImage(null);
    setSelectedModules([]);
    setHasModel(false);
    setProgress(0);
    setProgressStep("");
    setShowPartRegen(false);
    setMeshes([]);
    setModules([]);
  };

  const handleSelectMesh = (name: string, multi: boolean) => {
    setMeshes((prev) =>
      prev.map((m) =>
        m.name === name
          ? { ...m, selected: multi ? !m.selected : true }
          : multi ? m : { ...m, selected: false }
      )
    );
  };

  const handleMeshAction = (action: string) => {
    setMeshes((prev) => {
      switch (action) {
        case "hide": return prev.map((m) => m.selected ? { ...m, visible: false } : m);
        case "show": return prev.map((m) => m.selected ? { ...m, visible: true } : m);
        case "show-all": return prev.map((m) => ({ ...m, visible: true }));
        case "isolate": return prev.map((m) => ({ ...m, visible: m.selected }));
        case "select-all": return prev.map((m) => ({ ...m, selected: true }));
        case "select-none": return prev.map((m) => ({ ...m, selected: false }));
        case "select-invert": return prev.map((m) => ({ ...m, selected: !m.selected }));
        default: return prev;
      }
    });
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden" style={{ background: "#0d0d0d" }}>
      {/* Left Panel */}
      <LeftPanel
        model={model} setModel={setModel}
        prompt={prompt} setPrompt={setPrompt}
        editPrompt={editPrompt} setEditPrompt={setEditPrompt}
        refImage={refImage} setRefImage={setRefImage}
        selectedModules={selectedModules} toggleModule={toggleModule}
        isGenerating={isGenerating} isEditing={isEditing}
        hasModel={hasModel} modules={modules}
        onGenerate={simulateGeneration}
        onEdit={simulateEdit}
        onQuickEdit={handleQuickEdit}
        onMagicTexture={() => toast.info("Magic Texturing coming soon")}
      />

      {/* Viewport */}
      <div className="flex-1 relative" style={{ background: "#111" }}>
        {/* 3D Canvas */}
        <CADCanvas hasModel={hasModel} />

        {/* Overlays */}
        <EditToolbar onApplyMaterial={(preset) => toast.info(`Applied ${preset}`)} />
        <ViewportToolbar mode={transformMode} setMode={setTransformMode} />
        <PartRegenBar visible={showPartRegen} onClose={() => setShowPartRegen(false)} />
        <ProgressOverlay visible={isGenerating} progress={progress} currentStep={progressStep} />
        <StatsBar visible={hasModel && !isGenerating} stats={stats} />
        <ActionButtons visible={hasModel && !isGenerating} onReset={handleReset} />
      </div>

      {/* Right Mesh Panel */}
      <MeshPanel
        meshes={meshes}
        onSelectMesh={handleSelectMesh}
        onAction={handleMeshAction}
      />
    </div>
  );
}
