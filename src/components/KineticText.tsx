import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface KineticTextProps {
  children: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
  animation?: 'reveal' | 'wave' | 'split' | 'glitch' | 'typewriter';
  delay?: number;
  staggerDelay?: number;
}

export function KineticText({
  children,
  className,
  as: Tag = 'span',
  animation = 'reveal',
  delay = 0,
  staggerDelay = 30,
}: KineticTextProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  const renderContent = () => {
    const words = children.split(' ');
    
    switch (animation) {
      case 'wave':
        return words.map((word, wordIndex) => (
          <span key={wordIndex} className="inline-block mr-[0.25em]">
            {word.split('').map((char, charIndex) => (
              <span
                key={charIndex}
                className={cn(
                  'inline-block transition-all duration-500',
                  isVisible 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-8'
                )}
                style={{
                  transitionDelay: isVisible 
                    ? `${(wordIndex * word.length + charIndex) * staggerDelay}ms` 
                    : '0ms',
                }}
              >
                {char}
              </span>
            ))}
          </span>
        ));

      case 'split':
        return words.map((word, index) => (
          <span
            key={index}
            className={cn(
              'inline-block mr-[0.25em] transition-[transform,opacity] duration-700 will-change-[transform,opacity]',
              isVisible 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-12'
            )}
            style={{
              transitionDelay: isVisible ? `${index * 100}ms` : '0ms',
            }}
          >
            {word}
          </span>
        ));

      case 'glitch':
        return (
          <span className="relative inline-block">
            <span 
              className={cn(
                'transition-all duration-500',
                isVisible ? 'opacity-100' : 'opacity-0'
              )}
            >
              {children}
            </span>
            {isVisible && (
              <>
                <span 
                  className="absolute inset-0 text-primary/50 animate-pulse"
                  style={{ transform: 'translate(-2px, -2px)', clipPath: 'inset(20% 0 40% 0)' }}
                >
                  {children}
                </span>
                <span 
                  className="absolute inset-0 text-accent/50 animate-pulse"
                  style={{ transform: 'translate(2px, 2px)', clipPath: 'inset(60% 0 10% 0)', animationDelay: '100ms' }}
                >
                  {children}
                </span>
              </>
            )}
          </span>
        );

      case 'typewriter':
        return (
          <span className="relative">
            {children.split('').map((char, index) => (
              <span
                key={index}
                className={cn(
                  'inline-block transition-opacity duration-75',
                  isVisible ? 'opacity-100' : 'opacity-0'
                )}
                style={{
                  transitionDelay: isVisible ? `${index * 50}ms` : '0ms',
                }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
            <span 
              className={cn(
                'inline-block w-[3px] h-[1em] bg-foreground ml-1 animate-pulse',
                isVisible ? 'opacity-100' : 'opacity-0'
              )}
              style={{ transitionDelay: `${children.length * 50}ms` }}
            />
          </span>
        );

      case 'reveal':
      default:
        return (
          <span className="relative overflow-hidden inline-block">
            <span 
              className={cn(
                'inline-block transition-all duration-1000 ease-out',
                isVisible 
                  ? 'translate-y-0 opacity-100' 
                  : 'translate-y-full opacity-0'
              )}
            >
              {children}
            </span>
          </span>
        );
    }
  };

  return (
    <Tag
      ref={ref as any}
      className={cn('overflow-hidden', className)}
    >
      {renderContent()}
    </Tag>
  );
}

// Animated line component for visual separation
export function AnimatedLine({ 
  className,
  delay = 0,
}: { 
  className?: string;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={cn(
        'h-px bg-foreground origin-left transition-transform duration-1000 ease-out',
        isVisible ? 'scale-x-100' : 'scale-x-0',
        className
      )}
    />
  );
}
