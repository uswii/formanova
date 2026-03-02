import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { getWorkflowDetails, type WorkflowDetail, type WorkflowStep } from '@/lib/generation-history-api';

/** Convert azure://container/path → public blob URL */
function azureUriToUrl(uri: string): string {
  if (uri.startsWith('azure://')) {
    const path = uri.replace('azure://', '');
    return `https://snapwear.blob.core.windows.net/${path}`;
  }
  return uri;
}

// Preferred angle ordering — front first
const ANGLE_ORDER = ['front', 'front_left', 'front_right', 'left', 'right', 'back_left', 'back_right', 'back'];

function sortScreenshots(screenshots: { angle: string; url: string }[]) {
  return [...screenshots].sort((a, b) => {
    const ai = ANGLE_ORDER.indexOf(a.angle);
    const bi = ANGLE_ORDER.indexOf(b.angle);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

interface CadWorkflowModalProps {
  workflowId: string | null;
  workflowStatus: string;
  onClose: () => void;
}

export function CadWorkflowModal({ workflowId, workflowStatus, onClose }: CadWorkflowModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<{ angle: string; url: string }[]>([]);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    if (!workflowId) return;

    // Reset state
    setLoading(true);
    setError(null);
    setScreenshots([]);
    setGlbUrl(null);
    setCaption(null);
    setHeroIndex(0);

    if (workflowStatus !== 'completed') {
      setError('This workflow did not complete successfully.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const details = await getWorkflowDetails(workflowId);

        // Find ring-screenshot step
        const screenshotStep = details.steps?.find((s: WorkflowStep) => s.tool === 'ring-screenshot');
        if (screenshotStep?.output?.screenshots) {
          const raw = screenshotStep.output.screenshots as { angle: string; url: string }[];
          setScreenshots(sortScreenshots(raw.map(s => ({ angle: s.angle, url: azureUriToUrl(s.url) }))));
        }

        // Find ring-validate step (preferred) or ring-generate for GLB
        const validateStep = details.steps?.find((s: WorkflowStep) => s.tool === 'ring-validate');
        const generateStep = details.steps?.find((s: WorkflowStep) => s.tool === 'ring-generate');
        const glbStep = validateStep || generateStep;

        if (glbStep?.output?.glb_path) {
          setGlbUrl(azureUriToUrl(glbStep.output.glb_path as string));
        }

        if (validateStep?.output?.message) {
          setCaption(validateStep.output.message as string);
        }
      } catch (err: any) {
        console.error('[CadWorkflowModal] fetch error:', err);
        setError('Failed to load workflow details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [workflowId, workflowStatus]);

  const heroShot = screenshots[heroIndex];

  const handleDownloadGlb = () => {
    if (!glbUrl) return;
    const a = document.createElement('a');
    a.href = glbUrl;
    a.download = `ring-${workflowId?.slice(0, 8)}.glb`;
    a.target = '_blank';
    a.click();
  };

  const handleDownloadPng = () => {
    if (!heroShot) return;
    const a = document.createElement('a');
    a.href = heroShot.url;
    a.download = `ring-${heroShot.angle}-${workflowId?.slice(0, 8)}.png`;
    a.target = '_blank';
    a.click();
  };

  return (
    <Dialog open={!!workflowId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="font-display text-2xl md:text-3xl uppercase tracking-wide">
            CAD Output
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            {workflowId?.slice(0, 12)}…
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-4">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                Loading details…
              </p>
            </div>
          )}

          {/* Error / failed state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="font-mono text-[11px] tracking-wider text-destructive">
                {error}
              </p>
            </div>
          )}

          {/* Success content */}
          {!loading && !error && (
            <>
              {/* Hero image */}
              {heroShot && (
                <div className="relative group mb-4">
                  <div className="relative bg-muted rounded-sm overflow-hidden aspect-square max-h-[400px] mx-auto flex items-center justify-center">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={heroIndex}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="w-full h-full flex items-center justify-center"
                      >
                        <OptimizedImage
                          src={heroShot.url}
                          alt={`Ring — ${heroShot.angle}`}
                          className="max-w-full max-h-full object-contain"
                        />
                      </motion.div>
                    </AnimatePresence>

                    {/* Nav arrows */}
                    {screenshots.length > 1 && (
                      <>
                        <button
                          onClick={() => setHeroIndex((heroIndex - 1 + screenshots.length) % screenshots.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setHeroIndex((heroIndex + 1) % screenshots.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Angle label */}
                  <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground text-center mt-2">
                    {heroShot.angle.replace(/_/g, ' ')}
                  </p>
                </div>
              )}

              {/* Thumbnail strip */}
              {screenshots.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                  {screenshots.map((s, i) => (
                    <button
                      key={s.angle}
                      onClick={() => setHeroIndex(i)}
                      className={`flex-shrink-0 w-14 h-14 rounded-sm overflow-hidden border-2 transition-colors ${
                        i === heroIndex ? 'border-foreground' : 'border-transparent hover:border-muted-foreground/40'
                      }`}
                    >
                      <OptimizedImage
                        src={s.url}
                        alt={s.angle}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Caption */}
              {caption && (
                <p className="font-mono text-[11px] tracking-wider text-muted-foreground mb-5 leading-relaxed">
                  {caption}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                {glbUrl && (
                  <Button
                    onClick={handleDownloadGlb}
                    variant="outline"
                    className="font-mono text-[10px] tracking-wider uppercase gap-2"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download GLB
                  </Button>
                )}
                {heroShot && (
                  <Button
                    onClick={handleDownloadPng}
                    variant="outline"
                    className="font-mono text-[10px] tracking-wider uppercase gap-2"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download PNG
                  </Button>
                )}
              </div>

              {/* No data fallback */}
              {screenshots.length === 0 && !glbUrl && (
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground text-center py-8">
                  No output artifacts found for this workflow.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
