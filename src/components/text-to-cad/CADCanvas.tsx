import React, { useRef, useState, useEffect, Suspense, useMemo, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas, useThree, useFrame, ThreeEvent, invalidate, useLoader } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
  TransformControls,
  GizmoHelper,
  GizmoViewport,
  MeshRefractionMaterial,
} from "@react-three/drei";
import { RGBELoader } from "three-stdlib";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MATERIAL_LIBRARY, findMaterial, DIAMOND_DEFAULTS } from "@/components/cad-studio/materials";
import type { MaterialDef, GemRefractionConfig } from "@/components/cad-studio/materials";
import { getQualitySettings } from "@/lib/gpu-detect";

// ── Quality settings (cached, runs once) ──
const Q = getQualitySettings();

// Module-level flag: prevents React from overwriting mesh transforms during gizmo drag
let _isTransformDragging = false;

// Stores the quaternion at the start of each gizmo drag for delta computation
let _dragStartQuat: THREE.Quaternion | null = null;
let _dragStartRotDeg: [number, number, number] | null = null;

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

// ── Dynamic light intensity controller (updates toneMappingExposure + invalidates) ──
function LightController({ intensity }: { intensity: number }) {
  const { gl, invalidate: inv } = useThree();
  useEffect(() => {
    gl.toneMappingExposure = 0.45 * intensity;
    inv();
  }, [intensity, gl, inv]);
  return null;
}

// Post-processing removed for performance

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
  onDragStart,
  onDragEnd,
  onRotationDelta,
}: {
  object: THREE.Object3D;
  mode: "translate" | "rotate" | "scale";
  onDragStart?: () => void;
  onDragEnd?: (obj: THREE.Object3D) => void;
  onRotationDelta?: (obj: THREE.Object3D, deltaDeg: [number, number, number]) => void;
}) {
  const { gl } = useThree();
  const inv = useInvalidate();
  const controlsRef = useRef<any>(null);
  const prevQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const handler = (e: any) => {
      const orbitControls = (gl.domElement as any).__orbitControls;
      if (orbitControls) orbitControls.enabled = !e.value;
      _isTransformDragging = e.value;
      if (e.value) {
        // Drag started — snapshot the current quaternion for delta tracking
        prevQuatRef.current.copy(object.quaternion);
        onDragStart?.();
        inv();
      }
      // When drag ends, pass the object back so we can sync state
      if (!e.value && onDragEnd) onDragEnd(object);
    };
    controls.addEventListener("dragging-changed", handler);
    const onChange = () => {
      // During rotate drag, compute incremental delta and report it
      if (_isTransformDragging && mode === "rotate" && onRotationDelta) {
        const prevInv = prevQuatRef.current.clone().invert();
        const deltaQuat = object.quaternion.clone().multiply(prevInv);
        // Convert delta quaternion to axis-angle, then to per-axis degrees
        const axis = new THREE.Vector3();
        let angle = 0;
        deltaQuat.normalize();
        // Decompose delta into axis-angle
        const sinHalf = Math.sqrt(deltaQuat.x ** 2 + deltaQuat.y ** 2 + deltaQuat.z ** 2);
        if (sinHalf > 1e-6) {
          axis.set(deltaQuat.x / sinHalf, deltaQuat.y / sinHalf, deltaQuat.z / sinHalf);
          angle = 2 * Math.atan2(sinHalf, deltaQuat.w);
          // Normalize angle to [-PI, PI]
          if (angle > Math.PI) angle -= 2 * Math.PI;
          const D = 180 / Math.PI;
          const deltaDeg: [number, number, number] = [
            axis.x * angle * D,
            axis.y * angle * D,
            axis.z * angle * D,
          ];
          onRotationDelta(object, deltaDeg);
        }
        prevQuatRef.current.copy(object.quaternion);
      }
      inv();
    };
    controls.addEventListener("objectChange", onChange);
    return () => {
      controls.removeEventListener("dragging-changed", handler);
      controls.removeEventListener("objectChange", onChange);
      _isTransformDragging = false;
    };
  }, [gl, onDragEnd, onRotationDelta, inv, object, mode]);

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
  quaternion: THREE.Quaternion;
  rotationDeg: [number, number, number]; // cumulative degrees, can exceed ±360
  scale: THREE.Vector3;
  origPos: THREE.Vector3;
  origQuat: THREE.Quaternion;
  origRotationDeg: [number, number, number];
  origScale: THREE.Vector3;
}

/** Convert quaternion to Euler degrees (XYZ order) */
function quatToDeg(q: THREE.Quaternion): [number, number, number] {
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  const D = 180 / Math.PI;
  return [e.x * D, e.y * D, e.z * D];
}

/** Unwrap raw Euler degrees against a previous value so deltas < 180° stay continuous */
function unwrapDeg(raw: [number, number, number], prev: [number, number, number]): [number, number, number] {
  const out: [number, number, number] = [...raw];
  for (let i = 0; i < 3; i++) {
    while (out[i] - prev[i] > 180) out[i] -= 360;
    while (out[i] - prev[i] < -180) out[i] += 360;
  }
  return out;
}

