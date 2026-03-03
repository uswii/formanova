import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Diamond,
  Image as ImageIcon,
  X,
  Users,
  Upload,
  Check,
  Lightbulb,
  ChevronRight,
  Gem,
  XOctagon,
  Sparkles,
  Download,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { useToast } from '@/hooks/use-toast';
import { normalizeImageFile } from '@/lib/image-normalize';
import { compressImageBlob, imageSourceToBlob } from '@/lib/image-compression';
import { ECOM_MODELS, EDITORIAL_MODELS, type ModelImage } from '@/lib/model-library';
import { useImageValidation, type ImageValidationResult } from '@/hooks/use-image-validation';
import {
  startPhotoshoot,
  getPhotoshootStatus,
  getPhotoshootResult,
  uploadImageForUrl,
  type PhotoshootResultResponse,
} from '@/lib/photoshoot-api';
import { useCreditPreflight } from '@/hooks/use-credit-preflight';
import { CreditPreflightModal } from '@/components/CreditPreflightModal';
import { useCredits } from '@/contexts/CreditsContext';
import { azureUriToUrl } from '@/components/generations/CadWorkflowModal';

// Import worn-example images
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

// ─── Types ──────────────────────────────────────────────────────────

type StudioStep = 'upload' | 'generating' | 'results';

// ─── Component ──────────────────────────────────────────────────────

