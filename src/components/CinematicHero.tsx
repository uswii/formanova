import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/ui/optimized-image';

interface CinematicHeroProps {
  images: { src: string; alt: string }[];
  className?: string;
}

export function CinematicHero({ images, className }: CinematicHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);

  // Scroll-based image transition
  useEffect(() => {
    let accumulatedDelta = 0;
    const scrollThreshold = 150;
    
    const handleWheel = (e: WheelEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const isInView = rect.top <= 0 && rect.bottom >= window.innerHeight * 0.5;
      
      if (!isInView) return;
      
      const now = Date.now();
      if (now - lastScrollTime.current < 100) return;
      
      accumulatedDelta += e.deltaY;
      
      if (Math.abs(accumulatedDelta) > scrollThreshold && !isTransitioning) {
        setIsTransitioning(true);
        
        if (accumulatedDelta > 0) {
          // Scroll down - next image
          setCurrentIndex(prev => (prev + 1) % images.length);
        } else {
          // Scroll up - previous image
          setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
        }
        
        accumulatedDelta = 0;
        lastScrollTime.current = now;
        
        setTimeout(() => setIsTransitioning(false), 800);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [images.length, isTransitioning]);

  // Track scroll for parallax effects
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -rect.top / (rect.height - window.innerHeight)));
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-advance when not actively scrolling
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastScrollTime.current > 2500) {
        setCurrentIndex(prev => (prev + 1) % images.length);
      }
    }, 2500);
    
    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div 
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
    >
      {images.map((image, index) => {
        const isActive = index === currentIndex;
        
        return (
          <div
            key={index}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-in-out",
              isActive ? "opacity-100 z-10" : "opacity-0 z-0"
            )}
          >
            <OptimizedImage
              src={image.src} 
              alt={image.alt} 
              priority={index === 0}
              className="w-full h-full object-cover"
              style={{
                transform: isActive ? `scale(${1 + scrollProgress * 0.05})` : 'scale(1)',
                transition: 'transform 0.3s ease-out'
              }}
            />
          </div>
        );
      })}
      
      {/* Cinematic vignette - theme-neutral */}
      <div 
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.4) 100%)`,
        }}
      />
      
    </div>
  );
}
