import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  listMyWorkflows,
  getWorkflowDetails,
  type WorkflowSummary,
} from '@/lib/generation-history-api';
import { extractPhotoThumbnail, extractCadTextData } from '@/lib/generation-enrichment';
import { WorkflowSection, SectionIcons } from '@/components/generations/WorkflowSection';
import { ScissorGLBGrid } from '@/components/generations/ScissorGLBGrid';

const PER_PAGE = 5;
const CACHE_KEY = 'formanova_gen_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type SourceType = 'photo' | 'cad_render' | 'cad_text';

interface SectionState {
  workflows: WorkflowSummary[];
  page: number;
  totalPages: number;
  loading: boolean;
}

// ── SessionStorage cache helpers ─────────────────────────────────────

interface CachePayload {
  workflows: WorkflowSummary[];
  enriched: Record<string, Partial<WorkflowSummary>>;
  ts: number;
}

function loadCache(): CachePayload | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachePayload = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function saveCache(workflows: WorkflowSummary[], enriched: Record<string, Partial<WorkflowSummary>>) {
  try {
    const payload: CachePayload = { workflows, enriched, ts: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch { /* quota exceeded — ignore */ }
}

/** Preload an image into browser cache */
function preloadImage(url: string) {
  if (!url || url.startsWith('data:')) return;
  const img = new Image();
  img.src = url;
}

async function batchSettled<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 3,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency).map((t) => t());
    results.push(...(await Promise.allSettled(batch)));
  }
  return results;
}

// ── Component ────────────────────────────────────────────────────────

