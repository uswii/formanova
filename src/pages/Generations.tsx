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

    const fetchAll = async () => {
      try {
        setGlobalLoading(true);
        const workflows = await listMyWorkflows(100, 0);
        setAllWorkflows(workflows);

        // Enrich completed cad_text workflows: screenshots + GLB url/filename
        const cadTextCompleted = workflows.filter(
          (w) => w.source_type === 'cad_text' && w.status === 'completed'
        );
        if (cadTextCompleted.length > 0) {
          Promise.allSettled(
            cadTextCompleted.map(async (wf) => {
              try {
                const details = await getWorkflowDetails(wf.workflow_id);

                // Recursively find any azure:// URI inside any object, regardless of key name.
                // normalise_payload converts binaries to { uri: "azure://...", sha256, type, bytes }
                // so the actual URI may be nested under any field (e.g. "image", "data", "file", etc.)
                const findAzureUri = (obj: unknown): string | null => {
                  if (typeof obj === 'string' && obj.startsWith('azure://')) return obj;
                  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                    for (const v of Object.values(obj as Record<string, unknown>)) {
                      const found = findAzureUri(v);
                      if (found) return found;
                    }
                  }
                  return null;
                };

                // Screenshots
                const screenshotStep = details.steps?.find((s) => s.tool === 'ring-screenshot');
                const rawShots = screenshotStep?.output?.screenshots as Record<string, unknown>[] | undefined;
                const screenshots = (rawShots ?? [])
                  .map((s) => {
                    const angle = (s.angle as string) || 'unknown';
                    const uri = findAzureUri(s);
                    return uri ? { angle, url: azureUriToUrl(uri) } : null;
                  })
                  .filter(Boolean) as { angle: string; url: string }[];
                const front = screenshots.find(s => s.angle === 'front') ?? screenshots[0];

                // GLB — recursively find azure URI anywhere in the glb step output
                const validateStep = details.steps?.find((s) => s.tool === 'ring-validate');
                const generateStep = details.steps?.find((s) => s.tool === 'ring-generate');
                const glbStep = validateStep || generateStep;
                let glb_url: string | null = null;
                let glb_filename: string | null = null;
                if (glbStep?.output) {
                  const uri = findAzureUri(glbStep.output);
                  if (uri) {
                    glb_url = azureUriToUrl(uri);
                    const parts = uri.split('/');
                    glb_filename = parts[parts.length - 1] || 'model.glb';
                  }
                }

                return { id: wf.workflow_id, thumbnail_url: front?.url ?? '', screenshots, glb_url, glb_filename };
              } catch { /* ignore individual failures */ }
              return null;
            })
          ).then((results) => {
            const enrichMap = new Map<string, { thumbnail_url: string; screenshots: { angle: string; url: string }[]; glb_url: string | null; glb_filename: string | null }>();
            for (const r of results) {
              if (r.status === 'fulfilled' && r.value) {
                enrichMap.set(r.value.id, r.value);
              }
            }
            if (enrichMap.size > 0) {
              setAllWorkflows((prev) =>
                prev.map((w) => {
                  const e = enrichMap.get(w.workflow_id);
                  return e ? { ...w, thumbnail_url: e.thumbnail_url, screenshots: e.screenshots, glb_url: e.glb_url, glb_filename: e.glb_filename } : w;
                })
              );
            }
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
