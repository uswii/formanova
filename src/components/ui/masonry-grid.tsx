// src/components/ui/masonry-grid.tsx
// True Pinterest-style masonry: shortest-column-first, equal gutters, absolute positioning.

import { useRef, useState, useEffect, useCallback, useMemo, Children, type ReactNode } from 'react';

interface Breakpoints {
  sm?: number;
  md?: number;
  lg?: number;
}

interface MasonryGridProps {
  /** Fixed column count (overridden by breakpoints if provided) */
  columns?: number;
  /** Responsive column counts keyed by min-width bucket: sm≥640 md≥768 lg≥1024 */
  breakpoints?: Breakpoints;
  /** Gap in pixels between columns AND between rows */
  gap?: number;
  className?: string;
  children: ReactNode;
}

interface ItemPos {
  left: number;
  top: number;
  width: number;
}

export function MasonryGrid({
  columns = 3,
  breakpoints,
  gap = 16,
  className = '',
  children,
}: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [containerWidth, setContainerWidth] = useState(0);
  const [positions, setPositions] = useState<ItemPos[]>([]);
  const [gridHeight, setGridHeight] = useState(0);
  const [visible, setVisible] = useState(false);

  const items = Children.toArray(children);

  // Track container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Resolve effective column count from container width + breakpoints
  const effectiveCols = useMemo(() => {
    if (!breakpoints) return columns;
    if (containerWidth >= 1024 && breakpoints.lg != null) return breakpoints.lg;
    if (containerWidth >= 768 && breakpoints.md != null) return breakpoints.md;
    return breakpoints.sm ?? columns;
  }, [containerWidth, columns, breakpoints]);

  const colWidth = containerWidth > 0
    ? (containerWidth - gap * (effectiveCols - 1)) / effectiveCols
    : 0;

  const compute = useCallback(() => {
    if (!colWidth || items.length === 0) return;

    // Measure all item heights upfront
    const itemHeights = Array.from({ length: items.length }, (_, i) =>
      itemRefs.current.get(i)?.offsetHeight ?? 0
    );

    const heights = Array<number>(effectiveCols).fill(0);
    // Index-keyed so last-batch items can be placed out of insertion order
    const pos: ItemPos[] = new Array(items.length);

    // Standard shortest-column-first for everything except the final batch.
    // The final batch uses LPT (Longest Processing Time): sort by height
    // descending, assign each to the currently shortest column. This minimises
    // the max column height at the bottom and eliminates the large empty gaps
    // that appear when a tall item lands in a short column at the end.
    const batchStart = Math.max(0, items.length - effectiveCols);

    for (let i = 0; i < batchStart; i++) {
      const col = heights.indexOf(Math.min(...heights));
      pos[i] = {
        left: Math.round(col * (colWidth + gap)),
        top: Math.round(heights[col]),
        width: colWidth,
      };
      heights[col] += itemHeights[i] + gap;
    }

    // Last batch: tallest-first assignment to shortest column
    const batch = Array.from({ length: items.length - batchStart }, (_, k) => ({
      idx: batchStart + k,
      height: itemHeights[batchStart + k],
    })).sort((a, b) => b.height - a.height);

    for (const { idx, height } of batch) {
      const col = heights.indexOf(Math.min(...heights));
      pos[idx] = {
        left: Math.round(col * (colWidth + gap)),
        top: Math.round(heights[col]),
        width: colWidth,
      };
      heights[col] += height + gap;
    }

    setPositions(pos);
    setGridHeight(Math.max(0, Math.max(...heights) - gap));
    setVisible(true);
  }, [colWidth, effectiveCols, gap, items.length]);

  // Run layout when items or column width changes; re-run as images finish loading
  useEffect(() => {
    if (!colWidth) return;

    compute();

    const el = containerRef.current;
    if (!el) return;
    const unloaded = [...el.querySelectorAll<HTMLImageElement>('img')].filter(img => !img.complete);
    const onLoad = () => compute();
    unloaded.forEach(img => {
      img.addEventListener('load', onLoad, { once: true });
      img.addEventListener('error', onLoad, { once: true });
    });
    return () => unloaded.forEach(img => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onLoad);
    });
  }, [items.length, colWidth, compute]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        height: visible ? gridHeight : undefined,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.15s',
      }}
    >
      {items.map((child, i) => {
        const pos = positions[i];
        return (
          <div
            key={i}
            ref={el => { if (el) itemRefs.current.set(i, el); else itemRefs.current.delete(i); }}
            style={
              pos
                ? { position: 'absolute', left: pos.left, top: pos.top, width: pos.width }
                : { position: 'absolute', left: 0, top: -9999, width: colWidth || '100%', pointerEvents: 'none' }
            }
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
