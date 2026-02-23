import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OptimizedImage } from '@/components/ui/optimized-image';

// Import images
import mannequinInput from '@/assets/showcase/mannequin-input.png';
import jewelryMask from '@/assets/showcase/jewelry-mask.png';
import modelBlackDress from '@/assets/showcase/model-black-dress.png';
import modelWhiteDress from '@/assets/showcase/model-white-dress.png';
import modelBlackTank from '@/assets/showcase/model-black-tank.png';

const generatedImages = [modelBlackDress, modelWhiteDress, modelBlackTank];

const metricsPerOutput = [
  { precision: 99.2, recall: 98.7, iou: 97.4, growth: 94.1 },
  { precision: 98.9, recall: 99.1, iou: 96.8, growth: 95.3 },
  { precision: 99.5, recall: 98.4, iou: 97.9, growth: 93.8 },
];

// Jewelry landmark points derived from mask (normalized 0-100)
interface LandmarkPoint { x: number; y: number; type: 'anchor' | 'corner' }

export function CinematicShowcase() {
  const [showInput, setShowInput] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animatedValues, setAnimatedValues] = useState({ precision: 0, recall: 0, iou: 0, growth: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [jewelryEmphasisUrl, setJewelryEmphasisUrl] = useState<string>('');
  
  // Mask-derived landmarks (bounding box corners + center anchors)
  const [jewelryLandmarks, setJewelryLandmarks] = useState<LandmarkPoint[]>([]);
  const [jewelryBounds, setJewelryBounds] = useState({ minX: 0, minY: 0, maxX: 100, maxY: 100, centerX: 50, centerY: 50 });
  
  // Zero Alteration state
  const [zeroAltPhase, setZeroAltPhase] = useState<'start' | 'verify' | 'complete'>('start');
  
  // All images to cycle through: mannequin + all generated
  const allImages = [mannequinInput, ...generatedImages];
  
  // Each image shown twice: once clean, once with overlay
  // Total entries = allImages.length * 2
  const totalEntries = allImages.length * 2;
  const [currentEntry, setCurrentEntry] = useState(0);
  
  // Derive image index and overlay state from single counter
  const currentImageIndex = Math.floor(currentEntry / 2);
  const showOverlay = currentEntry % 2 === 1;
  
  // Simple continuous cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentEntry(prev => (prev + 1) % totalEntries);
    }, 800);
    
    return () => clearInterval(interval);
  }, [totalEntries]);
  
  // Determine if showing mannequin
  const isShowingMannequin = currentImageIndex === 0;
  const zeroAltOutputIndex = isShowingMannequin ? 0 : currentImageIndex - 1;

  // Track current theme for reactivity
  const [currentTheme, setCurrentTheme] = useState(() => 
    document.documentElement.getAttribute('data-theme') || 
    (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  );

  // Listen for theme changes
  useEffect(() => {
    const updateTheme = () => {
      setCurrentTheme(
        document.documentElement.getAttribute('data-theme') || 
        (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
      );
    };
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => observer.disconnect();
  }, []);

  // Theme colors - read directly from CSS variables for consistency
  const themeColors = useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const primaryHsl = style.getPropertyValue('--primary').trim();
    const bgHsl = style.getPropertyValue('--background').trim();
    
    // Parse HSL values and convert to rgba
    const parseHsl = (hslStr: string): { h: number; s: number; l: number } => {
      const parts = hslStr.split(' ').map(p => parseFloat(p));
      return { h: parts[0] || 0, s: parts[1] || 0, l: parts[2] || 0 };
    };
    
    const hslToRgba = (h: number, s: number, l: number, a: number): string => {
      s = s / 100;
      l = l / 100;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs((h / 60) % 2 - 1));
      const m = l - c / 2;
      let r = 0, g = 0, b = 0;
      if (h < 60) { r = c; g = x; b = 0; }
      else if (h < 120) { r = x; g = c; b = 0; }
      else if (h < 180) { r = 0; g = c; b = x; }
      else if (h < 240) { r = 0; g = x; b = c; }
      else if (h < 300) { r = x; g = 0; b = c; }
      else { r = c; g = 0; b = x; }
      return `rgba(${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)}, ${a})`;
    };
    
    const primary = parseHsl(primaryHsl);
    const bg = parseHsl(bgHsl);
    
    return {
      accent: hslToRgba(primary.h, primary.s, primary.l, 0.95),
      muted: hslToRgba(primary.h, primary.s, primary.l, 0.4),
      jewelryColor: hslToRgba(primary.h, primary.s, primary.l, 0.85),
      bgOverlay: hslToRgba(bg.h, Math.min(bg.s + 10, 100), Math.max(bg.l - 10, 10), 0.35),
    };
  }, [currentTheme]);

  // Extract jewelry region and landmarks from mask
  useEffect(() => {
    const extractLandmarks = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const maskImg = new Image();
      maskImg.onload = () => {
        canvas.width = maskImg.naturalWidth;
        canvas.height = maskImg.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(maskImg, 0, 0);
        
        const maskData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const w = canvas.width;
        const h = canvas.height;
        
        // Find bounding box of jewelry region
        let minX = w, minY = h, maxX = 0, maxY = 0;
        const jewelryPixels: { x: number; y: number }[] = [];
        
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            if (maskData.data[idx] > 200) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
              jewelryPixels.push({ x, y });
            }
          }
        }
        
        if (jewelryPixels.length === 0) return;
        
        // Normalize to percentage coordinates
        const normMinX = (minX / w) * 100;
        const normMinY = (minY / h) * 100;
        const normMaxX = (maxX / w) * 100;
        const normMaxY = (maxY / h) * 100;
        const centerX = (normMinX + normMaxX) / 2;
        const centerY = (normMinY + normMaxY) / 2;
        
        setJewelryBounds({ minX: normMinX, minY: normMinY, maxX: normMaxX, maxY: normMaxY, centerX, centerY });
        
        // Generate landmark points: corners + edge midpoints + center
        const landmarks: LandmarkPoint[] = [
          { x: normMinX, y: normMinY, type: 'corner' },
          { x: normMaxX, y: normMinY, type: 'corner' },
          { x: normMinX, y: normMaxY, type: 'corner' },
          { x: normMaxX, y: normMaxY, type: 'corner' },
          { x: centerX, y: normMinY, type: 'anchor' },
          { x: centerX, y: normMaxY, type: 'anchor' },
          { x: normMinX, y: centerY, type: 'anchor' },
          { x: normMaxX, y: centerY, type: 'anchor' },
        ];
        
        setJewelryLandmarks(landmarks);
        
        // Create two-color overlay: jewelry in one color, background in another
        ctx.clearRect(0, 0, w, h);
        
        // First fill entire canvas with translucent background color
        ctx.fillStyle = themeColors.bgOverlay;
        ctx.fillRect(0, 0, w, h);
        
        // Then draw jewelry region in solid jewelry color (cut out bg and fill)
        ctx.globalCompositeOperation = 'destination-out';
        for (const pixel of jewelryPixels) {
          ctx.fillRect(pixel.x, pixel.y, 1, 1);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = themeColors.jewelryColor;
        for (const pixel of jewelryPixels) {
          ctx.fillRect(pixel.x, pixel.y, 1, 1);
        }
        
        setJewelryEmphasisUrl(canvas.toDataURL('image/png'));
      };
      maskImg.src = jewelryMask;
    };

    extractLandmarks();
  }, [themeColors]);

  // Old zeroAltPhase effects removed - now using single step counter above

  // Section B toggle
  useEffect(() => {
    const interval = setInterval(() => {
      setShowInput(prev => {
        if (prev) return false;
        setCurrentIndex(i => (i + 1) % generatedImages.length);
        return true;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Metrics animation
  useEffect(() => {
    const target = metricsPerOutput[currentIndex];
    const steps = 40;
    const startValues = {
      precision: target.precision - 15 - Math.random() * 10,
      recall: target.recall - 15 - Math.random() * 10,
      iou: target.iou - 15 - Math.random() * 10,
      growth: target.growth - 15 - Math.random() * 10,
    };
    
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      const jitter = step < steps - 5 ? (Math.random() - 0.5) * 2 : 0;
      const eased = 1 - Math.pow(1 - progress, 2);
      
      setAnimatedValues({
        precision: Math.min(target.precision, startValues.precision + (target.precision - startValues.precision) * eased + jitter),
        recall: Math.min(target.recall, startValues.recall + (target.recall - startValues.recall) * eased + jitter),
        iou: Math.min(target.iou, startValues.iou + (target.iou - startValues.iou) * eased + jitter),
        growth: Math.min(target.growth, startValues.growth + (target.growth - startValues.growth) * eased + jitter),
      });
      
      if (step >= steps) {
        clearInterval(interval);
        setAnimatedValues(target);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [currentIndex]);


  const metrics = [
    { label: 'Precision', value: animatedValues.precision },
    { label: 'Recall', value: animatedValues.recall },
    { label: 'IoU', value: animatedValues.iou },
    { label: 'Growth', value: animatedValues.growth },
  ];

  // Mask-derived physics reference overlay - locked to jewelry region
  const MaskDerivedReferenceOverlay = () => {
    const { minX, minY, maxX, maxY, centerX, centerY } = jewelryBounds;
    const padding = 2; // Small padding around jewelry region
    
    return (
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Alignment guides - vertical and horizontal through jewelry center - more prominent */}
          <line 
            x1={centerX} y1={Math.max(0, minY - 12)} 
            x2={centerX} y2={Math.min(100, maxY + 12)} 
            stroke={themeColors.accent} 
            strokeWidth="0.35" 
            strokeDasharray="1.5,1"
          />
          <line 
            x1={Math.max(0, minX - 12)} y1={centerY} 
            x2={Math.min(100, maxX + 12)} y2={centerY} 
            stroke={themeColors.accent} 
            strokeWidth="0.35" 
            strokeDasharray="1.5,1"
          />
          
          {/* Corner registration marks - locked to jewelry bounding box - thicker */}
          {/* Top-left */}
          <path 
            d={`M${minX - padding} ${minY - padding + 4} L${minX - padding} ${minY - padding} L${minX - padding + 4} ${minY - padding}`} 
            fill="none" stroke={themeColors.accent} strokeWidth="0.5" 
          />
          {/* Top-right */}
          <path 
            d={`M${maxX + padding - 4} ${minY - padding} L${maxX + padding} ${minY - padding} L${maxX + padding} ${minY - padding + 4}`} 
            fill="none" stroke={themeColors.accent} strokeWidth="0.5" 
          />
          {/* Bottom-left */}
          <path 
            d={`M${minX - padding} ${maxY + padding - 4} L${minX - padding} ${maxY + padding} L${minX - padding + 4} ${maxY + padding}`} 
            fill="none" stroke={themeColors.accent} strokeWidth="0.5" 
          />
          {/* Bottom-right */}
          <path 
            d={`M${maxX + padding - 4} ${maxY + padding} L${maxX + padding} ${maxY + padding} L${maxX + padding} ${maxY + padding - 4}`} 
            fill="none" stroke={themeColors.accent} strokeWidth="0.5" 
          />
        </svg>
        
        {/* Intuitive crosshair-style anchor points at mask-derived landmarks */}
        {jewelryLandmarks.map((landmark, i) => (
          <div 
            key={i}
            className="absolute"
            style={{ 
              left: `${landmark.x}%`, 
              top: `${landmark.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {/* Crosshair style marker */}
            <svg width="16" height="16" viewBox="0 0 16 16" className="overflow-visible">
              {/* Horizontal line */}
              <line x1="0" y1="8" x2="16" y2="8" stroke={themeColors.accent} strokeWidth="1.5" />
              {/* Vertical line */}
              <line x1="8" y1="0" x2="8" y2="16" stroke={themeColors.accent} strokeWidth="1.5" />
              {/* Center dot */}
              <circle cx="8" cy="8" r="2.5" fill={themeColors.accent} />
            </svg>
          </div>
        ))}
      </motion.div>
    );
  };


  return (
    <div className="w-full">
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
        
        {/* SECTION A — Zero Alteration */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/20 border border-border">
          {/* Simple toggle - show current image only */}
          <div className="absolute inset-0">
            <OptimizedImage
              src={allImages[currentImageIndex]}
              alt="Current"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Overlay */}
          <div 
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{ opacity: showOverlay && jewelryEmphasisUrl ? 1 : 0 }}
          >
            {jewelryEmphasisUrl && (
              <img
                src={jewelryEmphasisUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
          </div>
          {/* Landmarks */}
          {showOverlay && <MaskDerivedReferenceOverlay />}
          
          {/* Status label */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className={`px-3 py-1.5 rounded-full font-medium tracking-wide text-center ${
              !showOverlay
                ? 'bg-background/90 text-foreground border border-border text-[10px]'
                : 'bg-primary/80 text-primary-foreground text-[8px]'
            }`}>
              {isShowingMannequin && !showOverlay && 'Original Input'}
              {showOverlay && 'Zero Alteration'}
              {!isShowingMannequin && !showOverlay && 'Realistic Imagery'}
            </div>
          </div>
        </div>

        {/* SECTION B — Metrics */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted/20 border border-border flex flex-col items-center justify-center p-5">
          <div className="space-y-4 w-full max-w-[220px]">
            {metrics.map((metric) => (
              <div key={metric.label} className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {metric.label}
                  </span>
                  <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
                    {metric.value.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    animate={{ width: `${metric.value}%` }}
                    transition={{ duration: 0.05 }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <AnimatePresence mode="wait">
              {zeroAltPhase === 'complete' ? (
                <motion.div
                  key="verified"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-[10px] font-medium text-green-500 uppercase tracking-wider">
                    Verified
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="calculating"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
                    Calculating
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
}
