import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Diamond,
  Image as ImageIcon,
  X,
  Users,
  Camera,
  ChevronRight,
  Check,
  Lightbulb,
  Loader2,
  Sparkles,
  Circle,
  Undo2,
  Redo2,
  Expand,
  HelpCircle,
  Gem,
  XOctagon,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { useToast } from '@/hooks/use-toast';
import { normalizeImageFile } from '@/lib/image-normalize';
import { ECOM_MODELS, EDITORIAL_MODELS, type ModelImage } from '@/lib/model-library';
import { MaskCanvas } from '@/components/studio/MaskCanvas';
import { MarkingTutorial } from '@/components/studio/MarkingTutorial';
import { StepRefineAndGenerate } from '@/components/studio/StepRefineAndGenerate';
import { a100Api } from '@/lib/a100-api';
import { compressImageBlob, imageSourceToBlob } from '@/lib/image-compression';

// Import worn-example images (reuse from batch system)
import exampleNecklace1 from '@/assets/examples/necklace-allowed-1.jpg';
import exampleNecklace2 from '@/assets/examples/necklace-allowed-2.jpg';
import exampleNecklace3 from '@/assets/examples/necklace-allowed-3.jpg';
import exampleEarring1 from '@/assets/examples/earring-allowed-1.jpg';
import exampleEarring2 from '@/assets/examples/earring-allowed-2.jpg';
import exampleEarring3 from '@/assets/examples/earring-allowed-3.jpg';
import exampleRing1 from '@/assets/examples/ring-allowed-1.png';
import exampleRing2 from '@/assets/examples/ring-allowed-2.png';
import exampleRing3 from '@/assets/examples/ring-allowed-3.jpg';
import exampleBracelet1 from '@/assets/examples/bracelet-allowed-1.jpg';
import exampleBracelet2 from '@/assets/examples/bracelet-allowed-2.jpg';
import exampleBracelet3 from '@/assets/examples/bracelet-allowed-3.jpg';
import exampleWatch1 from '@/assets/examples/watch-allowed-1.jpg';
import exampleWatch2 from '@/assets/examples/watch-allowed-2.jpg';
import exampleWatch3 from '@/assets/examples/watch-allowed-3.png';

// Not-allowed examples
import exampleNecklaceNot1 from '@/assets/examples/necklace-notallowed-1.png';
import exampleNecklaceNot2 from '@/assets/examples/necklace-notallowed-2.png';
import exampleNecklaceNot3 from '@/assets/examples/necklace-notallowed-3.png';
import exampleEarringNot1 from '@/assets/examples/earring-notallowed-1.png';
import exampleEarringNot2 from '@/assets/examples/earring-notallowed-2.png';
import exampleEarringNot3 from '@/assets/examples/earring-notallowed-3.png';
import exampleRingNot1 from '@/assets/examples/ring-notallowed-1.png';
import exampleRingNot2 from '@/assets/examples/ring-notallowed-2.png';
import exampleRingNot3 from '@/assets/examples/ring-notallowed-3.png';
import exampleBraceletNot1 from '@/assets/examples/bracelet-notallowed-1.png';
import exampleBraceletNot2 from '@/assets/examples/bracelet-notallowed-2.png';
import exampleBraceletNot3 from '@/assets/examples/bracelet-notallowed-3.png';
import exampleWatchNot1 from '@/assets/examples/watch-notallowed-1.png';
import exampleWatchNot2 from '@/assets/examples/watch-notallowed-2.png';
import exampleWatchNot3 from '@/assets/examples/watch-notallowed-3.png';

// ─── Types ──────────────────────────────────────────────────────────

export type SkinTone = 'light' | 'fair' | 'medium' | 'olive' | 'brown' | 'dark';

export interface ProcessingState {
  resizedUri?: string;
  bgRemovedUri?: string;
  maskUri?: string;
  overlayUri?: string;
  padding?: { top: number; bottom: number; left: number; right: number };
  originalMaskBase64?: string;
  scaledPoints?: number[][];
  sessionId?: string;
  imageWidth?: number;
  imageHeight?: number;
}

export interface MaskingOutputs {
  resizedImage?: string;
  jewelrySegment?: string;
  jewelryGreen?: string;
  resizeMetadata?: Record<string, unknown>;
}

