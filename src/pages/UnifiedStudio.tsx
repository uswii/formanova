import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import creditCoinIcon from '@/assets/icons/credit-coin.png';
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
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { azureUriToUrl } from '@/lib/azure-utils';
import ExampleGuidePanel from '@/components/bulk/ExampleGuidePanel';

// Example images for inline Upload Guide
import necklaceAllowed1 from '@/assets/examples/necklace-allowed-1.jpg';
import necklaceAllowed2 from '@/assets/examples/necklace-allowed-2.jpg';
import necklaceAllowed3 from '@/assets/examples/necklace-allowed-3.jpg';
import necklaceNotAllowed1 from '@/assets/examples/necklace-notallowed-1.png';
import necklaceNotAllowed2 from '@/assets/examples/necklace-notallowed-2.png';
import necklaceNotAllowed3 from '@/assets/examples/necklace-notallowed-3.png';
import earringAllowed1 from '@/assets/examples/earring-allowed-1.jpg';
import earringAllowed2 from '@/assets/examples/earring-allowed-2.jpg';
import earringAllowed3 from '@/assets/examples/earring-allowed-3.jpg';
import earringNotAllowed1 from '@/assets/examples/earring-notallowed-1.png';
import earringNotAllowed2 from '@/assets/examples/earring-notallowed-2.png';
import earringNotAllowed3 from '@/assets/examples/earring-notallowed-3.png';
import braceletAllowed1 from '@/assets/examples/bracelet-allowed-1.jpg';
import braceletAllowed2 from '@/assets/examples/bracelet-allowed-2.jpg';
import braceletAllowed3 from '@/assets/examples/bracelet-allowed-3.jpg';
import braceletNotAllowed1 from '@/assets/examples/bracelet-notallowed-1.png';
import braceletNotAllowed2 from '@/assets/examples/bracelet-notallowed-2.png';
import braceletNotAllowed3 from '@/assets/examples/bracelet-notallowed-3.png';
import ringAllowed1 from '@/assets/examples/ring-allowed-1.png';
import ringAllowed2 from '@/assets/examples/ring-allowed-2.png';
import ringAllowed3 from '@/assets/examples/ring-allowed-3.jpg';
import ringNotAllowed1 from '@/assets/examples/ring-notallowed-1.png';
import ringNotAllowed2 from '@/assets/examples/ring-notallowed-2.png';
import ringNotAllowed3 from '@/assets/examples/ring-notallowed-3.png';
import watchAllowed1 from '@/assets/examples/watch-allowed-1.jpg';
import watchAllowed2 from '@/assets/examples/watch-allowed-2.jpg';
import watchAllowed3 from '@/assets/examples/watch-allowed-3.png';
import watchNotAllowed1 from '@/assets/examples/watch-notallowed-1.png';
import watchNotAllowed2 from '@/assets/examples/watch-notallowed-2.png';
import watchNotAllowed3 from '@/assets/examples/watch-notallowed-3.png';

const CATEGORY_EXAMPLES: Record<string, { allowed: string[]; notAllowed: string[] }> = {
  necklace: { allowed: [necklaceAllowed1, necklaceAllowed2, necklaceAllowed3], notAllowed: [necklaceNotAllowed1, necklaceNotAllowed2, necklaceNotAllowed3] },
  earrings: { allowed: [earringAllowed1, earringAllowed2, earringAllowed3], notAllowed: [earringNotAllowed1, earringNotAllowed2, earringNotAllowed3] },
  bracelets: { allowed: [braceletAllowed1, braceletAllowed2, braceletAllowed3], notAllowed: [braceletNotAllowed1, braceletNotAllowed2, braceletNotAllowed3] },
  rings: { allowed: [ringAllowed1, ringAllowed2, ringAllowed3], notAllowed: [ringNotAllowed1, ringNotAllowed2, ringNotAllowed3] },
  watches: { allowed: [watchAllowed1, watchAllowed2, watchAllowed3], notAllowed: [watchNotAllowed1, watchNotAllowed2, watchNotAllowed3] },
};

