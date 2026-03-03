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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

// Category type mapping for ExampleGuidePanel
const CATEGORY_TYPE_MAP: Record<string, string> = {
  necklace: 'necklace', necklaces: 'necklace',
  earring: 'earrings', earrings: 'earrings',
  ring: 'rings', rings: 'rings',
  bracelet: 'bracelets', bracelets: 'bracelets',
  watch: 'watches', watches: 'watches',
};

// Label → friendly name
const LABEL_NAMES: Record<string, string> = {
  flatlay: 'a flat lay',
  product_surface: 'a product shot',
  '3d_render': 'a 3D render',
  packshot: 'a packshot',
  floating: 'a floating product',
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

    // Run validation in background — uploads to Azure & classifies; caches URL
    const result = await validateImages([normalized], jewelryType);
    if (result && result.results.length > 0) {
      setValidationResult(result.results[0]);
      if (result.results[0].uploaded_url) {
        setJewelryUploadedUrl(result.results[0].uploaded_url);
        console.log('[UnifiedStudio] Jewelry URL from validation:', result.results[0].uploaded_url);
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
    setGenerationStep('Preparing...');
    setGenerationError(null);
    setCurrentStep('generating');

    try {
      // 1. Get jewelry URL — reuse from validation (already uploaded)
      setGenerationProgress(5);
      let jewelryUrl: string;
      if (jewelryUploadedUrl) {
        jewelryUrl = jewelryUploadedUrl;
        console.log('[UnifiedStudio] Reusing jewelry URL from validation:', jewelryUrl);
        setGenerationProgress(20);
      } else {
        // Fallback: upload via azure-upload
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
        console.log('[UnifiedStudio] Jewelry uploaded (fallback):', jewelryUrl);
        setGenerationProgress(20);
      }

      // 2. Get model URL
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
      const TIMEOUT = 300000;

      while (Date.now() - pollStart < TIMEOUT) {
        await new Promise(r => setTimeout(r, 3000));

        const status = await getPhotoshootStatus(startResponse.workflow_id);
        const state = resolveWorkflowState(status);

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
            className="space-y-10"
          >
            {/* ── Row 1: Upload + Example Guide ────────────────────── */}
            <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
              {/* Left 2/3: Upload Zone */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <div className="flex items-center gap-4 mb-3">
                    <span className="marta-label">Step 1</span>
                  </div>
                  <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tight">Upload Your Jewelry</h2>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Upload a photo of your jewelry <strong>worn on a person</strong>
                  </p>
                </div>

                {!jewelryImage ? (
                  <div
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleJewelryUpload(f); }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => jewelryInputRef.current?.click()}
                    className="relative border border-dashed border-border/40 text-center cursor-pointer hover:border-foreground/40 hover:bg-foreground/5 transition-all p-12 flex flex-col items-center justify-center"
                  >
                    {/* Striking diamond with ping */}
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
                      ref={jewelryInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleJewelryUpload(f); }}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Image with validation overlay */}
                    <div className="relative group">
                      <div className={`border overflow-hidden flex items-center justify-center bg-muted/30 max-h-[400px] ${
                        isFlagged ? 'border-destructive/40' : 'border-border/30'
                      }`}>
                        <img src={jewelryImage} alt="Jewelry" className="max-w-full max-h-[400px] object-contain" />

                        {/* Red X overlay when flagged */}
                        {isFlagged && (
                          <div className="absolute inset-0 bg-destructive/10 flex items-center justify-center pointer-events-none">
                            <div className="w-16 h-16 rounded-full bg-destructive/90 flex items-center justify-center">
                              <X className="h-8 w-8 text-destructive-foreground" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => { setJewelryImage(null); setJewelryFile(null); setValidationResult(null); setJewelryUploadedUrl(null); clearValidation(); }}
                        className="absolute top-2 right-2 w-7 h-7 bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border/40 hover:bg-destructive hover:text-destructive-foreground transition-colors z-10"
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
                      {!isValidating && validationResult && !isFlagged && (
                        <div className="absolute top-2 left-2 backdrop-blur-sm px-2 py-1 flex items-center gap-1.5 bg-primary/10 border border-primary/20">
                          <Check className="h-3 w-3 text-primary" />
                          <span className="font-mono text-[9px] tracking-wider uppercase text-primary">
                            Accepted
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Flagged: side-by-side comparison panel */}
                    {isFlagged && (
                      <div className="border border-destructive/20 bg-destructive/5 p-4 space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                            <X className="h-4 w-4" />
                            Image not accepted — detected: {LABEL_NAMES[validationResult!.category] || validationResult!.category}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Please upload jewelry being worn on a model, mannequin, or body part. You can still proceed, but results may be suboptimal.
                          </p>
                        </div>

                        {/* Side-by-side: user's flagged vs acceptable */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <p className="font-mono text-[9px] tracking-wider text-destructive uppercase">Your image</p>
                            <div className="relative border-2 border-destructive/40 overflow-hidden aspect-square bg-muted/30">
                              <img src={jewelryImage} alt="Flagged" className="w-full h-full object-cover" />
                              <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
                                <X className="h-3.5 w-3.5 text-destructive-foreground" />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-mono text-[9px] tracking-wider text-primary uppercase">Acceptable example</p>
                            <div className="relative border-2 border-primary/40 overflow-hidden aspect-square bg-muted/30">
                              <img src={acceptableExample} alt="Acceptable" className="w-full h-full object-cover" />
                              <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                <Check className="h-3.5 w-3.5 text-primary-foreground" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right 1/3: Example Guide */}
              <div className="hidden lg:block">
                <ExampleGuidePanel
                  categoryName={jewelryType.charAt(0).toUpperCase() + jewelryType.slice(1)}
                  categoryType={exampleCategoryType}
                />
              </div>
            </div>

            {/* ── Row 2: Model Selection ───────────────────────────── */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-4 mb-3">
                  <span className="marta-label">Step 2</span>
                </div>
                <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tight">Choose a Model</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Select from our AI model library or upload your own reference photo
                </p>
              </div>

              {/* Selected model preview */}
              {activeModelUrl && (
                <div className="relative inline-block group">
                  <div className="border-2 border-primary/40 overflow-hidden flex items-center justify-center bg-muted/30 w-48 h-64">
                    <img src={activeModelUrl} alt="Selected model" className="w-full h-full object-cover" />
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

              {/* Upload own + Library tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => modelInputRef.current?.click()}
                  className="border border-dashed border-border/40 hover:border-foreground/40 hover:bg-foreground/5 transition-all px-4 py-2.5 flex items-center gap-2"
                >
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Upload Your Own</span>
                </button>
                <input
                  ref={modelInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleModelUpload(f); }}
                />

                <div className="w-px h-6 bg-border/40 mx-1" />

                <button
                  onClick={() => setModelTab('ecom')}
                  className={`px-4 py-2 font-mono text-[10px] tracking-[0.2em] uppercase transition-all ${
                    modelTab === 'ecom' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  E-Commerce
                </button>
                <button
                  onClick={() => setModelTab('editorial')}
                  className={`px-4 py-2 font-mono text-[10px] tracking-[0.2em] uppercase transition-all ${
                    modelTab === 'editorial' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Editorial
                </button>
              </div>

              {/* Model grid */}
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {(modelTab === 'ecom' ? ECOM_MODELS : EDITORIAL_MODELS).map((model) => {
                  const isSelected = selectedModel?.id === model.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleSelectLibraryModel(model)}
                      className={`group relative aspect-[3/4] overflow-hidden border-2 transition-all ${
                        isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border/30 hover:border-foreground/30'
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
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/80 to-transparent p-1">
                        <span className="font-mono text-[7px] tracking-wider text-foreground/80 uppercase">
                          {model.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Generate */}
              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={!jewelryImage || !activeModelUrl || preflightChecking}
                className="w-full sm:w-auto font-display text-lg uppercase tracking-wide gap-2 px-12"
              >
                {preflightChecking ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
                Generate Photoshoot
              </Button>
            </div>

            {/* Mobile example guide */}
            <div className="lg:hidden">
              <ExampleGuidePanel
                categoryName={jewelryType.charAt(0).toUpperCase() + jewelryType.slice(1)}
                categoryType={exampleCategoryType}
              />
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
