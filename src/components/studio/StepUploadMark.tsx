import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

import { Lightbulb, Loader2, Image as ImageIcon, X, Diamond, Sparkles, Play, Undo2, Redo2, Circle, Expand, Download, HelpCircle, Gem, XOctagon } from 'lucide-react';
import { StudioState, SkinTone, MaskingOutputs } from '@/pages/JewelryStudio';
import { useToast } from '@/hooks/use-toast';
import { MaskCanvas } from './MaskCanvas';
import { MarkingTutorial } from './MarkingTutorial';
import { a100Api } from '@/lib/a100-api';
import { compressImageBlob, imageSourceToBlob } from '@/lib/image-compression';
import { normalizeImageFile } from '@/lib/image-normalize';
// Import embedded example images (768x1024) - Necklaces
import exampleSapphirePearl from '@/assets/examples/necklace-sapphire-pearl.png';
import exampleTeardropBlue from '@/assets/examples/necklace-teardrop-blue.jpg';
import exampleBowChoker from '@/assets/examples/necklace-bow-choker.jpg';
import exampleLayeredPearls from '@/assets/examples/necklace-layered-pearls.png';
import examplePearlStrand from '@/assets/examples/necklace-pearl-strand.jpg';
import exampleRubyPendant from '@/assets/examples/necklace-ruby-pendant.jpg';
import exampleSilverChoker from '@/assets/examples/necklace-silver-choker.png';
import exampleRedGems from '@/assets/examples/necklace-red-gems.png';
import exampleTennisDiamond from '@/assets/examples/necklace-tennis-diamond.png';
import exampleGoldPendant from '@/assets/examples/necklace-gold-pendant.png';

// Import embedded example images (768x1024) - Earrings
import exampleEarringGoldInfinity from '@/assets/examples/earring-gold-infinity.jpg';
import exampleEarringBlackCrystal from '@/assets/examples/earring-black-crystal.jpg';
import exampleEarringColorfulDrop from '@/assets/examples/earring-colorful-drop.png';
import exampleEarringDiamondStuds from '@/assets/examples/earring-diamond-studs.jpg';

// Static example images for necklaces
const NECKLACE_EXAMPLES = [
  { id: 'ex-1', name: 'Red Gems', src: exampleRedGems },
  { id: 'ex-2', name: 'Teardrop Blue', src: exampleTeardropBlue },
  { id: 'ex-3', name: 'Bow Choker', src: exampleBowChoker },
  { id: 'ex-4', name: 'Layered Pearls', src: exampleLayeredPearls },
  { id: 'ex-5', name: 'Pearl Strand', src: examplePearlStrand },
  { id: 'ex-6', name: 'Ruby Pendant', src: exampleRubyPendant },
  { id: 'ex-7', name: 'Silver Choker', src: exampleSilverChoker },
  { id: 'ex-8', name: 'Sapphire Pearl', src: exampleSapphirePearl },
  { id: 'ex-9', name: 'Tennis Diamond', src: exampleTennisDiamond },
  { id: 'ex-10', name: 'Gold Pendant', src: exampleGoldPendant },
];

// Static example images for earrings
const EARRING_EXAMPLES = [
  { id: 'ear-1', name: 'Gold Infinity', src: exampleEarringGoldInfinity },
  { id: 'ear-2', name: 'Black Crystal', src: exampleEarringBlackCrystal },
  { id: 'ear-3', name: 'Colorful Drop', src: exampleEarringColorfulDrop },
  { id: 'ear-4', name: 'Diamond Studs', src: exampleEarringDiamondStuds },
];

// Skin tone selection moved to StepRefineAndGenerate

// SAM3 returns WHITE=jewelry, but our convention is BLACK=jewelry
// This function inverts the mask colors
async function invertMask(maskDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Cannot create canvas context'));
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Invert all RGB values (255 - value)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];       // R
        data[i + 1] = 255 - data[i + 1]; // G
        data[i + 2] = 255 - data[i + 2]; // B
        // Alpha stays the same
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load mask for inversion'));
    img.src = maskDataUrl;
  });
}

// Azure fetch removed - A100 API returns base64 directly

