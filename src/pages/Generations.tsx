import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  listMyWorkflows,
  getWorkflowDetails,
  fetchWorkflowCreditAudit,
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
  concurrency = 5,
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
    const controller = new AbortController();
    const safetyTimeout = setTimeout(() => {
      console.warn('[Generations] Safety timeout — forcing loading off');
      setGlobalLoading(false);
      if (!cached) setError('Request timed out. Please try again.');
      controller.abort();
    }, 15000);

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
        clearTimeout(safetyTimeout);
        setGlobalLoading(false);
      }
    })();

    return () => { clearTimeout(safetyTimeout); controller.abort(); };
  }, [user]);

  // ── Pagination helper ─────────────────────────────────────────────
    const getSection = useCallback(
    (source: SourceType, page: number, requireImage = false): SectionState => {
      const statusOk = source === 'cad_text'
        ? (w: WorkflowSummary) => w.status === 'completed' || w.status === 'failed'
        : (w: WorkflowSummary) => w.status === 'completed';
      const filtered = allWorkflows.filter((w) => {
        if (w.source_type !== source || !statusOk(w)) return false;
        // Skip photo/cad_render cards that enriched but have no thumbnail
        if (requireImage && w.thumbnail_url === '') return false;
        // Skip cad_text cards that enriched but have no GLB
        if (source === 'cad_text' && w.glb_url !== undefined && !w.glb_url && w.thumbnail_url !== undefined) return false;
        return true;
      });
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

    // Enrich photo & cad_render — stream results as they arrive
    if (photoAndCadRender.length > 0) {
      for (const wf of photoAndCadRender) {
        (async () => {
          try {
            const details = await getWorkflowDetails(wf.workflow_id);
            const thumbnail_url = extractPhotoThumbnail(details.steps ?? []);
            if (thumbnail_url) preloadImage(thumbnail_url);
            const data = { thumbnail_url: thumbnail_url ?? '' };
            enrichedRef.current[wf.workflow_id] = data;
            setAllWorkflows(prev =>
              prev.map(w => w.workflow_id === wf.workflow_id ? { ...w, ...data } : w)
            );
            saveCache(allWorkflows, enrichedRef.current);
          } catch (e) {
            console.warn('[Generations] photo detail fetch failed:', wf.workflow_id, e);
            enrichedRef.current[wf.workflow_id] = { thumbnail_url: '' };
            setAllWorkflows(prev =>
              prev.map(w => w.workflow_id === wf.workflow_id ? { ...w, thumbnail_url: '' } : w)
            );
          }
        })();
      }
    }

    // Enrich cad_text — stream results as they arrive
    if (cadTextItems.length > 0) {
      for (const wf of cadTextItems) {
        (async () => {
          try {
            const details = await getWorkflowDetails(wf.workflow_id);
            const data = extractCadTextData(details.steps ?? []);
            enrichedRef.current[wf.workflow_id] = data;
            setAllWorkflows(prev =>
              prev.map(w => w.workflow_id === wf.workflow_id ? { ...w, ...data } : w)
            );
            saveCache(allWorkflows, enrichedRef.current);
          } catch (e) {
            console.warn('[Generations] cadText detail fetch failed:', wf.workflow_id, e);
            const fallback = { thumbnail_url: '', screenshots: [] as { angle: string; url: string }[], glb_url: null, glb_filename: null };
            enrichedRef.current[wf.workflow_id] = fallback;
            setAllWorkflows(prev =>
              prev.map(w => w.workflow_id === wf.workflow_id ? { ...w, ...fallback } : w)
            );
          }
        })();
      }
    }
  }, [allWorkflows.length, globalLoading]);

  // ── Step 3: Fetch credit audit for each completed workflow ────────
  const auditFetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (globalLoading || allWorkflows.length === 0) return;

    const needsAudit = allWorkflows.filter(
      w => w.credits_spent === undefined &&
           !auditFetchedRef.current.has(w.workflow_id) &&
           (w.status === 'completed' || w.status === 'failed')
    );

    if (needsAudit.length === 0) return;

    // Mark to prevent duplicate fetches
    needsAudit.forEach(w => auditFetchedRef.current.add(w.workflow_id));

    batchSettled(
      needsAudit.map(wf => async () => {
        const credits = await fetchWorkflowCreditAudit(wf.workflow_id);
        return { id: wf.workflow_id, credits_spent: credits };
      }),
      5, // higher concurrency for lightweight audit calls
    ).then(results => {
      const updates: Record<string, number | null> = {};
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          updates[r.value.id] = r.value.credits_spent;
        }
      }
      if (Object.keys(updates).length === 0) return;

      setAllWorkflows(prev =>
        prev.map(w => updates[w.workflow_id] !== undefined
          ? { ...w, credits_spent: updates[w.workflow_id] }
          : w
        )
      );
    });
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
              title="Photo Studio"
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

          </>
        )}
      </div>
    </div>
  );
}
