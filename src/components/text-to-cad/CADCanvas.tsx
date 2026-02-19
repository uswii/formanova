import { useRef, useState, useEffect, Suspense, useMemo, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas, useThree, ThreeEvent } from "@react-three/fiber";
import {
  useGLTF,
  Environment,
  OrbitControls,
  TransformControls,
  GizmoHelper,
  GizmoViewport,
  useEnvironment,
  MeshRefractionMaterial,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  BrightnessContrast,
} from "@react-three/postprocessing";
import * as THREE from "three";
import { MATERIAL_LIBRARY } from "@/components/cad-studio/materials";
import type { MaterialDef } from "@/components/cad-studio/materials";

// ── Gem Environment Loader ──
function GemEnvProvider({ children }: { children: (envMap: THREE.Texture) => React.ReactNode }) {
  const gemEnv = useEnvironment({ files: "/hdri/diamond-gemstone-studio.hdr" });
  return <>{children(gemEnv)}</>;
}

// ── Post-Processing (lightweight) ──
function JewelryPostProcessing() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.28} luminanceThreshold={0.92} luminanceSmoothing={0.2} mipmapBlur />
      <BrightnessContrast brightness={0} contrast={0.08} />
    </EffectComposer>
  );
}

// ── Disable OrbitControls while dragging TransformControls ──
function TransformControlsWrapper({
  object,
  mode,
  onDragEnd,
}: {
  object: THREE.Object3D;
  mode: "translate" | "rotate" | "scale";
  onDragEnd?: () => void;
}) {
  const { gl } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const handler = (e: any) => {
      const orbitControls = (gl.domElement as any).__orbitControls;
      if (orbitControls) orbitControls.enabled = !e.value;
      // Fire onDragEnd when user finishes dragging
      if (!e.value && onDragEnd) onDragEnd();
    };
    controls.addEventListener("dragging-changed", handler);
    return () => controls.removeEventListener("dragging-changed", handler);
  }, [gl, onDragEnd]);

  return (
    <TransformControls
      ref={controlsRef}
      object={object}
      mode={mode}
      size={1.5}
    />
  );
}

function OrbitControlsWithRef(props: any) {
  const { gl } = useThree();
  const ref = useRef<any>(null);
  useEffect(() => { if (ref.current) (gl.domElement as any).__orbitControls = ref.current; }, [gl]);
  return <OrbitControls ref={ref} {...props} />;
}

// ── Mesh data extracted from GLB ──
interface MeshData {
  name: string;
  geometry: THREE.BufferGeometry;
  originalMaterial: THREE.Material;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  origPos: THREE.Vector3;
  origRot: THREE.Euler;
  origScale: THREE.Vector3;
}

// ── Snapshot for undo ──
export interface CanvasSnapshot {
  meshDataList: MeshData[];
  assignedMaterials: Record<string, MaterialDef>;
}

// ── Loaded Model ──
const LoadedModel = forwardRef<
  {
    applyMaterial: (matId: string, meshNames: string[]) => void;
    resetTransform: (meshNames: string[]) => void;
    deleteMeshes: (meshNames: string[]) => void;
    duplicateMeshes: (meshNames: string[]) => void;
    flipNormals: (meshNames: string[]) => void;
    centerOrigin: (meshNames: string[]) => void;
    subdivideMesh: (meshNames: string[], iterations: number) => void;
    setWireframe: (on: boolean) => void;
    smoothMesh: (meshNames: string[], iterations: number) => void;
    getSnapshot: () => CanvasSnapshot;
    restoreSnapshot: (snap: CanvasSnapshot) => void;
  },
  {
    url: string;
    selectedMeshNames: Set<string>;
    onMeshClick: (name: string, multi: boolean) => void;
    transformMode: string;
    onMeshesDetected?: (meshes: { name: string; verts: number; faces: number }[]) => void;
    gemEnvMap: THREE.Texture | null;
    onTransformEnd?: () => void;
  }
