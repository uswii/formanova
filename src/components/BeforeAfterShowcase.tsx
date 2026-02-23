import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { BeforeAfterSlider } from './studio/BeforeAfterSlider';
// Note: BeforeAfterSlider handles its own images internally

// Assets
import mannequinInput from '@/assets/showcase/mannequin-input.png';
import modelBlackDress from '@/assets/showcase/model-black-dress.png';
import modelBlackTank from '@/assets/showcase/model-black-tank.png';
import modelWhiteDress from '@/assets/showcase/model-white-dress.png';

interface ShowcaseItem {
  before: string;
  after: string;
  label: string;
}

const showcaseItems: ShowcaseItem[] = [
  { before: mannequinInput, after: modelBlackDress, label: 'Black Dress' },
  { before: mannequinInput, after: modelBlackTank, label: 'Black Tank' },
  { before: mannequinInput, after: modelWhiteDress, label: 'White Dress' },
];

export function BeforeAfterShowcase() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + showcaseItems.length) % showcaseItems.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % showcaseItems.length);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-8 md:mb-12">
        <span className="marta-label mb-4 block">See The Magic</span>
        <h3 className="font-display text-3xl md:text-4xl lg:text-5xl mb-4">
          Before & After
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Same jewelry, different models. Drag to compare and see how your pieces stay pixel-perfect.
        </p>
      </div>

      {/* Showcase Content */}
      <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
        {/* Navigation - Left */}
        <button
          onClick={handlePrev}
          className="hidden lg:flex items-center justify-center w-12 h-12 rounded-full border border-border/40 bg-background/50 backdrop-blur-sm hover:bg-primary/10 hover:border-primary/40 transition-all duration-300"
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Slider Container */}
        <div className="flex-1 w-full max-w-md lg:max-w-lg mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <BeforeAfterSlider
                before={showcaseItems[currentIndex].before}
                after={showcaseItems[currentIndex].after}
              />
            </motion.div>
          </AnimatePresence>

          {/* Mobile Navigation */}
          <div className="flex lg:hidden items-center justify-center gap-4 mt-6">
            <button
              onClick={handlePrev}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-border/40 bg-background/50 hover:bg-primary/10 transition-all"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            {/* Dots */}
            <div className="flex items-center gap-2">
              {showcaseItems.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    idx === currentIndex
                      ? 'bg-primary w-6'
                      : 'bg-border hover:bg-primary/50'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
            
            <button
              onClick={handleNext}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-border/40 bg-background/50 hover:bg-primary/10 transition-all"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation - Right */}
        <button
          onClick={handleNext}
          className="hidden lg:flex items-center justify-center w-12 h-12 rounded-full border border-border/40 bg-background/50 backdrop-blur-sm hover:bg-primary/10 hover:border-primary/40 transition-all duration-300"
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Model Label & Badge */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <span className="text-sm text-muted-foreground">
          Model: <span className="text-foreground font-medium">{showcaseItems[currentIndex].label}</span>
        </span>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Jewelry Preserved</span>
        </div>
      </div>

      {/* Desktop Dots */}
      <div className="hidden lg:flex items-center justify-center gap-3 mt-6">
        {showcaseItems.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? 'bg-primary w-8'
                : 'bg-border/60 hover:bg-primary/50'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
