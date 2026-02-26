import { useRef, useCallback, Suspense, useEffect, useMemo } from "react";
import { Canvas, useThree, ThreeEvent } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import type { MaterialDef } from "./materials";
import { getQualitySettings } from "@/lib/gpu-detect";

// ── Quality settings (cached, runs once) ──
const Q = getQualitySettings();

// ── Material cache ──
const matCache = new Map<string, THREE.Material>();

// ── Loaded GLB Model ──
function LoadedModel({
  url,
  meshMaterials,
  onMeshesDetected,
  selectedMeshes,
  onMeshClick,
}: {
  url: string;
  meshMaterials: Record<string, MaterialDef>;
  onMeshesDetected: (meshes: { name: string; original: THREE.Material | THREE.Material[] }[]) => void;
  selectedMeshes: Set<string>;
  onMeshClick: (name: string, e?: ThreeEvent<MouseEvent>) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);

  const meshDataList = useMemo(() => {
    const list: {
      name: string;
      original: THREE.Material | THREE.Material[];
      geometry: THREE.BufferGeometry;
      position: THREE.Vector3;
      rotation: THREE.Euler;
      scale: THREE.Vector3;
    }[] = [];

    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = 3 / maxDim;

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name || `Mesh_${list.length}`;
        mesh.updateWorldMatrix(true, false);
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        mesh.matrixWorld.decompose(worldPos, worldQuat, worldScale);

        list.push({
          name,
          original: mesh.material,
          geometry: mesh.geometry,
          position: new THREE.Vector3(
            (worldPos.x - center.x) * s,
            (worldPos.y - center.y) * s,
            (worldPos.z - center.z) * s
          ),
          rotation: new THREE.Euler().setFromQuaternion(worldQuat),
          scale: worldScale.multiplyScalar(s),
        });
      }
    });

    return list;
  }, [scene]);

  useEffect(() => {
    onMeshesDetected(meshDataList.map(m => ({ name: m.name, original: m.original })));
  }, [meshDataList, onMeshesDetected]);

  // Build materials with caching
  const meshElements = useMemo(() => {
    return meshDataList.map((md) => {
      const assigned = meshMaterials[md.name];
      const cacheKey = assigned ? `studio_${md.name}_${assigned.id}` : `studio_orig_${md.name}`;
      let material: THREE.Material;

      const cached = matCache.get(cacheKey);
      if (cached) {
        material = cached;
      } else {
        if (assigned) {
          material = assigned.create();
        } else {
          const orig = md.original;
          material = Array.isArray(orig) ? orig[0]?.clone() : orig?.clone();
        }
        matCache.set(cacheKey, material);
      }

      // Selection highlight
      if (selectedMeshes.has(md.name)) {
        const mat = material as THREE.MeshPhysicalMaterial;
        if (mat?.emissive) {
          mat.emissive = new THREE.Color(0x334455);
          mat.emissiveIntensity = 0.15;
        }
      }

      return { ...md, material };
    });
  }, [meshDataList, meshMaterials, selectedMeshes]);

  return (
    <group ref={groupRef}>
      {meshElements.map((md) => (
        <mesh
          key={md.name}
          geometry={md.geometry}
          material={md.material}
          position={md.position}
          rotation={md.rotation}
          scale={md.scale}
          onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onMeshClick(md.name, e); }}
        />
      ))}
    </group>
  );
}

interface StudioViewportProps {
  modelUrl: string | null;
  meshMaterials: Record<string, MaterialDef>;
  onMeshesDetected: (meshes: { name: string; original: THREE.Material | THREE.Material[] }[]) => void;
  selectedMeshes: Set<string>;
  onMeshClick?: (name: string, multiSelect?: boolean) => void;
  isProcessing: boolean;
  progress: number;
  progressStep: string;
  autoRotate?: boolean;
}

export default function StudioViewport({
  modelUrl,
  meshMaterials,
  onMeshesDetected,
  selectedMeshes,
  onMeshClick,
  isProcessing,
  progress,
  progressStep,
  autoRotate = false,
}: StudioViewportProps) {
  const handleMeshClick = useCallback((name: string, e?: ThreeEvent<MouseEvent>) => {
    onMeshClick?.(name, e?.shiftKey || e?.ctrlKey || e?.metaKey);
  }, [onMeshClick]);

  return (
    <div className="relative w-full h-full">
      <Canvas
        gl={{
          antialias: Q.antialias,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          powerPreference: "high-performance",
        }}
        dpr={Q.dpr}
        style={{ background: "transparent" }}
        camera={{ fov: 35, near: 0.1, far: 100, position: [0, 1.5, 5] }}
        frameloop="demand"
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.1} />
          <directionalLight position={[3, 5, 3]} intensity={2.0} color="#ffffff" />
          {Q.maxLights >= 4 && (
            <directionalLight position={[-3, 2, -3]} intensity={1.0} color="#ffffff" />
          )}
          <hemisphereLight args={["#ffffff", "#e6e6e6", 0.55]} />
          {Q.maxLights >= 5 && (
            <spotLight position={[0, 8, 0]} intensity={0.8} angle={0.5} penumbra={1} color="#fff5e6" />
          )}

          <Environment files="/hdri/jewelry-studio-v2.hdr" />

          {modelUrl && (
            <LoadedModel
              url={modelUrl}
              meshMaterials={meshMaterials}
              onMeshesDetected={onMeshesDetected}
              selectedMeshes={selectedMeshes}
              onMeshClick={handleMeshClick}
            />
          )}

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableDamping={true}
            dampingFactor={0.03}
            minDistance={2}
            maxDistance={15}
            autoRotate={autoRotate}
            autoRotateSpeed={0.5}
          />
        </Suspense>
      </Canvas>

      {isProcessing && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-xl flex items-center justify-center z-20">
          <div className="w-[360px] text-center">
            <div className="text-5xl font-black tracking-tighter text-primary mb-2">{progress}%</div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">{progressStep}</p>
          </div>
        </div>
      )}

      {!modelUrl && !isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full border border-border/50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V15m0 0l-2.25 1.313" />
              </svg>
            </div>
            <p className="text-muted-foreground/50 text-xs uppercase tracking-[3px]">
              Upload a GLB model to begin
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
