/**
 * AlternateUploadStep — internal experiment (gated via feature flag).
 *
 * Left  (2/3) — upload canvas with watermark guide background.
 * Right (1/3) — My Products library: numbered pages, selected-state indicator,
 *               empty-state upload prompt, same patterns as Step 2 My Models.
 */

import React from 'react';
import {
  Check, X, Diamond, Upload, ArrowRight, Loader2,
  ChevronLeft, ChevronRight,
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
// Returns the page indices to display (numbers + '…' ellipsis markers).
function buildPageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const pages: (number | '…')[] = [0];
  if (current > 2)                      pages.push('…');
  const lo = Math.max(1, current - 1);
  const hi = Math.min(total - 2, current + 1);
  for (let i = lo; i <= hi; i++)        pages.push(i);
  if (current < total - 3)             pages.push('…');
  pages.push(total - 1);
  return pages;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AlternateUploadStepProps {
  exampleCategoryType: string;
  jewelryImage: string | null;
  /** ID of the asset currently loaded in the canvas (for selection highlight). */
  activeProductAssetId: string | null;
  isValidating: boolean;
  validationResult: ImageValidationResult | null;
  isFlagged: boolean;
  canProceed: boolean;
  jewelryInputRef: React.RefObject<HTMLInputElement>;
  onFileUpload: (file: File) => void;
  onClearImage: () => void;
  onNextStep: () => void;
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
  onProductSelect,
}: AlternateUploadStepProps) {
  const examples = CATEGORY_EXAMPLES[exampleCategoryType] ?? CATEGORY_EXAMPLES['necklace'];

  const PAGE_SIZE = 10;
  const { assets, total, page, isLoading, error, goToPage } = useUserAssets('jewelry_photo', PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isEmpty = !isLoading && !error && assets.length === 0;

  // Shared height — locks both columns to the same vertical bounds.
  const CANVAS_H = 'h-[480px] md:h-[540px]';

  return (
    <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">

      {/* ══════════════════════════════════════════════════════════════
          LEFT — Upload Canvas  (2 / 3)
          ══════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-2 flex flex-col gap-4">

        <div>
          <span className="marta-label block mb-1">Step 1</span>
          <h1 className="font-display text-3xl md:text-4xl uppercase tracking-tight leading-none">
            Upload Your Jewelry
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Upload a photo worn on a person or mannequin
          </p>
        </div>

        <div className={`relative border border-border/30 overflow-hidden ${CANVAS_H}`}>

          {/* ── WATERMARK BACKGROUND ── */}
          {!jewelryImage && (
            <div aria-hidden="true" className="absolute inset-0 flex flex-col" style={{ zIndex: 0 }}>

              {/* Row 1 — Accepted */}
              <div className="flex-1 grid grid-cols-3 relative min-h-0">
                <span className="absolute top-2 left-2 z-10 font-mono text-[8px] tracking-[0.25em] uppercase
                                  text-foreground/30 pointer-events-none select-none">Accepted</span>
                {examples.allowed.map((src, i) => (
                  <div key={`ok-${i}`} className="relative overflow-hidden border-r border-border/10 last:border-r-0">
                    <img src={src} alt="" draggable={false}
                         className="absolute inset-0 w-full h-full object-cover grayscale opacity-[0.14]" />
                    <div className="absolute top-2 right-2 z-10 bg-background/85 border border-green-500/50
                                    flex items-center justify-center w-5 h-5">
                      <Check className="w-3 h-3 text-green-500" strokeWidth={2.5} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-px bg-border/15 flex-shrink-0" />

              {/* Row 2 — Not Accepted */}
              <div className="flex-1 grid grid-cols-3 relative min-h-0">
                <span className="absolute top-2 left-2 z-10 font-mono text-[8px] tracking-[0.25em] uppercase
                                  text-foreground/30 pointer-events-none select-none">Not Accepted</span>
                {examples.notAllowed.map((src, i) => (
                  <div key={`no-${i}`} className="relative overflow-hidden border-r border-border/10 last:border-r-0">
                    <img src={src} alt="" draggable={false}
                         className="absolute inset-0 w-full h-full object-cover grayscale opacity-[0.11]" />
                    <div className="absolute top-2 right-2 z-10 bg-background/85 border border-destructive/50
                                    flex items-center justify-center w-5 h-5">
                      <X className="w-3 h-3 text-destructive" strokeWidth={2.5} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Centre vignette clears space for the CTA */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse 55% 55% at 50% 50%, hsl(var(--background)/0.75) 0%, transparent 100%)',
              }} />
            </div>
          )}

          {/* ── FOREGROUND — drop zone ── */}
          {!jewelryImage && (
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              style={{ zIndex: 10 }}
              onClick={() => jewelryInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFileUpload(f); }}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="flex flex-col items-center text-center px-8 select-none">
                {/* Original pulsing diamond */}
                <div className="relative mx-auto w-20 h-20 mb-6">
                  <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping"
                       style={{ animationDuration: '2.5s' }} />
                  <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                    <Diamond className="h-9 w-9 text-primary" />
                  </div>
                </div>
                <p className="font-display text-4xl md:text-5xl uppercase tracking-wide leading-none mb-3 text-foreground">
                  Drag &amp; Drop
                </p>
                <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-6">
                  or click to browse · paste Ctrl+V
                </p>
                <Button variant="outline" size="sm"
                        className="font-mono text-[10px] tracking-[0.15em] uppercase gap-2 pointer-events-none">
                  Browse Files
                </Button>
              </div>
            </div>
          )}

          {/* ── FOREGROUND — uploaded preview ── */}
          {jewelryImage && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
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
          )}

          <input ref={jewelryInputRef} type="file" accept="image/*" className="hidden"
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileUpload(f); }} />
        </div>

        {jewelryImage && (
          <div className="flex justify-end">
            <Button size="lg" onClick={onNextStep} disabled={!canProceed}
                    className="gap-2.5 font-display text-base uppercase tracking-wide px-10
                               bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))]
                               text-background hover:opacity-90 transition-opacity border-0 disabled:opacity-60">
              {isValidating
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Validating…</>
                : <>Next <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          RIGHT — My Products  (1 / 3)
          ══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4">

        {/* Invisible spacer mirrors "Step 1" label height so headings align */}
        <div>
          <span className="marta-label block mb-1 invisible" aria-hidden="true">Step 1</span>
          <h3 className="font-display text-3xl md:text-4xl uppercase tracking-tight leading-none">
            My Products
          </h3>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Previously uploaded jewelry
          </p>
        </div>

        {/* ── EMPTY STATE — mirrors Step 2 "My Models" empty state ── */}
        {isEmpty && (
          <div className="border border-dashed border-border/30 bg-muted/10 px-6 py-8
                          flex flex-col items-center text-center gap-4">
            <p className="text-sm text-muted-foreground max-w-[28ch]">
              No jewelry yet. Upload a product. It will be saved here.
            </p>
            <Button
              onClick={() => jewelryInputRef.current?.click()}
              className="gap-2 font-mono text-[11px] uppercase tracking-widest"
            >
              <Upload className="h-4 w-4" />
              Upload Jewelry
            </Button>
          </div>
        )}

        {/* ── GRID + PAGINATION ── */}
        {!isEmpty && (
          <div className="flex flex-col gap-3">

            {/* Loading skeleton */}
            {isLoading && (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-muted animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && error && (
              <p className="text-sm text-destructive py-6">{error}</p>
            )}

            {/* Product grid — height-locked to canvas */}
            {!isLoading && !error && assets.length > 0 && (
              <div className={`${CANVAS_H} overflow-y-auto`}>
                <div className="grid grid-cols-3 gap-2">
                  {assets.map((asset) => {
                    const isSelected = asset.id === activeProductAssetId;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => onProductSelect(asset.thumbnail_url, asset.id)}
                        className={`relative aspect-square overflow-hidden border transition-all group
                          ${isSelected
                            ? 'border-[hsl(var(--formanova-hero-accent))]'
                            : 'border-border/20 hover:border-foreground/30'}`}
                      >
                        <img
                          src={asset.thumbnail_url}
                          alt={asset.name ?? 'Product'}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />

                        {/* Selected overlay — uses theme accent colour */}
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center"
                               style={{ background: 'hsl(var(--formanova-hero-accent)/0.15)' }}>
                            <div className="w-6 h-6 flex items-center justify-center"
                                 style={{ background: 'hsl(var(--formanova-hero-accent))' }}>
                              <Check className="h-3.5 w-3.5 text-background" />
                            </div>
                          </div>
                        )}

                        {/* Hover hint for unselected items */}
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

            {/* Numbered pagination — only when > 1 page */}
            {!isLoading && !error && totalPages > 1 && (
              <div className="flex items-center justify-center gap-1">

                {/* Prev arrow */}
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 0}
                  className="w-7 h-7 flex items-center justify-center text-muted-foreground
                             hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Page number buttons */}
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

                {/* Next arrow */}
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
          </div>
        )}
      </div>

    </div>
  );
}
