import React from 'react';
import { Maximize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OptimizedImage } from '@/components/ui/optimized-image';

interface PhotoPreviewModalProps {
  imageUrl: string;
  alt?: string;
  onClose: () => void;
}

export function PhotoPreviewModal({ imageUrl, alt, onClose }: PhotoPreviewModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            Preview
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4">
          {/* Hero image with enlarge icon overlay */}
          <div className="relative group bg-muted overflow-hidden">
            <OptimizedImage
              src={imageUrl}
              alt={alt || 'Preview'}
              className="w-full object-contain max-h-[520px]"
            />
            {/* Enlarge icon overlay in corner */}
            <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm p-1.5 opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none">
              <Maximize2 className="h-4 w-4 text-foreground" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
