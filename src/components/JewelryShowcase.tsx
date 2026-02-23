import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles, CheckCircle2, Target } from 'lucide-react';
import { OptimizedImage } from '@/components/ui/optimized-image';

// Import showcase images
import mannequinInput from '@/assets/showcase/mannequin-input.png';
import jewelryOverlay from '@/assets/showcase/mannequin-jewelry-overlay.png';
import modelBlackDress from '@/assets/showcase/model-black-dress.png';
import modelWhiteDress from '@/assets/showcase/model-white-dress.png';
import modelBlackTank from '@/assets/showcase/model-black-tank.png';
import metrics1 from '@/assets/showcase/metrics-1.png';
import metrics2 from '@/assets/showcase/metrics-2.png';
import metrics3 from '@/assets/showcase/metrics-3.png';

interface ModelData {
  image: string;
  label: string;
  metrics: string;
  precision: string;
  recall: string;
  iou: string;
}

const models: ModelData[] = [
  { 
    image: modelBlackDress, 
    label: 'Black Strap Dress', 
    metrics: metrics1,
    precision: '99.9%',
    recall: '93.9%',
    iou: '93.8%'
  },
  { 
    image: modelWhiteDress, 
    label: 'White V-Neck', 
    metrics: metrics2,
    precision: '99.7%',
    recall: '94.1%',
    iou: '93.9%'
  },
  { 
    image: modelBlackTank, 
    label: 'Black Tank Top', 
    metrics: metrics3,
    precision: '99.9%',
    recall: '94.1%',
    iou: '94.0%'
  },
];

export function JewelryShowcase() {
  const [currentModel, setCurrentModel] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-advance through models
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentModel((prev) => (prev + 1) % models.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const handlePrev = () => {
    setIsAutoPlaying(false);
    setCurrentModel((prev) => (prev - 1 + models.length) % models.length);
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setCurrentModel((prev) => (prev + 1) % models.length);
  };

  const handleDotClick = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentModel(index);
  };

  return (
    <div className="w-full">
      {/* Main showcase container */}
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
        
        {/* Left side - Input + Overlay */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Input</span>
          </div>
          
          <div 
            className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted/20 cursor-pointer group"
            onMouseEnter={() => setShowOverlay(true)}
            onMouseLeave={() => setShowOverlay(false)}
          >
            {/* Base mannequin image */}
            <OptimizedImage
              src={mannequinInput} 
              alt="Mannequin with jewelry" 
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
              style={{ opacity: showOverlay ? 0 : 1 }}
            />
            
            {/* Overlay with jewelry highlight */}
            <OptimizedImage
              src={jewelryOverlay} 
              alt="Jewelry highlighted" 
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
              style={{ opacity: showOverlay ? 1 : 0 }}
            />
            
            {/* Hover instruction */}
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>{showOverlay ? 'Jewelry Region Detected' : 'Hover to see detection'}</span>
              </motion.div>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground text-center">
            Original jewelry on mannequin - our AI detects and preserves every detail
          </p>
        </div>

        {/* Right side - Model outputs with navigation */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Output</span>
            </div>
            
            {/* Navigation arrows */}
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrev}
                className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={handleNext}
                className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Model image carousel */}
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted/20">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentModel}
                src={models[currentModel].image}
                alt={models[currentModel].label}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </AnimatePresence>
            
            {/* Model label badge */}
            <div className="absolute top-4 left-4">
              <motion.div 
                key={currentModel}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm"
              >
                {models[currentModel].label}
              </motion.div>
            </div>
            
            {/* Jewelry preserved badge */}
            <div className="absolute bottom-4 left-4 right-4">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-500/90 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm inline-flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Jewelry 100% Preserved</span>
              </motion.div>
            </div>
          </div>
          
          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2">
            {models.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentModel 
                    ? 'w-8 bg-primary' 
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Metrics section - synced with current model */}
      <motion.div 
        key={currentModel}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-12 p-6 rounded-2xl bg-muted/30 border border-border/30"
      >
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-5 h-5 text-primary" />
          <span className="font-medium">Quality Metrics for {models[currentModel].label}</span>
        </div>
        
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-green-500 mb-1">
              {models[currentModel].precision}
            </div>
            <div className="text-sm text-muted-foreground">Precision</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-green-500 mb-1">
              {models[currentModel].recall}
            </div>
            <div className="text-sm text-muted-foreground">Recall</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-green-500 mb-1">
              {models[currentModel].iou}
            </div>
            <div className="text-sm text-muted-foreground">IoU</div>
          </div>
        </div>
        
        <p className="text-center text-sm text-muted-foreground mt-6">
          Mathematically verified: Your jewelry is preserved with {'>'} 99% precision across all outputs
        </p>
      </motion.div>
    </div>
  );
}
