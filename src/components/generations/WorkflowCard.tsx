import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { Maximize2, Box, Download, Pencil, Check, X, AlertTriangle, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import creditCoinIcon from '@/assets/icons/credit-coin.png';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WorkflowSummary } from '@/lib/generation-history-api';
import { SnapshotPreviewModal } from './SnapshotPreviewModal';
import { PhotoPreviewModal } from './PhotoPreviewModal';
import { GLBPreviewSlot } from './ScissorGLBGrid';

const localDateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const localDateOnlyFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
});
function formatLocal(ts: string): string {
  let normalized = ts.trim();
  if (normalized && !/[Zz]$/.test(normalized) && !/[+-]\d{2}:\d{2}$/.test(normalized)) {
    normalized += 'Z';
  }
  return localDateFmt.format(new Date(normalized));
}
function formatLocalDateOnly(ts: string): string {
  let normalized = ts.trim();
  if (normalized && !/[Zz]$/.test(normalized) && !/[+-]\d{2}:\d{2}$/.test(normalized)) {
    normalized += 'Z';
  }
  return localDateOnlyFmt.format(new Date(normalized));
}

interface WorkflowCardProps {
  workflow: WorkflowSummary;
  index?: number;
  onClick: (id: string) => void;
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ─── Text-to-CAD card ──────────────────────────────────────────────────────

// Model ID → display label mapping
const MODEL_LABELS: Record<string, string> = {
  gemini: 'Lite',
  'claude-sonnet': 'Standard',
  'claude-opus': 'Premium',
  lite: 'Lite',
  standard: 'Standard',
  premium: 'Premium',
};

function CreditsBadge({ credits }: { credits?: number | null }) {
  if (credits === undefined || credits === null) return null;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-muted-foreground">
      <img src={creditCoinIcon} alt="" className="w-3.5 h-3.5" />
      {credits}
    </span>
  );
}