export default function Generations() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const [allWorkflows, setAllWorkflows] = useState<WorkflowSummary[]>([]);
  const [globalLoading, setGlobalLoading] = useState(true);

  const [photoPage, setPhotoPage] = useState(1);
  const [cadRenderPage, setCadRenderPage] = useState(1);
  const [cadTextPage, setCadTextPage] = useState(1);

  // Track enriched IDs + their data for sessionStorage persistence
  const enrichedRef = useRef<Record<string, Partial<WorkflowSummary>>>({});

  // ── Step 1: Fetch workflow list — use cache for instant load ──────
  useEffect(() => {
    if (!user) return;

    // Try cache first for instant render
    const cached = loadCache();
    if (cached) {
      // Apply cached enrichment data on top of workflow list
      const hydrated = cached.workflows.map(w => {
        const e = cached.enriched[w.workflow_id];
        return e ? { ...w, ...e } : w;
      });
      setAllWorkflows(hydrated);
      enrichedRef.current = cached.enriched;
      // Preload all cached thumbnail images into browser cache
      Object.values(cached.enriched).forEach(e => {
        if (e.thumbnail_url) preloadImage(e.thumbnail_url);
      });
      setGlobalLoading(false);
      if (import.meta.env.DEV) console.log('[Generations] loaded from cache:', cached.workflows.length, 'workflows');
    }

    // Always fetch fresh in background
    (async () => {
      try {
        if (!cached) setGlobalLoading(true);
        const rawWorkflows = await listMyWorkflows(100, 0);
        // Filter out unknown source types — these are not meaningful to the user
        const workflows = rawWorkflows.filter(w => w.source_type !== 'unknown');
        if (import.meta.env.DEV) console.log('[Generations] fetched:', rawWorkflows.length, '→ valid:', workflows.length);

        // Re-apply any previously enriched data so thumbnails don't flash
        const merged = workflows.map(w => {
          const e = enrichedRef.current[w.workflow_id];
          return e ? { ...w, ...e } : w;
        });
        setAllWorkflows(merged);
        saveCache(workflows, enrichedRef.current);
      } catch (err: any) {
        console.error('[Generations] fetch error:', err);
        if (err.name !== 'AuthExpiredError' && !cached) {
          setError('Could not load your generation history. Please try again.');
        }
      } finally {
        setGlobalLoading(false);
      }
    })();
  }, [user]);

  // ── Pagination helper ─────────────────────────────────────────────
  const getSection = useCallback(
    (source: SourceType, page: number, requireImage = false): SectionState => {
      const statusOk = source === 'cad_text'
        ? (w: WorkflowSummary) => w.status === 'completed' || w.status === 'failed'
        : (w: WorkflowSummary) => w.status === 'completed';
      const filtered = allWorkflows.filter(
        (w) =>
          w.source_type === source &&
          statusOk(w) &&
          (!requireImage || w.thumbnail_url !== ''),
      );
      const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
      const start = (page - 1) * PER_PAGE;
      return {
        workflows: filtered.slice(start, start + PER_PAGE),
        page,
        totalPages,
        loading: globalLoading,
      };
    },
    [allWorkflows, globalLoading],
  );

  // ── Step 2: Enrich ALL workflows eagerly — not just the visible page
  useEffect(() => {
    if (globalLoading || allWorkflows.length === 0) return;

    // Gather all un-enriched workflows across all sections
    const allUnenriched = allWorkflows.filter(
      w => w.thumbnail_url === undefined && !enrichedRef.current[w.workflow_id] &&
           (w.status === 'completed' || (w.source_type === 'cad_text' && w.status === 'failed'))
    );

    if (allUnenriched.length === 0) return;

    const photoAndCadRender = allUnenriched.filter(w => w.source_type === 'photo' || w.source_type === 'cad_render');
    const cadTextItems = allUnenriched.filter(w => w.source_type === 'cad_text');

    // Mark immediately to prevent duplicate fetches
    allUnenriched.forEach(w => {
      enrichedRef.current[w.workflow_id] = {};
    });

    // Enrich photo & cad_render
    if (photoAndCadRender.length > 0) {
      const ids = new Set(photoAndCadRender.map(w => w.workflow_id));
      batchSettled(
        photoAndCadRender.map(wf => async () => {
          try {
            const details = await getWorkflowDetails(wf.workflow_id);
            const thumbnail_url = extractPhotoThumbnail(details.steps ?? []);
            if (thumbnail_url) preloadImage(thumbnail_url);
            return { id: wf.workflow_id, thumbnail_url: thumbnail_url ?? '' };
          } catch (e) {
            console.warn('[Generations] photo detail fetch failed:', wf.workflow_id, e);
            return { id: wf.workflow_id, thumbnail_url: '' };
          }
        })
      ).then(results => {
        const updates: Record<string, Partial<WorkflowSummary>> = {};
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            updates[r.value.id] = { thumbnail_url: r.value.thumbnail_url };
            enrichedRef.current[r.value.id] = updates[r.value.id];
          }
        }
        setAllWorkflows(prev =>
          prev.map(w => ids.has(w.workflow_id) && updates[w.workflow_id]
            ? { ...w, ...updates[w.workflow_id] }
            : w
          )
        );
        saveCache(allWorkflows, enrichedRef.current);
      });
    }

    // Enrich cad_text
    if (cadTextItems.length > 0) {
      const ids = new Set(cadTextItems.map(w => w.workflow_id));
      batchSettled(
        cadTextItems.map(wf => async () => {
          try {
            const details = await getWorkflowDetails(wf.workflow_id);
            return { id: wf.workflow_id, ...extractCadTextData(details.steps ?? []) };
          } catch (e) {
            console.warn('[Generations] cadText detail fetch failed:', wf.workflow_id, e);
            return { id: wf.workflow_id, thumbnail_url: '', screenshots: [] as { angle: string; url: string }[], glb_url: null, glb_filename: null };
          }
        })
      ).then(results => {
        const updates: Record<string, Partial<WorkflowSummary>> = {};
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            const { id, ...data } = r.value;
            updates[id] = data;
            enrichedRef.current[id] = data;
          }
        }
        setAllWorkflows(prev =>
          prev.map(w => ids.has(w.workflow_id) && updates[w.workflow_id]
            ? { ...w, ...updates[w.workflow_id] }
            : w
          )
        );
        saveCache(allWorkflows, enrichedRef.current);
      });
    }
  }, [allWorkflows.length, globalLoading]);

  const photoSection = getSection('photo', photoPage, true);
  const cadRenderSection = getSection('cad_render', cadRenderPage, true);
  const cadTextSection = getSection('cad_text', cadTextPage);

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background py-6 px-6 md:px-12 lg:px-16">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex items-end justify-between"
        >
          <div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-3 w-3" />
              Dashboard
            </Link>
          </div>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="marta-frame p-8 flex flex-col items-center justify-center text-center mb-10"
          >
            <AlertCircle className="h-8 w-8 text-destructive mb-3" />
            <p className="font-mono text-[11px] tracking-wider text-destructive mb-4">
              {error}
            </p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="font-mono text-[10px] tracking-wider uppercase"
            >
              Retry
            </Button>
          </motion.div>
        )}

        {!error && (
          <>
            <WorkflowSection
              title="From Photo"
              subtitle="Jewelry photo to on-model imagery"
              icon={SectionIcons.photo}
              workflows={photoSection.workflows}
              loading={photoSection.loading}
              currentPage={photoSection.page}
              totalPages={photoSection.totalPages}
              columns={5}
              onPageChange={setPhotoPage}
              onWorkflowClick={() => {}}
            />

            <ScissorGLBGrid>
              <WorkflowSection
                title="Text to CAD"
                subtitle="AI-generated 3D models from text"
                icon={SectionIcons.cadText}
                workflows={cadTextSection.workflows}
                loading={cadTextSection.loading}
                currentPage={cadTextSection.page}
                totalPages={cadTextSection.totalPages}
                columns={3}
                indexOffset={(cadTextPage - 1) * PER_PAGE}
                onPageChange={setCadTextPage}
                onWorkflowClick={() => {}}
              />
            </ScissorGLBGrid>

            <WorkflowSection
              title="From CAD"
              subtitle="3D CAD to photorealistic catalog"
              icon={SectionIcons.cadRender}
              workflows={cadRenderSection.workflows}
              loading={cadRenderSection.loading}
              currentPage={cadRenderSection.page}
              totalPages={cadRenderSection.totalPages}
              columns={4}
              onPageChange={setCadRenderPage}
              onWorkflowClick={() => {}}
            />
          </>
        )}
      </div>
    </div>
  );
}
