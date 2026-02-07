import { useCallback, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Plus, AlertTriangle, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useImageValidation } from '@/hooks/use-image-validation';
import { useIsMobile } from '@/hooks/use-mobile';
import { normalizeImageFile, normalizeImageFiles } from '@/lib/image-normalize';
import InspirationModal from './InspirationModal';
import type { InspirationRef } from './InspirationModal';

export type SkinTone = 'fair' | 'light' | 'medium' | 'tan' | 'dark' | 'deep';

const SKIN_TONES: { id: SkinTone; color: string; label: string }[] = [
  { id: 'fair', color: '#FFE0BD', label: 'Fair' },
  { id: 'light', color: '#F5D0B0', label: 'Light' },
  { id: 'medium', color: '#C8A27C', label: 'Medium' },
  { id: 'tan', color: '#A67C52', label: 'Tan' },
  { id: 'dark', color: '#6B4423', label: 'Dark' },
  { id: 'deep', color: '#3D2314', label: 'Deep' },
];

export { type InspirationRef } from './InspirationModal';

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  flagged?: boolean;
  flagReason?: string;
  skinTone?: SkinTone;
  inspiration?: InspirationRef | null;
}

interface BulkUploadZoneProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  disabled?: boolean;
  category?: string;
  showSkinTone?: boolean;
  defaultSkinTone?: SkinTone;
  globalInspiration?: InspirationRef | null;
  onGlobalInspirationChange?: (image: InspirationRef | null) => void;
}

