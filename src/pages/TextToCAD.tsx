import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Upload, X, Image as ImageIcon,
  ChevronDown, ChevronUp, Box, Gem, Wrench,
  Maximize2, Shield, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import CADViewport from "@/components/cad/CADViewport";
import ViewportToolbar from "@/components/cad/ViewportToolbar";
import ViewportTopBar from "@/components/cad/ViewportTopBar";
import MeshLibrary from "@/components/cad/MeshLibrary";

const AI_MODELS = [
  { id: "formanova1", name: "FORMANOVA 1", desc: "Advanced" },
  { id: "formanova2", name: "FORMANOVA 2", desc: "Balanced" },
  { id: "formanova3", name: "FORMANOVA 3", desc: "Premium" },
];

const MODULES = [
  "Band", "Setting", "Stone", "Prong", "Shoulder", "Gallery", "Shank", "Bridge",
];

const QUICK_EDITS = [
  { id: "band", label: "Band", desc: "Material & shape", icon: Box },
  { id: "gem", label: "Gemstone", desc: "Cut & color", icon: Gem },
  { id: "detail", label: "Details", desc: "Engravings & filigree", icon: Layers },
  { id: "prong", label: "Prong", desc: "Setting style", icon: Shield },
  { id: "scale", label: "Scale", desc: "Resize parts", icon: Maximize2 },
  { id: "fix", label: "Repair", desc: "Fix geometry", icon: Wrench },
];

const PROGRESS_STEPS = [
  "Parsing description…",
  "Generating base mesh…",
  "Adding stone geometry…",
  "Refining band details…",
  "Applying materials…",
  "Final polish…",
];

