import { useCallback, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Plus, AlertTriangle, Loader2, Check, ImagePlus, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useImageValidation } from '@/hooks/use-image-validation';
import { useIsMobile } from '@/hooks/use-mobile';
import { normalizeImageFile, normalizeImageFiles } from '@/lib/image-normalize';

export type SkinTone = 'fair' | 'light' | 'medium' | 'tan' | 'dark' | 'deep';

const SKIN_TONES: { id: SkinTone; color: string; label: string }[] = [
  { id: 'fair', color: '#FFE0BD', label: 'Fair' },
  { id: 'light', color: '#F5D0B0', label: 'Light' },
  { id: 'medium', color: '#C8A27C', label: 'Medium' },
  { id: 'tan', color: '#A67C52', label: 'Tan' },
  { id: 'dark', color: '#6B4423', label: 'Dark' },
  { id: 'deep', color: '#3D2314', label: 'Deep' },
];

export interface InspirationRef {
  id: string;
  file: File;
  preview: string;
}

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
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const inspirationInputRef = useRef<HTMLInputElement>(null);
  const globalInspirationInputRef = useRef<HTMLInputElement>(null);
  const { validateImages, isValidating, error: validationError } = useImageValidation();
  const isMobile = useIsMobile();

  // Show toast when validation service has issues
  useEffect(() => {
    if (validationError) {
      toast.warning('Image validation unavailable', {
        description: 'Uploads will proceed without quality checks',
        duration: 5000,
      });
    }
  }, [validationError]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || disabled) return;
    
    const remainingSlots = maxImages - images.length;
    const rawFiles = Array.from(files).slice(0, remainingSlots).filter(f => f.type.startsWith('image/'));
    
    // Normalize unsupported formats to JPG
    const normalizedFiles = await normalizeImageFiles(rawFiles);
    
    const newImages: UploadedImage[] = normalizedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      skinTone: defaultSkinTone,
    }));

    // Add images immediately for responsive UI
    const allImages = [...images, ...newImages];
    onImagesChange(allImages);

    // Run validation in background
    if (newImages.length > 0) {
      const filesToValidate = newImages.map(img => img.file);
      const validationResult = await validateImages(filesToValidate, category);
      
      if (validationResult && validationResult.flagged_count > 0) {
        // Update images with flagged status
        const updatedImages = allImages.map((img, idx) => {
          const originalIdx = idx - images.length;
          if (originalIdx >= 0 && originalIdx < validationResult.results.length) {
            const result = validationResult.results[originalIdx];
            if (result.flags.length > 0) {
              return {
                ...img,
                flagged: true,
                flagReason: result.message || 'Image may not meet requirements',
              };
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
  }, [images, onImagesChange, maxImages, disabled, category, validateImages]);

  // Global paste listener
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
        
        // Normalize formats
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
  }, [images, onImagesChange, maxImages, disabled]);

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
    if (selectedImageId === imageId) setSelectedImageId(null);
    onImagesChange(images.filter(i => i.id !== imageId));
  }, [images, onImagesChange, selectedImageId]);

  const handlePerImageInspiration = useCallback(async (imageId: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    const normalized = await normalizeImageFile(file);
    const ref: InspirationRef = {
      id: `insp-${Date.now()}`,
      file: normalized,
      preview: URL.createObjectURL(normalized),
    };
    const updated = images.map(img => img.id === imageId ? { ...img, inspiration: ref } : img);
    onImagesChange(updated);
  }, [images, onImagesChange]);

  const handleRemovePerImageInspiration = useCallback((imageId: string) => {
    const img = images.find(i => i.id === imageId);
    if (img?.inspiration) URL.revokeObjectURL(img.inspiration.preview);
    const updated = images.map(i => i.id === imageId ? { ...i, inspiration: null } : i);
    onImagesChange(updated);
  }, [images, onImagesChange]);

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

  // Empty state - single large drop zone
  if (images.length === 0) {
    return (
      <motion.label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative block w-full aspect-[4/3] marta-frame border-dashed cursor-pointer transition-all duration-200 ${
          disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : isDragOver 
              ? 'border-formanova-hero-accent bg-formanova-hero-accent/5' 
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

  // Responsive grid when images exist
  return (
    <div className="space-y-3 w-full">
      {/* Apply to all skin tone bar */}
      {showSkinTone && images.length > 1 && (
        <div className="px-2 sm:px-4 py-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide whitespace-nowrap">
              Apply to all
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-muted-foreground font-mono uppercase tracking-wide">Light</span>
              {SKIN_TONES.map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => !disabled && handleApplyToneToAll(tone.id)}
                  disabled={disabled}
                  title={`Set all to ${tone.label}`}
                  className={`relative w-6 h-6 rounded-full transition-all duration-150 ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-110'
                  }`}
                  style={{ backgroundColor: tone.color }}
                />
              ))}
              <span className="text-[8px] text-muted-foreground font-mono uppercase tracking-wide">Deep</span>
            </div>
          </div>
        </div>
      )}

      {/* Global inspiration bar */}
      {onGlobalInspirationChange && images.length > 0 && (
        <div className="px-2 sm:px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Sparkles className="w-3.5 h-3.5 text-formanova-hero-accent flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide whitespace-nowrap">
              Inspiration / Mood board
            </span>
            <span className="text-[9px] text-muted-foreground/50 font-mono">(optional)</span>
          </div>

          {globalInspiration ? (
            <div className="flex items-center gap-3 mt-2">
              <div className="w-14 h-10 rounded-md overflow-hidden flex-shrink-0 marta-frame">
                <img src={globalInspiration.preview} alt="Global inspiration" className="w-full h-full object-cover" />
              </div>
              <span className="text-[9px] text-muted-foreground/70 font-mono flex-1">Applies to all images</span>
              <button
                onClick={handleRemoveGlobalInspiration}
                disabled={disabled}
                className="w-5 h-5 rounded-full bg-muted flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 mt-2 px-3 py-2.5 rounded-md border border-dashed border-muted-foreground/30 cursor-pointer hover:border-foreground/40 hover:bg-muted/10 transition-all">
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
              <ImagePlus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground font-mono">Drop or click to add mood reference</span>
              <span className="text-[8px] text-muted-foreground/50 font-mono ml-auto">JPG, PNG, WEBP</span>
            </label>
          )}
        </div>
      )}

      {/* Responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 p-2 sm:p-4">
        <AnimatePresence mode="popLayout">
          {images.map((image, index) => {
            const isSelected = selectedImageId === image.id;
            return (
              <motion.div
                key={image.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                layout
                className="group"
              >
                {/* Image tile */}
                <div
                  onClick={() => setSelectedImageId(isSelected ? null : image.id)}
                  className={`relative aspect-square bg-muted/30 rounded-lg sm:rounded-xl overflow-hidden cursor-pointer transition-all duration-200 ${
                    image.flagged ? 'ring-2 ring-amber-500/70' : ''
                  } ${isSelected ? 'ring-2 ring-formanova-hero-accent' : ''}`}
                >
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
                    <div
                      className="absolute top-2 left-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center"
                      title={image.flagReason || 'Image may not meet requirements'}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  {/* Inspiration indicator */}
                  {image.inspiration && (
                    <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 w-6 h-6 rounded-full bg-formanova-hero-accent/90 backdrop-blur-sm flex items-center justify-center" title="Has per-image inspiration">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {/* Number badge */}
                  <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-background/80 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-sm sm:text-base font-mono text-foreground">{index + 1}</span>
                  </div>
                </div>

                {/* Per-image skin tone selector */}
                {showSkinTone && (
                  <div className="mt-2 space-y-1">
                    <span className="block text-[9px] text-muted-foreground font-mono uppercase tracking-wide text-center">
                      Choose model skin tone
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
                                className="absolute inset-[-2px] rounded-full border-2 border-formanova-hero-accent"
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
              </motion.div>
            );
          })}
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
                  ? 'border-formanova-hero-accent bg-formanova-hero-accent/5' 
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

      {/* Per-image inspiration panel - shown when an image is selected */}
      {selectedImageId && (() => {
        const selectedImage = images.find(i => i.id === selectedImageId);
        if (!selectedImage) return null;
        const selectedIndex = images.indexOf(selectedImage);
        return (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-2 sm:mx-4 p-3 rounded-lg border border-border/50 bg-muted/20"
          >
            <div className="flex items-start gap-3">
              {/* Selected image thumbnail */}
              <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 ring-1 ring-formanova-hero-accent">
                <img src={selectedImage.preview} alt={`Image ${selectedIndex + 1}`} className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3 h-3 text-formanova-hero-accent flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">
                    Inspiration (image {selectedIndex + 1} only)
                  </span>
                </div>

                {selectedImage.inspiration ? (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-12 rounded-md overflow-hidden flex-shrink-0 marta-frame">
                      <img src={selectedImage.inspiration.preview} alt="Inspiration" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] text-muted-foreground/70 font-mono">Overrides global inspiration for this image</p>
                    </div>
                    <button
                      onClick={() => handleRemovePerImageInspiration(selectedImage.id)}
                      disabled={disabled}
                      className="w-5 h-5 rounded-full bg-muted flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-muted-foreground/30 cursor-pointer hover:border-foreground/40 hover:bg-muted/10 transition-all">
                    <input
                      ref={inspirationInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePerImageInspiration(selectedImage.id, file);
                        e.target.value = '';
                      }}
                      disabled={disabled}
                    />
                    <ImagePlus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-[10px] text-muted-foreground font-mono">Add inspiration for this image</span>
                  </label>
                )}
              </div>

              {/* Close selection */}
              <button
                onClick={() => setSelectedImageId(null)}
                className="w-5 h-5 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        );
      })()}

      {/* Counter and status */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-2 sm:px-4">
        <div className="flex items-center gap-2">
          <span>{images.length} of {maxImages}</span>
          {isValidating && (
            <span className="flex items-center gap-1 text-formanova-hero-accent">
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking...
            </span>
          )}
        </div>
        {!isMobile && <span className="text-[10px]">Ctrl+V to paste</span>}
      </div>
    </div>
  );
};

export default BulkUploadZone;
