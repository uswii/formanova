import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useCredits } from "@/contexts/CreditsContext";
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
import type { CADCanvasHandle, CanvasSnapshot, MeshTransformData } from "@/components/text-to-cad/CADCanvas";
import ViewportDisplayMenu from "@/components/text-to-cad/ViewportDisplayMenu";
import KeyboardShortcutsPanel, { KeyboardShortcutsButton } from "@/components/text-to-cad/KeyboardShortcutsPanel";
import GenerationProgress from "@/components/text-to-cad/GenerationProgress";
import { useCADKeyboardShortcuts } from "@/hooks/use-cad-keyboard-shortcuts";
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
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasModel, setHasModel] = useState(false);
  const [progressStep, setProgressStep] = useState("");
  const [retryAttempt, setRetryAttempt] = useState(0);
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
  const [selectedTransform, setSelectedTransform] = useState<MeshTransformData | null>(null);

  // Track whether user has ever started a generation or uploaded — drives the phase transition
  const [workspaceActive, setWorkspaceActive] = useState(false);

  const canvasRef = useRef<CADCanvasHandle>(null);
  const wireframeRef = useRef(false);
  const meshesRef = useRef<MeshItemData[]>(meshes);
  const pollAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
    };
  }, []);
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
    // Sync numeric fields after gizmo drag
    setSelectedTransform(canvasRef.current?.getSelectedTransform() ?? null);
  }, [pushUndo, transformMode]);

  // Refresh transform data whenever selection changes
  useEffect(() => {
    setSelectedTransform(canvasRef.current?.getSelectedTransform() ?? null);
  }, [selectedMeshNames]);

  const handleNumericTransformChange = useCallback((axis: 'x' | 'y' | 'z', property: 'position' | 'rotation' | 'scale', value: number) => {
    canvasRef.current?.setMeshTransform(axis, property, value);
    // Read back the updated transform for UI sync
    requestAnimationFrame(() => {
      setSelectedTransform(canvasRef.current?.getSelectedTransform() ?? null);
    });
  }, []);

  // Called when CADCanvas has fully parsed, textured, and rendered the model
  const handleModelReady = useCallback(() => {
    setIsModelLoading(false);
    setProgressStep("success_final");
    toast.success("Ring generated successfully");
  }, []);

  const toggleModule = (mod: string) => {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const simulateGeneration = useCallback(async () => {
    if (isGenerating) return;
    if (!prompt.trim()) { toast.error("Please describe your ring first"); return; }

    const trimmed = prompt.trim().toLowerCase();
    const isDemo = trimmed === 'demo' || trimmed === 'test';

    // ── Demo mode: load local placeholder model, no backend calls ──
    if (isDemo) {
      setWorkspaceActive(true);
      setIsGenerating(true);
      setHasModel(false);
      setProgressStep("generate_initial");

      // Simulate realistic progress (~35s total to match real generation feel)
      const steps = [
        { label: "generate_initial", ms: 6000 },
        { label: "build_initial",    ms: 8000 },
        { label: "validate_output",  ms: 5000 },
        { label: "generate_fix",     ms: 4000 },
        { label: "build_retry",      ms: 6000 },
        { label: "build_corrected",  ms: 4000 },
        { label: "success_final",    ms: 1000 },
      ];
      for (const step of steps) {
        await new Promise((r) => setTimeout(r, step.ms));
        setProgressStep(step.label);
      }

      setGlbUrl("/models/ring.glb");
      setIsModelLoading(true);
      setIsGenerating(false);
      setHasModel(true);
      setShowPartRegen(true);
      toast.success("Demo model loaded — no credits used");
      return;
    }

    // ── Real generation ──
    const LLM_MAP: Record<string, string> = { "gemini": "gemini", "claude-sonnet": "claude-sonnet", "claude-opus": "claude-opus" };
    const LABEL_MAP: Record<string, string> = { "gemini": "Lite", "claude-sonnet": "Standard", "claude-opus": "Premium" };
    const llm = LLM_MAP[model] ?? "gemini";
    console.log("[TextToCAD] User selected quality:", LABEL_MAP[model] ?? model, "→ llm:", llm);

    const modelKey = `ring_generate_v1:${model}`;
    const requiredCredits = TOOL_COSTS[modelKey] ?? TOOL_COSTS.cad_generation ?? 5;
    try {
      const result = await performCreditPreflight('ring_generate_v1', 1, { model });
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
    setRetryAttempt(0);
    setHasModel(false);
    setProgressStep("generate_initial");

    try {
      // Step 1: Start generation
      const startRes = await authenticatedFetch(`/api/run/ring_generate_v1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { llm, prompt: prompt.trim(), max_attempts: 3 },
          return_nodes: ["build_initial", "build_retry", "build_corrected", "validate_output", "success_final", "success_original_glb", "failed_final"],
        }),
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error || err.detail || `Failed to start generation (${startRes.status})`);
      }

      const { workflow_id } = await startRes.json();
      if (!workflow_id) throw new Error("No workflow_id returned");

      console.log("[TextToCAD] Workflow started:", workflow_id);

      // Step 2: Poll status every 3s — use active_nodes[0] for real progress
      const TERMINAL_STATES = new Set(["failed", "budget_exhausted"]);
      pollAbortRef.current?.abort();
      const pollAbort = new AbortController();
      pollAbortRef.current = pollAbort;
      let pollErrors = 0;
      let consecutive404s = 0;
      const MAX_404_RETRIES = 3;
      const POLL_TIMEOUT_MS = 12 * 60 * 1000; // 12 min for Sonnet
      const pollStart = Date.now();

      const TERMINAL_NODES = new Set(["success_final", "success_original_glb", "failed_final"]);

      while (true) {
        if (Date.now() - pollStart > POLL_TIMEOUT_MS) {
          throw new Error("Generation timed out");
        }
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const statusRes = await authenticatedFetch(
            `/api/status/${encodeURIComponent(workflow_id)}`,
            { signal: pollAbort.signal }
          );

          if (statusRes.status === 404) {
            consecutive404s++;
            if (consecutive404s >= MAX_404_RETRIES) {
              throw new Error("Workflow not found — generation was terminated");
            }
            continue;
          }
          consecutive404s = 0;

          if (!statusRes.ok) {
            pollErrors++;
            if (pollErrors >= 10) throw new Error("Status polling failed repeatedly");
            continue;
          }

          const statusData = await statusRes.json();
          pollErrors = 0;

          const state = (statusData.runtime?.state || "unknown").toLowerCase();
          const activeNode = statusData.runtime?.active_nodes?.[0] || "";
          const lastExitNode = statusData.runtime?.last_exit_node_id || "";
          const retryCount = statusData.node_visit_seq?.generate_fix || 0;

          // Update progress from active node or last exited node
          const displayNode = activeNode || lastExitNode;
          if (displayNode) {
            setProgressStep(displayNode);
            if (retryCount > 0) {
              setRetryAttempt(retryCount);
            }
          }

          // Terminal checks: state OR node
          if (state === "completed") break;
          if (state === "failed" || state === "budget_exhausted") {
            setProgressStep("failed_final");
            throw new Error(`Generation ${state}`);
          }
          if (TERMINAL_NODES.has(activeNode) || TERMINAL_NODES.has(lastExitNode)) {
            if (activeNode === "failed_final" || lastExitNode === "failed_final") {
              setProgressStep("failed_final");
              throw new Error("Generation failed");
            }
            break; // success node reached
          }
        } catch (err) {
          if (err instanceof AuthExpiredError) return;
          if (err instanceof Error && err.name === "AbortError") return;
          pollErrors++;
          if (pollErrors >= 10) throw err;
        }
      }

      // Step 3: Fetch result GLB URL (retry up to 5 times on 404 with 2s delay)
      setProgressStep("_loading");
      setProgressStep("_loading");
      let glb_url: string | null = null;
      const MAX_RESULT_RETRIES = 5;
      for (let attempt = 1; attempt <= MAX_RESULT_RETRIES; attempt++) {
        const resultRes = await authenticatedFetch(`/api/result/${encodeURIComponent(workflow_id)}`);

        if (resultRes.ok) {
          const result = await resultRes.json();
          const toUrl = (uri: string) => uri.startsWith("azure://")
            ? `https://snapwear.blob.core.windows.net/${uri.replace("azure://", "")}`
            : uri;
          const successFinal = result["success_final"]?.[0]?.glb_artifact?.uri;
          const successOriginal = result["success_original_glb"]?.[0]?.glb_artifact?.uri;
          const rawUri = successFinal || successOriginal;
          if (rawUri) { glb_url = toUrl(rawUri); break; }
          const hasFailed = Array.isArray(result["failed_final"]) && result["failed_final"].length > 0;
          throw new Error(hasFailed ? "Generation failed — no valid model produced" : "No GLB model found in results");
        }

        if (resultRes.status === 404 && attempt < MAX_RESULT_RETRIES) {
          console.warn(`[TextToCAD] result 404, retry ${attempt}/${MAX_RESULT_RETRIES}`);
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        const err = await resultRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch result");
      }
      if (!glb_url) throw new Error("No GLB model found in results");

      setGlbUrl(glb_url);
      setProgressStep("success_final");
      setProgressStep("_loading");
      setIsModelLoading(true);
      setIsGenerating(false);
      setHasModel(true);
      setShowPartRegen(true);

    } catch (err) {
      console.error("Generation failed:", err);
      toast.error(err instanceof Error ? err.message : "Generation failed");
      setIsGenerating(false);
      setProgressStep("failed_final");
      setProgressStep("");
    }
  }, [prompt, model, isGenerating]);

  const simulateEdit = useCallback(async () => {
    if (!editPrompt.trim()) { toast.error("Please describe the edit"); return; }
    pushUndo("AI edit");
    setIsEditing(true);
    setIsGenerating(true);
    setProgressStep("build_initial");
    await new Promise((r) => setTimeout(r, 1500));
    setProgressStep("success_final");
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
    setRetryAttempt(0);
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

  // Centralized keyboard shortcuts (window-level listener)
  const toggleWireframe = useCallback(() => {
    wireframeRef.current = !wireframeRef.current;
    canvasRef.current?.setWireframe(wireframeRef.current);
    toast.success(`Wireframe ${wireframeRef.current ? "ON" : "OFF"}`);
  }, []);

  useCADKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onDelete: () => handleSceneAction("delete"),
    onDuplicate: () => handleSceneAction("duplicate"),
    onSelectAll: () => setMeshes((prev) => prev.map((m) => ({ ...m, selected: true }))),
    onDeselectAll: () => setMeshes((prev) => prev.map((m) => ({ ...m, selected: false }))),
    onSetTransformMode: setTransformMode,
    onToggleWireframe: toggleWireframe,
    onToggleShortcutsPanel: () => setShortcutsOpen((p) => !p),
    enabled: workspaceActive,
  });

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
      tabIndex={-1}
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
              onModelReady={handleModelReady}
            />

            {/* Empty state */}
            {!hasModel && !isGenerating && !isModelLoading && (
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
            {hasModel && (
              <ViewportToolbar
                mode={transformMode}
                setMode={setTransformMode}
                transformData={selectedTransform}
                onTransformChange={handleNumericTransformChange}
              />
            )}
            
            <div className="absolute bottom-4 left-4 z-50 flex gap-2">
              <ViewportDisplayMenu visible={hasModel && !isGenerating && !isModelLoading} onSceneAction={handleSceneAction} />
              {hasModel && !isGenerating && !isModelLoading && (
                <div className="relative">
                  <KeyboardShortcutsButton onClick={() => setShortcutsOpen(true)} />
                  <KeyboardShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
                </div>
              )}
            </div>
            <GenerationProgress visible={isGenerating || isModelLoading} currentStep={progressStep} retryAttempt={retryAttempt} onRetry={() => simulateGeneration()} />
            <ViewportSideTools
              visible={hasModel && !isGenerating && !isModelLoading}
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
