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
    const heights = Array<number>(effectiveCols).fill(0);
    const pos: ItemPos[] = [];

    for (let i = 0; i < items.length; i++) {
      const el = itemRefs.current.get(i);
      const h = el?.offsetHeight ?? 0;
      const col = heights.indexOf(Math.min(...heights));
      pos.push({
        left: Math.round(col * (colWidth + gap)),
        top: Math.round(heights[col]),
        width: colWidth,
      });
      heights[col] += h + gap;
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
