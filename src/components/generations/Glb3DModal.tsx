import { Suspense, useRef, useEffect, memo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Download, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getQualitySettings } from '@/lib/gpu-detect';

// ── Inline GLB model (single instance) ──
function PreviewModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const { invalidate } = useThree();

  useEffect(() => {
    if (!groupRef.current) return;
    const clone = scene.clone(true);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material;
        if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const std = mat as THREE.MeshStandardMaterial;
          std.envMapIntensity = 0.8;
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

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.3;
    }
  });

  return <group ref={groupRef} />;
}

const ModalCanvas = memo(function ModalCanvas({ glbUrl }: { glbUrl: string }) {
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
        {q.tier !== 'low' && <hemisphereLight args={['#ffffff', '#e6e6e6', 0.5]} />}
        {q.tier !== 'low' && <Environment files="/hdri/jewelry-studio-v2.hdr" />}
        <PreviewModel url={glbUrl} />
        <OrbitControls enablePan={false} enableZoom enableDamping dampingFactor={0.05} minDistance={2} maxDistance={12} />
      </Suspense>
    </Canvas>
  );
});

interface Glb3DModalProps {
  glbUrl: string;
  glbFilename?: string | null;
  onClose: () => void;
}

export function Glb3DModal({ glbUrl, glbFilename, onClose }: Glb3DModalProps) {
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = glbUrl;
    a.download = glbFilename || 'model.glb';
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-[90vw] max-w-[560px] bg-background border border-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 bg-background/80 backdrop-blur-sm border border-border hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-foreground" />
        </button>

        {/* 3D viewport — single Canvas */}
        <div className="w-full aspect-square bg-muted/30">
          <ModalCanvas glbUrl={glbUrl} />
        </div>

        {/* Download bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground truncate">
            {glbFilename || 'model.glb'}
          </span>
          <Button
            size="sm"
            onClick={handleDownload}
            className="h-7 px-3 font-mono text-[10px] tracking-wider uppercase gap-1.5"
          >
            <Download className="h-3 w-3" />
            Download GLB
          </Button>
        </div>
      </div>
    </div>
  );
}