function CadTextCard({ workflow, index }: { workflow: WorkflowSummary; index: number }) {
  const navigate = useNavigate();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const dateStr = workflow.created_at ? formatLocal(workflow.created_at) : '—';
  const dateOnlyStr = workflow.created_at ? formatLocalDateOnly(workflow.created_at) : '—';
  const shots = workflow.screenshots ?? [];
  const hasShots = shots.length > 0;
  const isEnriching = workflow.screenshots === undefined;
  const isFailed = workflow.status === 'failed';

  const modelLabel = workflow.mode
    ? MODEL_LABELS[workflow.mode.toLowerCase()] ?? workflow.mode
    : workflow.ai_model
      ? MODEL_LABELS[workflow.ai_model] ?? workflow.ai_model
      : null;

  // Derive the shown filename (user rename takes priority)
  const rawFilename = workflow.glb_filename || 'model.glb';
  const extension = rawFilename.includes('.') ? rawFilename.split('.').pop()! : 'glb';
  const baseName = rawFilename.replace(/\.[^.]+$/, '');
  const shownFilename = displayName ? `${displayName}.${extension}` : rawFilename;

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(displayName || baseName);
    setIsRenaming(true);
  };

  const handleConfirmRename = useCallback(() => {
    const sanitized = renameValue.trim().replace(/[<>:"/\\|?*]/g, '_');
    if (sanitized && sanitized !== baseName) {
      setDisplayName(sanitized);
    }
    setIsRenaming(false);
  }, [renameValue, baseName]);

  const handleCancelRename = () => {
    setIsRenaming(false);
  };

  const handleDownloadGlb = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!workflow.glb_url) return;
    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: shownFilename, file_type: 'glb', context: 'generations' }));
    const a = document.createElement('a');
    a.href = workflow.glb_url;
    a.download = shownFilename;
    a.target = '_blank';
    a.click();
  };

  const handleLoadInStudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!workflow.glb_url) return;
    navigate(`/text-to-cad?glb=${encodeURIComponent(workflow.glb_url)}`);
  };

  return (
    <>
      <motion.div
        variants={itemVariants}
        className="marta-frame overflow-hidden"
      >
        {/* Card header: number + model tier + date */}
        <div className="flex items-center justify-end sm:justify-between px-4 pt-4 pb-3 gap-2">
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <span className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground/70 select-none">
              #{index}
            </span>
            {modelLabel && (
              <span className="font-mono text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 border border-border bg-muted/40 text-muted-foreground">
                {modelLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline-flex"><CreditsBadge credits={workflow.credits_spent} /></span>
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground whitespace-nowrap">
              <span className="sm:hidden">{dateOnlyStr}</span>
              <span className="hidden sm:inline">{dateStr}</span>
            </span>
          </div>
        </div>

        {/* ── Interactive 3D GLB Preview ── */}
        {workflow.glb_url && !isFailed && (
          <div className="mx-3 mb-2 relative">
            <GLBPreviewSlot
              id={workflow.workflow_id}
              glbUrl={workflow.glb_url}
              className="w-full aspect-[4/3] bg-background/50 border border-border/30"
            />
            {workflow.credits_spent != null && (
              <div className="sm:hidden absolute top-0 left-0 flex items-center gap-1 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 border-r border-b border-border/30">
                <img src={creditCoinIcon} alt="" className="w-3 h-3" />
                <span className="font-mono text-[9px] text-foreground">{workflow.credits_spent}</span>
              </div>
            )}
          </div>
        )}
        {!workflow.glb_url && !isFailed && isEnriching && (
          <div className="mx-4 mb-3 w-[calc(100%-2rem)] aspect-[4/3] bg-muted/30 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-muted-foreground/60 rounded-full animate-spin" />
          </div>
        )}

        {/* ── Failed overlay ── */}
        {isFailed && (
          <div className="mx-3 mb-2 aspect-[4/3] border border-border/30 bg-card flex items-center justify-center">
            <div className="text-center px-6">
              <div className="mx-auto w-10 h-10 border border-border flex items-center justify-center mb-4">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="font-display text-sm uppercase tracking-[0.15em] text-foreground mb-2">
                Could Not Complete Generation
              </p>
              <p className="font-mono text-[10px] leading-relaxed tracking-wide text-muted-foreground">
                Our AI service was unable to complete this generation. Please try again in a few minutes. If the issue persists, contact{' '}
                <a
                  href="mailto:studio@formanova.ai"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  studio@formanova.ai
                </a>
              </p>
            </div>
          </div>
        )}

        {/* ── File box — only shown when GLB is available or still loading ── */}
        {!isFailed && (workflow.glb_url || isEnriching) && (
          <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-sm border border-border/50 bg-muted/20 px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Box className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              {isRenaming ? (
                <div className="flex items-center gap-1 min-w-0" onClick={e => e.stopPropagation()}>
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmRename();
                      if (e.key === 'Escape') handleCancelRename();
                    }}
                    autoFocus
                    className="h-6 font-mono text-[10px] tracking-wider px-1.5 py-0 min-w-[80px] max-w-[140px]"
                  />
                  <span className="text-[10px] text-muted-foreground font-mono">.{extension}</span>
                  <button onClick={handleConfirmRename} className="p-0.5 hover:text-foreground text-muted-foreground transition-colors">
                    <Check className="h-3 w-3" />
                  </button>
                  <button onClick={handleCancelRename} className="p-0.5 hover:text-foreground text-muted-foreground transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[10px] tracking-wider text-foreground truncate">
                    {isEnriching ? '—' : shownFilename}
                  </span>
                  {!isEnriching && workflow.glb_url && (
                    <button
                      onClick={handleStartRename}
                      className="p-0.5 hover:text-foreground text-muted-foreground/50 transition-colors flex-shrink-0"
                      aria-label="Rename file"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {workflow.glb_url ? (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDownloadGlb}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Download GLB"
                  aria-label="Download GLB"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleLoadInStudio}
                  className="h-7 px-2.5 font-mono text-[9px] tracking-wider uppercase gap-1 whitespace-nowrap"
                >
                  <Layers className="h-3 w-3 flex-shrink-0" />
                  <span className="hidden sm:inline">Load in Studio</span>
                  <span className="sm:hidden">Studio</span>
                </Button>
              </div>
            ) : (
              <span className="font-mono text-[9px] tracking-wider text-muted-foreground/40 uppercase flex-shrink-0">
                Loading…
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* Snapshot preview modal */}
      {previewIndex !== null && hasShots && (
        <SnapshotPreviewModal
          screenshots={shots}
          initialIndex={previewIndex}
          glbUrl={workflow.glb_url}
          glbFilename={workflow.glb_filename}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
  );
}

// ─── Photo / CAD-render card ────────────────────────────────────────────────
// Matches the "From Text to CAD" card style: image-first, minimal metadata.

function PhotoCard({ workflow, index }: { workflow: WorkflowSummary; index: number }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const dateStr = workflow.created_at ? formatLocal(workflow.created_at) : '—';
  const dateOnlyStr = workflow.created_at ? formatLocalDateOnly(workflow.created_at) : '—';

  // undefined = enrichment not started; '' = enriched but no thumbnail found
  const isEnriching = workflow.thumbnail_url === undefined;
  const hasThumbnail = !!workflow.thumbnail_url;
  const resolvedThumbnail = useAuthenticatedImage(workflow.thumbnail_url);

  return (
    <>
      <motion.div variants={itemVariants} className="marta-frame overflow-hidden">
        {/* Thumbnail — sharp rectangle, image-first */}
        {hasThumbnail ? (
          <button
            onClick={() => setPreviewOpen(true)}
            className="group relative w-full bg-muted overflow-hidden block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
            aria-label="Enlarge preview"
          >
            <OptimizedImage
              src={resolvedThumbnail ?? ""}
              alt={workflow.name || 'Generation preview'}
              sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 20vw"
              className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {/* Credits badge — mobile only, top-left corner */}
            {workflow.credits_spent != null && (
              <div className="sm:hidden absolute top-0 left-0 flex items-center gap-1 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 border-r border-b border-border/30">
                <img src={creditCoinIcon} alt="" className="w-3 h-3" />
                <span className="font-mono text-[9px] text-foreground">{workflow.credits_spent}</span>
              </div>
            )}
            {/* View / enlarge icon overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-background/0 group-hover:bg-background/20 transition-colors duration-200">
              <div className="bg-background/80 backdrop-blur-sm p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Maximize2 className="h-5 w-5 text-foreground" />
              </div>
            </div>
          </button>
        ) : isEnriching ? (
          /* Spinner placeholder while enrichment is in progress */
          <div className="w-full aspect-square bg-muted/30 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-muted-foreground/60 rounded-full animate-spin" />
          </div>
        ) : null}

        {/* Card footer: index · credits · date */}
        <div className="flex items-center justify-end sm:justify-between px-3 pt-3 pb-3 gap-2">
          <span className="hidden sm:inline font-mono text-[10px] tracking-[0.15em] text-muted-foreground/70 select-none min-w-0">
            #{index}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline-flex"><CreditsBadge credits={workflow.credits_spent} /></span>
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground whitespace-nowrap">
              <span className="sm:hidden">{dateOnlyStr}</span>
              <span className="hidden sm:inline">{dateStr}</span>
            </span>
          </div>
        </div>
      </motion.div>

      {/* Enlarged preview modal */}
      {previewOpen && hasThumbnail && (
        <PhotoPreviewModal
          imageUrl={workflow.thumbnail_url!}
          alt={workflow.name || 'Generation preview'}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}

// ─── Exported card dispatcher ───────────────────────────────────────────────

export function WorkflowCard({ workflow, index = 0, onClick: _onClick }: WorkflowCardProps) {
  if (workflow.source_type === 'cad_text') {
    return <CadTextCard workflow={workflow} index={index} />;
  }

  // photo and cad_render both use the new image-first card
  return <PhotoCard workflow={workflow} index={index} />;
}
