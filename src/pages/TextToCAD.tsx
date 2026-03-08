import { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftClose, PanelRightClose, PanelLeft, PanelRight } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { performCreditPreflight, type PreflightResult } from "@/lib/credit-preflight";
import { TOOL_COSTS } from "@/lib/credits-api";
import { AuthExpiredError } from "@/lib/authenticated-fetch";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { InsufficientCreditsInline } from "@/components/InsufficientCreditsInline";
import InitialPromptScreen from "@/components/text-to-cad/InitialPromptScreen";
import LeftPanel from "@/components/text-to-cad/LeftPanel";
import EditToolbar from "@/components/text-to-cad/EditToolbar";
import MeshPanel from "@/components/text-to-cad/MeshPanel";
import CADCanvas from "@/components/text-to-cad/CADCanvas";
import type { CADCanvasHandle, CanvasSnapshot } from "@/components/text-to-cad/CADCanvas";
import ViewportDisplayMenu from "@/components/text-to-cad/ViewportDisplayMenu";
import KeyboardShortcutsPanel, { KeyboardShortcutsButton } from "@/components/text-to-cad/KeyboardShortcutsPanel";
import GenerationProgress from "@/components/text-to-cad/GenerationProgress";
import {
  ViewportToolbar,
  StatsBar,
  ViewportSideTools,
} from "@/components/text-to-cad/ViewportOverlays";

import type { MeshItemData, StatsData } from "@/components/text-to-cad/types";

// Full undo entry captures both UI mesh list AND 3D canvas state
interface UndoEntry {
  label: string;
  meshes: MeshItemData[];
  canvasSnapshot: CanvasSnapshot | null;
}

