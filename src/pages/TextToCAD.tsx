import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useCredits } from "@/contexts/CreditsContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftClose, PanelRightClose, PanelLeft, PanelRight } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
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
import QualityToggle from "@/components/text-to-cad/QualityToggle";
import { runMicroBenchmark } from "@/lib/gpu-detect";
import type { QualityMode } from "@/lib/gpu-detect";
import type { GemMode } from "@/components/text-to-cad/CADCanvas";

import type { MeshItemData, StatsData } from "@/components/text-to-cad/types";

// Full undo entry captures both UI mesh list AND 3D canvas state
interface UndoEntry {
  label: string;
  meshes: MeshItemData[];
  canvasSnapshot: CanvasSnapshot | null;
}

export default function TextToCAD() {
  const navigate = useNavigate();
  const { refreshCredits } = useCredits();
  
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
  const [generationFailed, setGenerationFailed] = useState(false);
  const wasManualUploadRef = useRef(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  const [creditBlock, setCreditBlock] = useState<PreflightResult | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [selectedTransform, setSelectedTransform] = useState<MeshTransformData | null>(null);
  const [magicTexturing, setMagicTexturing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualityMode, setQualityMode] = useState<QualityMode>("balanced");
  const [gemMode, setGemMode] = useState<GemMode>(() => {
    // Circuit breaker: if refraction was previously blocked by context loss, stay in simple mode
    return localStorage.getItem("refractionBlocked") === "true" ? "simple" : "simple";
  });
  const refractionBlocked = localStorage.getItem("refractionBlocked") === "true";

  // Run invisible micro-benchmark on mount (offscreen, ~200ms)
  useEffect(() => { runMicroBenchmark(); }, []);

  // Track whether user has ever started a generation or uploaded — drives the phase transition
  const [workspaceActive, setWorkspaceActive] = useState(false);

  const canvasRef = useRef<CADCanvasHandle>(null);
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const meshesRef = useRef<MeshItemData[]>(meshes);
  const wireframeRef = useRef(false);
  const pollAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
    };
  }, []);

  // Track browser fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Expand right panel when model is loaded, collapse when no model
  useEffect(() => {
    if (hasModel) {
      rightPanelRef.current?.expand(22);
    } else {
      rightPanelRef.current?.collapse();
    }
  }, [hasModel]);

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

  // Push a pre-captured state onto undo stack (state BEFORE the action)
  const pushUndoEntry = useCallback((label: string, entry: UndoEntry) => {
    setUndoStack((prev) => [...prev, entry]);
    setRedoStack([]); // Clear redo on new action
  }, []);

  // Convenience: capture current state and push it (for actions where we call BEFORE the mutation)
  const pushUndo = useCallback((label: string) => {
    const currentMeshes = meshesRef.current.map((m) => ({ ...m }));
    const snap = canvasRef.current?.getSnapshot() ?? null;
    pushUndoEntry(label, { label, meshes: currentMeshes, canvasSnapshot: snap });
  }, [pushUndoEntry]);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const currentMeshes = meshesRef.current.map((m) => ({ ...m }));
      const snap = canvasRef.current?.getSnapshot() ?? null;
      setRedoStack((r) => [...r, { label: last.label, meshes: currentMeshes, canvasSnapshot: snap }]);
      setMeshes(last.meshes);
      if (last.canvasSnapshot) {
        canvasRef.current?.restoreSnapshot(last.canvasSnapshot);
      }
      // silent undo
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const currentMeshes = meshesRef.current.map((m) => ({ ...m }));
      const snap = canvasRef.current?.getSnapshot() ?? null;
      setUndoStack((u) => [...u, { label: last.label, meshes: currentMeshes, canvasSnapshot: snap }]);
      setMeshes(last.meshes);
      if (last.canvasSnapshot) {
        canvasRef.current?.restoreSnapshot(last.canvasSnapshot);
      }
      // silent redo
      return prev.slice(0, -1);
    });
  }, []);

  // ── Gizmo transform: capture BEFORE drag starts, push on drag end ──
  const preTransformSnapshotRef = useRef<UndoEntry | null>(null);

  const handleTransformStart = useCallback(() => {
    // Capture the state BEFORE the gizmo drag modifies anything
    const currentMeshes = meshesRef.current.map((m) => ({ ...m }));
    const snap = canvasRef.current?.getSnapshot() ?? null;
    preTransformSnapshotRef.current = { label: `Transform (${transformMode})`, meshes: currentMeshes, canvasSnapshot: snap };
  }, [transformMode]);

  const handleTransformEnd = useCallback(() => {
    // Push the PRE-transform snapshot so undo restores to before the drag
    if (preTransformSnapshotRef.current) {
      pushUndoEntry(preTransformSnapshotRef.current.label, preTransformSnapshotRef.current);
      preTransformSnapshotRef.current = null;
    }
    // Sync numeric fields after gizmo drag
    setSelectedTransform(canvasRef.current?.getSelectedTransform() ?? null);
  }, [pushUndoEntry]);

  // Refresh transform data whenever selection changes
  useEffect(() => {
    setSelectedTransform(canvasRef.current?.getSelectedTransform() ?? null);
  }, [selectedMeshNames]);

  // ── Numeric transform: capture on first change, debounce commit ──
  const numericUndoRef = useRef<{ snapshot: UndoEntry; timer: ReturnType<typeof setTimeout> } | null>(null);

  const handleNumericTransformChange = useCallback((axis: 'x' | 'y' | 'z', property: 'position' | 'rotation' | 'scale', value: number) => {
    // Capture snapshot on first numeric change in a sequence
    if (!numericUndoRef.current) {
      const currentMeshes = meshesRef.current.map((m) => ({ ...m }));
      const snap = canvasRef.current?.getSnapshot() ?? null;
      const label = `Numeric ${property}`;
      numericUndoRef.current = {
        snapshot: { label, meshes: currentMeshes, canvasSnapshot: snap },
        timer: setTimeout(() => {
          // Commit after 800ms idle
          if (numericUndoRef.current) {
            pushUndoEntry(numericUndoRef.current.snapshot.label, numericUndoRef.current.snapshot);
            numericUndoRef.current = null;
          }
        }, 800),
      };
    } else {
      // Reset the debounce timer on continued input
      clearTimeout(numericUndoRef.current.timer);
      numericUndoRef.current.timer = setTimeout(() => {
        if (numericUndoRef.current) {
          pushUndoEntry(numericUndoRef.current.snapshot.label, numericUndoRef.current.snapshot);
          numericUndoRef.current = null;
        }
      }, 800);
    }

    canvasRef.current?.setMeshTransform(axis, property, value);
    // Read back the updated transform for UI sync
    requestAnimationFrame(() => {
      setSelectedTransform(canvasRef.current?.getSelectedTransform() ?? null);
    });
  }, [pushUndoEntry]);

  // Called when CADCanvas has fully parsed, textured, and rendered the model
  const handleModelReady = useCallback(() => {
    setIsModelLoading(false);
    setProgressStep("success_final");
    if (wasManualUploadRef.current) {
      toast.success("File uploaded");
      wasManualUploadRef.current = false;
    } else {
      toast.success("Ring generated successfully");
    }
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
    console.log("[TextToCAD] User selected quality:", LABEL_MAP[model] ?? model);

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
    setGenerationFailed(false);
    setRetryAttempt(0);
    setHasModel(false);
    setProgressStep("generate_initial");

    try {
      // Step 1: Start generation
      const startRes = await authenticatedFetch(`/api/run/ring_generate_v1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { llm, prompt: prompt.trim(), max_attempts: 3, skip_validation: false },
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
      const POLL_TIMEOUT_MS = 60 * 60 * 1000; // 60 min
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
          // Fallback per spec: success_final → glb_artifact, then original_glb_artifact
          // success_original_glb → original_glb_artifact
          // failed_final → error
          const hasFailed = Array.isArray(result["failed_final"]) && result["failed_final"].length > 0;
          if (hasFailed) throw new Error("Generation failed — no valid model produced");

          const successFinal = result["success_final"]?.[0]?.glb_artifact?.uri
            || result["success_final"]?.[0]?.original_glb_artifact?.uri;
          const successOriginal = result["success_original_glb"]?.[0]?.original_glb_artifact?.uri;
          const rawUri = successFinal || successOriginal;
          if (rawUri) { glb_url = toUrl(rawUri); break; }
          throw new Error("No GLB model found in results");
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
      setProgressStep("_loading");
      setIsModelLoading(true);
      setIsGenerating(false);
      refreshCredits().catch(() => {});
      setHasModel(true);
      setShowPartRegen(true);

    } catch (err) {
      console.error("Generation failed:", err);
      setIsGenerating(false);
      setProgressStep("");
      setGenerationFailed(true);
    }
  }, [prompt, model, isGenerating]);

  const runEditWithPrompt = useCallback(async (promptText: string, label: string) => {
    if (!promptText.trim()) { toast.error("Please describe the edit"); return; }
    if (isGenerating || isEditing) return;

    const LLM_MAP: Record<string, string> = { "gemini": "gemini", "claude-sonnet": "claude-sonnet", "claude-opus": "claude-opus" };
    const llm = LLM_MAP[model] ?? "gemini";

    // Credit preflight
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
      console.error('[CAD Edit Preflight] failed, skipping block:', err);
      setCreditBlock(null);
    }

    pushUndo(label);
    setIsEditing(true);
    setIsGenerating(true);
    setRetryAttempt(0);
    setProgressStep("generate_initial");

    try {
      // Step 1: Start generation with edit prompt
      const startRes = await authenticatedFetch(`/api/run/ring_generate_v1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { llm, prompt: promptText.trim(), max_attempts: 3, skip_validation: false },
          return_nodes: ["build_initial", "build_retry", "build_corrected", "validate_output", "success_final", "success_original_glb", "failed_final"],
        }),
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.error || err.detail || `Failed to start edit (${startRes.status})`);
      }

      const { workflow_id } = await startRes.json();
      if (!workflow_id) throw new Error("No workflow_id returned");
      console.log(`[TextToCAD] Edit "${label}" workflow started:`, workflow_id);

      // Step 2: Poll status
      const TERMINAL_NODES = new Set(["success_final", "success_original_glb", "failed_final"]);
      pollAbortRef.current?.abort();
      const pollAbort = new AbortController();
      pollAbortRef.current = pollAbort;
      let pollErrors = 0;
      let consecutive404s = 0;
      const MAX_404_RETRIES = 3;
      const POLL_TIMEOUT_MS = 60 * 60 * 1000; // 60 min
      const pollStart = Date.now();

      while (true) {
        if (Date.now() - pollStart > POLL_TIMEOUT_MS) throw new Error("Edit timed out");
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const statusRes = await authenticatedFetch(
            `/api/status/${encodeURIComponent(workflow_id)}`,
            { signal: pollAbort.signal }
          );
          if (statusRes.status === 404) {
            consecutive404s++;
            if (consecutive404s >= MAX_404_RETRIES) throw new Error("Workflow not found");
            continue;
          }
          consecutive404s = 0;
          if (!statusRes.ok) { pollErrors++; if (pollErrors >= 10) throw new Error("Status polling failed"); continue; }

          const statusData = await statusRes.json();
          pollErrors = 0;
          const state = (statusData.runtime?.state || "unknown").toLowerCase();
          const activeNode = statusData.runtime?.active_nodes?.[0] || "";
          const lastExitNode = statusData.runtime?.last_exit_node_id || "";
          const retryCount = statusData.node_visit_seq?.generate_fix || 0;
          const displayNode = activeNode || lastExitNode;
          if (displayNode) { setProgressStep(displayNode); if (retryCount > 0) setRetryAttempt(retryCount); }

          if (state === "completed") break;
          if (state === "failed" || state === "budget_exhausted") { setProgressStep("failed_final"); throw new Error(`Edit ${state}`); }
          if (TERMINAL_NODES.has(activeNode) || TERMINAL_NODES.has(lastExitNode)) {
            if (activeNode === "failed_final" || lastExitNode === "failed_final") { setProgressStep("failed_final"); throw new Error("Edit failed"); }
            break;
          }
        } catch (err) {
          if (err instanceof AuthExpiredError) return;
          if (err instanceof Error && err.name === "AbortError") return;
          pollErrors++;
          if (pollErrors >= 10) throw err;
        }
      }

      // Step 3: Fetch result GLB
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
          const hasFailed = Array.isArray(result["failed_final"]) && result["failed_final"].length > 0;
          if (hasFailed) throw new Error("Edit failed — no valid model produced");

          const successFinal = result["success_final"]?.[0]?.glb_artifact?.uri
            || result["success_final"]?.[0]?.original_glb_artifact?.uri;
          const successOriginal = result["success_original_glb"]?.[0]?.original_glb_artifact?.uri;
          const rawUri = successFinal || successOriginal;
          if (rawUri) { glb_url = toUrl(rawUri); break; }
          throw new Error("No GLB model found");
        }
        if (resultRes.status === 404 && attempt < MAX_RESULT_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        const err = await resultRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch edit result");
      }
      if (!glb_url) throw new Error("No GLB model found in edit results");

      setGlbUrl(glb_url);
      setProgressStep("_loading");
      setIsModelLoading(true);
      setIsGenerating(false);
      setIsEditing(false);
      refreshCredits().catch(() => {});
      setHasModel(true);
      toast.success(`${label} applied`);

    } catch (err) {
      console.error(`Edit "${label}" failed:`, err);
      toast.error(err instanceof Error ? err.message : "Edit failed");
      setIsGenerating(false);
      setIsEditing(false);
      setProgressStep("");
    }
  }, [model, isGenerating, isEditing, pushUndo]);

  const simulateEdit = useCallback(async () => {
    await runEditWithPrompt(editPrompt, "AI edit");
    setEditPrompt("");
  }, [editPrompt, runEditWithPrompt]);

  const handleRebuildPart = useCallback((partId: string, description: string) => {
    runEditWithPrompt(`Rebuild ${partId}: ${description}`, `Rebuild ${partId}`);
  }, [runEditWithPrompt]);

  const handleAddPart = useCallback((description: string) => {
    runEditWithPrompt(`Add new part: ${description}`, "Add part");
  }, [runEditWithPrompt]);

  const handleQuickEdit = useCallback((preset: string) => {
    setEditPrompt(preset);
  }, []);

  const [additionalParts, setAdditionalParts] = useState<string[]>([]);

  const handleGlbUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    wasManualUploadRef.current = true;

    if (!workspaceActive) setWorkspaceActive(true);

    // Check if scene actually has meshes — after Ctrl+A + Delete, hasModel may be true
    // but the scene is empty, so we should treat it as a fresh upload.
    const sceneHasMeshes = meshesRef.current.length > 0;

    if (hasModel && glbUrl && sceneHasMeshes) {
      // Model already exists with visible meshes — add as an additional part (merge into scene)
      setAdditionalParts((prev) => [...prev, url]);
      setStats((prev) => ({ ...prev, sizeKB: prev.sizeKB + Math.round(file.size / 1024) }));
    } else {
      // No model yet OR scene was cleared — set as the primary model
      if (glbUrl?.startsWith("blob:")) URL.revokeObjectURL(glbUrl);
      additionalParts.forEach((u) => URL.revokeObjectURL(u));
      setAdditionalParts([]);
      setIsModelLoading(true);
      setProgressStep("_loading");
      setGlbUrl(url);
      setHasModel(true);
      setShowPartRegen(true);
      setMeshes([]);
      setModules([]);
      setStats({ meshes: 0, sizeKB: Math.round(file.size / 1024), timeSec: 0 });
      setUndoStack([]);
      setRedoStack([]);
    }
  }, [glbUrl, additionalParts, workspaceActive, hasModel]);

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
    // Keep prompt populated for quick iteration; clear everything else
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
    // Stay in workspace — do NOT reset workspaceActive
    if (glbUrl) URL.revokeObjectURL(glbUrl);
    additionalParts.forEach((u) => URL.revokeObjectURL(u));
    setAdditionalParts([]);
    setGlbUrl(undefined);
  };

  const handleDownloadGlb = useCallback(async () => {
    try {
      // Download is always user-initiated, so React state is guaranteed to be
      // committed by the time the click handler fires — no need to defer.
      let blob: Blob;
      if (canvasRef.current) {
        blob = await canvasRef.current.exportSceneBlob();
      } else if (glbUrl) {
        // Fallback: download original if canvas not available
        const isBlobUrl = glbUrl.startsWith("blob:");
        const response = await fetch(
          isBlobUrl ? glbUrl : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blob-proxy`,
          isBlobUrl ? {} : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: glbUrl }),
          },
        );
        blob = await response.blob();
      } else {
        return;
      }
      // Use browser's native Save As dialog so the user can rename the file
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      const defaultName = `model-${timestamp}.glb`;

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: defaultName,
            types: [{
              description: 'GLB 3D Model',
              accept: { 'model/gltf-binary': ['.glb'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (e: any) {
          // User cancelled the dialog — not an error
          if (e?.name === 'AbortError') return;
          throw e;
        }
      } else {
        // Fallback for browsers without File System Access API
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = defaultName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      }
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
    // Track visibility changes for undo (skip selection-only changes)
    const isVisibilityAction = ["hide", "show", "show-all", "isolate"].includes(action);
    if (isVisibilityAction) pushUndo(`Visibility: ${action}`);

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

  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);
  const selectionWarningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSelectionWarning = useCallback((msg: string) => {
    setSelectionWarning(msg);
    if (selectionWarningTimer.current) clearTimeout(selectionWarningTimer.current);
    selectionWarningTimer.current = setTimeout(() => setSelectionWarning(null), 3000);
  }, []);

  const handleApplyMaterial = useCallback((matId: string) => {
    if (selectedNames.length === 0) {
      showSelectionWarning("Select meshes first, then apply a material");
      return;
    }
    pushUndo("Apply material");
    canvasRef.current?.applyMaterial(matId, selectedNames);
  }, [selectedNames, pushUndo, showSelectionWarning]);

  const handleSceneAction = useCallback((action: string) => {
    const names = selectedNames;
    switch (action) {
      case "set-mode-translate": setTransformMode("translate"); break;
      case "set-mode-rotate": setTransformMode("rotate"); break;
      case "set-mode-scale": setTransformMode("scale"); break;
      case "reset-transform":
        pushUndo("Reset transform");
        canvasRef.current?.resetTransform(names.length ? names : meshes.map((m) => m.name));
        break;
      case "apply-transform":
        if (!names.length) { showSelectionWarning("Select meshes first"); return; }
        pushUndo("Apply transform");
        canvasRef.current?.applyTransform(names);
        break;
      case "delete":
        if (!names.length) { showSelectionWarning("Select meshes first"); return; }
        pushUndo("Delete meshes");
        canvasRef.current?.deleteMeshes(names);
        setMeshes((prev) => prev.filter((m) => !names.includes(m.name)));
        break;
      case "duplicate":
        if (!names.length) { showSelectionWarning("Select meshes first"); return; }
        pushUndo("Duplicate meshes");
        canvasRef.current?.duplicateMeshes(names);
        break;
      case "flip-normals":
        if (!names.length) { showSelectionWarning("Select meshes first"); return; }
        pushUndo("Flip normals");
        canvasRef.current?.flipNormals(names);
        break;
      case "center-origin":
        if (!names.length) { showSelectionWarning("Select meshes first"); return; }
        pushUndo("Center origin");
        canvasRef.current?.centerOrigin(names);
        break;
      case "recalc-normals":
        if (!names.length) { showSelectionWarning("Select meshes first"); return; }
        pushUndo("Recalculate normals");
        break;
      case "wireframe-on":
        canvasRef.current?.setWireframe(true);
        break;
      case "wireframe-off":
        canvasRef.current?.setWireframe(false);
        break;
      case "mirror-x":
      case "mirror-y":
      case "mirror-z":
        if (!names.length) { showSelectionWarning("Select meshes first"); return; }
        pushUndo(`Mirror ${action.split("-")[1].toUpperCase()}`);
        break;
      default:
        break;
    }
  }, [selectedNames, meshes, pushUndo, showSelectionWarning]);

  // Centralized keyboard shortcuts (window-level listener)
  const toggleWireframe = useCallback(() => {
    wireframeRef.current = !wireframeRef.current;
    canvasRef.current?.setWireframe(wireframeRef.current);
  }, []);

  // ── Clipboard buffer for copy/paste/cut ──
  const clipboardRef = useRef<string[]>([]);

  const handleCopy = useCallback(() => {
    if (selectedNames.length === 0) { showSelectionWarning("Select meshes first"); return; }
    clipboardRef.current = [...selectedNames];
    toast.success(`${selectedNames.length} mesh${selectedNames.length > 1 ? "es" : ""} copied`);
  }, [selectedNames, showSelectionWarning]);

  const handlePaste = useCallback(() => {
    if (clipboardRef.current.length === 0) { showSelectionWarning("Nothing in clipboard — copy meshes first"); return; }
    // Filter to only names that still exist in the scene
    const validNames = clipboardRef.current.filter((n) => meshes.some((m) => m.name === n));
    if (validNames.length === 0) { showSelectionWarning("Copied meshes no longer exist"); return; }
    pushUndo("Paste meshes");
    canvasRef.current?.duplicateMeshes(validNames);
  }, [meshes, pushUndo, showSelectionWarning]);

  const handleCut = useCallback(() => {
    if (selectedNames.length === 0) { showSelectionWarning("Select meshes first"); return; }
    clipboardRef.current = [...selectedNames];
    pushUndo("Cut meshes");
    canvasRef.current?.deleteMeshes(selectedNames);
    setMeshes((prev) => prev.filter((m) => !selectedNames.includes(m.name)));
    toast.success(`${selectedNames.length} mesh${selectedNames.length > 1 ? "es" : ""} cut`);
  }, [selectedNames, pushUndo, showSelectionWarning]);

  useCADKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onDelete: () => handleSceneAction("delete"),
    onDuplicate: () => handleSceneAction("duplicate"),
    onCopy: handleCopy,
    onPaste: handlePaste,
    onCut: handleCut,
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
        {/* Left panel — always mounted, use imperative collapse/expand */}
        <ResizablePanel
          ref={leftPanelRef}
          id="left-panel"
          order={1}
          defaultSize={22}
          minSize={15}
          maxSize={35}
          collapsible
          collapsedSize={0}
          onCollapse={() => setLeftCollapsed(true)}
          onExpand={() => setLeftCollapsed(false)}
          className="relative"
        >
          {!leftCollapsed && (
            <LeftPanel
              model={model} setModel={setModel}
              prompt={prompt} setPrompt={setPrompt}
              editPrompt={editPrompt} setEditPrompt={setEditPrompt}
              selectedModules={selectedModules} toggleModule={toggleModule}
              isGenerating={isGenerating} isEditing={isEditing}
              hasModel={hasModel} modules={modules}
              onGenerate={simulateGeneration}
              onEdit={simulateEdit}
              onRebuildPart={handleRebuildPart}
              onAddPart={handleAddPart}
              onQuickEdit={handleQuickEdit}
              magicTexturing={magicTexturing}
              onMagicTexturingChange={(on) => {
                setMagicTexturing(on);
                if (on) {
                  canvasRef.current?.applyMagicTextures();
                } else {
                  canvasRef.current?.removeAllTextures();
                }
              }}
              onGlbUpload={handleGlbUpload}
              onReset={hasModel ? handleReset : undefined}
              gemMode={gemMode}
              onGemModeChange={setGemMode}
              refractionBlocked={refractionBlocked}
              creditBlock={creditBlock ? (
                <InsufficientCreditsInline
                  currentBalance={creditBlock.currentBalance}
                  requiredCredits={creditBlock.estimatedCredits}
                  onDismiss={() => setCreditBlock(null)}
                />
              ) : undefined}
            />
          )}
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Viewport */}
        <ResizablePanel id="viewport-panel" order={2} defaultSize={hasModel ? 56 : 78} minSize={30}>
          <div data-cad-viewport className="relative h-full border-x-2 border-primary/20 shadow-[inset_0_0_30px_-10px_hsl(var(--primary)/0.15)]" style={{ background: "#000000" }}>
            {/* Panel collapse toggles — hidden in fullscreen */}
            {!isFullscreen && (
              <>
                <button
                  onClick={() => {
                    const panel = leftPanelRef.current;
                    if (panel) { leftCollapsed ? panel.expand(22) : panel.collapse(); }
                  }}
                  className="absolute top-2 left-2 z-[60] w-8 h-8 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 cursor-pointer transition-colors"
                  title={leftCollapsed ? "Show left panel" : "Hide left panel"}
                >
                  {leftCollapsed ? <PanelLeft className="w-4 h-4 text-foreground/70" /> : <PanelLeftClose className="w-4 h-4 text-foreground/70" />}
                </button>
                {hasModel && (
                  <button
                    onClick={() => {
                      const panel = rightPanelRef.current;
                      if (panel) { rightCollapsed ? panel.expand(22) : panel.collapse(); }
                    }}
                    className="absolute top-2 right-2 z-[60] w-8 h-8 flex items-center justify-center bg-card/80 border border-border hover:bg-accent/60 cursor-pointer transition-colors"
                    title={rightCollapsed ? "Show right panel" : "Hide right panel"}
                  >
                    {rightCollapsed ? <PanelRight className="w-4 h-4 text-foreground/70" /> : <PanelRightClose className="w-4 h-4 text-foreground/70" />}
                  </button>
                )}
              </>
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
              onTransformStart={handleTransformStart}
              onTransformEnd={handleTransformEnd}
              lightIntensity={1}
              onModelReady={handleModelReady}
              magicTexturing={magicTexturing}
              qualityMode={qualityMode}
              gemMode={gemMode}
              onGemModeForced={(mode) => setGemMode(mode)}
            />

            {/* Generation failed state */}
            <AnimatePresence>
              {generationFailed && !isGenerating && !hasModel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 z-[20] flex items-center justify-center"
                >
                  <div className="bg-card border border-border shadow-2xl px-10 py-8 max-w-sm text-center">
                    <div className="font-display text-lg uppercase tracking-[0.15em] text-foreground mb-3">
                      Generation Unavailable
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground leading-[1.8] tracking-wide mb-6">
                      We're really sorry. Something went wrong while generating your design. Our AI generation service may be temporarily unavailable. Please try again in a few minutes.
                    </p>
                    <button
                      onClick={() => setGenerationFailed(false)}
                      className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {!hasModel && !isGenerating && !isModelLoading && !generationFailed && (
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
            
            <div className="absolute bottom-4 left-4 z-50 flex gap-2 items-end">
              <ViewportDisplayMenu visible={hasModel && !isGenerating && !isModelLoading} onSceneAction={handleSceneAction} />
              <QualityToggle
                visible={hasModel && !isGenerating && !isModelLoading}
                mode={qualityMode}
                onModeChange={setQualityMode}
              />
              {hasModel && !isGenerating && !isModelLoading && (
                <div className="relative">
                  <KeyboardShortcutsButton onClick={() => setShortcutsOpen(true)} />
                  <KeyboardShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
                </div>
              )}
            </div>

            {/* Selection warning — centered overlay instead of toast */}
            <AnimatePresence>
              {selectionWarning && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-[80] flex items-center justify-center pointer-events-none"
                >
                  <div className="pointer-events-auto bg-card border border-border shadow-2xl px-8 py-5 max-w-xs text-center">
                    <div className="font-display text-sm uppercase tracking-[0.15em] text-foreground mb-1.5">
                      No Selection
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                      {selectionWarning}
                    </p>
                    <button
                      onClick={() => setSelectionWarning(null)}
                      className="mt-4 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.15em] bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      OK
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
              onDownload={handleDownloadGlb}
              onMagicTexture={() => {
                pushUndo("Magic Texture");
                canvasRef.current?.applyMagicTextures();
                toast.success("Magic textures applied");
              }}
              onStartOver={hasModel ? handleReset : undefined}
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

        <ResizableHandle withHandle />

        {/* Right panel — always mounted, use imperative collapse/expand */}
        <ResizablePanel
          ref={rightPanelRef}
          id="right-panel"
          order={3}
          defaultSize={22}
          minSize={15}
          maxSize={35}
          collapsible
          collapsedSize={0}
          onCollapse={() => setRightCollapsed(true)}
          onExpand={() => setRightCollapsed(false)}
        >
          {hasModel && !rightCollapsed && (
            <MeshPanel
              meshes={meshes}
              onSelectMesh={handleSelectMesh}
              onAction={handleMeshAction}
              onApplyMaterial={handleApplyMaterial}
              onSceneAction={handleSceneAction}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
      
    </div>
  );
}