export default function TextToCAD() {
  const [model, setModel] = useState("formanova2");
  const [prompt, setPrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [refImage, setRefImage] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasModel, setHasModel] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState("");
  const [editExpanded, setEditExpanded] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleModule = (mod: string) => {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const handleRefImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRefImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const simulateGeneration = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Please describe your ring first");
      return;
    }
    setIsGenerating(true);
    setProgress(0);
    setHasModel(false);
    for (let i = 0; i < PROGRESS_STEPS.length; i++) {
      setProgressStep(PROGRESS_STEPS[i]);
      const target = Math.round(((i + 1) / PROGRESS_STEPS.length) * 100);
      for (let p = progress; p <= target; p += 2) {
        setProgress(p);
        await new Promise((r) => setTimeout(r, 60));
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    setProgress(100);
    setIsGenerating(false);
    setHasModel(true);
    toast.success("Ring generated successfully");
  }, [prompt]);

  const simulateEdit = useCallback(async () => {
    if (!editPrompt.trim()) {
      toast.error("Please describe the edit");
      return;
    }
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

  const handleQuickEdit = (label: string) => {
    setEditPrompt(`Modify the ${label.toLowerCase()}: `);
  };

  const handleReset = () => {
    setPrompt("");
    setEditPrompt("");
    setRefImage(null);
    setSelectedModules([]);
    setHasModel(false);
    setProgress(0);
    setProgressStep("");
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden bg-muted/30">
      {/* ── LEFT PANEL (collapsible) ── */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex-shrink-0 flex flex-col border-r border-border/30 bg-card/80 backdrop-blur-sm overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin">
              {/* Title */}
              <h1 className="text-lg font-light tracking-[5px] uppercase">
                <span className="font-semibold text-primary">Text</span> → 3D
              </h1>

              {/* AI Model selector */}
              <section>
                <Label className="text-[10px] uppercase tracking-[2px] text-muted-foreground font-semibold mb-2 block">
                  AI Model
                </Label>
                <RadioGroup value={model} onValueChange={setModel} className="grid grid-cols-3 gap-2">
                  {AI_MODELS.map((m) => (
                    <label
                      key={m.id}
                      className={`flex flex-col items-center p-2.5 rounded-lg border cursor-pointer transition-all duration-200 ${
                        model === m.id
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/30 bg-card/30 hover:border-border/60"
                      }`}
                    >
                      <RadioGroupItem value={m.id} className="sr-only" />
                      <span className="text-[10px] font-bold text-foreground tracking-wide">{m.name}</span>
                      <span className="text-[8px] text-muted-foreground">{m.desc}</span>
                    </label>
                  ))}
                </RadioGroup>
              </section>

              {/* Prompt */}
              <section>
                <Label className="text-[10px] uppercase tracking-[2px] text-muted-foreground font-semibold mb-2 block">
                  Describe Your Ring
                </Label>
                <Textarea
                  placeholder="A platinum solitaire ring with a 2-carat round brilliant diamond…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[80px] text-sm bg-card/30 border-border/30 resize-y"
                />
                <div className="mt-2">
                  <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleRefImage} />
                  {!refImage ? (
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-xs text-foreground/70 hover:text-foreground transition-colors">
                      <ImageIcon className="w-4 h-4 text-primary/70" />
                      <span>Attach reference image (optional)</span>
                    </button>
                  ) : (
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border/30">
                      <img src={refImage} alt="Reference" className="w-full h-full object-cover" />
                      <button onClick={() => setRefImage(null)} className="absolute top-0.5 right-0.5 w-5 h-5 bg-background/80 rounded-full flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <Button className="w-full mt-3 uppercase tracking-[2px] text-xs font-bold h-11 shadow-md" disabled={isGenerating || !prompt.trim()} onClick={simulateGeneration}>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  {isGenerating && !isEditing ? "Generating…" : "Generate Ring"}
                </Button>
              </section>

              {/* Modules */}
              <section>
                <Label className="text-[10px] uppercase tracking-[2px] text-muted-foreground font-semibold mb-2 block">
                  Components
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {MODULES.map((mod) => (
                    <button
                      key={mod}
                      onClick={() => toggleModule(mod)}
                      className={`px-3 py-1 rounded-full text-[10px] font-medium border transition-all duration-200 ${
                        selectedModules.includes(mod)
                          ? "border-primary/40 bg-primary/8 text-primary"
                          : "border-border/40 text-foreground/70 hover:border-border/60 hover:text-foreground"
                      }`}
                    >
                      {mod}
                    </button>
                  ))}
                </div>
              </section>

              {/* Edit section */}
              <AnimatePresence>
                {hasModel && (
                  <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-xl border-2 border-primary/20 bg-primary/[0.03] p-4 relative"
                  >
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[8px] font-bold tracking-[2px] uppercase px-3 py-0.5 rounded-md">
                      Edit Your Ring
                    </div>
                    <button onClick={() => setEditExpanded(!editExpanded)} className="flex items-center justify-between w-full mb-2">
                      <Label className="text-[10px] uppercase tracking-[2px] text-primary/70 font-semibold cursor-pointer">Describe changes</Label>
                      {editExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    {editExpanded && (
                      <>
                        <Textarea placeholder="Make the band thinner and add side stones…" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} className="min-h-[60px] text-sm bg-background/50 border-primary/15 resize-y mb-3" />
                        <Button className="w-full uppercase tracking-[2px] text-xs font-bold h-10" disabled={isGenerating || !editPrompt.trim()} onClick={simulateEdit}>
                          ✎ Apply Edit
                        </Button>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {QUICK_EDITS.map((qe) => (
                            <button key={qe.id} onClick={() => handleQuickEdit(qe.label)} className="flex flex-col items-center p-2.5 rounded-lg border border-border/20 bg-card/20 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 group">
                              <qe.icon className="w-4.5 h-4.5 text-foreground/70 group-hover:text-primary transition-colors mb-0.5" />
                              <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/80">{qe.label}</span>
                              <span className="text-[7px] text-muted-foreground/60">{qe.desc}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.section>
                )}
              </AnimatePresence>
            </div>

            {/* Status bar */}
            <div className="px-5 py-2 border-t border-border/20 flex items-center gap-2 text-[10px] text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${isGenerating ? "bg-yellow-500 animate-pulse" : "bg-green-500"}`} />
              <span>{isGenerating ? "Processing…" : "Ready"}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── VERTICAL TOOLBAR ── */}
      <ViewportToolbar />

      {/* ── VIEWPORT ── */}
      <div className="flex-1 relative">
        <ViewportTopBar onReset={handleReset} />
        <CADViewport isGenerating={isGenerating} hasModel={hasModel} progress={progress} progressStep={progressStep} />

        {/* Toggle left panel */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="absolute bottom-4 left-4 z-10 w-8 h-8 rounded-lg bg-card/60 backdrop-blur-sm border border-border/20 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title={panelOpen ? "Hide panel" : "Show panel"}
        >
          {panelOpen ? <ChevronDown className="w-4 h-4 -rotate-90" /> : <ChevronDown className="w-4 h-4 rotate-90" />}
        </button>
      </div>

      {/* ── MESH LIBRARY (right) ── */}
      <MeshLibrary />
    </div>
  );
}
