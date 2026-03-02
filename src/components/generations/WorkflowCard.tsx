import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, Loader2, Camera, Box } from 'lucide-react';
import { OptimizedImage } from '@/components/ui/optimized-image';
import type { WorkflowSummary } from '@/lib/generation-history-api';
import { format } from 'date-fns';

const statusConfig: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  completed: {
    icon: <CheckCircle className="h-3 w-3" />,
    label: 'Completed',
    className: 'bg-formanova-success/10 text-formanova-success border-formanova-success/20',
  },
  failed: {
    icon: <XCircle className="h-3 w-3" />,
    label: 'Failed',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  processing: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    label: 'Processing',
    className: 'bg-formanova-warning/10 text-formanova-warning border-formanova-warning/20',
  },
  pending: {
    icon: <Clock className="h-3 w-3" />,
    label: 'Pending',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

const sourceIcon: Record<string, React.ReactNode> = {
  photo: <Camera className="h-3.5 w-3.5" />,
  cad_render: <Box className="h-3.5 w-3.5" />,
  cad_text: <Box className="h-3.5 w-3.5" />,
};

interface WorkflowCardProps {
  workflow: WorkflowSummary;
  onClick: (id: string) => void;
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ─── Text-to-CAD card (cad_text) ───────────────────────────────────────────

function CadTextCard({ workflow, onClick }: WorkflowCardProps) {
  const dateStr = workflow.created_at
    ? format(new Date(workflow.created_at), 'MMM d, yyyy · HH:mm')
    : '—';

  const shots = workflow.screenshots ?? [];
  const hasShots = shots.length > 0;

  return (
    <motion.button
      variants={itemVariants}
      onClick={() => onClick(workflow.workflow_id)}
      className="group w-full text-left marta-frame p-0 overflow-hidden transition-all duration-300 hover:border-formanova-hero-accent hover:shadow-[0_0_20px_-5px_hsl(var(--formanova-hero-accent)/0.3)] cursor-pointer"
    >
      {/* Thumbnail strip */}
      {hasShots ? (
        <div className="flex gap-1 p-3 pb-0 bg-muted/20 overflow-x-auto">
          {shots.map((shot) => (
            <div
              key={shot.angle}
              className="flex-shrink-0 w-14 h-14 bg-muted overflow-hidden rounded-sm border border-border/30 transition-all duration-200 group-hover:border-border/60"
            >
              <OptimizedImage
                src={shot.url}
                alt={shot.angle}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          ))}
        </div>
      ) : (
        /* Placeholder skeleton row while enrichment is loading */
        <div className="flex gap-1 p-3 pb-0 bg-muted/20">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-14 h-14 bg-muted/60 rounded-sm animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Card body */}
      <div className="p-5">
        {/* Title */}
        <h3 className="font-display text-lg md:text-xl uppercase tracking-wide text-foreground mb-2 transition-transform duration-300 group-hover:translate-x-1">
          Text to CAD
        </h3>

        {/* Bottom row: icon label + date */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Box className="h-3.5 w-3.5" />
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase">3D Ring Generation</span>
          </div>
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground">{dateStr}</span>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Generic card (photo, cad_render, etc.) ────────────────────────────────

export function WorkflowCard({ workflow, onClick }: WorkflowCardProps) {
  if (workflow.source_type === 'cad_text') {
    return <CadTextCard workflow={workflow} onClick={onClick} />;
  }

  const status = statusConfig[workflow.status] ?? statusConfig.pending;
  const dateStr = workflow.created_at
    ? format(new Date(workflow.created_at), 'MMM d, yyyy · HH:mm')
    : '—';

  const hasThumbnail = !!workflow.thumbnail_url;

  return (
    <motion.button
      variants={itemVariants}
      onClick={() => onClick(workflow.workflow_id)}
      className="group w-full text-left marta-frame p-0 overflow-hidden transition-all duration-300 hover:border-formanova-hero-accent hover:shadow-[0_0_20px_-5px_hsl(var(--formanova-hero-accent)/0.3)] cursor-pointer"
    >
      <div className={`flex ${hasThumbnail ? 'flex-row' : ''}`}>
        {/* Thumbnail */}
        {hasThumbnail && (
          <div className="w-24 h-24 md:w-28 md:h-28 flex-shrink-0 bg-muted overflow-hidden">
            <OptimizedImage
              src={workflow.thumbnail_url!}
              alt={workflow.name || 'Workflow preview'}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-5 md:p-6">
          {/* Top row: status + date */}
          <div className="flex items-center justify-between mb-3">
            <Badge
              variant="outline"
              className={`gap-1 text-[10px] font-mono tracking-wider uppercase ${status.className}`}
            >
              {status.icon}
              {status.label}
            </Badge>
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
              {dateStr}
            </span>
          </div>

          {/* Workflow name */}
          <h3 className="font-display text-lg md:text-xl uppercase tracking-wide text-foreground mb-1 transition-transform duration-300 group-hover:translate-x-1">
            {workflow.name || 'Untitled Workflow'}
          </h3>

          {/* Source type label */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {sourceIcon[workflow.source_type]}
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase">
              {workflow.source_type === 'photo' && 'From Photos'}
              {workflow.source_type === 'cad_render' && 'CAD Render'}
              {workflow.source_type === 'unknown' && 'Generation'}
            </span>
          </div>

          {/* Duration if completed */}
          {workflow.finished_at && workflow.created_at && (
            <p className="font-mono text-[9px] tracking-wider text-muted-foreground/60 mt-2">
              Duration:{' '}
              {Math.round(
                (new Date(workflow.finished_at).getTime() -
                  new Date(workflow.created_at).getTime()) /
                  1000,
              )}
              s
            </p>
          )}
        </div>
      </div>
    </motion.button>
  );
}
