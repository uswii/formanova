import { Suspense, useState, useCallback, useRef, useEffect, memo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Download, Box, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { getQualitySettings } from '@/lib/gpu-detect';
import type { WorkflowSummary } from '@/lib/generation-history-api';

const MODEL_LABELS: Record<string, string> = {
  gemini: 'Lite',
  'claude-sonnet': 'Standard',
  'claude-opus': 'Premium',
  lite: 'Lite',
  standard: 'Standard',
  premium: 'Premium',
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ── Lazy visibility hook — only mount Canvas when card scrolls into view ──
function useInView(ref: React.RefObject<HTMLElement | null>, rootMargin = '200px') {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

// ── Inline GLB model renderer (demand-driven frame loop) ──
function PreviewModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const { invalidate } = useThree();

  useEffect(() => {
    if (!groupRef.current) return;
    const clone = scene.clone(true);

    // Simplify materials for performance: disable expensive maps
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material;
        if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const std = mat as THREE.MeshStandardMaterial;
          std.envMapIntensity = 0.8;
          // Drop normal/AO maps on low-end to save GPU
          const q = getQualitySettings();
          if (q.tier === 'low') {
            std.normalMap = null;
            std.aoMap = null;
          }
        }
      }
    });

    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.5 / maxDim;

    groupRef.current.clear();
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    groupRef.current.add(clone);
    invalidate();
  }, [scene, invalidate]);

  // Slow auto-rotate, request re-render only when rotating
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.3;
    }
  });

  return <group ref={groupRef} />;
}

// ── Memoised Canvas wrapper — avoids re-creating WebGL context on parent re-renders ──
const PreviewCanvas = memo(function PreviewCanvas({ glbUrl }: { glbUrl: string }) {
  const q = getQualitySettings();

  return (
    <Canvas
      frameloop="always"
      gl={{
        antialias: q.antialias,
        alpha: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
        powerPreference: q.tier === 'low' ? 'low-power' : 'default',
        // Limit pixel buffer size on weak GPUs
        ...(q.tier === 'low' ? { precision: 'mediump' as const } : {}),
      }}
      dpr={q.dpr}
      camera={{ fov: 35, near: 0.1, far: 100, position: [0, 1.5, 5] }}
      style={{ width: '100%', height: '100%' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.15} />
        <directionalLight position={[3, 5, 3]} intensity={2.0} />
        {q.tier !== 'low' && (
          <hemisphereLight args={['#ffffff', '#e6e6e6', 0.5]} />
        )}
        {q.tier !== 'low' && (
          <Environment files="/hdri/jewelry-studio-v2.hdr" />
        )}
        <PreviewModel url={glbUrl} />
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableDamping
          dampingFactor={0.05}
          minDistance={2}
          maxDistance={12}
        />
      </Suspense>
    </Canvas>
  );
});

interface GlbPreviewCardProps {
  workflow: WorkflowSummary;
  index: number;
}

export function GlbPreviewCard({ workflow, index }: GlbPreviewCardProps) {
  const [modelError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useInView(containerRef);

  const dateStr = workflow.created_at
    ? format(new Date(workflow.created_at), 'MMM d, yyyy · HH:mm')
    : '—';

  const isEnriching = workflow.glb_url === undefined && workflow.screenshots === undefined;

  const modelLabel = workflow.mode
    ? MODEL_LABELS[workflow.mode.toLowerCase()] ?? workflow.mode
    : workflow.ai_model
      ? MODEL_LABELS[workflow.ai_model] ?? workflow.ai_model
      : null;

  const handleDownloadGlb = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!workflow.glb_url) return;
    const a = document.createElement('a');
    a.href = workflow.glb_url;
    a.download = workflow.glb_filename || 'model.glb';
    a.target = '_blank';
    a.click();
  }, [workflow.glb_url, workflow.glb_filename]);

  return (
    <motion.div variants={itemVariants} className="marta-frame overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
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

      {/* 3D WebGL Preview — 512×512, lazy-loaded */}
      <div className="mx-4 mb-3" ref={containerRef}>
        <div
          className="w-full bg-muted/30 border border-border/50 rounded-sm overflow-hidden"
          style={{ aspectRatio: '1 / 1', maxWidth: 512, maxHeight: 512 }}
        >
          {workflow.glb_url && !modelError && isVisible ? (
            <PreviewCanvas glbUrl={workflow.glb_url} />
          ) : workflow.glb_url && !modelError && !isVisible ? (
            /* Placeholder before intersection — prevents WebGL context creation */
            <div className="w-full h-full flex items-center justify-center" style={{ aspectRatio: '1 / 1' }}>
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            </div>
          ) : isEnriching ? (
            <div className="w-full h-full flex items-center justify-center" style={{ aspectRatio: '1 / 1' }}>
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ aspectRatio: '1 / 1' }}>
              <span className="font-mono text-[9px] tracking-wider text-muted-foreground/50 uppercase">
                No 3D model available
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Download bar */}
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
  );
}
