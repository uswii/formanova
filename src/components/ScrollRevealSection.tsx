import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ScrollRevealSectionProps {
  children: React.ReactNode;
  className?: string;
  animation?: 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'zoom' | 'flip' | 'rotate';
  delay?: number;
  duration?: number;
  threshold?: number;
  once?: boolean;
}

export function ScrollRevealSection({
  children,
  className,
  animation = 'fade-up',
  delay = 0,
  duration = 800,
  threshold = 0.1,
  once = true,
}: ScrollRevealSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin: '-50px 0px' }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, once]);

  const getAnimationClasses = () => {
    const base = 'transition-[transform,opacity] ease-out will-change-[transform,opacity]';
    
    if (!isVisible) {
      switch (animation) {
        case 'fade-up':
          return `${base} opacity-0 translate-y-16`;
        case 'fade-down':
          return `${base} opacity-0 -translate-y-16`;
        case 'fade-left':
          return `${base} opacity-0 translate-x-16`;
        case 'fade-right':
          return `${base} opacity-0 -translate-x-16`;
        case 'zoom':
          return `${base} opacity-0 scale-90`;
        case 'flip':
          return `${base} opacity-0 [transform:rotateX(20deg)_translateY(20px)]`;
        case 'rotate':
          return `${base} opacity-0 rotate-6 translate-y-8`;
        default:
          return `${base} opacity-0 translate-y-16`;
      }
    }
    
    return `${base} opacity-100 translate-y-0 translate-x-0 scale-100 rotate-0 [transform:rotateX(0deg)_translateY(0px)]`;
  };

  return (
    <div
      ref={ref}
      className={cn(getAnimationClasses(), className)}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// Staggered children container
interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  animation?: 'fade-up' | 'fade-left' | 'fade-right' | 'zoom';
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 100,
  animation = 'fade-up',
}: StaggerContainerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;
        
        const getTransform = () => {
          if (!isVisible) {
            switch (animation) {
              case 'fade-up':
                return 'translateY(40px)';
              case 'fade-left':
                return 'translateX(-40px)';
              case 'fade-right':
                return 'translateX(40px)';
              case 'zoom':
                return 'scale(0.9)';
              default:
                return 'translateY(40px)';
            }
          }
          return 'translateY(0) translateX(0) scale(1)';
        };
        
        return (
          <div
            style={{
              opacity: isVisible ? 1 : 0,
              transform: getTransform(),
              transition: `all 700ms cubic-bezier(0.16, 1, 0.3, 1) ${index * staggerDelay}ms`,
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
