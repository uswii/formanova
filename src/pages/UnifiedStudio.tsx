import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Diamond,
  Image as ImageIcon,
  X,
  Upload,
  Check,
  Gem,
  Sparkles,
  Download,
  Loader2,
  RefreshCw,
  ChevronUp,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { normalizeImageFile } from '@/lib/image-normalize';
import { compressImageBlob, imageSourceToBlob } from '@/lib/image-compression';
import { uploadToAzure } from '@/lib/microservices-api';
import { ECOM_MODELS, EDITORIAL_MODELS, type ModelImage } from '@/lib/model-library';
import { useImageValidation, type ImageValidationResult } from '@/hooks/use-image-validation';
import {
  startPhotoshoot,
  getPhotoshootStatus,
  getPhotoshootResult,
  resolveWorkflowState,
  type PhotoshootResultResponse,
} from '@/lib/photoshoot-api';
import { useCreditPreflight } from '@/hooks/use-credit-preflight';
import { CreditPreflightModal } from '@/components/CreditPreflightModal';
import { useCredits } from '@/contexts/CreditsContext';
import { azureUriToUrl } from '@/components/generations/CadWorkflowModal';
import ExampleGuidePanel from '@/components/bulk/ExampleGuidePanel';

// Acceptable example images per category
import necklaceAllowed from '@/assets/examples/necklace-allowed-1.jpg';
import earringAllowed from '@/assets/examples/earring-allowed-1.jpg';
import braceletAllowed from '@/assets/examples/bracelet-allowed-1.jpg';
import ringAllowed from '@/assets/examples/ring-allowed-1.png';
import watchAllowed from '@/assets/examples/watch-allowed-1.jpg';

const ACCEPTABLE_EXAMPLES: Record<string, string> = {
  necklace: necklaceAllowed,
  earring: earringAllowed,
  bracelet: braceletAllowed,
  ring: ringAllowed,
  watch: watchAllowed,
};

const CATEGORY_TYPE_MAP: Record<string, string> = {
  necklace: 'necklace', necklaces: 'necklace',
  earring: 'earrings', earrings: 'earrings',
  ring: 'rings', rings: 'rings',
  bracelet: 'bracelets', bracelets: 'bracelets',
  watch: 'watches', watches: 'watches',
};

const LABEL_NAMES: Record<string, string> = {
  flatlay: 'a flat lay',
  product_surface: 'a product shot',
  '3d_render': 'a 3D render',
  packshot: 'a packshot',
  floating: 'a floating product',
};

type StudioStep = 'upload' | 'model' | 'generating' | 'results';