const ACCEPTABLE_EXAMPLES: Record<string, string> = {
  necklace: necklaceAllowed3, necklaces: necklaceAllowed3,
  earring: earringAllowed3,  earrings: earringAllowed3,
  bracelet: braceletAllowed3, bracelets: braceletAllowed3,
  ring: ringAllowed3,        rings: ringAllowed3,
  watch: watchAllowed3,      watches: watchAllowed3,
};

const CATEGORY_TYPE_MAP: Record<string, string> = {
  necklace: 'necklace', necklaces: 'necklace',
  earring: 'earrings', earrings: 'earrings',
  ring: 'rings', rings: 'rings',
  bracelet: 'bracelets', bracelets: 'bracelets',
  watch: 'watches', watches: 'watches',
};

// Normalise URL param (plural or singular) → singular for the API payload
const TO_SINGULAR: Record<string, string> = {
  necklace: 'necklace', necklaces: 'necklace',
  earring: 'earring',  earrings: 'earring',
  ring: 'ring',        rings: 'ring',
  bracelet: 'bracelet', bracelets: 'bracelet',
  watch: 'watch',      watches: 'watch',
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
  const [showFlaggedDialog, setShowFlaggedDialog] = useState(false);
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

  // Paste handler — supports jewelry upload (step 1) AND model upload (step 2 empty state)
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) break;
          if (currentStep === 'model' && !activeModelUrl) {
            handleModelUpload(file);
          } else if (!jewelryImage) {
            handleJewelryUpload(file);
          }
          break;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [jewelryImage, handleJewelryUpload, handleModelUpload, currentStep, activeModelUrl]);

  // Auto-advance to Step 2 on valid upload
  const handleNextStep = () => {
    if (isFlagged) {
      setShowFlaggedDialog(true);
      return;
    }
    setCurrentStep('model');
  };

  const handleContinueAnyway = () => {
    setShowFlaggedDialog(false);
    setCurrentStep('model');
  };

  // ─── Generate ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (isGenerating) return; // Prevent duplicate submit
    if (!jewelryImage || !activeModelUrl) {
      toast({ variant: 'destructive', title: 'Missing inputs', description: 'Upload a jewelry image and select a model.' });
      return;
    }

    const hasCredits = await checkCredits('jewelry_photoshoots_generator');
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
        // jewelryUploadedUrl is azure:// from validation — convert to HTTPS
        jewelryUrl = jewelryUploadedUrl.startsWith('azure://')
          ? `https://snapwear.blob.core.windows.net/${jewelryUploadedUrl.replace('azure://', '')}`
          : jewelryUploadedUrl;
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
        // Preset models already have HTTPS URLs — use directly
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

      if (!jewelryUrl || !modelUrl) {
        toast({ variant: 'destructive', title: 'Missing images', description: 'Please select both a jewelry image and a model before generating.' });
        setIsGenerating(false);
        setCurrentStep('model');
        return;
      }

      const idempotencyKey = `${Date.now()}-${jewelryType}-${selectedModel?.id || 'custom'}`;
      const photoshootPayload = {
        jewelry_image_url: jewelryUrl,
        model_image_url: modelUrl,
        category: TO_SINGULAR[jewelryType] ?? jewelryType,
        idempotency_key: idempotencyKey,
      };
      const startResponse = await startPhotoshoot(photoshootPayload);

      setWorkflowId(startResponse.workflow_id);

      setGenerationStep('Generating photoshoot...');
      const pollStart = Date.now();
      const TIMEOUT = 720000; // 12 minutes (Sonnet-safe)

      // Decelerating ticker — starts fast (~2%/tick at 35%), slows near 90%.
      // Keeps bar visibly moving even when API returns no progress data yet.
      const ticker = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) return prev;
          return Math.min(prev + Math.max((90 - prev) * 0.04, 0.1), 90);
        });
      }, 300);

      try {
        while (Date.now() - pollStart < TIMEOUT) {
          await new Promise(r => setTimeout(r, 3000));

          const status = await getPhotoshootStatus(startResponse.workflow_id);
          const state = resolveWorkflowState(status);

          if (status.progress) {
            const total = status.progress.total_nodes || 1;
            const completed = status.progress.completed_nodes || 0;
            const realPct = Math.min(35 + Math.round((completed / total) * 60), 95);
            setGenerationProgress(prev => Math.max(prev, realPct));

            const visited = status.progress.visited || [];
            if (visited.length > 0) {
              setGenerationStep(visited[visited.length - 1].replace(/_/g, ' '));
            }
          }

          if (state === 'completed') {
            clearInterval(ticker);
            // Hold at 95% while we fetch the result — only jump to 100% once we have it
            setGenerationProgress(95);
            setGenerationStep('Fetching results...');

            const result = await getPhotoshootResult(startResponse.workflow_id);
            const images = extractResultImages(result);
            setResultImages(images);
            setGenerationProgress(100);
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
      } finally {
        clearInterval(ticker);
      }
    } catch (error) {
      setGenerationError('unavailable');
      setIsGenerating(false);
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
  const acceptableExample = ACCEPTABLE_EXAMPLES[jewelryType] || necklaceAllowed3;
  const canProceed = jewelryImage && !isValidating;

  // ─── Model Grid Component ────────────────────────────────────────

  const ModelGrid = ({ models }: { models: ModelImage[] }) => (
    <div className="grid grid-cols-3 gap-3">
      {/* + Upload Your Own card — first position */}
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
    <div className="h-screen bg-background relative overflow-hidden flex flex-col">
      {showInsufficientModal && preflightResult && (
        <CreditPreflightModal
          open={showInsufficientModal}
          onOpenChange={(open) => !open && dismissModal()}
          estimatedCredits={preflightResult.estimatedCredits}
          currentBalance={preflightResult.currentBalance}
        />
      )}

      {/* ── Step Progress Bar ── */}
      {currentStep !== 'generating' && (
        <div className="flex-shrink-0 px-4 md:px-6 pt-6 pb-4 relative z-10">
          <div className="flex items-center justify-center gap-0">
            {[
              { step: 1, label: 'Upload', id: 'upload' as const },
              { step: 2, label: 'Choose Model', id: 'model' as const },
              { step: 3, label: 'Results', id: 'results' as const },
            ].map((s, index, arr) => {
              const stepOrder = { upload: 0, model: 1, generating: 2, results: 2 };
              const current = stepOrder[currentStep];
              const isDone = s.step - 1 < current;
              const isActive = (s.id === 'results' && ((currentStep as string) === 'generating' || currentStep === 'results')) || currentStep === s.id;
              return (
                <div key={s.id} className="flex items-center">
                  <button
                    onClick={() => {
                      if (s.id === 'upload' && (currentStep as string) !== 'generating') setCurrentStep('upload');
                      else if (s.id === 'model' && !!jewelryImage && (currentStep as string) !== 'generating') setCurrentStep('model');
                    }}
                    className={`flex items-center gap-2 px-4 py-2 transition-all ${
                      isActive
                        ? 'text-foreground'
                        : isDone
                        ? 'text-muted-foreground hover:text-foreground cursor-pointer'
                        : 'text-muted-foreground/40 cursor-default'
                    }`}
                  >
                    <div className={`w-6 h-6 flex items-center justify-center text-[11px] font-mono font-bold border transition-all ${
                      isActive
                        ? 'bg-foreground text-background border-foreground'
                        : isDone
                        ? 'border-foreground/40 text-foreground/60'
                        : 'border-border/30 text-muted-foreground/40'
                    }`}>
                      {s.step}
                    </div>
                    <span className="font-mono text-[11px] tracking-[0.15em] uppercase hidden sm:inline">
                      {s.label}
                    </span>
                  </button>
                  {index < arr.length - 1 && (
                    <div className={`w-12 h-px mx-1 transition-colors ${isDone || isActive ? 'bg-foreground/30' : 'bg-border/30'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 md:px-4 pb-8 relative z-10">

        {/* ═══════════════════════════════════════════════════════════
            STEP 1 — UPLOAD YOUR JEWELRY
            ═══════════════════════════════════════════════════════════ */}
        {currentStep === 'upload' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
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

            {/* Layout — Upload LEFT (2/3), Guide Sidebar RIGHT (1/3) — mirrors old StepUploadMark */}
            <div className="grid lg:grid-cols-3 gap-8 lg:gap-10">
              {/* ── Main Column: Upload Zone (2/3) ── */}
              <div className="lg:col-span-2">
                {!jewelryImage ? (
                  /* Empty state — drop zone */
                  <div
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleJewelryUpload(f); }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => jewelryInputRef.current?.click()}
                    className="relative border border-dashed border-border/40 text-center cursor-pointer hover:border-foreground/40 hover:bg-foreground/5 transition-all flex flex-col items-center justify-center min-h-[500px] md:min-h-[640px]"
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
                    <div className="relative border overflow-hidden flex items-center justify-center bg-muted/20 min-h-[500px] md:min-h-[640px] border-border/30">
                      <img src={jewelryImage} alt="Jewelry" className="max-w-full max-h-[520px] object-contain" />

                      <button
                        onClick={() => { setJewelryImage(null); setJewelryFile(null); setValidationResult(null); setJewelryUploadedUrl(null); clearValidation(); if ((currentStep as string) === 'model') setCurrentStep('upload'); }}
                        className="absolute top-3 right-3 w-7 h-7 bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border/40 hover:bg-destructive hover:text-destructive-foreground transition-colors z-10 rounded-sm"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

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

                  </div>
                )}

                {/* Next button — inline below upload canvas */}
                {jewelryImage && (
                  <div className="flex items-center justify-end gap-3 pt-4">
                    {isValidating && (
                      <span className="text-xs text-muted-foreground font-mono tracking-wider">Validating…</span>
                    )}
                    <Button
                      size="lg"
                      onClick={handleNextStep}
                      disabled={!canProceed}
                      className="gap-2.5 font-display text-base uppercase tracking-wide px-10 bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))] text-background hover:opacity-90 transition-opacity border-0"
                    >
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* ── Sidebar: Upload Guide (1/3) — mirrors old Examples sidebar ── */}
              <div className="space-y-7">
                {/* Guide heading — matches old "Gallery" marta-label style */}
                <div>
                  <span className="marta-label mb-2 block">Guide</span>
                  <h3 className="font-display text-2xl uppercase tracking-tight">Upload Guide</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Follow these guidelines for best results.
                  </p>
                </div>

                {/* Accepted examples */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-green-500" />
                    </div>
                    <span className="text-xs font-medium text-foreground">Accepted</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(CATEGORY_EXAMPLES[exampleCategoryType]?.allowed || []).map((img, i) => (
                      <div key={`ok-${i}`} className="relative aspect-[3/4] overflow-hidden border border-green-500/30 bg-muted/20">
                        <img src={img} alt={`Accepted ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Not accepted examples */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                      <X className="w-2.5 h-2.5 text-destructive" />
                    </div>
                    <span className="text-xs font-medium text-foreground">Not Accepted</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(CATEGORY_EXAMPLES[exampleCategoryType]?.notAllowed || []).map((img, i) => (
                      <div key={`no-${i}`} className="relative aspect-[3/4] overflow-hidden border border-destructive/30 bg-muted/20">
                        <img src={img} alt={`Not accepted ${i + 1}`} className="w-full h-full object-cover opacity-70" />
                        <div className="absolute bottom-1 right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                          <X className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ Flagged Image Dialog ═══ */}
        <Dialog open={showFlaggedDialog} onOpenChange={setShowFlaggedDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader className="space-y-3">
              <DialogTitle className="flex items-center gap-3 text-destructive text-lg">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>Image May Not Be Suitable</span>
              </DialogTitle>
              <DialogDescription>
                We detected this image as <strong>{LABEL_NAMES[validationResult?.category || ''] || validationResult?.category}</strong>.
                For best results, upload jewelry <strong>worn on a person or mannequin</strong>. Results with this image may not be accurate.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 my-2">
              {/* User's flagged image */}
              <div className="space-y-2">
                <p className="font-mono text-[9px] tracking-wider text-destructive uppercase">Your image</p>
                <div className="relative border-2 border-destructive/40 overflow-hidden aspect-[3/4] bg-muted/30 rounded-sm">
                  {jewelryImage && <img src={jewelryImage} alt="Flagged" className="w-full h-full object-cover" />}
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive flex items-center justify-center shadow-lg">
                    <X className="h-4 w-4 text-destructive-foreground" />
                  </div>
                </div>
              </div>
              {/* Acceptable example */}
              <div className="space-y-2">
                <p className="font-mono text-[9px] tracking-wider text-primary uppercase">Acceptable format</p>
                <div className="relative border-2 border-primary/40 overflow-hidden aspect-[3/4] bg-muted/30 rounded-sm">
                  <img src={acceptableExample} alt="Acceptable" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => { setShowFlaggedDialog(false); setJewelryImage(null); setJewelryFile(null); setValidationResult(null); setJewelryUploadedUrl(null); clearValidation(); }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Go Back & Re-upload
              </Button>
              <Button
                variant="ghost"
                onClick={handleContinueAnyway}
                className="text-muted-foreground"
              >
                Continue Anyway
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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

            {/* 2/3 + 1/3 split — mirrors old StepUploadMark layout */}
            <div className="grid lg:grid-cols-3 gap-8 lg:gap-10">
              {/* Left 2/3 — Model Preview Canvas */}
              <div className="lg:col-span-2 space-y-5">
                <div className="border border-border/30 bg-muted/10 min-h-[420px] md:min-h-[520px] flex items-center justify-center relative overflow-hidden">
                  {activeModelUrl ? (
                    <>
                      <img
                        src={activeModelUrl}
                        alt="Selected model"
                        className="max-w-full max-h-[520px] object-contain"
                      />
                      <button
                        onClick={() => { setSelectedModel(null); setCustomModelImage(null); setCustomModelFile(null); }}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors z-10"
                        aria-label="Remove selected model"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <div
                      className="text-center px-8 cursor-pointer w-full h-full min-h-[420px] md:min-h-[520px] flex flex-col items-center justify-center hover:bg-foreground/5 transition-colors"
                      onClick={() => modelInputRef.current?.click()}
                      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleModelUpload(f); }}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <div className="relative mx-auto w-16 h-16 mb-4">
                        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2.5s' }} />
                        <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                          <Diamond className="h-7 w-7 text-primary" />
                        </div>
                      </div>
                      <p className="text-foreground text-sm font-medium mb-1">Choose from our AI model library</p>
                      <p className="text-muted-foreground text-xs mb-4">or upload your own reference photo</p>
                      <p className="text-muted-foreground/50 text-[10px] font-mono uppercase tracking-wider">
                        Drop · Click · Paste (Ctrl+V)
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions row — Back left, Generate right */}
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep('upload')}
                    className="gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleGenerate}
                    disabled={!jewelryImage || !activeModelUrl || isValidating || preflightChecking}
                    className="gap-2.5 font-display text-lg uppercase tracking-wide bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))] text-background hover:opacity-90 transition-opacity border-0 disabled:opacity-40 disabled:from-muted disabled:to-muted disabled:text-muted-foreground"
                  >
                    {preflightChecking ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <span className="flex items-center gap-1 opacity-70 text-sm font-mono normal-case tracking-normal">
                        <img src={creditCoinIcon} alt="" className="h-4 w-4 object-contain" />
                        ≤ 10
                      </span>
                    )}
                    Generate Photoshoot
                  </Button>
                </div>
              </div>

              {/* Right 1/3 — Model Library Sidebar */}
              <div className="space-y-4">
                <div>
                  <span className="marta-label mb-2 block">Library</span>
                  <h3 className="font-display text-2xl uppercase tracking-tight">Choose Model</h3>
                </div>
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

          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            GENERATING STEP
            ═══════════════════════════════════════════════════════════ */}
        {currentStep === 'generating' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center min-h-[70vh]"
          >
            {/* Dashed frame — centered on screen */}
            <div className="border border-dashed border-border/40 px-16 py-14 flex flex-col items-center w-full max-w-md">
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Gem className="absolute inset-0 m-auto h-10 w-10 text-primary" />
              </div>

              <h2 className="font-display text-3xl uppercase tracking-tight mb-3">Generating</h2>

              {/* Real status message — fades when it changes */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={generationStep}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase mb-6 text-center"
                >
                  {generationStep || 'Starting…'}
                </motion.p>
              </AnimatePresence>

              <div className="w-full h-1.5 bg-muted overflow-hidden mb-2">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${generationProgress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <p className="font-mono text-[10px] text-muted-foreground mb-8">{Math.round(generationProgress)}%</p>

              <div className="flex gap-4">
                {jewelryImage && (
                  <div className="w-16 h-16 border border-border/30 overflow-hidden">
                    <img src={jewelryImage} alt="Jewelry" className="w-full h-full object-cover opacity-50" />
                  </div>
                )}
                {activeModelUrl && (
                  <div className="w-16 h-16 border border-border/30 overflow-hidden">
                    <img src={activeModelUrl} alt="Model" className="w-full h-full object-cover opacity-50" />
                  </div>
                )}
              </div>

              {generationError && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="bg-card border border-border shadow-2xl max-w-md w-full mx-6 p-8 text-center"
                    >
                      <div className="mx-auto w-12 h-12 border border-border flex items-center justify-center mb-5">
                        <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h3 className="font-display text-lg uppercase tracking-[0.15em] text-foreground mb-3">
                        Generation Unavailable
                      </h3>
                      <p className="font-mono text-[11px] leading-relaxed tracking-wide text-muted-foreground mb-6">
                        We're sorry — our AI servers are currently experiencing technical difficulties.
                        Please try again in a few hours. If the issue persists, reach out to us at{' '}
                        <a
                          href="mailto:studio@formanova.ai"
                          className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                        >
                          studio@formanova.ai
                        </a>
                      </p>
                      <Button
                        onClick={handleStartOver}
                        className="w-full font-mono text-[11px] tracking-[0.2em] uppercase"
                      >
                        Got It
                      </Button>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
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
              <h2 className="font-display text-4xl uppercase tracking-tight">Your Result{resultImages.length !== 1 ? 's' : ''}</h2>
            </div>

            {resultImages.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-4 max-w-5xl mx-auto">
                {resultImages.map((url, i) => (
                  <div key={i} className="relative group border border-border/30 overflow-hidden w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.75rem)] max-w-xs">
                    <img
                      src={url}
                      alt={`Result ${i + 1}`}
                      className="w-full aspect-[3/4] object-contain bg-muted/30"
                    />
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-background/80 backdrop-blur-sm border-border/40 hover:bg-background"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const isAzure = url.includes('blob.core.windows.net');
                            let blob: Blob;
                            if (isAzure) {
                              const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blob-proxy`;
                              const resp = await fetch(proxyUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ url }),
                              });
                              if (!resp.ok) throw new Error('Proxy fetch failed');
                              blob = await resp.blob();
                            } else {
                              const resp = await fetch(url);
                              if (!resp.ok) throw new Error('Fetch failed');
                              blob = await resp.blob();
                            }
                            const blobUrl = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = blobUrl;
                            a.download = `photoshoot-${workflowId?.slice(0, 8)}-${i + 1}.jpg`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(blobUrl);
                          } catch { alert('Download failed. Please try again.'); }
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-background/80 backdrop-blur-sm border-border/40 hover:bg-background"
                        onClick={(e) => { e.stopPropagation(); window.open(url, '_blank', 'noopener,noreferrer'); }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground">No result images found. The workflow may still be processing.</p>
              </div>
            )}

            {/* Action buttons directly under results */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button variant="outline" size="lg" onClick={handleStartOver} className="gap-2 font-mono text-[10px] uppercase tracking-wider px-8 h-11">
                <Diamond className="h-4 w-4" />
                New Photoshoot
              </Button>
              <Button
                size="lg"
                onClick={() => { setResultImages([]); setCurrentStep('generating'); handleGenerate(); }}
                className="gap-2.5 font-display text-base uppercase tracking-wide px-10 h-11 bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))] text-background hover:opacity-90 transition-opacity border-0"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
                <span className="flex items-center gap-1 opacity-70 text-sm font-mono normal-case tracking-normal ml-1">
                  <img src={creditCoinIcon} alt="" className="h-4 w-4 object-contain" />
                  ≤ 10
                </span>
              </Button>
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