export interface StudioState {
  originalImage: string | null;
  markedImage: string | null;
  maskOverlay: string | null;
  maskBinary: string | null;
  originalMask: string | null;
  editedMask: string | null;
  gender: 'female' | 'male';
  skinTone: SkinTone;
  fluxResult: string | null;
  geminiResult: string | null;
  fidelityViz: string | null;
  fidelityVizGemini: string | null;
  metrics: { precision: number; recall: number; iou: number; growthRatio: number } | null;
  metricsGemini: { precision: number; recall: number; iou: number; growthRatio: number } | null;
  status: 'good' | 'bad' | null;
  isGenerating: boolean;
  sessionId: string | null;
  scaledPoints: number[][] | null;
  processingState: ProcessingState;
  redDots: { x: number; y: number }[];
  hasTwoModes: boolean;
  workflowResults: Record<string, unknown> | null;
  workflowType: 'flux_gen' | 'all_jewelry' | 'masking' | 'all_jewelry_masking' | null;
  maskingOutputs: MaskingOutputs | null;
}

type StudioStep = 'upload' | 'mark' | 'generate';

// ─── Example Images Map ─────────────────────────────────────────────

const WORN_EXAMPLES: Record<string, { allowed: string[]; notAllowed: string[] }> = {
  necklace: { allowed: [exampleNecklace1, exampleNecklace2, exampleNecklace3], notAllowed: [exampleNecklaceNot1, exampleNecklaceNot2, exampleNecklaceNot3] },
  necklaces: { allowed: [exampleNecklace1, exampleNecklace2, exampleNecklace3], notAllowed: [exampleNecklaceNot1, exampleNecklaceNot2, exampleNecklaceNot3] },
  earring: { allowed: [exampleEarring1, exampleEarring2, exampleEarring3], notAllowed: [exampleEarringNot1, exampleEarringNot2, exampleEarringNot3] },
  earrings: { allowed: [exampleEarring1, exampleEarring2, exampleEarring3], notAllowed: [exampleEarringNot1, exampleEarringNot2, exampleEarringNot3] },
  ring: { allowed: [exampleRing1, exampleRing2, exampleRing3], notAllowed: [exampleRingNot1, exampleRingNot2, exampleRingNot3] },
  rings: { allowed: [exampleRing1, exampleRing2, exampleRing3], notAllowed: [exampleRingNot1, exampleRingNot2, exampleRingNot3] },
  bracelet: { allowed: [exampleBracelet1, exampleBracelet2, exampleBracelet3], notAllowed: [exampleBraceletNot1, exampleBraceletNot2, exampleBraceletNot3] },
  bracelets: { allowed: [exampleBracelet1, exampleBracelet2, exampleBracelet3], notAllowed: [exampleBraceletNot1, exampleBraceletNot2, exampleBraceletNot3] },
  watch: { allowed: [exampleWatch1, exampleWatch2, exampleWatch3], notAllowed: [exampleWatchNot1, exampleWatchNot2, exampleWatchNot3] },
  watches: { allowed: [exampleWatch1, exampleWatch2, exampleWatch3], notAllowed: [exampleWatchNot1, exampleWatchNot2, exampleWatchNot3] },
};

// ─── Mask helpers (same as old StepUploadMark) ──────────────────────

async function invertMask(maskDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = 255 - imageData.data[i];
        imageData.data[i + 1] = 255 - imageData.data[i + 1];
        imageData.data[i + 2] = 255 - imageData.data[i + 2];
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load mask'));
    img.src = maskDataUrl;
  });
}

