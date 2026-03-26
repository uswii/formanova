import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { markGenerationStarted, markGenerationCompleted, markGenerationFailed } from '@/lib/generation-lifecycle';
import { useParams, useLocation, useSearchParams } from 'react-router-dom';
import creditCoinIcon from '@/assets/icons/credit-coin.png';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Diamond,
  Image as ImageIcon,
  X,
  Upload,
  Check,
  Gem,
  Download,
  Loader2,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  ExternalLink,
  Search,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MasonryGrid } from '@/components/ui/masonry-grid';
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
import { ECOM_MODELS, EDITORIAL_MODELS, ALL_MODELS, type ModelImage } from '@/lib/model-library';
import { fetchUserAssets, updateAssetMetadata, type UserAsset } from '@/lib/assets-api';
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
import { useAuth } from '@/contexts/AuthContext';
import { azureUriToUrl } from '@/lib/azure-utils';
import { isAltUploadLayoutEnabled } from '@/lib/feature-flags';
import { TO_SINGULAR } from '@/lib/jewelry-utils';
import { AlternateUploadStep } from '@/components/studio/AlternateUploadStep';
import {
  trackJewelryUploaded,
  trackValidationFlagged,
  trackModelSelected,
  trackPaywallHit,
  trackGenerationComplete,
  trackDownloadClicked,
  trackRegenerateClicked,
  consumeFirstGeneration,
} from '@/lib/posthog-events';
// ExampleGuidePanel removed — guide is inline

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


const LABEL_NAMES: Record<string, string> = {
  flatlay: 'a flat lay',
  product_surface: 'a product shot',
  '3d_render': 'a 3D render',
  packshot: 'a packshot',
  floating: 'a floating product',
};

const MY_MODELS_STORAGE_KEY = 'formanova_my_models';
const MY_MODELS_VERSION = 2; // bump to invalidate stale cache

// ─── Studio session persistence (survives reloads, cleared on reset) ──────────
const STUDIO_SESSION_KEY = 'formanova_studio_session_v1';

interface StudioSession {
  jewelryUploadedUrl: string;
  jewelryAssetId: string | null;
  validationResult: ImageValidationResult | null;
  selectedModelId: string | null;
  customModelImage: string | null;
  modelAssetId: string | null;
}

function loadStudioSession(): StudioSession | null {
  try {
    const raw = sessionStorage.getItem(STUDIO_SESSION_KEY);
    return raw ? (JSON.parse(raw) as StudioSession) : null;
  } catch { return null; }
}

function saveStudioSession(patch: Partial<StudioSession>) {
  try {
    const existing = loadStudioSession() ?? {} as StudioSession;
    sessionStorage.setItem(STUDIO_SESSION_KEY, JSON.stringify({ ...existing, ...patch }));
  } catch { /* quota exceeded — silently ignore */ }
}

function clearStudioSession() {
  sessionStorage.removeItem(STUDIO_SESSION_KEY);
}

interface UserModel { id: string; name: string; url: string; uploadedAt: number; }

