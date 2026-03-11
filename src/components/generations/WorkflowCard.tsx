import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Box, Download, Cube } from 'lucide-react';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { Button } from '@/components/ui/button';
import type { WorkflowSummary } from '@/lib/generation-history-api';
import { SnapshotPreviewModal } from './SnapshotPreviewModal';
import { PhotoPreviewModal } from './PhotoPreviewModal';
import { Glb3DModal } from './Glb3DModal';
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

// ─── Text-to-CAD card (static thumbnail — NO WebGL Canvas per card) ────────

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
  const [show3D, setShow3D] = useState(false);

  const dateStr = workflow.created_at
    ? format(new Date(workflow.created_at), 'MMM d, yyyy · HH:mm')
    : '—';

  const shots = workflow.screenshots ?? [];
  const hasShots = shots.length > 0;
  const isEnriching = workflow.screenshots === undefined;
  const heroShot = shots[0] ?? null;

  const modelLabel = workflow.mode
    ? MODEL_LABELS[workflow.mode.toLowerCase()] ?? workflow.mode
    : workflow.ai_model
      ? MODEL_LABELS[workflow.ai_model] ?? workflow.ai_model
      : null;

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
      <motion.div variants={itemVariants} className="marta-frame overflow-hidden">
        {/* Card header */}
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

        {/* Static thumbnail — first screenshot, NO WebGL */}
        <div className="mx-4 mb-3">
          <div
            className="w-full bg-black border border-border/50 rounded-sm overflow-hidden"
            style={{ aspectRatio: '1 / 1', maxWidth: 512, maxHeight: 512 }}
          >
            {heroShot ? (
              <button
                onClick={() => setPreviewIndex(0)}
                className="group relative w-full h-full block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
                aria-label="View snapshots"
              >
                <OptimizedImage
                  src={heroShot.url}
                  alt="Ring preview"
                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-background/0 group-hover:bg-background/20 transition-colors duration-200">
                  <div className="bg-background/80 backdrop-blur-sm p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Maximize2 className="h-5 w-5 text-foreground" />
                  </div>
                </div>
              </button>
            ) : isEnriching ? (
              <div className="w-full h-full animate-pulse bg-muted/50" style={{ aspectRatio: '1 / 1' }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ aspectRatio: '1 / 1' }}>
                <span className="font-mono text-[9px] tracking-wider text-muted-foreground/50 uppercase">
                  No renders available
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action bar: View 3D + Download GLB */}
        <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-sm border border-border/50 bg-muted/20 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Box className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <span className="font-mono text-[10px] tracking-wider text-foreground truncate">
              {workflow.glb_filename || (isEnriching ? '—' : 'model.glb')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {workflow.glb_url && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); setShow3D(true); }}
                className="h-7 px-2.5 font-mono text-[10px] tracking-wider uppercase gap-1"
                title="Open interactive 3D preview"
              >
                <Box className="h-3 w-3" />
                3D
              </Button>
            )}
            {workflow.glb_url ? (
              <Button
                size="sm"
                onClick={handleDownloadGlb}
                className="h-7 px-3 font-mono text-[10px] tracking-wider uppercase gap-1.5"
              >
                <Download className="h-3 w-3" />
                GLB
              </Button>
            ) : (
              <span className="font-mono text-[9px] tracking-wider text-muted-foreground/40 uppercase">
                {workflow.glb_url === undefined && isEnriching ? 'Loading…' : 'Unavailable'}
              </span>
            )}
          </div>
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

      {/* 3D preview modal — SINGLE Canvas, only when explicitly opened */}
      {show3D && workflow.glb_url && (
        <Glb3DModal
          glbUrl={workflow.glb_url}
          glbFilename={workflow.glb_filename}
          onClose={() => setShow3D(false)}
        />
      )}
    </>
  );
}

// ─── Photo / CAD-render card ────────────────────────────────────────────────

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

  const isEnriching = workflow.thumbnail_url === undefined;
  const hasThumbnail = !!workflow.thumbnail_url;

  return (
    <>
      <motion.div variants={itemVariants} className="marta-frame overflow-hidden">
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
            <div className="absolute inset-0 flex items-center justify-center bg-background/0 group-hover:bg-background/20 transition-colors duration-200">
              <div className="bg-background/80 backdrop-blur-sm p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Maximize2 className="h-5 w-5 text-foreground" />
              </div>
            </div>
          </button>
        ) : isEnriching ? (
          <div className="w-full aspect-square bg-muted/50 animate-pulse" />
        ) : (
          <div className="w-full aspect-square bg-muted/30 flex items-center justify-center">
            <span className="font-mono text-[9px] tracking-wider text-muted-foreground/40 uppercase">
              No preview
            </span>
          </div>
        )}

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
  return <PhotoCard workflow={workflow} index={index} />;
}
