import React, { useRef, useState, useEffect, Suspense, useMemo, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas, useThree, ThreeEvent, invalidate } from "@react-three/fiber";
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
import { getQualitySettings } from "@/lib/gpu-detect";

// ── Quality settings (cached, runs once) ──
const Q = getQualitySettings();

// ── Gem HDRI path ──
const GEM_HDRI_PATH = "/hdri/diamond-gemstone-studio.hdr";

// ── Gem env loaded once inside Canvas, never unmounts ──
function GemEnvLoader({ onLoaded }: { onLoaded: (tex: THREE.Texture) => void }) {
  const gemEnv = useEnvironment({ files: GEM_HDRI_PATH });
  useEffect(() => {
    // On low/medium tier, disable mipmaps on gem env to save VRAM
    if (!Q.envMapMipmaps && gemEnv) {
      gemEnv.minFilter = THREE.LinearFilter;
      gemEnv.generateMipmaps = false;
      gemEnv.needsUpdate = true;
    }
    onLoaded(gemEnv);
  }, [gemEnv, onLoaded]);
  return null;
}

// ── Shared selection material (reused, never re-created) ──
const SELECTION_MATERIAL = new THREE.MeshPhysicalMaterial({
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

// ── Post-Processing (lightweight, skipped on low tier) ──
const JewelryPostProcessing = React.memo(function JewelryPostProcessing() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.28} luminanceThreshold={0.92} luminanceSmoothing={0.2} mipmapBlur />
      <BrightnessContrast brightness={0} contrast={0.08} />
    </EffectComposer>
  );
});

// ── Invalidate helper for demand mode ──
function useInvalidate() {
  const { invalidate: inv } = useThree();
  return inv;
}

