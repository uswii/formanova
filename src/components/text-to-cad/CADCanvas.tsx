import { useRef, useState, useEffect, Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, Environment, OrbitControls, TransformControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import * as THREE from "three";

// Auto-fit: compute a uniform scale so the model's bounding box fits within a target size
function computeAutoScale(scene: THREE.Object3D, targetSize = 3): number {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) return 1;
  return targetSize / maxDim;
}

// Selectable mesh — uses a ref so TransformControls can mutate it
function SelectableMesh({
  mesh,
  isSelected,
  onClick,
  meshRef,
}: {
  mesh: THREE.Mesh;
  isSelected: boolean;
  onClick: (e: any) => void;
  meshRef: React.RefObject<THREE.Mesh>;
}) {
  useEffect(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (mat && "emissive" in mat) {
      mat.emissive = new THREE.Color(isSelected ? 0x334455 : 0x000000);
      mat.emissiveIntensity = isSelected ? 0.4 : 0;
    }
  }, [isSelected, meshRef]);

  return (
    <primitive
      ref={meshRef}
      object={mesh}
      onClick={onClick}
    />
  );
}

function LoadedModel({
  url,
  selectedMeshNames,
  onMeshClick,
  transformMode,
  onMeshesDetected,
}: {
  url: string;
  selectedMeshNames: Set<string>;
  onMeshClick: (name: string, multi: boolean) => void;
  transformMode: string;
  onMeshesDetected?: (meshes: { name: string; verts: number; faces: number }[]) => void;
}) {
  const { scene } = useGLTF(url);
  const [meshes, setMeshes] = useState<THREE.Mesh[]>([]);
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<Map<string, React.RefObject<THREE.Mesh>>>(new Map());

  // Auto-scale
  const autoScale = useMemo(() => computeAutoScale(scene), [scene]);

  useEffect(() => {
    const found: THREE.Mesh[] = [];
    let idx = 0;
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        // Give unnamed meshes a name
        if (!m.name) m.name = `Mesh_${idx}`;
        // Clone material so emissive changes are independent
        if (Array.isArray(m.material)) {
          m.material = m.material.map((mat) => mat.clone());
        } else {
          m.material = m.material.clone();
        }
        found.push(m);
        idx++;
      }
    });
    setMeshes(found);

    // Report detected meshes back to parent
    if (onMeshesDetected) {
      onMeshesDetected(
        found.map((m) => ({
          name: m.name,
          verts: m.geometry?.attributes?.position?.count || 0,
          faces: m.geometry?.index ? m.geometry.index.count / 3 : (m.geometry?.attributes?.position?.count || 0) / 3,
        }))
      );
    }
  }, [scene, onMeshesDetected]);

  // Ensure refs exist for each mesh
  meshes.forEach((m) => {
    if (!meshRefs.current.has(m.name)) {
      meshRefs.current.set(m.name, { current: null } as React.RefObject<THREE.Mesh>);
    }
  });

  // Get the ref of the first selected mesh for TransformControls
  const selectedMeshName = meshes.find((m) => selectedMeshNames.has(m.name))?.name;
  const selectedRef = selectedMeshName ? meshRefs.current.get(selectedMeshName) : null;

  return (
    <group ref={groupRef} scale={autoScale}>
      {meshes.map((mesh) => (
        <SelectableMesh
          key={mesh.uuid}
          mesh={mesh}
          meshRef={meshRefs.current.get(mesh.name)!}
          isSelected={selectedMeshNames.has(mesh.name)}
          onClick={(e) => {
            e.stopPropagation();
            onMeshClick(mesh.name, e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
          }}
        />
      ))}
      {selectedRef?.current && transformMode !== "orbit" && (
        <TransformControls
          object={selectedRef.current}
          mode={transformMode as "translate" | "rotate" | "scale"}
          size={0.6}
        />
      )}
    </group>
  );
}

interface CADCanvasProps {
  hasModel: boolean;
  glbUrl?: string;
  selectedMeshNames: Set<string>;
  onMeshClick: (name: string, multi: boolean) => void;
  transformMode: string;
  onMeshesDetected?: (meshes: { name: string; verts: number; faces: number }[]) => void;
}

export default function CADCanvas({ hasModel, glbUrl, selectedMeshNames, onMeshClick, transformMode, onMeshesDetected }: CADCanvasProps) {
  const modelUrl = glbUrl || "/models/ring.glb";

  return (
    <div className="w-full h-full" style={{ background: "#111" }}>
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        dpr={[1, 2]}
        camera={{ fov: 30, near: 0.1, far: 100, position: [0, 2, 5] }}
        onPointerMissed={() => onMeshClick("", false)}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 10, 7.5]} intensity={5.0} castShadow />
          <directionalLight position={[-5, 4, -8]} intensity={2.0} />
          <directionalLight position={[0, -5, 3]} intensity={1.0} color="#aaccff" />
          <directionalLight position={[8, 2, 0]} intensity={1.5} color="#aaccff" />
          <Environment preset="studio" />
          {hasModel && (
            <LoadedModel
              url={modelUrl}
              selectedMeshNames={selectedMeshNames}
              onMeshClick={onMeshClick}
              transformMode={transformMode}
              onMeshesDetected={onMeshesDetected}
            />
          )}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableDamping
            dampingFactor={0.05}
            autoRotate={false}
            autoRotateSpeed={1.0}
            minDistance={0.5}
            maxDistance={50}
            makeDefault
          />
          <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
            <GizmoViewport labelColor="white" axisHeadScale={0.8} />
          </GizmoHelper>
        </Suspense>
      </Canvas>

      {/* Empty state */}
      {!hasModel && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ border: "1px solid #333" }}>
              <svg className="w-8 h-8 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V15m0 0l-2.25 1.313" />
              </svg>
            </div>
            <p className="text-[#555] text-[10px] uppercase tracking-[3px]">
              Describe your ring to begin
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

useGLTF.preload("/models/ring.glb");
