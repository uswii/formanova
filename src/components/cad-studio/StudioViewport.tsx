import { useRef, useCallback, Suspense, useEffect, useMemo } from "react";
import { Canvas, useThree, ThreeEvent } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
  useGLTF,
  useEnvironment,
  MeshRefractionMaterial,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  BrightnessContrast,
} from "@react-three/postprocessing";
import * as THREE from "three";
import type { MaterialDef } from "./materials";

// ── Gem Environment Loader ──
function GemEnvProvider({ children }: { children: (envMap: THREE.Texture) => React.ReactNode }) {
  const gemEnv = useEnvironment({ files: "/hdri/diamond-gemstone-studio.hdr" });
  return <>{children(gemEnv)}</>;
}

// ── Refraction Gem Mesh ──
function RefractionGemMesh({
  geometry,
  position,
  rotation,
  scale,
  envMap,
  gemConfig,
  meshName,
  onClick,
}: {
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  envMap: THREE.Texture;
  gemConfig: NonNullable<MaterialDef["gemConfig"]>;
  meshName: string;
  onClick: (name: string, e?: ThreeEvent<MouseEvent>) => void;
}) {
  const flatGeometry = useMemo(() => {
    const geo = geometry.clone().toNonIndexed();
    geo.computeVertexNormals();
    return geo;
  }, [geometry]);

  return (
    <mesh
      geometry={flatGeometry}
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(meshName, e); }}
    >
      <MeshRefractionMaterial
        envMap={envMap}
        color={new THREE.Color(gemConfig.color)}
        ior={gemConfig.ior}
        aberrationStrength={gemConfig.aberrationStrength}
        bounces={gemConfig.bounces}
        fresnel={gemConfig.fresnel}
        fastChroma
        toneMapped={false}
      />
    </mesh>
  );
}

// ── Loaded GLB Model ──
function LoadedModel({
  url,
  meshMaterials,
  onMeshesDetected,
  selectedMeshes,
  gemEnvMap,
  onMeshClick,
}: {
  url: string;
  meshMaterials: Record<string, MaterialDef>;
  onMeshesDetected: (meshes: { name: string; original: THREE.Material | THREE.Material[] }[]) => void;
  selectedMeshes: Set<string>;
  gemEnvMap: THREE.Texture | null;
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

  // Separate refraction vs standard meshes
  const standardMeshes: typeof meshDataList = [];
  const refractionMeshes: (typeof meshDataList[0] & { gemConfig: NonNullable<MaterialDef["gemConfig"]> })[] = [];

  meshDataList.forEach((md) => {
    const assigned = meshMaterials[md.name];
    if (assigned?.useRefraction && assigned.gemConfig && gemEnvMap) {
      refractionMeshes.push({ ...md, gemConfig: assigned.gemConfig });
    } else {
      standardMeshes.push(md);
    }
  });

  // Build clickable standard meshes individually (not as primitive)
  const standardMeshElements = useMemo(() => {
    return standardMeshes.map((md) => {
      const assigned = meshMaterials[md.name];
      let material: THREE.Material;
      if (assigned) {
        material = assigned.create();
      } else {
        const orig = md.original;
        material = Array.isArray(orig) ? orig[0]?.clone() : orig?.clone();
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
  }, [standardMeshes, meshMaterials, selectedMeshes]);

  // No bobbing animation — static model for performance

  return (
    <group ref={groupRef}>
      {standardMeshElements.map((md) => (
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
      {refractionMeshes.map((md) => (
        <RefractionGemMesh
          key={md.name}
          geometry={md.geometry}
          position={md.position}
          rotation={md.rotation}
          scale={md.scale}
          envMap={gemEnvMap!}
          gemConfig={md.gemConfig}
          meshName={md.name}
          onClick={onMeshClick}
        />
      ))}
    </group>
  );
}

// ── Visibility Controller ──
function VisibilityController() {
  const { gl } = useThree();
  const state = useThree();

  useEffect(() => {
    const handle = () => {
      if (document.hidden) {
        gl.setAnimationLoop(null);
      } else {
        gl.setAnimationLoop(() => state.advance(performance.now()));
      }
    };
    document.addEventListener("visibilitychange", handle);
    return () => {
      document.removeEventListener("visibilitychange", handle);
      gl.setAnimationLoop(null);
    };
  }, [gl, state]);

  return null;
}

// ── Lightweight Post-Processing (no chromatic aberration) ──
function JewelryPostProcessing() {
  return (
    <EffectComposer>
      <Bloom
        intensity={0.28}
        luminanceThreshold={0.92}
        luminanceSmoothing={0.2}
        mipmapBlur
      />
      <BrightnessContrast
        brightness={0}
        contrast={0.08}
      />
    </EffectComposer>
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
  const hasRefractionMaterials = Object.values(meshMaterials).some(m => m.useRefraction);

  const handleMeshClick = useCallback((name: string, e?: ThreeEvent<MouseEvent>) => {
    onMeshClick?.(name, e?.shiftKey || e?.ctrlKey || e?.metaKey);
  }, [onMeshClick]);

  return (
    <div className="relative w-full h-full">
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
        style={{ background: "transparent" }}
        camera={{ fov: 35, near: 0.1, far: 100, position: [0, 1.5, 5] }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Suspense fallback={null}>
          <VisibilityController />

          {/* Lighting */}
          <ambientLight intensity={0.1} />
          <directionalLight position={[3, 5, 3]} intensity={2.0} color="#ffffff" castShadow />
          <directionalLight position={[-3, 2, -3]} intensity={1.0} color="#ffffff" />
          <hemisphereLight args={["#ffffff", "#e6e6e6", 0.55]} />
          <spotLight position={[0, 8, 0]} intensity={0.8} angle={0.5} penumbra={1} color="#fff5e6" />

          {/* Metal HDRI environment (NOT the gem one — gem HDRI only for gem meshes) */}
          <Environment files="/hdri/jewelry-studio-v2.hdr" />

          {modelUrl && (
            <>
              {hasRefractionMaterials ? (
                <GemEnvProvider>
                  {(gemEnv) => (
                    <LoadedModel
                      url={modelUrl}
                      meshMaterials={meshMaterials}
                      onMeshesDetected={onMeshesDetected}
                      selectedMeshes={selectedMeshes}
                      gemEnvMap={gemEnv}
                      onMeshClick={handleMeshClick}
                    />
                  )}
                </GemEnvProvider>
              ) : (
                <LoadedModel
                  url={modelUrl}
                  meshMaterials={meshMaterials}
                  onMeshesDetected={onMeshesDetected}
                  selectedMeshes={selectedMeshes}
                  gemEnvMap={null}
                  onMeshClick={handleMeshClick}
                />
              )}
            </>
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

          {/* Lightweight post-processing: bloom + contrast only */}
          <JewelryPostProcessing />
        </Suspense>
      </Canvas>

      {/* Processing overlay */}
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

      {/* Empty state */}
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
