import { useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Upload } from "lucide-react";
import { AI_MODELS, QUICK_EDITS } from "./types";

interface LeftPanelProps {
  model: string;
  setModel: (m: string) => void;
  prompt: string;
  setPrompt: (p: string) => void;
  editPrompt: string;
  setEditPrompt: (p: string) => void;
  refImage: string | null;
  setRefImage: (img: string | null) => void;
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
}

const glassBtn = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
  backdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 2px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
};

const primaryBtn = {
  background: "linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)",
  boxShadow: "0 4px 20px rgba(255,255,255,0.15), 0 0 1px rgba(255,255,255,0.3)",
  border: "none",
  fontFamily: "Inter, sans-serif",
};

const editActionBtn = {
  background: "linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)",
  boxShadow: "0 4px 20px rgba(255,255,255,0.15), 0 0 1px rgba(255,255,255,0.3)",
  border: "none",
  fontFamily: "Inter, sans-serif",
};

export default function LeftPanel({
  model, setModel, prompt, setPrompt, editPrompt, setEditPrompt,
  refImage, setRefImage, selectedModules, toggleModule,
  isGenerating, isEditing, hasModel, modules,
  onGenerate, onEdit, onQuickEdit, onMagicTexture, onGlbUpload,
}: LeftPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const glbInputRef = useRef<HTMLInputElement>(null);

  const handleRefImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRefImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, [setRefImage]);

  const handleGlbUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onGlbUpload(file);
  }, [onGlbUpload]);

  return (
    <div className="w-[400px] flex-shrink-0 flex flex-col"
      style={{
        background: "linear-gradient(180deg, rgba(22,22,22,0.96) 0%, rgba(12,12,12,0.98) 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "4px 0 30px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-5" style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg, rgba(28,28,28,0.92) 0%, rgba(18,18,18,0.96) 100%)",
        backdropFilter: "blur(20px)",
      }}>
        <h1 className="text-xl font-extralight tracking-[6px] text-white">
          <span className="font-normal">♦</span> TEXT-TO-3D JEWELRY
        </h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* AI Model */}
        <section className="mb-5">
          <h3 className="text-[10px] uppercase tracking-[2px] text-[#777] font-semibold mb-2.5">AI Model</h3>
          <div className="flex gap-2.5">
            {AI_MODELS.map((m) => (
              <label key={m.id} className={`flex-1 ${m.comingSoon ? 'cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => !m.comingSoon && setModel(m.id)}>
                <div className={`flex flex-col items-center py-4 px-2 rounded-xl transition-all duration-200 relative ${
                  m.comingSoon
                    ? "text-[#555] opacity-50"
                    : model === m.id
                      ? "text-white shadow-[0_0_16px_rgba(255,255,255,0.08)]"
                      : "text-[#888] hover:text-white"
                }`} style={{
                  background: model === m.id && !m.comingSoon
                    ? "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)"
                    : "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
                  backdropFilter: "blur(16px)",
                  border: model === m.id && !m.comingSoon
                    ? "1px solid rgba(255,255,255,0.25)"
                    : "1px solid rgba(255,255,255,0.06)",
                }}>
                  <span className="text-[13px] font-semibold tracking-[0.5px]">{m.name}</span>
                  <span className="text-[9px] text-[#666] mt-0.5 tracking-[0.5px]">{m.comingSoon ? "Coming Soon" : m.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Prompt */}
        <section className="mb-5">
          <h3 className="text-[10px] uppercase tracking-[2px] text-[#777] font-semibold mb-2.5">Describe Your Ring</h3>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: Create a rose ring with three blooming roses, twisted vine band with thorns, and diamond accents"
            className="w-full min-h-[90px] px-4 py-3.5 rounded-xl text-[13px] text-[#e0e0e0] placeholder:text-[#555] resize-y font-[Inter] leading-relaxed transition-all duration-200 focus:outline-none"
            style={{
              ...glassBtn,
              background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
            }}
          />

          {/* Image upload */}
          <div className="mt-2">
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleRefImage} />
            {!refImage ? (
              <label
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 cursor-pointer px-3 py-2.5 rounded-lg transition-all duration-200 hover:border-white/15"
                style={{
                  border: "1px dashed rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <svg width="16" height="16" fill="none" stroke="#888" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
                <span className="text-[11px] text-[#888]">Attach reference image (optional)</span>
              </label>
            ) : (
              <div className="relative mt-1.5 inline-block">
                <img src={refImage} alt="Reference" className="max-w-full max-h-[120px] rounded-md" style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
                <button
                  onClick={() => setRefImage(null)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs cursor-pointer"
                  style={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Generate button */}
          <button
            onClick={onGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-4 mt-3 rounded-xl text-[14px] font-bold uppercase tracking-[2px] cursor-pointer transition-all duration-200 text-black disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_6px_30px_rgba(255,255,255,0.2)] hover:scale-[1.01] active:scale-[0.99]"
            style={primaryBtn}
          >
            {isGenerating && !isEditing ? "Generating…" : "Generate Ring"}
          </button>


          {/* Magic Texturing */}
          {hasModel && (
            <button
              onClick={onMagicTexture}
              disabled={isGenerating}
              className="w-full py-3.5 mt-3 rounded-xl text-[13px] font-bold uppercase tracking-[2px] cursor-pointer transition-all duration-200 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_4px_20px_rgba(255,255,255,0.08)]"
              style={{
                ...glassBtn,
                background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)",
              }}
            >
              ✨ Magic Texturing
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
              className="mb-5"
            >
              <h3 className="text-[10px] uppercase tracking-[2px] text-[#777] font-semibold mb-2.5">Components</h3>
              <div className="flex flex-wrap gap-1.5">
                {modules.map((mod) => (
                  <button
                    key={mod}
                    onClick={() => toggleModule(mod)}
                    className={`px-4 py-2 rounded-full text-[12px] font-semibold cursor-pointer transition-all duration-200 tracking-[0.5px] ${
                      selectedModules.includes(mod)
                        ? "text-white shadow-[0_0_12px_rgba(255,255,255,0.08)]"
                        : "text-[#999] hover:text-white"
                    }`}
                    style={{
                      background: selectedModules.includes(mod)
                        ? "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.06) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                      backdropFilter: "blur(12px)",
                      border: `1px solid ${selectedModules.includes(mod) ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    {mod}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#555] mt-1">Click a component to target your edits</p>
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
              className="relative rounded-xl p-5"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              {/* Badge */}
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-extrabold tracking-[3px] uppercase px-4 py-1 rounded-full text-black whitespace-nowrap"
                style={primaryBtn}
              >
                Edit Your Ring
              </div>

              <h3 className="text-[12px] text-white tracking-[2px] font-semibold uppercase mb-1 mt-2">✎ Edit Your Ring</h3>
              <p className="text-[11px] text-[#999] mb-2.5 tracking-[0.5px]">Describe changes below or use the quick edit buttons</p>

              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Describe what to change, e.g.: Make the roses larger, add more petals, twist the band tighter"
                className="w-full min-h-[70px] px-4 py-3 rounded-xl text-[14px] text-[#e0e0e0] placeholder:text-[#555] resize-y font-[Inter] transition-all duration-200 focus:outline-none"
                style={{
                  ...glassBtn,
                  background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                }}
              />

              <button
                onClick={onEdit}
                disabled={isGenerating || !editPrompt.trim()}
                className="w-full py-4 mt-2.5 rounded-xl text-[14px] font-bold uppercase tracking-[2px] cursor-pointer transition-all duration-200 text-black disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_6px_30px_rgba(255,255,255,0.2)] hover:scale-[1.01] active:scale-[0.99]"
                style={editActionBtn}
              >
                ✎ APPLY EDIT
              </button>

              {/* Quick edits grid */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {QUICK_EDITS.map((qe) => (
                  <button
                    key={qe.id}
                    onClick={() => onQuickEdit(qe.preset)}
                    className="py-3 px-3 rounded-xl text-center cursor-pointer transition-all duration-200 hover:text-white hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      ...glassBtn,
                      color: "#aaa",
                      fontFamily: "Inter, sans-serif",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                      e.currentTarget.style.background = "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                      e.currentTarget.style.background = "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)";
                    }}
                  >
                    <span className="block text-[20px] mb-1">{qe.icon}</span>
                    <span className="block text-[10px] font-bold uppercase tracking-[1px]">{qe.label}</span>
                    <span className="block text-[9px] text-[#666] mt-0.5">{qe.desc}</span>
                  </button>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Status bar */}
      <div className="px-5 py-2.5 flex items-center gap-2.5 text-[10px]"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, rgba(18,18,18,0.94) 0%, rgba(12,12,12,0.98) 100%)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isGenerating ? "bg-[#facc15] animate-pulse" : "bg-[#4ade80]"
        }`} />
        <span className="text-[#999]">{isGenerating ? "Processing…" : "Ready"}</span>
      </div>
    </div>
  );
}
