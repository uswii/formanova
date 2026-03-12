import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Box, Download, Pencil, Check, X } from 'lucide-react';
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
function formatLocal(ts: string): string {
  // Ensure the timestamp is treated as UTC if it lacks a timezone indicator
  let normalized = ts.trim();
  if (normalized && !/[Zz]$/.test(normalized) && !/[+-]\d{2}:\d{2}$/.test(normalized)) {
    normalized += 'Z';
  }
  return localDateFmt.format(new Date(normalized));
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

function CadTextCard({ workflow, index }: { workflow: WorkflowSummary; index: number }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const dateStr = workflow.created_at ? formatLocal(workflow.created_at) : '—';
  const shots = workflow.screenshots ?? [];
  const hasShots = shots.length > 0;
  const isEnriching = workflow.screenshots === undefined;

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
    const a = document.createElement('a');
    a.href = workflow.glb_url;
    a.download = shownFilename;
    a.target = '_blank';
    a.click();
  };

  return (
    <>
      <motion.div
        variants={itemVariants}
        className="marta-frame overflow-hidden"
      >
        {/* Card header: number + model tier + date */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground/70 select-none">
              #{index}
            </span>
            {modelLabel && (
              <span className="font-mono text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 border border-border bg-muted/40 text-muted-foreground">
                {modelLabel}
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
            {dateStr}
          </span>
        </div>

        {/* ── Interactive 3D GLB Preview ── */}
        {workflow.glb_url && (
          <div className="mx-3 mb-2">
            <GLBPreviewSlot
              id={workflow.workflow_id}
              glbUrl={workflow.glb_url}
              className="w-full aspect-[4/3] bg-background/50 border border-border/30"
            />
          </div>
        )}
        {!workflow.glb_url && isEnriching && (
          <div className="mx-4 mb-3 w-[calc(100%-2rem)] aspect-square bg-muted/30 animate-pulse" />
        )}

        {/* ── File box — only shown when GLB is available or still loading ── */}
        {(workflow.glb_url || isEnriching) && (
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
              <Button
                size="sm"
                onClick={handleDownloadGlb}
                className="h-7 px-3 font-mono text-[10px] tracking-wider uppercase gap-1.5 flex-shrink-0"
              >
                <Download className="h-3 w-3" />
                Download GLB
              </Button>
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
  const durationSec =
    workflow.finished_at && workflow.created_at
      ? Math.round(
          (new Date(workflow.finished_at).getTime() -
            new Date(workflow.created_at).getTime()) /
            1000,
        )
      : null;

  // undefined = enrichment not started; '' = enriched but no thumbnail found
  const isEnriching = workflow.thumbnail_url === undefined;
  const hasThumbnail = !!workflow.thumbnail_url;

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
              src={workflow.thumbnail_url!}
              alt={workflow.name || 'Generation preview'}
              priority
              className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {/* View / enlarge icon overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-background/0 group-hover:bg-background/20 transition-colors duration-200">
              <div className="bg-background/80 backdrop-blur-sm p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Maximize2 className="h-5 w-5 text-foreground" />
              </div>
            </div>
          </button>
        ) : isEnriching ? (
          /* Pulsing placeholder while enrichment is in progress */
          <div className="w-full aspect-square bg-muted/50 animate-pulse" />
        ) : null}

        {/* Card footer: index · date · duration */}
        <div className="flex items-center justify-between px-2.5 py-2">
          <span className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground/70 select-none">
            #{index}
          </span>
          <div className="flex items-center gap-2">
            {durationSec !== null && (
              <span className="font-mono text-[8px] tracking-wider text-muted-foreground/60">
                {durationSec}s
              </span>
            )}
            <span className="font-mono text-[9px] tracking-wider text-muted-foreground truncate max-w-[90px]">
              {dateStr}
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