const BulkUploadZone = ({
  images,
  onImagesChange,
  maxImages = 10,
  disabled = false,
  category = 'jewelry',
  showSkinTone = false,
  defaultSkinTone = 'medium',
  globalInspiration = null,
  onGlobalInspirationChange,
}: BulkUploadZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [inspirationModalImageId, setInspirationModalImageId] = useState<string | null>(null);
  const globalInspirationInputRef = useRef<HTMLInputElement>(null);
  const { validateImages, isValidating, error: validationError } = useImageValidation();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (validationError) {
      toast.warning('Image validation unavailable', {
        description: 'Uploads will proceed without quality checks',
        duration: 5000,
      });
    }
  }, [validationError]);

  // ── File handling ──────────────────────────────────────────────

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || disabled) return;
    const remainingSlots = maxImages - images.length;
    const rawFiles = Array.from(files).slice(0, remainingSlots).filter(f => f.type.startsWith('image/'));
    const normalizedFiles = await normalizeImageFiles(rawFiles);

    const newImages: UploadedImage[] = normalizedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      skinTone: defaultSkinTone,
    }));

    const allImages = [...images, ...newImages];
    onImagesChange(allImages);

    if (newImages.length > 0) {
      const filesToValidate = newImages.map(img => img.file);
      const validationResult = await validateImages(filesToValidate, category);

      if (validationResult && validationResult.flagged_count > 0) {
        const updatedImages = allImages.map((img, idx) => {
          const originalIdx = idx - images.length;
          if (originalIdx >= 0 && originalIdx < validationResult.results.length) {
            const result = validationResult.results[originalIdx];
            if (result.flags.length > 0) {
              return { ...img, flagged: true, flagReason: result.message || 'Image may not meet requirements' };
            }
          }
          return img;
        });
        onImagesChange(updatedImages);
        toast.warning(`${validationResult.flagged_count} image(s) flagged`, {
          description: 'These may not be worn jewelry photos',
          duration: 5000,
        });
      }
    }
  }, [images, onImagesChange, maxImages, disabled, category, validateImages, defaultSkinTone]);

  // Paste handler
  useEffect(() => {
    if (disabled) return;
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        const remainingSlots = maxImages - images.length;
        const filesToAdd = imageFiles.slice(0, remainingSlots);
        const normalizedFiles = await normalizeImageFiles(filesToAdd);
        const newImages: UploadedImage[] = normalizedFiles.map(file => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview: URL.createObjectURL(file),
          skinTone: defaultSkinTone,
        }));
        onImagesChange([...images, ...newImages]);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [images, onImagesChange, maxImages, disabled, defaultSkinTone]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  }, [handleFiles]);

  // ── Per-image handlers ─────────────────────────────────────────

  const handleSkinToneChange = useCallback((imageId: string, tone: SkinTone) => {
    const updated = images.map(img => img.id === imageId ? { ...img, skinTone: tone } : img);
    onImagesChange(updated);
  }, [images, onImagesChange]);

  const handleApplyToneToAll = useCallback((tone: SkinTone) => {
    const updated = images.map(img => ({ ...img, skinTone: tone }));
    onImagesChange(updated);
  }, [images, onImagesChange]);

  const handleRemoveImage = useCallback((imageId: string) => {
    const img = images.find(i => i.id === imageId);
    if (img) {
      URL.revokeObjectURL(img.preview);
      if (img.inspiration) URL.revokeObjectURL(img.inspiration.preview);
    }
    if (inspirationModalImageId === imageId) setInspirationModalImageId(null);
    onImagesChange(images.filter(i => i.id !== imageId));
  }, [images, onImagesChange, inspirationModalImageId]);

  const handlePerImageInspirationChange = useCallback((imageId: string, ref: InspirationRef | null) => {
    const updated = images.map(img => {
      if (img.id !== imageId) return img;
      if (img.inspiration && ref) URL.revokeObjectURL(img.inspiration.preview);
      return { ...img, inspiration: ref };
    });
    onImagesChange(updated);
  }, [images, onImagesChange]);

  // ── Global inspiration ─────────────────────────────────────────

  const handleGlobalInspirationFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const normalized = await normalizeImageFile(file);
    const ref: InspirationRef = {
      id: `insp-global-${Date.now()}`,
      file: normalized,
      preview: URL.createObjectURL(normalized),
    };
    onGlobalInspirationChange?.(ref);
  }, [onGlobalInspirationChange]);

  const handleRemoveGlobalInspiration = useCallback(() => {
    if (globalInspiration) URL.revokeObjectURL(globalInspiration.preview);
    onGlobalInspirationChange?.(null);
  }, [globalInspiration, onGlobalInspirationChange]);

  const canAddMore = images.length < maxImages;

  // Inspiration modal state
  const inspirationModalImage = inspirationModalImageId ? images.find(i => i.id === inspirationModalImageId) : null;
  const inspirationModalIndex = inspirationModalImage ? images.indexOf(inspirationModalImage) : -1;

  // ── Empty state ────────────────────────────────────────────────

  if (images.length === 0) {
    return (
      <motion.label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative block w-full aspect-[4/3] marta-frame cursor-pointer transition-all duration-200 ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : isDragOver
              ? 'border-primary bg-primary/5'
              : 'hover:border-foreground/40 hover:bg-muted/20'
        }`}
        whileHover={disabled ? {} : { scale: 1.005 }}
        whileTap={disabled ? {} : { scale: 0.995 }}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          disabled={disabled}
          className="sr-only"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
            <Upload className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm text-foreground font-medium">
              {isMobile ? 'Tap to add photos' : 'Click to upload or drag'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isMobile ? 'or select from gallery' : 'paste with Ctrl+V'}
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            Up to {maxImages} images
          </span>
        </div>
      </motion.label>
    );
  }

  // ── Grid with uploaded images ──────────────────────────────────

  return (
    <div className="space-y-0 w-full">
      {/* ── Global Control Bar (non-scrolling, above grid) ── */}
      <div className="border-b border-border/40 bg-background px-3 sm:px-4 py-3 space-y-2.5">
        {/* Explanation — appears once */}
        <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
          You can optionally upload inspirational images or mood board images to guide the model's style, lighting, and overall vibe.
        </p>

        {/* Concise global actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-5">
          {/* Model skin tone — apply to all */}
          {showSkinTone && images.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide whitespace-nowrap">
                Model skin tone — apply to all
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-muted-foreground/60 font-mono uppercase">Light</span>
                {SKIN_TONES.map((tone) => (
                  <button
                    key={tone.id}
                    onClick={() => !disabled && handleApplyToneToAll(tone.id)}
                    disabled={disabled}
                    title={`Set all to ${tone.label}`}
                    className="relative w-5 h-5 rounded-full transition-all duration-150 cursor-pointer hover:scale-110"
                    style={{ backgroundColor: tone.color }}
                  />
                ))}
                <span className="text-[8px] text-muted-foreground/60 font-mono uppercase">Deep</span>
              </div>
            </div>
          )}

          {/* Mood board — apply to all */}
          {onGlobalInspirationChange && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide whitespace-nowrap">
                Mood board — apply to all
              </span>
              {globalInspiration ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded overflow-hidden border border-border/50">
                    <img src={globalInspiration.preview} alt="" className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={handleRemoveGlobalInspiration}
                    disabled={disabled}
                    className="text-[10px] text-muted-foreground hover:text-destructive font-mono uppercase tracking-wide transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="text-[10px] text-primary hover:text-primary/80 font-mono uppercase tracking-wide cursor-pointer transition-colors">
                  Add
                  <input
                    ref={globalInspirationInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleGlobalInspirationFile(file);
                      e.target.value = '';
                    }}
                    disabled={disabled}
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Responsive image grid ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 p-2 sm:p-4">
        <AnimatePresence mode="popLayout">
          {images.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              layout
              className="group space-y-1.5"
            >
              {/* Image tile */}
              <div className={`relative aspect-square bg-muted/30 rounded-lg sm:rounded-xl overflow-hidden cursor-pointer transition-all duration-200 ${
                image.flagged ? 'ring-2 ring-amber-500/70' : ''
              }`}>
                <img
                  src={image.preview}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Remove button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveImage(image.id); }}
                  disabled={disabled}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                >
                  <span className="text-xs font-bold">✕</span>
                </button>
                {/* Flagged indicator */}
                {image.flagged && (
                  <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center" title={image.flagReason || 'Image may not meet requirements'}>
                    <AlertTriangle className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                {/* Mood badge */}
                {image.inspiration && (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-foreground/70 backdrop-blur-sm">
                    <span className="text-[8px] font-mono text-background uppercase">Mood</span>
                  </div>
                )}
                {/* Number badge */}
                <div className="absolute bottom-2 left-2 w-8 h-8 rounded-lg bg-background/80 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-sm font-mono text-foreground">{index + 1}</span>
                </div>
              </div>

              {/* ── Per-image controls (minimal overrides) ── */}
              <div className="space-y-1 px-0.5">
                {/* Model skin tone (this image only) */}
                {showSkinTone && (
                  <div className="space-y-0.5">
                    <span className="block text-[9px] text-muted-foreground font-mono uppercase tracking-wide text-center">
                      Model skin tone <span className="text-muted-foreground/40">(this image only)</span>
                    </span>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[8px] text-muted-foreground font-mono uppercase tracking-wide">Light</span>
                      {SKIN_TONES.map((tone) => {
                        const isToneSelected = (image.skinTone || defaultSkinTone) === tone.id;
                        return (
                          <button
                            key={tone.id}
                            onClick={() => !disabled && handleSkinToneChange(image.id, tone.id)}
                            disabled={disabled}
                            title={tone.label}
                            className={`relative w-5 h-5 rounded-full transition-all duration-150 ${
                              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-110'
                            }`}
                            style={{ backgroundColor: tone.color }}
                          >
                            {isToneSelected && (
                              <motion.div
                                layoutId={`skin-ring-${image.id}`}
                                className="absolute inset-[-2px] rounded-full border-2 border-primary"
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              />
                            )}
                            {isToneSelected && (
                              <Check className="w-3 h-3 absolute inset-0 m-auto text-white drop-shadow-md" />
                            )}
                          </button>
                        );
                      })}
                      <span className="text-[8px] text-muted-foreground font-mono uppercase tracking-wide">Deep</span>
                    </div>
                  </div>
                )}

                {/* Inspiration (this image only) — minimal Add action */}
                <div className="text-center">
                  {image.inspiration ? (
                    <button
                      onClick={() => setInspirationModalImageId(image.id)}
                      className="text-[9px] text-primary font-mono uppercase tracking-wide hover:text-primary/80 transition-colors"
                    >
                      Mood board set · Edit
                    </button>
                  ) : (
                    <button
                      onClick={() => setInspirationModalImageId(image.id)}
                      className="text-[9px] text-muted-foreground/60 font-mono uppercase tracking-wide hover:text-foreground/80 transition-colors"
                    >
                      Add inspiration <span className="text-muted-foreground/30">(optional)</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add more tile */}
        {canAddMore && (
          <motion.label
            layout
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative aspect-square rounded-lg sm:rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 flex items-center justify-center ${
              disabled
                ? 'opacity-50 cursor-not-allowed border-muted'
                : isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/30 hover:border-foreground/50 hover:bg-muted/20'
            }`}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileInput}
              disabled={disabled}
              className="sr-only"
            />
            <Plus className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground" />
          </motion.label>
        )}
      </div>

      {/* Counter and status */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-2 sm:px-4 pb-2">
        <div className="flex items-center gap-2">
          <span>{images.length} of {maxImages}</span>
          {isValidating && (
            <span className="flex items-center gap-1 text-primary">
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking…
            </span>
          )}
        </div>
        {!isMobile && <span className="text-[10px]">Ctrl+V to paste</span>}
      </div>

      {/* ── Per-image Inspiration Modal ────────────────────────── */}
      {inspirationModalImage && (
        <InspirationModal
          open={!!inspirationModalImageId}
          onOpenChange={(open) => { if (!open) setInspirationModalImageId(null); }}
          imagePreview={inspirationModalImage.preview}
          imageIndex={inspirationModalIndex}
          inspiration={inspirationModalImage.inspiration ?? null}
          onInspirationChange={(ref) => handlePerImageInspirationChange(inspirationModalImage.id, ref)}
          globalInspiration={globalInspiration}
          disabled={disabled}
        />
      )}
    </div>
  );
};

export default BulkUploadZone;