// Create an overlay by compositing the binary mask (green tint) over the original image
// Available overlay colors for mask visualization
export const OVERLAY_COLORS = [
  { name: 'Green', hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } },
  { name: 'Blue', hex: '#00AAFF', rgb: { r: 0, g: 170, b: 255 } },
  { name: 'Pink', hex: '#FF69B4', rgb: { r: 255, g: 105, b: 180 } },
  { name: 'Yellow', hex: '#FFFF00', rgb: { r: 255, g: 255, b: 0 } },
  { name: 'Peach', hex: '#FFCBA4', rgb: { r: 255, g: 203, b: 164 } },
  { name: 'Red', hex: '#FF4444', rgb: { r: 255, g: 68, b: 68 } },
] as const;

export type OverlayColorName = typeof OVERLAY_COLORS[number]['name'];

/**
 * Creates a mask overlay visualization.
 * 
 * Mask convention:
 * - For necklaces: WHITE pixels = jewelry area → apply overlay (SAM returns this directly)
 * - For other jewelry: BLACK pixels = jewelry area → apply overlay (after inversion)
 */
async function createMaskOverlay(
  originalImage: string, 
  maskBinary: string, 
  overlayColor: { r: number; g: number; b: number } = { r: 0, g: 255, b: 0 },
  isNecklaceType: boolean = false
): Promise<string> {
  console.log('[createMaskOverlay] Starting with color:', overlayColor, 'isNecklace:', isNecklaceType);
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Cannot create canvas context'));
      return;
    }

    const originalImg = new Image();
    const maskImg = new Image();
    
    originalImg.crossOrigin = 'anonymous';
    maskImg.crossOrigin = 'anonymous';
    
    let loadedCount = 0;
    const onLoad = () => {
      loadedCount++;
      if (loadedCount < 2) return;
      
      canvas.width = originalImg.width;
      canvas.height = originalImg.height;
      
      // Draw original image
      ctx.drawImage(originalImg, 0, 0);
      
      // Create a temporary canvas for the mask
      const maskCanvas = document.createElement('canvas');
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) {
        reject(new Error('Cannot create mask canvas context'));
        return;
      }
      
      maskCanvas.width = originalImg.width;
      maskCanvas.height = originalImg.height;
      
      // Draw mask scaled to original size
      maskCtx.drawImage(maskImg, 0, 0, originalImg.width, originalImg.height);
      
      // Get mask data and create translucent overlay
      const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const overlayData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Use 35% opacity for translucent overlay
      const overlayOpacity = 0.35;
      
      for (let i = 0; i < maskData.data.length; i += 4) {
        const brightness = (maskData.data[i] + maskData.data[i + 1] + maskData.data[i + 2]) / 3;
        
        // For necklaces: WHITE pixels (brightness >= 128) are jewelry → apply overlay
        // For other jewelry: BLACK pixels (brightness < 128) are jewelry → apply overlay
        const shouldApplyOverlay = isNecklaceType 
          ? brightness >= 128  // WHITE = jewelry for necklaces
          : brightness < 128;  // BLACK = jewelry for other types
        
        if (shouldApplyOverlay) {
          overlayData.data[i] = Math.round(overlayData.data[i] * (1 - overlayOpacity) + overlayColor.r * overlayOpacity);
          overlayData.data[i + 1] = Math.round(overlayData.data[i + 1] * (1 - overlayOpacity) + overlayColor.g * overlayOpacity);
          overlayData.data[i + 2] = Math.round(overlayData.data[i + 2] * (1 - overlayOpacity) + overlayColor.b * overlayOpacity);
        }
      }
      
      ctx.putImageData(overlayData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    
    originalImg.onload = onLoad;
    maskImg.onload = onLoad;
    originalImg.onerror = () => reject(new Error('Failed to load original image'));
    maskImg.onerror = () => reject(new Error('Failed to load mask image'));
    
    originalImg.src = originalImage;
    maskImg.src = maskBinary;
  });
}

interface Props {
  state: StudioState;
  updateState: (updates: Partial<StudioState>) => void;
  onNext: () => void;
  jewelryType?: string;
}