function ModelCard({ model, isActive, onSelect, onDelete, onRename }: {
  model: UserModel;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [nameInput, setNameInput] = React.useState(model.name);
  const [saved, setSaved] = React.useState(false);

  const commit = () => {
    setEditing(false);
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== model.name) {
      onRename(trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } else {
      setNameInput(model.name);
    }
  };

  const cancel = () => {
    setEditing(false);
    setNameInput(model.name);
  };

  return (
    <div className="relative group flex flex-col">
      {/* ── Image area ── */}
      <button
        onClick={onSelect}
        className={`relative overflow-hidden border transition-all w-full ${isActive ? 'border-foreground' : 'border-border/20 hover:border-foreground/30'}`}
      >
        <img src={model.url} alt={model.name} className="w-full block" loading="lazy" />
        {isActive && (
          <div className="absolute inset-0 bg-foreground/10 flex items-center justify-center">
            <div className="w-6 h-6 bg-foreground flex items-center justify-center">
              <Check className="h-3.5 w-3.5 text-background" />
            </div>
          </div>
        )}
      </button>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 bg-background/80 flex items-center justify-center z-10"
        aria-label="Delete model"
      >
        <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
      </button>

      {/* ── Naming row — fixed height for grid alignment ── */}
      <div className="h-10 sm:h-11 flex items-center px-2 overflow-hidden">
        {editing ? (
          <div className="flex items-center gap-1.5 w-full" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              className="font-mono text-[11px] text-foreground bg-muted/30 border border-foreground/20 focus:border-formanova-glow rounded px-2 py-1 outline-none flex-1 min-w-0 transition-colors"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
              placeholder="Enter a name…"
            />
            <button
              onClick={cancel}
              className="flex-shrink-0 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              aria-label="Cancel"
            >
              <X className="h-3 w-3" />
            </button>
            <button
              onClick={commit}
              className="flex-shrink-0 p-1.5 rounded text-foreground hover:bg-muted/30 transition-colors"
              aria-label="Save"
            >
              <Check className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            className="flex items-center justify-center gap-2 sm:gap-2.5 w-full h-full rounded hover:bg-muted/20 transition-colors group/rename"
            title="Click to rename"
            onClick={e => { e.stopPropagation(); setEditing(true); setNameInput(model.name); }}
          >
            {saved ? (
              <>
                <Check className="h-3 w-3 text-formanova-success flex-shrink-0" />
                <span className="font-mono text-[11px] text-formanova-success truncate">Saved!</span>
              </>
            ) : (
              <>
                <span className="font-mono text-[11px] truncate text-muted-foreground group-hover/rename:text-foreground transition-colors">
                  {model.name || <span className="italic opacity-60">Click to edit</span>}
                </span>
                <Pencil className="h-3 w-3 flex-shrink-0 text-muted-foreground/40 group-hover/rename:text-foreground/60 transition-colors" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function loadMyModels(): UserModel[] {
  try {
    const raw = localStorage.getItem(MY_MODELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed._v !== MY_MODELS_VERSION) { localStorage.removeItem(MY_MODELS_STORAGE_KEY); return []; }
    return Array.isArray(parsed.models) ? parsed.models : [];
  } catch { return []; }
}

function saveMyModels(models: UserModel[]) {
  localStorage.setItem(MY_MODELS_STORAGE_KEY, JSON.stringify({ _v: MY_MODELS_VERSION, models }));
}

type StudioStep = 'upload' | 'model' | 'generating' | 'results';

function getStepFromQuery(stepParam: string | null): StudioStep {
  return stepParam === 'model' ? 'model' : 'upload';
}

export default function UnifiedStudio() {
  const { type } = useParams<{ type: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const jewelryType = type || 'necklace';
  const { toast } = useToast();
  const { checkCredits, showInsufficientModal, dismissModal, preflightResult, checking: preflightChecking } = useCreditPreflight();
  const { refreshCredits } = useCredits();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState<StudioStep>(() => getStepFromQuery(searchParams.get('step')));
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

  // My Models — backend-fetched + optimistic local additions for instant feedback
  const [myModels, setMyModels] = useState<UserModel[]>([]);
  const [localPendingModels, setLocalPendingModels] = useState<UserModel[]>(loadMyModels);
  const [myModelsLoading, setMyModelsLoading] = useState(true);
  const [myModelsSearch, setMyModelsSearch] = useState('');
  const [formanovaCategory, setFormanovaCategory] = useState<'ecom' | 'editorial'>('ecom');

  // Fetch user-uploaded models from backend API
  const fetchMyModels = useCallback(async () => {
    try {
      setMyModelsLoading(true);
      const data = await fetchUserAssets('model_photo', 0, 100);
      const backendModels: UserModel[] = data.items.map((a: UserAsset) => ({
        id: a.id,
        name: a.metadata?.name || a.name || '',
        url: a.thumbnail_url,
        uploadedAt: new Date(a.created_at).getTime(),
      }));
      setMyModels(backendModels);
      // Clear local pending models that now exist in backend (matched by ID)
      const backendIds = new Set(backendModels.map(m => m.id));
      setLocalPendingModels(prev => {
        const remaining = prev.filter(m => !backendIds.has(m.id));
        saveMyModels(remaining);
        return remaining;
      });
    } catch (e) {
      console.warn('[MyModels] Failed to fetch from backend, falling back to localStorage', e);
    } finally {
      setMyModelsLoading(false);
    }
  }, []);

  useEffect(() => { fetchMyModels(); }, [fetchMyModels]);

  // Merged list: local pending (optimistic) + backend models, deduplicated by ID
  const mergedMyModels = useMemo(() => {
    const backendIds = new Set(myModels.map(m => m.id));
    const unique = localPendingModels.filter(m => !backendIds.has(m.id));
    return [...unique, ...myModels];
  }, [myModels, localPendingModels]);

  const isMyModelsEmptyState = !myModelsLoading && mergedMyModels.length === 0;

  // Keep the current in-studio step in the URL so browser refresh keeps users on the same screen.
  useEffect(() => {
    const currentStepParam = searchParams.get('step');
    const desiredStepParam = currentStep === 'model' ? 'model' : null;

    if (currentStepParam === desiredStepParam) return;

    const nextParams = new URLSearchParams(searchParams);
    if (desiredStepParam) {
      nextParams.set('step', desiredStepParam);
    } else {
      nextParams.delete('step');
    }
    setSearchParams(nextParams, { replace: true });
  }, [currentStep, searchParams, setSearchParams]);

  // Persist only local pending models to localStorage
  useEffect(() => { saveMyModels(localPendingModels); }, [localPendingModels]);

  const activeModelUrl = customModelImage || selectedModel?.url || null;

  // Validation
  const { isValidating, results: validationResults, validateImages, clearValidation } = useImageValidation();
  const [validationResult, setValidationResult] = useState<ImageValidationResult | null>(null);
  const [jewelryUploadedUrl, setJewelryUploadedUrl] = useState<string | null>(null);
  const [jewelryAssetId, setJewelryAssetId] = useState<string | null>(null);
  const [modelAssetId, setModelAssetId] = useState<string | null>(null);

  // Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [regenerationCount, setRegenerationCount] = useState(0);

  // ─── Pre-load vault asset (Re-shoot / New Shoot from My Products or My Models) ───

  const location = useLocation();
  // Intentionally empty deps: pre-load runs once on mount from route state.
  // Adding 'location' to deps would re-apply pre-load on every in-studio navigation, which is wrong.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const state = location.state as {
      preloadedJewelryUrl?: string;
      preloadedJewelryAssetId?: string;
      preloadedModelUrl?: string;
      preloadedModelAssetId?: string;
    } | null;

    if (state?.preloadedJewelryUrl) {
      setJewelryUploadedUrl(state.preloadedJewelryUrl);
      setJewelryAssetId(state.preloadedJewelryAssetId ?? null);
    }

    if (state?.preloadedModelUrl) {
      setCustomModelImage(state.preloadedModelUrl);
      setModelAssetId(state.preloadedModelAssetId ?? null);
    }
  }, []); // run once on mount — location.state is set before component renders

  // ─── Session restore — bring back jewelry/model state after reload ─────────
  useEffect(() => {
    // Don't restore if this is a Re-shoot (preloaded from route state)
    const routeState = location.state as { preloadedJewelryUrl?: string } | null;
    if (routeState?.preloadedJewelryUrl) return;

    const session = loadStudioSession();
    if (!session?.jewelryUploadedUrl) return;

    // Derive a displayable URL from the stored Azure URI
    setJewelryImage(azureUriToUrl(session.jewelryUploadedUrl));
    setJewelryUploadedUrl(session.jewelryUploadedUrl);
    if (session.jewelryAssetId) setJewelryAssetId(session.jewelryAssetId);
    if (session.validationResult) setValidationResult(session.validationResult);
    if (session.customModelImage) setCustomModelImage(session.customModelImage);
    if (session.modelAssetId) setModelAssetId(session.modelAssetId);
    if (session.selectedModelId) {
      const model = ALL_MODELS.find(m => m.id === session.selectedModelId);
      if (model) setSelectedModel(model);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Session save — persist whenever key upload/selection state changes ─────
  useEffect(() => {
    if (!jewelryUploadedUrl) return;
    saveStudioSession({
      jewelryUploadedUrl,
      jewelryAssetId,
      validationResult,
      selectedModelId: selectedModel?.id ?? null,
      customModelImage,
      modelAssetId,
    });
  }, [jewelryUploadedUrl, jewelryAssetId, validationResult, selectedModel, customModelImage, modelAssetId]);

  // ─── Upload Handlers ──────────────────────────────────────────────

  const handleJewelryUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload an image.' });
      return;
    }
    const normalized = await normalizeImageFile(file);
    setJewelryFile(normalized);
    setJewelryUploadedUrl(null);
    setJewelryAssetId(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setJewelryImage(e.target?.result as string);
      setValidationResult(null);
    };
    reader.readAsDataURL(normalized);

    const result = await validateImages([normalized], jewelryType, { category: TO_SINGULAR[jewelryType] ?? jewelryType });
    if (result && result.results.length > 0) {
      const localResult = result.results[0]; // use local variable — validationResult state is stale here (async setter)
      setValidationResult(localResult);
      if (localResult.uploaded_url) {
        setJewelryUploadedUrl(localResult.uploaded_url);
        setJewelryAssetId(localResult.asset_id ?? null);
      }

      if (localResult.is_acceptable) {
        // Path A: worn image accepted — fire jewelry_uploaded immediately
        trackJewelryUploaded({
          category: TO_SINGULAR[jewelryType] ?? jewelryType,
          upload_type: localResult.category,
          was_flagged: false,
        });
      } else {
        // Path B: non-worn image flagged — fire validation_flagged now;
        // jewelry_uploaded fires in handleContinueAnyway if user proceeds
        trackValidationFlagged({
          category: TO_SINGULAR[jewelryType] ?? jewelryType,
          detected_label: localResult.category,
        });
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

    // Show preview immediately via local blob URL while upload runs
    const localPreviewUrl = URL.createObjectURL(normalized);
    setCustomModelImage(localPreviewUrl);
    setSelectedModel(null);

    // Upload to Azure immediately so the model registers in My Models vault
    try {
      const { blob: compressed } = await compressImageBlob(normalized);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader2 = new FileReader();
        reader2.onload = () => resolve(reader2.result as string);
        reader2.onerror = reject;
        reader2.readAsDataURL(compressed);
      });
      const modelName = file.name.replace(/\.[^.]+$/, '');
      const azResult = await uploadToAzure(base64, 'image/jpeg', 'model_photo', { name: modelName });
      const stableUrl = azResult.sas_url || azResult.https_url;
      setCustomModelImage(stableUrl);
      setModelAssetId(azResult.asset_id ?? null);
      setCustomModelFile(null);
      trackModelSelected({
        category: TO_SINGULAR[jewelryType] ?? jewelryType,
        model_type: 'custom_upload',
      });

      // Add to My Models list — use real asset_id so dedup matches backend fetch
      const newModel: UserModel = {
        id: azResult.asset_id ?? `user-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        url: stableUrl,
        uploadedAt: Date.now(),
      };
      setLocalPendingModels(prev => [newModel, ...prev]);
      // Refetch from backend to sync
      fetchMyModels();
    } catch (e) {
      setCustomModelImage(null);
      setCustomModelFile(null);
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Model image could not be uploaded. Please re-select the file.' });
      console.warn('[handleModelUpload] Azure upload failed:', e);
    }
  }, [toast]);

  const handleSelectLibraryModel = (model: ModelImage) => {
    setSelectedModel(model);
    setCustomModelImage(null);
    setCustomModelFile(null);
    setModelAssetId(model.id); // e.g. "ecom-A" — backend distinguishes from UUIDs
    trackModelSelected({
      category: TO_SINGULAR[jewelryType] ?? jewelryType,
      model_type: 'catalog',
    });
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
    // Path B: user chose to proceed despite validation warning.
    // validationResult state IS safe to read here — validation finished before this dialog appeared.
    if (validationResult) {
      trackJewelryUploaded({
        category: TO_SINGULAR[jewelryType] ?? jewelryType,
        upload_type: validationResult.category,
        was_flagged: true,
      });
    }
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
    if (!hasCredits) {
      trackPaywallHit({
        category: TO_SINGULAR[jewelryType] ?? jewelryType,
        steps_completed: 2,
      });
      return;
    }

    clearStudioSession();
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStep('Preparing...');
    setGenerationError(null);
    setCurrentStep('generating');

    let _genWorkflowId = 'unknown';
    const _genStartTime = Date.now();
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
        const azResult = await uploadToAzure(base64, 'image/jpeg', 'jewelry_photo', { category: TO_SINGULAR[jewelryType] ?? jewelryType });
        jewelryUrl = azResult.https_url || azResult.sas_url;
        setJewelryAssetId(azResult.asset_id ?? null);
        setGenerationProgress(20);
      }

      setGenerationProgress(20);
      setGenerationStep('Preparing model image...');
      let modelUrl: string;

      if (selectedModel) {
        // Preset models already have HTTPS URLs — use directly
        modelUrl = selectedModel.url;
      } else if (customModelImage && customModelImage.startsWith('http')) {
        // Model was uploaded at selection time (handleModelUpload) — customModelImage is a SAS URL.
        // startsWith('http') guards against 'data:' URL previews set briefly before the Azure upload completes.
        modelUrl = customModelImage;
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
        ...(jewelryAssetId ? { input_jewelry_asset_id: jewelryAssetId } : {}),
        ...(modelAssetId ? { input_model_asset_id: modelAssetId } : {}),
      };
      const startResponse = await startPhotoshoot(photoshootPayload);
      _genWorkflowId = startResponse.workflow_id;

      setWorkflowId(startResponse.workflow_id);
      markGenerationStarted(startResponse.workflow_id);

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
            markGenerationCompleted(_genWorkflowId, _genStartTime);
            trackGenerationComplete({
              source: 'unified-studio',
              category: TO_SINGULAR[jewelryType] ?? jewelryType,
              upload_type: validationResult?.category ?? null,
              duration_ms: Date.now() - _genStartTime,
              is_first_ever: consumeFirstGeneration(),
            });
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
      markGenerationFailed(
        _genWorkflowId,
        error instanceof Error ? error.message : String(error),
        _genStartTime,
      );
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
    clearStudioSession();
    setJewelryImage(null);
    setJewelryFile(null);
    setJewelryUploadedUrl(null);
    setJewelryAssetId(null);
    setSelectedModel(null);
    setCustomModelImage(null);
    setCustomModelFile(null);
    setModelAssetId(null);
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

  // ─── Formanova Model Grid (no upload card) ────────────────────────

  const FormanovaModelGrid = ({ models }: { models: ModelImage[] }) => (
    <div className="grid grid-cols-3 gap-3">
      {models.map((model) => {
        const isSelected = selectedModel?.id === model.id && !customModelImage;
        return (
          <button
            key={model.id}
            onClick={() => handleSelectLibraryModel(model)}
            className={`group relative aspect-[3/4] overflow-hidden border transition-all ${
              isSelected ? 'border-foreground' : 'border-border/20 hover:border-foreground/30'
            }`}
          >
            <img
              src={model.url}
              alt={model.label}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            {isSelected && (
              <div className="absolute inset-0 bg-foreground/10 flex items-center justify-center">
                <div className="w-6 h-6 bg-foreground flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-background" />
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  const handleDeleteUserModel = (modelId: string) => {
    setMyModels(prev => prev.filter(m => m.id !== modelId));
    setLocalPendingModels(prev => prev.filter(m => m.id !== modelId));
    // If the deleted model was the active selection, clear it
    if (customModelImage) {
      const deleted = mergedMyModels.find(m => m.id === modelId);
      if (deleted && deleted.url === customModelImage) {
        setCustomModelImage(null);
        setModelAssetId(null);
      }
    }
  };

  // Hidden file input for model uploads
  const modelFileInput = (
    <input
      ref={modelInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleModelUpload(f); }}
    />
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
            {/* ── Alternate layout (internal experiment) ── */}
            {isAltUploadLayoutEnabled(user?.email) ? (
              <AlternateUploadStep
                exampleCategoryType={exampleCategoryType}
                jewelryImage={jewelryImage}
                activeProductAssetId={jewelryAssetId}
                isValidating={isValidating}
                validationResult={validationResult}
                isFlagged={!!isFlagged}
                canProceed={!!canProceed}
                jewelryInputRef={jewelryInputRef}
                onFileUpload={handleJewelryUpload}
                onClearImage={() => {
                  clearStudioSession();
                  setJewelryImage(null);
                  setJewelryFile(null);
                  setValidationResult(null);
                  setJewelryUploadedUrl(null);
                  setJewelryAssetId(null);
                  clearValidation();
                  if ((currentStep as string) === 'model') setCurrentStep('upload');
                }}
                onNextStep={handleNextStep}
                onForceNextStep={handleContinueAnyway}
                onProductSelect={(thumbnailUrl, assetId) => {
                  setJewelryImage(thumbnailUrl);
                  setJewelryUploadedUrl(thumbnailUrl);
                  setJewelryAssetId(assetId);
                  setJewelryFile(null);
                  setValidationResult(null);
                  clearValidation();
                  // Fetch and validate the selected product image
                  fetch(thumbnailUrl)
                    .then(r => r.blob())
                    .then(blob => {
                      const file = new File([blob], 'product.jpg', { type: blob.type || 'image/jpeg' });
                      return validateImages([file], jewelryType);
                    })
                    .then(result => {
                      if (result && result.results.length > 0) {
                        setValidationResult(result.results[0]);
                        if (result.results[0].uploaded_url) {
                          setJewelryUploadedUrl(result.results[0].uploaded_url);
                        }
                      }
                    })
                    .catch(e => console.warn('[ProductSelect] Validation failed:', e));
                }}
              />
            ) : (
            <>
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
                        onClick={() => { clearStudioSession(); setJewelryImage(null); setJewelryFile(null); setValidationResult(null); setJewelryUploadedUrl(null); setJewelryAssetId(null); clearValidation(); if ((currentStep as string) === 'model') setCurrentStep('upload'); }}
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
                    <Button
                      size="lg"
                      onClick={handleNextStep}
                      disabled={!canProceed}
                      className="gap-2.5 font-display text-base uppercase tracking-wide px-10 bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))] text-background hover:opacity-90 transition-opacity border-0 disabled:opacity-60 disabled:from-[hsl(var(--formanova-hero-accent))] disabled:to-[hsl(var(--formanova-glow))]"
                    >
                      {isValidating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Validating…
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
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
            </>
            )}
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
            STEP 2 — CHOOSE YOUR MODEL (visible only after Next)
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
                Choose or Upload Model
              </h2>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Choose a model from our library or upload your own
              </p>
            </div>

            {modelFileInput}

            {/* 2/3 + 1/3 split */}
            <div className="grid lg:grid-cols-3 gap-8 lg:gap-10">
              {/* Left 2/3 — Model Preview Canvas */}
              <div className="lg:col-span-2 space-y-5">
                <div className="border border-border/30 bg-muted/5 h-[480px] md:h-[540px] flex items-center justify-center relative overflow-hidden">
                  {activeModelUrl ? (
                    <>
                      <img
                        src={activeModelUrl}
                        alt="Selected model"
                        className="max-w-full max-h-[520px] object-contain"
                      />
                      <button
                        onClick={() => { setSelectedModel(null); setCustomModelImage(null); setCustomModelFile(null); setModelAssetId(null); }}
                        className="absolute top-3 right-3 w-7 h-7 bg-background/80 backdrop-blur-sm border border-border/40 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors z-10"
                        aria-label="Remove selected model"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <div
                      className="text-center w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-foreground/[0.02] transition-colors"
                      onClick={() => modelInputRef.current?.click()}
                      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleModelUpload(f); }}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      {/* Model silhouette sketch — theme-aware subtle fill */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 844 960"
                        fill="currentColor"
                        className="w-64 h-[22rem] md:w-80 md:h-[28rem] text-muted-foreground/20 mb-6"
                      >
                        <path d="m138 210.87c-17.42-2.42-50.24-6.99-65-15.22-4.71-2.62-9.28-6.72-12.95-10.65-11.46-12.31-8.44-26.77-2.85-41 9.71-24.68 37.59-54.5 64.8-58.72 1.32-0.15 2.67-0.23 4 0 14.3 1.84 2.4 16.41 10.3 25.62 4.1 4.77 14.44 9.17 20.7 10.05h9l11 1.01c16.1-0.57 31.32-5.44 46-11.83l12-5.7 30-11.01s33-9 33-9c28.74-7.99 57.54-14.15 87-18.69 13.29-2.05 33.92-5.71 47-5.73h18l21-1.78h15l40 2.78c20.63 0.25 59.65 7.9 79 15.19 18.6 7.01 39.67 15.85 56 27.25l14.96 12.19c11.73 9.9 17.08 14.97 25.12 28.28 7.22 11.95 13.94 25.76 13.91 40.09l-1.03 8.42v5.58c-0.19 4.01-1.81 8.14-2.96 12 5.98 0.49 9.3 1.55 14.96 3.13 16.95 4.75 22.6 9.48 35.04 21.87 5.66 5.64 10.06 9.98 14.13 17 10.57 18.27 16.03 42.23 18.87 63 3.3 24.17 0.2 49.22-4.55 73-9.76 48.87-25.98 91.83-56.08 132.01 0 0-6.73 9.57-6.73 9.57-5.65 7.21-21.24 22.28-28.64 27.92l-15 9.5 38-3.43c4.18-0.6 12.13-2.79 15.36 0.99 2.53 2.97-2.42 14.82-3.67 18.44l-4.57 15c-4.08 12.46-7.52 23.06-10.12 36l-4-1s19-65 19-65c-25.33 1.16-50.26 6.72-75 11.88 0 0-33 7.27-33 7.27s-23 6.97-23 6.97l-13 3.59-16 6.86c-23.25 9.92-45.65 21.07-68 32.88l-41 22c-19.79 11.71-52.06 34.06-70 48.36l-29 24.9-19.17 16.61-21.82 21.68-21.91 24c-3 3.35-4.29 6.71-8.1 9 6.89-16.51 24.3-34.3 37-47l51-48.73 36-28.27c-11.26-9.39-16.66-24.67-16.99-39-0.16-7.29 1.72-22.15 4.09-29 2.42-7 6.52-12.84 10.47-19 11.87-18.55 30.49-36.56 52.42-42.36 0 0 5.43-0.66 5.43-0.66l5.3-1.46 14.28-1.51s24 2.56 24 2.56c3.29-0.24 10.27-4.23 13-6.2 5.34-3.87 8.11-8.32 12.01-13.37 10.95-14.18 19.52-32.9 20.81-51 0.37-5.17-2.2-20.2-4.33-25-1.02-2.29-2.83-5.88-5.53-6.42-2.6-0.52-8.36 3.75-10.96 5.05-4.81 2.41-18.83 7.67-24 8.77-16.92 3.58-22.07 3.63-39 3.6-23.14-0.04-58.74-14.17-73.68-32-3.27-3.91-8.59-12.23-10.37-17-2.64-7.05-5.92-29.34-5.92-37l1.11-10v-8l2.85-10c2.01-8.8 8.92-26.99 18.01-30-0.55 6.79-1.09 6.12-1 14 0.14 12.12 5.79 25.08 14.46 33.63l7.54 5.97c17.83 14 40.77 19.93 63 21.49l12 0.91 25-1 27-2c33.6-0.05 63.51-1.47 88.96 25 5.36 5.58 5.52 7.68 9.04 14-3.37-23.86-29.45-37.15-50-44.46-14.77-5.26-35.39-5.8-51-6.08h-13c-24.42 0.69-60.5-3.22-83-12.74-23.03-9.75-44.26-28.39-34.19-55.72 2.45-6.66 8.74-15.53 13.33-21 6.05-7.21 11.5-13.16 19.86-17.82l9-5.18h-13c-9.94-0.02-20.16-2.14-30-3.57-19.12-2.78-37.88-6.92-56-13.89 0 0-14-6.03-14-6.03l-11-6.07-13-6.11c-14.34-7.94-36.86-26.12-45.05-40.33-1.53-2.66-5.07-11.9-5.95-15-8.37 6.02-20.17 24.16-26.42 33-17.76 25.1-32.54 56.77-38.58 87-1.76 8.78-4.32 20.11-3.92 29 0.46 10.12 1.93 18.16 3.83 28l8.17 37c0.69 4.19 0.27 11.73 4.07 13.98 1.78 1.06 4.77 1.04 6.85 1.5 5.49 0.5 14.41 3.54 19 0 6.5-4.55 8.68-11.94 16-15.48l-11 21 26 10.3c2.17 0.99 7.84 3.28 8.95 5.25 2.08 3.69-4.46 9.98-6.96 12.13-5.24 4.49-16.13 12.15-22.99 13.01-3.37 0.42-7.44-0.53-11-0.69 1.99-6.64 6.56-7.4 6.34-11.99-0.19-4.1-5.11-5.76-8.34-6.96-10.12-3.73-16.41-4.87-26-11.05l-5.51 13c-10.86 19.63-29.3 33.96-47.49 46.34-6.74 4.59-15.95 12.54-24 13.66 3.05-5.45 16.34-12.75 22-16.72 12.99-9.12 30.59-22.79 40.1-35.28 2.97-3.9 11.7-15.25 11.4-19.96-0.22-3.42-4.07-5.37-6.32-7.5-2.66-2.53-3.6-4.33-5.18-7.54l13-3-2.47-15c-3.58-14.38-12.39-34.45-13.53-48-7.98 9.34-14.63 16.59-26 22.02-5.01 2.39-10.61 3.49-16 4.64-36.61 7.83-68.94-7.06-91.11-36.66-8.17-10.92-16.72-27.11-16.89-41-0.12-10.95 3.8-30.28 8.66-40 3.27-6.55 9.91-14.54 15.38-19.42 4.2-3.75 8.9-7.71 13.96-10.24 2.31-1.17 5.31-2.46 7.37 0 1.62 2.1 0.55 5.33 0 7.66-1.05 5.21-2.02 11.68-1.79 17 0.13 2.98 0.87 8.22 1.83 11 5.77 16.79 22.89 16 37.59 16l-1-15c0.07-16.56 8.11-33.39 17-47 0 0-17-2.13-17-2.13zm579-36.87l-1 1v-1h1zm1 12l-2-5 2 5zm-394 170.04c-5.49-5.26-14.36-11.51-21-15.3-2.48-1.41-7.21-4.01-10-4.23-3.78-0.3-11.38 4.81-15 6.79l-21 11.18-14 7.74c-2.93 1.39-15.44 7.95-17.64 4.2-1.84-3.12 3.41-9.16 5.26-11.42 7.42-9.07 16.79-15.66 27.38-20.58 8.18-3.8 20.87-8.93 30-8.24 14.97 1.14 27.65 12.14 37.15 22.82 5.56 6.24 9.01 7.71 11.85 16l-1 1c-5.19-1.93-8.05-6.18-12-9.96zm-177 141.96c0 13.05 3.54 19.67 13.04 28.91 6.42 6.25 11.8 8.48 16.6 17.09 3.36 6.04 5.1 18.82-1.64 23 1.19-7.75 3.24-10.26-1.07-18-5.23-9.39-12.06-11.86-18.89-18.18-8.2-7.58-14.52-21.96-10.04-32.82h2zm51.98 30.73c2.45 1.62 5.46 4.91 4.36 8.12-0.69 2.04-2.4 2.65-4.36 2l-6.98-4.44c-4.28-2.3-9.2-3.19-14-3.41 2.51-6.97 15.84-5.65 20.98-2.27zm-28.98 53.27c-0.03-2.67-0.59-9.26 1.6-10.98 3.28-2.56 11.05 1.24 14.4 2.58 17.94 7.18 22.42 12.03 38 21.59l15.57 7.95c1.07 0.81 1.64 1.65 1.96 2.97 0.7 2.86-1.19 7.11-2.11 9.89-3.33 10.07-6.32 12.98-14.42 19.28-3.13 2.44-4.99 4.22-9 5.19-10.02 2.43-20.7-3.07-19.81-14.47 0.53-6.85 3.61-10.99 5.81-17-15.17-1.27-31.77-9.91-32-27zm180.99 219s16.3-17.75 16.3-17.75l18.29-16.53c14.64-14.71 40.05-32.85 57.42-45.14l40-25.9 15-9.37 61-29.62c20.03-9.19 40.07-18.23 61-25.2 0 0 23-7.58 23-7.58l48-12.03c7.74-1.83 21.14-6.87 28-2.88l-28 6.89s-31 7.74-31 7.74s-28 7.4-28 7.4c-18.48 5.85-44.11 17.45-62 25.66l-25 10.57s-14 7.48-14 7.48l-14 6.89-42 25.26c-22.34 14.85-44.17 30.45-65 47.42l-25 22.52-7.72 6.61s-29.24 29.56-29.24 29.56c-4.71 4.93-7.23 10-14.04 12 2.18-9.14 10.61-17.46 16.99-24zm-136.85-108c7.03 17.44 37.31 16.18 52.86 16l9-1.06h10c19.04-2.71 50.21-11.55 68-18.95 9.92-4.13 25.22-14.5 35-14.99-3.11 6.44-9.89 10.44-16 13.77-11.2 6.11-14.82 8.07-27 12.31l-34 12c-17.88 4.77-31.65 5.95-50 5.92-6.06-0.01-12.01-0.87-18-1.73-14.02-2.01-29.36-5.96-34.08-21.27-2-6.13-0.43-13.74 0-20h3.08c-0.56 6.96-1.69 10.96 1.14 18zm50.86 196.14c-16.64 9.78-45.58 28.04-65 28.82-2.72 0.11-5.43 0.03-8-0.95-5.68-2.16-16.05-11.37-18.29-17.02-3.36-8.51-2.81-16.06-2.71-24.99 0.11-8.8 3.84-24.51 6.67-33 13.24-39.76 35.43-62.02 69.33-85.35 20.86-14.35 20.51-15.49 45-23.65 0.72 7.49-4.12 10.35-9 15.04-5.02 4.83-9.47 9.61-13.92 14.96-9.47 11.39-17.43 26.73-21.64 41l-2.48 12c-1.35 5.71-3.14 9.76-3.64 16l0.8 9v10c1.51 10.27 8.22 25 18.88 28.2 12.42 3.73 20.02-11.23 31-10.2-5.03 6.65-19.55 15.76-27 20.14zm-31-118.49l-11.96 9.52c-9.97 9.31-27.72 33.09-32.57 45.83-2.63 6.89-6.46 30.27-6.47 38-0.02 10.33-0.71 27.54 2.36 37 2.08 6.41 4.16 11.53 11.64 11.96 8.66 0.49 14.4-2.74 22-6.1l43-22.86c-3.97-4.22-6.45-4.05-11-6.96-5.45-3.48-10.71-8.51-14.07-14.04-16.82-27.63-2.29-67.31 12.41-93l10.66-16c-7.7 2.82-19.25 11.5-26 16.65z" />
                      </svg>
                      <p className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground/60">
                        Selected or uploaded model will appear here
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
                    Generate Photoshoot
                    {preflightChecking ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <span className="flex items-center gap-1 opacity-70 text-sm font-mono normal-case tracking-normal">
                        ≤ <img src={creditCoinIcon} alt="" className="h-4 w-4 object-contain" /> 10
                      </span>
                    )}
                  </Button>
                </div>
              </div>

              {/* Right 1/3 — Model Selection Sidebar with My Models / Formanova tabs */}
              <div className="space-y-4">
                <Tabs defaultValue="formanova" className="w-full">
                  <TabsList className="w-full grid grid-cols-2 mb-4 bg-muted/30 h-11">
                    <TabsTrigger value="my-models" className="font-mono text-[10px] uppercase tracking-[0.15em] data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=inactive]:text-muted-foreground transition-all">
                      My Models
                    </TabsTrigger>
                    <TabsTrigger value="formanova" className="font-mono text-[10px] uppercase tracking-[0.15em] data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=inactive]:text-muted-foreground transition-all">
                      Formanova Models
                    </TabsTrigger>
                  </TabsList>

                  {/* ── MY MODELS TAB ── */}
                  <TabsContent value="my-models" className="space-y-3">

                    {isMyModelsEmptyState ? (
                      <div className="border border-dashed border-border/30 bg-muted/10 px-6 py-8 flex flex-col items-center text-center gap-4">
                        <p className="text-sm text-muted-foreground max-w-[28ch]">
                          No models yet. Upload a model. It will be saved here
                        </p>
                        <Button
                          onClick={() => modelInputRef.current?.click()}
                          className="gap-2 font-mono text-[11px] uppercase tracking-widest"
                        >
                          <Upload className="h-4 w-4" />
                          Upload Model
                        </Button>
                      </div>
                    ) : (
                      <>
                      {/* Search */}
                      <div className="relative mb-3">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search models..."
                          value={myModelsSearch}
                          onChange={e => setMyModelsSearch(e.target.value)}
                          className="w-full bg-muted/20 border border-border/20 pl-7 pr-3 py-1.5 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/60 transition-colors"
                        />
                      </div>
                      <div className="h-[420px] md:h-[480px] overflow-y-auto pr-1">
                        <MasonryGrid columns={3} gap={12}>
                          {/* Upload card — always first */}
                          <div className="flex flex-col">
                            <button
                              onClick={() => modelInputRef.current?.click()}
                              className="group/upload relative aspect-[3/4] w-full overflow-hidden border border-dashed border-border/30 transition-all flex flex-col items-center justify-center gap-2 hover:border-foreground/30 hover:bg-foreground/[0.02]"
                            >
                              <Diamond className="h-9 w-9 text-primary" />
                              <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider text-center px-1">
                                Upload
                              </span>
                            </button>
                            {/* Reserve naming-row height for grid alignment */}
                            <div className="h-10 sm:h-11" />
                          </div>

                          {/* User-uploaded models */}
                          {mergedMyModels.filter(m => !myModelsSearch || m.name.toLowerCase().includes(myModelsSearch.toLowerCase())).map((model) => {
                            const isActive = customModelImage === model.url;
                            return (
                              <ModelCard
                                key={model.id}
                                model={model}
                                isActive={isActive}
                                onSelect={() => { setCustomModelImage(model.url); setSelectedModel(null); setCustomModelFile(null); setModelAssetId(model.id.startsWith('user-') ? null : model.id); }}
                                onDelete={() => handleDeleteUserModel(model.id)}
                                onRename={async (newName) => {
                                  if (!model.id.startsWith('user-')) {
                                    try { await updateAssetMetadata(model.id, { name: newName }); } catch (e) { console.warn('[ModelCard] Rename failed:', e); }
                                  }
                                  setMyModels(prev => prev.map(m => m.id === model.id ? { ...m, name: newName } : m));
                                  setLocalPendingModels(prev => prev.map(m => m.id === model.id ? { ...m, name: newName } : m));
                                }}
                              />
                            );
                          })}
                        </MasonryGrid>
                      </div>
                      </>
                    )}
                  </TabsContent>

                  {/* ── FORMANOVA MODELS TAB ── */}
                  <TabsContent value="formanova">
                    <div className="h-[420px] md:h-[480px] overflow-y-auto pr-1">
                      {/*
                        CSS columns layout: content flows top-to-bottom in each column before
                        moving to the next. Category buttons anchor to the top of column 1,
                        and images fill the remaining space below them and in columns 2 & 3.
                      */}
                      <div className="columns-3 gap-2">
                        {/* Category buttons — naturally occupy the top of column 1 */}
                        {([
                          { key: 'ecom' as const, label: 'E-Commerce' },
                          { key: 'editorial' as const, label: 'Editorial' },
                        ]).map((cat) => (
                          <div key={cat.key} className="break-inside-avoid mb-2">
                            <button
                              onClick={() => setFormanovaCategory(cat.key)}
                              className={`w-full px-3 py-3 text-center transition-all duration-200 ${
                                formanovaCategory === cat.key
                                  ? 'bg-foreground text-background'
                                  : 'bg-transparent text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5'
                              }`}
                            >
                              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] leading-tight">
                                {cat.label}
                              </span>
                            </button>
                          </div>
                        ))}
                        {/* Model thumbnails — flow into remaining space in col 1 then cols 2 & 3 */}
                        {(formanovaCategory === 'ecom' ? ECOM_MODELS : EDITORIAL_MODELS).map((model) => {
                          const isSelected = selectedModel?.id === model.id && !customModelImage;
                          return (
                            <div key={model.id} className="break-inside-avoid mb-2">
                              <button
                                onClick={() => handleSelectLibraryModel(model)}
                                className={`group relative overflow-hidden border transition-all duration-200 w-full ${
                                  isSelected ? 'border-foreground' : 'border-border/20 hover:border-foreground/30'
                                }`}
                              >
                                <img
                                  src={model.url}
                                  alt={model.label}
                                  className="w-full block group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                                {isSelected && (
                                  <div className="absolute inset-0 bg-foreground/10 flex items-center justify-center">
                                    <div className="w-6 h-6 bg-foreground flex items-center justify-center">
                                      <Check className="h-3.5 w-3.5 text-background" />
                                    </div>
                                  </div>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
                            const resp = await fetch(url);
                            if (!resp.ok) throw new Error('Fetch failed');
                            const blob = await resp.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = blobUrl;
                            a.download = `photoshoot-${workflowId?.slice(0, 8)}-${i + 1}.jpg`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(blobUrl);
                            trackDownloadClicked({
                              file_type: 'jpg',
                              context: 'unified-studio',
                              category: TO_SINGULAR[jewelryType] ?? jewelryType,
                            });
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
              <Button variant="outline" size="lg" onClick={handleStartOver} className="gap-2 font-mono text-[10px] uppercase tracking-wider h-11 w-44">
                <Diamond className="h-4 w-4" />
                New Photoshoot
              </Button>
              <Button
                size="lg"
                onClick={() => {
                  setRegenerationCount(c => c + 1);
                  trackRegenerateClicked({
                    context: 'unified-studio',
                    category: TO_SINGULAR[jewelryType] ?? jewelryType,
                    regeneration_number: regenerationCount + 1, // +1 because setRegenerationCount hasn't updated state yet
                  });
                  setResultImages([]);
                  setCurrentStep('generating');
                  handleGenerate();
                }}
                className="gap-2 font-display text-base uppercase tracking-wide h-11 px-6 bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))] text-background hover:opacity-90 transition-opacity border-0"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
                <span className="flex items-center gap-1 opacity-70 text-sm font-mono normal-case tracking-normal ml-1">
                  ≤ <img src={creditCoinIcon} alt="" className="h-4 w-4 object-contain" /> 10
                </span>
              </Button>
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