>(({ url, selectedMeshNames, onMeshClick, transformMode, onMeshesDetected, gemEnvMap, onTransformEnd }, ref) => {
  const { scene } = useGLTF(url);
  const [meshDataList, setMeshDataList] = useState<MeshData[]>([]);
  const [assignedMaterials, setAssignedMaterials] = useState<Record<string, MaterialDef>>({});
  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  // Cache flat geometries for refraction gems to avoid re-creating every render
  const flatGeoCache = useRef<Map<string, THREE.BufferGeometry>>(new Map());

  // ── Decompose scene into individual mesh data ──
  useEffect(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = maxDim === 0 ? 1 : 3 / maxDim;

    const list: MeshData[] = [];
    let idx = 0;
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name || `Mesh_${idx}`;
        mesh.updateWorldMatrix(true, false);
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        mesh.matrixWorld.decompose(worldPos, worldQuat, worldScale);

        const pos = new THREE.Vector3(
          (worldPos.x - center.x) * s,
          (worldPos.y - center.y) * s,
          (worldPos.z - center.z) * s
        );
        const rot = new THREE.Euler().setFromQuaternion(worldQuat);
        const scl = worldScale.multiplyScalar(s);
        const origMat = Array.isArray(mesh.material) ? mesh.material[0].clone() : mesh.material.clone();

        list.push({
          name,
          geometry: mesh.geometry,
          originalMaterial: origMat,
          position: pos.clone(),
          rotation: rot.clone(),
          scale: scl.clone(),
          origPos: pos.clone(),
          origRot: rot.clone(),
          origScale: scl.clone(),
        });
        idx++;
      }
    });

    setMeshDataList(list);
    setAssignedMaterials({});
    flatGeoCache.current.clear();

    if (onMeshesDetected) {
      onMeshesDetected(list.map((m) => ({
        name: m.name,
        verts: m.geometry?.attributes?.position?.count || 0,
        faces: m.geometry?.index ? m.geometry.index.count / 3 : (m.geometry?.attributes?.position?.count || 0) / 3,
      })));
    }
  }, [scene, onMeshesDetected]);

  // ── Imperative API ──
  useImperativeHandle(ref, () => ({
    applyMaterial: (matId: string, meshNames: string[]) => {
      const matDef = MATERIAL_LIBRARY.find((m) => m.id === matId);
      if (!matDef) return;
      // Clear flat geo cache for gems that change material type
      meshNames.forEach((n) => flatGeoCache.current.delete(n));
      setAssignedMaterials((prev) => {
        const next = { ...prev };
        meshNames.forEach((n) => { next[n] = matDef; });
        return next;
      });
    },
    resetTransform: (meshNames: string[]) => {
      const names = new Set(meshNames);
      setMeshDataList((prev) => prev.map((md) => {
        if (!names.has(md.name)) return md;
        return { ...md, position: md.origPos.clone(), rotation: md.origRot.clone(), scale: md.origScale.clone() };
      }));
    },
    deleteMeshes: (meshNames: string[]) => {
      const names = new Set(meshNames);
      setMeshDataList((prev) => prev.filter((m) => !names.has(m.name)));
      setAssignedMaterials((prev) => {
        const next = { ...prev };
        meshNames.forEach((n) => { delete next[n]; flatGeoCache.current.delete(n); });
        return next;
      });
    },
    duplicateMeshes: (meshNames: string[]) => {
      const names = new Set(meshNames);
      setMeshDataList((prev) => {
        const newItems: MeshData[] = [];
        prev.forEach((md) => {
          if (names.has(md.name)) {
            const newPos = md.position.clone();
            newPos.x += 0.5;
            newItems.push({
              ...md,
              name: `${md.name}_copy`,
              geometry: md.geometry.clone(),
              position: newPos,
              origPos: newPos.clone(),
            });
          }
        });
        return [...prev, ...newItems];
      });
    },
    flipNormals: (meshNames: string[]) => {
      const names = new Set(meshNames);
      meshDataList.forEach((md) => {
        if (names.has(md.name)) {
          const normals = md.geometry.attributes.normal;
          if (normals) {
            for (let i = 0; i < normals.count; i++) {
              normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
            }
            normals.needsUpdate = true;
          }
        }
      });
    },
    centerOrigin: (meshNames: string[]) => {
      const names = new Set(meshNames);
      setMeshDataList((prev) => prev.map((md) => {
        if (!names.has(md.name)) return md;
        md.geometry.computeBoundingBox();
        const c = new THREE.Vector3();
        md.geometry.boundingBox?.getCenter(c);
        md.geometry.translate(-c.x, -c.y, -c.z);
        return { ...md, position: md.position.clone().add(c) };
      }));
    },
    subdivideMesh: (meshNames: string[], _iterations: number) => {
      const names = new Set(meshNames);
      meshDataList.forEach((md) => {
        if (names.has(md.name)) md.geometry.computeVertexNormals();
      });
    },
    setWireframe: (on: boolean) => {
      meshRefs.current.forEach((meshObj) => {
        const mat = meshObj.material as THREE.MeshStandardMaterial;
        if (mat && "wireframe" in mat) mat.wireframe = on;
      });
    },
    smoothMesh: (meshNames: string[], _iterations: number) => {
      const names = new Set(meshNames);
      meshDataList.forEach((md) => {
        if (names.has(md.name)) md.geometry.computeVertexNormals();
      });
    },
    getSnapshot: (): CanvasSnapshot => ({
      meshDataList: meshDataList.map((md) => ({
        ...md,
        position: md.position.clone(),
        rotation: md.rotation.clone(),
        scale: md.scale.clone(),
        origPos: md.origPos.clone(),
        origRot: md.origRot.clone(),
        origScale: md.origScale.clone(),
      })),
      assignedMaterials: { ...assignedMaterials },
    }),
    restoreSnapshot: (snap: CanvasSnapshot) => {
      setMeshDataList(snap.meshDataList);
      setAssignedMaterials(snap.assignedMaterials);
      flatGeoCache.current.clear();
    },
  }), [meshDataList, assignedMaterials]);

  // ── Separate standard vs refraction meshes (memoized) ──
  const { standardMeshes, refractionMeshes } = useMemo(() => {
    const std: MeshData[] = [];
    const ref: (MeshData & { gemConfig: NonNullable<MaterialDef["gemConfig"]> })[] = [];
    meshDataList.forEach((md) => {
      const assigned = assignedMaterials[md.name];
      if (assigned?.useRefraction && assigned.gemConfig && gemEnvMap) {
        ref.push({ ...md, gemConfig: assigned.gemConfig });
      } else {
        std.push(md);
      }
    });
    return { standardMeshes: std, refractionMeshes: ref };
  }, [meshDataList, assignedMaterials, gemEnvMap]);

  // Build materials for standard meshes (memoized)
  const standardElements = useMemo(() => {
    return standardMeshes.map((md) => {
      const isSelected = selectedMeshNames.has(md.name);
      const assigned = assignedMaterials[md.name];
      let material: THREE.Material;
      if (assigned) {
        material = assigned.create();
      } else {
        material = md.originalMaterial.clone();
      }
      if (isSelected) {
        // Transparent blue selection overlay
        material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(0x3399ff),
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
          roughness: 0.4,
          metalness: 0.1,
          emissive: new THREE.Color(0x2277dd),
          emissiveIntensity: 0.3,
          side: THREE.DoubleSide,
        });
      }
      return { ...md, material, isSelected };
    });
  }, [standardMeshes, assignedMaterials, selectedMeshNames]);

  // Get or create cached flat geometry for refraction meshes
  const getFlatGeo = useCallback((name: string, geometry: THREE.BufferGeometry) => {
    let cached = flatGeoCache.current.get(name);
    if (!cached) {
      cached = geometry.clone().toNonIndexed();
      cached.computeVertexNormals();
      flatGeoCache.current.set(name, cached);
    }
    return cached;
  }, []);

  // Find selected mesh ref for TransformControls
  const selectedMeshName = meshDataList.find((m) => selectedMeshNames.has(m.name))?.name;
  const selectedMeshRef = selectedMeshName ? meshRefs.current.get(selectedMeshName) : undefined;

  return (
    <group>
      {standardElements.map((md) => (
        <mesh
          key={md.name}
          ref={(r) => { if (r) meshRefs.current.set(md.name, r); }}
          geometry={md.geometry}
          material={md.material}
          position={md.position}
          rotation={md.rotation}
          scale={md.scale}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            onMeshClick(md.name, e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
          }}
        />
      ))}

      {refractionMeshes.map((md) => (
        <mesh
          key={md.name}
          ref={(r) => { if (r) meshRefs.current.set(md.name, r); }}
          geometry={getFlatGeo(md.name, md.geometry)}
          position={md.position}
          rotation={md.rotation}
          scale={md.scale}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            onMeshClick(md.name, e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
          }}
        >
          <MeshRefractionMaterial
            envMap={gemEnvMap!}
            color={new THREE.Color(md.gemConfig.color)}
            ior={md.gemConfig.ior}
            aberrationStrength={md.gemConfig.aberrationStrength}
            bounces={md.gemConfig.bounces}
            fresnel={md.gemConfig.fresnel}
            fastChroma
            toneMapped={false}
          />
        </mesh>
      ))}

      {selectedMeshRef && transformMode !== "orbit" && (
        <TransformControlsWrapper
          object={selectedMeshRef}
          mode={transformMode as "translate" | "rotate" | "scale"}
          onDragEnd={onTransformEnd}
        />
      )}
    </group>
  );
});

