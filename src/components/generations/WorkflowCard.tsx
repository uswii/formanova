import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Box, Download } from 'lucide-react';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { Button } from '@/components/ui/button';
import type { WorkflowSummary } from '@/lib/generation-history-api';
import { SnapshotPreviewModal } from './SnapshotPreviewModal';
import { PhotoPreviewModal } from './PhotoPreviewModal';
import { format } from 'date-fns';

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

function CadTextCard({ workflow, index }: { workflow: WorkflowSummary; index: number }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const dateStr = workflow.created_at
    ? format(new Date(workflow.created_at), 'MMM d, yyyy · HH:mm')
    : '—';

  const shots = workflow.screenshots ?? [];
  const hasShots = shots.length > 0;
  const isEnriching = !workflow.glb_url && !workflow.screenshots;

  const handleDownloadGlb = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!workflow.glb_url) return;
    const a = document.createElement('a');
    a.href = workflow.glb_url;
    a.download = workflow.glb_filename || 'model.glb';
    a.target = '_blank';
    a.click();
  };

  return (
    <>
      <motion.div
        variants={itemVariants}
        className="marta-frame overflow-hidden"
      >
        {/* Card header: number + date */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <span className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground/70 select-none">
            #{index}
          </span>
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
            {dateStr}
          </span>
        </div>

        {/* ── Snapshot strip ── */}
        <div className="px-4 pb-3">
          {hasShots ? (
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {shots.map((shot, i) => (
                <button
                  key={shot.angle}
                  onClick={() => setPreviewIndex(i)}
                  title={shot.angle.replace(/_/g, ' ')}
                  className="group/thumb flex-shrink-0 w-14 h-14 bg-muted overflow-hidden rounded-sm border border-border/30 hover:border-foreground/50 transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
                >
                  <OptimizedImage
                    src={shot.url}
                    alt={shot.angle}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-110"
                  />
                </button>
              ))}
            </div>
          ) : (
            /* Pulse placeholders while enrichment loads */
            <div className="flex gap-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-14 h-14 bg-muted/50 rounded-sm animate-pulse"
                />
              ))}
            </div>
          )}
        </div>

        {/* ── File box ── */}
        <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-sm border border-border/50 bg-muted/20 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Box className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <span className="font-mono text-[10px] tracking-wider text-foreground truncate">
              {workflow.glb_filename || (isEnriching ? '—' : 'model.glb')}
            </span>
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
              {isEnriching ? 'Loading…' : 'Unavailable'}
            </span>
          )}
        </div>
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

  const dateStr = workflow.created_at
    ? format(new Date(workflow.created_at), 'MMM d, yyyy · HH:mm')
    : '—';

  const durationSec =
    workflow.finished_at && workflow.created_at
      ? Math.round(
          (new Date(workflow.finished_at).getTime() -
            new Date(workflow.created_at).getTime()) /
            1000,
        )
      : null;

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
              className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {/* View / enlarge icon overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-background/0 group-hover:bg-background/20 transition-colors duration-200">
              <div className="bg-background/80 backdrop-blur-sm p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Maximize2 className="h-5 w-5 text-foreground" />
              </div>
            </div>
          </button>
        ) : (
          /* Placeholder when no image yet */
          <div className="w-full aspect-square bg-muted/50 animate-pulse" />
        )}

        {/* Card footer: index · date · duration */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground/70 select-none">
            #{index}
          </span>
          <div className="flex items-center gap-3">
            {durationSec !== null && (
              <span className="font-mono text-[9px] tracking-wider text-muted-foreground/60">
                {durationSec}s
              </span>
            )}
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
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

export function WorkflowCard({ workflow, index = 0, onClick }: WorkflowCardProps) {
  if (workflow.source_type === 'cad_text') {
    return <CadTextCard workflow={workflow} index={index} />;
  }

  // photo and cad_render both use the new image-first card
  return <PhotoCard workflow={workflow} index={index} />;
}
