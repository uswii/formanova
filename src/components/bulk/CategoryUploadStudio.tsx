// CategoryUploadStudio - Bulk jewelry upload interface
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X, Plus, Diamond, AlertTriangle } from 'lucide-react';
import { normalizeImageFile } from '@/lib/image-normalize';
import { SkinTone } from './ImageUploadCard';
import BatchSubmittedConfirmation from './BatchSubmittedConfirmation';
import ExampleGuidePanel from './ExampleGuidePanel';
import InspirationModal from './InspirationModal';
import type { InspirationRef } from './InspirationModal';
import { useImageValidation } from '@/hooks/use-image-validation';
import { useIsMobile } from '@/hooks/use-mobile';
import { getStoredToken } from '@/lib/auth-api';
import { toast } from '@/hooks/use-toast';
import { normalizeImageFiles } from '@/lib/image-normalize';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  index: number;
}

interface ImageWithSkinTone extends UploadedImage {
  skinTone: SkinTone;
  isFlagged?: boolean;
  flagReason?: string;
  inspiration?: InspirationRef | null;
}

const CATEGORY_NAMES: Record<string, string> = {
  necklace: 'Necklaces',
  earrings: 'Earrings',
  rings: 'Rings',
  bracelets: 'Bracelets',
  watches: 'Watches',
  earring: 'Earrings',
  ring: 'Rings',
  bracelet: 'Bracelets',
  watch: 'Watches',
};

const CATEGORY_TO_DB_ENUM: Record<string, string> = {
  necklace: 'necklace',
  earrings: 'earring',
  rings: 'ring',
  bracelets: 'bracelet',
  watches: 'watch',
  earring: 'earring',
  ring: 'ring',
  bracelet: 'bracelet',
  watch: 'watch',
};

const SKIN_TONES: { id: SkinTone; color: string; label: string }[] = [
  { id: 'fair', color: '#FFE0BD', label: 'Fair' },
  { id: 'light', color: '#F5D0B0', label: 'Light' },
  { id: 'medium', color: '#C8A27C', label: 'Medium' },
  { id: 'tan', color: '#A67C52', label: 'Tan' },
  { id: 'dark', color: '#6B4423', label: 'Dark' },
  { id: 'deep', color: '#3D2314', label: 'Deep' },
];

const MAX_IMAGES = 10;

