import { useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X } from 'lucide-react';
import { normalizeImageFile } from '@/lib/image-normalize';

export interface InspirationImage {
  id: string;
  file: File;
  preview: string;
}

interface InspirationUploadProps {
  image: InspirationImage | null;
  onImageChange: (image: InspirationImage | null) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  compact?: boolean;
}

const ACCEPTED_FORMATS = 'image/*';

const InspirationUpload = ({
  image,
  onImageChange,
  label = 'Inspiration / Moodboard',
  helperText = 'Applies to all generated images',
  disabled = false,
  compact = false,
}: InspirationUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const normalized = await normalizeImageFile(file);

    const newImage: InspirationImage = {
      id: `insp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      file: normalized,
      preview: URL.createObjectURL(normalized),
    };
    onImageChange(newImage);
  }, [onImageChange]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleRemove = useCallback(() => {
    if (image) {
      URL.revokeObjectURL(image.preview);
      onImageChange(null);
    }
  }, [image, onImageChange]);

  return (
    <div className="space-y-2">
      {/* Label */}
      <div className="flex items-center gap-2">
        <span className="marta-label text-muted-foreground text-xs">{label}</span>
        <span className="text-[9px] text-muted-foreground/50 bg-muted/40 px-2 py-0.5 rounded-full font-mono tracking-wide">Optional</span>
      </div>

      <AnimatePresence mode="wait">
        {image ? (
          /* Preview state */
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`relative marta-frame overflow-hidden ${compact ? 'aspect-[3/2]' : 'aspect-[4/3]'}`}
          >
            <img
              src={image.preview}
              alt="Inspiration reference"
              className="w-full h-full object-cover"
            />
            {/* Inspiration badge */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-formanova-hero-accent/90 backdrop-blur-sm">
              <span className="text-[9px] font-mono uppercase tracking-wide text-white">Inspiration</span>
            </div>
            {/* Remove button */}
            <button
              onClick={handleRemove}
              disabled={disabled}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center transition-opacity hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ) : (
          /* Upload state */
          <motion.label
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`block w-full marta-frame border-dashed cursor-pointer transition-all duration-200 ${
              compact ? 'aspect-[3/2]' : 'aspect-[4/3]'
            } ${
              disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:border-foreground/40 hover:bg-muted/10'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_FORMATS}
              onChange={handleFileInput}
              disabled={disabled}
              className="sr-only"
            />
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
              <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center border border-foreground/15">
                <Upload className="w-5 h-5 text-foreground/70" />
              </div>
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide text-center leading-tight">
                Drop or click to add
              </span>
              <span className="text-[9px] text-muted-foreground/60 font-mono text-center">
                Any image format accepted
              </span>
            </div>
          </motion.label>
        )}
      </AnimatePresence>

      {/* Helper text */}
      <p className="text-[10px] text-muted-foreground/70 font-mono text-center leading-tight">
        {helperText}
      </p>
    </div>
  );
};

export default InspirationUpload;
