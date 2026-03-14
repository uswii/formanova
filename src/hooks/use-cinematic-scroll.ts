import { useEffect, useState, useCallback, useRef } from 'react';

interface CinematicScrollValues {
  scrollY: number;
  scrollProgress: number;
  scrollVelocity: number;
  direction: 'up' | 'down' | 'idle';
}

export function useCinematicScroll(): CinematicScrollValues {
  const [values, setValues] = useState<CinematicScrollValues>({
    scrollY: 0,
    scrollProgress: 0,
    scrollVelocity: 0,
    direction: 'idle',
  });
  
  const lastScrollY = useRef(0);
  const lastTime = useRef(Date.now());
  const rafId = useRef<number>();

  useEffect(() => {
    const handleScroll = () => {
      if (rafId.current) return;
      
      rafId.current = requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const currentTime = Date.now();
        const deltaTime = currentTime - lastTime.current;
        const deltaScroll = currentScrollY - lastScrollY.current;
        
        const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollProgress = documentHeight > 0 ? currentScrollY / documentHeight : 0;
        
        const velocity = deltaTime > 0 ? Math.abs(deltaScroll) / deltaTime : 0;
        
        let direction: 'up' | 'down' | 'idle' = 'idle';
        if (deltaScroll > 0) direction = 'down';
        else if (deltaScroll < 0) direction = 'up';
        
        setValues({
          scrollY: currentScrollY,
          scrollProgress,
          scrollVelocity: Math.min(velocity * 10, 1),
          direction,
        });
        
        lastScrollY.current = currentScrollY;
        lastTime.current = currentTime;
        rafId.current = undefined;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return values;
}

// Hook for 3D parallax effect on hero images
interface ParallaxHeroOptions {
  intensity?: number;
  perspective?: number;
}

export function useParallaxHero(options: ParallaxHeroOptions = {}) {
  const { intensity = 0.5, perspective = 1000 } = options;
  const [transform, setTransform] = useState({
    translateY: 0,
    translateZ: 0,
    rotateX: 0,
    scale: 1,
    opacity: 1,
  });

  useEffect(() => {
    let rafId: number | undefined;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const scrollRatio = Math.min(scrollY / windowHeight, 1);
        
        setTransform({
          translateY: scrollY * intensity * 0.5,
          translateZ: -scrollRatio * 200 * intensity,
          rotateX: scrollRatio * 10 * intensity,
          scale: 1 - scrollRatio * 0.15,
          opacity: 1 - scrollRatio * 0.6,
        });
        rafId = undefined;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [intensity]);

  return { transform, perspective };
}

// Hook for staggered reveal animations
export function useStaggerReveal(count: number, baseDelay: number = 100) {
  const [visibleItems, setVisibleItems] = useState<boolean[]>(new Array(count).fill(false));
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Stagger reveal each item
          for (let i = 0; i < count; i++) {
            setTimeout(() => {
              setVisibleItems(prev => {
                const updated = [...prev];
                updated[i] = true;
                return updated;
              });
            }, i * baseDelay);
          }
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '-50px' }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [count, baseDelay]);

  return { containerRef, visibleItems };
}

// Hook for kinetic text animation
export function useKineticText() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

// Hook for scroll-triggered image sequence
export function useImageSequence(imageCount: number) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const containerHeight = rect.height;
      const scrollProgress = -rect.top / containerHeight;
      
      if (scrollProgress >= 0 && scrollProgress <= 1) {
        const newIndex = Math.floor(scrollProgress * imageCount);
        setActiveIndex(Math.min(newIndex, imageCount - 1));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [imageCount]);

  return { containerRef, activeIndex };
}
