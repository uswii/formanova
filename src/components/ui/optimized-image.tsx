import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** true = eager load + high fetchpriority (for LCP / above-the-fold) */
  priority?: boolean;
  /** CSS aspect-ratio value e.g. "3/4", "16/9" to prevent CLS */
  aspectRatio?: string;
}

/**
 * Drop-in `<img>` replacement that enforces performance best practices:
 * - `loading="lazy"` by default (overridable with `priority`)
 * - `decoding="async"` by default
 * - `fetchpriority="high"` when `priority` is set
 * - CSS `aspect-ratio` to prevent CLS
 */
const OptimizedImage = forwardRef<HTMLImageElement, OptimizedImageProps>(
  ({ priority = false, aspectRatio, className, style, ...props }, ref) => {
    return (
      <img
        ref={ref}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        {...(priority ? { fetchPriority: 'high' as const } : {})}
        className={cn(className)}
        style={{
          ...(aspectRatio ? { aspectRatio } : {}),
          ...style,
        }}
        {...props}
      />
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';

export { OptimizedImage };
export type { OptimizedImageProps };
