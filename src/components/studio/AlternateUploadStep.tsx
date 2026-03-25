/**
 * AlternateUploadStep — internal experiment (gated via feature flag).
 *
 * Left  (2/3) — upload canvas.
 * Right (1/3) — Upload Guide when canvas is empty; My Products library when image loaded.
 *
 * Test Mode (toggle, same gate): always shows the Upload Guide regardless of state,
 * for testing the empty-state UX.
 */

import React, { useState } from 'react';
import {
  Check, X, Diamond, Upload, ArrowRight, Loader2,
  ChevronLeft, ChevronRight, FlaskConical, ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserAssets } from '@/hooks/useUserAssets';
import type { ImageValidationResult } from '@/hooks/use-image-validation';

// ── Example images ────────────────────────────────────────────────────────────
import necklaceAllowed1    from '@/assets/examples/necklace-allowed-1.jpg';
import necklaceAllowed2    from '@/assets/examples/necklace-allowed-2.jpg';
import necklaceAllowed3    from '@/assets/examples/necklace-allowed-3.jpg';
import necklaceNotAllowed1 from '@/assets/examples/necklace-notallowed-1.png';
import necklaceNotAllowed2 from '@/assets/examples/necklace-notallowed-2.png';
import necklaceNotAllowed3 from '@/assets/examples/necklace-notallowed-3.png';
import earringAllowed1     from '@/assets/examples/earring-allowed-1.jpg';
import earringAllowed2     from '@/assets/examples/earring-allowed-2.jpg';
import earringAllowed3     from '@/assets/examples/earring-allowed-3.jpg';
import earringNotAllowed1  from '@/assets/examples/earring-notallowed-1.png';
import earringNotAllowed2  from '@/assets/examples/earring-notallowed-2.png';
import earringNotAllowed3  from '@/assets/examples/earring-notallowed-3.png';
import braceletAllowed1    from '@/assets/examples/bracelet-allowed-1.jpg';
import braceletAllowed2    from '@/assets/examples/bracelet-allowed-2.jpg';
import braceletAllowed3    from '@/assets/examples/bracelet-allowed-3.jpg';
import braceletNotAllowed1 from '@/assets/examples/bracelet-notallowed-1.png';
import braceletNotAllowed2 from '@/assets/examples/bracelet-notallowed-2.png';
import braceletNotAllowed3 from '@/assets/examples/bracelet-notallowed-3.png';
import ringAllowed1        from '@/assets/examples/ring-allowed-1.png';
import ringAllowed2        from '@/assets/examples/ring-allowed-2.png';
import ringAllowed3        from '@/assets/examples/ring-allowed-3.jpg';
import ringNotAllowed1     from '@/assets/examples/ring-notallowed-1.png';
import ringNotAllowed2     from '@/assets/examples/ring-notallowed-2.png';
import ringNotAllowed3     from '@/assets/examples/ring-notallowed-3.png';
import watchAllowed1       from '@/assets/examples/watch-allowed-1.jpg';
import watchAllowed2       from '@/assets/examples/watch-allowed-2.jpg';
import watchAllowed3       from '@/assets/examples/watch-allowed-3.png';
import watchNotAllowed1    from '@/assets/examples/watch-notallowed-1.png';
import watchNotAllowed2    from '@/assets/examples/watch-notallowed-2.png';
import watchNotAllowed3    from '@/assets/examples/watch-notallowed-3.png';

const CATEGORY_EXAMPLES: Record<string, { allowed: string[]; notAllowed: string[] }> = {
  necklace:  { allowed: [necklaceAllowed1, necklaceAllowed2, necklaceAllowed3],   notAllowed: [necklaceNotAllowed1, necklaceNotAllowed2, necklaceNotAllowed3] },
  earrings:  { allowed: [earringAllowed1,  earringAllowed2,  earringAllowed3],    notAllowed: [earringNotAllowed1,  earringNotAllowed2,  earringNotAllowed3]  },
  bracelets: { allowed: [braceletAllowed1, braceletAllowed2, braceletAllowed3],   notAllowed: [braceletNotAllowed1, braceletNotAllowed2, braceletNotAllowed3] },
  rings:     { allowed: [ringAllowed1,     ringAllowed2,     ringAllowed3],        notAllowed: [ringNotAllowed1,     ringNotAllowed2,     ringNotAllowed3]     },
  watches:   { allowed: [watchAllowed1,    watchAllowed2,    watchAllowed3],       notAllowed: [watchNotAllowed1,    watchNotAllowed2,    watchNotAllowed3]    },
};