async function createMaskOverlay(
  originalImage: string,
  maskBinary: string,
  overlayColor = { r: 0, g: 255, b: 0 },
  isNecklaceType = false,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const originalImg = new Image();
    const maskImg = new Image();
    originalImg.crossOrigin = 'anonymous';
    maskImg.crossOrigin = 'anonymous';
    let loaded = 0;
    const onLoad = () => {
      if (++loaded < 2) return;
      canvas.width = originalImg.width;
      canvas.height = originalImg.height;
      ctx.drawImage(originalImg, 0, 0);
      const mc = document.createElement('canvas');
      const mctx = mc.getContext('2d')!;
      mc.width = originalImg.width;
      mc.height = originalImg.height;
      mctx.drawImage(maskImg, 0, 0, originalImg.width, originalImg.height);
      const md = mctx.getImageData(0, 0, mc.width, mc.height);
      const od = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const alpha = 0.35;
      for (let i = 0; i < md.data.length; i += 4) {
        const b = (md.data[i] + md.data[i + 1] + md.data[i + 2]) / 3;
        const apply = isNecklaceType ? b >= 128 : b < 128;
        if (apply) {
          od.data[i] = Math.round(od.data[i] * (1 - alpha) + overlayColor.r * alpha);
          od.data[i + 1] = Math.round(od.data[i + 1] * (1 - alpha) + overlayColor.g * alpha);
          od.data[i + 2] = Math.round(od.data[i + 2] * (1 - alpha) + overlayColor.b * alpha);
        }
      }
      ctx.putImageData(od, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    originalImg.onload = onLoad;
    maskImg.onload = onLoad;
    originalImg.onerror = () => reject(new Error('Failed to load image'));
    maskImg.onerror = () => reject(new Error('Failed to load mask'));
    originalImg.src = originalImage;
    maskImg.src = maskBinary;
  });
}

// ─── Component ──────────────────────────────────────────────────────