LoadedModel.displayName = "LoadedModel";

// ── Public API ──
export interface CADCanvasHandle {
  applyMaterial: (matId: string, meshNames: string[]) => void;
  resetTransform: (meshNames: string[]) => void;
  deleteMeshes: (meshNames: string[]) => void;
  duplicateMeshes: (meshNames: string[]) => void;
  flipNormals: (meshNames: string[]) => void;
  centerOrigin: (meshNames: string[]) => void;
  subdivideMesh: (meshNames: string[], iterations: number) => void;
  setWireframe: (on: boolean) => void;
  smoothMesh: (meshNames: string[], iterations: number) => void;
  getSnapshot: () => CanvasSnapshot;
  restoreSnapshot: (snap: CanvasSnapshot) => void;
}

interface CADCanvasProps {
  hasModel: boolean;
  glbUrl?: string;
  selectedMeshNames: Set<string>;
  onMeshClick: (name: string, multi: boolean) => void;
  transformMode: string;
  onMeshesDetected?: (meshes: { name: string; verts: number; faces: number }[]) => void;
  onTransformEnd?: () => void;
}

const CADCanvas = forwardRef<CADCanvasHandle, CADCanvasProps>(
  ({ hasModel, glbUrl, selectedMeshNames, onMeshClick, transformMode, onMeshesDetected, onTransformEnd }, ref) => {
    const modelUrl = glbUrl || "/models/ring.glb";
    const modelRef = useRef<CADCanvasHandle>(null);
    const [hasRefractionGems, setHasRefractionGems] = useState(false);

    useImperativeHandle(ref, () => ({
      applyMaterial: (matId, meshNames) => {
        modelRef.current?.applyMaterial(matId, meshNames);
        const matDef = MATERIAL_LIBRARY.find((m) => m.id === matId);
        if (matDef?.useRefraction) setHasRefractionGems(true);
      },
      resetTransform: (meshNames) => modelRef.current?.resetTransform(meshNames),
      deleteMeshes: (meshNames) => modelRef.current?.deleteMeshes(meshNames),
      duplicateMeshes: (meshNames) => modelRef.current?.duplicateMeshes(meshNames),
      flipNormals: (meshNames) => modelRef.current?.flipNormals(meshNames),
      centerOrigin: (meshNames) => modelRef.current?.centerOrigin(meshNames),
      subdivideMesh: (meshNames, iters) => modelRef.current?.subdivideMesh(meshNames, iters),
      setWireframe: (on) => modelRef.current?.setWireframe(on),
      smoothMesh: (meshNames, iters) => modelRef.current?.smoothMesh(meshNames, iters),
      getSnapshot: () => modelRef.current!.getSnapshot(),
      restoreSnapshot: (snap) => modelRef.current?.restoreSnapshot(snap),
    }));

    return (
      <div className="w-full h-full" style={{ background: "#111" }}>
        <Canvas
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2,
            powerPreference: "high-performance",
          }}
          dpr={[1, 1.5]}
          camera={{ fov: 35, near: 0.1, far: 100, position: [0, 1.5, 5] }}
          onPointerMissed={() => onMeshClick("", false)}
          frameloop="demand"
          onCreated={({ gl, invalidate }) => {
            gl.setClearColor(0x000000, 0);
            gl.outputColorSpace = THREE.SRGBColorSpace;
            // Continuously invalidate so controls/transforms work with demand mode
            const loop = () => { invalidate(); requestAnimationFrame(loop); };
            loop();
          }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.1} />
            <directionalLight position={[3, 5, 3]} intensity={2.0} color="#ffffff" />
            <directionalLight position={[-3, 2, -3]} intensity={1.0} color="#ffffff" />
            <hemisphereLight args={["#ffffff", "#e6e6e6", 0.55]} />
            <spotLight position={[0, 8, 0]} intensity={0.8} angle={0.5} penumbra={1} color="#fff5e6" />

            <Environment files="/hdri/jewelry-studio-v2.hdr" />

            {hasModel && (
              <>
                {hasRefractionGems ? (
                  <GemEnvProvider>
                    {(gemEnv) => (
                      <LoadedModel
                        ref={modelRef}
                        url={modelUrl}
                        selectedMeshNames={selectedMeshNames}
                        onMeshClick={onMeshClick}
                        transformMode={transformMode}
                        onMeshesDetected={onMeshesDetected}
                        gemEnvMap={gemEnv}
                        onTransformEnd={onTransformEnd}
                      />
                    )}
                  </GemEnvProvider>
                ) : (
                  <LoadedModel
                    ref={modelRef}
                    url={modelUrl}
                    selectedMeshNames={selectedMeshNames}
                    onMeshClick={onMeshClick}
                    transformMode={transformMode}
                    onMeshesDetected={onMeshesDetected}
                    gemEnvMap={null}
                    onTransformEnd={onTransformEnd}
                  />
                )}
              </>
            )}

            <OrbitControlsWithRef
              enablePan={true}
              enableZoom={true}
              enableDamping
              dampingFactor={0.03}
              minDistance={0.5}
              maxDistance={50}
              makeDefault
            />
            <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
              <GizmoViewport labelColor="white" axisHeadScale={0.8} />
            </GizmoHelper>

            <JewelryPostProcessing />
          </Suspense>
        </Canvas>

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
);

CADCanvas.displayName = "CADCanvas";
export default CADCanvas;

useGLTF.preload("/models/ring.glb");
