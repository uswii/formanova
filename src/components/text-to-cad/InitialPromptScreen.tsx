import { useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, X, Diamond } from "lucide-react";
import { AI_MODELS } from "./types";

const EXAMPLE_PROMPTS = [
  "Serpentine ring with a coiled snake design",
  "Sculptural flowing gold band",
  "Botanical ring with leaves wrapping around the band",
  "Gothic ring with sharp arches and dark gemstones",
  "Twisted vine ring with small diamonds",
  "Minimalist ring with a single oval diamond",
];

interface InitialPromptScreenProps {
  model: string;
  setModel: (m: string) => void;
  prompt: string;
  setPrompt: (p: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  onGlbUpload: (file: File) => void;
  creditBlock?: React.ReactNode;
}

export default function InitialPromptScreen({
  model, setModel, prompt, setPrompt,
  isGenerating, onGenerate, onGlbUpload, creditBlock,
}: InitialPromptScreenProps) {
  const glbInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleGlbUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onGlbUpload(file);
  }, [onGlbUpload]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !isGenerating) onGenerate();
    }
  };

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, []);

  useEffect(() => {
    autoResize();
  }, [prompt, autoResize]);

  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[1100px] px-6"
      >
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl md:text-5xl tracking-[0.2em] text-foreground uppercase mb-2">
            Text‑to‑3D
          </h1>
          <p className="font-mono text-[11px] text-muted-foreground tracking-[0.15em] uppercase">
            Describe your ring or upload a CAD file
          </p>
        </div>

        {/* Generation Quality */}
        <div className="mb-4 max-w-[680px] mx-auto">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Generation Quality
          </h3>
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
        </div>

        {/* Prompt */}
        <div className="mb-3 relative max-w-[680px] mx-auto">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your ring — e.g. A rose ring with three blooming roses, twisted vine band with thorns, and diamond accents"
            rows={4}
            className="w-full min-h-[130px] max-h-[240px] px-5 py-4 pr-10 text-[15px] text-foreground placeholder:text-muted-foreground/40 resize-none font-body leading-relaxed transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-ring bg-muted/20 border border-border overflow-y-auto"
            style={{ overflow: prompt.length < 200 ? "hidden" : "auto" }}
          />
          {prompt.length > 0 && (
            <button
              onClick={() => setPrompt("")}
              className="absolute top-3 right-3 p-1 rounded-sm text-muted-foreground/40 hover:text-foreground transition-colors"
              aria-label="Clear prompt"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Credit block */}
        {creditBlock && <div className="mb-3 max-w-[680px] mx-auto">{creditBlock}</div>}

        {/* Generate */}
        {!creditBlock && (
          <div className="max-w-[680px] mx-auto">
            <button
              onClick={onGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-4 text-[13px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
            >
              {isGenerating ? "Generating…" : "Generate Ring"}
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-4 my-4 max-w-[680px] mx-auto">
          <div className="flex-1 h-px bg-border" />
          <span className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-[0.2em]">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Upload GLB */}
        <div className="max-w-[680px] mx-auto">
          <input type="file" ref={glbInputRef} accept=".glb,.gltf" className="hidden" onChange={handleGlbUpload} />
          <button
            onClick={() => glbInputRef.current?.click()}
            disabled={isGenerating}
            className="w-full py-3.5 text-[12px] font-bold uppercase tracking-[0.2em] cursor-pointer transition-all duration-200 text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:text-foreground flex items-center justify-center gap-2 bg-muted/20 border border-border"
          >
            <Diamond className="w-4 h-4" /> Upload CAD File
          </button>
        </div>

        {/* Example Prompts */}
        <div className="mt-6">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Try an example
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="px-3 py-2.5 text-[12px] font-body text-muted-foreground hover:text-foreground border border-border hover:border-foreground/20 hover:bg-accent/30 transition-all duration-150 cursor-pointer text-left"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