// ── Disable OrbitControls while dragging TransformControls ──
// Transform is applied around the object's local origin (pivot).
// Three.js TransformControls already handles this correctly:
//   - Rotation rotates around the object's own position (pivot)
//   - Scale scales from the object's own position (pivot)
//   - Move changes position only
// The key fix is syncing the resulting transform back to React state.
function TransformControlsWrapper({
  object,
  mode,
  onDragEnd,
}: {
  object: THREE.Object3D;
  mode: "translate" | "rotate" | "scale";
  onDragEnd?: (obj: THREE.Object3D) => void;
}) {
  const { gl } = useThree();
  const inv = useInvalidate();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const handler = (e: any) => {
      const orbitControls = (gl.domElement as any).__orbitControls;
      if (orbitControls) orbitControls.enabled = !e.value;
      if (e.value) {
        inv();
      }
      // When drag ends, pass the object back so we can sync state
      if (!e.value && onDragEnd) onDragEnd(object);
    };
    controls.addEventListener("dragging-changed", handler);
    const onChange = () => inv();
    controls.addEventListener("objectChange", onChange);
    return () => {
      controls.removeEventListener("dragging-changed", handler);
      controls.removeEventListener("objectChange", onChange);
    };
  }, [gl, onDragEnd, inv, object]);

  return (
    <TransformControls
      ref={controlsRef}
      object={object}
      mode={mode}
      size={1.5}
      space="local"
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
    applyTransform: (meshNames: string[]) => void;
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
  const flatGeoCache = useRef<Map<string, THREE.BufferGeometry>>(new Map());
  const materialCache = useRef<Map<string, THREE.Material>>(new Map());
  const inv = useInvalidate();

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

    // Dispose old caches
    flatGeoCache.current.forEach((g) => g.dispose());
    flatGeoCache.current.clear();
    materialCache.current.forEach((m) => m.dispose());
    materialCache.current.clear();

    setMeshDataList(list);
    setAssignedMaterials({});
    inv();

    if (onMeshesDetected) {
      onMeshesDetected(list.map((m) => ({
        name: m.name,
        verts: m.geometry?.attributes?.position?.count || 0,
        faces: m.geometry?.index ? m.geometry.index.count / 3 : (m.geometry?.attributes?.position?.count || 0) / 3,
      })));
    }
  }, [scene, onMeshesDetected, inv]);

  // ── Sync transform from Three.js object back to React state ──
  // This is the CRITICAL fix: after TransformControls modifies the object,
  // we read back position/rotation/scale and store them in state.
  // This prevents React re-renders from reverting transforms.
  const syncTransformFromObject = useCallback((meshName: string, obj: THREE.Object3D) => {
    setMeshDataList((prev) => prev.map((md) => {
      if (md.name !== meshName) return md;
      return {
        ...md,
        position: obj.position.clone(),
        rotation: obj.rotation.clone(),
        scale: obj.scale.clone(),
      };
    }));
  }, []);

  // Called when TransformControls drag ends
  const handleDragEnd = useCallback((obj: THREE.Object3D) => {
    // Find which mesh this object corresponds to
    for (const [name, meshObj] of meshRefs.current.entries()) {
      if (meshObj === obj) {
        syncTransformFromObject(name, obj);
        break;
      }
    }
    onTransformEnd?.();
    inv();
  }, [syncTransformFromObject, onTransformEnd, inv]);

  // ── Imperative API ──
  useImperativeHandle(ref, () => ({
    applyMaterial: (matId: string, meshNames: string[]) => {
      const matDef = MATERIAL_LIBRARY.find((m) => m.id === matId);
      if (!matDef) return;
      meshNames.forEach((n) => {
        flatGeoCache.current.delete(n);
        const key = `assigned_${n}_${matDef.id}`;
        const old = materialCache.current.get(key);
        if (old) old.dispose();
        materialCache.current.delete(key);
      });
      setAssignedMaterials((prev) => {
        const next = { ...prev };
        meshNames.forEach((n) => { next[n] = matDef; });
        return next;
      });
      inv();
    },
    resetTransform: (meshNames: string[]) => {
      const names = new Set(meshNames);
      setMeshDataList((prev) => prev.map((md) => {
        if (!names.has(md.name)) return md;
        return { ...md, position: md.origPos.clone(), rotation: md.origRot.clone(), scale: md.origScale.clone() };
      }));
      inv();
    },
    deleteMeshes: (meshNames: string[]) => {
      const names = new Set(meshNames);
      setMeshDataList((prev) => prev.filter((m) => !names.has(m.name)));
      setAssignedMaterials((prev) => {
        const next = { ...prev };
        meshNames.forEach((n) => {
          delete next[n];
          const fg = flatGeoCache.current.get(n);
          if (fg) { fg.dispose(); flatGeoCache.current.delete(n); }
        });
        return next;
      });
      inv();
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
      inv();
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
      inv();
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
      inv();
    },
    subdivideMesh: (meshNames: string[], _iterations: number) => {
      const names = new Set(meshNames);
      meshDataList.forEach((md) => {
        if (names.has(md.name)) md.geometry.computeVertexNormals();
      });
      inv();
    },
    setWireframe: (on: boolean) => {
      meshRefs.current.forEach((meshObj) => {
        const mat = meshObj.material as THREE.MeshStandardMaterial;
        if (mat && "wireframe" in mat) mat.wireframe = on;
      });
      inv();
    },
    smoothMesh: (meshNames: string[], _iterations: number) => {
      const names = new Set(meshNames);
      meshDataList.forEach((md) => {
        if (names.has(md.name)) md.geometry.computeVertexNormals();
      });
      inv();
    },
    // Apply Transform: bake current transform into geometry, reset transform to identity
    applyTransform: (meshNames: string[]) => {
      const names = new Set(meshNames);
      setMeshDataList((prev) => prev.map((md) => {
        if (!names.has(md.name)) return md;
        // Build the object matrix: T * R * S
        const matrix = new THREE.Matrix4();
        const quat = new THREE.Quaternion().setFromEuler(md.rotation);
        matrix.compose(md.position, quat, md.scale);
        // Apply matrix to geometry vertices
        const newGeo = md.geometry.clone();
        newGeo.applyMatrix4(matrix);
        newGeo.computeVertexNormals();
        // Reset transform to identity
        const identityPos = new THREE.Vector3(0, 0, 0);
        const identityRot = new THREE.Euler(0, 0, 0);
        const identityScale = new THREE.Vector3(1, 1, 1);
        return {
          ...md,
          geometry: newGeo,
          position: identityPos,
          rotation: identityRot,
          scale: identityScale,
          origPos: identityPos.clone(),
          origRot: identityRot.clone(),
          origScale: identityScale.clone(),
        };
      }));
      // Clear caches since geometry changed
      flatGeoCache.current.forEach((g) => g.dispose());
      flatGeoCache.current.clear();
      materialCache.current.forEach((m) => m.dispose());
      materialCache.current.clear();
      inv();
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
      flatGeoCache.current.forEach((g) => g.dispose());
      flatGeoCache.current.clear();
      materialCache.current.forEach((m) => m.dispose());
      materialCache.current.clear();
      inv();
    },
  }), [meshDataList, assignedMaterials, inv, syncTransformFromObject, onTransformEnd]);

  // ── Separate standard vs refraction meshes (memoized) ──
  const { standardMeshes, refractionMeshes } = useMemo(() => {
    const std: MeshData[] = [];
    const refr: (MeshData & { gemConfig: NonNullable<MaterialDef["gemConfig"]> })[] = [];
    meshDataList.forEach((md) => {
      const assigned = assignedMaterials[md.name];
      if (assigned?.useRefraction && assigned.gemConfig && gemEnvMap) {
        refr.push({ ...md, gemConfig: assigned.gemConfig });
      } else {
        std.push(md);
      }
    });
    return { standardMeshes: std, refractionMeshes: refr };
  }, [meshDataList, assignedMaterials, gemEnvMap]);

  // Build materials for standard meshes (memoized)
  const standardElements = useMemo(() => {
    return standardMeshes.map((md) => {
      const isSelected = selectedMeshNames.has(md.name);
      if (isSelected) {
        return { ...md, material: SELECTION_MATERIAL, isSelected };
      }
      const assigned = assignedMaterials[md.name];
      const cacheKey = assigned ? `assigned_${md.name}_${assigned.id}` : `orig_${md.name}`;
      let material = materialCache.current.get(cacheKey);
      if (!material) {
        material = assigned ? assigned.create() : md.originalMaterial.clone();
        materialCache.current.set(cacheKey, material);
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
            aberrationStrength={md.gemConfig.aberrationStrength * Q.aberrationScale}
            bounces={Math.min(md.gemConfig.bounces, Q.gemBounces)}
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
          onDragEnd={handleDragEnd}
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
  applyTransform: (meshNames: string[]) => void;
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
    const [gemEnvMap, setGemEnvMap] = useState<THREE.Texture | null>(null);

    // Only load gem env when a refraction material is actually needed
    // For now we keep it mounted since toggling causes remount lag
    const handleGemEnvLoaded = useCallback((tex: THREE.Texture) => {
      setGemEnvMap(tex);
    }, []);

    useImperativeHandle(ref, () => ({
      applyMaterial: (matId, meshNames) => modelRef.current?.applyMaterial(matId, meshNames),
      resetTransform: (meshNames) => modelRef.current?.resetTransform(meshNames),
      deleteMeshes: (meshNames) => modelRef.current?.deleteMeshes(meshNames),
      duplicateMeshes: (meshNames) => modelRef.current?.duplicateMeshes(meshNames),
      flipNormals: (meshNames) => modelRef.current?.flipNormals(meshNames),
      centerOrigin: (meshNames) => modelRef.current?.centerOrigin(meshNames),
      subdivideMesh: (meshNames, iters) => modelRef.current?.subdivideMesh(meshNames, iters),
      setWireframe: (on) => modelRef.current?.setWireframe(on),
      smoothMesh: (meshNames, iters) => modelRef.current?.smoothMesh(meshNames, iters),
      applyTransform: (meshNames) => modelRef.current?.applyTransform(meshNames),
      getSnapshot: () => modelRef.current!.getSnapshot(),
      restoreSnapshot: (snap) => modelRef.current?.restoreSnapshot(snap),
    }));

    return (
      <div className="w-full h-full" style={{ background: "#111" }}>
        <Canvas
          gl={{
            antialias: Q.antialias,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2,
            powerPreference: "high-performance",
          }}
          dpr={Q.dpr}
          camera={{ fov: 35, near: 0.1, far: 100, position: [0, 1.5, 5] }}
          onPointerMissed={() => onMeshClick("", false)}
          frameloop="demand"
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
        >
          <Suspense fallback={null}>
            {/* Lighting — reduced on low tier */}
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

            <GemEnvLoader onLoaded={handleGemEnvLoaded} />

            {hasModel && (
              <LoadedModel
                ref={modelRef}
                url={modelUrl}
                selectedMeshNames={selectedMeshNames}
                onMeshClick={onMeshClick}
                transformMode={transformMode}
                onMeshesDetected={onMeshesDetected}
                gemEnvMap={gemEnvMap}
                onTransformEnd={onTransformEnd}
              />
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

            {/* Post-processing only on medium/high tier */}
            {Q.postProcessing && <JewelryPostProcessing />}
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
