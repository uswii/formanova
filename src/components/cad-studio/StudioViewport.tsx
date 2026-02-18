import { useRef, useState, useCallback, Suspense, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { MaterialDef } from "./materials";

// ── Loaded GLB Model ──
function LoadedModel({
  url,
  meshMaterials,
  onMeshesDetected,
  selectedMesh,
}: {
  url: string;
  meshMaterials: Record<string, MaterialDef>;
  onMeshesDetected: (meshes: { name: string; original: THREE.Material | THREE.Material[] }[]) => void;
  selectedMesh: string | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    const meshList: { name: string; original: THREE.Material | THREE.Material[] }[] = [];

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name || `Mesh_${meshList.length}`;
        meshList.push({ name, original: mesh.material });
      }
    });

    onMeshesDetected(meshList);
    return clone;
  }, [scene, onMeshesDetected]);

  // Apply materials per mesh
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name;
        const assigned = meshMaterials[name];
        if (assigned) {
          mesh.material = assigned.create();
        }
      }
    });
  }, [meshMaterials, clonedScene]);

  // Selection highlight
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (selectedMesh && mesh.name === selectedMesh) {
          // Add a slight emissive to show selection
          const mat = mesh.material as THREE.MeshPhysicalMaterial;
          if (mat && mat.emissive) {
            mat.emissive = new THREE.Color(0x334455);
            mat.emissiveIntensity = 0.15;
          }
        } else {
          const mat = mesh.material as THREE.MeshPhysicalMaterial;
          if (mat && mat.emissive) {
            mat.emissiveIntensity = 0;
          }
        }
      }
    });
  }, [selectedMesh, clonedScene]);

  // Auto-center and scale
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3 / maxDim;
    clonedScene.scale.setScalar(scale);
    clonedScene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  }, [clonedScene]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    // Gentle bobbing
    groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.05;
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
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
  return (
    <div className="relative w-full h-full">
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        style={{ background: "transparent" }}
        camera={{ fov: 35, near: 0.1, far: 100, position: [0, 1.5, 5] }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <Suspense fallback={null}>
          <VisibilityController />
          <ambientLight intensity={0.35} />
          <directionalLight position={[5, 5, 5]} intensity={1.5} color="#fffaf0" />
          <directionalLight position={[-3, 3, -3]} intensity={0.5} color="#e8dcc8" />
          <spotLight position={[0, 8, 0]} intensity={0.8} angle={0.5} penumbra={1} color="#fff5e6" />
          <Environment files="/hdri/jewelry-studio.hdr" />

          {modelUrl && (
            <LoadedModel
              url={modelUrl}
              meshMaterials={meshMaterials}
              onMeshesDetected={onMeshesDetected}
              selectedMesh={selectedMesh}
            />
          )}

          <ContactShadows position={[0, -1.5, 0]} opacity={0.2} scale={8} blur={2.5} />
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            minDistance={2}
            maxDistance={15}
            autoRotate={!!modelUrl && !isProcessing}
            autoRotateSpeed={0.5}
          />
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
