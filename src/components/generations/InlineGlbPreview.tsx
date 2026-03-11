/**
 * InlineGlbPreview — renders a GLB model inside a drei <View> component.
 * 
 * Used with the single-canvas scissor pattern: one fixed <Canvas> with <View.Port />
 * renders all inline 3D previews. Each InlineGlbPreview registers a scissor region
 * via <View>, avoiding multiple WebGL contexts.
 *
 * - Auto-rotates (non-interactive — no OrbitControls)
 * - Lazy-loads model on first intersection (one-way: stays mounted once loaded)
 * - GPU-tier-aware lighting and material simplification
 */

import { Suspense, useRef, useEffect, useState, memo } from 'react';
import { View, PerspectiveCamera, Environment } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { getQualitySettings } from '@/lib/gpu-detect';
import { Loader2 } from 'lucide-react';

// ── Auto-rotating model — centers and scales any GLB ──

function AutoRotateModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current) return;
    const clone = scene.clone(true);
    const q = getQualitySettings();

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material;
        if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const std = mat as THREE.MeshStandardMaterial;
          std.envMapIntensity = 0.8;
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
  }, [scene]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.3;
    }
  });

  return <group ref={groupRef} />;
}

// ── Exported component ──

interface InlineGlbPreviewProps {
  glbUrl: string;
}

export const InlineGlbPreview = memo(function InlineGlbPreview({ glbUrl }: InlineGlbPreviewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const q = getQualitySettings();

  // One-way intersection: once visible → load model, never unload
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          obs.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full bg-muted/30"
      style={{ aspectRatio: '1 / 1' }}
    >
      {/* Spinner visible until 3D scene renders on top (canvas is transparent) */}
      {!shouldLoad && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* drei View — registers a scissor region with the shared Canvas */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        {shouldLoad && (
          <Suspense fallback={null}>
            <PerspectiveCamera makeDefault fov={35} near={0.1} far={100} position={[0, 1.5, 5]} />
            <ambientLight intensity={0.15} />
            <directionalLight position={[3, 5, 3]} intensity={2.0} />
            {q.tier !== 'low' && <hemisphereLight args={['#ffffff', '#e6e6e6', 0.5]} />}
            {q.tier !== 'low' && <Environment files="/hdri/jewelry-studio-v2.hdr" />}
            <AutoRotateModel url={glbUrl} />
          </Suspense>
        )}
      </View>
    </div>
  );
});