/** Convert degrees to quaternion */
function degToQuat(deg: [number, number, number]): THREE.Quaternion {
  const R = Math.PI / 180;
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(deg[0] * R, deg[1] * R, deg[2] * R, 'XYZ'));
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
    removeAllTextures: () => void;
    getSelectedTransform: () => MeshTransformData | null;
    setMeshTransform: (axis: 'x' | 'y' | 'z', property: 'position' | 'rotation' | 'scale', value: number) => void;
  },
  {
  url: string;
    additionalGlbUrls?: string[];
    selectedMeshNames: Set<string>;
    hiddenMeshNames: Set<string>;
    onMeshClick: (name: string, multi: boolean) => void;
    transformMode: string;
    onMeshesDetected?: (meshes: { name: string; verts: number; faces: number }[]) => void;
    onTransformStart?: () => void;
    onTransformEnd?: () => void;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onModelReady?: () => void;
  }
>(({ url, additionalGlbUrls = [], selectedMeshNames, hiddenMeshNames, onMeshClick, transformMode, onMeshesDetected, onTransformStart, onTransformEnd, onLoadStart, onLoadEnd, onModelReady }, ref) => {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const loadedUrlRef = useRef<string>("");

  // Load GLB via server-side blob-proxy to avoid CORS issues with Azure
  useEffect(() => {
    if (!url || loadedUrlRef.current === url) return;
    loadedUrlRef.current = url;
    let cancelled = false;
    onLoadStart?.();

    (async () => {
      try {
        const isBlobUrl = url.startsWith("blob:");
        let arrayBuffer: ArrayBuffer;

        if (isBlobUrl) {
          console.log("[CADCanvas] Loading local blob GLB directly");
          const response = await fetch(url);
          arrayBuffer = await response.arrayBuffer();
        } else {
          const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blob-proxy`;
          console.log("[CADCanvas] Fetching GLB via blob-proxy for:", url.substring(0, 80));
          const response = await fetch(proxyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Proxy returned ${response.status}: ${errBody.substring(0, 200)}`);
          }
          arrayBuffer = await response.arrayBuffer();
        }

        if (cancelled) return;

        const loader = new GLTFLoader();
        loader.parse(arrayBuffer, "", (gltf) => {
          if (cancelled) return;
          console.log("[CADCanvas] GLB parsed successfully, size:", arrayBuffer.byteLength);
          setScene(gltf.scene);
          onLoadEnd?.();
        }, (error) => {
          console.error("[CADCanvas] Failed to parse GLB:", error);
          loadedUrlRef.current = "";
          onLoadEnd?.();
        });
      } catch (error) {
        console.error("[CADCanvas] Failed to fetch GLB:", error);
        if (!cancelled) {
          loadedUrlRef.current = "";
          onLoadEnd?.();
        }
      }
    })();

    return () => { cancelled = true; };
  }, [url, onLoadStart, onLoadEnd]);
  const [meshDataList, setMeshDataList] = useState<MeshData[]>([]);
  const [assignedMaterials, setAssignedMaterials] = useState<Record<string, MaterialDef>>({});
  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const flatGeoCache = useRef<Map<string, THREE.BufferGeometry>>(new Map());
  const materialCache = useRef<Map<string, THREE.Material>>(new Map());
  // Tracks meshes where the user explicitly applied a material AFTER selecting them.
  // When this set contains a mesh name, the applied material is shown instead of the blue overlay.
  // Cleared when selection changes; populated by applyMaterial.
  const materialAppliedAfterSelect = useRef<Set<string>>(new Set());
  const prevSelectedRef = useRef<Set<string>>(new Set());
  const inv = useInvalidate();

  // ── Decompose scene into individual mesh data ──
  useEffect(() => {
    if (!scene) return;
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
        const quat = worldQuat.clone();
        const scl = worldScale.multiplyScalar(s);
        const origMat = Array.isArray(mesh.material) ? mesh.material[0].clone() : mesh.material.clone();
        // Ensure double-sided rendering to prevent disappearing faces at certain angles
        if ((origMat as THREE.MeshStandardMaterial).side !== undefined) {
          (origMat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
        }

        const initDeg = quatToDeg(quat);
        list.push({
          name,
          geometry: mesh.geometry,
          originalMaterial: origMat,
          position: pos.clone(),
          quaternion: quat.clone(),
          rotationDeg: [...initDeg],
          scale: scl.clone(),
          origPos: pos.clone(),
          origQuat: quat.clone(),
          origRotationDeg: [...initDeg],
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

    // ── Magic Texturing: auto-assign materials based on mesh name + material heuristics ──
    const autoMaterials: Record<string, MaterialDef> = {};
    const gemKeywords = ["gem", "diamond", "stone", "ruby", "sapphire", "emerald", "crystal", "halo_gem", "center_gem", "pave", "brilliant", "round_cut", "cushion", "oval", "marquise", "princess", "facet"];
    const platinumKeywords = ["prong", "claw", "bead", "milgrain", "setting", "basket", "collet"];
    const diamondMatDef = findMaterial("diamond")!;
    const platinumMatDef = findMaterial("platinum")!;
    const goldMatDef = findMaterial("yellow-gold")!;

    // Compute median vertex count to identify small meshes (likely gems)
    const vertCounts = list.map((md) => md.geometry?.attributes?.position?.count || 0).sort((a, b) => a - b);
    const medianVerts = vertCounts[Math.floor(vertCounts.length / 2)] || 0;

    // Helper: detect if original material looks like a gem (transparent, refractive, non-metallic)
    const looksLikeGem = (mat: THREE.Material): boolean => {
      if (!(mat instanceof THREE.MeshPhysicalMaterial || mat instanceof THREE.MeshStandardMaterial)) return false;
      const phys = mat as THREE.MeshPhysicalMaterial;
      // Check transmission (refractive/transparent material)
      if (phys.transmission !== undefined && phys.transmission > 0.1) return true;
      // Check opacity + transparent flag
      if (phys.transparent && phys.opacity < 0.8) return true;
      // Non-metallic with very low roughness = likely polished gem
      if (phys.metalness < 0.3 && phys.roughness < 0.15) return true;
      // White/light gray non-metallic material = likely uncolored gem placeholder
      if (phys.metalness < 0.3) {
        const c = phys.color;
        if (c && c.r > 0.7 && c.g > 0.7 && c.b > 0.7 && phys.roughness < 0.4) return true;
      }
      return false;
    };

    // Helper: detect if original material looks metallic (prong-like)
    const looksLikeMetal = (mat: THREE.Material): boolean => {
      if (!(mat instanceof THREE.MeshPhysicalMaterial || mat instanceof THREE.MeshStandardMaterial)) return false;
      return mat.metalness > 0.7;
    };

    list.forEach((md) => {
      const lower = md.name.toLowerCase();
      const verts = md.geometry?.attributes?.position?.count || 0;

      // 1. Name-based matching (highest priority)
      if (gemKeywords.some((kw) => lower.includes(kw))) {
        autoMaterials[md.name] = diamondMatDef;
      } else if (platinumKeywords.some((kw) => lower.includes(kw))) {
        autoMaterials[md.name] = platinumMatDef;
      }
      // 2. Material property heuristic (for pipeline models with generic names)
      else if (looksLikeGem(md.originalMaterial)) {
        autoMaterials[md.name] = diamondMatDef;
        console.log(`[MagicTex] "${md.name}" → diamond (material heuristic: transmission/transparency)`);
      }
      // 3. Geometry size heuristic: small non-metallic meshes are likely gems
      else if (verts > 0 && verts < medianVerts * 0.3 && !looksLikeMetal(md.originalMaterial)) {
        autoMaterials[md.name] = diamondMatDef;
        console.log(`[MagicTex] "${md.name}" → diamond (size heuristic: ${verts} verts < ${Math.round(medianVerts * 0.3)} threshold)`);
      }
      // 4. Default to gold
      else {
        autoMaterials[md.name] = goldMatDef;
      }
    });

    setMeshDataList(list);
    setAssignedMaterials(autoMaterials);
    inv();

    if (onMeshesDetected) {
      onMeshesDetected(list.map((m) => ({
        name: m.name,
        verts: m.geometry?.attributes?.position?.count || 0,
        faces: m.geometry?.index ? m.geometry.index.count / 3 : (m.geometry?.attributes?.position?.count || 0) / 3,
      })));
    }

    // Signal model is fully processed and ready to render after next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onModelReady?.();
      });
    });
  }, [scene, onMeshesDetected, inv, onModelReady]);

  // ── Merge additional GLB parts into the existing scene ──
  const mergedUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!additionalGlbUrls.length) return;
    const newUrls = additionalGlbUrls.filter((u) => !mergedUrlsRef.current.has(u));
    if (!newUrls.length) return;

    newUrls.forEach((partUrl) => {
      mergedUrlsRef.current.add(partUrl);
      (async () => {
        try {
          const isBlobUrl = partUrl.startsWith("blob:");
          let arrayBuffer: ArrayBuffer;
          if (isBlobUrl) {
            arrayBuffer = await (await fetch(partUrl)).arrayBuffer();
          } else {
            const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blob-proxy`;
            const resp = await fetch(proxyUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: partUrl }),
            });
            arrayBuffer = await resp.arrayBuffer();
          }

          const loader = new GLTFLoader();
          loader.parse(arrayBuffer, "", (gltf) => {
            const clone = gltf.scene.clone(true);
            const box = new THREE.Box3().setFromObject(clone);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const s = maxDim === 0 ? 1 : 3 / maxDim;

            const newParts: MeshData[] = [];
            let idx = 0;
            clone.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const baseName = mesh.name || `Part_${idx}`;
                // Deduplicate names
                let name = baseName;
                let suffix = 1;
                const existingNames = new Set(meshDataList.map((m) => m.name));
                while (existingNames.has(name)) {
                  name = `${baseName}_${suffix++}`;
                }

                mesh.updateWorldMatrix(true, false);
                const wp = new THREE.Vector3();
                const wq = new THREE.Quaternion();
                const ws = new THREE.Vector3();
                mesh.matrixWorld.decompose(wp, wq, ws);

                const pos = new THREE.Vector3(
                  (wp.x - center.x) * s,
                  (wp.y - center.y) * s,
                  (wp.z - center.z) * s
                );
                const quat = wq.clone();
                const scl = ws.multiplyScalar(s);
                const origMat = Array.isArray(mesh.material) ? mesh.material[0].clone() : mesh.material.clone();
                if ((origMat as any).side !== undefined) (origMat as any).side = THREE.DoubleSide;

                const partDeg = quatToDeg(quat);
                newParts.push({
                  name,
                  geometry: mesh.geometry,
                  originalMaterial: origMat,
                  position: pos.clone(),
                  quaternion: quat.clone(),
                  rotationDeg: [...partDeg],
                  scale: scl.clone(),
                  origPos: pos.clone(),
                  origQuat: quat.clone(),
                  origRotationDeg: [...partDeg],
                  origScale: scl.clone(),
                });
                idx++;
              }
            });

            if (newParts.length === 0) return;

            // Auto-assign materials to new parts
            const gemKeywordsLocal = ["gem", "diamond", "stone", "ruby", "sapphire", "emerald", "crystal", "halo_gem", "center_gem", "pave"];
            const platKeywordsLocal = ["prong", "claw", "bead", "milgrain"];
            const dMat = findMaterial("diamond")!;
            const pMat = findMaterial("platinum")!;
            const gMat = findMaterial("yellow-gold")!;

            const newMaterials: Record<string, MaterialDef> = {};
            newParts.forEach((md) => {
              const lower = md.name.toLowerCase();
              if (gemKeywordsLocal.some((kw) => lower.includes(kw))) {
                newMaterials[md.name] = dMat;
              } else if (platKeywordsLocal.some((kw) => lower.includes(kw))) {
                newMaterials[md.name] = pMat;
              } else {
                newMaterials[md.name] = gMat;
              }
            });

            setMeshDataList((prev) => [...prev, ...newParts]);
            setAssignedMaterials((prev) => ({ ...prev, ...newMaterials }));
            inv();

            if (onMeshesDetected) {
              // Re-report all meshes
              setMeshDataList((current) => {
                onMeshesDetected(current.map((m) => ({
                  name: m.name,
                  verts: m.geometry?.attributes?.position?.count || 0,
                  faces: m.geometry?.index ? m.geometry.index.count / 3 : (m.geometry?.attributes?.position?.count || 0) / 3,
                })));
                return current;
              });
            }

            console.log(`[CADCanvas] Merged ${newParts.length} part(s) from additional GLB`);
          }, (err) => {
            console.error("[CADCanvas] Failed to parse additional GLB:", err);
          });
        } catch (err) {
          console.error("[CADCanvas] Failed to fetch additional GLB:", err);
        }
      })();
    });
  }, [additionalGlbUrls, meshDataList, inv, onMeshesDetected]);

  // ── Sync transform from Three.js object back to React state ──
  // Position and scale are read directly. Rotation is NOT derived from quaternion
  // (Euler decomposition is lossy/clamped). Instead rotation is tracked incrementally.
  const syncTransformFromObject = useCallback((meshName: string, obj: THREE.Object3D) => {
    setMeshDataList((prev) => prev.map((md) => {
      if (md.name !== meshName) return md;
      return {
        ...md,
        position: obj.position.clone(),
        quaternion: obj.quaternion.clone(),
        // rotationDeg is NOT updated here — it's updated incrementally via handleRotationDelta
        scale: obj.scale.clone(),
      };
    }));
  }, []);

  // Called during rotate gizmo drag with incremental degree deltas (no Euler decomposition)
  const handleRotationDelta = useCallback((obj: THREE.Object3D, deltaDeg: [number, number, number]) => {
    // Find which mesh this object is
    for (const [name, meshObj] of meshRefs.current.entries()) {
      if (meshObj === obj) {
        setMeshDataList((prev) => prev.map((md) => {
          if (md.name !== name) return md;
          return {
            ...md,
            quaternion: obj.quaternion.clone(),
            rotationDeg: [
              md.rotationDeg[0] + deltaDeg[0],
              md.rotationDeg[1] + deltaDeg[1],
              md.rotationDeg[2] + deltaDeg[2],
            ],
          };
        }));
        break;
      }
    }
  }, []);

  // Called when TransformControls drag starts
  const handleDragStart = useCallback(() => {
    onTransformStart?.();
  }, [onTransformStart]);

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
      const matDef = findMaterial(matId);
      if (!matDef) return;
      meshNames.forEach((n) => {
        flatGeoCache.current.delete(n);
        const key = `assigned_${n}_${matDef.id}`;
        const old = materialCache.current.get(key);
        if (old) old.dispose();
        materialCache.current.delete(key);
        // Mark: user explicitly applied material after selecting this mesh
        materialAppliedAfterSelect.current.add(n);
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
        return { ...md, position: md.origPos.clone(), quaternion: md.origQuat.clone(), rotationDeg: [...md.origRotationDeg], scale: md.origScale.clone() };
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
      const newItems: MeshData[] = [];
      setMeshDataList((prev) => {
        prev.forEach((md) => {
          if (names.has(md.name)) {
            const newPos = md.position.clone();
            newPos.x += 0.5;
            const dupName = `${md.name}_copy`;
            // Avoid duplicate names
            let finalName = dupName;
            let suffix = 2;
            const existingNames = new Set(prev.map(m => m.name));
            while (existingNames.has(finalName)) {
              finalName = `${md.name}_copy_${suffix++}`;
            }
            const newMd: MeshData = {
              ...md,
              name: finalName,
              geometry: md.geometry.clone(),
              position: newPos,
              origPos: newPos.clone(),
            };
            newItems.push(newMd);
          }
        });
        return [...prev, ...newItems];
      });
      // Sync duplicated meshes back to parent mesh list
      if (onMeshesDetected && newItems.length > 0) {
        setTimeout(() => {
          setMeshDataList((current) => {
            onMeshesDetected(current.map((m) => ({
              name: m.name,
              verts: m.geometry?.attributes?.position?.count || 0,
              faces: m.geometry?.index ? m.geometry.index.count / 3 : (m.geometry?.attributes?.position?.count || 0) / 3,
            })));
            return current;
          });
        }, 0);
      }
      // Copy materials for duplicated meshes
      setAssignedMaterials((prev) => {
        const next = { ...prev };
        newItems.forEach((item) => {
          const origName = item.name.replace(/_copy(_\d+)?$/, '');
          if (prev[origName]) next[item.name] = prev[origName];
        });
        return next;
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
    // Remove all auto-assigned textures, revert to original GLB materials
    removeAllTextures: () => {
      setAssignedMaterials({});
      flatGeoCache.current.forEach((g) => g.dispose());
      flatGeoCache.current.clear();
      materialCache.current.forEach((m) => m.dispose());
      materialCache.current.clear();
      inv();
      console.log("[CADCanvas] All magic textures removed");
    },
    // Apply Transform: bake current transform into geometry, reset transform to identity
    applyTransform: (meshNames: string[]) => {
      const names = new Set(meshNames);
      setMeshDataList((prev) => prev.map((md) => {
        if (!names.has(md.name)) return md;
        // Build the object matrix: T * Q * S
        const matrix = new THREE.Matrix4();
        matrix.compose(md.position, md.quaternion, md.scale);
        // Apply matrix to geometry vertices
        const newGeo = md.geometry.clone();
        newGeo.applyMatrix4(matrix);
        newGeo.computeVertexNormals();
        // Reset transform to identity
        const identityPos = new THREE.Vector3(0, 0, 0);
        const identityQuat = new THREE.Quaternion();
        const identityScale = new THREE.Vector3(1, 1, 1);
        const zeroDeg: [number, number, number] = [0, 0, 0];
        return {
          ...md,
          geometry: newGeo,
          position: identityPos,
          quaternion: identityQuat,
          rotationDeg: [...zeroDeg],
          scale: identityScale,
          origPos: identityPos.clone(),
          origQuat: identityQuat.clone(),
          origRotationDeg: [...zeroDeg],
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
        quaternion: md.quaternion.clone(),
        rotationDeg: [...md.rotationDeg],
        scale: md.scale.clone(),
        origPos: md.origPos.clone(),
        origQuat: md.origQuat.clone(),
        origRotationDeg: [...md.origRotationDeg],
        origScale: md.origScale.clone(),
      })),
      assignedMaterials: { ...assignedMaterials },
    }),
    restoreSnapshot: (snap: CanvasSnapshot) => {
      setMeshDataList(snap.meshDataList);
      setAssignedMaterials(snap.assignedMaterials);
      // Clear the "material applied after select" tracking so overlay reappears on undo
      materialAppliedAfterSelect.current.clear();
      flatGeoCache.current.forEach((g) => g.dispose());
      flatGeoCache.current.clear();
      materialCache.current.forEach((m) => m.dispose());
      materialCache.current.clear();
      inv();
    },
    getSelectedTransform: (): MeshTransformData | null => {
      const selected = meshDataList.find((m) => selectedMeshNames.has(m.name));
      if (!selected) return null;
      return {
        position: [selected.position.x, selected.position.y, selected.position.z],
        rotation: [...selected.rotationDeg],
        scale: [selected.scale.x, selected.scale.y, selected.scale.z],
      };
    },
    setMeshTransform: (axis: 'x' | 'y' | 'z', property: 'position' | 'rotation' | 'scale', value: number) => {
      const selectedName = meshDataList.find((m) => selectedMeshNames.has(m.name))?.name;
      if (!selectedName) return;
      const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;

      setMeshDataList((prev) => prev.map((md) => {
        if (md.name !== selectedName) return md;
        if (property === 'position') {
          const newPos = md.position.clone();
          if (axisIdx === 0) newPos.x = value;
          else if (axisIdx === 1) newPos.y = value;
          else newPos.z = value;
          return { ...md, position: newPos };
        } else if (property === 'rotation') {
          // Update the cumulative degree value and derive quaternion from ALL three axes
          const newDeg: [number, number, number] = [...md.rotationDeg];
          newDeg[axisIdx] = value;
          const newQuat = degToQuat(newDeg);
          return { ...md, rotationDeg: newDeg, quaternion: newQuat };
        } else {
          const newScale = md.scale.clone();
          if (axisIdx === 0) newScale.x = value;
          else if (axisIdx === 1) newScale.y = value;
          else newScale.z = value;
          return { ...md, scale: newScale };
        }
      }));

      // Also update the Three.js mesh object directly for immediate visual feedback
      const meshObj = meshRefs.current.get(selectedName);
      if (meshObj) {
        if (property === 'position') {
          if (axisIdx === 0) meshObj.position.x = value;
          else if (axisIdx === 1) meshObj.position.y = value;
          else meshObj.position.z = value;
        } else if (property === 'rotation') {
          // Read current rotationDeg, apply the change, compute quaternion
          const md = meshDataList.find(m => m.name === selectedName);
          if (md) {
            const newDeg: [number, number, number] = [...md.rotationDeg];
            newDeg[axisIdx] = value;
            meshObj.quaternion.copy(degToQuat(newDeg));
          }
        } else {
          if (axisIdx === 0) meshObj.scale.x = value;
          else if (axisIdx === 1) meshObj.scale.y = value;
          else meshObj.scale.z = value;
        }
      }
      inv();
    },
    exportSceneBlob: async (): Promise<Blob> => {
      // Reconstruct a Three.js scene from live mesh refs (captures all imperative transforms)
      const exportScene = new THREE.Scene();
      meshDataList.forEach((md) => {
        const assigned = assignedMaterials[md.name];
        const material = assigned ? assigned.create() : md.originalMaterial.clone();
        if ('side' in material) (material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
        const mesh = new THREE.Mesh(md.geometry.clone(), material);
        mesh.name = md.name;
        // Read transforms from live Three.js mesh refs to capture all imperative changes
        const liveRef = meshRefs.current.get(md.name);
        if (liveRef) {
          mesh.position.copy(liveRef.position);
          mesh.quaternion.copy(liveRef.quaternion);
          mesh.scale.copy(liveRef.scale);
        } else {
          mesh.position.copy(md.position);
          mesh.quaternion.copy(md.quaternion);
          mesh.scale.copy(md.scale);
        }
        exportScene.add(mesh);
      });
      const exporter = new GLTFExporter();
      const result = await exporter.parseAsync(exportScene, { binary: true });
      return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
    },
  }), [meshDataList, assignedMaterials, inv, syncTransformFromObject, onTransformEnd, selectedMeshNames]);

  // Selection-change detection moved into useMemo below (synchronous)

  // ── Separate gemstone meshes from standard meshes ──
  // Track previous assignedMaterials to detect changes and clear stale cache entries synchronously
  const prevAssignedRef = useRef<Record<string, MaterialDef>>({});

  const { standardElements, gemElements } = useMemo(() => {
    // ── Clear "material applied after select" when selection changes (synchronous) ──
    const prevSel = prevSelectedRef.current;
    const selectionChanged = selectedMeshNames.size !== prevSel.size ||
      [...selectedMeshNames].some(n => !prevSel.has(n));
    if (selectionChanged) {
      materialAppliedAfterSelect.current.clear();
      prevSelectedRef.current = new Set(selectedMeshNames);
      // Ensure canvas re-renders with demand frameloop
      requestAnimationFrame(() => inv());
    }

    // Clear cache entries for meshes whose assigned material changed since last render
    const prevAssigned = prevAssignedRef.current;
    for (const name of Object.keys(assignedMaterials)) {
      if (prevAssigned[name]?.id !== assignedMaterials[name]?.id) {
        // Material changed — purge old and new cache keys so fresh material is created
        for (const [key] of materialCache.current) {
          if (key.includes(`_${name}_`)) {
            materialCache.current.get(key)?.dispose();
            materialCache.current.delete(key);
          }
        }
      }
    }
    // Also handle meshes that had materials removed (undo)
    for (const name of Object.keys(prevAssigned)) {
      if (!assignedMaterials[name] && prevAssigned[name]) {
        for (const [key] of materialCache.current) {
          if (key.includes(`_${name}_`)) {
            materialCache.current.get(key)?.dispose();
            materialCache.current.delete(key);
          }
        }
      }
    }
    prevAssignedRef.current = { ...assignedMaterials };

    const standard: (MeshData & { material: THREE.Material; isSelected: boolean })[] = [];
    const gems: { meshData: MeshData; refractionConfig: GemRefractionConfig; isSelected: boolean }[] = [];

    meshDataList.forEach((md) => {
      // Skip hidden meshes entirely
      if (hiddenMeshNames.has(md.name)) return;

      const isSelected = selectedMeshNames.has(md.name);
      const assigned = assignedMaterials[md.name];

      // Selection highlight — show blue overlay when selected, UNLESS the user
      // explicitly applied a material after selecting (materialAppliedAfterSelect).
      if (isSelected && !materialAppliedAfterSelect.current.has(md.name)) {
        standard.push({ ...md, material: SELECTION_MATERIAL, isSelected });
        return;
      }

      // Check if this mesh is assigned a gemstone material with refraction config
      if (assigned?.category === "gemstone" && assigned.refractionConfig) {
        gems.push({ meshData: md, refractionConfig: assigned.refractionConfig, isSelected });
        const hiddenMat = new THREE.MeshBasicMaterial({ visible: false });
        standard.push({ ...md, material: hiddenMat, isSelected });
        return;
      }

      const cacheKey = assigned ? `assigned_${md.name}_${assigned.id}` : `orig_${md.name}`;
      let material = materialCache.current.get(cacheKey);
      if (!material) {
        material = assigned ? assigned.create() : md.originalMaterial.clone();
        if ('side' in material) (material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
        materialCache.current.set(cacheKey, material);
      }
      standard.push({ ...md, material, isSelected });
    });

    return { standardElements: standard, gemElements: gems };
  }, [meshDataList, assignedMaterials, selectedMeshNames, hiddenMeshNames]);

  // ── Imperative transform sync: prevents React props from fighting TransformControls ──
  useEffect(() => {
    if (_isTransformDragging) return;
    meshDataList.forEach((md) => {
      const mesh = meshRefs.current.get(md.name);
      if (mesh) {
        mesh.position.copy(md.position);
        mesh.quaternion.copy(md.quaternion);
        mesh.scale.copy(md.scale);
      }
    });
    inv();
  }, [meshDataList, inv]);

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
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            onMeshClick(md.name, e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
          }}
        />
      ))}

      {/* Diamond overlay: refraction material rendered separately */}
      {gemElements.map((gem) => (
        <SyncedGemOverlay
          key={`gem_${gem.meshData.name}`}
          meshName={gem.meshData.name}
          geometry={gem.meshData.geometry}
          position={gem.meshData.position}
          quaternion={gem.meshData.quaternion}
          scale={gem.meshData.scale}
          refractionConfig={gem.refractionConfig}
          isSelected={gem.isSelected}
          meshRefs={meshRefs}
          onMeshClick={onMeshClick}
        />
      ))}

      {selectedMeshRef && transformMode !== "orbit" && (
        <TransformControlsWrapper
          object={selectedMeshRef}
          mode={transformMode as "translate" | "rotate" | "scale"}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onRotationDelta={handleRotationDelta}
        />
      )}
    </group>
  );
});

LoadedModel.displayName = "LoadedModel";

// ── Diamond/Gem Overlay with MeshRefractionMaterial ──
// Renders gemstone meshes using real refraction (MeshRefractionMaterial from drei)
// Uses a dedicated HDRI envMap loaded via RGBELoader, synced per frame.

function DiamondEnvMapLoader({ onEnvMapReady }: { onEnvMapReady: (map: THREE.Texture) => void }) {
  const envMap = useLoader(RGBELoader, "/hdri/diamond-studio.hdr");
  const { scene } = useThree();

  useEffect(() => {
    if (envMap) {
      envMap.mapping = THREE.EquirectangularReflectionMapping;
      onEnvMapReady(envMap);
    }
  }, [envMap, onEnvMapReady]);

  return null;
}

/**
 * SyncedGemOverlay — renders a single gem mesh with MeshRefractionMaterial.
 * Syncs world transform from the source (hidden) mesh every frame.
 * Exact replica of user's ModelViewer diamond overlay pattern.
 */
function SyncedGemOverlay({
  meshName,
  geometry,
  position,
  quaternion,
  scale,
  refractionConfig,
  isSelected,
  meshRefs,
  onMeshClick,
}: {
  meshName: string;
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  refractionConfig: GemRefractionConfig;
  isSelected: boolean;
  meshRefs: React.MutableRefObject<Map<string, THREE.Mesh>>;
  onMeshClick: (name: string, multi: boolean) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const inv = useInvalidate();

  // Sync position from the hidden source mesh every frame
  useFrame(() => {
    const source = meshRefs.current.get(meshName);
    if (!meshRef.current || !source) return;

    source.updateWorldMatrix(true, false);
    const _pos = new THREE.Vector3();
    const _quat = new THREE.Quaternion();
    const _scale = new THREE.Vector3();
    source.matrixWorld.decompose(_pos, _quat, _scale);

    meshRef.current.position.copy(_pos);
    meshRef.current.quaternion.copy(_quat);
    meshRef.current.scale.copy(_scale);
  });

  return (
    <DiamondEnvMapConsumer
      meshRef={meshRef}
      geometry={geometry}
      position={position}
      quaternion={quaternion}
      scale={scale}
      refractionConfig={refractionConfig}
      isSelected={isSelected}
      meshName={meshName}
      onMeshClick={onMeshClick}
    />
  );
}

/**
 * Consumes the diamond envMap from context and renders MeshRefractionMaterial.
 */
function DiamondEnvMapConsumer({
  meshRef,
  geometry,
  position,
  quaternion,
  scale,
  refractionConfig,
  isSelected,
  meshName,
  onMeshClick,
}: {
  meshRef: React.RefObject<THREE.Mesh>;
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  refractionConfig: GemRefractionConfig;
  isSelected: boolean;
  meshName: string;
  onMeshClick: (name: string, multi: boolean) => void;
}) {
  const envMap = useLoader(RGBELoader, "/hdri/diamond-studio.hdr");

  useEffect(() => {
    if (envMap) {
      envMap.mapping = THREE.EquirectangularReflectionMapping;
    }
  }, [envMap]);

  if (!envMap) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={position}
      quaternion={quaternion}
      scale={scale}
      castShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onMeshClick(meshName, e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
      }}
    >
      <MeshRefractionMaterial
        envMap={envMap}
        color={new THREE.Color(refractionConfig.color)}
        ior={refractionConfig.ior}
        aberrationStrength={refractionConfig.sparkle}
        bounces={refractionConfig.bounces}
        fresnel={refractionConfig.fresnel}
        toneMapped={false}
      />
    </mesh>
  );
}


export interface MeshTransformData {
  position: [number, number, number];
  rotation: [number, number, number]; // degrees
  scale: [number, number, number];
}

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
  removeAllTextures: () => void;
  getSnapshot: () => CanvasSnapshot;
  restoreSnapshot: (snap: CanvasSnapshot) => void;
  getSelectedTransform: () => MeshTransformData | null;
  setMeshTransform: (axis: 'x' | 'y' | 'z', property: 'position' | 'rotation' | 'scale', value: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetCamera: () => void;
  exportSceneBlob: () => Promise<Blob>;
}

interface CADCanvasProps {
  hasModel: boolean;
  glbUrl?: string;
  additionalGlbUrls?: string[];
  selectedMeshNames: Set<string>;
  hiddenMeshNames?: Set<string>;
  onMeshClick: (name: string, multi: boolean) => void;
  transformMode: string;
  onMeshesDetected?: (meshes: { name: string; verts: number; faces: number }[]) => void;
  onTransformStart?: () => void;
  onTransformEnd?: () => void;
  lightIntensity?: number;
  onModelReady?: () => void;
}

const CADCanvas = forwardRef<CADCanvasHandle, CADCanvasProps>(
  ({ hasModel, glbUrl, additionalGlbUrls = [], selectedMeshNames, hiddenMeshNames = new Set(), onMeshClick, transformMode, onMeshesDetected, onTransformStart, onTransformEnd, lightIntensity = 1, onModelReady }, ref) => {
    const modelUrl = glbUrl || "/models/ring.glb";
    const modelRef = useRef<CADCanvasHandle>(null);



    const getOrbitControls = useCallback(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('canvas');
      return canvas ? (canvas as any).__orbitControls : null;
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
      removeAllTextures: () => modelRef.current?.removeAllTextures(),
      getSnapshot: () => modelRef.current!.getSnapshot(),
      restoreSnapshot: (snap) => modelRef.current?.restoreSnapshot(snap),
      getSelectedTransform: () => modelRef.current?.getSelectedTransform() ?? null,
      setMeshTransform: (axis, property, value) => modelRef.current?.setMeshTransform(axis, property, value),
      exportSceneBlob: () => modelRef.current!.exportSceneBlob(),
      zoomIn: () => {
        const controls = getOrbitControls();
        if (!controls) return;
        const dir = new THREE.Vector3().subVectors(controls.target, controls.object.position).normalize();
        controls.object.position.addScaledVector(dir, controls.object.position.distanceTo(controls.target) * 0.2);
        controls.update();
      },
      zoomOut: () => {
        const controls = getOrbitControls();
        if (!controls) return;
        const dir = new THREE.Vector3().subVectors(controls.target, controls.object.position).normalize();
        controls.object.position.addScaledVector(dir, -controls.object.position.distanceTo(controls.target) * 0.2);
        controls.update();
      },
      resetCamera: () => {
        const controls = getOrbitControls();
        if (!controls) return;
        controls.object.position.set(0, 1.5, 5);
        controls.target.set(0, 0, 0);
        controls.update();
      },
    }));

    const [isLoading, setIsLoading] = useState(false);

    // Track loading state from LoadedModel
    const handleLoadStart = useCallback(() => setIsLoading(true), []);
    const handleLoadEnd = useCallback(() => setIsLoading(false), []);

    return (
      <div className="w-full h-full relative" style={{ background: "#111" }}>
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
              <div className="font-display text-lg text-foreground/80 uppercase tracking-[0.15em] mb-1">Loading Model</div>
              <div className="font-mono text-[11px] text-muted-foreground tracking-wide">Parsing geometry…</div>
            </div>
          </div>
        )}
        <Canvas
          gl={{
            antialias: Q.antialias,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 0.45 * lightIntensity,
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
            {/* Dynamic light intensity sync */}
            <LightController intensity={lightIntensity} />
            {/* Lighting — scaled by lightIntensity */}
            <ambientLight intensity={0.08 * lightIntensity} />
            <directionalLight position={[3, 5, 3]} intensity={0.6 * lightIntensity} color="#f5f0e8" />
            {Q.maxLights >= 4 && (
              <directionalLight position={[-3, 2, -3]} intensity={0.3 * lightIntensity} color="#e8e4dc" />
            )}
            <hemisphereLight args={["#d4cfc8", "#8a8580", 0.15 * lightIntensity]} />
            {Q.maxLights >= 5 && (
              <spotLight position={[0, 8, 0]} intensity={0.25 * lightIntensity} angle={0.5} penumbra={1} color="#fff5e6" />
            )}

            <Environment files="/hdri/jewelry-studio-v2.hdr" environmentIntensity={0.35 * lightIntensity} />

            

            {hasModel && (
              <LoadedModel
                ref={modelRef}
                url={modelUrl}
                additionalGlbUrls={additionalGlbUrls}
                selectedMeshNames={selectedMeshNames}
                hiddenMeshNames={hiddenMeshNames}
                onMeshClick={onMeshClick}
                transformMode={transformMode}
                onMeshesDetected={onMeshesDetected}
                onTransformStart={onTransformStart}
                onTransformEnd={onTransformEnd}
                onLoadStart={handleLoadStart}
                onLoadEnd={handleLoadEnd}
                onModelReady={onModelReady}
              />
            )}

            <OrbitControlsWithRef
              enablePan={true}
              enableZoom={true}
              enableDamping
              dampingFactor={0.03}
              minDistance={0.5}
              maxDistance={50}
              minPolarAngle={0}
              maxPolarAngle={Math.PI}
              makeDefault
            />
            <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
              <GizmoViewport labelColor="white" axisHeadScale={0.8} />
            </GizmoHelper>

          </Suspense>
        </Canvas>

      </div>
    );
  }
);

CADCanvas.displayName = "CADCanvas";
export default CADCanvas;

// Static ring.glb is preloaded via standard fetch for the default viewport
