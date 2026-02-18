import { useRef, useState, useCallback, Suspense, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  ContactShadows,
  OrbitControls,
  useGLTF,
  useEnvironment,
  MeshRefractionMaterial,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  BrightnessContrast,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import type { MaterialDef } from "./materials";

// ── Gem Environment Loader ──
// Loads the dedicated gem HDRI and provides it via context
function GemEnvProvider({ children }: { children: (envMap: THREE.Texture) => React.ReactNode }) {
  const gemEnv = useEnvironment({ files: "/hdri/diamond-gemstone-studio.hdr" });
  return <>{children(gemEnv)}</>;
}

// ── Refraction Gem Mesh ──
// Renders a single mesh with MeshRefractionMaterial
function RefractionGemMesh({
  geometry,
  position,
  rotation,
  scale,
  envMap,
  gemConfig,
}: {
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  envMap: THREE.Texture;
  gemConfig: NonNullable<MaterialDef["gemConfig"]>;
}) {
  // Flat shade the geometry for crisp diamond facets
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
  selectedMesh,
  gemEnvMap,
}: {
  url: string;
  meshMaterials: Record<string, MaterialDef>;
  onMeshesDetected: (meshes: { name: string; original: THREE.Material | THREE.Material[] }[]) => void;
  selectedMesh: string | null;
  gemEnvMap: THREE.Texture | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);

  // Parse meshes from the scene
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
    // Auto-center and scale
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = 3 / maxDim;

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name || `Mesh_${list.length}`;

        // Get world transform
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

  // Separate meshes into refraction (gem) and standard (metal/unassigned)
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

  // Build the standard (non-refraction) scene clone
  const standardScene = useMemo(() => {
    const group = new THREE.Group();
    standardMeshes.forEach((md) => {
      const mesh = new THREE.Mesh(md.geometry, undefined);
      mesh.name = md.name;
      mesh.position.copy(md.position);
      mesh.rotation.copy(md.rotation);
      mesh.scale.copy(md.scale);

      const assigned = meshMaterials[md.name];
      if (assigned) {
        mesh.material = assigned.create();
      } else {
        // Use original material
        const orig = md.original;
        mesh.material = Array.isArray(orig) ? orig[0]?.clone() : orig?.clone();
      }

      // Selection highlight
      if (selectedMesh && md.name === selectedMesh) {
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        if (mat?.emissive) {
          mat.emissive = new THREE.Color(0x334455);
          mat.emissiveIntensity = 0.15;
        }
      }

      group.add(mesh);
    });
    return group;
  }, [standardMeshes, meshMaterials, selectedMesh]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.05;
  });

  return (
    <group ref={groupRef}>
      <primitive object={standardScene} />
      {refractionMeshes.map((md) => (
        <RefractionGemMesh
          key={md.name}
          geometry={md.geometry}
          position={md.position}
          rotation={md.rotation}
          scale={md.scale}
          envMap={gemEnvMap!}
          gemConfig={md.gemConfig}
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

// ── Post-Processing Effects ──
function JewelryPostProcessing() {
  return (
    <EffectComposer>
      <Bloom
        intensity={0.28}
        luminanceThreshold={0.92}
        luminanceSmoothing={0.2}
        mipmapBlur
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.0035, 0.0035)}
        radialModulation={false}
        modulationOffset={0.0}
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
  selectedMesh: string | null;
  isProcessing: boolean;
  progress: number;
  progressStep: string;
}

export default function StudioViewport({
  modelUrl,
  meshMaterials,
  onMeshesDetected,
  selectedMesh,
  isProcessing,
  progress,
  progressStep,
}: StudioViewportProps) {
  // Check if any mesh uses refraction
  const hasRefractionMaterials = Object.values(meshMaterials).some(m => m.useRefraction);

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

          {/* Lighting — matches JewelryRenderer setup */}
          <ambientLight intensity={0.1} />
          <directionalLight position={[3, 5, 3]} intensity={2.0} color="#ffffff" castShadow />
          <directionalLight position={[-3, 2, -3]} intensity={1.0} color="#ffffff" />
          <hemisphereLight args={["#ffffff", "#e6e6e6", 0.55]} />
          <spotLight position={[0, 8, 0]} intensity={0.8} angle={0.5} penumbra={1} color="#fff5e6" />

          {/* Metal HDRI environment */}
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
                      selectedMesh={selectedMesh}
                      gemEnvMap={gemEnv}
                    />
                  )}
                </GemEnvProvider>
              ) : (
                <LoadedModel
                  url={modelUrl}
                  meshMaterials={meshMaterials}
                  onMeshesDetected={onMeshesDetected}
                  selectedMesh={selectedMesh}
                  gemEnvMap={null}
                />
              )}
            </>
          )}

          <ContactShadows position={[0, -1.5, 0]} opacity={0.2} scale={8} blur={2.5} />
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableDamping={true}
            dampingFactor={0.03}
            minDistance={2}
            maxDistance={15}
            autoRotate={!!modelUrl && !isProcessing}
            autoRotateSpeed={0.5}
          />

          {/* Post-processing: bloom + chromatic aberration + contrast */}
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