export default function UnifiedStudio() {
  const { type } = useParams<{ type: string }>();
  const jewelryType = type || 'necklace';
  const { toast } = useToast();

  // Steps
  const [currentStep, setCurrentStep] = useState<StudioStep>('upload');

  // Jewelry image
  const jewelryInputRef = useRef<HTMLInputElement>(null);
  const [jewelryImage, setJewelryImage] = useState<string | null>(null);

  // Model selection
  const [selectedModel, setSelectedModel] = useState<ModelImage | null>(null);
  const [customModelImage, setCustomModelImage] = useState<string | null>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const [modelTab, setModelTab] = useState<'ecom' | 'editorial'>('ecom');

  // The model image to display (either selected from library or custom upload)
  const activeModelUrl = customModelImage || selectedModel?.url || null;

  // Studio state for masking/generation (compatible with StepRefineAndGenerate)
  const [studioState, setStudioState] = useState<StudioState>({
    originalImage: null,
    markedImage: null,
    maskOverlay: null,
    maskBinary: null,
    originalMask: null,
    editedMask: null,
    gender: 'female',
    skinTone: 'medium',
    fluxResult: null,
    geminiResult: null,
    fidelityViz: null,
    fidelityVizGemini: null,
    metrics: null,
    metricsGemini: null,
    status: null,
    isGenerating: false,
    sessionId: null,
    scaledPoints: null,
    processingState: {},
    redDots: [],
    hasTwoModes: false,
    workflowResults: null,
    workflowType: null,
    maskingOutputs: null,
  });

  const updateStudioState = (updates: Partial<StudioState>) => {
    setStudioState(prev => ({ ...prev, ...updates }));
  };

  // Marking state
  const [redDots, setRedDots] = useState<{ x: number; y: number }[]>([]);
  const [undoStack, setUndoStack] = useState<{ x: number; y: number }[][]>([]);
  const [redoStack, setRedoStack] = useState<{ x: number; y: number }[][]>([]);
  const [markerSize, setMarkerSize] = useState(10);
  const [showTutorial, setShowTutorial] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');

  const MAX_DOTS = 6;
  const isNecklace = jewelryType === 'necklace' || jewelryType === 'necklaces';

  // ─── Upload Handlers ──────────────────────────────────────────────

  const handleJewelryUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload an image.' });
      return;
    }
    const normalized = await normalizeImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setJewelryImage(e.target?.result as string);
    reader.readAsDataURL(normalized);
  }, [toast]);

  const handleModelUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload an image.' });
      return;
    }
    const normalized = await normalizeImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setCustomModelImage(e.target?.result as string);
      setSelectedModel(null); // Clear library selection
    };
    reader.readAsDataURL(normalized);
  }, [toast]);

  const handleSelectLibraryModel = (model: ModelImage) => {
    setSelectedModel(model);
    setCustomModelImage(null); // Clear custom upload
  };

  // Paste handler for jewelry
  useEffect(() => {
    if (jewelryImage) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) handleJewelryUpload(file);
          break;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [jewelryImage, handleJewelryUpload]);

  // ─── Proceed to Marking ───────────────────────────────────────────

  const handleProceedToMark = () => {
    if (!jewelryImage) {
      toast({ variant: 'destructive', title: 'Missing jewelry', description: 'Upload a jewelry image first.' });
      return;
    }
    // Set the jewelry image as the working image for masking
    updateStudioState({ originalImage: jewelryImage });
    setRedDots([]);
    setUndoStack([]);
    setRedoStack([]);
    setCurrentStep('mark');
  };

  // ─── Canvas Click (Marking) ───────────────────────────────────────

  const handleCanvasClick = (x: number, y: number) => {
    if (isNecklace && redDots.length >= MAX_DOTS) return;
    setUndoStack(prev => [...prev, redDots]);
    setRedoStack([]);
    setRedDots(prev => [...prev, { x, y }]);
  };

  const handleUndo = () => {
    if (!undoStack.length) return;
    setRedoStack(prev => [...prev, redDots]);
    setRedDots(undoStack[undoStack.length - 1]);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (!redoStack.length) return;
    setUndoStack(prev => [...prev, redDots]);
    setRedDots(redoStack[redoStack.length - 1]);
    setRedoStack(prev => prev.slice(0, -1));
  };

  // ─── Generate Mask (same logic as old StepUploadMark) ─────────────

  const handleGenerateMask = async () => {
    if (redDots.length === 0 || !studioState.originalImage) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStep('AI is identifying jewelry...');

    try {
      const isOnline = await a100Api.ensureOnline();
      if (!isOnline) throw new Error('AI server is offline.');

      setProcessingProgress(10);
      setProcessingStep('Preparing image...');

      const rawBlob = await imageSourceToBlob(studioState.originalImage);
      const { blob: imageBlob } = await compressImageBlob(rawBlob);
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });

      const points = redDots.map(d => [d.x, d.y]);
      setProcessingProgress(30);
      setProcessingStep('AI is identifying jewelry...');

      let singularType = jewelryType;
      if (singularType === 'necklaces') singularType = 'necklace';
      else if (singularType === 'rings') singularType = 'ring';
      else if (singularType === 'bracelets') singularType = 'bracelet';
      else if (singularType === 'earrings') singularType = 'earring';
      else if (singularType === 'watches') singularType = 'watch';

      const segmentResult = await a100Api.segment({ image_base64: imageBase64, points, jewelry_type: singularType });
      if (!segmentResult) throw new Error('Segmentation failed.');

      setProcessingProgress(80);
      setProcessingStep('Processing mask...');

      let maskBinary = segmentResult.mask_base64.startsWith('data:') ? segmentResult.mask_base64 : `data:image/png;base64,${segmentResult.mask_base64}`;
      let originalMask = segmentResult.original_mask_base64.startsWith('data:') ? segmentResult.original_mask_base64 : `data:image/png;base64,${segmentResult.original_mask_base64}`;
      const processedImage = segmentResult.processed_image_base64.startsWith('data:') ? segmentResult.processed_image_base64 : `data:image/jpeg;base64,${segmentResult.processed_image_base64}`;

      const isNeck = singularType === 'necklace';
      if (!isNeck) {
        maskBinary = await invertMask(maskBinary);
        originalMask = await invertMask(originalMask);
      }

      const customOverlay = await createMaskOverlay(processedImage, maskBinary, { r: 0, g: 255, b: 0 }, isNeck);

      setProcessingProgress(100);

      updateStudioState({
        maskOverlay: customOverlay,
        maskBinary,
        originalMask,
        originalImage: processedImage,
        scaledPoints: segmentResult.scaled_points,
        redDots,
        processingState: {
          sessionId: segmentResult.session_id,
          imageWidth: segmentResult.image_width,
          imageHeight: segmentResult.image_height,
        },
      });

      setIsProcessing(false);
      setCurrentStep('generate');
    } catch (error) {
      console.error('[UnifiedStudio] Masking error:', error);
      toast({ variant: 'destructive', title: 'Masking failed', description: error instanceof Error ? error.message : 'Failed to generate mask.' });
      setIsProcessing(false);
    }
  };

  // ─── Examples ─────────────────────────────────────────────────────

  const examples = WORN_EXAMPLES[jewelryType] || WORN_EXAMPLES.necklace;

  // ─── Step Indicator ───────────────────────────────────────────────

  const steps = [
    { id: 'upload' as const, label: 'Upload', num: 1 },
    { id: 'mark' as const, label: 'Mark Jewelry', num: 2 },
    { id: 'generate' as const, label: 'Generate', num: 3 },
  ];

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="px-6 md:px-12 py-8 relative z-10 max-w-7xl mx-auto">
        {/* Step Progress */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((step, index) => {
            const stepIndex = steps.findIndex(s => s.id === currentStep);
            const thisIndex = steps.findIndex(s => s.id === step.id);
            const isActive = step.id === currentStep;
            const isPast = thisIndex < stepIndex;
            const canClick = isPast || (step.id === 'generate' && studioState.maskBinary);

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => canClick && setCurrentStep(step.id)}
                  className={`flex items-center gap-2 px-4 py-2 transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isPast
                      ? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <div className="h-6 w-6 rounded-full bg-current/20 flex items-center justify-center text-sm font-bold">
                    {isPast ? <Check className="h-3.5 w-3.5" /> : step.num}
                  </div>
                  <span className="hidden sm:inline font-medium text-sm">{step.label}</span>
                </button>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${thisIndex < stepIndex ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ─── STEP 1: Upload ───────────────────────────────────────── */}
        {currentStep === 'upload' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Left: Jewelry Upload */}
              <div className="space-y-6">
                <div>
                  <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-1">
                    Your Jewelry
                  </span>
                  <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tight">
                    Upload Image
                  </h2>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Upload a photo of your jewelry <strong>worn on a person</strong>
                  </p>
                </div>

                {/* Upload Zone */}
                {!jewelryImage ? (
                  <div
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleJewelryUpload(f); }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => jewelryInputRef.current?.click()}
                    className="border border-dashed border-border/40 text-center cursor-pointer hover:border-foreground/40 hover:bg-foreground/5 transition-all p-10 flex flex-col items-center justify-center aspect-[4/3]"
                  >
                    <Diamond className="h-10 w-10 text-primary mb-4" />
                    <p className="text-lg font-display font-medium mb-1">Drop your jewelry image</p>
                    <p className="text-sm text-muted-foreground mb-4">or click to browse, or paste (Ctrl+V)</p>
                    <Button variant="outline" size="sm" className="gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Browse Files
                    </Button>
                    <input
                      ref={jewelryInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleJewelryUpload(f); }}
                    />
                  </div>
                ) : (
                  <div className="relative group">
                    <div className="border border-border/30 overflow-hidden flex items-center justify-center bg-muted/30 max-h-[400px]">
                      <img
                        src={jewelryImage}
                        alt="Jewelry"
                        className="max-w-full max-h-[400px] object-contain"
                      />
                    </div>
                    <button
                      onClick={() => setJewelryImage(null)}
                      className="absolute top-2 right-2 w-7 h-7 bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border/40 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Worn examples guide */}
                <div className="border border-border/20 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Upload Guidelines</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Jewelry must be <strong>worn on a person</strong>. Product-only shots, 3D renders, and AI images are not accepted.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="font-mono text-[9px] tracking-[0.2em] text-green-600 dark:text-green-400 uppercase mb-2 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Accepted
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        {examples.allowed.map((src, i) => (
                          <div key={i} className="aspect-[3/4] overflow-hidden border border-green-500/20">
                            <img src={src} alt="Accepted" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="font-mono text-[9px] tracking-[0.2em] text-red-500 uppercase mb-2 flex items-center gap-1">
                        <X className="h-3 w-3" /> Not Accepted
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        {examples.notAllowed.map((src, i) => (
                          <div key={i} className="aspect-[3/4] overflow-hidden border border-red-500/20 opacity-60">
                            <img src={src} alt="Not accepted" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Model Selection */}
              <div className="space-y-6">
                <div>
                  <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-1">
                    Choose Model
                  </span>
                  <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tight">
                    Model Photo
                  </h2>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Select from our library or upload your own reference
                  </p>
                </div>

                {/* Selected Model Preview */}
                {activeModelUrl && (
                  <div className="relative group">
                    <div className="border-2 border-primary/40 overflow-hidden flex items-center justify-center bg-muted/30 max-h-[200px]">
                      <img
                        src={activeModelUrl}
                        alt="Selected model"
                        className="max-w-full max-h-[200px] object-contain"
                      />
                    </div>
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-mono tracking-wider uppercase">
                      {selectedModel ? selectedModel.label : 'Custom Upload'}
                    </div>
                    <button
                      onClick={() => { setSelectedModel(null); setCustomModelImage(null); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border/40 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Upload own model */}
                <button
                  onClick={() => modelInputRef.current?.click()}
                  className="w-full border border-dashed border-border/40 hover:border-foreground/40 hover:bg-foreground/5 transition-all p-4 flex items-center gap-3"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Upload your own model photo</p>
                    <p className="text-xs text-muted-foreground">Any reference image for the vibe you want</p>
                  </div>
                </button>
                <input
                  ref={modelInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleModelUpload(f); }}
                />

                {/* Model Library */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase">
                      AI Model Library
                    </span>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => setModelTab('ecom')}
                      className={`px-4 py-2 font-mono text-[10px] tracking-[0.2em] uppercase transition-all ${
                        modelTab === 'ecom'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      E-Commerce
                    </button>
                    <button
                      onClick={() => setModelTab('editorial')}
                      className={`px-4 py-2 font-mono text-[10px] tracking-[0.2em] uppercase transition-all ${
                        modelTab === 'editorial'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      Editorial
                    </button>
                  </div>

                  {/* Grid */}
                  <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {(modelTab === 'ecom' ? ECOM_MODELS : EDITORIAL_MODELS).map((model) => {
                      const isSelected = selectedModel?.id === model.id;
                      return (
                        <button
                          key={model.id}
                          onClick={() => handleSelectLibraryModel(model)}
                          className={`group relative aspect-[3/4] overflow-hidden border-2 transition-all ${
                            isSelected
                              ? 'border-primary ring-2 ring-primary/30'
                              : 'border-border/30 hover:border-foreground/30'
                          }`}
                        >
                          <img
                            src={model.url}
                            alt={model.label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                                <Check className="h-3.5 w-3.5 text-primary-foreground" />
                              </div>
                            </div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                            <span className="font-mono text-[8px] tracking-wider text-white uppercase">
                              {model.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Proceed Button */}
                <Button
                  size="lg"
                  onClick={handleProceedToMark}
                  disabled={!jewelryImage}
                  className="w-full font-display text-lg uppercase tracking-wide gap-2"
                >
                  Continue to Marking
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── STEP 2: Mark ─────────────────────────────────────────── */}
        {currentStep === 'mark' && studioState.originalImage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {showTutorial && <MarkingTutorial onDismiss={() => setShowTutorial(false)} />}

            {/* Fullscreen Dialog */}
            <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
              <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh] p-0 bg-background/95 backdrop-blur-xl border-border/20 [&>button]:hidden overflow-hidden flex flex-col">
                <DialogTitle className="sr-only">Enlarged Image View</DialogTitle>
                <div className="relative w-full h-full flex flex-col min-h-0 flex-1">
                  <div className="flex items-center justify-between p-4 border-b border-border/20">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm font-medium">{redDots.length}{isNecklace ? `/${MAX_DOTS}` : ''} marks</span>
                      </div>
                      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                        <Circle className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs text-muted-foreground">Size</span>
                        <Slider value={[markerSize]} onValueChange={([v]) => setMarkerSize(v)} min={4} max={24} step={1} className="w-24" />
                        <span className="text-xs font-medium w-6">{markerSize}px</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={handleUndo} disabled={!undoStack.length}><Undo2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={handleRedo} disabled={!redoStack.length}><Redo2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => { setUndoStack(p => [...p, redDots]); setRedoStack([]); setRedDots([]); }} disabled={!redDots.length}><X className="h-4 w-4 mr-1" />Clear</Button>
                      <Button size="sm" variant="ghost" onClick={() => setFullscreenImage(null)}><X className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto p-4 flex items-center justify-center">
                    {fullscreenImage && studioState.originalImage && (
                      <MaskCanvas
                        image={studioState.originalImage}
                        dots={redDots}
                        brushSize={markerSize}
                        mode="dot"
                        canvasSize={Math.min(window.innerHeight * 0.7, 700)}
                        jewelryType={jewelryType}
                        onCanvasClick={handleCanvasClick}
                      />
                    )}
                  </div>
                  <div className="p-4 border-t border-border/20 flex justify-center">
                    <p className="text-sm text-muted-foreground">Click on jewelry to mark it. Usually 3-5 dots are enough.</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
              {/* Canvas */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <div className="flex items-center gap-4 mb-3">
                    <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase">Step 2</span>
                  </div>
                  <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tight">Mark Jewelry</h2>
                  <p className="text-muted-foreground mt-2 text-sm">Click on the jewelry to mark it — usually 3-5 dots</p>
                </div>

                <div className="flex justify-center">
                  <div className="relative inline-block group">
                    <MaskCanvas
                      image={studioState.originalImage}
                      dots={redDots}
                      onCanvasClick={isProcessing ? undefined : handleCanvasClick}
                      brushSize={markerSize}
                      mode="dot"
                      canvasSize={400}
                      jewelryType={jewelryType}
                    />
                    {isProcessing && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                        <div className="relative mb-4">
                          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                          <Gem className="absolute inset-0 m-auto h-6 w-6 text-primary" />
                        </div>
                        <p className="text-white font-medium text-sm mb-1">{processingStep}</p>
                        <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${processingProgress}%` }} />
                        </div>
                        <p className="text-white/80 text-xs mt-2">{processingProgress}%</p>
                        <Button variant="ghost" size="sm" className="mt-3 text-white/80 hover:text-white hover:bg-white/10" onClick={() => setIsProcessing(false)}>
                          <XOctagon className="h-3.5 w-3.5 mr-1.5" />Cancel
                        </Button>
                      </div>
                    )}
                    {!isProcessing && (
                      <div className="absolute top-2 right-2 z-10 flex gap-1">
                        <button className="w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white" onClick={() => setShowTutorial(true)}><HelpCircle className="h-3.5 w-3.5" /></button>
                        <button className="w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white" onClick={() => setFullscreenImage(studioState.originalImage)}><Expand className="h-3.5 w-3.5" /></button>
                        <button className="w-6 h-6 rounded bg-black/60 hover:bg-black/80 flex items-center justify-center text-white" onClick={() => setCurrentStep('upload')}><X className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>
                </div>

                {!isProcessing && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 bg-muted/50 rounded-lg p-3">
                      <Circle className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">Marker Size</span>
                      <Slider value={[markerSize]} onValueChange={([v]) => setMarkerSize(v)} min={4} max={24} step={1} className="flex-1" />
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
                        <Button variant="outline" size="default" onClick={handleUndo} disabled={!undoStack.length}><Undo2 className="h-5 w-5" /></Button>
                        <Button variant="outline" size="default" onClick={handleRedo} disabled={!redoStack.length}><Redo2 className="h-5 w-5" /></Button>
                        <Button variant="outline" size="default" onClick={() => { setUndoStack(p => [...p, redDots]); setRedoStack([]); setRedDots([]); }} disabled={!redDots.length}>Clear All</Button>
                      </div>
                    </div>
                    <Button size="lg" onClick={handleGenerateMask} disabled={!redDots.length || isProcessing} className="w-full font-display text-lg uppercase tracking-wide gap-2">
                      <Sparkles className="h-5 w-5" />
                      Generate Mask
                    </Button>
                  </div>
                )}
              </div>

              {/* Sidebar: Model preview + tip */}
              <div className="space-y-6">
                {activeModelUrl && (
                  <div>
                    <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-2">
                      Selected Model
                    </span>
                    <div className="border border-border/30 overflow-hidden aspect-[3/4]">
                      <img src={activeModelUrl} alt="Selected model" className="w-full h-full object-cover" />
                    </div>
                    <p className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground mt-1.5 text-center uppercase">
                      {selectedModel ? selectedModel.label : 'Custom Upload'}
                    </p>
                  </div>
                )}
                <div className="border border-border/20 p-4">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Pro Tip:</strong> Sharp, well-lit images produce the most accurate masks. Place 3-5 dots directly on the jewelry.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── STEP 3: Generate ─────────────────────────────────────── */}
        {currentStep === 'generate' && (
          <StepRefineAndGenerate
            state={studioState}
            updateState={updateStudioState}
            onBack={() => setCurrentStep('mark')}
            jewelryType={jewelryType}
          />
        )}
      </div>
    </div>
  );
}
