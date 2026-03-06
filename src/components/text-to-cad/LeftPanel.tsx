import { useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Upload } from "lucide-react";
import { AI_MODELS, QUICK_EDITS } from "./types";

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

  const handleGlbUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onGlbUpload(file);
  }, [onGlbUpload]);

  return (
    <div className="w-[400px] flex-shrink-0 flex flex-col"
      style={{
        background: "rgba(12,12,12,0.98)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <h1 className="font-display text-2xl tracking-[0.15em] text-white uppercase">
          Text‑to‑3D Jewelry
        </h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* AI Model */}
        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">AI Model</h3>
          <div className="flex gap-2.5">
            {AI_MODELS.map((m) => (
              <label key={m.id} className={`flex-1 ${m.comingSoon ? 'cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => !m.comingSoon && setModel(m.id)}>
                <div className={`flex flex-col items-center py-4 px-2 transition-all duration-200 relative ${
                  m.comingSoon
                    ? "text-[#555] opacity-50"
                    : model === m.id
                      ? "text-white"
                      : "text-[#888] hover:text-white"
                }`} style={{
                  background: model === m.id && !m.comingSoon
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.02)",
                  border: model === m.id && !m.comingSoon
                    ? "1px solid rgba(255,255,255,0.2)"
                    : "1px solid rgba(255,255,255,0.06)",
                }}>
                  <span className="text-[13px] font-semibold tracking-wide">{m.name}</span>
                  <span className="font-mono text-[9px] text-[#666] mt-1 tracking-wide">{m.comingSoon ? "Coming Soon" : m.desc}</span>
                </div>
              </label>
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
            className="w-full min-h-[100px] px-4 py-4 text-[13px] text-[#e0e0e0] placeholder:text-[#444] resize-y font-body leading-relaxed transition-all duration-200 focus:outline-none focus:border-white/15"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />

          {/* Insufficient credits inline block */}
          {creditBlock && <div className="mt-4">{creditBlock}</div>}

          {/* Generate button */}
          {!creditBlock && (
            <button
              onClick={onGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-4 mt-4 text-[13px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 text-black disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
              style={{
                background: "#ffffff",
                border: "none",
              }}
            >
              {isGenerating ? "Generating…" : "Generate Ring"}
            </button>
          )}

          {/* Upload GLB */}
          <input type="file" ref={glbInputRef} accept=".glb,.gltf" className="hidden" onChange={handleGlbUpload} />
          <button
            onClick={() => glbInputRef.current?.click()}
            disabled={isGenerating}
            className="w-full py-3.5 mt-3 text-[12px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 text-[#aaa] disabled:opacity-30 disabled:cursor-not-allowed hover:text-white flex items-center justify-center gap-2"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Upload className="w-4 h-4" /> Upload Ring Part
          </button>

          {/* Remove Magic Textures */}
          {hasModel && (
            <button
              onClick={onMagicTexture}
              disabled={isGenerating}
              className="w-full py-3.5 mt-3 text-[12px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 text-[#aaa] disabled:opacity-30 disabled:cursor-not-allowed hover:text-white"
              style={{
                background: "rgba(255,80,80,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
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
                    className={`px-4 py-2.5 text-[11px] font-semibold cursor-pointer transition-all duration-200 tracking-wide ${
                      selectedModules.includes(mod)
                        ? "text-white"
                        : "text-[#999] hover:text-white"
                    }`}
                    style={{
                      background: selectedModules.includes(mod)
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(255,255,255,0.03)",
                      border: `1px solid ${selectedModules.includes(mod) ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    {mod}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[9px] text-[#555] mt-2 tracking-wide">Click a component to target your edits</p>
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
              className="relative p-5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <h3 className="font-display text-lg tracking-[0.15em] text-white uppercase mb-1">Edit Your Ring</h3>
              <p className="font-mono text-[10px] text-[#777] mb-4 tracking-wide">Describe changes or use the quick edit buttons</p>

              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Describe what to change, e.g.: Make the roses larger, add more petals, twist the band tighter"
                className="w-full min-h-[70px] px-4 py-3.5 text-[13px] text-[#e0e0e0] placeholder:text-[#444] resize-y font-body transition-all duration-200 focus:outline-none focus:border-white/15"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />

              <button
                onClick={onEdit}
                disabled={isGenerating || !editPrompt.trim()}
                className="w-full py-4 mt-3 text-[13px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 text-black disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
                style={{
                  background: "#ffffff",
                  border: "none",
                }}
              >
                Apply Edit
              </button>

              {/* Quick edits grid */}
              <div className="grid grid-cols-2 gap-2 mt-5">
                {QUICK_EDITS.map((qe) => (
                  <button
                    key={qe.id}
                    onClick={() => onQuickEdit(qe.preset)}
                    className="py-3.5 px-3 text-center cursor-pointer transition-all duration-200 text-[#aaa] hover:text-white hover:bg-white/[0.06] active:scale-[0.98]"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span className="block text-[18px] mb-1.5">{qe.icon}</span>
                    <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.15em]">{qe.label}</span>
                    <span className="block font-mono text-[8px] text-[#555] mt-1">{qe.desc}</span>
                  </button>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Status bar */}
      <div className="px-5 py-3 flex items-center gap-2.5 font-mono text-[10px]"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(12,12,12,0.98)" }}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isGenerating ? "bg-[#facc15] animate-pulse" : "bg-[#4ade80]"
        }`} />
        <span className="text-[#999] tracking-wide">{isGenerating ? "Processing…" : "Ready"}</span>
      </div>
    </div>
  );
}
