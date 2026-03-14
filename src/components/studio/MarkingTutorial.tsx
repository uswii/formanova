import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import markingDemoGif from '@/assets/showcase/mannequin-input.webp';

interface Props {
  onDismiss: () => void;
}

export function MarkingTutorial({ onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xs mx-4 bg-background border border-border p-4 rounded-lg">
        {/* Close button */}
        <button 
          onClick={onDismiss}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center mb-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">How It Works</span>
          <h3 className="font-display text-lg uppercase">Mark Jewelry</h3>
        </div>

        {/* Demo GIF */}
        <div className="relative aspect-[3/4] bg-muted/30 border border-border/50 mb-3 overflow-hidden rounded">
          <img
            src={markingDemoGif}
            alt="Marking tutorial demo"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Brief instruction */}
        <p className="text-xs text-muted-foreground text-center mb-3">
          Click <strong className="text-foreground">3-5 dots</strong> on the jewelry
        </p>

        <Button onClick={onDismiss} size="sm" className="w-full">
          Got it
        </Button>
      </div>
    </div>
  );
}