import { useRef, useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Diamond, ChevronDown, ChevronRight } from "lucide-react";
import creditCoinIcon from "@/assets/icons/credit-coin.png";
import { TOOL_COSTS } from "@/lib/credits-api";
import { AI_MODELS, QUICK_EDITS, PART_REGEN_PARTS } from "./types";

interface LeftPanelProps {
  model: string;
  setModel: (m: string) => void;
  prompt: string;
  setPrompt: (p: string) => void;
  editPrompt: string;
  setEditPrompt: (p: string) => void;
  selectedModules: string[];
  toggleModule: (mod: string) => void;
  isGenerating: boolean;
  isEditing: boolean;
  hasModel: boolean;
  modules: string[];
  onGenerate: () => void;
  onEdit: () => void;
  onQuickEdit: (preset: string) => void;
  onMagicTexture: () => void;
  onGlbUpload: (file: File) => void;
  creditBlock?: React.ReactNode;
}

export default function LeftPanel({
  model, setModel, prompt, setPrompt, editPrompt, setEditPrompt,
  selectedModules, toggleModule,
  isGenerating, isEditing, hasModel, modules,
  onGenerate, onEdit, onQuickEdit, onMagicTexture, onGlbUpload,
  creditBlock,
}: LeftPanelProps) {
  const glbInputRef = useRef<HTMLInputElement>(null);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [rebuildDesc, setRebuildDesc] = useState("");
  const [newPartDesc, setNewPartDesc] = useState("");

  const handleGlbUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onGlbUpload(file);
  }, [onGlbUpload]);

  return (
    <div className="flex flex-col bg-card border-r border-border h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-border">
        <h1 className="font-display text-2xl tracking-[0.15em] text-foreground uppercase">
          Text‑to‑3D Jewelry
        </h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* AI Model */}
        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Generation Quality</h3>
          <div className="flex gap-0 border border-border">
            {AI_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => !m.comingSoon && setModel(m.id)}
                disabled={m.comingSoon}
                className={`flex-1 py-3 px-2 text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors duration-150 border-r border-border last:border-r-0 ${
                  m.comingSoon
                    ? "text-muted-foreground/30 cursor-not-allowed bg-transparent opacity-40"
                    : model === m.id
                      ? "text-primary-foreground bg-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50 cursor-pointer"
                }`}
              >
                {m.label}
                {m.comingSoon && <span className="block font-mono text-[8px] mt-0.5 normal-case tracking-wide">Soon</span>}
              </button>
            ))}
          </div>
        </section>

        {/* Prompt */}
        <section>
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Describe Your Ring</h3>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: Create a rose ring with three blooming roses, twisted vine band with thorns, and diamond accents"
            className="w-full min-h-[100px] px-4 py-4 text-[13px] text-foreground placeholder:text-muted-foreground/50 resize-y font-body leading-relaxed transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-ring bg-muted/30 border border-border"
          />

          {/* Insufficient credits inline block */}
          {creditBlock && <div className="mt-4">{creditBlock}</div>}

          {/* Generate button */}
          {!creditBlock && (
            <button
              onClick={onGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-4 mt-4 text-[13px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isGenerating ? "Generating…" : (
                <>
                  Generate Ring
                  <span className="inline-flex items-center gap-1 ml-1 opacity-80">
                    <img src={creditCoinIcon} alt="" className="w-4 h-4" />
                    <span className="text-[11px] font-mono">{TOOL_COSTS.ring_full_pipeline ?? '—'}</span>
                  </span>
                </>
              )}
            </button>
          )}

          {/* Upload GLB */}
          <input type="file" ref={glbInputRef} accept=".glb,.gltf" className="hidden" onChange={handleGlbUpload} />
          <button
            onClick={() => glbInputRef.current?.click()}
            disabled={isGenerating || !hasModel}
            className="w-full py-3.5 mt-3 text-[12px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:text-foreground flex items-center justify-center gap-2.5 bg-muted/30 border border-border"
          >
            <span className="w-6 h-6 rounded-full border border-primary/60 flex items-center justify-center shrink-0 shadow-[0_0_8px_hsl(var(--primary)/0.4)] text-primary">
              <Diamond className="w-3 h-3" />
            </span>
            Upload Ring Part
          </button>

          {/* Remove Magic Textures */}
          {hasModel && (
            <button
              onClick={onMagicTexture}
              disabled={isGenerating}
              className="w-full py-3.5 mt-3 text-[12px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 text-destructive/80 disabled:opacity-30 disabled:cursor-not-allowed hover:text-destructive bg-destructive/5 border border-border"
            >
              ✕ Remove Magic Textures
            </button>
          )}
        </section>

        {/* Modules */}
        <AnimatePresence>
          {hasModel && modules.length > 0 && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Components</h3>
              <div className="flex flex-wrap gap-1.5">
                {modules.map((mod) => (
                  <button
                    key={mod}
                    onClick={() => toggleModule(mod)}
                    className={`px-4 py-2.5 text-[11px] font-semibold cursor-pointer transition-all duration-200 tracking-wide border ${
                      selectedModules.includes(mod)
                        ? "text-foreground bg-accent border-border"
                        : "text-muted-foreground hover:text-foreground bg-muted/20 border-border/50"
                    }`}
                  >
                    {mod}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[9px] text-muted-foreground/60 mt-2 tracking-wide">Click a component to target your edits</p>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Edit section */}
        <AnimatePresence>
          {hasModel && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative p-5 bg-muted/30 border border-border"
            >
              <h3 className="font-display text-lg tracking-[0.15em] text-foreground uppercase mb-1">Edit Your Ring</h3>
              <p className="font-mono text-[10px] text-muted-foreground mb-4 tracking-wide">Describe changes, rebuild parts, or add new elements</p>

              {/* Text edit prompt */}
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Describe what to change, e.g.: Make the roses larger, add more petals, twist the band tighter"
                className="w-full min-h-[70px] px-4 py-3.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 resize-y font-body transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-ring bg-muted/30 border border-border"
              />

              <button
                onClick={onEdit}
                disabled={isGenerating || !editPrompt.trim()}
                className="w-full py-4 mt-3 text-[13px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                Apply Edit
                <span className="inline-flex items-center gap-1 ml-1 opacity-80">
                  <img src={creditCoinIcon} alt="" className="w-4 h-4" />
                  <span className="text-[11px] font-mono">{TOOL_COSTS.ring_full_pipeline ?? '—'}</span>
                </span>
              </button>

              {/* ═══ PRIMARY PART TOOLS ═══ */}
              <div className="mt-6 space-y-3">
                <h4 className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Part Tools</h4>

                {/* Rebuild Parts — primary card */}
                <div className="border-2 border-border bg-card p-4">
                  <button
                    onClick={() => setRebuildOpen(!rebuildOpen)}
                    className="w-full flex items-center justify-between cursor-pointer"
                  >
                    <div className="text-left">
                      <span className="font-display text-base tracking-[0.12em] text-foreground uppercase block">⚙ Rebuild Parts</span>
                      <span className="font-mono text-[10px] text-muted-foreground mt-1 block">Select and regenerate any component with a new description</span>
                    </div>
                    {rebuildOpen
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    }
                  </button>
                  <AnimatePresence>
                    {rebuildOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 space-y-3">
                          <div className="grid grid-cols-2 gap-1.5">
                            {PART_REGEN_PARTS.map((part, idx) => (
                              <button
                                key={part.id}
                                onClick={() => setSelectedPart(part.id)}
                                className={`py-2.5 text-[10px] font-semibold uppercase tracking-wide cursor-pointer transition-all duration-150 border text-center ${
                                  PART_REGEN_PARTS.length % 2 !== 0 && idx === PART_REGEN_PARTS.length - 1 ? "col-span-2" : ""
                                } ${
                                  selectedPart === part.id
                                    ? "text-primary-foreground bg-primary border-primary"
                                    : "text-muted-foreground hover:text-foreground bg-muted/20 border-border/50"
                                }`}
                              >
                                {part.icon} {part.label}
                              </button>
                            ))}
                          </div>
                          <input
                            value={rebuildDesc}
                            onChange={(e) => setRebuildDesc(e.target.value)}
                            placeholder="How should this part look..."
                            className="w-full px-4 py-3 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring font-body bg-muted/30 border border-border"
                          />
                          <button
                            disabled={!selectedPart}
                            className="w-full py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
                          >
                            ⚙ Rebuild This Part
                            <span className="inline-flex items-center gap-1 ml-1 opacity-80">
                              <img src={creditCoinIcon} alt="" className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-mono">{TOOL_COSTS.ring_full_pipeline ?? '—'}</span>
                            </span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Add Parts — primary card */}
                <div className="border-2 border-border bg-card p-4">
                  <button
                    onClick={() => setAddPartOpen(!addPartOpen)}
                    className="w-full flex items-center justify-between cursor-pointer"
                  >
                    <div className="text-left">
                      <span className="font-display text-base tracking-[0.12em] text-foreground uppercase block">✚ Add Parts</span>
                      <span className="font-mono text-[10px] text-muted-foreground mt-1 block">Generate a new element and add it to your ring</span>
                    </div>
                    {addPartOpen
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    }
                  </button>
                  <AnimatePresence>
                    {addPartOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 space-y-3">
                          <input
                            value={newPartDesc}
                            onChange={(e) => setNewPartDesc(e.target.value)}
                            placeholder="Describe a new part to add..."
                            className="w-full px-4 py-3 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring font-body bg-muted/30 border border-border"
                          />
                          <button
                            className="w-full py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                          >
                            ✚ Add to Ring
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Status bar */}
      <div className="px-5 py-3 flex items-center gap-2.5 font-mono text-[10px] border-t border-border bg-card">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isGenerating ? "bg-yellow-400 animate-pulse" : "bg-green-400"
        }`} />
        <span className="text-muted-foreground tracking-wide">{isGenerating ? "Processing…" : "Ready"}</span>
      </div>
    </div>
  );
}