// ── Pagination helper ─────────────────────────────────────────────────────────
function buildPageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const pages: (number | '…')[] = [0];
  if (current > 2)          pages.push('…');
  const lo = Math.max(1, current - 1);
  const hi = Math.min(total - 2, current + 1);
  for (let i = lo; i <= hi; i++) pages.push(i);
  if (current < total - 3) pages.push('…');
  pages.push(total - 1);
  return pages;
}

// ── Upload Guide panel (original style) ───────────────────────────────────────
function UploadGuidePanel({
  examples,
  canvasH,
}: {
  examples: { allowed: string[]; notAllowed: string[] };
  canvasH: string;
}) {
  return (
    <div className={`${canvasH} overflow-y-auto border border-border/30 p-4`}>
    <div className="space-y-5">
      {/* Accepted */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground">For best results:</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {examples.allowed.map((src, i) => (
            <div key={`ok-${i}`} className="relative aspect-[3/4] overflow-hidden border border-green-500/30 bg-muted/20">
              <img src={src} alt="" draggable={false} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      {/* Not Accepted */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground">Also accepted:</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {examples.notAllowed.map((src, i) => (
            <div key={`no-${i}`} className="relative aspect-[3/4] overflow-hidden border border-border/30 bg-muted/20">
              <img src={src} alt="" draggable={false} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AlternateUploadStepProps {
  exampleCategoryType: string;
  jewelryImage: string | null;
  activeProductAssetId: string | null;
  isValidating: boolean;
  validationResult: ImageValidationResult | null;
  isFlagged: boolean;
  canProceed: boolean;
  jewelryInputRef: React.RefObject<HTMLInputElement>;
  onFileUpload: (file: File) => void;
  onClearImage: () => void;
  onNextStep: () => void;
  /** Bypasses the flag check — used by "Continue Anyway". */
  onForceNextStep: () => void;
  onProductSelect: (thumbnailUrl: string, assetId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AlternateUploadStep({
  exampleCategoryType,
  jewelryImage,
  activeProductAssetId,
  isValidating,
  validationResult,
  isFlagged,
  canProceed,
  jewelryInputRef,
  onFileUpload,
  onClearImage,
  onNextStep,
  onForceNextStep,
  onProductSelect,
}: AlternateUploadStepProps) {
  const examples = CATEGORY_EXAMPLES[exampleCategoryType] ?? CATEGORY_EXAMPLES['necklace'];

  const [testMode, setTestMode] = useState(false);
  const [flagAcknowledged, setFlagAcknowledged] = useState(false);

  React.useEffect(() => {
    setFlagAcknowledged(false);
  }, [jewelryImage]);

  const PAGE_SIZE = 10;
  const { assets, total, page, isLoading, error, goToPage } = useUserAssets('jewelry_photo', PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isEmpty = !isLoading && !error && assets.length === 0;

  // Show guide when: test mode active OR no products exist
  const showGuide = testMode || isEmpty;

  const showFlagWarning = isFlagged && !!jewelryImage && !isValidating && !flagAcknowledged;

  // Necklace worn example looks better as the 3rd image
  const popupWornExample = exampleCategoryType === 'necklace' ? examples.allowed[2] : examples.allowed[0];

  // Shared height — locks both columns to the same vertical bounds.
  const CANVAS_H = 'h-[500px] md:h-[640px]';

  return (
    <>
    <div className="grid lg:grid-cols-3 gap-8 lg:gap-10">

      {/* ══════════════════════════════════════════════════════════════
          LEFT — Upload Canvas  (2 / 3)
          ══════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-2 flex flex-col gap-4">

        <div>
          <span className="marta-label block mb-1">Step 1</span>
          <h1 className="font-display text-3xl md:text-4xl uppercase tracking-tight mt-2">
            Upload Your Jewelry
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Upload a photo of your jewelry <strong>worn on a person or mannequin</strong>
          </p>
        </div>

        {/* Drop zone — empty state */}
        {!jewelryImage && (
          <div
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFileUpload(f); }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => jewelryInputRef.current?.click()}
            className={`relative border border-dashed border-border/40 text-center cursor-pointer
                        hover:border-foreground/40 hover:bg-foreground/5 transition-all
                        flex flex-col items-center justify-center ${CANVAS_H}`}
          >
            <div className="relative mx-auto w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping"
                   style={{ animationDuration: '2.5s' }} />
              <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                <Diamond className="h-9 w-9 text-primary" />
              </div>
            </div>
            <p className="text-lg font-display font-medium mb-1.5">Drop your jewelry image here</p>
            <p className="text-sm text-muted-foreground mb-6">
              Drag &amp; drop · click to browse · paste (Ctrl+V)
            </p>
            <Button variant="outline" size="lg" className="gap-2 pointer-events-none">
              <ImageIcon className="h-4 w-4" />
              Browse Files
            </Button>
            <input ref={jewelryInputRef} type="file" accept="image/*" className="hidden"
                   onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileUpload(f); }} />
          </div>
        )}

        {/* Uploaded preview */}
        {jewelryImage && (
          <div className="space-y-4">
            <div className={`relative border overflow-hidden flex items-center justify-center bg-muted/20 border-border/30 ${CANVAS_H}`}>
              <img src={jewelryImage} alt="Jewelry" className="max-w-full max-h-full object-contain" />

              <button onClick={onClearImage}
                      className="absolute top-3 right-3 w-7 h-7 bg-background/80 backdrop-blur-sm
                                 flex items-center justify-center border border-border/40
                                 hover:bg-destructive hover:text-destructive-foreground transition-colors z-10">
                <X className="h-3.5 w-3.5" />
              </button>

              {isValidating && (
                <div className="absolute top-3 left-3 bg-muted/90 backdrop-blur-sm px-2.5 py-1 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">Validating…</span>
                </div>
              )}
              {!isValidating && validationResult && !isFlagged && (
                <div className="absolute top-3 left-3 px-2.5 py-1 flex items-center gap-1.5 bg-primary/10 border border-primary/20">
                  <Check className="h-3 w-3 text-primary" />
                  <span className="font-mono text-[9px] tracking-wider uppercase text-primary">Accepted</span>
                </div>
              )}
            </div>

            {/* Action area — normal Next button */}
            <div className="flex items-center justify-end gap-3">
              <Button size="lg" onClick={onNextStep} disabled={!canProceed}
                      className="gap-2.5 font-display text-base uppercase tracking-wide px-10
                                 bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))]
                                 text-background hover:opacity-90 transition-opacity border-0 disabled:opacity-60">
                {isValidating
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Validating…</>
                  : <>Next <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          RIGHT — Upload Guide / My Products  (1 / 3)
          ══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4">

        <div className="flex items-start justify-between gap-2">
          <div>
            {/* Invisible spacer mirrors "Step 1" label so headings align */}
            <span className="marta-label block mb-1 invisible" aria-hidden="true">Step 1</span>
            <h3 className="font-display text-3xl md:text-4xl uppercase tracking-tight mt-2">
              {showGuide ? 'Upload Guide' : 'My Products'}
            </h3>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {showGuide ? 'Follow these guidelines for best results.' : 'Previously uploaded jewelry'}
            </p>
          </div>

          {/* Test Mode toggle */}
          <button
            type="button"
            onClick={() => setTestMode((v) => !v)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 border font-mono text-[9px]
                        tracking-[0.2em] uppercase transition-colors mt-0.5
                        ${testMode
                          ? 'border-[hsl(var(--formanova-hero-accent))] text-[hsl(var(--formanova-hero-accent))] bg-[hsl(var(--formanova-hero-accent)/0.08)]'
                          : 'border-border/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground'}`}
          >
            <FlaskConical className="h-3 w-3" />
            Test
          </button>
        </div>

        {/* ── Upload Guide ── */}
        {showGuide && (
          <UploadGuidePanel examples={examples} canvasH={CANVAS_H} />
        )}

        {/* ── Product library ── */}
        {!showGuide && (
          <>
            {isLoading && (
              <div className={`${CANVAS_H} border border-border/30 grid grid-cols-3 gap-2 content-start p-2`}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-muted animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {!isLoading && !error && assets.length > 0 && (
              <div className={`${CANVAS_H} overflow-y-auto border border-border/30`}>
                <div className="grid grid-cols-3 gap-2">
                  {assets.map((asset) => {
                    const isSelected = asset.id === activeProductAssetId;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => onProductSelect(asset.thumbnail_url, asset.id)}
                        className={`relative overflow-hidden border transition-all group
                          ${isSelected
                            ? 'border-[hsl(var(--formanova-hero-accent))]'
                            : 'border-border/20 hover:border-foreground/30'}`}
                      >
                        <img
                          src={asset.thumbnail_url}
                          alt={asset.name ?? 'Product'}
                          loading="lazy"
                          className="w-full block transition-transform duration-300 group-hover:scale-105"
                        />

                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center"
                               style={{ background: 'hsl(var(--formanova-hero-accent)/0.15)' }}>
                            <div className="w-6 h-6 flex items-center justify-center"
                                 style={{ background: 'hsl(var(--formanova-hero-accent))' }}>
                              <Check className="h-3.5 w-3.5 text-background" />
                            </div>
                          </div>
                        )}

                        {!isSelected && (
                          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10
                                          transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity
                                             font-mono text-[9px] tracking-[0.15em] uppercase
                                             text-background bg-foreground/70 px-2 py-1">
                              Use
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!isLoading && !error && totalPages > 1 && (
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 0}
                  className="w-7 h-7 flex items-center justify-center text-muted-foreground
                             hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {buildPageList(page, totalPages).map((p, idx) =>
                  p === '…' ? (
                    <span key={`ellipsis-${idx}`}
                          className="w-7 h-7 flex items-center justify-center font-mono text-[10px]
                                     text-muted-foreground/50 select-none">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p as number)}
                      className={`w-7 h-7 flex items-center justify-center font-mono text-[10px]
                                  tracking-wide transition-colors
                                  ${p === page
                                    ? 'bg-foreground text-background'
                                    : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {(p as number) + 1}
                    </button>
                  )
                )}

                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages - 1}
                  className="w-7 h-7 flex items-center justify-center text-muted-foreground
                             hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </div>

    {/* ── Flagged image popup — centered overlay ── */}

    {showFlagWarning && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
        <div className="bg-background border border-border/30 shadow-2xl max-w-md w-full mx-4 p-6 flex flex-col gap-5">

          {/* Visual comparison — user's photo vs a worn example */}
          <div className="grid grid-cols-2 gap-3">
            {/* User's image */}
            <div className="flex flex-col gap-1.5">
              <div className="aspect-square overflow-hidden border border-border/30 bg-muted/10 flex items-center justify-center">
                {jewelryImage && (
                  <img src={jewelryImage} alt="Your photo" className="w-full h-full object-contain" />
                )}
              </div>
              <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60 text-center">
                Your photo
              </span>
            </div>

            {/* Worn example */}
            <div className="flex flex-col gap-1.5">
              <div className="aspect-square overflow-hidden border border-border/30 bg-muted/10 flex items-center justify-center">
                <img src={popupWornExample} alt="Works better" className="w-full h-full object-contain" />
              </div>
              <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60 text-center">
                Works better
              </span>
            </div>
          </div>

          {/* Soft one-liner */}
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            If you wear your jewelry and submit a photo of it, the result will be even better!
          </p>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={onClearImage}
              className="font-mono text-[10px] uppercase tracking-widest"
            >
              Upload Again
            </Button>
            <Button
              size="lg"
              onClick={() => { setFlagAcknowledged(true); onForceNextStep(); }}
              className="font-mono text-[10px] uppercase tracking-widest
                         bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))]
                         text-background hover:opacity-90 transition-opacity border-0"
            >
              Continue Anyway
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