export function StepUploadMark({ state, updateState, onNext, jewelryType = 'necklace' }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [undoStack, setUndoStack] = useState<{ x: number; y: number }[][]>([]);
  const [redoStack, setRedoStack] = useState<{ x: number; y: number }[][]>([]);
  const [markerSize, setMarkerSize] = useState(10);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Preprocessing state (Temporal workflow)
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  
  const { toast } = useToast();
  
  const redDots = state.redDots;
  const setRedDots = (dotsOrFn: { x: number; y: number }[] | ((prev: { x: number; y: number }[]) => { x: number; y: number }[])) => {
    if (typeof dotsOrFn === 'function') {
      updateState({ redDots: dotsOrFn(state.redDots) });
    } else {
      updateState({ redDots: dotsOrFn });
    }
  };

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload an image file.',
      });
      return;
    }

    // Normalize unsupported formats (e.g. AVIF, HEIC) to JPG
    const normalized = await normalizeImageFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setRedDots([]);
      setUndoStack([]);
      setRedoStack([]);
      
      // Just show preview - no preprocessing, Temporal will handle everything
      updateState({
        originalImage: result,
        markedImage: null,
        maskOverlay: null,
        maskBinary: null,
        originalMask: null,
        editedMask: null,
        fluxResult: null,
        geminiResult: null,
        fidelityViz: null,
        metrics: null,
        status: null,
        sessionId: null,
        scaledPoints: null,
        processingState: {},
      });
    };
    reader.readAsDataURL(normalized);
  }, [toast, updateState]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Handle paste from clipboard (Ctrl+V / Cmd+V)
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleFileUpload(file);
          toast({
            title: 'Image pasted',
            description: 'Your image has been loaded from clipboard.',
          });
        }
        break;
      }
    }
  }, [handleFileUpload, toast]);

  // Add global paste listener when no image is loaded
  useEffect(() => {
    if (!state.originalImage) {
      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }
  }, [state.originalImage, handlePaste]);

  // Run segmentation via A100 API directly
  const handleProceed = async () => {
    if (redDots.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No marks found',
        description: 'Please mark the jewelry with red dots first.',
      });
      return;
    }

    if (!state.originalImage) {
      toast({
        variant: 'destructive',
        title: 'No image',
        description: 'Please upload an image first.',
      });
      return;
    }

    // Start processing
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStep('AI is identifying jewelry...');

    try {
      // Check if A100 server is online
      const isOnline = await a100Api.ensureOnline();
      if (!isOnline) {
        throw new Error('AI server is offline. Please try again later.');
      }
      
      setProcessingProgress(10);
      setProcessingStep('Preparing image...');
      
      // Convert image to base64
      const rawBlob = await imageSourceToBlob(state.originalImage);
      const { blob: imageBlob, wasCompressed } = await compressImageBlob(rawBlob);
      if (wasCompressed) {
        console.log('[A100] Image compressed for upload');
      }
      
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });
      
      // Convert points to array format [[x, y], ...]
      const points = redDots.map(dot => [dot.x, dot.y]);
      
      setProcessingProgress(30);
      setProcessingStep('AI is identifying jewelry...');
      
      // Map jewelry type to singular form for A100
      let singularType = jewelryType;
      if (jewelryType === 'necklaces') singularType = 'necklace';
      else if (jewelryType === 'rings') singularType = 'ring';
      else if (jewelryType === 'bracelets') singularType = 'bracelet';
      else if (jewelryType === 'earrings') singularType = 'earring';
      else if (jewelryType === 'watches') singularType = 'watch';
      
      console.log('[A100] Calling segment API with', points.length, 'points, type:', singularType);
      
      // Call A100 segment endpoint directly
      const segmentResult = await a100Api.segment({
        image_base64: imageBase64,
        points: points,
        jewelry_type: singularType,
      });
      
      if (!segmentResult) {
        throw new Error('Segmentation failed. Please try again.');
      }
      
      setProcessingProgress(80);
      setProcessingStep('Processing mask...');
      
      console.log('[A100] Segment response:', {
        sessionId: segmentResult.session_id,
        imageWidth: segmentResult.image_width,
        imageHeight: segmentResult.image_height,
        hasScaledPoints: segmentResult.scaled_points?.length > 0,
      });
      
      // A100 returns masks with proper format
      let maskBinary = segmentResult.mask_base64.startsWith('data:') 
        ? segmentResult.mask_base64 
        : `data:image/png;base64,${segmentResult.mask_base64}`;
      
      let originalMask = segmentResult.original_mask_base64.startsWith('data:')
        ? segmentResult.original_mask_base64
        : `data:image/png;base64,${segmentResult.original_mask_base64}`;
      
      const processedImage = segmentResult.processed_image_base64.startsWith('data:')
        ? segmentResult.processed_image_base64
        : `data:image/jpeg;base64,${segmentResult.processed_image_base64}`;
      
      // For non-necklace jewelry, invert the mask so BLACK = jewelry (consistent convention)
      const isNecklace = singularType === 'necklace';
      if (!isNecklace) {
        console.log('[A100] Inverting mask for non-necklace jewelry type:', singularType);
        maskBinary = await invertMask(maskBinary);
        originalMask = await invertMask(originalMask);
      }
      
      // Create custom overlay - necklaces use WHITE=jewelry, others use BLACK=jewelry
      const customOverlay = await createMaskOverlay(
        processedImage,
        maskBinary,
        { r: 0, g: 255, b: 0 }, // Default green overlay
        isNecklace // Pass jewelry type to flip overlay logic for necklaces
      );
      
      setProcessingProgress(100);
      setProcessingStep('Complete!');
      
      // Update state with results
      updateState({
        maskOverlay: customOverlay,
        maskBinary: maskBinary,
        originalMask: originalMask,
        originalImage: processedImage,
        scaledPoints: segmentResult.scaled_points,
        processingState: {
          sessionId: segmentResult.session_id,
          imageWidth: segmentResult.image_width,
          imageHeight: segmentResult.image_height,
        },
      });

      setIsProcessing(false);
      onNext();

    } catch (error) {
      console.error('[A100] Masking error:', error);
      toast({
        variant: 'destructive',
        title: 'Masking failed',
        description: error instanceof Error ? error.message : 'Failed to generate mask. Is the A100 server online?',
      });
      setIsProcessing(false);
    }
  };

  const handleCancelProcessing = () => {
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStep('');
  };

  const MAX_DOTS = 6;
  const isNecklace = jewelryType === 'necklace' || jewelryType === 'necklaces';
  const [showMaxDotsWarning, setShowMaxDotsWarning] = useState(false);

  const handleCanvasClick = (x: number, y: number) => {
    // Check if we've reached max - only enforce for necklaces
    if (isNecklace && redDots.length >= MAX_DOTS) {
      setShowMaxDotsWarning(true);
      // Auto-hide after 2 seconds
      setTimeout(() => setShowMaxDotsWarning(false), 2000);
      return;
    }
    
    setUndoStack((prev) => [...prev, redDots]);
    setRedoStack([]);
    setRedDots((prev) => [...prev, { x, y }]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, redDots]);
    setRedDots(previousState);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, redDots]);
    setRedDots(nextState);
  };

  const clearImage = () => {
    updateState({
      originalImage: null,
      markedImage: null,
      maskOverlay: null,
      maskBinary: null,
      originalMask: null,
      editedMask: null,
      sessionId: null,
      scaledPoints: null,
      redDots: [],
      processingState: {},
    });
    setUndoStack([]);
    setRedoStack([]);
  };

  const loadStaticExample = (example: { id: string; name: string; src: string }) => {
    setRedDots([]);
    setUndoStack([]);
    setRedoStack([]);
    
    // Just show preview - Temporal handles all processing
    updateState({
      originalImage: example.src,
      markedImage: null,
      maskOverlay: null,
      maskBinary: null,
      originalMask: null,
      editedMask: null,
      fluxResult: null,
      geminiResult: null,
      fidelityViz: null,
      metrics: null,
      status: null,
      sessionId: null,
      scaledPoints: null,
      processingState: {},
    });
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Note: We no longer return early during processing - instead we show overlay on the image

  return (
    <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
      {/* Tutorial Overlay */}
      {showTutorial && <MarkingTutorial onDismiss={() => setShowTutorial(false)} />}
      
      {/* Fullscreen Dialog - Interactive mode for marking */}
      <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh] p-0 bg-background/95 backdrop-blur-xl border-border/20 [&>button]:hidden overflow-hidden flex flex-col">
          <DialogTitle className="sr-only">Enlarged Image View</DialogTitle>
          <div className="relative w-full h-full flex flex-col min-h-0 flex-1">
            {/* Top toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-border/20">
              <div className="flex items-center gap-4">
                {/* Marker count */}
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-medium">{redDots.length}{isNecklace ? `/${MAX_DOTS}` : ''} marks</span>
                </div>
                {/* Marker size slider */}
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                  <Circle className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">Size</span>
                  <Slider
                    value={[markerSize]}
                    onValueChange={([v]) => setMarkerSize(v)}
                    min={4}
                    max={24}
                    step={1}
                    className="w-24"
                  />
                  <span className="text-xs font-medium w-6">{markerSize}px</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  title="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  title="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setUndoStack((prev) => [...prev, redDots]);
                    setRedoStack([]);
                    setRedDots([]);
                  }}
                  disabled={redDots.length === 0}
                  title="Clear all marks"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
                <div className="w-px h-6 bg-border/40 mx-1" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fullscreenImage && handleDownload(fullscreenImage, 'jewelry_image.jpg')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFullscreenImage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Canvas area */}
            <div className="flex-1 min-h-0 overflow-auto p-4 flex items-center justify-center">
              {fullscreenImage && state.originalImage && (
                <div className="relative">
                  <MaskCanvas
                    image={state.originalImage}
                    dots={redDots}
                    brushSize={markerSize}
                    mode="dot"
                    canvasSize={Math.min(window.innerHeight * 0.7, 700)}
                    jewelryType={jewelryType}
                    onCanvasClick={handleCanvasClick}
                  />
                  {/* Max dots warning overlay - only for necklaces */}
                  {isNecklace && showMaxDotsWarning && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                      <div className="bg-destructive text-destructive-foreground rounded-lg px-4 py-3 shadow-xl text-center animate-pulse">
                        <p className="text-sm font-semibold">Maximum {MAX_DOTS} dots allowed</p>
                        <p className="text-xs mt-1 opacity-80">Remove some to add more</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Bottom hint */}
            <div className="p-4 border-t border-border/20 flex justify-center">
              <p className="text-sm text-muted-foreground">
                Click on jewelry to mark it. Usually 3-5 dots are enough.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Upload Area */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <div className="flex items-center gap-4 mb-3">
            <span className="marta-label">Step 1</span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tight">Upload & Mark</h2>
          <p className="text-muted-foreground mt-2">Upload your image and click on the jewelry to mark it</p>
        </div>
        
        <div className="space-y-4">
          {!state.originalImage ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="relative border border-dashed border-border/40 text-center cursor-pointer hover:border-foreground/40 hover:bg-foreground/5 transition-all p-12 flex-1 flex flex-col items-center justify-center"
            >
              <div className="relative mx-auto w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                  <Diamond className="h-10 w-10 text-primary" />
                </div>
              </div>
              <p className="text-xl font-display font-medium mb-2">Drop your jewelry image here</p>
              <p className="text-sm text-muted-foreground mb-6">or click to browse, or paste from clipboard (Ctrl+V)</p>
              <Button variant="outline" size="lg" className="gap-2">
                <ImageIcon className="h-4 w-4" />
                Browse Files
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative inline-block group">
                  {/* Canvas */}
                  <MaskCanvas
                    image={state.originalImage}
                    dots={redDots}
                    onCanvasClick={isProcessing ? undefined : handleCanvasClick}
                    brushSize={markerSize}
                    mode="dot"
                    canvasSize={400}
                    jewelryType={jewelryType}
                  />
                  
                  {/* Max dots warning overlay */}
                  {/* Max dots warning - only for necklaces */}
                  {isNecklace && showMaxDotsWarning && !isProcessing && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                      <div className="bg-destructive text-destructive-foreground rounded-lg px-4 py-3 shadow-xl text-center animate-pulse">
                        <p className="text-sm font-semibold">Maximum {MAX_DOTS} dots allowed</p>
                        <p className="text-xs mt-1 opacity-80">Remove some to add more</p>
                      </div>
                    </div>
                  )}
                  
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                      <div className="relative mb-4">
                        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                        <Gem className="absolute inset-0 m-auto h-6 w-6 text-primary" />
                      </div>
                      <p className="text-white font-medium text-sm mb-1 text-center px-4">{processingStep}</p>
                      <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500" 
                          style={{ width: `${processingProgress}%` }} 
                        />
                      </div>
                      <p className="text-white/80 text-xs mt-2">{processingProgress}%</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-3 text-white/80 hover:text-white hover:bg-white/10"
                        onClick={handleCancelProcessing}
                      >
                        <XOctagon className="h-3.5 w-3.5 mr-1.5" />
                        Cancel
                      </Button>
                    </div>
                  )}
                  
                  {/* Compact control bar - hide during processing */}
                  {!isProcessing && (
                    <div className="absolute top-2 right-2 z-10 flex gap-1">
                      <button
                        className="w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                        onClick={() => setShowTutorial(true)}
                        title="Tutorial"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                        onClick={() => setFullscreenImage(state.originalImage)}
                        title="Fullscreen"
                      >
                        <Expand className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                        onClick={clearImage}
                        title="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Hide controls during processing */}
              {!isProcessing && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 bg-muted/50 rounded-lg p-3">
                    <Circle className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Marker Size</span>
                    <Slider
                      value={[markerSize]}
                      onValueChange={([v]) => setMarkerSize(v)}
                      min={4}
                      max={24}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-8 text-right">{markerSize}px</span>
                  </div>
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 rounded-full bg-red-500 animate-pulse" />
                      <p className="text-base">
                        <span className="font-bold text-foreground">{redDots.length}</span>
                        <span className="text-muted-foreground"> marks placed</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="default" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo">
                        <Undo2 className="h-5 w-5" />
                      </Button>
                      <Button variant="outline" size="default" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo">
                        <Redo2 className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="default"
                        onClick={() => {
                          setUndoStack((prev) => [...prev, redDots]);
                          setRedoStack([]);
                          setRedDots([]);
                        }}
                        disabled={redDots.length === 0}
                      >
                        Clear All
                      </Button>
                    </div>
                    
                    {/* Generate Mask Button */}
                    <Button 
                      size="lg" 
                      onClick={handleProceed} 
                      disabled={redDots.length === 0 || isProcessing} 
                      className="font-semibold mt-4"
                    >
                      Generate Mask
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border border-border/20 p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Pro Tip:</strong> Use high-quality inputs for best results. Sharp, well-lit images produce the most accurate masks.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Examples Sidebar */}
      <div className="space-y-6">
        <div>
          <span className="marta-label mb-3 block">Gallery</span>
          <h3 className="font-display text-2xl uppercase tracking-tight">Examples</h3>
          <p className="text-muted-foreground text-sm mt-2">Click any example to try it</p>
        </div>
        
        {jewelryType === 'necklace' ? (
          <div className="grid grid-cols-3 gap-2">
            {NECKLACE_EXAMPLES.map((example) => (
              <button
                key={example.id}
                onClick={() => loadStaticExample(example)}
                className="group relative aspect-[3/4] overflow-hidden border border-border/30 hover:border-foreground/30 transition-all"
              >
                <img
                  src={example.src}
                  alt={example.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        ) : jewelryType === 'earring' || jewelryType === 'earrings' ? (
          <div className="grid grid-cols-2 gap-2">
            {EARRING_EXAMPLES.map((example) => (
              <button
                key={example.id}
                onClick={() => loadStaticExample(example)}
                className="group relative aspect-[3/4] overflow-hidden border border-border/30 hover:border-foreground/30 transition-all"
              >
                <img
                  src={example.src}
                  alt={example.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3 text-center py-4">
            <p className="text-sm text-muted-foreground">Upload your {jewelryType} image to get started</p>
            <p className="text-xs text-muted-foreground/70">Examples coming soon for this category</p>
          </div>
        )}
      </div>
    </div>
  );
}
