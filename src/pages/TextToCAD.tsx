import { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { startRingPipeline, pollStatus, fetchResult, calcProgress } from "@/lib/formanova-cad-api";
import { performCreditPreflight, type PreflightResult } from "@/lib/credit-preflight";
import { TOOL_COSTS } from "@/lib/credits-api";
import { AuthExpiredError } from "@/lib/authenticated-fetch";
import { InsufficientCreditsInline } from "@/components/InsufficientCreditsInline";
import InitialPromptScreen from "@/components/text-to-cad/InitialPromptScreen";
import LeftPanel from "@/components/text-to-cad/LeftPanel";
import EditToolbar from "@/components/text-to-cad/EditToolbar";
import MeshPanel from "@/components/text-to-cad/MeshPanel";
import CADCanvas from "@/components/text-to-cad/CADCanvas";
import type { CADCanvasHandle, CanvasSnapshot } from "@/components/text-to-cad/CADCanvas";
import GenerationProgress from "@/components/text-to-cad/GenerationProgress";
import {
  ViewportToolbar,
  StatsBar,
  ActionButtons,
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
  const [creditBlock, setCreditBlock] = useState<PreflightResult | null>(null);

  // Track whether user has ever started a generation or uploaded — drives the phase transition
  const [workspaceActive, setWorkspaceActive] = useState(false);

  const canvasRef = useRef<CADCanvasHandle>(null);
  const meshesRef = useRef<MeshItemData[]>(meshes);
  meshesRef.current = meshes;

  const selectedMeshNames = useMemo(
    () => new Set(meshes.filter((m) => m.selected).map((m) => m.name)),
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
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) { toast.info("Nothing to undo"); return prev; }
      const last = prev[prev.length - 1];
      setMeshes(last.meshes);
      if (last.canvasSnapshot) {
        canvasRef.current?.restoreSnapshot(last.canvasSnapshot);
      }
      toast.success(`Undo: ${last.label}`);
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

    const requiredCredits = TOOL_COSTS.cad_generation ?? 5;
    try {
      const result = await performCreditPreflight('ring_full_pipeline', 1);
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

    // Transition to workspace phase
    setWorkspaceActive(true);
    setIsGenerating(true);
    setProgress(0);
    setHasModel(false);
    setProgressStep("Queued");

    try {
      const runRes = await startRingPipeline(prompt, model);
      const { status_url, result_url, projected_cost } = runRes;
      if (projected_cost) toast.info(`Estimated cost: $${projected_cost.toFixed(2)}`);

      setProgressStep("Generating geometry");
      let done = false;
      let pollErrors = 0;
      let resolvedGlbUrl: string | null = null;
      let glbSource: string | null = null;

      while (!done) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const statusRes = await pollStatus(status_url);
          const pct = calcProgress(statusRes);
          setProgress(pct);
          setProgressStep(statusRes.current_step || getProgressLabel(pct));

          const s = (statusRes.status || "").toLowerCase();
          if (s === "completed" || s === "done" || pct >= 100) {
            if (statusRes.glb_url) {
              resolvedGlbUrl = statusRes.glb_url as string;
              glbSource = (statusRes.azure_source as string) || null;
            }
            done = true;
          } else if (s === "failed" || s === "error") {
            const reason = statusRes.error || statusRes.message || statusRes.detail || "Pipeline failed";
            throw new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
          }
          pollErrors = 0;
        } catch (err) {
          pollErrors++;
          if (pollErrors >= 5) throw err;
          // Don't fail on transient errors
        }
      }

      if (!resolvedGlbUrl) {
        setProgress(95);
        setProgressStep("Preparing preview");
        const resultRes = await fetchResult(result_url);
        resolvedGlbUrl = resultRes.glb_url;
        glbSource = resultRes.azure_source || null;
      }

      if (!resolvedGlbUrl) {
        toast.error("No 3D model found in the result");
        setIsGenerating(false);
        return;
      }

      setGlbUrl(resolvedGlbUrl);
      setProgress(100);
      setProgressStep("Completed");
      setIsGenerating(false);
      setHasModel(true);
      setShowPartRegen(true);

      if (glbSource === "ring-validate") {
        toast.success("✅ Validated model loaded", { position: "bottom-right" });
      } else if (glbSource === "ring-generate") {
        toast.info("🔧 Generated model loaded (unvalidated)", { position: "bottom-right" });
      } else {
        toast.success("Ring generated successfully");
      }

    } catch (err) {
      console.error("Generation failed:", err);
      toast.error(err instanceof Error ? err.message : "Generation failed");
      setIsGenerating(false);
      setProgress(0);
      setProgressStep("");
    }
  }, [prompt, model, navigate]);

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
      // First upload — transition to workspace
      setWorkspaceActive(true);
      setGlbUrl(url);
      setHasModel(true);
      setShowPartRegen(true);
      setMeshes([]);
      setModules([]);
      setStats({ meshes: 0, sizeKB: Math.round(file.size / 1024), timeSec: 0 });
      setUndoStack([]);
    } else if (!hasModel) {
      setGlbUrl(url);
      setHasModel(true);
      setShowPartRegen(true);
      setMeshes([]);
      setModules([]);
      setStats({ meshes: 0, sizeKB: Math.round(file.size / 1024), timeSec: 0 });
      setUndoStack([]);
    } else {
      setAdditionalParts((prev) => [...prev, url]);
    }
    toast.success(`Added ${file.name}`);
  }, [hasModel, workspaceActive]);

  const handleMeshesDetected = useCallback((detected: { name: string; verts: number; faces: number }[]) => {
    setMeshes(detected.map((d) => ({ ...d, visible: true, selected: false })));
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
    if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); handleUndo(); return; }
    if (e.key === "u" || e.key === "U") { handleUndo(); return; }
    switch (e.key.toLowerCase()) {
      case "g": setTransformMode("translate"); break;
      case "r": setTransformMode("rotate"); break;
      case "s": setTransformMode("scale"); break;
      case "escape": setTransformMode("orbit"); break;
      case "x":
      case "delete": handleSceneAction("delete"); break;
    }
  }, [handleUndo, handleSceneAction]);

  // ── Phase 1: Initial prompt screen (no model, no generation started) ──
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

  // ── Phase 2: Full workspace ──
  return (
    <div
      className="flex h-[calc(100vh-5rem)] overflow-hidden bg-background"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Left panel — always visible in workspace phase */}
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

      {/* Viewport */}
      <div className="flex-1 relative border-x-2 border-primary/20 shadow-[inset_0_0_30px_-10px_hsl(var(--primary)/0.15)]" style={{ background: "#000000" }}>
        <CADCanvas
          ref={canvasRef}
          hasModel={hasModel}
          glbUrl={glbUrl}
          additionalGlbUrls={additionalParts}
          selectedMeshNames={selectedMeshNames}
          onMeshClick={handleSelectMesh}
          transformMode={transformMode}
          onMeshesDetected={handleMeshesDetected}
          onTransformEnd={handleTransformEnd}
          lightIntensity={1}
        />

        {/* Empty state in viewport while generating */}
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

        {/* Advanced controls — only when model exists */}
        {hasModel && (
          <EditToolbar
            onApplyMaterial={handleApplyMaterial}
            onSceneAction={handleSceneAction}
            hasSelection={selectedNames.length > 0}
            transformMode={transformMode}
          />
        )}
        {hasModel && <ViewportToolbar mode={transformMode} setMode={setTransformMode} />}
        
        {/* New staged progress overlay */}
        <GenerationProgress visible={isGenerating} progress={progress} currentStep={progressStep} />
        
        <StatsBar visible={hasModel && !isGenerating} stats={stats} />
        <ActionButtons
          visible={hasModel && !isGenerating}
          onReset={handleReset}
          onUndo={handleUndo}
          undoCount={undoStack.length}
          onDownload={handleDownloadGlb}
        />
      </div>

      {/* Right panel — mesh panel only when model exists */}
      <AnimatePresence>
        {hasModel && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 270, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <MeshPanel
              meshes={meshes}
              onSelectMesh={handleSelectMesh}
              onAction={handleMeshAction}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
