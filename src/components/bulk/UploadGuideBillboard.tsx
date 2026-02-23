import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { OptimizedImage } from '@/components/ui/optimized-image';

// Using existing hero images to demonstrate acceptable vs not acceptable
import heroNecklace from '@/assets/jewelry/hero-necklace-diamond.jpg';
import necklacePearl from '@/assets/jewelry/necklace-pearl.jpg';

interface UploadGuideBillboardProps {
  categoryName?: string;
}

const UploadGuideBillboard = ({ categoryName = 'jewelry' }: UploadGuideBillboardProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="marta-frame p-4 md:p-5 space-y-4 bg-card/50 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-formanova-hero-accent" />
        <span className="marta-label text-xs">Upload Guide</span>
      </div>

      {/* Accepted Example */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-formanova-success/20 flex items-center justify-center">
            <Check className="w-3 h-3 text-formanova-success" />
          </div>
          <span className="text-xs font-medium uppercase tracking-wide text-formanova-success">
            Accepted
          </span>
        </div>
        <div className="relative aspect-[4/3] marta-frame overflow-hidden">
          <OptimizedImage
            src={heroNecklace} 
            alt="Acceptable: Jewelry worn on model or product shot" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-background/90 to-transparent">
            <span className="text-[10px] font-mono text-foreground/80">
              {categoryName} on model/person
            </span>
          </div>
          <div className="absolute top-1 right-1 w-5 h-5 bg-formanova-success flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        </div>
      </div>

      {/* Not Accepted Example */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-destructive/20 flex items-center justify-center">
            <X className="w-3 h-3 text-destructive" />
          </div>
          <span className="text-xs font-medium uppercase tracking-wide text-destructive">
            Not Accepted
          </span>
        </div>
        <div className="relative aspect-[4/3] marta-frame overflow-hidden opacity-60">
          <OptimizedImage
            src={necklacePearl} 
            alt="Not acceptable: Product shots" 
            className="w-full h-full object-cover grayscale"
          />
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-background/90 to-transparent">
            <span className="text-[10px] font-mono text-foreground/80">
              Product shots
            </span>
          </div>
          <div className="absolute top-1 right-1 w-5 h-5 bg-destructive flex items-center justify-center">
            <X className="w-3 h-3 text-primary-foreground" />
          </div>
          {/* Strike-through overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-0.5 bg-destructive rotate-45 transform origin-center" />
          </div>
        </div>
      </div>

      {/* Guidance Text */}
      <div className="pt-2 border-t border-border/50">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          All images must show <span className="text-foreground font-medium">{categoryName} being worn</span> on a model or person. 
          Product shots cannot be processed.
        </p>
      </div>
    </motion.div>
  );
};

export default UploadGuideBillboard;
