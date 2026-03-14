import React from 'react';
import { Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { useDownloadRename } from '@/components/DownloadRenameDialog';

interface PhotoPreviewModalProps {
  imageUrl: string;
  alt?: string;
  onClose: () => void;
}

export function PhotoPreviewModal({ imageUrl, alt, onClose }: PhotoPreviewModalProps) {
  const { promptRename, DownloadDialog } = useDownloadRename();

  const handleDownload = async () => {
    const urlParts = imageUrl.split('/');
    const lastPart = urlParts[urlParts.length - 1].split('?')[0];
    const nameWithExt = lastPart || 'generation.jpg';
    const dotIdx = nameWithExt.lastIndexOf('.');
    const baseName = dotIdx > 0 ? nameWithExt.slice(0, dotIdx) : nameWithExt;
    const ext = dotIdx > 0 ? nameWithExt.slice(dotIdx + 1) : 'jpg';

    const filename = await promptRename(baseName, ext);
    if (!filename) return;

    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: filename, file_type: ext, context: 'generations-photo' }));
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = filename;
    a.target = '_blank';
    a.click();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            Preview
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4 space-y-4">
          {/* Hero image */}
          <div className="relative bg-muted overflow-hidden">
            <OptimizedImage
              src={imageUrl}
              alt={alt || 'Preview'}
              className="w-full object-contain max-h-[520px]"
            />
          </div>

          {/* Download button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleDownload}
              className="font-mono text-[10px] tracking-wider uppercase gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
      {DownloadDialog}
    </Dialog>
  );
}