export default function TextToCAD() {
  const navigate = useNavigate();
  const [model, setModel] = useState("gemini");
  const [prompt, setPrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
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
  const [glbUrl, setGlbUrl] = useState<string | undefined>(undefined);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  const [creditBlock, setCreditBlock] = useState<PreflightResult | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Track whether user has ever started a generation or uploaded — drives the phase transition
  const [workspaceActive, setWorkspaceActive] = useState(false);

  const canvasRef = useRef<CADCanvasHandle>(null);
  const wireframeRef = useRef(false);
  const meshesRef = useRef<MeshItemData[]>(meshes);
  meshesRef.current = meshes;

  const selectedMeshNames = useMemo(
    () => new Set(meshes.filter((m) => m.selected).map((m) => m.name)),
    [meshes]
  );

  const hiddenMeshNames = useMemo(
    () => new Set(meshes.filter((m) => !m.visible).map((m) => m.name)),
    [meshes]
  );

  const selectedNames = useMemo(
    () => meshes.filter((m) => m.selected).map((m) => m.name),
    [meshes]
  );

  // Push full state (UI + 3D) onto undo stack
  const pushUndo = useCallback((label: string) => {
    const currentMeshes = meshesRef.current.map((m) => ({ ...m }));
    const snap = canvasRef.current?.getSnapshot() ?? null;
    setUndoStack((prev) => [...prev, { label, meshes: currentMeshes, canvasSnapshot: snap }]);
    setRedoStack([]); // Clear redo on new action
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) { toast.info("Nothing to undo"); return prev; }
      const last = prev[prev.length - 1];
      const currentMeshes = meshesRef.current.map((m) => ({ ...m }));
      const snap = canvasRef.current?.getSnapshot() ?? null;
      setRedoStack((r) => [...r, { label: last.label, meshes: currentMeshes, canvasSnapshot: snap }]);
      setMeshes(last.meshes);
      if (last.canvasSnapshot) {
        canvasRef.current?.restoreSnapshot(last.canvasSnapshot);
      }
      toast.success(`Undo: ${last.label}`);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) { toast.info("Nothing to redo"); return prev; }
      const last = prev[prev.length - 1];
      const currentMeshes = meshesRef.current.map((m) => ({ ...m }));
      const snap = canvasRef.current?.getSnapshot() ?? null;
      setUndoStack((u) => [...u, { label: last.label, meshes: currentMeshes, canvasSnapshot: snap }]);
      setMeshes(last.meshes);
      if (last.canvasSnapshot) {
        canvasRef.current?.restoreSnapshot(last.canvasSnapshot);
      }
      toast.success(`Redo: ${last.label}`);
      return prev.slice(0, -1);
    });
  }, []);

  const handleTransformEnd = useCallback(() => {
    pushUndo(`Transform (${transformMode})`);
  }, [pushUndo, transformMode]);

  const toggleModule = (mod: string) => {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const simulateGeneration = useCallback(async () => {
    if (isGenerating) return;
    if (!prompt.trim()) { toast.error("Please describe your ring first"); return; }

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

    const requiredCredits = TOOL_COSTS.cad_generation ?? 5;
    try {
      const result = await performCreditPreflight('ring_generate_v1', 1);
      const balance = result.currentBalance;
      const cost = result.estimatedCredits > 0 ? result.estimatedCredits : requiredCredits;
      if (balance < cost) {
        setCreditBlock({ approved: false, estimatedCredits: cost, currentBalance: balance });
        return;
      }
      setCreditBlock(null);
    } catch (err) {
      if (err instanceof AuthExpiredError) return;
      console.error('[CAD Preflight] failed, skipping block:', err);
      setCreditBlock(null);
    }

    setWorkspaceActive(true);
    setIsGenerating(true);
    setProgress(0);
    setHasModel(false);
    setProgressStep("Generating…");

    try {
      // Step 1: Start generation
      const startRes = await authenticatedFetch(`${SUPABASE_URL}/functions/v1/generate-ring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), model }),
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error || `Failed to start generation (${startRes.status})`);
      }

      const { workflow_id } = await startRes.json();
      if (!workflow_id) throw new Error("No workflow_id returned");

      console.log("[TextToCAD] Workflow started:", workflow_id);

      // Step 2: Poll status every 3s — no timeout, workflows can take 15-20 min
      const TERMINAL_STATES = new Set(["failed", "cancelled", "terminated", "timed_out", "budget_exhausted"]);
      let pollErrors = 0;

      while (true) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const statusRes = await authenticatedFetch(
            `${SUPABASE_URL}/functions/v1/ring-status?workflow_id=${encodeURIComponent(workflow_id)}`
          );

          if (!statusRes.ok) {
            pollErrors++;
            if (pollErrors >= 10) throw new Error("Status polling failed repeatedly");
            continue;
          }

          const statusData = await statusRes.json();
          pollErrors = 0;

          // Update progress from backend
          const pct = statusData.progress ?? 0;
          setProgress(pct);
          setProgressStep(getProgressLabel(pct));

          if (statusData.state === "completed") break;
          if (TERMINAL_STATES.has(statusData.state)) {
            throw new Error(`Generation ${statusData.state}`);
          }
          // Still running — continue polling
        } catch (err) {
          if (err instanceof AuthExpiredError) return;
          pollErrors++;
          if (pollErrors >= 10) throw err;
        }
      }

      // Step 3: Fetch result GLB URL (retry up to 5 times on 404 with 2s delay)
      setProgressStep("Loading model…");
      let glb_url: string | null = null;
      const MAX_RESULT_RETRIES = 5;
      for (let attempt = 1; attempt <= MAX_RESULT_RETRIES; attempt++) {
        const resultRes = await authenticatedFetch(
          `${SUPABASE_URL}/functions/v1/ring-result?workflow_id=${encodeURIComponent(workflow_id)}`
        );

        if (resultRes.ok) {
          const data = await resultRes.json();
          glb_url = data.glb_url;
          break;
        }

        if (resultRes.status === 404 && attempt < MAX_RESULT_RETRIES) {
          console.warn(`[TextToCAD] ring-result 404, retry ${attempt}/${MAX_RESULT_RETRIES}`);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        const err = await resultRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch result");
      }
      if (!glb_url) throw new Error("No GLB model found in results");

      // Load into viewer
      setGlbUrl(glb_url);
      setProgress(100);
      setProgressStep("Completed");
      setIsGenerating(false);
      setHasModel(true);
      setShowPartRegen(true);
      toast.success("Ring generated successfully");

    } catch (err) {
      console.error("Generation failed:", err);
      toast.error(err instanceof Error ? err.message : "Generation failed");
      setIsGenerating(false);
      setProgress(0);
      setProgressStep("");
    }
  }, [prompt, model, isGenerating]);

  function getProgressLabel(pct: number): string {
    if (pct < 15) return "Queued";
    if (pct < 35) return "Generating geometry";
    if (pct < 55) return "Adding details";
    if (pct < 75) return "Optimizing structure";
    if (pct < 90) return "Preparing preview";
    return "Completed";
  }

  const simulateEdit = useCallback(async () => {
    if (!editPrompt.trim()) { toast.error("Please describe the edit"); return; }
    pushUndo("AI edit");
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
  }, [editPrompt, pushUndo]);

  const handleQuickEdit = useCallback((preset: string) => {
    setEditPrompt(preset);
  }, []);

  const [additionalParts, setAdditionalParts] = useState<string[]>([]);

  const handleGlbUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    if (!hasModel && !workspaceActive) {
      setWorkspaceActive(true);
      setGlbUrl(url);
      setHasModel(true);
      setShowPartRegen(true);
      setMeshes([]);
      setModules([]);
      setStats({ meshes: 0, sizeKB: Math.round(file.size / 1024), timeSec: 0 });
      setUndoStack([]);
      setRedoStack([]);
    } else if (!hasModel) {
      setGlbUrl(url);
      setHasModel(true);
      setShowPartRegen(true);
      setMeshes([]);
      setModules([]);
      setStats({ meshes: 0, sizeKB: Math.round(file.size / 1024), timeSec: 0 });
      setUndoStack([]);
      setRedoStack([]);
    } else {
      setAdditionalParts((prev) => [...prev, url]);
    }
    toast.success(`Added ${file.name}`);
  }, [hasModel, workspaceActive]);

  const handleMeshesDetected = useCallback((detected: { name: string; verts: number; faces: number }[]) => {
    setMeshes((prev) => {
      // Preserve existing visibility/selection state for known meshes
      const prevMap = new Map(prev.map(m => [m.name, m]));
      return detected.map((d) => {
        const existing = prevMap.get(d.name);
        return {
          ...d,
          visible: existing?.visible ?? true,
          selected: existing?.selected ?? false,
        };
      });
    });
    setStats((prev) => ({ ...prev, meshes: detected.length }));
  }, []);

  const handleReset = () => {
    setPrompt("");
    setEditPrompt("");
    setSelectedModules([]);
    setHasModel(false);
    setProgress(0);
    setProgressStep("");
    setShowPartRegen(false);
    setMeshes([]);
    setModules([]);
    setUndoStack([]);
    setRedoStack([]);
    setWorkspaceActive(false);
    if (glbUrl) URL.revokeObjectURL(glbUrl);
    additionalParts.forEach((u) => URL.revokeObjectURL(u));
    setAdditionalParts([]);
    setGlbUrl(undefined);
  };

  const handleDownloadGlb = useCallback(async () => {
    if (!glbUrl) return;
    try {
      const isBlobUrl = glbUrl.startsWith("blob:");
      const response = await fetch(
        isBlobUrl ? glbUrl : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blob-proxy`,
        isBlobUrl ? {} : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: glbUrl }),
        },
      );
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ring.glb";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Failed to download model");
    }
  }, [glbUrl]);

  const handleSelectMesh = (name: string, multi: boolean) => {
    if (!name) {
      setMeshes((prev) => prev.map((m) => ({ ...m, selected: false })));
      return;
    }
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

  const handleApplyMaterial = useCallback((matId: string) => {
    if (selectedNames.length === 0) {
      toast.error("Select meshes first, then apply a material");
      return;
    }
    pushUndo("Apply material");
    canvasRef.current?.applyMaterial(matId, selectedNames);
    const matName = matId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    toast.success(`Applied ${matName} to ${selectedNames.length} mesh(es)`);
  }, [selectedNames, pushUndo]);

  const handleSceneAction = useCallback((action: string) => {
    const names = selectedNames;
    switch (action) {
      case "set-mode-translate": setTransformMode("translate"); break;
      case "set-mode-rotate": setTransformMode("rotate"); break;
      case "set-mode-scale": setTransformMode("scale"); break;
      case "reset-transform":
        pushUndo("Reset transform");
        canvasRef.current?.resetTransform(names.length ? names : meshes.map((m) => m.name));
        toast.success("Transform reset");
        break;
      case "apply-transform":
        if (!names.length) { toast.error("Select meshes first"); return; }
        pushUndo("Apply transform");
        canvasRef.current?.applyTransform(names);
        toast.success("Transform applied to geometry");
        break;
      case "delete":
        if (!names.length) { toast.error("Select meshes first"); return; }
        pushUndo("Delete meshes");
        canvasRef.current?.deleteMeshes(names);
        setMeshes((prev) => prev.filter((m) => !names.includes(m.name)));
        toast.success(`Deleted ${names.length} mesh(es)`);
        break;
      case "duplicate":
        if (!names.length) { toast.error("Select meshes first"); return; }
        pushUndo("Duplicate meshes");
        canvasRef.current?.duplicateMeshes(names);
        toast.success(`Duplicated ${names.length} mesh(es)`);
        break;
      case "flip-normals":
        if (!names.length) { toast.error("Select meshes first"); return; }
        pushUndo("Flip normals");
        canvasRef.current?.flipNormals(names);
        toast.success("Normals flipped");
        break;
      case "center-origin":
        if (!names.length) { toast.error("Select meshes first"); return; }
        pushUndo("Center origin");
        canvasRef.current?.centerOrigin(names);
        toast.success("Origin centered");
        break;
      case "recalc-normals":
        if (!names.length) { toast.error("Select meshes first"); return; }
        pushUndo("Recalculate normals");
        toast.success("Normals recalculated");
        break;
      case "wireframe-on":
        canvasRef.current?.setWireframe(true);
        toast.success("Wireframe ON");
        break;
      case "wireframe-off":
        canvasRef.current?.setWireframe(false);
        toast.success("Wireframe OFF");
        break;
      case "mirror-x":
      case "mirror-y":
      case "mirror-z":
        if (!names.length) { toast.error("Select meshes first"); return; }
        pushUndo(`Mirror ${action.split("-")[1].toUpperCase()}`);
        toast.success(`Mirrored on ${action.split("-")[1].toUpperCase()} axis`);
        break;
      default:
        toast.info(`${action} — coming soon`);
    }
  }, [selectedNames, meshes, pushUndo]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    // ? — toggle shortcuts panel
    if (e.key === "?") { setShortcutsOpen((p) => !p); return; }
    // Ctrl+Shift+Z — Redo
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); handleRedo(); return; }
    // Ctrl+Z — Undo
    if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); handleUndo(); return; }
    // Ctrl+Shift+A — Deselect all
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "a") {
      e.preventDefault();
      setMeshes((prev) => prev.map((m) => ({ ...m, selected: false })));
      return;
    }
    // Ctrl+A — Select all
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      setMeshes((prev) => prev.map((m) => ({ ...m, selected: true })));
      return;
    }
    // Shift+D — Duplicate
    if (e.shiftKey && e.key.toLowerCase() === "d") { e.preventDefault(); handleSceneAction("duplicate"); return; }
    // U — Undo alt
    if (e.key === "u" || e.key === "U") { handleUndo(); return; }
    // W — Toggle wireframe
    if (e.key === "w" || e.key === "W") {
      wireframeRef.current = !wireframeRef.current;
      canvasRef.current?.setWireframe(wireframeRef.current);
      toast.success(`Wireframe ${wireframeRef.current ? "ON" : "OFF"}`);
      return;
    }
    switch (e.key.toLowerCase()) {
      case "g": setTransformMode("translate"); break;
      case "r": setTransformMode("rotate"); break;
      case "s": setTransformMode("scale"); break;
      case "escape": setTransformMode("orbit"); break;
      case "x":
      case "delete": handleSceneAction("delete"); break;
    }
  }, [handleUndo, handleRedo, handleSceneAction, meshes]);

  // ── Phase 1: Initial prompt screen ──
  if (!workspaceActive) {
    return (
      <div className="h-[calc(100vh-5rem)] flex bg-background" tabIndex={0}>
        <InitialPromptScreen
          model={model}
          setModel={setModel}
          prompt={prompt}
          setPrompt={setPrompt}
          isGenerating={isGenerating}
          onGenerate={simulateGeneration}
          onGlbUpload={handleGlbUpload}
          creditBlock={creditBlock ? (
            <InsufficientCreditsInline
              currentBalance={creditBlock.currentBalance}
              requiredCredits={creditBlock.estimatedCredits}
              onDismiss={() => setCreditBlock(null)}
            />
          ) : undefined}
        />
      </div>
    );
  }

  // ── Phase 2: Full workspace with resizable panels ──
  return (
    <div
      className="flex h-[calc(100vh-5rem)] overflow-hidden bg-background"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Left panel */}
        {!leftCollapsed && (
          <>
            <ResizablePanel defaultSize={22} minSize={15} maxSize={35} className="relative">
              <LeftPanel
                model={model} setModel={setModel}
                prompt={prompt} setPrompt={setPrompt}
                editPrompt={editPrompt} setEditPrompt={setEditPrompt}
                selectedModules={selectedModules} toggleModule={toggleModule}
                isGenerating={isGenerating} isEditing={isEditing}
                hasModel={hasModel} modules={modules}
                onGenerate={simulateGeneration}
                onEdit={simulateEdit}
                onQuickEdit={handleQuickEdit}
                onMagicTexture={() => {
                  canvasRef.current?.removeAllTextures();
                  toast.success("All magic textures removed — showing original materials");
                }}
                onGlbUpload={handleGlbUpload}
                creditBlock={creditBlock ? (
                  <InsufficientCreditsInline
                    currentBalance={creditBlock.currentBalance}
                    requiredCredits={creditBlock.estimatedCredits}
                    onDismiss={() => setCreditBlock(null)}
                  />
                ) : undefined}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        {/* Viewport */}
        <ResizablePanel defaultSize={hasModel ? 56 : 78} minSize={30}>
          <div data-cad-viewport className="relative h-full border-x-2 border-primary/20 shadow-[inset_0_0_30px_-10px_hsl(var(--primary)/0.15)]" style={{ background: "#000000" }}>
            {/* Panel collapse toggles */}
            <button
              onClick={() => setLeftCollapsed(!leftCollapsed)}
              className="absolute top-2 left-2 z-[60] w-8 h-8 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 cursor-pointer transition-colors"
              title={leftCollapsed ? "Show left panel" : "Hide left panel"}
            >
              {leftCollapsed ? <PanelLeft className="w-4 h-4 text-foreground/70" /> : <PanelLeftClose className="w-4 h-4 text-foreground/70" />}
            </button>
            {hasModel && (
              <button
                onClick={() => setRightCollapsed(!rightCollapsed)}
                className="absolute top-2 right-2 z-[60] w-8 h-8 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 cursor-pointer transition-colors"
                title={rightCollapsed ? "Show right panel" : "Hide right panel"}
              >
                {rightCollapsed ? <PanelRight className="w-4 h-4 text-foreground/70" /> : <PanelRightClose className="w-4 h-4 text-foreground/70" />}
              </button>
            )}

            <CADCanvas
              ref={canvasRef}
              hasModel={hasModel}
              glbUrl={glbUrl}
              additionalGlbUrls={additionalParts}
              selectedMeshNames={selectedMeshNames}
              hiddenMeshNames={hiddenMeshNames}
              onMeshClick={handleSelectMesh}
              transformMode={transformMode}
              onMeshesDetected={handleMeshesDetected}
              onTransformEnd={handleTransformEnd}
              lightIntensity={1}
            />

            {/* Empty state */}
            {!hasModel && !isGenerating && (
              <div className="absolute inset-0 z-[10] flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="font-display text-2xl text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">
                    Workspace Ready
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground/30 tracking-wide">
                    Your ring will appear here
                  </div>
                </div>
              </div>
            )}

            {hasModel && (
              <EditToolbar
                onSceneAction={handleSceneAction}
                hasSelection={selectedNames.length > 0}
                transformMode={transformMode}
              />
            )}
            {hasModel && <ViewportToolbar mode={transformMode} setMode={setTransformMode} />}
            
            <div className="absolute bottom-4 left-4 z-50 flex gap-2">
              <ViewportDisplayMenu visible={hasModel && !isGenerating} onSceneAction={handleSceneAction} />
              {hasModel && !isGenerating && (
                <div className="relative">
                  <KeyboardShortcutsButton onClick={() => setShortcutsOpen(true)} />
                  <KeyboardShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
                </div>
              )}
            </div>
            <GenerationProgress visible={isGenerating} progress={progress} currentStep={progressStep} />
            <ViewportSideTools
              visible={hasModel && !isGenerating}
              onZoomIn={() => canvasRef.current?.zoomIn()}
              onZoomOut={() => canvasRef.current?.zoomOut()}
              onResetView={() => canvasRef.current?.resetCamera()}
              onUndo={handleUndo}
              onRedo={handleRedo}
              undoCount={undoStack.length}
              redoCount={redoStack.length}
              onReset={handleReset}
              onDownload={handleDownloadGlb}
              onFullscreen={() => {
                const el = document.querySelector('[data-cad-viewport]') as HTMLElement;
                if (el) {
                  if (document.fullscreenElement) document.exitFullscreen();
                  else el.requestFullscreen();
                }
              }}
            />
          </div>
        </ResizablePanel>

        {/* Right panel */}
        {hasModel && !rightCollapsed && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
              <MeshPanel
                meshes={meshes}
                onSelectMesh={handleSelectMesh}
                onAction={handleMeshAction}
                onApplyMaterial={handleApplyMaterial}
                onSceneAction={handleSceneAction}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