export default function UnifiedStudio() {
  const { type } = useParams<{ type: string }>();
  const jewelryType = type || 'necklace';
  const { toast } = useToast();
  const { checkCredits, showInsufficientModal, dismissModal, preflightResult, checking: preflightChecking } = useCreditPreflight();
  const { refreshCredits } = useCredits();

  // Step
  const [currentStep, setCurrentStep] = useState<StudioStep>('upload');

  // Jewelry image
  const jewelryInputRef = useRef<HTMLInputElement>(null);
  const [jewelryImage, setJewelryImage] = useState<string | null>(null);
  const [jewelryFile, setJewelryFile] = useState<File | null>(null);

  // Model selection
  const [selectedModel, setSelectedModel] = useState<ModelImage | null>(null);
  const [customModelImage, setCustomModelImage] = useState<string | null>(null);
  const [customModelFile, setCustomModelFile] = useState<File | null>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const [modelTab, setModelTab] = useState<'ecom' | 'editorial'>('ecom');

  const activeModelUrl = customModelImage || selectedModel?.url || null;

  // Validation
  const { isValidating, results: validationResults, validateImages, clearValidation } = useImageValidation();
  const [validationResult, setValidationResult] = useState<ImageValidationResult | null>(null);

  // Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // ─── Upload Handlers ──────────────────────────────────────────────

  const handleJewelryUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload an image.' });
      return;
    }
    const normalized = await normalizeImageFile(file);
    setJewelryFile(normalized);
    const reader = new FileReader();
    reader.onload = (e) => {
      setJewelryImage(e.target?.result as string);
      setValidationResult(null);
    };
    reader.readAsDataURL(normalized);

    // Run validation in background
    const result = await validateImages([normalized], jewelryType);
    if (result && result.results.length > 0) {
      setValidationResult(result.results[0]);
    }
  }, [toast, jewelryType, validateImages]);

  const handleModelUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload an image.' });
      return;
    }
    const normalized = await normalizeImageFile(file);
    setCustomModelFile(normalized);
    const reader = new FileReader();
    reader.onload = (e) => {
      setCustomModelImage(e.target?.result as string);
      setSelectedModel(null);
    };
    reader.readAsDataURL(normalized);
  }, [toast]);

  const handleSelectLibraryModel = (model: ModelImage) => {
    setSelectedModel(model);
    setCustomModelImage(null);
    setCustomModelFile(null);
  };

  // Paste handler
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

  // ─── Generate ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!jewelryImage || !activeModelUrl) {
      toast({ variant: 'destructive', title: 'Missing inputs', description: 'Upload a jewelry image and select a model.' });
      return;
    }

    // Credit preflight
    const hasCredits = await checkCredits('jewelry_photoshoot');
    if (!hasCredits) return;

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStep('Uploading jewelry image...');
    setGenerationError(null);
    setCurrentStep('generating');

    try {
      // 1. Upload jewelry image to get URL
      setGenerationProgress(5);
      const jewelryBlob = await imageSourceToBlob(jewelryImage);
      const { blob: compressedJewelry } = await compressImageBlob(jewelryBlob);
      const jewelryUrl = await uploadImageForUrl(compressedJewelry, 'jewelry.jpg');
      console.log('[UnifiedStudio] Jewelry uploaded:', jewelryUrl);

      // 2. Get model URL
      setGenerationProgress(20);
      setGenerationStep('Preparing model image...');
      let modelUrl: string;

      if (selectedModel) {
        // Library model — URL is already public
        modelUrl = selectedModel.url;
      } else if (customModelImage && customModelFile) {
        // Custom upload — need to upload
        setGenerationStep('Uploading model image...');
        const modelBlob = await imageSourceToBlob(customModelImage);
        const { blob: compressedModel } = await compressImageBlob(modelBlob);
        modelUrl = await uploadImageForUrl(compressedModel, 'model.jpg');
      } else {
        throw new Error('No model selected');
      }

      console.log('[UnifiedStudio] Model URL:', modelUrl);

      // 3. Start photoshoot
      setGenerationProgress(35);
      setGenerationStep('Starting AI photoshoot...');

      const idempotencyKey = `${Date.now()}-${jewelryType}-${selectedModel?.id || 'custom'}`;
      const startResponse = await startPhotoshoot({
        jewelry_image_url: jewelryUrl,
        model_image_url: modelUrl,
        category: jewelryType,
        idempotency_key: idempotencyKey,
      });

      setWorkflowId(startResponse.workflow_id);
      console.log('[UnifiedStudio] Workflow started:', startResponse.workflow_id);

      // 4. Poll until done
      setGenerationStep('Generating photoshoot...');
      const pollStart = Date.now();
      const TIMEOUT = 300000; // 5 min

      while (Date.now() - pollStart < TIMEOUT) {
        await new Promise(r => setTimeout(r, 3000));

        const status = await getPhotoshootStatus(startResponse.workflow_id);
        const state = status.progress?.state || (status as any).state;

        if (status.progress) {
          const visited = status.progress.visited || [];
          const total = status.progress.total_nodes || 1;
          const completed = status.progress.completed_nodes || 0;
          const pct = Math.min(35 + Math.round((completed / total) * 60), 95);
          setGenerationProgress(pct);

          if (visited.length > 0) {
            const lastStep = visited[visited.length - 1];
            setGenerationStep(lastStep.replace(/_/g, ' '));
          }
        }

        if (state === 'completed') {
          setGenerationProgress(100);
          setGenerationStep('Complete!');

          const result = await getPhotoshootResult(startResponse.workflow_id);
          console.log('[UnifiedStudio] Result:', result);

          // Extract output images from result
          const images = extractResultImages(result);
          setResultImages(images);
          setCurrentStep('results');
          setIsGenerating(false);
          refreshCredits();
          return;
        }

        if (state === 'failed') {
          throw new Error(status.error || 'Photoshoot generation failed');
        }
      }

      throw new Error('Generation timed out after 5 minutes');
    } catch (error) {
      console.error('[UnifiedStudio] Generation error:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unknown error');
      setIsGenerating(false);
      toast({ variant: 'destructive', title: 'Generation failed', description: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  /** Extract image URLs from the workflow result response */
  function extractResultImages(result: PhotoshootResultResponse): string[] {
    const images: string[] = [];

    for (const key of Object.keys(result)) {
      const items = result[key];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;

        // Check common output keys
        for (const k of ['output_url', 'image_url', 'result_url', 'url', 'image_b64', 'output_image']) {
          const val = obj[k];
          if (typeof val === 'string' && val.length > 0) {
            if (val.startsWith('azure://')) {
              images.push(azureUriToUrl(val));
            } else if (val.startsWith('http') || val.startsWith('data:')) {
              images.push(val);
            }
          }
        }
      }
    }

    return images;
  }

  const handleStartOver = () => {
    setJewelryImage(null);
    setJewelryFile(null);
    setSelectedModel(null);
    setCustomModelImage(null);
    setCustomModelFile(null);
    setValidationResult(null);
    setResultImages([]);
    setWorkflowId(null);
    setGenerationError(null);
    setCurrentStep('upload');
    clearValidation();
  };

  // ─── Examples ─────────────────────────────────────────────────────

  const examples = WORN_EXAMPLES[jewelryType] || WORN_EXAMPLES.necklace;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {showInsufficientModal && preflightResult && (
        <CreditPreflightModal
          open={showInsufficientModal}
          onOpenChange={(open) => !open && dismissModal()}
          estimatedCredits={preflightResult.estimatedCredits}
          currentBalance={preflightResult.currentBalance}
        />
      )}

      <div className="px-6 md:px-12 py-8 relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-1">
            {jewelryType} Studio
          </span>
          <h1 className="font-display text-4xl md:text-5xl uppercase tracking-tight">
            AI Photoshoot
          </h1>
        </motion.div>

        {/* ─── UPLOAD STEP ──────────────────────────────────────────── */}
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
                  <div className="space-y-3">
                    <div className="relative group">
                      <div className="border border-border/30 overflow-hidden flex items-center justify-center bg-muted/30 max-h-[400px]">
                        <img
                          src={jewelryImage}
                          alt="Jewelry"
                          className="max-w-full max-h-[400px] object-contain"
                        />
                      </div>
                      <button
                        onClick={() => { setJewelryImage(null); setJewelryFile(null); setValidationResult(null); clearValidation(); }}
                        className="absolute top-2 right-2 w-7 h-7 bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border/40 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      {/* Validation badge */}
                      {isValidating && (
                        <div className="absolute top-2 left-2 bg-muted/90 backdrop-blur-sm px-2 py-1 flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">Validating…</span>
                        </div>
                      )}
                      {!isValidating && validationResult && (
                        <div className={`absolute top-2 left-2 backdrop-blur-sm px-2 py-1 flex items-center gap-1.5 ${
                          validationResult.is_acceptable
                            ? 'bg-green-500/10 border border-green-500/20'
                            : 'bg-destructive/10 border border-destructive/20'
                        }`}>
                          {validationResult.is_acceptable
                            ? <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                            : <AlertTriangle className="h-3 w-3 text-destructive" />
                          }
                          <span className={`font-mono text-[9px] tracking-wider uppercase ${
                            validationResult.is_acceptable ? 'text-green-600 dark:text-green-400' : 'text-destructive'
                          }`}>
                            {validationResult.is_acceptable ? 'Accepted' : 'Flagged — not worn'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Flagged warning */}
                    {validationResult && !validationResult.is_acceptable && (
                      <div className="border border-destructive/20 bg-destructive/5 p-3 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-destructive">Image may not produce optimal results</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            This image appears to be a product shot. For best results, use a photo with jewelry <strong>worn on a person</strong>. You can still proceed if you'd like.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Guidelines */}
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
                      <p className="font-mono text-[9px] tracking-[0.2em] text-destructive uppercase mb-2 flex items-center gap-1">
                        <X className="h-3 w-3" /> Not Accepted
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        {examples.notAllowed.map((src, i) => (
                          <div key={i} className="aspect-[3/4] overflow-hidden border border-destructive/20 opacity-60">
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
                      onClick={() => { setSelectedModel(null); setCustomModelImage(null); setCustomModelFile(null); }}
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

                {/* Generate Button */}
                <Button
                  size="lg"
                  onClick={handleGenerate}
                  disabled={!jewelryImage || !activeModelUrl || preflightChecking}
                  className="w-full font-display text-lg uppercase tracking-wide gap-2"
                >
                  {preflightChecking ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                  Generate Photoshoot
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── GENERATING STEP ──────────────────────────────────────── */}
        {currentStep === 'generating' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="relative mb-8">
              <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <Gem className="absolute inset-0 m-auto h-10 w-10 text-primary" />
            </div>

            <h2 className="font-display text-3xl uppercase tracking-tight mb-2">
              Generating
            </h2>
            <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase mb-6">
              {generationStep || 'Starting…'}
            </p>

            <div className="w-64 h-2 bg-muted rounded-full overflow-hidden mb-2">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${generationProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">{generationProgress}%</p>

            {/* Preview of inputs */}
            <div className="flex gap-4 mt-10">
              {jewelryImage && (
                <div className="w-20 h-20 border border-border/30 overflow-hidden">
                  <img src={jewelryImage} alt="Jewelry" className="w-full h-full object-cover opacity-60" />
                </div>
              )}
              {activeModelUrl && (
                <div className="w-20 h-20 border border-border/30 overflow-hidden">
                  <img src={activeModelUrl} alt="Model" className="w-full h-full object-cover opacity-60" />
                </div>
              )}
            </div>

            {generationError && (
              <div className="mt-6 border border-destructive/20 bg-destructive/5 p-4 max-w-md text-center">
                <p className="text-sm text-destructive mb-3">{generationError}</p>
                <Button variant="outline" size="sm" onClick={handleStartOver} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── RESULTS STEP ─────────────────────────────────────────── */}
        {currentStep === 'results' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
          >
            <div className="text-center">
              <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-1">
                Complete
              </span>
              <h2 className="font-display text-4xl uppercase tracking-tight">
                Your Results
              </h2>
            </div>

            {resultImages.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
                {resultImages.map((url, i) => (
                  <div key={i} className="relative group border border-border/30 overflow-hidden">
                    <img
                      src={url}
                      alt={`Result ${i + 1}`}
                      className="w-full aspect-[3/4] object-contain bg-muted/30"
                    />
                    <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={url}
                        download={`photoshoot-${workflowId?.slice(0, 8)}-${i + 1}.jpg`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="outline" size="sm" className="gap-2 w-full font-mono text-[10px] uppercase tracking-wider">
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </Button>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground">No result images found. The workflow may still be processing.</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleStartOver} className="gap-2 font-mono text-[10px] uppercase tracking-wider">
                <RefreshCw className="h-4 w-4" />
                New Photoshoot
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