export default function UnifiedStudio() {
  const { type } = useParams<{ type: string }>();
  const jewelryType = type || 'necklace';
  const { toast } = useToast();
  const { checkCredits, showInsufficientModal, dismissModal, preflightResult, checking: preflightChecking } = useCreditPreflight();
  const { refreshCredits } = useCredits();

  const [currentStep, setCurrentStep] = useState<StudioStep>('upload');
  const step2Ref = useRef<HTMLDivElement>(null);

  // Jewelry image
  const jewelryInputRef = useRef<HTMLInputElement>(null);
  const [jewelryImage, setJewelryImage] = useState<string | null>(null);
  const [jewelryFile, setJewelryFile] = useState<File | null>(null);

  // Model selection
  const [selectedModel, setSelectedModel] = useState<ModelImage | null>(null);
  const [customModelImage, setCustomModelImage] = useState<string | null>(null);
  const [customModelFile, setCustomModelFile] = useState<File | null>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  const activeModelUrl = customModelImage || selectedModel?.url || null;

  // Validation
  const { isValidating, results: validationResults, validateImages, clearValidation } = useImageValidation();
  const [validationResult, setValidationResult] = useState<ImageValidationResult | null>(null);
  const [jewelryUploadedUrl, setJewelryUploadedUrl] = useState<string | null>(null);

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
    setJewelryUploadedUrl(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setJewelryImage(e.target?.result as string);
      setValidationResult(null);
    };
    reader.readAsDataURL(normalized);

    const result = await validateImages([normalized], jewelryType);
    if (result && result.results.length > 0) {
      setValidationResult(result.results[0]);
      if (result.results[0].uploaded_url) {
        setJewelryUploadedUrl(result.results[0].uploaded_url);
      }
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

  // Auto-advance to Step 2 on valid upload
  const handleNextStep = () => {
    setCurrentStep('model');
    setTimeout(() => step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  // ─── Generate ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!jewelryImage || !activeModelUrl) {
      toast({ variant: 'destructive', title: 'Missing inputs', description: 'Upload a jewelry image and select a model.' });
      return;
    }

    const hasCredits = await checkCredits('jewelry_photoshoot');
    if (!hasCredits) return;

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStep('Preparing...');
    setGenerationError(null);
    setCurrentStep('generating');

    try {
      setGenerationProgress(5);
      let jewelryUrl: string;
      if (jewelryUploadedUrl) {
        jewelryUrl = jewelryUploadedUrl;
        setGenerationProgress(20);
      } else {
        setGenerationStep('Uploading jewelry image...');
        const jewelryBlob = await imageSourceToBlob(jewelryImage);
        const { blob: compressedJewelry } = await compressImageBlob(jewelryBlob);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressedJewelry);
        });
        const azResult = await uploadToAzure(base64);
        jewelryUrl = azResult.https_url || azResult.sas_url;
        setGenerationProgress(20);
      }

      setGenerationProgress(20);
      setGenerationStep('Preparing model image...');
      let modelUrl: string;

      if (selectedModel) {
        modelUrl = selectedModel.url;
      } else if (customModelImage && customModelFile) {
        setGenerationStep('Uploading model image...');
        const modelBlob = await imageSourceToBlob(customModelImage);
        const { blob: compressedModel } = await compressImageBlob(modelBlob);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressedModel);
        });
        const azResult = await uploadToAzure(base64);
        modelUrl = azResult.https_url || azResult.sas_url;
      } else {
        throw new Error('No model selected');
      }

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

      setGenerationStep('Generating photoshoot...');
      const pollStart = Date.now();
      const TIMEOUT = 300000;

      while (Date.now() - pollStart < TIMEOUT) {
        await new Promise(r => setTimeout(r, 3000));

        const status = await getPhotoshootStatus(startResponse.workflow_id);
        const state = resolveWorkflowState(status);

        if (status.progress) {
          const total = status.progress.total_nodes || 1;
          const completed = status.progress.completed_nodes || 0;
          const pct = Math.min(35 + Math.round((completed / total) * 60), 95);
          setGenerationProgress(pct);

          const visited = status.progress.visited || [];
          if (visited.length > 0) {
            setGenerationStep(visited[visited.length - 1].replace(/_/g, ' '));
          }
        }

        if (state === 'completed') {
          setGenerationProgress(100);
          setGenerationStep('Complete!');

          const result = await getPhotoshootResult(startResponse.workflow_id);
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

  function extractResultImages(result: PhotoshootResultResponse): string[] {
    const images: string[] = [];
    for (const key of Object.keys(result)) {
      const items = result[key];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;
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
    setJewelryUploadedUrl(null);
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

  const exampleCategoryType = CATEGORY_TYPE_MAP[jewelryType] || 'necklace';
  const isFlagged = validationResult && !validationResult.is_acceptable;
  const acceptableExample = ACCEPTABLE_EXAMPLES[jewelryType] || necklaceAllowed;
  const canProceed = jewelryImage && !isFlagged && !isValidating;

  // ─── Model Grid Component ────────────────────────────────────────

  const ModelGrid = ({ models }: { models: ModelImage[] }) => (
    <div className="grid grid-cols-3 gap-3">
      {models.map((model) => {
        const isSelected = selectedModel?.id === model.id && !customModelImage;
        return (
          <button
            key={model.id}
            onClick={() => handleSelectLibraryModel(model)}
            className={`group relative aspect-[3/4] overflow-hidden border-2 transition-all rounded-sm ${
              isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border/20 hover:border-foreground/30'
            }`}
          >
            <img
              src={model.url}
              alt={model.label}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            {isSelected && (
              <div className="absolute inset-0 bg-primary/15 flex items-center justify-center">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              </div>
            )}
          </button>
        );
      })}
      {/* + Upload Your Own card (shown in each tab) */}
      <button
        onClick={() => modelInputRef.current?.click()}
        className={`group relative aspect-[3/4] overflow-hidden border-2 border-dashed transition-all rounded-sm flex flex-col items-center justify-center gap-2 ${
          customModelImage ? 'border-primary ring-2 ring-primary/20' : 'border-border/30 hover:border-primary/40 hover:bg-primary/[0.02]'
        }`}
      >
        {customModelImage ? (
          <>
            <img
              src={customModelImage}
              alt="Custom model"
              className="w-full h-full object-cover absolute inset-0"
            />
            <div className="absolute inset-0 bg-primary/15 flex items-center justify-center">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            </div>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground/50" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider text-center px-1">
              + Upload Your Own
            </span>
          </>
        )}
      </button>
      <input
        ref={modelInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleModelUpload(f); }}
      />
    </div>
  );

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

        {/* ═══════════════════════════════════════════════════════════
            STEP 1 — UPLOAD YOUR JEWELRY
            ═══════════════════════════════════════════════════════════ */}
        {(currentStep === 'upload' || currentStep === 'model') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-16"
          >
            {/* Step 1 Header */}
            <div className="mb-6">
              <span className="marta-label">Step 1</span>
              <h1 className="font-display text-3xl md:text-4xl uppercase tracking-tight mt-2">
                Upload Your Jewelry
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Upload a photo of your jewelry <strong>worn on a person or mannequin</strong>
              </p>
            </div>

            {/* Layout — Upload LEFT (40%), Example Gallery RIGHT (60%) */}
            <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
              {/* Left — Upload Zone (~40%) */}
              <div className="lg:col-span-5 order-1">
                {!jewelryImage ? (
                  /* Empty state — drop zone (tall rectangular) */
                  <div
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleJewelryUpload(f); }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => jewelryInputRef.current?.click()}
                    className="relative border-2 border-dashed border-border/40 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/[0.02] transition-all flex flex-col items-center justify-center min-h-[520px] md:min-h-[640px] lg:sticky lg:top-8"
                  >
                    <div className="relative mx-auto w-20 h-20 mb-6">
                      <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2.5s' }} />
                      <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                        <Diamond className="h-9 w-9 text-primary" />
                      </div>
                    </div>
                    <p className="text-lg font-display font-medium mb-1.5">Drop your jewelry image here</p>
                    <p className="text-sm text-muted-foreground mb-6">
                      Drag & drop · click to browse · paste (Ctrl+V)
                    </p>
                    <Button variant="outline" size="lg" className="gap-2">
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
                  /* Uploaded state — image preview */
                  <div className="space-y-4">
                    <div className={`relative border overflow-hidden flex items-center justify-center bg-muted/20 min-h-[520px] md:min-h-[640px] ${
                      isFlagged ? 'border-destructive/40' : 'border-border/30'
                    }`}>
                      <img src={jewelryImage} alt="Jewelry" className="max-w-full max-h-[520px] object-contain" />

                      {/* Small remove X inside top-right of image */}
                      <button
                        onClick={() => { setJewelryImage(null); setJewelryFile(null); setValidationResult(null); setJewelryUploadedUrl(null); clearValidation(); if (currentStep === 'model') setCurrentStep('upload'); }}
                        className="absolute top-3 right-3 w-7 h-7 bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border/40 hover:bg-destructive hover:text-destructive-foreground transition-colors z-10 rounded-sm"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

                      {/* Flagged overlay — red X on user's image */}
                      {isFlagged && (
                        <div className="absolute inset-0 bg-destructive/10 flex items-center justify-center pointer-events-none">
                          <div className="w-20 h-20 rounded-full bg-destructive/90 flex items-center justify-center shadow-xl">
                            <X className="h-10 w-10 text-destructive-foreground" />
                          </div>
                        </div>
                      )}

                      {/* Validation badges */}
                      {isValidating && (
                        <div className="absolute top-3 left-3 bg-muted/90 backdrop-blur-sm px-2.5 py-1 flex items-center gap-1.5 rounded-sm">
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">Validating…</span>
                        </div>
                      )}
                      {!isValidating && validationResult && !isFlagged && (
                        <div className="absolute top-3 left-3 backdrop-blur-sm px-2.5 py-1 flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-sm">
                          <Check className="h-3 w-3 text-primary" />
                          <span className="font-mono text-[9px] tracking-wider uppercase text-primary">Accepted</span>
                        </div>
                      )}
                    </div>

                    {/* Flagged comparison panel — user's image vs acceptable example */}
                    {isFlagged && (
                      <div className="border border-destructive/20 bg-destructive/5 p-4 space-y-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-destructive">
                              Image not accepted — detected: {LABEL_NAMES[validationResult!.category] || validationResult!.category}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Please upload jewelry being worn on a model, mannequin, or body part.
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <p className="font-mono text-[9px] tracking-wider text-destructive uppercase">Your image</p>
                            <div className="relative border-2 border-destructive/40 overflow-hidden aspect-square bg-muted/30">
                              <img src={jewelryImage} alt="Flagged" className="w-full h-full object-cover" />
                              <div className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-destructive flex items-center justify-center shadow-lg">
                                <X className="h-4 w-4 text-destructive-foreground" />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-mono text-[9px] tracking-wider text-primary uppercase">Acceptable example</p>
                            <div className="relative border-2 border-primary/40 overflow-hidden aspect-square bg-muted/30">
                              <img src={acceptableExample} alt="Acceptable" className="w-full h-full object-cover" />
                              <div className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                <Check className="h-4 w-4 text-primary-foreground" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Next button — diamond style */}
                    {currentStep === 'upload' && (
                      <div className="flex justify-end pt-2">
                        <Button
                          size="lg"
                          onClick={handleNextStep}
                          disabled={!canProceed}
                          className="gap-2.5 font-display text-base uppercase tracking-wide px-10 bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))] text-background hover:opacity-90 transition-opacity border-0"
                        >
                          <Diamond className="h-4 w-4" />
                          Next
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        {isValidating && (
                          <p className="text-xs text-muted-foreground font-mono tracking-wider self-center ml-4">
                            Validating image…
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right — Example Guide Panel (full height, ~60%) */}
              <div className="lg:col-span-7 order-2">
                <ExampleGuidePanel
                  categoryName={jewelryType.charAt(0).toUpperCase() + jewelryType.slice(1)}
                  categoryType={exampleCategoryType}
                />
              </div>
            </div>

            {/* Mobile example guide */}
            <div className="lg:hidden mt-8">
              <ExampleGuidePanel
                categoryName={jewelryType.charAt(0).toUpperCase() + jewelryType.slice(1)}
                categoryType={exampleCategoryType}
              />
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            STEP 2 — CHOOSE A MODEL (visible only after Next)
            ═══════════════════════════════════════════════════════════ */}
        {currentStep === 'model' && (
          <motion.div
            ref={step2Ref}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {/* Step 2 Header */}
            <div className="mb-6">
              <span className="marta-label">Step 2</span>
              <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tight mt-2">
                Choose a Model
              </h2>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Select from our library or upload your own reference photo
              </p>
            </div>

            {/* 60 / 40 Split */}
            <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
              {/* Left 60% — Model Preview Canvas */}
              <div className="lg:col-span-7 space-y-5">
                <div className="border border-border/30 bg-muted/10 min-h-[420px] md:min-h-[520px] flex items-center justify-center relative overflow-hidden">
                  {activeModelUrl ? (
                    <img
                      src={activeModelUrl}
                      alt="Selected model"
                      className="max-w-full max-h-[520px] object-contain"
                    />
                  ) : (
                    <div className="text-center px-8">
                      <div className="relative mx-auto w-16 h-16 mb-4">
                        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2.5s' }} />
                        <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                          <Diamond className="h-7 w-7 text-primary" />
                        </div>
                      </div>
                      <p className="text-foreground text-sm font-medium mb-1">Choose from our AI model library</p>
                      <p className="text-muted-foreground text-xs">or upload your own reference photo</p>
                    </div>
                  )}
                </div>

                {/* Generate Photoshoot button — diamond accent */}
                <Button
                  size="lg"
                  onClick={handleGenerate}
                  disabled={!jewelryImage || !activeModelUrl || isValidating || preflightChecking}
                  className="w-full font-display text-lg uppercase tracking-wide gap-2.5 bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))] text-background hover:opacity-90 transition-opacity border-0 disabled:opacity-40 disabled:from-muted disabled:to-muted disabled:text-muted-foreground"
                >
                  {preflightChecking ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Diamond className="h-5 w-5" />
                  )}
                  Generate Photoshoot
                </Button>
              </div>

              {/* Right 40% — Model Library with Tabs */}
              <div className="lg:col-span-5">
                <Tabs defaultValue="ecom" className="w-full">
                  <TabsList className="w-full grid grid-cols-2 mb-4 bg-muted/30 h-11">
                    <TabsTrigger value="ecom" className="font-mono text-xs uppercase tracking-[0.15em] data-[state=active]:bg-background">
                      E-Commerce
                    </TabsTrigger>
                    <TabsTrigger value="editorial" className="font-mono text-xs uppercase tracking-[0.15em] data-[state=active]:bg-background">
                      Editorial
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="ecom" className="max-h-[520px] overflow-y-auto pr-1">
                    <ModelGrid models={ECOM_MODELS} />
                  </TabsContent>
                  <TabsContent value="editorial" className="max-h-[520px] overflow-y-auto pr-1">
                    <ModelGrid models={EDITORIAL_MODELS} />
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* Back to Step 1 link */}
            <div className="mt-6">
              <button
                onClick={() => setCurrentStep('upload')}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronUp className="h-3.5 w-3.5" />
                <span className="font-mono text-[10px] tracking-wider uppercase">Back to Step 1</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            GENERATING STEP
            ═══════════════════════════════════════════════════════════ */}
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

            <h2 className="font-display text-3xl uppercase tracking-tight mb-2">Generating</h2>
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

        {/* ═══════════════════════════════════════════════════════════
            RESULTS STEP
            ═══════════════════════════════════════════════════════════ */}
        {currentStep === 'results' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
          >
            <div className="text-center">
              <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-1">Complete</span>
              <h2 className="font-display text-4xl uppercase tracking-tight">Your Results</h2>
            </div>

            {resultImages.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto justify-items-center">
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
