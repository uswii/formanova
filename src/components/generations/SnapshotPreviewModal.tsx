import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OptimizedImage } from '@/components/ui/optimized-image';

interface SnapshotPreviewModalProps {
  screenshots: { angle: string; url: string }[];
  initialIndex: number;
  glbUrl?: string | null;
  glbFilename?: string | null;
  onClose: () => void;
}

export function SnapshotPreviewModal({
  screenshots,
  initialIndex,
  glbUrl,
  glbFilename,
  onClose,
}: SnapshotPreviewModalProps) {
  const [index, setIndex] = useState(Math.min(initialIndex, screenshots.length - 1));
  const shot = screenshots[index];
  const total = screenshots.length;

  const prev = () => setIndex((index - 1 + total) % total);
  const next = () => setIndex((index + 1) % total);

  const handleDownloadImage = () => {
    if (!shot) return;
    const fileName = `ring-${shot.angle}.png`;
    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: fileName, file_type: 'png', context: 'generations-snapshot' }));
    const a = document.createElement('a');
    a.href = shot.url;
    a.download = fileName;
    a.target = '_blank';
    a.click();
  };

  const handleDownloadGlb = () => {
    if (!glbUrl) return;
    const fileName = glbFilename || 'model.glb';
    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: fileName, file_type: 'glb', context: 'generations-snapshot' }));
    const a = document.createElement('a');
    a.href = glbUrl;
    a.download = fileName;
    a.target = '_blank';
    a.click();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            {shot?.angle?.replace(/_/g, ' ') || 'Preview'}
            {total > 1 && (
              <span className="ml-2 text-muted-foreground/50">
                {index + 1} / {total}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4 space-y-4">
          {/* Hero image */}
          <div className="relative group bg-muted rounded-sm overflow-hidden aspect-square max-h-[460px] mx-auto flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="w-full h-full flex items-center justify-center"
              >
                {shot && (
                  <OptimizedImage
                    src={shot.url}
                    alt={shot.angle}
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {total > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {total > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {screenshots.map((s, i) => (
                <button
                  key={s.angle}
                  onClick={() => setIndex(i)}
                  className={`flex-shrink-0 w-11 h-11 rounded-sm overflow-hidden border-2 transition-all ${
                    i === index
                      ? 'border-foreground'
                      : 'border-transparent hover:border-muted-foreground/40'
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

          {/* Download buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              onClick={handleDownloadImage}
              disabled={!shot}
              className="font-mono text-[10px] tracking-wider uppercase gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              Download Snapshot
            </Button>
            {glbUrl && (
              <Button
                onClick={handleDownloadGlb}
                className="font-mono text-[10px] tracking-wider uppercase gap-2"
              >
                <Download className="h-3.5 w-3.5" />
                Download GLB
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
