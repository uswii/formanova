

# Performance Hardening: Text-to-CAD 3D Viewer

## What we're fixing

Complex CAD models with hundreds of gem meshes crash Chrome on Mac. Each gem gets an expensive `MeshRefractionMaterial` (ray-marched refraction, 5 bounces) plus a per-gem `useFrame` callback syncing transforms every frame. This is the primary crash vector.

## Plan — 3 changes, 2 files

### Change 1: Scene Complexity Guardrail

**File:** `src/components/text-to-cad/CADCanvas.tsx` — after line 500 (after `setMeshDataList` / `setAssignedMaterials`)

Add budget constants at module level:

```ts
const MAX_TOTAL_VERTICES = 2_000_000;
const MAX_TOTAL_FACES    = 1_000_000;
const MAX_GEM_MESHES     = 100;
```

Add a `sceneHeavyRef = useRef(false)` inside `LoadedModel`.

In the decomposition effect, after `setAssignedMaterials(autoMaterials)`, compute totals:

```ts
const totalVerts = list.reduce((sum, md) => sum + (md.geometry?.attributes?.position?.count || 0), 0);
const totalFaces = list.reduce((sum, md) => {
  const geo = md.geometry;
  return sum + (geo?.index ? geo.index.count / 3 : (geo?.attributes?.position?.count || 0) / 3);
}, 0);
let gemCount = 0;
for (const name of Object.keys(autoMaterials)) {
  if (autoMaterials[name]?.category === "gemstone" && autoMaterials[name]?.refractionConfig) gemCount++;
}

const heavy = totalVerts > MAX_TOTAL_VERTICES || totalFaces > MAX_TOTAL_FACES || gemCount > MAX_GEM_MESHES;
sceneHeavyRef.current = heavy;

if (heavy) {
  console.warn(`[CADCanvas] Heavy scene: ${totalVerts} verts, ${totalFaces} faces, ${gemCount} gems — using optimized rendering`);
  toast.info("Complex model detected — rendering optimized for stability");
}
```

This adds `import { toast } from "sonner"` at the top of the file.

### Change 2: Gem Rendering Fallback for Heavy / Low-Tier Scenes

**File:** `src/components/text-to-cad/CADCanvas.tsx` — in the `useMemo` at line 1150

Compute a boolean before the `forEach`:

```ts
const useRefractionGems = !sceneHeavyRef.current && Q.tier !== "low";
```

Modify the gem branch (lines 1206-1211):

```ts
if (assigned?.category === "gemstone" && assigned.refractionConfig) {
  if (useRefractionGems) {
    // Full refraction path (current behavior)
    gems.push({ meshData: md, refractionConfig: assigned.refractionConfig, isSelected });
    const hiddenMat = new THREE.MeshBasicMaterial({ visible: false });
    standard.push({ ...md, material: hiddenMat, isSelected });
  } else {
    // Cheap PBR fallback — glass-like appearance, no per-gem useFrame
    const rc = assigned.refractionConfig;
    const fallbackKey = `gem_fallback_${md.name}_${assigned.id}`;
    let fallback = materialCache.current.get(fallbackKey);
    if (!fallback) {
      fallback = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(rc.color),
        transmission: 0.85,
        ior: rc.ior,
        roughness: 0.05,
        metalness: 0,
        thickness: 0.5,
        envMapIntensity: 1.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        side: THREE.DoubleSide,
      });
      materialCache.current.set(fallbackKey, fallback);
    }
    standard.push({ ...md, material: fallback, isSelected });
  }
  return;
}
```

Result: when `sceneHeavyRef` is true or device is low-tier, gems render as glass-like PBR. No `SyncedGemOverlay` mounted, no per-gem `useFrame`, no `MeshRefractionMaterial`, no diamond HDRI load.

Additionally, wire `Q.gemBounces` into `DiamondEnvMapConsumer` (line 1433):

```ts
bounces={Math.min(refractionConfig.bounces, Q.gemBounces)}
```

This caps refraction bounces on medium-tier devices (3 instead of 5) even for normal scenes.

### Change 3: Tighten Low-Tier Quality + Power Preference

**File:** `src/lib/gpu-detect.ts`

Low tier DPR: `[1, 1]` → `[0.75, 0.75]` (reduces pixel work ~44% on low-end devices)

High tier gemBounces: `6` → `5` (match `DIAMOND_DEFAULTS.bounces`)

**File:** `src/components/text-to-cad/CADCanvas.tsx` — Canvas `gl` prop (line 1564):

```ts
powerPreference: Q.tier === "low" ? "low-power" : "high-performance",
```

## Impact Matrix

| Scenario | Visual change | Effect |
|----------|--------------|--------|
| Normal model, high-tier | None | gemBounces stays 5 |
| Normal model, medium-tier | Subtly fewer sparkles (5→3 bounces) | Moderate GPU savings |
| Normal model, low-tier | Lower DPR + PBR gem fallback | Significant savings |
| Heavy model (any device) | Gems use glass-like PBR + toast notification | Eliminates crash vector |

## What stays untouched

- No new files or dependencies (sonner already imported elsewhere)
- No changes to geometry, mesh decomposition, material library, camera, orbit, transform tools, export
- No canvas remounting — `sceneHeavyRef` is set before the `useMemo` runs in the same render cycle
- Normal models on good hardware: identical visuals