const CategoryUploadStudio = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [images, setImages] = useState<ImageWithSkinTone[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedBatchId, setSubmittedBatchId] = useState<string | null>(null);
  const [globalSkinTone, setGlobalSkinTone] = useState<SkinTone>('medium');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showFlagWarning, setShowFlagWarning] = useState(false);
  const [globalInspiration, setGlobalInspiration] = useState<InspirationRef | null>(null);
  const [inspirationModalImageId, setInspirationModalImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const globalInspirationInputRef = useRef<HTMLInputElement>(null);
  const jewelryType = type || 'necklace';
  const categoryName = CATEGORY_NAMES[jewelryType] || 'Jewelry';
  const showSkinTone = jewelryType !== 'necklace';

  const {
    isValidating,
    validateImages,
    clearValidation,
  } = useImageValidation();

  // ── File handling ──────────────────────────────────────────────

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = MAX_IMAGES - images.length;
    const rawFiles = fileArray.slice(0, remainingSlots).filter(f => f.type.startsWith('image/'));
    if (rawFiles.length === 0) return;

    const normalizedFiles = await normalizeImageFiles(rawFiles);
    const startIndex = images.length;
    const newImages: ImageWithSkinTone[] = normalizedFiles.map((file, idx) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      skinTone: globalSkinTone,
      index: startIndex + idx,
    }));

    setImages(prev => [...prev, ...newImages]);

    const validation = await validateImages(normalizedFiles, jewelryType);
    if (validation && validation.flagged_count > 0) {
      setImages(prev => prev.map((img, idx) => {
        if (idx >= startIndex) {
          const validationIdx = idx - startIndex;
          const result = validation.results[validationIdx];
          if (result && result.flags.length > 0) {
            return { ...img, isFlagged: true, flagReason: getFlagMessage(result.flags, result.category) };
          }
        }
        return img;
      }));
    }
  }, [images.length, globalSkinTone, validateImages, jewelryType]);

  const getFlagMessage = (flags: string[], category?: string): string => {
    if (flags.includes('not_worn')) {
      if (category === '3d_render') return '3D render detected — needs worn photo';
      if (category === 'flatlay') return 'Flatlay detected — needs worn photo';
      if (category === 'packshot') return 'Product shot detected — needs worn photo';
      if (category === 'floating') return 'Floating product detected — needs worn photo';
      return 'Not worn on person';
    }
    if (flags.includes('no_jewelry')) return 'No jewelry detected';
    if (flags.includes('wrong_category')) return 'Wrong jewelry type';
    if (flags.includes('low_quality')) return 'Low quality image';
    return 'Needs review';
  };

  // Paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isSubmitting) return;
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
        addFiles(imageFiles);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addFiles, isSubmitting]);

  // ── Per-image handlers ─────────────────────────────────────────

  const handleRemoveImage = useCallback((imageId: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === imageId);
      if (img) {
        URL.revokeObjectURL(img.preview);
        if (img.inspiration) URL.revokeObjectURL(img.inspiration.preview);
      }
      return prev.filter(i => i.id !== imageId);
    });
    if (inspirationModalImageId === imageId) setInspirationModalImageId(null);
  }, [inspirationModalImageId]);

  const handleSkinToneChange = useCallback((imageId: string, tone: SkinTone) => {
    setImages(prev => prev.map(img => img.id === imageId ? { ...img, skinTone: tone } : img));
  }, []);

  const handlePerImageInspirationChange = useCallback((imageId: string, ref: InspirationRef | null) => {
    setImages(prev => prev.map(img => {
      if (img.id !== imageId) return img;
      // Revoke old preview if replacing
      if (img.inspiration && ref) URL.revokeObjectURL(img.inspiration.preview);
      return { ...img, inspiration: ref };
    }));
  }, []);

  // ── Global handlers ────────────────────────────────────────────

  const handleApplySkinToneToAll = useCallback((tone: SkinTone) => {
    setGlobalSkinTone(tone);
    setImages(prev => prev.map(img => ({ ...img, skinTone: tone })));
  }, []);

  const handleGlobalInspirationFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const normalized = await normalizeImageFile(file);
    if (globalInspiration?.preview) URL.revokeObjectURL(globalInspiration.preview);
    const ref: InspirationRef = {
      id: `insp-global-${Date.now()}`,
      file: normalized,
      preview: URL.createObjectURL(normalized),
    };
    setGlobalInspiration(ref);
  }, [globalInspiration]);

  const handleRemoveGlobalInspiration = useCallback(() => {
    if (globalInspiration?.preview) URL.revokeObjectURL(globalInspiration.preview);
    setGlobalInspiration(null);
  }, [globalInspiration]);

  // ── Submit ─────────────────────────────────────────────────────

  const hasFlaggedImages = images.some(img => img.isFlagged);

  const handleSubmit = useCallback(async () => {
    if (images.length === 0) return;
    if (hasFlaggedImages && !showFlagWarning) { setShowFlagWarning(true); return; }

    setIsSubmitting(true);
    setShowFlagWarning(false);

    try {
      const imageData = await Promise.all(
        images.map(async (img) => {
          const dataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(img.file);
          });

          // Per-image inspiration overrides global
          const inspirationSource = img.inspiration || globalInspiration;
          let inspirationDataUri: string | null = null;
          if (inspirationSource) {
            inspirationDataUri = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(inspirationSource.file);
            });
          }

          return {
            data_uri: dataUri,
            skin_tone: img.skinTone,
            inspiration_data_uri: inspirationDataUri,
            classification: img.isFlagged ? {
              category: img.flagReason || 'unknown',
              is_worn: false,
              flagged: true,
            } : undefined,
          };
        })
      );

      const userToken = getStoredToken();
      if (!userToken) {
        toast({ title: 'Authentication required', description: 'Please log in to submit batches', variant: 'destructive' });
        navigate('/login');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/batch-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'X-User-Token': userToken,
        },
        body: JSON.stringify({
          jewelry_category: CATEGORY_TO_DB_ENUM[jewelryType] || jewelryType,
          images: imageData,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to submit batch');

      setSubmittedBatchId(result.batch_id);
      setIsSubmitted(true);
      clearValidation();
    } catch (error) {
      console.error('Failed to submit batch:', error);
      toast({ title: 'Submission failed', description: error instanceof Error ? error.message : 'Please try again', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }, [images, hasFlaggedImages, showFlagWarning, clearValidation, jewelryType, navigate, globalInspiration]);

  const handleStartAnother = useCallback(() => {
    images.forEach(img => {
      URL.revokeObjectURL(img.preview);
      if (img.inspiration) URL.revokeObjectURL(img.inspiration.preview);
    });
    if (globalInspiration) URL.revokeObjectURL(globalInspiration.preview);
    setImages([]);
    setGlobalInspiration(null);
    setIsSubmitted(false);
    setSubmittedBatchId(null);
  }, [images, globalInspiration]);

  useEffect(() => {
    return () => { images.forEach(img => URL.revokeObjectURL(img.preview)); };
  }, []);

  const canSubmit = images.length > 0 && !isSubmitting;

  // ── Inspiration modal state ────────────────────────────────────
  const inspirationModalImage = inspirationModalImageId ? images.find(i => i.id === inspirationModalImageId) : null;
  const inspirationModalIndex = inspirationModalImage ? images.indexOf(inspirationModalImage) : -1;

  // ── Submitted confirmation ─────────────────────────────────────
  if (isSubmitted) {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-background py-8 px-4 md:px-8">
        <div className="max-w-2xl mx-auto">
          <BatchSubmittedConfirmation
            categoryName={categoryName}
            imageCount={images.length}
            batchId={submittedBatchId ?? undefined}
            onStartAnother={handleStartAnother}
          />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background flex flex-col">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => navigate('/studio')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-mono uppercase tracking-wide hidden sm:inline">Back</span>
        </button>
        <h1 className="font-display text-base sm:text-lg uppercase tracking-wide">
          {categoryName}
        </h1>
        <div className="w-8" />
      </div>

      {/* ── Main layout ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* CENTER COLUMN */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/* ── Global Control Bar (non-scrolling, above grid) ── */}
          {images.length > 0 && (
            <div className="flex-shrink-0 border-b border-border/40 bg-background px-4 sm:px-6 py-3 space-y-3">
              {/* Explanation — appears once */}
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed max-w-xl">
                You can optionally upload inspirational images or mood board images to guide the model's style, lighting, and overall vibe.
              </p>

              {/* Concise global actions row */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                {/* Model skin tone — apply to all */}
                {showSkinTone && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide whitespace-nowrap">
                      Model skin tone — apply to all
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-muted-foreground/60 font-mono uppercase">Light</span>
                      {SKIN_TONES.map((tone) => (
                        <button
                          key={tone.id}
                          onClick={() => handleApplySkinToneToAll(tone.id)}
                          disabled={isSubmitting}
                          title={`Set all to ${tone.label}`}
                          className={`w-5 h-5 rounded-full transition-all ${
                            globalSkinTone === tone.id
                              ? 'ring-1 ring-primary ring-offset-1 ring-offset-background scale-110'
                              : 'opacity-60 hover:opacity-100 hover:scale-105'
                          }`}
                          style={{ backgroundColor: tone.color }}
                        />
                      ))}
                      <span className="text-[8px] text-muted-foreground/60 font-mono uppercase">Deep</span>
                    </div>
                  </div>
                )}

                {/* Inspiration — apply to all */}
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
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) await handleGlobalInspirationFile(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Scrollable image grid ──────────────────────────── */}
          <div
            className={`flex-1 min-h-[300px] flex items-center justify-center p-3 sm:p-6 md:p-8 overflow-y-auto transition-colors ${
              isDragOver ? 'bg-accent/5 border-2 border-dashed border-accent/50' : ''
            }`}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
          >
            {images.length > 0 ? (
              <div className="w-full max-w-4xl px-2">
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                  <AnimatePresence mode="popLayout">
                    {images.map((image, index) => (
                      <motion.div
                        key={image.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        layout
                        className="space-y-2"
                      >
                        {/* Image tile */}
                        <div className={`relative aspect-square rounded-lg sm:rounded-xl overflow-hidden group border-2 ${
                          image.isFlagged ? 'border-amber-500/70 ring-2 ring-amber-500/30' : 'border-border/50'
                        }`}>
                          <img
                            src={image.preview}
                            alt={`Upload ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {/* Flag indicator */}
                          {image.isFlagged && (
                            <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center" title={image.flagReason}>
                              <AlertTriangle className="w-3 h-3" />
                            </div>
                          )}
                          {/* Remove button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveImage(image.id); }}
                            disabled={isSubmitting}
                            className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/70 text-white flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-destructive"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          {/* Mood indicator badge */}
                          {image.inspiration && (
                            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-foreground/70 backdrop-blur-sm">
                              <span className="text-[8px] font-mono text-background uppercase">Mood</span>
                            </div>
                          )}
                          {/* Number badge */}
                          <div className="absolute bottom-2 left-2 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-background/80 backdrop-blur-sm flex items-center justify-center">
                            <span className="text-sm sm:text-base font-mono text-foreground">{index + 1}</span>
                          </div>
                        </div>

                        {/* ── Per-image controls (minimal overrides) ── */}
                        <div className="space-y-1.5 px-0.5">
                          {/* Model skin tone (this image only) */}
                          {showSkinTone && (
                            <div className="space-y-0.5">
                              <span className="block text-[8px] sm:text-[9px] text-muted-foreground font-mono uppercase tracking-wide text-center">
                                Model skin tone <span className="text-muted-foreground/40">(this image only)</span>
                              </span>
                              <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                                <span className="text-[7px] sm:text-[8px] text-muted-foreground/60 font-mono uppercase tracking-wide">Light</span>
                                {SKIN_TONES.map((tone) => (
                                  <button
                                    key={tone.id}
                                    onClick={(e) => { e.stopPropagation(); handleSkinToneChange(image.id, tone.id); }}
                                    disabled={isSubmitting}
                                    title={tone.label}
                                    className={`w-4 h-4 rounded-full transition-all ${
                                      image.skinTone === tone.id
                                        ? 'ring-1 ring-primary ring-offset-1 ring-offset-background scale-110'
                                        : 'opacity-60 hover:opacity-100 hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: tone.color }}
                                  />
                                ))}
                                <span className="text-[7px] sm:text-[8px] text-muted-foreground/60 font-mono uppercase tracking-wide">Deep</span>
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
                  {images.length < MAX_IMAGES && (
                    <motion.label
                      layout
                      className="aspect-square rounded-lg sm:rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-foreground/50 hover:bg-muted/30 transition-all"
                    >
                      <Plus className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        disabled={isSubmitting}
                        onChange={(e) => {
                          if (e.target.files) addFiles(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </motion.label>
                  )}
                </div>

                {/* Image count + validation status */}
                <div className="text-center mt-4">
                  <p className="text-xs text-muted-foreground">
                    {images.length} of {MAX_IMAGES} images
                  </p>
                  {isValidating && (
                    <p className="text-xs text-primary mt-1 animate-pulse">
                      Checking images…
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Empty state */
              <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer group px-6">
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-4">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                  <div className="absolute inset-0 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/40 group-active:border-primary group-active:scale-95 transition-all">
                    <Diamond className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                  </div>
                </div>
                <p className="text-base sm:text-lg font-display font-medium mb-1 text-center">
                  {isMobile ? 'Tap to add photos' : 'Click to upload or drag'}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground text-center">
                  {isMobile ? 'or select from gallery' : 'or drop images here'}
                </p>
                {!isMobile && <p className="text-[10px] text-muted-foreground/60 mt-2">Ctrl+V to paste</p>}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={isSubmitting}
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>

          {/* ── Bottom submit panel ────────────────────────────── */}
          <AnimatePresence>
            {images.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="border-t border-border bg-background p-3 sm:p-5 flex-shrink-0"
              >
                <div className="max-w-xl mx-auto">
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || isValidating}
                    className={`w-full py-3 sm:py-4 px-4 sm:px-6 font-display text-sm sm:text-base uppercase tracking-wider transition-all flex items-center justify-center gap-2 sm:gap-3 rounded-lg shadow-lg ${
                      canSubmit && !isValidating
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-xl active:scale-[0.98]'
                        : 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
                    }`}
                  >
                    {isSubmitting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-current border-t-transparent rounded-full"
                      />
                    ) : isValidating ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                        />
                        <span className="text-xs sm:text-sm">Checking…</span>
                      </>
                    ) : (
                      <>Generate Photoshoots</>
                    )}
                  </button>

                  <div className="flex items-center justify-between mt-2 sm:mt-3 text-[10px] sm:text-xs text-muted-foreground">
                    <span className="flex flex-wrap items-center gap-1">
                      <span><span className="text-foreground font-medium">{images.length}</span> image{images.length !== 1 ? 's' : ''}</span>
                      <span className="hidden xs:inline">· Up to 24h</span>
                      {hasFlaggedImages && !showFlagWarning && (
                        <span className="text-amber-500">
                          ({images.filter(img => img.isFlagged).length} flagged)
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1 sm:gap-1.5 text-primary">
                      <Diamond className="w-3 h-3" />
                      <span>First batch free</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIGHT SIDEBAR: Guide ─────────────────────────────── */}
        <div className="hidden lg:block w-[380px] xl:w-[480px] border-l border-border/50 p-4 xl:p-6 bg-muted/10 overflow-y-auto flex-shrink-0">
          <div className="mb-4">
            <span className="marta-label text-muted-foreground text-[10px]">Upload Guide</span>
          </div>
          <ExampleGuidePanel categoryName={categoryName} categoryType={jewelryType} />

          {showSkinTone && images.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border/50">
              <span className="marta-label text-muted-foreground text-[10px]">Model skin tone</span>
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                Select the skin tone for the AI-generated model in each photoshoot.
              </p>
              <div className="flex items-center gap-1.5 mt-3">
                {SKIN_TONES.map((tone) => (
                  <div key={tone.id} className="flex flex-col items-center gap-1">
                    <div className="w-5 h-5 rounded-full border border-border/50" style={{ backgroundColor: tone.color }} />
                    <span className="text-[8px] text-muted-foreground/70">{tone.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MOBILE: Example Guide */}
        <div className="lg:hidden border-t border-border/50 bg-muted/10 p-4 overflow-y-auto max-h-[40vh]">
          <div className="mb-3">
            <span className="text-xs font-medium text-muted-foreground">Photo Guide</span>
          </div>
          <ExampleGuidePanel categoryName={categoryName} categoryType={jewelryType} />
        </div>
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
          disabled={isSubmitting}
        />
      )}

      {/* ── Flagged Images Warning Modal ───────────────────────── */}
      <AnimatePresence>
        {showFlagWarning && hasFlaggedImages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
            onClick={() => setShowFlagWarning(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-amber-500/50 rounded-xl sm:rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 flex-shrink-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-base sm:text-lg text-foreground truncate">Flagged Images Detected</h2>
                  <p className="text-xs sm:text-sm text-amber-200/70">{images.filter(img => img.isFlagged).length} of {images.length} images need review</p>
                </div>
              </div>

              <div className="px-4 sm:px-6 py-3 sm:py-4 max-h-[150px] sm:max-h-[200px] overflow-y-auto flex-shrink-0">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {images.filter(img => img.isFlagged).map((img) => (
                    <div key={img.id} className="aspect-square rounded-lg overflow-hidden border-2 border-amber-500/50 relative">
                      <img src={img.preview} alt="Flagged" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-amber-500/20" />
                      <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                        <AlertTriangle className="w-2.5 h-2.5 text-black" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border/50 flex-shrink-0">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  These images appear to be <span className="text-amber-400 font-medium">product shots, 3D renders, or flatlays</span>.
                  Our AI works best with photos of jewelry <span className="text-foreground font-medium">worn on a person</span>.
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground/70 mt-2">
                  Results for flagged images may not be usable.
                </p>
              </div>

              <div className="px-4 sm:px-6 py-3 sm:py-4 bg-muted/30 border-t border-border/50 flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0">
                <button
                  onClick={() => setShowFlagWarning(false)}
                  className="flex-1 py-2.5 sm:py-3 px-4 rounded-lg border border-border bg-background hover:bg-muted transition-colors font-medium text-xs sm:text-sm order-2 sm:order-1"
                >
                  Go Back & Fix
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2.5 sm:py-3 px-4 rounded-lg bg-amber-600 text-white font-medium text-xs sm:text-sm hover:bg-amber-500 transition-colors order-1 sm:order-2"
                >
                  Submit Anyway
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryUploadStudio;
