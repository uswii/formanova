import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { normalizeImageFile } from '@/lib/image-normalize';

export interface InspirationRef {
  id: string;
  file: File;
  preview: string;
}

interface InspirationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imagePreview: string;
  imageIndex: number;
  inspiration: InspirationRef | null;
  onInspirationChange: (ref: InspirationRef | null) => void;
  globalInspiration?: { preview: string } | null;
  disabled?: boolean;
}

const InspirationModal = ({
  open,
  onOpenChange,
  imagePreview,
  imageIndex,
  inspiration,
  onInspirationChange,
  globalInspiration,
  disabled = false,
}: InspirationModalProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enlargedPreview, setEnlargedPreview] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const normalized = await normalizeImageFile(file);
    const ref: InspirationRef = {
      id: `insp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      file: normalized,
      preview: URL.createObjectURL(normalized),
    };
    onInspirationChange(ref);
  }, [onInspirationChange]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const handleRemove = useCallback(() => {
    if (inspiration) {
      URL.revokeObjectURL(inspiration.preview);
      onInspirationChange(null);
    }
  }, [inspiration, onInspirationChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-base uppercase tracking-wide">
            Inspiration — Image {imageIndex + 1}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Source image reference */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg overflow-hidden border border-border/50 flex-shrink-0">
              <img src={imagePreview} alt={`Image ${imageIndex + 1}`} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-foreground font-medium">Product image {imageIndex + 1}</p>
              {globalInspiration && !inspiration && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Currently using the global mood board
                </p>
              )}
              {inspiration && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Using a custom mood board for this image
                </p>
              )}
            </div>
          </div>

          {/* Inspiration upload area */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload an inspirational image to guide the style, lighting, and vibe for this specific product.
              {globalInspiration && ' This will override the global mood board for this image only.'}
            </p>

            <AnimatePresence mode="wait">
              {inspiration ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="space-y-2"
                >
                  {/* Thumbnail row */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                    <button
                      type="button"
                      onClick={() => setEnlargedPreview(inspiration.preview)}
                      className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 border border-border/50 hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer"
                    >
                      <img src={inspiration.preview} alt="Inspiration reference" className="w-full h-full object-cover" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-foreground/80 font-medium">Custom inspiration</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Click thumbnail to enlarge</p>
                    </div>
                    <button
                      onClick={handleRemove}
                      disabled={disabled}
                      className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Replace action */}
                  <label className="block text-center cursor-pointer">
                    <span className="text-[10px] text-muted-foreground hover:text-foreground transition-colors font-mono uppercase tracking-wide">
                      Replace
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileInput}
                      disabled={disabled}
                      className="sr-only"
                    />
                  </label>
                </motion.div>
              ) : (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  <label className="flex items-center justify-center gap-2 py-4 px-4 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/20 hover:border-border cursor-pointer transition-all">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Add inspiration image</span>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInput}
                      disabled={disabled}
                      className="sr-only"
                    />
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Enlarged preview overlay */}
        <AnimatePresence>
          {enlargedPreview && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"
              onClick={() => setEnlargedPreview(null)}
            >
              <motion.img
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
                src={enlargedPreview}
                alt="Enlarged inspiration"
                className="max-w-full max-h-full rounded-lg object-contain"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default InspirationModal;
