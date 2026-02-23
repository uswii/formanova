

# Seamless Image Loading -- Eliminate Pop-in and Visual Delays

## What's causing the current issues

After reviewing every component that displays images, I found these gaps:

1. **No fade-in on load**: When a lazy-loaded image finishes loading, it appears instantly causing a visible "pop-in". The `OptimizedImage` component has no opacity transition on load.
2. **No placeholder/skeleton while loading**: Image containers show empty space (transparent or `bg-muted/20`) until the image arrives, causing a flash from empty to loaded.
3. **Raw `<img>` tags still in use**: `BeforeAfterSlider.tsx`, `JewelryShowcase.tsx` (motion.img carousel), `InspirationModal.tsx`, and `Header.tsx` still use unoptimized `<img>` tags.
4. **No preloading for upcoming carousel slides**: The hero has 10 images but only the first is preloaded. When the carousel advances, the next image hasn't been fetched yet, causing a visible delay.
5. **CinematicShowcase cycling images**: Cycles through 4 images every 800ms with no preloading -- images can appear blank on first pass.

## Changes

### 1. Enhance `OptimizedImage` with fade-in on load
Add an `onLoad` handler that transitions opacity from 0 to 1 over ~200ms. This makes images appear to smoothly materialize rather than pop in. A subtle background color placeholder is shown during load.

### 2. Add image preloading utility
Create a simple `preloadImages(urls[])` helper that creates `Image()` objects to warm the browser cache. Use this in:
- `CinematicHero`: preload all hero carousel images on mount
- `CinematicShowcase`: preload all showcase images on mount
- `JewelryShowcase`: preload all model output images on mount

### 3. Replace remaining raw `<img>` tags
- `BeforeAfterSlider.tsx`: Replace both `<img>` with `OptimizedImage`
- `JewelryShowcase.tsx`: Replace `motion.img` carousel with `OptimizedImage` inside a motion wrapper
- `InspirationModal.tsx`: Replace thumbnail and enlarged `<img>` with `OptimizedImage`
- `Header.tsx`: Replace logo and avatar `<img>` with `OptimizedImage` (with `priority={true}` for logo)

### 4. Add background placeholders to image containers
Add `bg-muted` to all image container divs so there's a neutral tone visible instead of transparency while images load. This prevents the empty-to-content flash.

## Technical Details

### OptimizedImage enhancement (fade-in)

```typescript
const [loaded, setLoaded] = useState(false);

<img
  onLoad={() => setLoaded(true)}
  style={{
    opacity: loaded ? 1 : 0,
    transition: 'opacity 0.2s ease-in',
    aspectRatio,
    ...style,
  }}
/>
```

For `priority` images, `loaded` starts as `true` (no fade needed).

### Preload utility

```typescript
export function preloadImages(srcs: string[]) {
  srcs.forEach(src => {
    const img = new Image();
    img.src = src;
  });
}
```

Called in `useEffect` on mount in carousel components.

### Files to modify

| File | Change |
|------|--------|
| `src/components/ui/optimized-image.tsx` | Add fade-in on load + placeholder background |
| `src/components/CinematicHero.tsx` | Preload all hero images on mount |
| `src/components/CinematicShowcase.tsx` | Preload showcase images on mount |
| `src/components/JewelryShowcase.tsx` | Preload model images, replace `motion.img` |
| `src/components/studio/BeforeAfterSlider.tsx` | Replace raw `<img>` with `OptimizedImage` |
| `src/components/bulk/InspirationModal.tsx` | Replace raw `<img>` with `OptimizedImage` |
| `src/components/layout/Header.tsx` | Replace logo/avatar `<img>` with `OptimizedImage` |

### No new files created

Only modifications to existing components.

### Expected result

- Images fade in smoothly over 200ms instead of popping in
- Carousel slides are pre-cached so transitions are instant
- Neutral background shows during load instead of empty space
- All images use consistent loading behavior via the shared component

