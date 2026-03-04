import React, { useEffect, useState, useCallback } from 'react';
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
import { WorkflowSection, SectionIcons } from '@/components/generations/WorkflowSection';
import { azureUriToUrl } from '@/components/generations/CadWorkflowModal';

const PER_PAGE = 10;

type SourceType = 'photo' | 'cad_render' | 'cad_text';

interface SectionState {
  workflows: WorkflowSummary[];
  page: number;
  totalPages: number;
  loading: boolean;
}

const defaultSection = (): SectionState => ({
  workflows: [],
  page: 1,
  totalPages: 1,
  loading: true,
});

export default function Generations() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // All workflows fetched from API (we paginate client-side per section)
  const [allWorkflows, setAllWorkflows] = useState<WorkflowSummary[]>([]);
  const [globalLoading, setGlobalLoading] = useState(true);

  // Per-section pagination state
  const [photoPage, setPhotoPage] = useState(1);
  const [cadRenderPage, setCadRenderPage] = useState(1);
  const [cadTextPage, setCadTextPage] = useState(1);

  // Fetch all workflows once
  useEffect(() => {
    if (!user) return;

    // Run at most CONCURRENCY detail-fetches at a time to avoid nginx rate-limit 503s
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

    const fetchAll = async () => {
      try {
        setGlobalLoading(true);
        const workflows = await listMyWorkflows(100, 0);
        console.log('[Generations] workflows:', workflows.map(w => ({ name: w.name, status: w.status, source_type: w.source_type })));
        setAllWorkflows(workflows);

        // Helper: recursively find first azure:// URI in any object or array
        const findAzureUri = (obj: unknown): string | null => {
          if (typeof obj === 'string' && obj.startsWith('azure://')) return obj;
          if (Array.isArray(obj)) {
            for (const item of obj) { const f = findAzureUri(item); if (f) return f; }
          } else if (obj && typeof obj === 'object') {
            for (const v of Object.values(obj as Record<string, unknown>)) {
              const found = findAzureUri(v);
              if (found) return found;
            }
          }
          return null;
        };

        // For photo workflows: match azure:// URIs, snapwear blob URLs, or HTTPS image URLs
        const findImageUrl = (obj: unknown): string | null => {
          if (typeof obj === 'string') {
            if (obj.startsWith('azure://')) return obj;
            if (obj.startsWith('https://') && (
              obj.includes('snapwear.blob.core.windows.net') ||
              obj.includes('blob.core.windows.net') ||
              /\.(jpe?g|png|webp)(\?.*)?$/i.test(obj)
            )) return obj;
          }
          if (Array.isArray(obj)) {
            for (const item of obj) { const f = findImageUrl(item); if (f) return f; }
          } else if (obj && typeof obj === 'object') {
            for (const v of Object.values(obj as Record<string, unknown>)) {
              const found = findImageUrl(v);
              if (found) return found;
            }
          }
          return null;
        };

        // Enrich completed photo/cad_render workflows: extract thumbnail from generate_jewelry_image step
        const photoCompleted = workflows.filter(
          (w) => (w.source_type === 'photo' || w.source_type === 'cad_render') && w.status === 'completed'
        );
        if (photoCompleted.length > 0) {
          const photoIds = new Set(photoCompleted.map((wf) => wf.workflow_id));
          batchSettled(
            photoCompleted.map((wf) => async () => {
              try {
                const details = await getWorkflowDetails(wf.workflow_id);
                const steps = details.steps ?? [];
                console.log(`[Generations] photo ${wf.workflow_id} steps:`, steps.map(s => s.tool));
                let thumbnail_url: string | null = null;

                // Target generate_jewelry_image step specifically — never fall back to other steps
                // to avoid picking up the input jewelry/model images from prepare_jewelry_request.
                const genStep = steps.find((s) => s.tool === 'generate_jewelry_image');
                if (genStep?.output) {
                  const out = genStep.output as any;
                  // output_url may be top-level or nested under result
                  const outputUrl: string | undefined = out?.output_url ?? out?.result?.output_url;
                  if (typeof outputUrl === 'string' && outputUrl.startsWith('https://')) {
                    thumbnail_url = outputUrl;
                  }
                  // Fallback: image_b64 as data URI (covers case where output_url is missing/expired)
                  if (!thumbnail_url) {
                    const b64: string | undefined = out?.image_b64 ?? out?.result?.image_b64;
                    const mime: string = out?.mime_type ?? out?.result?.mime_type ?? 'image/jpeg';
                    if (b64) thumbnail_url = `data:${mime};base64,${b64}`;
                  }
                  // Last resort: find any azure:// or blob URL within this step's output only
                  if (!thumbnail_url) {
                    const uri = findImageUrl(genStep.output);
                    if (uri) thumbnail_url = azureUriToUrl(uri);
                  }
                }

                console.log(`[Generations] photo ${wf.workflow_id} thumbnail:`, thumbnail_url);
                return { id: wf.workflow_id, thumbnail_url: thumbnail_url ?? '' };
              } catch (e) {
                console.warn('[Generations] photo detail fetch failed:', wf.workflow_id, e);
              }
              return { id: wf.workflow_id, thumbnail_url: '' };
            })
          ).then((results) => {
            const enrichMap = new Map<string, string>();
            for (const r of results) {
              if (r.status === 'fulfilled' && r.value) {
                enrichMap.set(r.value.id, r.value.thumbnail_url);
              }
            }
            // Always update — even with empty results — so cards stop pulsing
            setAllWorkflows((prev) =>
              prev.map((w) => {
                if (!photoIds.has(w.workflow_id)) return w;
                const url = enrichMap.get(w.workflow_id);
                return { ...w, thumbnail_url: url ?? '' };
              })
            );
          });
        }

        // Enrich completed cad_text workflows: screenshots + GLB url/filename
        const cadTextCompleted = workflows.filter(
          (w) => w.source_type === 'cad_text' && w.status === 'completed'
        );
        if (cadTextCompleted.length > 0) {
          const cadTextIds = new Set(cadTextCompleted.map((wf) => wf.workflow_id));
          batchSettled(
            cadTextCompleted.map((wf) => async () => {
              try {
                const details = await getWorkflowDetails(wf.workflow_id);
                const steps = details.steps ?? [];
                console.debug(`[Generations] cadText workflow ${wf.workflow_id} has ${steps.length} steps:`, steps.map(s => s.tool));

                // Screenshots — try multiple step/field names
                // Screenshot objects: actual DB shape is {name, data_uri: {uri: "azure://..."}}
                // Also handle legacy shapes: {angle, url}, {angle, uri}
                const screenshotStep = steps.find((s) =>
                  s.tool === 'ring-screenshot' || s.tool === 'screenshot' || s.tool === 'ring_screenshot'
                );
                const rawShots = (screenshotStep?.output?.screenshots ?? screenshotStep?.output?.images) as any[] | undefined;
                let screenshots: { angle: string; url: string }[] = [];
                if (rawShots?.length) {
                  screenshots = rawShots
                    .map((s: any) => {
                      // Angle: try 'name' (actual DB) then 'angle' (legacy)
                      const angle = (s.name as string) || (s.angle as string) || 'unknown';
                      // URL: try data_uri.uri (actual DB) then url/uri (legacy)
                      const rawUri: string | undefined = s?.data_uri?.uri ?? s?.url ?? s?.uri;
                      if (rawUri) return { angle, url: azureUriToUrl(rawUri) };
                      // Deep fallback: find any azure:// URI in the object
                      const uri = findAzureUri(s);
                      return uri ? { angle, url: azureUriToUrl(uri) } : null;
                    })
                    .filter((s): s is { angle: string; url: string } => !!s?.url);
                }
                const front = screenshots.find(s => s.angle === 'front') ?? screenshots[0];
                console.debug(`[Generations] cadText ${wf.workflow_id} screenshots:`, screenshots.length, 'front:', front?.url);

                // GLB — primary: look for glb_path field (known working structure)
                const validateStep = steps.find((s) => s.tool === 'ring-validate' || s.tool === 'ring_validate');
                const generateStep = steps.find((s) => s.tool === 'ring-generate' || s.tool === 'ring_generate' || s.tool === 'generate');
                const glbStep = validateStep || generateStep;
                let glb_url: string | null = null;
                let glb_filename: string | null = null;
                if (glbStep?.output?.glb_path) {
                  const glbPath = glbStep.output.glb_path as any;
                  const uri = typeof glbPath === 'string' ? glbPath : glbPath?.uri;
                  if (uri) {
                    glb_url = azureUriToUrl(uri);
                    const parts = (uri as string).split('/');
                    glb_filename = parts[parts.length - 1] || 'model.glb';
                  }
                }
                // Fallback: recursive azure URI search in glb step output
                if (!glb_url && glbStep?.output) {
                  const uri = findAzureUri(glbStep.output);
                  if (uri) {
                    glb_url = azureUriToUrl(uri);
                    const parts = uri.split('/');
                    glb_filename = parts[parts.length - 1] || 'model.glb';
                  }
                }
                // Last resort: scan ALL steps for a .glb URI
                if (!glb_url) {
                  for (const step of steps) {
                    const uri = findAzureUri(step.output);
                    if (uri && uri.includes('.glb')) {
                      glb_url = azureUriToUrl(uri);
                      const parts = uri.split('/');
                      glb_filename = parts[parts.length - 1] || 'model.glb';
                      break;
                    }
                  }
                }
                console.debug(`[Generations] cadText ${wf.workflow_id} glb:`, glb_url);

                return { id: wf.workflow_id, thumbnail_url: front?.url ?? '', screenshots, glb_url, glb_filename };
              } catch (e) {
                console.warn('[Generations] cadText detail fetch failed:', wf.workflow_id, e);
              }
              return { id: wf.workflow_id, thumbnail_url: '', screenshots: [] as { angle: string; url: string }[], glb_url: null, glb_filename: null };
            })
          ).then((results) => {
            const enrichMap = new Map<string, { thumbnail_url: string; screenshots: { angle: string; url: string }[]; glb_url: string | null; glb_filename: string | null }>();
            for (const r of results) {
              if (r.status === 'fulfilled' && r.value) {
                enrichMap.set(r.value.id, r.value);
              }
            }
            // Always update — even with empty results — so cards stop pulsing
            setAllWorkflows((prev) =>
              prev.map((w) => {
                if (!cadTextIds.has(w.workflow_id)) return w;
                const e = enrichMap.get(w.workflow_id);
                if (e) {
                  return { ...w, thumbnail_url: e.thumbnail_url, screenshots: e.screenshots, glb_url: e.glb_url, glb_filename: e.glb_filename };
                }
                return { ...w, screenshots: [], glb_url: null, glb_filename: null };
              })
            );
          });
        }
      } catch (err: any) {
        console.error('[Generations] fetch error:', err);
        if (err.name !== 'AuthExpiredError') {
          setError('Could not load your generation history. Please try again.');
        }
      } finally {
        setGlobalLoading(false);
      }
    };

    fetchAll();
  }, [user]);

  // Filter & paginate per section
  const getSection = useCallback(
    (source: SourceType, page: number): SectionState => {
      const filtered = allWorkflows.filter((w) => w.source_type === source && w.status === 'completed');
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

  const photoSection = getSection('photo', photoPage);
  const cadRenderSection = getSection('cad_render', cadRenderPage);
  const cadTextSection = getSection('cad_text', cadTextPage);

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background py-6 px-6 md:px-12 lg:px-16">
      <div className="max-w-7xl mx-auto">
        {/* Header — Marta style, matches Dashboard/Studio */}
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
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl uppercase tracking-wide text-foreground leading-none">
              From Photo
            </h1>
          </div>
          <p className="hidden md:block font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
            Your workflow history
          </p>
        </motion.div>

        {/* Error state */}
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
            {/* Section: From Photos */}
            <WorkflowSection
              title="From Photo"
              subtitle="Jewelry photo to on-model imagery"
              icon={SectionIcons.photo}
              workflows={photoSection.workflows}
              loading={photoSection.loading}
              currentPage={photoSection.page}
              totalPages={photoSection.totalPages}
              columns={4}
              onPageChange={setPhotoPage}
              onWorkflowClick={() => {}}
            />

            {/* Section: CAD Render */}
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

            {/* Section: Text to CAD */}
            <WorkflowSection
              title="Text to CAD"
              subtitle="AI-generated 3D models from text"
              icon={SectionIcons.cadText}
              workflows={cadTextSection.workflows}
              loading={cadTextSection.loading}
              currentPage={cadTextSection.page}
              totalPages={cadTextSection.totalPages}
              indexOffset={(cadTextPage - 1) * PER_PAGE}
              onPageChange={setCadTextPage}
              onWorkflowClick={() => {}}
            />
          </>
        )}
      </div>

    </div>
  );
}
