import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  before: string;
  after: string;
}

export function BeforeAfterSlider({ before, after }: Props) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    handleMove(e.clientX);
  }, [handleMove]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    isDragging.current = true;
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDragging.current = false;
    };
    
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      handleMove(e.clientX);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [handleMove]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[3/4] overflow-hidden rounded-xl border-2 border-border bg-muted/20 select-none touch-none"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Before Image (full background) */}
      <img
        src={before}
        alt="Before"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        draggable={false}
      />
      
      {/* After Image (clipped by slider position) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ width: `${sliderPosition}%` }}
      >
        <img
          src={after}
          alt="After"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ 
            width: containerRef.current ? containerRef.current.clientWidth : '100%',
            maxWidth: 'none'
          }}
          draggable={false}
        />
      </div>
      
      {/* Slider Line & Handle */}
      <div
        className="absolute top-0 bottom-0 z-10 cursor-ew-resize"
        style={{ left: `calc(${sliderPosition}% - 20px)`, width: '40px' }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Vertical Line */}
        <div 
          className="absolute top-0 bottom-0 left-1/2 w-1 -translate-x-1/2 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        />
        
        {/* Handle Circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center cursor-ew-resize border-2 border-primary/20">
          <ChevronLeft className="h-4 w-4 text-muted-foreground -mr-1" />
          <ChevronRight className="h-4 w-4 text-muted-foreground -ml-1" />
        </div>
      </div>
      
      {/* Labels */}
      <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full text-xs font-medium text-white pointer-events-none">
        Original
      </div>
      <div className="absolute top-3 right-3 px-3 py-1.5 bg-primary/90 backdrop-blur-sm rounded-full text-xs font-medium text-primary-foreground pointer-events-none">
        Result
      </div>
      
      {/* Instruction hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full text-xs text-white/80 pointer-events-none flex items-center gap-2">
        <ChevronLeft className="h-3 w-3" />
        Drag to compare
        <ChevronRight className="h-3 w-3" />
      </div>
    </div>
  );
}