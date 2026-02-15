import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';

export type SkinTone = 'fair' | 'light' | 'medium' | 'tan' | 'dark' | 'deep';

interface ImageUploadCardProps {
  id: string;
  preview: string;
  skinTone: SkinTone;
  onSkinToneChange: (id: string, tone: SkinTone) => void;
  onRemove: (id: string) => void;
  showSkinTone?: boolean;
  disabled?: boolean;
}

const SKIN_TONES: { id: SkinTone; color: string; label: string }[] = [
  { id: 'fair', color: '#FFE0BD', label: 'Fair' },
  { id: 'light', color: '#F5D0B0', label: 'Light' },
  { id: 'medium', color: '#C8A27C', label: 'Medium' },
  { id: 'tan', color: '#A67C52', label: 'Tan' },
  { id: 'dark', color: '#6B4423', label: 'Dark' },
  { id: 'deep', color: '#3D2314', label: 'Deep' },
];

const ImageUploadCard = ({
  id,
  preview,
  skinTone,
  onSkinToneChange,
  onRemove,
  showSkinTone = true,
  disabled = false,
}: ImageUploadCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Preview */}
      <div className="aspect-square marta-frame overflow-hidden bg-muted/30">
        <img
          src={preview}
          alt="Jewelry upload"
          className="w-full h-full object-cover"
        />
        
        {/* Remove Button */}
        <button
          onClick={() => onRemove(id)}
          disabled={disabled}
          className={`absolute top-2 right-2 w-6 h-6 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center transition-opacity ${
            isHovered ? 'opacity-100' : 'opacity-0'
          } ${disabled ? 'cursor-not-allowed' : 'hover:bg-destructive hover:text-destructive-foreground'}`}
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Skin Tone Selector - Per Image */}
      {showSkinTone && (
        <div className="mt-3 space-y-1.5">
          <span className="block text-[10px] text-muted-foreground font-mono uppercase tracking-wide text-center">Skin tone</span>
          <div className="flex items-center justify-center gap-1.5">
            {SKIN_TONES.map((tone) => {
              const isSelected = skinTone === tone.id;
              return (
                <button
                  key={tone.id}
                  onClick={() => !disabled && onSkinToneChange(id, tone.id)}
                  disabled={disabled}
                  title={tone.label}
                  className={`relative w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-all duration-150 ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-110'
                  }`}
                  style={{ backgroundColor: tone.color }}
                >
                  {isSelected && (
                    <motion.div
                      layoutId={`skin-ring-${id}`}
                      className="absolute inset-[-3px] rounded-full border-2 border-formanova-hero-accent"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  {isSelected && (
                    <Check className="w-3 h-3 absolute inset-0 m-auto text-white drop-shadow-md" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ImageUploadCard;
